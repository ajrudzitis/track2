/**
 * Layout algorithm: converts track graph into screen coordinates.
 */

import type { TrackGraph } from '../model/graph.js';
import type { Signal } from '../model/signal.js';

export interface SegmentLayout {
  segmentId: string;
  x: number;         // starting x position
  y: number;         // track row y position
  width: number;     // display width in columns
  labelY: number;    // y position for the label above
}

export interface SignalLayout {
  signal: Signal;
  x: number;         // screen x position
  symbolY: number;   // y for the ● symbol (below track)
  labelY: number;    // y for the signal name (below symbol)
}

export interface TrackGroupLayout {
  name: string;
  westY: number;
  eastY: number;
  westLabelY: number;
  eastLabelY: number;
  westSignalSymbolY: number;
  westSignalLabelY: number;
  eastSignalSymbolY: number;
  eastSignalLabelY: number;
}

export interface LayoutResult {
  segments: Map<string, SegmentLayout>;
  signals: SignalLayout[];
  trackGroups: TrackGroupLayout[];
}

const PADDING_LEFT = 2;
const TRACK_GROUP_START_Y = 2;

export function computeLayout(graph: TrackGraph): LayoutResult {
  const segments = new Map<string, SegmentLayout>();
  const signals: SignalLayout[] = [];
  const trackGroups: TrackGroupLayout[] = [];

  let currentY = TRACK_GROUP_START_Y;

  for (const tg of graph.trackGroups) {
    // Layout:
    //   westLabelY          - segment/platform labels
    //   westY               - track line
    //   westSignalSymbolY   - signal ● symbols
    //   westSignalLabelY    - signal names
    //   (gap)
    //   eastLabelY          - segment/platform labels
    //   eastY               - track line
    //   eastSignalSymbolY   - signal ● symbols
    //   eastSignalLabelY    - signal names

    const westLabelY = currentY;
    const westY = currentY + 1;
    const westSignalSymbolY = westY + 1;
    const westSignalLabelY = westSignalSymbolY + 1;

    const eastLabelY = westSignalLabelY + 2; // 1 line gap
    const eastY = eastLabelY + 1;
    const eastSignalSymbolY = eastY + 1;
    const eastSignalLabelY = eastSignalSymbolY + 1;

    trackGroups.push({
      name: tg.name,
      westY,
      eastY,
      westLabelY,
      eastLabelY,
      westSignalSymbolY,
      westSignalLabelY,
      eastSignalSymbolY,
      eastSignalLabelY,
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

    currentY = eastSignalLabelY + 3; // gap before next track group
  }

  // Position signals at segment boundaries
  for (const signal of graph.signals) {
    const beforeLayout = segments.get(signal.segmentBefore);
    const afterLayout = segments.get(signal.segmentAfter);
    if (!beforeLayout || !afterLayout) continue;

    // The boundary ┿ is at the start of whichever segment is on the right.
    // For east-facing: afterLayout (right seg) is being entered from the left.
    // For west-facing: beforeLayout (right seg) is the approach side.
    const boundaryX = signal.facingDirection === 'east'
      ? afterLayout.x
      : beforeLayout.x;

    // Find which track group this signal belongs to
    const seg = graph.segments.get(signal.segmentAfter)!;
    const tgLayout = trackGroups.find(t => t.name === seg.trackGroupName);
    if (!tgLayout) continue;

    const isWestTrack = seg.trackDirection === 'west';
    const symbolY = isWestTrack ? tgLayout.westSignalSymbolY : tgLayout.eastSignalSymbolY;
    const labelY = isWestTrack ? tgLayout.westSignalLabelY : tgLayout.eastSignalLabelY;

    // East-facing signal one left of ┿, west-facing one right
    const x = signal.facingDirection === 'east'
      ? boundaryX - 1
      : boundaryX + 1;

    signals.push({
      signal,
      x,
      symbolY,
      labelY,
    });
  }

  return { segments, signals, trackGroups };
}
