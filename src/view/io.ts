/**
 * Platform-agnostic I/O interfaces for the TUI.
 *
 * The Node CLI implements these against `process.stdout` / `process.stdin`
 * (see `node-io.ts`). A browser host (e.g. xterm.js) can implement them
 * against its own terminal emulator to drive the same renderer + input
 * handling code without modification.
 */

export type ResizeListener = (cols: number, rows: number) => void;
export type DataListener = (data: string) => void;

export interface OutputSink {
  readonly cols: number;
  readonly rows: number;
  write(s: string): void;
  onResize(listener: ResizeListener): void;
  /** Set up the surface for drawing (e.g. enter alt screen, hide cursor, clear). */
  enter(): void;
  /** Tear down (e.g. show cursor, restore screen). */
  exit(): void;
}

export interface InputSource {
  /** Subscribe to raw key data. Translation to named keys happens above. */
  onData(listener: DataListener): void;
  /** Begin reading input (e.g. set raw mode, resume stdin). */
  start(): void;
  /** Stop reading input and restore prior state. */
  stop(): void;
}
