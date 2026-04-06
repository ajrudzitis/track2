# Track2

A subway/metro simulation TUI built in TypeScript.

Track2 lets you define subway networks in `.map` files and watch trains run in a control-room-style terminal display.

## Quick Start

```bash
npm install
npm run dev -- maps/demo.map
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

Phase 0 — Project setup complete. No functionality yet.
