/**
 * Renders the track display onto the screen buffer.
 */

import { type ScreenBuffer, type CellStyle } from './terminal.js';
import type { LayoutResult } from './layout.js';
import type { TrackGraph } from '../model/graph.js';
import type { Platform } from '../model/types.js';

const TRACK_CHAR = '━';
const BOUNDARY_CHAR = '┿';
const BOUNDARY_LABEL_CHAR = '┃';
const SIGNAL_CHAR = '●';
const TRACK_STYLE: CellStyle = { fg: 37, bg: 40, bold: true, inverse: false };
const LABEL_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };
const PLATFORM_LABEL_STYLE: CellStyle = { fg: 30, bg: 47, bold: true, inverse: false };
const SIGNAL_RED: CellStyle = { fg: 31, bg: 40, bold: true, inverse: false };
const SIGNAL_GREEN: CellStyle = { fg: 32, bg: 40, bold: true, inverse: false };
const SIGNAL_LABEL_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };
const STATUS_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };

export class Renderer {
  private screen: ScreenBuffer;
  private layout: LayoutResult | null = null;
  private graph: TrackGraph | null = null;

  constructor(screen: ScreenBuffer) {
    this.screen = screen;
  }

  setData(graph: TrackGraph, layout: LayoutResult): void {
    this.graph = graph;
    this.layout = layout;
  }

  render(): void {
    this.screen.clear();
    if (this.layout && this.graph) {
      this.drawSegments();
      this.drawSignals();
    }
    this.drawStatusBar();
  }

  private drawSegments(): void {
    if (!this.layout || !this.graph) return;

    for (const [segId, sl] of this.layout.segments) {
      const seg = this.graph.segments.get(segId)!;

      // Draw track line
      for (let i = 0; i < sl.width; i++) {
        this.screen.put(sl.x + i, sl.y, TRACK_CHAR, TRACK_STYLE);
      }

      // Draw label centered above
      if (seg.type === 'platform') {
        const plat = seg as Platform;
        const label = ` ${plat.id} `;
        const labelX = sl.x + Math.floor((sl.width - label.length) / 2);
        this.screen.putString(labelX, sl.labelY, label, PLATFORM_LABEL_STYLE);
      } else {
        const label = seg.id;
        const labelX = sl.x + Math.floor((sl.width - label.length) / 2);
        this.screen.putString(labelX, sl.labelY, label, LABEL_STYLE);
      }

      // Draw boundary tick mark at the end of segment (if there's a next segment)
      if (seg.next) {
        const boundaryX = sl.x + sl.width;
        this.screen.put(boundaryX, sl.y, BOUNDARY_CHAR, TRACK_STYLE);
        this.screen.put(boundaryX, sl.labelY, BOUNDARY_LABEL_CHAR, LABEL_STYLE);
      }
    }
  }

  private drawSignals(): void {
    if (!this.layout) return;

    for (const sl of this.layout.signals) {
      const style = sl.signal.state === 'green' ? SIGNAL_GREEN : SIGNAL_RED;
      this.screen.put(sl.x, sl.symbolY, SIGNAL_CHAR, style);

      // Position labels to avoid overlap:
      // East-facing label ends at signal x, west-facing label starts at signal x
      const label = sl.signal.id;
      const labelX = sl.signal.facingDirection === 'east'
        ? sl.x - label.length + 1
        : sl.x;
      this.screen.putString(labelX, sl.labelY, label, SIGNAL_LABEL_STYLE);
    }
  }

  private drawStatusBar(): void {
    const y = this.screen.height - 1;
    const status = '  Track2 v0.1  │  q: quit';
    this.screen.putString(0, y, status, STATUS_STYLE);
  }
}
