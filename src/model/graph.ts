/**
 * Track topology graph built from parsed map data.
 */

import type { MapFile } from '../parser/types.js';
import type { Segment, Platform, TrackGroup } from './types.js';
import { type Signal, generateSignals } from './signal.js';

const DEFAULT_SEGMENT_WIDTH = 16;

export class TrackGraph {
  segments: Map<string, Segment> = new Map();
  signals: Signal[] = [];
  trackGroups: TrackGroup[] = [];

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

    return graph;
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
