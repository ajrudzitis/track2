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

## Key Conventions

- Track character: `━` (U+2501, BOX DRAWINGS HEAVY HORIZONTAL)
- Train display: inverted color text with direction arrow (`◂5868` / `5868▸`)
- Signals: `●` colored red/green, or directional arrows (→, ↗, ↘) for green signals guarding switches
- Switches: Explicitly linked in `switches:` block in `.map` files using `sw1 -> sw2` syntax
- Diagonal tracks: `╲` and `╱` used for crossover paths between track groups
- Platform labels: 3-char abbreviation on colored background
- Segment labels: muted gray text

## Design Reference

See DESIGN.md for the full specification with RFC 2119 requirements.
