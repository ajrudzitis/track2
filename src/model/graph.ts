/**
 * Track topology graph built from parsed map data.
 */

import type { MapFile, SwitchDef } from '../parser/types.js';
import type { Segment, Platform, Switch, TrackGroup, Route } from './types.js';
import { ANSI_COLORS } from './types.js';
import { type Signal, generateSignals } from './signal.js';

const DEFAULT_SEGMENT_WIDTH = 16;

export class TrackGraph {
  segments: Map<string, Segment> = new Map();
  signals: Signal[] = [];
  trackGroups: TrackGroup[] = [];
  routes: Route[] = [];

  static fromMapFile(mapFile: MapFile): TrackGraph {
    const graph = new TrackGraph();

    for (const groupDef of mapFile.trackGroups) {
      const tg: TrackGroup = {
        name: groupDef.name,
        westSegments: [],
        eastSegments: [],
      };

      // Build west track segments
      for (const elem of groupDef.westTrack) {
        let seg: Segment;
        if (elem.type === 'platform') {
          seg = graph.createPlatform(elem.id, groupDef.name, 'west', mapFile.config.dwell);
        } else if (elem.type === 'switch') {
          seg = graph.createSwitch(elem.id, groupDef.name, 'west');
        } else {
          seg = graph.createSegment(elem.id, 'plain', groupDef.name, 'west');
        }
        tg.westSegments.push(seg.id);
      }

      // Build east track segments
      for (const elem of groupDef.eastTrack) {
        let seg: Segment;
        if (elem.type === 'platform') {
          seg = graph.createPlatform(elem.id, groupDef.name, 'east', mapFile.config.dwell);
        } else if (elem.type === 'switch') {
          seg = graph.createSwitch(elem.id, groupDef.name, 'east');
        } else {
          seg = graph.createSegment(elem.id, 'plain', groupDef.name, 'east');
        }
        tg.eastSegments.push(seg.id);
      }

      // Link segments in sequence
      graph.linkSequence(tg.westSegments);
      graph.linkSequence(tg.eastSegments);

      // Auto-generate signals at segment boundaries
      graph.signals.push(...generateSignals(tg.westSegments, groupDef.name, 'west'));
      graph.signals.push(...generateSignals(tg.eastSegments, groupDef.name, 'east'));

      graph.trackGroups.push(tg);
    }

    graph.linkSwitches(mapFile.switches);
    graph.resolveRoutes(mapFile);

    return graph;
  }

  private linkSwitches(switchDefs: SwitchDef[]): void {
    for (const def of switchDefs) {
      const from = this.segments.get(def.from) as Switch;
      const to = this.segments.get(def.to) as Switch;
      if (!from || !to) continue;

      // Link them as a single diagonal connection.
      // from -> to represents an Eastbound crossover path.
      from.divergingNext = to.id;
      to.divergingPrev = from.id;
    }
  }

  private resolveRoutes(mapFile: MapFile): void {
    for (const routeDef of mapFile.routes) {
      const trackGroupName = routeDef.trackGroupName ?? this.inferTrackGroup(routeDef.platforms[0]);
      if (!trackGroupName) continue;

      const route: Route = {
        name: routeDef.name,
        color: ANSI_COLORS[routeDef.color] ?? 46,
        platformAbbrs: routeDef.platforms,
        trackGroupName,
        trainIds: routeDef.trainIds,
        trainCount: routeDef.trainCount,
      };
      this.routes.push(route);
    }
  }

  private inferTrackGroup(platformAbbr: string): string | undefined {
    for (const seg of this.segments.values()) {
      if (seg.type === 'platform' && (seg as Platform).stationAbbr === platformAbbr) {
        return seg.trackGroupName;
      }
    }
    return undefined;
  }

  /**
   * Find the segment ID for a platform with the given abbreviation on a specific track.
   */
  findPlatformOnTrack(abbr: string, trackGroupName: string, trackDirection: 'west' | 'east'): string | undefined {
    const tg = this.trackGroups.find(t => t.name === trackGroupName);
    if (!tg) return undefined;
    const segmentIds = trackDirection === 'west' ? tg.westSegments : tg.eastSegments;
    for (const id of segmentIds) {
      const seg = this.segments.get(id);
      if (seg?.type === 'platform' && (seg as Platform).stationAbbr === abbr) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Find the segment ID for a platform with the given abbreviation on ANY track within a track group.
   */
  findPlatformInGroup(abbr: string, trackGroupName: string): string | undefined {
    return this.findPlatformOnTrack(abbr, trackGroupName, 'west') ||
           this.findPlatformOnTrack(abbr, trackGroupName, 'east');
  }

  /**
   * Get the segment IDs within a route's extent on a given track
   * (from first route platform to last route platform, inclusive of all segments between).
   */
  getRouteExtent(route: Route, trackDirection: 'west' | 'east'): string[] {
    const tg = this.trackGroups.find(t => t.name === route.trackGroupName);
    if (!tg) return [];
    const segmentIds = trackDirection === 'west' ? tg.westSegments : tg.eastSegments;

    const platIds = route.platformAbbrs
      .map(abbr => this.findPlatformOnTrack(abbr, route.trackGroupName, trackDirection))
      .filter((id): id is string => id !== undefined);

    if (platIds.length === 0) return [];

    const indices = platIds.map(id => segmentIds.indexOf(id));
    const startIdx = Math.min(...indices);
    const endIdx = Math.max(...indices);
    return segmentIds.slice(startIdx, endIdx + 1);
  }

  private createSegment(id: string, type: 'plain' | 'platform' | 'switch', trackGroupName: string, direction: 'west' | 'east'): Segment {
    const seg: Segment = {
      id,
      type,
      displayWidth: DEFAULT_SEGMENT_WIDTH,
      trackGroupName,
      trackDirection: direction,
      next: null,
      prev: null,
    };
    this.segments.set(id, seg);
    return seg;
  }

  private createPlatform(id: string, trackGroupName: string, direction: 'west' | 'east', dwellTime: number): Platform {
    const plat: Platform = {
      id,
      type: 'platform',
      displayWidth: DEFAULT_SEGMENT_WIDTH,
      trackGroupName,
      trackDirection: direction,
      next: null,
      prev: null,
      stationAbbr: id.slice(0, 3).toUpperCase(),
      stationName: id,
      dwellTime,
    };
    this.segments.set(id, plat);
    return plat;
  }

  private linkSequence(segmentIds: string[]): void {
    for (let i = 0; i < segmentIds.length - 1; i++) {
      const curr = this.segments.get(segmentIds[i])!;
      const next = this.segments.get(segmentIds[i + 1])!;
      curr.next = next.id;
      next.prev = curr.id;
    }
  }

  private createSwitch(id: string, trackGroupName: string, direction: 'west' | 'east'): Switch {
    let sw = this.segments.get(id) as Switch;
    if (sw && sw.type === 'switch') return sw;

    sw = {
      id,
      type: 'switch',
      displayWidth: 20, // Enough for a clean diagonal without excessive space
      trackGroupName,
      trackDirection: direction,
      next: null,
      prev: null,
      divergingNext: null,
      divergingPrev: null,
      state: 'straight',
      lockedBy: null,
    };
    this.segments.set(id, sw);
    return sw;
  }
}
