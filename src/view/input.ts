/**
 * Keyboard input handler for raw terminal mode.
 */

export type KeyHandler = (key: string) => void;

export class InputHandler {
  private handler: KeyHandler;

  constructor(handler: KeyHandler) {
    this.handler = handler;
  }

  start(): void {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data: string) => {
      for (const ch of data) {
        this.handler(ch);
      }
    });
  }

  stop(): void {
    process.stdin.removeAllListeners('data');
  }
}
