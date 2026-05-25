/**
 * Renders the track display onto the screen buffer.
 */

import { type ScreenBuffer, type CellStyle } from './terminal.js';
import type { LayoutResult, SegmentLayout } from './layout.js';
import { TrackGraph } from '../model/graph.js';
import type { Platform, Train, Switch } from '../model/types.js';
import type { Signal } from '../model/signal.js';

const TRACK_CHAR = '━';
const BOUNDARY_CHAR = '┿';
const BOUNDARY_LABEL_CHAR = '┃';
const SIGNAL_CHAR = '●';

// Cells that a switch diagonal is allowed to overwrite. Anything else (i.e.
// a label glyph) is preserved by skipping the diagonal character at that cell.
const DIAGONAL_PASSABLE = new Set([' ', TRACK_CHAR, BOUNDARY_CHAR, BOUNDARY_LABEL_CHAR, '╲', '╱', '╳']);
const TRACK_STYLE: CellStyle = { fg: 37, bg: 40, bold: true, inverse: false };
const ACTIVE_TRACK_STYLE: CellStyle = { fg: 32, bg: 40, bold: true, inverse: false };
const LABEL_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };
const PLATFORM_LABEL_STYLE: CellStyle = { fg: 30, bg: 47, bold: true, inverse: false };
// Selector color is in the bright range (100-107) so it never matches a route's
// background color (routes use 41-47).
const PLATFORM_LABEL_SELECTED_STYLE: CellStyle = { fg: 30, bg: 106, bold: true, inverse: false };
const SIGNAL_RED: CellStyle = { fg: 31, bg: 40, bold: true, inverse: false };
const SIGNAL_GREEN: CellStyle = { fg: 32, bg: 40, bold: true, inverse: false };
const SIGNAL_YELLOW: CellStyle = { fg: 33, bg: 40, bold: true, inverse: false };
const SIGNAL_LABEL_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };
const STATUS_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };

const WEST_ARROW = '◂';
const EAST_ARROW = '▸';

