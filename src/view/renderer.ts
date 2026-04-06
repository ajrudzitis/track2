/**
 * Renders the track display onto the screen buffer.
 */

import { ScreenBuffer, DEFAULT_STYLE, type CellStyle } from './terminal.js';

const TRACK_CHAR = '━';
const TRACK_STYLE: CellStyle = { fg: 37, bg: 40, bold: true, inverse: false };
const STATUS_STYLE: CellStyle = { fg: 90, bg: 40, bold: false, inverse: false };

export class Renderer {
  private screen: ScreenBuffer;

  constructor(screen: ScreenBuffer) {
    this.screen = screen;
  }

  render(): void {
    this.screen.clear();
    this.drawTracks();
    this.drawStatusBar();
  }

  private drawTracks(): void {
    const w = this.screen.width;
    const trackWidth = Math.max(20, w - 4); // 2 char padding each side
    const startX = 2;

    // Two tracks with 4 lines of spacing between them
    // Track 1 (westbound) at row 2
    // Track 2 (eastbound) at row 7
    const track1Y = 2;
    const track2Y = track1Y + 5; // 4 lines gap + 1 for the track itself

    // Draw westbound track
    for (let x = 0; x < trackWidth; x++) {
      this.screen.put(startX + x, track1Y, TRACK_CHAR, TRACK_STYLE);
    }

    // Draw eastbound track
    for (let x = 0; x < trackWidth; x++) {
      this.screen.put(startX + x, track2Y, TRACK_CHAR, TRACK_STYLE);
    }
  }

  private drawStatusBar(): void {
    const y = this.screen.height - 1;
    const status = '  Track2 v0.1  │  q: quit';
    this.screen.putString(0, y, status, STATUS_STYLE);
  }
}
