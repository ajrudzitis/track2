/**
 * Simulation engine: game loop, train movement, signal interlocking, platform dwell.
 */

import type { Train, Segment, Platform, Switch, Route } from './types.js';
import { ANSI_COLORS } from './types.js';
import type { Signal } from './signal.js';
import type { TrackGraph } from './graph.js';

/**
 * Average seconds for a train to traverse one segment.
 * At speed=1.0, a 5-segment track takes ~20s end-to-end (matching DESIGN.md).
 */
const BASE_SEGMENT_TIME = 4.0;

export class Simulation {
  trains: Train[] = [];
  private graph: TrackGraph;
  private speed: number = 1.0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private onTick: (() => void) | null = null;

  constructor(graph: TrackGraph) {
    this.graph = graph;
  }

  get currentSpeed(): number {
    return this.speed;
  }

  setSpeed(s: number): void {
    this.speed = Math.max(0.25, Math.min(4.0, s));
  }

  increaseSpeed(): void {
    this.setSpeed(this.speed + 0.25);
  }

  decreaseSpeed(): void {
    this.setSpeed(this.speed - 0.25);
  }

  /**
   * Spawn one train on each track at the first platform (or first segment).
   */
  spawnDefaultTrains(color: string = 'cyan'): void {
    const colorCode = ANSI_COLORS[color] ?? 46;

    for (const tg of this.graph.trackGroups) {
      // West track — start at the LAST platform (far end) so it has full distance to travel
      const westStart = this.findLastPlatform(tg.westSegments) ?? tg.westSegments[0];
      if (westStart) {
        this.trains.push({
          id: this.generateId(),
          segmentId: westStart,
          position: 0.5,
          direction: 'west',
          state: 'running',
          dwellRemaining: 0,
          color: colorCode,
          trackGroupName: tg.name,
          trackDirection: 'west',
          lastPlatformIndex: 0,
        });
      }

      // East track — start at the first platform
      const eastStart = this.findFirstPlatform(tg.eastSegments) ?? tg.eastSegments[0];
      if (eastStart) {
        this.trains.push({
          id: this.generateId(),
          segmentId: eastStart,
          position: 0.5,
          direction: 'east',
          state: 'running',
          dwellRemaining: 0,
          color: colorCode,
          trackGroupName: tg.name,
          trackDirection: 'east',
          lastPlatformIndex: 0,
        });
      }
    }
  }

  /**
   * Spawn trains based on route definitions.
   */
  spawnRouteTrains(): void {
    for (const route of this.graph.routes) {
      const westCount = Math.ceil(route.trainCount / 2);
      const eastCount = Math.floor(route.trainCount / 2);
      let idIndex = 0;

      this.spawnTrainsOnTrack(route, 'west', westCount, idIndex);
      idIndex += westCount;
      this.spawnTrainsOnTrack(route, 'east', eastCount, idIndex);
    }
  }

