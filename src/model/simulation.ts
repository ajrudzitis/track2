/**
 * Simulation engine: game loop, train movement, signal interlocking, platform dwell.
 */

import type { Train, Segment, Platform, Route } from './types.js';
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

      // Alternate initial direction for natural spacing
      const direction = (i % 2 === 0)
        ? (trackDirection === 'west' ? 'west' : 'east')
        : (trackDirection === 'west' ? 'east' : 'west');

      const id = (idOffset + i < route.trainIds.length)
        ? route.trainIds[idOffset + i]
        : this.generateId();

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
      // Check if the signal ahead has turned green
      if (this.canProceed(train)) {
        train.state = 'running';
      } else {
        return;
      }
    }

    // Move the train
    const speed = dt / BASE_SEGMENT_TIME; // fraction of segment per tick
    const prevPosition = train.position;
    if (train.direction === 'east') {
      train.position += speed;
    } else {
      train.position -= speed;
    }

    // Check if train crossed the midpoint of a platform (dwell point)
    if (this.checkMidpointDwell(train, prevPosition)) {
      return;
    }

    // Check segment transition
    if (train.position >= 1.0) {
      this.transitionForward(train);
    } else if (train.position <= 0.0) {
      this.transitionBackward(train);
    }
  }

  /**
   * Train reached the right end of its segment (position >= 1.0).
   * For eastbound: advance to next segment.
   */
  private transitionForward(train: Train): void {
    const seg = this.graph.segments.get(train.segmentId)!;

    if (train.direction === 'east') {
      if (seg.next && this.canEnterSegment(seg.next, train)) {
        const overflow = train.position - 1.0;
        this.enterSegment(train, seg.next, overflow);
      } else if (seg.next) {
        // Blocked by signal — stop at boundary
        train.position = 0.99;
        train.state = 'stopped';
      } else {
        // End of track — reverse direction
        train.position = 0.5;
        train.direction = 'west';
      }
    }
  }

  /**
   * Train reached the left end of its segment (position <= 0.0).
   * For westbound: advance to prev segment.
   */
  private transitionBackward(train: Train): void {
    const seg = this.graph.segments.get(train.segmentId)!;

    if (train.direction === 'west') {
      if (seg.prev && this.canEnterSegment(seg.prev, train)) {
        const overflow = -train.position;
        this.enterSegment(train, seg.prev, 1.0 - overflow);
      } else if (seg.prev) {
        // Blocked by signal
        train.position = 0.01;
        train.state = 'stopped';
      } else {
        // End of track — reverse direction
        train.position = 0.5;
        train.direction = 'east';
      }
    }
  }

  private enterSegment(train: Train, segmentId: string, position: number): void {
    train.segmentId = segmentId;
    train.position = Math.max(0.01, Math.min(0.99, position));
  }

  /**
   * Check if the train just crossed the midpoint (0.5) of a platform segment.
   * If so, snap to 0.5, dwell, and possibly reverse at terminus.
   * Returns true if the train began dwelling.
   */
  private checkMidpointDwell(train: Train, prevPosition: number): boolean {
    const seg = this.graph.segments.get(train.segmentId);
    if (seg?.type !== 'platform') return false;

    const crossedEast = train.direction === 'east' && prevPosition < 0.5 && train.position >= 0.5;
    const crossedWest = train.direction === 'west' && prevPosition > 0.5 && train.position <= 0.5;

    if (crossedEast || crossedWest) {
      const plat = seg as Platform;
      train.position = 0.5;
      this.checkTerminusReversal(train);
      train.state = 'dwelling';
      train.dwellRemaining = plat.dwellTime;
      return true;
    }

    return false;
  }

  /**
   * Check if this platform is a terminus (first or last platform on the track/route).
   * If so, reverse the train's direction.
   */
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
    const firstPlatId = this.graph.findPlatformOnTrack(firstAbbr, route.trackGroupName, train.trackDirection);
    const lastPlatId = this.graph.findPlatformOnTrack(lastAbbr, route.trackGroupName, train.trackDirection);

    if (train.direction === 'east' && train.segmentId === lastPlatId) {
      train.direction = 'west';
    } else if (train.direction === 'west' && train.segmentId === firstPlatId) {
      train.direction = 'east';
    }
  }

  /**
   * Check if a train can enter a segment: no other train occupies it.
   */
  private canEnterSegment(segmentId: string, requestingTrain: Train): boolean {
    for (const train of this.trains) {
      if (train !== requestingTrain && train.segmentId === segmentId) {
        return false;
      }
    }
    // Also check the guarding signal
    return this.isSignalGreen(requestingTrain, segmentId);
  }

  /**
   * Check if the signal guarding entry from the train's current segment
   * into the target segment is green.
   */
  private isSignalGreen(train: Train, targetSegmentId: string): boolean {
    for (const signal of this.graph.signals) {
      if (signal.segmentAfter === targetSegmentId &&
          signal.segmentBefore === train.segmentId &&
          signal.facingDirection === train.direction) {
        return signal.state === 'green';
      }
    }
    // No signal guarding this boundary — allow passage
    return true;
  }

  /**
   * Check if the signal directly ahead of the train is green (for resuming from stopped).
   */
  private canProceed(train: Train): boolean {
    const seg = this.graph.segments.get(train.segmentId)!;
    const nextSegId = train.direction === 'east' ? seg.next : seg.prev;
    if (!nextSegId) return true;
    return this.canEnterSegment(nextSegId, train);
  }

  /**
   * Update all signals based on segment occupancy.
   * A signal turns red if its guarded segment is occupied.
   */
  private updateSignals(): void {
    const occupiedSegments = new Set(this.trains.map(t => t.segmentId));

    for (const signal of this.graph.signals) {
      signal.state = occupiedSegments.has(signal.segmentAfter) ? 'red' : 'green';
    }
  }
}