function formatEta(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export interface ArrivalRow {
  trainId: string;
  routeColor: number;
  direction: 'west' | 'east';
  destination: string; // 3-char terminus abbr the train is heading toward
  platformId: string;
  etaSeconds: number;
}

export class Renderer {
  private screen: ScreenBuffer;
  private layout: LayoutResult | null = null;
  private graph: TrackGraph | null = null;
  private trains: Train[] = [];
  private speedDisplay: string = '1.0x';
  private scrollX: number = 0;
  private arrivalStationAbbr: string | null = null;
  private arrivalRows: ArrivalRow[] = [];

  constructor(screen: ScreenBuffer) {
    this.screen = screen;
  }

  setArrivalBoard(stationAbbr: string | null, rows: ArrivalRow[]): void {
    this.arrivalStationAbbr = stationAbbr;
    this.arrivalRows = rows;
  }

  setData(graph: TrackGraph, layout: LayoutResult): void {
    this.graph = graph;
    this.layout = layout;
  }

  setTrains(trains: Train[]): void {
    this.trains = trains;
  }

  setSpeedDisplay(s: string): void {
    this.speedDisplay = s;
  }

  scrollBy(columns: number): void {
    this.setScrollX(this.scrollX + columns);
  }

  scrollToStart(): void {
    this.setScrollX(0);
  }

  scrollToEnd(): void {
    this.setScrollX(this.maxScrollX());
  }

  render(): void {
    this.clampScrollX();
    this.screen.clear();
    if (this.layout && this.graph) {
      this.drawSegments();
      this.drawSwitches();
      this.drawSignals();
      this.drawTrains();
      if (this.arrivalStationAbbr) this.drawArrivalBoard();
    }
    this.drawStatusBar();
  }

  private setScrollX(x: number): void {
    this.scrollX = Math.max(0, Math.min(Math.floor(x), this.maxScrollX()));
  }

  private clampScrollX(): void {
    this.setScrollX(this.scrollX);
  }

  private maxScrollX(): number {
    const contentWidth = this.layout?.contentWidth ?? this.screen.width;
    return Math.max(0, contentWidth - this.screen.width);
  }

  private putWorld(x: number, y: number, char: string, style: CellStyle): void {
    this.screen.put(x - this.scrollX, y, char, style);
  }

  private putWorldString(x: number, y: number, str: string, style: CellStyle): void {
    for (let i = 0; i < str.length; i++) {
      this.putWorld(x + i, y, str[i], style);
    }
  }

  private getWorldCharAt(x: number, y: number): string | undefined {
    return this.screen.getCharAt(x - this.scrollX, y);
  }

  private drawSegments(): void {
    if (!this.layout || !this.graph) return;

    for (const [segId, sl] of this.layout.segments) {
      const seg = this.graph.segments.get(segId)!;

      // Draw track line
      for (let i = 0; i < sl.width; i++) {
        this.putWorld(sl.x + i, sl.y, TRACK_CHAR, TRACK_STYLE);
      }

      // Draw label centered above
      if (seg.type === 'platform') {
        const plat = seg as Platform;
        const label = ` ${plat.id} `;
        const labelX = sl.x + Math.floor((sl.width - label.length) / 2);
        const style = (this.arrivalStationAbbr && plat.stationAbbr === this.arrivalStationAbbr)
          ? PLATFORM_LABEL_SELECTED_STYLE
          : PLATFORM_LABEL_STYLE;
        this.putWorldString(labelX, sl.labelY, label, style);
      } else if (seg.type === 'switch' && TrackGraph.isJunction(seg as Switch)) {
        // Junction: the diagonal is the visual; no label, no Y.
      } else {
        const label = seg.id;
        const labelX = sl.x + Math.floor((sl.width - label.length) / 2);
        this.putWorldString(labelX, sl.labelY, label, LABEL_STYLE);
      }

    }

    for (const [segId, sl] of this.layout.segments) {
      const seg = this.graph.segments.get(segId)!;
      if (seg.next) {
        const nextSeg = this.graph.segments.get(seg.next);
        if (seg.type !== 'plain' || nextSeg?.type !== 'plain') continue;

        const boundaryX = sl.x + sl.width;
        this.putWorld(boundaryX, sl.y, BOUNDARY_CHAR, TRACK_STYLE);
        this.putWorld(boundaryX, sl.labelY, BOUNDARY_LABEL_CHAR, LABEL_STYLE);
      }
    }
  }

  private drawSwitches(): void {
    if (!this.layout || !this.graph) return;

    for (const swl of this.layout.switches) {
      const fromNode = this.graph.segments.get(swl.fromId) as Switch;
      const toNode = this.graph.segments.get(swl.toId) as Switch;
      if (!fromNode || !toNode) continue;

      const x1 = swl.fromX;
      const y1 = swl.fromY;
      const x2 = swl.toX;
      const y2 = swl.toY;

      const dx = x2 - x1;
      const dy = y2 - y1;
      
      const steps = Math.abs(dy);

      for (let i = 0; i <= steps; i++) {
        const y = y1 + Math.round(i * Math.sign(dy));
        const x = x1 + Math.round(i * dx / steps);
        
        if (y === y1 || y === y2) continue;

        // Determine if this step is a "corner" (adjacent to track)
        const isStartCorner = (i === 1);
        const isEndCorner = (i === steps - 1);
        
        // Highlight only the corners if their respective switch is diverging.
        // The middle (including intersection) stays default color.
        let style = TRACK_STYLE;
        if (isStartCorner && fromNode.state === 'diverging') style = ACTIVE_TRACK_STYLE;
        if (isEndCorner && toNode.state === 'diverging') style = ACTIVE_TRACK_STYLE;

        let char = (dx * dy > 0) ? '╲' : '╱';
        if (dx === 0) char = '┃';
        
        // Detect intersection for double crossover (overlaid switches)
        const existing = this.getWorldCharAt(x, y);
        if ((char === '╲' && existing === '╱') || (char === '╱' && existing === '╲') || existing === '╳') {
          char = '╳';
          // The center X always stays default color per user request
          style = TRACK_STYLE;
        } else if (existing !== undefined && !DIAGONAL_PASSABLE.has(existing)) {
          // A label glyph occupies this cell; leave it readable.
          continue;
        }

        this.putWorld(x, y, char, style);
      }
    }
  }

  private drawSignals(): void {
    if (!this.layout) return;

    for (const sl of this.layout.signals) {
      const style = sl.signal.state === 'red'
        ? SIGNAL_RED
        : (sl.signal.caution ? SIGNAL_YELLOW : SIGNAL_GREEN);
      const symbol = this.getSignalSymbol(sl.signal);
      this.putWorld(sl.x, sl.symbolY, symbol, style);

      // Position labels to avoid overlap:
      // East-facing label ends at signal x, west-facing label starts at signal x
      const label = sl.signal.id;
      const labelX = sl.signal.facingDirection === 'east'
        ? sl.x - label.length + 1
        : sl.x;
      this.putWorldString(labelX, sl.labelY, label, SIGNAL_LABEL_STYLE);
    }
  }

  private getSignalSymbol(signal: Signal): string {
    if (signal.state === 'red') return '●';
    if (signal.state === 'green') return '●';

    const isEast = signal.facingDirection === 'east';
    if (signal.state === 'straight') return isEast ? '→' : '←';
    if (signal.state === 'diverge') {
      const goesDown = this.divergingTargetGoesDown(signal);
      if (goesDown === null) return '●';
      if (isEast) return goesDown ? '↘' : '↗';
      return goesDown ? '↙' : '↖';
    }
    return '●';
  }

  // For a divergent signal, returns whether the diagonal physically descends
  // (true) or ascends (false). Uses layout y-coords so branch links work the
  // same as crossovers — both ends may share a trackDirection. Returns null if
  // the relevant geometry can't be resolved.
  private divergingTargetGoesDown(signal: Signal): boolean | null {
    if (!this.layout || !this.graph) return null;
    const switchSeg = this.graph.segments.get(signal.segmentAfter);
    if (!switchSeg || switchSeg.type !== 'switch') return null;
    const sw = switchSeg as Switch;
    const targetId = signal.facingDirection === 'east' ? sw.divergingNext : sw.divergingPrev;
    if (!targetId) return null;
    const switchLayout = this.layout.segments.get(sw.id);
    const targetLayout = this.layout.segments.get(targetId);
    if (!switchLayout || !targetLayout) return null;
    if (targetLayout.y === switchLayout.y) return null;
    return targetLayout.y > switchLayout.y;
  }

  private drawTrains(): void {
    if (!this.layout || !this.graph) return;

    for (const train of this.trains) {
      const sl = this.layout.segments.get(train.segmentId);
      if (!sl) continue;

      const seg = this.graph.segments.get(train.segmentId)!;
      const trainStyle: CellStyle = { fg: 30, bg: train.color, bold: true, inverse: false };
      const trainText = train.direction === 'west' ? WEST_ARROW + train.id : train.id + EAST_ARROW;
      
      let trainX: number;
      let trainY: number = sl.y;

      if (seg.type === 'switch' && (seg as Switch).state === 'diverging') {
        // Pick the diagonal entry for this train. Bidirectional (double) crossovers
        // produce TWO layout entries that both touch the same switches — one per
        // diagonal of the X. Disambiguate by which half of the segment the train
        // occupies: positions below 0.5 always sit on the "from" side of whichever
        // diagonal is actually being traversed, positions at/above 0.5 on the "to"
        // side. This is direction-independent because the simulation always hands
        // off to the partner switch exactly at position 0.5. For a unidirectional
        // cross-group diagonal only one variant exists, so fall back to whichever
        // side we find — otherwise the frame at the handoff snaps to the
        // segment's regular anchor before the next frame interpolates back.
        const fromSideLayout = this.layout.switches.find(l => l.fromId === train.segmentId);
        const toSideLayout = this.layout.switches.find(l => l.toId === train.segmentId);
        const layoutForThisSwitch = train.position < 0.5
          ? (fromSideLayout ?? toSideLayout)
          : (toSideLayout ?? fromSideLayout);

        if (layoutForThisSwitch) {
          const l = layoutForThisSwitch;
          const isFromSide = l.fromId === train.segmentId;

          // Always interpolate from 'from' to 'to'
          const startX = l.fromX;
          const endX = l.toX;
          const startY = l.fromY;
          const endY = l.toY;

          // If we are on the 'from' side, we go from 0.0 to 0.5 of the crossover as position goes 0.25 to 0.5
          // If we are on the 'to' side, we go from 0.5 to 1.0 of the crossover as position goes 0.5 to 0.75
          let t: number;
          if (isFromSide) {
            // Map 0.25 -> 0.5 to t = 0.0 -> 0.5
            t = Math.max(0, (train.position - 0.25)) / 0.5;
          } else {
            // Map 0.5 -> 0.75 to t = 0.5 -> 1.0
            t = 0.5 + Math.min(0.5, (train.position - 0.5)) / 0.5;
          }
          
          t = Math.max(0, Math.min(1, t));
          trainX = Math.round(startX + t * (endX - startX) - trainText.length / 2);
          trainY = Math.round(startY + t * (endY - startY));
        } else {
          trainX = sl.x + Math.round(train.position * (sl.width - trainText.length));
        }
      } else {
        trainX = sl.x + Math.round(train.position * (sl.width - trainText.length));
      }

      for (let i = 0; i < trainText.length; i++) {
        this.putWorld(trainX + i, trainY, trainText[i], trainStyle);
      }
    }
  }

  private drawArrivalBoard(): void {
    if (!this.arrivalStationAbbr) return;

    const header = ` ${this.arrivalStationAbbr} arrivals `;
    const rows = this.arrivalRows.slice(0, 8);

    const rowTexts = rows.length === 0
      ? ['(no inbound trains)']
      : rows.map(r => {
          const arrow = r.direction === 'east' ? EAST_ARROW : WEST_ARROW;
          return `${r.trainId.padEnd(4)} ${arrow} ${r.destination.padEnd(3)}  ${r.platformId.padEnd(6)} ${formatEta(r.etaSeconds)}`;
        });

    const innerWidth = Math.max(header.length, ...rowTexts.map(t => t.length + 2));
    const totalWidth = innerWidth + 2;
    const totalHeight = rowTexts.length + 2;

    const x0 = Math.max(0, this.screen.width - totalWidth - 1);
    const y0 = 0;

    // Top border with embedded header.
    const headerPadded = header.padEnd(innerWidth, '─');
    this.screen.putString(x0, y0, '┌' + headerPadded + '┐', STATUS_STYLE);

    for (let i = 0; i < rowTexts.length; i++) {
      const padded = ' ' + rowTexts[i].padEnd(innerWidth - 1);
      this.screen.put(x0, y0 + 1 + i, '│', STATUS_STYLE);
      this.screen.put(x0 + totalWidth - 1, y0 + 1 + i, '│', STATUS_STYLE);
      // Color the train ID with its route color; rest is default text style.
      if (rows[i]) {
        const row = rows[i];
        const trainStyle: CellStyle = { fg: 30, bg: row.routeColor, bold: true, inverse: false };
        for (let c = 0; c < padded.length; c++) {
          const ch = padded[c];
          // Color only the train-ID columns (1..1+4).
          const isTrainId = c >= 1 && c <= 4 && ch !== ' ';
          this.screen.put(x0 + 1 + c, y0 + 1 + i, ch, isTrainId ? trainStyle : STATUS_STYLE);
        }
      } else {
        this.screen.putString(x0 + 1, y0 + 1 + i, padded, STATUS_STYLE);
      }
    }

    this.screen.putString(x0, y0 + totalHeight - 1, '└' + '─'.repeat(innerWidth) + '┘', STATUS_STYLE);
  }

  private drawStatusBar(): void {
    const y = this.screen.height - 1;
    const trainCount = this.trains.length;
    const parts = [` Track2 v0.1`, `${trainCount} trains`, '+/- speed'];
    const contentWidth = this.layout?.contentWidth ?? this.screen.width;
    if (this.maxScrollX() > 0) {
      const visibleStart = this.scrollX + 1;
      const visibleEnd = Math.min(this.scrollX + this.screen.width, contentWidth);
      parts.push('←/→ scroll', 'Home/End', `${visibleStart}-${visibleEnd}/${contentWidth}`);
    }
    parts.push(this.arrivalStationAbbr ? 'a close · [/] station' : 'a arrivals');
    parts.push('q quit', this.speedDisplay);
    const status = parts.join('  │  ');
    this.screen.putString(0, y, status, STATUS_STYLE);
  }
}
