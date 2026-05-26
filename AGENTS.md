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
- **View** (`src/view/`): Cell-based screen buffer, ANSI renderer, key translation. Platform-agnostic — drives any `OutputSink` / `InputSource` (see `src/view/io.ts`).

The TUI loop itself lives in `src/runtime.ts` (`runSimulation({ mapSource, output, input, onQuit })`). The Node CLI (`src/main.ts`) wires the runtime to `process.stdout` / `process.stdin` via the adapters in `src/view/node-io.ts`. Browser hosts (e.g. xterm.js) implement the same interfaces against their own terminal emulator and call `runSimulation` with no changes to the simulation, model, or renderer.

## Tech Stack

- TypeScript, Node 22+, ESM modules
- `tsx` for development, `tsc` for production builds
- No runtime dependencies — only Node built-ins
- Terminal output via ANSI escape sequences, written through the `OutputSink` interface (`process.stdout` for the CLI, `xterm.Terminal.write` for browser hosts)

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
- Arrival board: press `a` to open / close, `[` and `]` to cycle stations, `Esc` to close. The selected station's platforms are highlighted on the map. ETAs are route-aware — the walker mirrors the autorouter's decision at each switch (taking the path that reaches the train's next route stop), so trains needing a future divert are included.
- Help overlay: press `h` to toggle a popover listing every keybinding. Status bar only advertises `h help` and `q quit` so it stays uncluttered.
- Status bar: bottom row. Left: version, sim clock (counts up from spawn, scales with speed), train count with running/dwelling/stopped breakdown, current speed. Right: help and quit hints. The clock and breakdown are useful at-a-glance signals when you're watching a long sim.
- Switches: Explicitly linked in `switches:` block in `.map` files using `sw1 -> sw2` syntax
- Diagonal tracks: `╲` and `╱` used for crossover paths between track groups
- Platform labels: 3-char abbreviation on colored background
- Segment labels: muted gray text

## Design Reference

See DESIGN.md for the full specification with RFC 2119 requirements.
