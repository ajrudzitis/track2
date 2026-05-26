/**
 * Node implementations of OutputSink / InputSource backed by
 * `process.stdout` and `process.stdin`.
 *
 * Browser hosts ship their own adapters (e.g. xterm.js) and never
 * import this module.
 */

import type { OutputSink, InputSource, ResizeListener, DataListener } from './io.js';

export class NodeStdoutSink implements OutputSink {
  private resizeListeners: ResizeListener[] = [];
  private resizeBound = false;

  get cols(): number {
    return process.stdout.columns ?? 80;
  }

  get rows(): number {
    return process.stdout.rows ?? 24;
  }

  write(s: string): void {
    process.stdout.write(s);
  }

  onResize(listener: ResizeListener): void {
    this.resizeListeners.push(listener);
    if (!this.resizeBound) {
      this.resizeBound = true;
      process.stdout.on('resize', () => {
        const c = this.cols;
        const r = this.rows;
        for (const fn of this.resizeListeners) fn(c, r);
      });
    }
  }

  enter(): void {
    process.stdout.write('\x1b[?1049h'); // alternate screen
    process.stdout.write('\x1b[?25l');   // hide cursor
    process.stdout.write('\x1b[2J');     // clear screen
  }

  exit(): void {
    process.stdout.write('\x1b[?25h');   // show cursor
    process.stdout.write('\x1b[?1049l'); // restore screen
  }
}

export class NodeStdinSource implements InputSource {
  private wasRaw = false;
  private dataListeners: DataListener[] = [];
  private boundHandler: ((data: string) => void) | null = null;

  onData(listener: DataListener): void {
    this.dataListeners.push(listener);
  }

  start(): void {
    this.wasRaw = process.stdin.isRaw ?? false;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    this.boundHandler = (data: string) => {
      for (const fn of this.dataListeners) fn(data);
    };
    process.stdin.on('data', this.boundHandler);
  }

  stop(): void {
    if (this.boundHandler) {
      process.stdin.off('data', this.boundHandler);
      this.boundHandler = null;
    }
    process.stdin.setRawMode(this.wasRaw);
    process.stdin.pause();
  }
}
