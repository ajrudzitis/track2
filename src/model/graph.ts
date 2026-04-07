/**
 * Track topology graph built from parsed map data.
 */

import type { MapFile } from '../parser/types.js';
import type { Segment, Platform, TrackGroup, Route } from './types.js';
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
        const seg = elem.type === 'platform'
          ? graph.createPlatform(elem.id, groupDef.name, 'west', mapFile.config.dwell)
          : graph.createSegment(elem.id, 'plain', groupDef.name, 'west');
        tg.westSegments.push(seg.id);
      }

      // Build east track segments
      for (const elem of groupDef.eastTrack) {
        const seg = elem.type === 'platform'
          ? graph.createPlatform(elem.id, groupDef.name, 'east', mapFile.config.dwell)
          : graph.createSegment(elem.id, 'plain', groupDef.name, 'east');
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

    graph.resolveRoutes(mapFile);

    return graph;
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
   * Get the segment IDs within a route's extent on a given track
   * (from first route platform to last route platform, inclusive of all segments between).
   */
  getRouteExtent(route: Route, trackDirection: 'west' | 'east'): string[] {
    const tg = this.trackGroups.find(t => t.name === route.trackGroupName);
    if (!tg) return [];
    const segmentIds = trackDirection === 'west' ? tg.westSegments : tg.eastSegments;

    const firstPlatId = this.findPlatformOnTrack(route.platformAbbrs[0], route.trackGroupName, trackDirection);
    const lastPlatId = this.findPlatformOnTrack(route.platformAbbrs[route.platformAbbrs.length - 1], route.trackGroupName, trackDirection);
    if (!firstPlatId || !lastPlatId) return [];

    const startIdx = segmentIds.indexOf(firstPlatId);
    const endIdx = segmentIds.indexOf(lastPlatId);
    if (startIdx < 0 || endIdx < 0) return [];

    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);
    return segmentIds.slice(lo, hi + 1);
  }

  private createSegment(id: string, type: 'plain' | 'platform', trackGroupName: string, direction: 'west' | 'east'): Segment {
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
}
