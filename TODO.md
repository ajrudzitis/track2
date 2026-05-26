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
- [x] Basic interlocking logic (implemented with train occupancy in Phase 5)

## Phase 5: Trains (Movement)
- [x] Train model (ID, position, direction, speed, state)
- [x] Simulation game loop (~60ms ticks)
- [x] Train movement along segments
- [x] Signal respect (stop at red)
- [x] Platform dwell (configurable, default 15s)
- [x] Render trains as inverted text on track
- [x] Direction reversal at track ends (no switches yet)
- [x] Speed control (+/- keys, 0.25x–4.0x)
- [x] Signal interlocking (red when segment occupied; completes basic interlocking deferred from Phase 4)
- [x] Create maps/05-trains.map

## Phase 6: Routes + Multi-Train Operation
- [x] Route model (ordered platform list, cyclic)
- [x] Multiple trains per route
- [x] Direction reversal at endpoints
- [x] Reject unsupported mid-line route turnbacks
- [x] Speed control (keyboard)
- [x] Create maps/06-routes.map

## Phase 7: Switches (Branch + Crossover)
- [x] Switch segment type
- [x] Diagonal rendering (╲, ╱)
- [x] Switch state + signal integration
- [x] Parser support for switch syntax
- [x] Create maps/07-switches.map

## Phase 8: Terminal Behavior
- [x] End-of-line crossover logic (terminus targets the natural outbound-track platform; falls back to same-track if occupied)
- [x] Layover timer (configurable per route, falls back to config layover, then 60s)
- [x] Create maps/08-terminal.map

## Fast follow
- [x] Horizontal scrolling for maps wider than the terminal (Left/Right pan, Home/End jump)
- [x] Create maps/08b-scrolling.map

## Phase 9: Double Crossover + Advanced Switches
- [x] Double crossover (X pattern)
- [x] Branch switches
- [x] Routes spanning separate track groups with unique station abbreviations
- [x] Complex signal interlocking (scoped to chain reservation + 3-aspect;
      further conflict-route prevention judged covered by existing lock and
      conflict-segment logic plus yellow caution)
  - [x] Multi-switch chain reservation (atomic all-or-nothing along adjacent
        switch chain; train waits at entry signal if any link is held)
  - [x] Demo map: maps/09b-chain.map
  - [x] 3-aspect signals: yellow caution when next signal is red (arrow
        signals at switches keep their glyph, just tinted yellow)
  - [x] Demo map: maps/09c-aspects.map
- [x] Create maps/09-advanced.map

## Phase 10: Polish + Special Features
- [x] Arrival board: per-station overlay, `a` toggle, `[`/`]` cycle, `Esc`
      close. Highlights selected station's platforms. ETAs are route-aware
      (walker mirrors autorouter switch decisions) so trains needing future
      diverts are included.
- [ ] Manual switch override
- [x] Scrolling for large maps (horizontal: ←/→ Home/End was done in
      fast-follow; vertical: ↑/↓ added now, status bar surfaces the visible
      row range when scroll is active)
- [ ] Status bar
- [x] Basic .map file error reporting
- [x] Smooth cross-group diagonals. Branch-target trackgroup offset now
      requires dx >= dy, so the diagonal always renders at <=45° (one column
      per row) instead of stacking ╲ glyphs vertically.
