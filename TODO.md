# Track2 TODO

## Phase 0: Project Setup
- [x] Create package.json, tsconfig.json, .gitignore
- [x] Set up directory structure (src/, maps/)
- [x] Create stub main.ts
- [x] Create README.md, AGENT.md, TODO.md

## Phase 1: Terminal Control + Basic Track Rendering
- [ ] Implement terminal.ts (raw mode, alternate screen, ANSI helpers, screen buffer)
- [ ] Implement input.ts (keyboard handling, q to quit)
- [ ] Implement renderer.ts (draw horizontal tracks with ━)
- [ ] Demo: TUI shows two parallel tracks, q exits cleanly

## Phase 2: .map Parser + Segments
- [ ] Implement tokenizer and parser for trackgroup blocks
- [ ] Implement segment model and track graph
- [ ] Implement layout algorithm (linear horizontal)
- [ ] Render segment labels in muted gray
- [ ] Create maps/02-segments.map

## Phase 3: Platforms + Stations
- [ ] Platform model (3-char abbreviation, colored background)
- [ ] Parser support for [XXX] platform syntax
- [ ] Station grouping
- [ ] Create maps/03-platforms.map

## Phase 4: Signals
- [ ] Signal model (red/green, direction-facing)
- [ ] Auto-generate signals at segment boundaries
- [ ] Render signals as colored ● with labels
- [ ] Basic interlocking logic
- [ ] Create maps/04-signals.map

## Phase 5: Trains (Movement)
- [ ] Train model (ID, position, direction, speed, state)
- [ ] Simulation game loop (~16ms ticks)
- [ ] Train movement along segments
- [ ] Signal respect (stop at red)
- [ ] Platform dwell (15s default)
- [ ] Render trains as inverted text on track
- [ ] Create maps/05-trains.map

## Phase 6: Routes + Multi-Train Operation
- [ ] Route model (ordered platform list, cyclic)
- [ ] Multiple trains per route
- [ ] Direction reversal at endpoints
- [ ] Speed control (keyboard)
- [ ] Create maps/06-routes.map

## Phase 7: Switches (Branch + Crossover)
- [ ] Switch segment type
- [ ] Diagonal rendering (╲, ╱)
- [ ] Switch state + signal integration
- [ ] Parser support for switch syntax
- [ ] Create maps/07-switches.map

## Phase 8: Terminal Behavior
- [ ] End-of-line crossover logic
- [ ] Layover timer (60s default, configurable)
- [ ] Create maps/08-terminal.map

## Phase 9: Double Crossover + Advanced Switches
- [ ] Double crossover (X pattern)
- [ ] Branch switches
- [ ] Complex signal interlocking
- [ ] Create maps/09-advanced.map

## Phase 10: Polish + Special Features
- [ ] Arrival board
- [ ] Manual switch override
- [ ] Scrolling for large maps
- [ ] Status bar
- [ ] .map file error reporting
