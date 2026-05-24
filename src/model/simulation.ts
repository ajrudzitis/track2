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

    // Spawn at route platforms only — trains start the cycle at a station, not mid-segment.
    // West-track trains run westward (right-to-left), so we reverse the platform order so
    // they spawn from the east end and have the full line to travel before the terminus.
    const platformIds = route.platformAbbrs
      .map(abbr => this.graph.findPlatformOnTrack(abbr, route.trackGroupName, trackDirection))
      .filter((id): id is string => id !== undefined);
    if (platformIds.length === 0) return;

    const orderedPlatforms = trackDirection === 'east' ? platformIds : [...platformIds].reverse();
    const occupiedSegments = new Set(this.trains.map(t => t.segmentId));

    for (let i = 0; i < count; i++) {
      let platIdx = Math.floor(i * orderedPlatforms.length / count);
      let segmentId = orderedPlatforms[platIdx];

      if (occupiedSegments.has(segmentId)) {
        for (let offset = 1; offset < orderedPlatforms.length; offset++) {
          const fwd = platIdx + offset;
          const bwd = platIdx - offset;
          if (fwd < orderedPlatforms.length && !occupiedSegments.has(orderedPlatforms[fwd])) { segmentId = orderedPlatforms[fwd]; break; }
          if (bwd >= 0 && !occupiedSegments.has(orderedPlatforms[bwd])) { segmentId = orderedPlatforms[bwd]; break; }
        }
      }
      occupiedSegments.add(segmentId);

      const id = (idOffset + i < route.trainIds.length)
        ? route.trainIds[idOffset + i]
        : this.generateId();

      const seg = this.graph.segments.get(segmentId) as Platform;
      const lastPlatformIndex = route.platformAbbrs.indexOf(seg.stationAbbr);

      this.trains.push({
        id,
        segmentId,
        position: 0.5,
        direction: trackDirection,
        state: 'running',
        dwellRemaining: 0,
        color: route.color,
        trackGroupName: seg.trackGroupName,
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
    // A dwelling train is parked — it shouldn't pre-reserve switches for its
    // outbound run, because that blocks inbound traffic from crossing over to
    // the platform it's about to vacate.
    if (train.state === 'dwelling') return;

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
      // Diverging needs the linked partner's lock too — we'll physically
      // traverse it. If it's reserved by someone else we have to wait.
      if (linked.lockedBy && linked.lockedBy !== train.id) return;
      // The diverging diagonal may geometrically cross other segments
      // (e.g. a cross-group branch passing through a parallel switch's
      // track row). Those segments must be clear before we commit, and
      // we must not be standing inside another active diagonal's path.
      if (!this.areConflictsClear(sw, train.id)) return;
      if (!this.areConflictsClear(linked, train.id)) return;
      if (this.isConflictLocked(sw.id, train.id)) return;
      if (this.isConflictLocked(linked.id, train.id)) return;
      sw.lockedBy = train.id;
      linked.lockedBy = train.id;
      sw.state = 'diverging';
      linked.state = 'diverging';
    } else {
      // Straight-through only locks our own switch. The linked partner is on
      // the other track and may be used independently by a parallel train.
      if (this.isConflictLocked(sw.id, train.id)) return;
      sw.lockedBy = train.id;
      sw.state = 'straight';
    }
  }

  private shouldTrainDiverge(train: Train, sw: Switch): boolean {
    if (!train.routeId) return false;
    const route = this.graph.routes.find(r => r.name === train.routeId);
    if (!route) return false;

    const targetId = this.findRouteTargetPlatform(train, route);
    if (!targetId) return false;

    // A train should diverge if the target platform is NOT reachable on the current (straight) path,
    // BUT it IS reachable by taking the diverging path. Only look ahead in the train's direction
    // of travel — looking "backward" produces false positives on tight loops.
    const straightAhead = train.direction === 'east' ? sw.next : sw.prev;
    const divergingAhead = train.direction === 'east' ? sw.divergingNext : sw.divergingPrev;
    const straightReachable = this.isSegmentReachable(straightAhead, targetId, train.direction);
    const divergingReachable = this.isSegmentReachable(divergingAhead, targetId, train.direction);

    if (straightReachable) return false;
    if (divergingReachable) return true;

    return false;
  }

  /**
   * The platform segment a route-bound train is currently aiming for. The route platform
   * list is bidirectional: an east-bound train walks idx+1; a west-bound train walks idx-1.
   * Cyclic next would tell a west-bound train at GRN to target MID (east of it), which
   * misleads switch interlocking — by the time the train passes NW1 the crossover logic
   * needs to know the real next stop is NTH so it can divert to the east-track platform.
   */
  private findRouteTargetPlatform(train: Train, route: Route): string | undefined {
    const idx = train.lastPlatformIndex ?? 0;
    const N = route.platformAbbrs.length;
    if (N <= 1) return undefined;

    let nextIdx: number;
    if (train.direction === 'east') {
      nextIdx = idx >= N - 1 ? N - 2 : idx + 1;
    } else {
      nextIdx = idx <= 0 ? 1 : idx - 1;
    }

    const nextAbbr = route.platformAbbrs[nextIdx];
    const isTerminus = nextIdx === 0 || nextIdx === N - 1;

    const occupied = new Set<string>();
    for (const t of this.trains) {
      if (t !== train) occupied.add(t.segmentId);
    }

    return this.graph.pickTargetPlatform(
      nextAbbr,
      route.trackGroupName,
      train.direction,
      train.trackDirection,
      isTerminus,
      occupied,
    );
  }

  private isSegmentReachable(startId: string | null, targetId: string, direction: 'west' | 'east'): boolean {
    if (!startId) return false;
    const queue: string[] = [startId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      if (curr === targetId) return true;
      visited.add(curr);

      const seg = this.graph.segments.get(curr);
      if (!seg) continue;

      const straight = direction === 'east' ? seg.next : seg.prev;
      if (straight && !visited.has(straight)) queue.push(straight);

      if (seg.type === 'switch') {
        const sw = seg as Switch;
        const diverging = direction === 'east' ? sw.divergingNext : sw.divergingPrev;
        if (diverging && !visited.has(diverging)) queue.push(diverging);
      }
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

    // If we're leaving a switch unit and entering something else, release our locks.
    // Only clear locks this train actually owns — never stomp another train's lock.
    // Reset state alongside the lock so debug snapshots (and any consumer that
    // reads sw.state without checking lockedBy) don't see a phantom diverging.
    if (prevSeg?.type === 'switch' && nextSeg?.type !== 'switch') {
      const sw = prevSeg as Switch;
      if (sw.lockedBy === train.id) {
        sw.lockedBy = null;
        sw.state = 'straight';
      }

      for (const linkedId of [sw.divergingNext, sw.divergingPrev]) {
        if (!linkedId) continue;
        const linked = this.graph.segments.get(linkedId) as Switch | undefined;
        if (linked && linked.lockedBy === train.id) {
          linked.lockedBy = null;
          linked.state = 'straight';
        }
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

        // Only lock the linked switch when we are actually diverging — a
        // straight-through must not block parallel traffic on the other track.
        if (sw.state === 'diverging') {
          const linkedId = train.direction === 'east' ? sw.divergingNext : sw.divergingPrev;
          if (linkedId) {
            const linked = this.graph.segments.get(linkedId) as Switch;
            if (linked) linked.lockedBy = train.id;
          }
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

    if (this.isConflictLocked(segmentId, requestingTrain.id)) return false;

    return this.isSignalGreen(requestingTrain, segmentId);
  }

  private areConflictsClear(sw: Switch, trainId: string): boolean {
    for (const conflictId of sw.conflicts) {
      for (const t of this.trains) {
        if (t.id !== trainId && t.segmentId === conflictId) return false;
      }
      const seg = this.graph.segments.get(conflictId);
      if (seg?.type === 'switch') {
        const s = seg as Switch;
        if (s.lockedBy && s.lockedBy !== trainId) return false;
      }
    }
    return true;
  }

  private isConflictLocked(segmentId: string, exceptTrainId: string): boolean {
    for (const seg of this.graph.segments.values()) {
      if (seg.type !== 'switch') continue;
      const sw = seg as Switch;
      if (sw.state !== 'diverging' || sw.lockedBy === null) continue;
      if (sw.lockedBy === exceptTrainId) continue;
      if (sw.conflicts.includes(segmentId)) return true;
    }
    return false;
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

      // 1b. A diverging diagonal elsewhere may cross through this segment's
      // physical footprint; treat that as an occupancy conflict.
      if (this.isConflictLocked(guardedId, '')) {
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

        // 2b. Lock Check: if reserved by someone else, it's Red.
        if (sw.lockedBy) {
          // A signal is friendly to the lock only if the locking train is at the approach segment.
          const lockingTrain = this.trains.find(t => t.id === sw.lockedBy);
          if (lockingTrain && lockingTrain.segmentId !== signal.segmentBefore) {
            // This is locked by a train not at the approach. Normally this is red.
            // EXCEPTION: A straight-through setting allows parallel moves.
            if (sw.state !== 'straight') {
              signal.state = 'red';
              continue;
            }
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
            // Arrow direction (up/down) is chosen in the renderer using
            // physical layout y-coords, since trackDirection alone can't
            // distinguish branch links where both ends share a direction.
            signal.state = 'diverge';
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

      let isRouteTerminus = false;
      if (train.routeId) {
        const route = this.graph.routes.find(r => r.name === train.routeId);
        if (route) {
          const idx = route.platformAbbrs.indexOf(plat.stationAbbr);
          if (idx >= 0) {
            train.lastPlatformIndex = idx;
            isRouteTerminus = idx === 0 || idx === route.platformAbbrs.length - 1;
          }
        }
      }

      this.checkTerminusReversal(train);
      train.state = 'dwelling';
      train.dwellRemaining = isRouteTerminus
        ? this.terminusLayoverFor(train) ?? plat.dwellTime
        : plat.dwellTime;
      return true;
    }

    return false;
  }

  private terminusLayoverFor(train: Train): number | null {
    if (!train.routeId) return null;
    const route = this.graph.routes.find(r => r.name === train.routeId);
    return route?.layover ?? null;
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
