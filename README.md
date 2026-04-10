# Track2

A subway/metro simulation TUI built in TypeScript.

Track2 lets you define subway networks in `.map` files and watch trains run in a control-room-style terminal display.

## Quick Start

```bash
npm install
npm run dev -- maps/06-routes.map
```

## Development

```bash
npm run dev -- <mapfile>    # Run with tsx (dev)
npm run build               # Compile TypeScript
npm start -- <mapfile>      # Run compiled version
```

## Project Structure

```
src/
  main.ts              # Entry point
  parser/              # .map file parser
  model/               # Track topology and state
  controller/          # Simulation engine
  view/                # TUI renderer
maps/                  # Example .map files
```

## Status

Phase 7 complete — implemented switches (branch and crossover) with explicit connection syntax in `.map` files. Trains now automatically route through switches to reach their destination platforms. Signals guarding switches display directional arrows (→, ↗, ↘) based on the active path. Visual diagonal rendering for crossovers.
