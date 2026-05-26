/**
 * Keyboard input handler for raw terminal mode.
 */

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
  private handler: KeyHandler;

  constructor(handler: KeyHandler) {
    this.handler = handler;
  }

  start(): void {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data: string) => {
      let i = 0;
      while (i < data.length) {
        const seq = Object.keys(KEY_SEQUENCES).find(s => data.startsWith(s, i));
        if (seq) {
          this.handler(KEY_SEQUENCES[seq]);
          i += seq.length;
        } else {
          this.handler(data[i]);
          i++;
        }
      }
    });
  }

  stop(): void {
    process.stdin.removeAllListeners('data');
  }
}
