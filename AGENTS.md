# Agent Guide for Track2

## Development Methodology

- Features are implemented one phase at a time (see TODO.md)
- Each phase ends with: working demo, `.map` file, UX confirmation, git commit
- Confirm UX with the developer before implementing each element
- After implementing an element, create a demo `.map` file in `maps/`

## Architecture

Four layers, cleanly separated:

- **Parser** (`src/parser/`): Reads `.map` files into model objects
- **Model** (`src/model/`): Track topology graph, trains, signals, segments
- **Simulation** (`src/model/simulation.ts`): Game loop, train movement, signal interlocking
- **View** (`src/view/`): TUI rendering with ANSI escape codes, keyboard input

## Tech Stack

- TypeScript, Node 22+, ESM modules
- `tsx` for development, `tsc` for production builds
- No runtime dependencies — only Node built-ins
- Raw terminal control via `process.stdout` and ANSI escape sequences

## Build & Run

```bash
npm run dev -- maps/demo.map    # Dev mode (tsx)
npm run build && npm start      # Production mode
```

## Debugging

For non-visual debugging (deadlocks, routing bugs, signal/lock state), run the
simulation in headless mode — no TUI, just periodic state dumps to stdout:

```bash
npm run dev -- --debug maps/08-terminal.map         # 1000 ticks default
npm run dev -- --debug 3000 maps/08-terminal.map    # custom tick count
```

Each snapshot prints, for every train: segment, position, direction, state,
route, and last-visited platform index — followed by every switch's `state` and
`lockedBy`. Use this in preference to writing a one-off harness when chasing
simulation bugs.

For rendering bugs (diagonals overlapping labels, misaligned tracks, layout
spacing), use the snapshot script to dump a single frame of plain text — no
ANSI, no animation, no raw terminal:

```bash
npx tsx scripts/render-snapshot.ts maps/09b-chain.map
```

The output is the screen buffer as it would be drawn at spawn time, so you can
read it inline or pipe it through `diff` to compare before/after a layout
change. Use this rather than firing up the TUI when iterating on view code.

## Key Conventions

- Track character: `━` (U+2501, BOX DRAWINGS HEAVY HORIZONTAL)
- Train display: inverted color text with direction arrow (`◂5868` / `5868▸`)
- Signals: `●` colored red/yellow/green, or directional arrows (→, ↗, ↘) for switch-guarding signals (tinted yellow when in caution). 3-aspect: a non-red signal flips to yellow when the next signal in the train's direction is red.
- Switches: Explicitly linked in `switches:` block in `.map` files using `sw1 -> sw2` syntax
- Diagonal tracks: `╲` and `╱` used for crossover paths between track groups
- Platform labels: 3-char abbreviation on colored background
- Segment labels: muted gray text

## Design Reference

See DESIGN.md for the full specification with RFC 2119 requirements.
