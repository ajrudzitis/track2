/**
 * Translates raw key data from an InputSource into named keys (arrow keys,
 * home/end, etc.). The source is platform-specific (Node stdin, xterm.js
 * onData, etc.) — see `io.ts`.
 */

import type { InputSource } from './io.js';

export type KeyHandler = (key: string) => void;

const KEY_SEQUENCES: Record<string, string> = {
  '\x1b[A': 'up',
  '\x1b[B': 'down',
  '\x1b[D': 'left',
  '\x1b[C': 'right',
  '\x1b[H': 'home',
  '\x1b[F': 'end',
  '\x1bOH': 'home',
  '\x1bOF': 'end',
  '\x1b[1~': 'home',
  '\x1b[4~': 'end',
};

export class InputHandler {
  private source: InputSource;
  private handler: KeyHandler;
  private subscribed = false;

  constructor(source: InputSource, handler: KeyHandler) {
    this.source = source;
    this.handler = handler;
  }

  start(): void {
    if (!this.subscribed) {
      this.source.onData((data) => this.dispatch(data));
      this.subscribed = true;
    }
    this.source.start();
  }

  stop(): void {
    this.source.stop();
  }

  private dispatch(data: string): void {
    let i = 0;
    while (i < data.length) {
      const seq = Object.keys(KEY_SEQUENCES).find((s) => data.startsWith(s, i));
      if (seq) {
        this.handler(KEY_SEQUENCES[seq]);
        i += seq.length;
      } else {
        this.handler(data[i]);
        i++;
      }
    }
  }
}
