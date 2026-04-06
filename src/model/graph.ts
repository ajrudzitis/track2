/**
 * Track topology graph built from parsed map data.
 */

import type { MapFile } from '../parser/types.js';
import type { Segment, TrackGroup } from './types.js';

const DEFAULT_SEGMENT_WIDTH = 16;

export class TrackGraph {
  segments: Map<string, Segment> = new Map();
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
        const seg = graph.createSegment(elem.id, elem.type === 'platform' ? 'platform' : 'plain', groupDef.name, 'west');
        tg.westSegments.push(seg.id);
      }

      // Build east track segments
      for (const elem of groupDef.eastTrack) {
        const seg = graph.createSegment(elem.id, elem.type === 'platform' ? 'platform' : 'plain', groupDef.name, 'east');
        tg.eastSegments.push(seg.id);
      }

      // Link segments in sequence
      graph.linkSequence(tg.westSegments);
      graph.linkSequence(tg.eastSegments);

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

  private linkSequence(segmentIds: string[]): void {
    for (let i = 0; i < segmentIds.length - 1; i++) {
      const curr = this.segments.get(segmentIds[i])!;
      const next = this.segments.get(segmentIds[i + 1])!;
      curr.next = next.id;
      next.prev = curr.id;
    }
  }
}