  private spawnTrainsOnTrack(route: Route, trackDirection: 'west' | 'east', count: number, idOffset: number): void {
    if (count === 0) return;

    const extent = this.graph.getRouteExtent(route, trackDirection);
    if (extent.length === 0) return;

    const occupiedSegments = new Set(this.trains.map(t => t.segmentId));

    for (let i = 0; i < count; i++) {
      // Distribute trains evenly across ALL segments in the route extent, avoiding occupied ones
      let segIdx = Math.floor(i * extent.length / count);
      let segmentId = extent[segIdx];

      // If occupied, find nearest unoccupied segment
      if (occupiedSegments.has(segmentId)) {
        for (let offset = 1; offset < extent.length; offset++) {
          const fwd = segIdx + offset;
          const bwd = segIdx - offset;
          if (fwd < extent.length && !occupiedSegments.has(extent[fwd])) { segmentId = extent[fwd]; break; }
          if (bwd >= 0 && !occupiedSegments.has(extent[bwd])) { segmentId = extent[bwd]; break; }
        }
      }
      occupiedSegments.add(segmentId);

      const id = (idOffset + i < route.trainIds.length)
        ? route.trainIds[idOffset + i]
        : this.generateId();

      // Find initial route progress
      let lastPlatformIndex = 0;
      const seg = this.graph.segments.get(segmentId);
      if (seg?.type === 'platform') {
        const idx = route.platformAbbrs.indexOf((seg as Platform).stationAbbr);
        if (idx >= 0) lastPlatformIndex = idx;
      }

      // Determine initial direction based on route
      let direction: 'west' | 'east';
      const nextIdx = (lastPlatformIndex + 1) % route.platformAbbrs.length;
      const nextAbbr = route.platformAbbrs[nextIdx];
      const targetId = this.graph.findPlatformInGroup(nextAbbr, route.trackGroupName);
      
      if (targetId) {
        // Simple reachability check to see which way to go
        const tg = this.graph.trackGroups.find(t => t.name === route.trackGroupName);
        const segmentIds = trackDirection === 'west' ? tg!.westSegments : tg!.eastSegments;
        const currentIdx = segmentIds.indexOf(segmentId);
        
        // If target is on the same track, head toward it.
        // If not, head toward the switch that leads to the other track.
        // For now, simpler: if currentIdx is low, go east; if high, go west.
        direction = (currentIdx < segmentIds.length / 2) ? 'east' : 'west';
      } else {
        direction = (trackDirection === 'west') ? 'west' : 'east';
      }

      this.trains.push({
        id,
        segmentId,
        position: 0.5,
        direction,
        state: 'running',
        dwellRemaining: 0,
        color: route.color,
        trackGroupName: route.trackGroupName,
        trackDirection,
        routeId: route.name,
        lastPlatformIndex,
      });
    }
  }

  private idCounter = 1001;
  private generateId(): string {
    return String(this.idCounter++);
  }

  private findFirstPlatform(segmentIds: string[]): string | undefined {
    return segmentIds.find(id => this.graph.segments.get(id)?.type === 'platform');
  }

  private findLastPlatform(segmentIds: string[]): string | undefined {
    for (let i = segmentIds.length - 1; i >= 0; i--) {
      if (this.graph.segments.get(segmentIds[i])?.type === 'platform') {
        return segmentIds[i];
      }
    }
    return undefined;
  }

