/**
 * Layout algorithm: converts track graph into screen coordinates.
 */

import type { TrackGraph } from '../model/graph.js';
import type { Segment } from '../model/types.js';

export interface SegmentLayout {
  segmentId: string;
  x: number;         // starting x position
  y: number;         // track row y position
  width: number;     // display width in columns
  labelY: number;    // y position for the label above
}

export interface TrackGroupLayout {
  name: string;
  westY: number;
  eastY: number;
  westLabelY: number;
  eastLabelY: number;
}

export interface LayoutResult {
  segments: Map<string, SegmentLayout>;
  trackGroups: TrackGroupLayout[];
}

const PADDING_LEFT = 2;
const TRACK_GROUP_START_Y = 2;
const TRACK_SPACING = 5;  // rows between west and east track (4 lines gap + 1)

export function computeLayout(graph: TrackGraph): LayoutResult {
  const segments = new Map<string, SegmentLayout>();
  const trackGroups: TrackGroupLayout[] = [];

  let currentY = TRACK_GROUP_START_Y;

  for (const tg of graph.trackGroups) {
    const westLabelY = currentY;
    const westY = currentY + 1;
    const eastLabelY = westY + TRACK_SPACING - 1;
    const eastY = eastLabelY + 1;

    trackGroups.push({
      name: tg.name,
      westY,
      eastY,
      westLabelY,
      eastLabelY,
    });

    // Layout west track segments
    let x = PADDING_LEFT;
    for (const segId of tg.westSegments) {
      const seg = graph.segments.get(segId)!;
      segments.set(segId, {
        segmentId: segId,
        x,
        y: westY,
        width: seg.displayWidth,
        labelY: westLabelY,
      });
      x += seg.displayWidth;
    }

    // Layout east track segments
    x = PADDING_LEFT;
    for (const segId of tg.eastSegments) {
      const seg = graph.segments.get(segId)!;
      segments.set(segId, {
        segmentId: segId,
        x,
        y: eastY,
        width: seg.displayWidth,
        labelY: eastLabelY,
      });
      x += seg.displayWidth;
    }

    currentY = eastY + 3; // gap before next track group
  }

  return { segments, trackGroups };
}
