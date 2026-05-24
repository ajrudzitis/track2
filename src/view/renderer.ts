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
const TRACK_STYLE: CellStyle = { fg: 37, bg: 40, bold: true, inverse: false };
const ACTIVE_TRACK_STYLE: CellStyle = { fg: 32, bg: 40, bold: true, inverse: false };
const LABEL_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };
const PLATFORM_LABEL_STYLE: CellStyle = { fg: 30, bg: 47, bold: true, inverse: false };
const SIGNAL_RED: CellStyle = { fg: 31, bg: 40, bold: true, inverse: false };
const SIGNAL_GREEN: CellStyle = { fg: 32, bg: 40, bold: true, inverse: false };
const SIGNAL_LABEL_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };
const STATUS_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };

const WEST_ARROW = '◂';
const EAST_ARROW = '▸';

export class Renderer {
  private screen: ScreenBuffer;
  private layout: LayoutResult | null = null;
  private graph: TrackGraph | null = null;
  private trains: Train[] = [];
  private speedDisplay: string = '1.0x';
  private scrollX: number = 0;

  constructor(screen: ScreenBuffer) {
    this.screen = screen;
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
        this.putWorldString(labelX, sl.labelY, label, PLATFORM_LABEL_STYLE);
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
        }
        
        this.putWorld(x, y, char, style);
      }
    }
  }

  private drawSignals(): void {
    if (!this.layout) return;

    for (const sl of this.layout.signals) {
      const style = sl.signal.state === 'red' ? SIGNAL_RED : SIGNAL_GREEN;
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
    switch (signal.state) {
      case 'straight': return isEast ? '→' : '←';
      case 'diverge_up': return isEast ? '↗' : '↖';
      case 'diverge_down': return isEast ? '↘' : '↙';
      default: return '●';
    }
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
        // off to the partner switch exactly at position 0.5.
        const layoutForThisSwitch = train.position < 0.5
          ? this.layout.switches.find(l => l.fromId === train.segmentId)
          : this.layout.switches.find(l => l.toId === train.segmentId);

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
    parts.push('q quit', this.speedDisplay);
    const status = parts.join('  │  ');
    this.screen.putString(0, y, status, STATUS_STYLE);
  }
}
