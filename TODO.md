# Track2 TODO

## Phase 0: Project Setup
- [x] Create package.json, tsconfig.json, .gitignore
- [x] Set up directory structure (src/, maps/)
- [x] Create stub main.ts
- [x] Create README.md, AGENT.md, TODO.md

## Phase 1: Terminal Control + Basic Track Rendering
- [x] Implement terminal.ts (raw mode, alternate screen, ANSI helpers, screen buffer)
- [x] Implement input.ts (keyboard handling, q to quit)
- [x] Implement renderer.ts (draw horizontal tracks with ━)
- [x] Demo: TUI shows two parallel tracks, q exits cleanly

## Phase 2: .map Parser + Segments
- [x] Implement tokenizer and parser for trackgroup blocks
- [x] Implement segment model and track graph
- [x] Implement layout algorithm (linear horizontal)
- [x] Render segment labels in muted gray
- [x] Render tick marks at segment boundaries
- [x] Create maps/02-segments.map

## Phase 3: Platforms + Stations
- [x] Platform model (3-char abbreviation, colored background)
- [x] Parser support for [XXX] platform syntax
- [x] Parser support for north:/south: direction aliases
- [x] Create maps/03-platforms.map (Seattle 1 Line stations)

## Phase 4: Signals
- [x] Signal model (red/green, direction-facing)
- [x] Auto-generate signals at segment boundaries
- [x] Render signals as colored ● below track with labels
- [x] Signal pairs straddle boundary tick marks
- [x] Create maps/04-signals.map
- [ ] Basic interlocking logic (deferred to Phase 5 when trains exist)

## Phase 5: Trains (Movement)
- [x] Train model (ID, position, direction, speed, state)
- [x] Simulation game loop (~60ms ticks)
- [x] Train movement along segments
- [x] Signal respect (stop at red)
- [x] Platform dwell (configurable, default 15s)
- [x] Render trains as inverted text on track
- [x] Direction reversal at track ends (no switches yet)
- [x] Speed control (+/- keys, 0.25x–4.0x)
- [x] Signal interlocking (red when segment occupied)
- [x] Create maps/05-trains.map

## Phase 6: Routes + Multi-Train Operation
- [x] Route model (ordered platform list, cyclic)
- [x] Multiple trains per route
- [x] Direction reversal at endpoints
- [x] Speed control (keyboard)
- [x] Create maps/06-routes.map

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
