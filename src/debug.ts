/**
 * Headless debug runner: ticks the simulation and dumps train, switch, and signal
 * state to stdout. Use via `track2 --debug [ticks] <mapfile.map>` to investigate
 * deadlocks or routing bugs without needing the TUI.
 */

import type { Simulation } from './model/simulation.js';
import type { TrackGraph } from './model/graph.js';
import type { Switch } from './model/types.js';

const SNAPSHOT_INTERVAL = 40;
const TICK_DT_SECONDS = 0.06;

export function runDebug(sim: Simulation, graph: TrackGraph, totalTicks: number): void {
  const switchIds = [...graph.segments.values()]
    .filter(s => s.type === 'switch')
    .map(s => s.id);

  const visited: Record<string, Set<string>> = {};
  for (const t of sim.trains) visited[t.id] = new Set([t.segmentId]);

  snapshot(sim, switchIds, graph, 'spawn');
  for (let tick = 1; tick <= totalTicks; tick++) {
    (sim as unknown as { tick: (dt: number) => void }).tick(TICK_DT_SECONDS);
    for (const t of sim.trains) visited[t.id].add(t.segmentId);
    if (tick % SNAPSHOT_INTERVAL === 0) {
      snapshot(sim, switchIds, graph, `tick ${tick} (sim time ~${(tick * TICK_DT_SECONDS * sim.currentSpeed).toFixed(0)}s)`);
    }
  }

  console.log('\n=== Coverage ===');
  for (const t of sim.trains) {
    console.log(`  ${t.id.padEnd(5)}  visited ${String(visited[t.id].size).padStart(3)} segments`);
  }
}

function snapshot(sim: Simulation, switchIds: string[], graph: TrackGraph, label: string): void {
  console.log(`\n--- ${label} ---`);
  for (const t of sim.trains) {
    const route = t.routeId ?? '-';
    console.log(`  ${t.id.padEnd(5)} seg=${t.segmentId.padEnd(7)} pos=${t.position.toFixed(2)} ${t.direction.padEnd(4)} state=${t.state.padEnd(8)} route=${route} lastPlat=${t.lastPlatformIndex ?? '-'}`);
  }
  for (const id of switchIds) {
    const sw = graph.segments.get(id) as Switch | undefined;
    if (!sw) continue;
    console.log(`    ${id.padEnd(5)} state=${sw.state.padEnd(9)} lockedBy=${sw.lockedBy ?? '-'}`);
  }
}
