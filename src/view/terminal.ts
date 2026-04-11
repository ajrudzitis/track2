/**
 * Raw terminal control: alternate screen, cursor, colors, cell-based screen buffer.
 */

export interface CellStyle {
  fg: number;       // ANSI color code (e.g. 37 for white)
  bg: number;       // ANSI background code (e.g. 40 for black)
  bold: boolean;
  inverse: boolean;
}

export interface Cell {
  char: string;
  style: CellStyle;
}

export const DEFAULT_STYLE: CellStyle = { fg: 37, bg: 40, bold: false, inverse: false };

function cellsEqual(a: Cell, b: Cell): boolean {
  return a.char === b.char &&
    a.style.fg === b.style.fg &&
    a.style.bg === b.style.bg &&
    a.style.bold === b.style.bold &&
    a.style.inverse === b.style.inverse;
}

function makeCell(char = ' ', style: CellStyle = DEFAULT_STYLE): Cell {
  return { char, style: { ...style } };
}

export class ScreenBuffer {
  width: number;
  height: number;
  cells: Cell[][];
  prev: Cell[][] | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = this.createGrid();
  }

  private createGrid(): Cell[][] {
    const grid: Cell[][] = [];
    for (let y = 0; y < this.height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push(makeCell());
      }
      grid.push(row);
    }
    return grid;
  }

  clear(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x] = makeCell();
      }
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cells = this.createGrid();
    this.prev = null;
  }

  put(x: number, y: number, char: string, style: CellStyle = DEFAULT_STYLE): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.cells[y][x] = { char, style: { ...style } };
    }
  }

  getCharAt(x: number, y: number): string | undefined {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.cells[y][x].char;
    }
    return undefined;
  }

  putString(x: number, y: number, str: string, style: CellStyle = DEFAULT_STYLE): void {
    for (let i = 0; i < str.length; i++) {
      this.put(x + i, y, str[i], style);
    }
  }

  flush(): void {
    let out = '';
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (this.prev && cellsEqual(cell, this.prev[y]?.[x])) {
          continue;
        }
        out += `\x1b[${y + 1};${x + 1}H`; // move cursor
        out += styleToAnsi(cell.style);
        out += cell.char;
      }
    }
    out += '\x1b[0m'; // reset
    out += `\x1b[${this.height};${this.width}H`; // park cursor at bottom-right
    if (out.length > 0) {
      process.stdout.write(out);
    }
    // Swap buffers
    this.prev = this.cells;
    this.cells = this.createGrid();
    // Copy prev content into new cells so next frame starts from current state
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x] = { char: this.prev[y][x].char, style: { ...this.prev[y][x].style } };
      }
    }
  }
}

function styleToAnsi(style: CellStyle): string {
  let seq = '\x1b[0;';
  if (style.bold) seq += '1;';
  if (style.inverse) seq += '7;';
  seq += `${style.fg};${style.bg}m`;
  return seq;
}

export class Terminal {
  private buffer: ScreenBuffer;
  private wasRaw = false;

  constructor() {
    const [w, h] = process.stdout.columns
      ? [process.stdout.columns, process.stdout.rows]
      : [80, 24];
    this.buffer = new ScreenBuffer(w, h);
  }

  get width(): number { return this.buffer.width; }
  get height(): number { return this.buffer.height; }
  get screen(): ScreenBuffer { return this.buffer; }

  enter(): void {
    this.wasRaw = process.stdin.isRaw ?? false;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write('\x1b[?1049h'); // alternate screen
    process.stdout.write('\x1b[?25l');   // hide cursor
    process.stdout.write('\x1b[2J');     // clear screen

    process.stdout.on('resize', () => {
      const w = process.stdout.columns;
      const h = process.stdout.rows;
      this.buffer.resize(w, h);
      process.stdout.write('\x1b[2J'); // clear on resize
    });
  }

  exit(): void {
    process.stdout.write('\x1b[?25h');   // show cursor
    process.stdout.write('\x1b[?1049l'); // restore screen
    process.stdin.setRawMode(this.wasRaw);
    process.stdin.pause();
  }

  flush(): void {
    this.buffer.flush();
  }
}
