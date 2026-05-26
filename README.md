```
  ______                __  ___
 /_  __/________ ______/ /_|__ \
  / / / ___/ __ `/ ___/ //_/_/ /
 / / / /  / /_/ / /__/ ,< / __/
/_/ /_/   \__,_/\___/_/|_/____/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◂1001━━━━
```

A subway/metro simulation TUI built in TypeScript — define a network in a
`.map` file and watch trains run on a control-room-style terminal display.

![Track2 screenshot](assets/screenshot.png)

## Quick start

```bash
npm install
npm run dev -- maps/10-two-routes.map
```

`10-two-routes.map` is the showcase map: a six-station mainline that forks
onto a three-station branch, with two routes (mainline + branch) sharing
the pre-fork stations, eight trains running, and bidirectional crossovers
at every terminus.

## Keybindings

| Key                | Action                                                |
|--------------------|-------------------------------------------------------|
| `+` / `-`          | Speed up / slow down the sim (0.25x – 4x)             |
| `←` `→` `Home` `End` | Pan horizontally / jump to either edge              |
| `↑` `↓`            | Scroll vertically when the map is taller than screen  |
| `a`                | Open / close the per-station arrival board            |
| `[` `]`            | Cycle stations in the arrival board                   |
| `h`                | Toggle the help overlay (full keybinding list)        |
| `Esc`              | Close any open overlay                                |
| `q`                | Quit                                                  |

## Demo maps

The `maps/` directory is also a feature tour — each map adds one capability
on top of the last.

| Map                  | Shows off                                              |
|----------------------|--------------------------------------------------------|
| `02-segments.map`    | Plain segments, boundary tick marks                    |
| `03-platforms.map`   | Station platforms with 3-char labels                   |
| `04-signals.map`     | Auto-generated signals at segment boundaries           |
| `05-trains.map`      | Train movement, dwell, signal respect                  |
| `06-routes.map`      | Cyclic routes, multiple trains per route               |
| `07-switches.map`    | Crossovers and branch switches                         |
| `08-terminal.map`    | Terminus crossover + per-route layover timer           |
| `08b-scrolling.map`  | Maps wider than the terminal scroll horizontally       |
| `09-advanced.map`    | Routes spanning separate track groups via branch links |
| `09b-chain.map`      | Multi-switch chain reservation (atomic, deadlock-free) |
| `09c-aspects.map`    | 3-aspect signals (yellow caution before red)           |
| `10-two-routes.map`  | Two routes sharing a mainline stub, branch fork        |

## Development

```bash
npm run dev -- <mapfile>              # Run with tsx
npm run dev -- --debug <mapfile>      # Headless: dump train/switch state
npm run build                         # Compile TypeScript
npm start -- <mapfile>                # Run compiled version

npx tsx scripts/render-snapshot.ts <mapfile>   # Single-frame text snapshot
```

`--debug` is the right tool for chasing simulation bugs (routing,
interlocking, deadlocks). `render-snapshot.ts` dumps a plain-text frame
of the renderer — useful for diffing layout changes without firing up the
full TUI.

## Project structure

```
src/
  main.ts        Entry point + key handling
  parser/        .map file parser
  model/         Track topology, trains, signals, simulation
  view/          Layout + ANSI renderer + input
scripts/         render-snapshot.ts
maps/            Demo .map files (see table above)
```

Four layers, no runtime dependencies — only Node built-ins, raw terminal
control via `process.stdout` and ANSI escape sequences. See `DESIGN.md`
for the full spec with RFC 2119 requirements and `CLAUDE.md` for the
codebase conventions.

## Status

Phases 0 through 10 (Polish + Special Features) are complete. The
simulation supports cyclic routes spanning multiple track groups, branch
switches and double crossovers, atomic multi-switch chain reservation,
3-aspect signals with yellow caution, per-route layovers at termini,
horizontal and vertical scrolling for oversized maps, a per-station
arrival board with route-aware ETAs, and a sim clock + train-state
breakdown in the status bar.

Route endpoints are still required to be physical track termini —
mid-line turnbacks need explicit turnback or crossover support before
they can be modeled safely. Manual switch override is the one Phase 10
item not yet wired up.

Map loading fails fast on malformed syntax, unknown keys, unresolved
switch links, missing route platforms, and unsupported route endpoints.
