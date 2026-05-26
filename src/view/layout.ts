/**
 * Layout algorithm: converts track graph into screen coordinates.
 */

import type { TrackGraph } from '../model/graph.js';
import type { Signal } from '../model/signal.js';
import type { Switch } from '../model/types.js';

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

export interface SwitchLayout {
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isActive: boolean;
}

export interface LayoutResult {
  segments: Map<string, SegmentLayout>;
  signals: SignalLayout[];
  trackGroups: TrackGroupLayout[];
  switches: SwitchLayout[];
  contentWidth: number;
  contentHeight: number;
}

const PADDING_LEFT = 2;
const TRACK_GROUP_START_Y = 2;
const MIN_FORWARD_SWITCH_COLUMNS = 8;

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

    // 3-line gap between tracks (dy=7). With switch width 14, the X-double
    // diagonals (dx=7) form a clean 45° open-X with adjacent ╲╱ / ╱╲ at the
    // midpoint rather than a tight ╳ — easier to read at a glance.
    const eastLabelY = westSignalLabelY + 4;
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

  applyBranchTrackGroupOffsets(graph, segments);

  // Populate switch connections
  const switches: SwitchLayout[] = [];
  for (const segId of graph.segments.keys()) {
    const seg = graph.segments.get(segId)!;
    if (seg.type === 'switch') {
      const sw = seg as Switch;
      if (sw.divergingNext) {
        const fromLayout = segments.get(sw.id);
        const toLayout = segments.get(sw.divergingNext);
        if (fromLayout && toLayout) {
          // Ensure crossovers always slant 'forward' (left-to-right)
          // by using the 1/4 point for the start and 3/4 point for the end.
          const fromX = fromLayout.x + Math.floor(fromLayout.width * 0.25);
          const toX = toLayout.x + Math.floor(toLayout.width * 0.75);

          switches.push({
            fromId: sw.id,
            toId: sw.divergingNext,
            fromX,
            fromY: fromLayout.y,
            toX,
            toY: toLayout.y,
            isActive: false,
          });
        }
      }
    }
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

  computeDiagonalConflicts(graph, segments, switches);

  let contentWidth = PADDING_LEFT;
  for (const sl of segments.values()) {
    contentWidth = Math.max(contentWidth, sl.x + sl.width);
  }
  for (const sl of signals) {
    const labelStart = sl.signal.facingDirection === 'east'
      ? sl.x - sl.signal.id.length + 1
      : sl.x;
    contentWidth = Math.max(contentWidth, sl.x + 1, labelStart + sl.signal.id.length);
  }
  for (const sw of switches) {
    contentWidth = Math.max(contentWidth, sw.fromX + 1, sw.toX + 1);
  }
  contentWidth += PADDING_LEFT;

  let contentHeight = 0;
  for (const tg of trackGroups) {
    contentHeight = Math.max(contentHeight, tg.eastSignalLabelY + 1);
  }
  for (const sw of switches) {
    contentHeight = Math.max(contentHeight, Math.max(sw.fromY, sw.toY) + 1);
  }

  return { segments, signals, trackGroups, switches, contentWidth, contentHeight };
}

/**
 * Walk each diagonal's intermediate cells and record any other segment whose
 * track row a cell falls inside. Both endpoint switches gain the crossed
 * segment in their conflict list, so the simulation enforces interlocking
 * regardless of which side of the diagonal the conflict was discovered from.
 */
function computeDiagonalConflicts(
  graph: TrackGraph,
  segments: Map<string, SegmentLayout>,
  switches: SwitchLayout[],
): void {
  const cellToSegment = new Map<string, string>();
  for (const [segId, sl] of segments) {
    for (let x = sl.x; x < sl.x + sl.width; x++) {
      cellToSegment.set(`${x},${sl.y}`, segId);
    }
  }

  for (const swl of switches) {
    const dx = swl.toX - swl.fromX;
    const dy = swl.toY - swl.fromY;
    const steps = Math.abs(dy);
    if (steps === 0) continue;

    const crossed = new Set<string>();
    for (let i = 1; i < steps; i++) {
      const y = swl.fromY + i * Math.sign(dy);
      const x = swl.fromX + Math.round(i * dx / steps);
      const cellSeg = cellToSegment.get(`${x},${y}`);
      if (cellSeg && cellSeg !== swl.fromId && cellSeg !== swl.toId) {
        crossed.add(cellSeg);
      }
    }

    for (const endpointId of [swl.fromId, swl.toId]) {
      const seg = graph.segments.get(endpointId);
      if (seg?.type !== 'switch') continue;
      const sw = seg as Switch;
      for (const c of crossed) {
        if (!sw.conflicts.includes(c)) sw.conflicts.push(c);
      }
    }
  }
}

function applyBranchTrackGroupOffsets(graph: TrackGraph, segments: Map<string, SegmentLayout>): void {
  const offsets = new Map<string, number>();
  for (const tg of graph.trackGroups) {
    offsets.set(tg.name, 0);
  }

  let changed = true;
  let passes = 0;
  const maxPasses = Math.max(1, graph.trackGroups.length * graph.trackGroups.length);

  while (changed && passes < maxPasses) {
    changed = false;
    passes++;

    for (const seg of graph.segments.values()) {
      if (seg.type !== 'switch') continue;

      const sw = seg as Switch;
      if (!sw.divergingNext) continue;

      const target = graph.segments.get(sw.divergingNext);
      if (!target || target.type !== 'switch') continue;
      if (target.trackGroupName === sw.trackGroupName) continue;

      // Cross-group bidirectional links would impose opposing "forward" constraints.
      // Directed branch links are the case this offset pass is designed to align.
      if ((target as Switch).divergingNext === sw.id) continue;

      const fromLayout = segments.get(sw.id);
      const toLayout = segments.get(sw.divergingNext);
      if (!fromLayout || !toLayout) continue;

      const fromOffset = offsets.get(sw.trackGroupName) ?? 0;
      const toOffset = offsets.get(target.trackGroupName) ?? 0;
      const fromX = fromLayout.x + fromOffset + Math.floor(fromLayout.width * 0.25);
      const toX = toLayout.x + toOffset + Math.floor(toLayout.width * 0.75);
      // Require dx >= dy so the diagonal renders at <=45° (one column per row).
      // Without this, dy>dx makes the renderer stack ╲ glyphs vertically and
      // the diagonal looks jagged.
      const dy = Math.abs(toLayout.y - fromLayout.y);
      const minForward = Math.max(MIN_FORWARD_SWITCH_COLUMNS, dy);
      const needed = fromX + minForward - toX;

      if (needed > 0) {
        offsets.set(target.trackGroupName, toOffset + needed);
        changed = true;
      }
    }
  }

  for (const sl of segments.values()) {
    const seg = graph.segments.get(sl.segmentId);
    if (!seg) continue;
    sl.x += offsets.get(seg.trackGroupName) ?? 0;
  }
}