  start(onTick: () => void, intervalMs: number = 60): void {
    this.onTick = onTick;
    this.tickInterval = setInterval(() => this.tick(intervalMs / 1000), intervalMs);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private tick(dtBase: number): void {
    const dt = dtBase * this.speed;

    for (const train of this.trains) {
      this.autoRouteTrain(train);
      this.updateTrain(train, dt);
    }

    this.updateSignals();

    if (this.onTick) {
      this.onTick();
    }
  }

  private updateTrain(train: Train, dt: number): void {
    if (train.state === 'dwelling') {
      train.dwellRemaining -= dt;
      if (train.dwellRemaining <= 0) {
        train.dwellRemaining = 0;
        train.state = 'running';
      }
      return;
    }

    if (train.state === 'stopped') {
      if (this.canProceed(train)) {
        train.state = 'running';
      } else {
        return;
      }
    }

    // Move the train
    const speed = dt / BASE_SEGMENT_TIME;
    const prevPosition = train.position;
    if (train.direction === 'east') {
      train.position += speed;
    } else {
      train.position -= speed;
    }

    if (this.checkMidpointDwell(train, prevPosition)) {
      return;
    }

    // Handle midpoint transition for diverging switches
    const seg = this.graph.segments.get(train.segmentId)!;
    if (seg.type === 'switch' && (seg as Switch).state === 'diverging') {
      const sw = seg as Switch;
      if (train.direction === 'east' && prevPosition < 0.5 && train.position >= 0.5) {
        if (sw.divergingNext) {
          this.enterSegment(train, sw.divergingNext, 0.5);
          return;
        }
      } else if (train.direction === 'west' && prevPosition > 0.5 && train.position <= 0.5) {
        if (sw.divergingPrev) {
          this.enterSegment(train, sw.divergingPrev, 0.5);
          return;
        }
      }
    }

    if (train.position >= 1.0) {
      this.transitionForward(train);
    } else if (train.position <= 0.0) {
      this.transitionBackward(train);
    }
  }

  private autoRouteTrain(train: Train): void {
    const seg = this.graph.segments.get(train.segmentId)!;
    const nextId = train.direction === 'east' ? seg.next : seg.prev;

    if (!nextId) return;
    const nextSeg = this.graph.segments.get(nextId)!;
    if (nextSeg.type !== 'switch') return;

    const sw = nextSeg as Switch;
    
    // 1. Try to get the lock on our own side first.
    if (sw.lockedBy && sw.lockedBy !== train.id) return;

    const shouldDiverge = this.shouldTrainDiverge(train, sw);
    const linkedId = train.direction === 'east' ? sw.divergingNext : sw.divergingPrev;
    const linked = linkedId ? (this.graph.segments.get(linkedId) as Switch) : null;

    if (shouldDiverge && linked) {
      // 2. To diverge, we MUST also get the lock on the linked switch.
      if (linked.lockedBy && linked.lockedBy !== train.id) {
        // Cannot diverge yet. We must stay Red (so we don't set sw.lockedBy yet).
        return;
      }
      
      // Success! Lock both and set diverging.
      sw.lockedBy = train.id;
      linked.lockedBy = train.id;
      sw.state = 'diverging';
      linked.state = 'diverging';
    } else {
      // 3. To go straight, we only need the lock on our own side.
      sw.lockedBy = train.id;
      sw.state = 'straight';
      // Note: we don't force 'linked' to straight here, allowing parallel straight moves.
    }
  }

  private shouldTrainDiverge(train: Train, sw: Switch): boolean {
    if (!train.routeId) return false;
    const route = this.graph.routes.find(r => r.name === train.routeId);
    if (!route) return false;

    // Find next platform in route
    const currentPlatIdx = train.lastPlatformIndex ?? 0;
    const nextPlatAbbr = route.platformAbbrs[(currentPlatIdx + 1) % route.platformAbbrs.length];
    
    // Search both tracks of the track group to find the destination platform
    const targetId = this.graph.findPlatformInGroup(nextPlatAbbr, route.trackGroupName);
    if (!targetId) return false;

    // A train should diverge if the target platform is NOT reachable on the current (straight) path,
    // BUT it IS reachable by taking the diverging path.
    const straightReachable = this.isSegmentReachable(sw.next, targetId, train.direction) ||
                               this.isSegmentReachable(sw.prev, targetId, train.direction);
    const divergingReachable = this.isSegmentReachable(sw.divergingNext, targetId, train.direction) ||
                                 this.isSegmentReachable(sw.divergingPrev, targetId, train.direction);

    if (straightReachable) return false;
    if (divergingReachable) return true;

    return false;
  }

  private isSegmentReachable(startId: string | null, targetId: string, direction: 'west' | 'east'): boolean {
    let curr = startId;
    const visited = new Set<string>();
    while (curr && !visited.has(curr)) {
      if (curr === targetId) return true;
      visited.add(curr);
      const seg = this.graph.segments.get(curr);
      if (!seg) break;
      curr = direction === 'east' ? seg.next : seg.prev;
    }
    return false;
  }

  private transitionForward(train: Train): void {
    const seg = this.graph.segments.get(train.segmentId)!;
    if (train.direction !== 'east') return;

    // Divergence is handled at 0.5, so at 1.0 we always follow the straight path out
    const targetId = seg.next;

    if (targetId && this.canEnterSegment(targetId, train)) {
      const overflow = train.position - 1.0;
      this.enterSegment(train, targetId, overflow);
    } else if (targetId) {
      train.position = 0.99;
      train.state = 'stopped';
    } else {
      // End of track - reverse
      train.position = 0.5;
      train.direction = 'west';
    }
  }

  private transitionBackward(train: Train): void {
    const seg = this.graph.segments.get(train.segmentId)!;
    if (train.direction !== 'west') return;

    // Divergence is handled at 0.5, so at 0.0 we always follow the straight path out
    const targetId = seg.prev;

    if (targetId && this.canEnterSegment(targetId, train)) {
      const overflow = -train.position;
      this.enterSegment(train, targetId, 1.0 - overflow);
    } else if (targetId) {
      train.position = 0.01;
      train.state = 'stopped';
    } else {
      // End of track - reverse
      train.position = 0.5;
      train.direction = 'east';
    }
  }

  private enterSegment(train: Train, segmentId: string, position: number): void {
    const prevSeg = this.graph.segments.get(train.segmentId);
    const nextSeg = this.graph.segments.get(segmentId);

    // If we're leaving a switch unit and entering something else, release locks.
    if (prevSeg?.type === 'switch' && nextSeg?.type !== 'switch') {
      const sw = prevSeg as Switch;
      sw.lockedBy = null;
      
      // Clear linked switches in both directions to be safe.
      if (sw.divergingNext) {
        const linked = this.graph.segments.get(sw.divergingNext) as Switch;
        if (linked) linked.lockedBy = null;
      }
      if (sw.divergingPrev) {
        const linked = this.graph.segments.get(sw.divergingPrev) as Switch;
        if (linked) linked.lockedBy = null;
      }
    }

    train.segmentId = segmentId;
    train.position = Math.max(0.01, Math.min(0.99, position));
    
    if (nextSeg) {
      train.trackGroupName = nextSeg.trackGroupName;
      train.trackDirection = nextSeg.trackDirection;
      
      if (nextSeg.type === 'switch') {
        const sw = nextSeg as Switch;
        sw.lockedBy = train.id;
        
        // Also ensure linked switch is locked throughout.
        const linkedId = train.direction === 'east' ? sw.divergingNext : sw.divergingPrev;
        if (linkedId) {
          const linked = this.graph.segments.get(linkedId) as Switch;
          if (linked) linked.lockedBy = train.id;
        }
      }
    }
  }

  private canEnterSegment(segmentId: string, requestingTrain: Train): boolean {
    for (const train of this.trains) {
      if (train !== requestingTrain && train.segmentId === segmentId) {
        return false;
      }
    }

    const targetSeg = this.graph.segments.get(segmentId);
    if (targetSeg?.type === 'switch') {
      const sw = targetSeg as Switch;
      if (sw.lockedBy && sw.lockedBy !== requestingTrain.id) return false;
    }

    return this.isSignalGreen(requestingTrain, segmentId);
  }

  private canProceed(train: Train): boolean {
    const seg = this.graph.segments.get(train.segmentId)!;
    const targetId = (train.direction === 'east')
      ? ((seg.type === 'switch' && (seg as Switch).state === 'diverging') ? (seg as Switch).divergingNext : seg.next)
      : ((seg.type === 'switch' && (seg as Switch).state === 'diverging') ? (seg as Switch).divergingPrev : seg.prev);

    if (!targetId) return true;
    return this.canEnterSegment(targetId, train);
  }

  private updateSignals(): void {
    const occupiedSegments = new Set(this.trains.map(t => t.segmentId));

    for (const signal of this.graph.signals) {
      const guardedId = signal.segmentAfter;
      const guardedSeg = this.graph.segments.get(guardedId);

      // 1. Basic occupancy check for the guarded segment itself
      if (occupiedSegments.has(guardedId)) {
        signal.state = 'red';
        continue;
      }

      // 2. Crossover Interlocking: if it's a switch, check its linked pair
      if (guardedSeg?.type === 'switch') {
        const sw = guardedSeg as Switch;

        // 2a. Check linked switch occupancy (for crossovers)
        const linkedId = signal.facingDirection === 'east' ? sw.divergingNext : sw.divergingPrev;
        if (linkedId && occupiedSegments.has(linkedId)) {
          signal.state = 'red';
          continue;
        }

        // 2b. Lock Check: ifreserved by someone else, it's Red.
        if (sw.lockedBy) {
          // A signal is friendly to the lock only if the locking train is at the approach segment.
          const lockingTrain = this.trains.find(t => t.id === sw.lockedBy);
          if (lockingTrain && lockingTrain.segmentId !== signal.segmentBefore) {
            signal.state = 'red';
            continue;
          }
        }

        const isEast = signal.facingDirection === 'east';
        const canGoStraight = isEast ? sw.next !== null : sw.prev !== null;
        const canDiverge = isEast ? sw.divergingNext !== null : sw.divergingPrev !== null;

        if (canGoStraight && canDiverge) {
          // Point approach (choice)
          if (sw.state === 'straight') {
            signal.state = 'straight';
          } else {
            const targetId = isEast ? sw.divergingNext : sw.divergingPrev;
            const targetSeg = targetId ? this.graph.segments.get(targetId) : null;
            if (sw.trackDirection === 'west' && targetSeg?.trackDirection === 'east') {
              signal.state = 'diverge_down';
            } else if (sw.trackDirection === 'east' && targetSeg?.trackDirection === 'west') {
              signal.state = 'diverge_up';
            } else {
              signal.state = 'diverge_up';
            }
          }
        } else {
          // Trailing approach (no choice)
          const isCorrect = sw.state === 'straight' ? canGoStraight : canDiverge;
          signal.state = isCorrect ? 'green' : 'red';
        }
      } else {
        signal.state = 'green';
      }
    }
  }

  private isSignalGreen(train: Train, targetSegmentId: string): boolean {
    for (const signal of this.graph.signals) {
      if (signal.segmentAfter === targetSegmentId &&
          signal.segmentBefore === train.segmentId &&
          signal.facingDirection === train.direction) {
        return signal.state !== 'red'; // Any non-red is proceed
      }
    }
    return true;
  }

  private checkMidpointDwell(train: Train, prevPosition: number): boolean {
    const seg = this.graph.segments.get(train.segmentId);
    if (seg?.type !== 'platform') return false;

    const crossedEast = train.direction === 'east' && prevPosition < 0.5 && train.position >= 0.5;
    const crossedWest = train.direction === 'west' && prevPosition > 0.5 && train.position <= 0.5;

    if (crossedEast || crossedWest) {
      const plat = seg as Platform;
      train.position = 0.5;

      if (train.routeId) {
        const route = this.graph.routes.find(r => r.name === train.routeId);
        if (route) {
          const idx = route.platformAbbrs.indexOf(plat.stationAbbr);
          if (idx >= 0) train.lastPlatformIndex = idx;
        }
      }

      this.checkTerminusReversal(train);
      train.state = 'dwelling';
      train.dwellRemaining = plat.dwellTime;
      return true;
    }

    return false;
  }

  private checkTerminusReversal(train: Train): void {
    if (train.routeId) {
      this.checkRouteTerminusReversal(train);
      return;
    }

    const tg = this.graph.trackGroups.find(t => t.name === train.trackGroupName);
    if (!tg) return;

    const segments = train.trackDirection === 'west' ? tg.westSegments : tg.eastSegments;
    const firstPlat = this.findFirstPlatform(segments);
    const lastPlat = this.findLastPlatform(segments);

    if (train.direction === 'east' && train.segmentId === lastPlat) {
      train.direction = 'west';
    } else if (train.direction === 'west' && train.segmentId === firstPlat) {
      train.direction = 'east';
    }
  }

  private checkRouteTerminusReversal(train: Train): void {
    const route = this.graph.routes.find(r => r.name === train.routeId);
    if (!route) return;

    const firstAbbr = route.platformAbbrs[0];
    const lastAbbr = route.platformAbbrs[route.platformAbbrs.length - 1];
    
    const seg = this.graph.segments.get(train.segmentId);
    if (seg?.type !== 'platform') return;
    const plat = seg as Platform;
    const abbr = plat.stationAbbr;

    // Route-based reversal
    if (train.direction === 'east' && abbr === lastAbbr) {
      train.direction = 'west';
      return;
    } 
    if (train.direction === 'west' && abbr === firstAbbr) {
      train.direction = 'east';
      return;
    }

    // Physical terminus-based reversal (requested by user)
    const tg = this.graph.trackGroups.find(t => t.name === train.trackGroupName);
    if (tg) {
      const segments = train.trackDirection === 'west' ? tg.westSegments : tg.eastSegments;
      if (train.direction === 'east' && train.segmentId === segments[segments.length - 1]) {
        train.direction = 'west';
      } else if (train.direction === 'west' && train.segmentId === segments[0]) {
        train.direction = 'east';
      }
    }
  }
}
