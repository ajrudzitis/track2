// Dump a plain-text snapshot of the rendered map (no ANSI, no animation).
// Usage: tsx scripts/render-snapshot.ts <map> [--arrivals STATION]

import { readFileSync } from 'node:fs';
import { ScreenBuffer } from '../src/view/terminal.js';
import { Renderer, type ArrivalRow } from '../src/view/renderer.js';
import { parseMapFile } from '../src/parser/parser.js';
import { TrackGraph } from '../src/model/graph.js';
import { computeLayout } from '../src/view/layout.js';
import { Simulation } from '../src/model/simulation.js';

const args = process.argv.slice(2);
const arrivalsIdx = args.indexOf('--arrivals');
const arrivalsStation = arrivalsIdx >= 0 ? args.splice(arrivalsIdx, 2)[1] : null;
const mapPath = args[0];
if (!mapPath) {
  console.error('usage: tsx scripts/render-snapshot.ts <map> [--arrivals STATION]');
  process.exit(1);
}

const source = readFileSync(mapPath, 'utf-8');
const mapData = parseMapFile(source);
const graph = TrackGraph.fromMapFile(mapData);
const layout = computeLayout(graph);

const sim = new Simulation(graph);
sim.setSpeed(mapData.config.speed);
if (graph.routes.length > 0) sim.spawnRouteTrains();

const screen = new ScreenBuffer(Math.max(120, layout.contentWidth + 4), 30);
const renderer = new Renderer(screen);
renderer.setData(graph, layout);
renderer.setTrains(sim.trains);
if (arrivalsStation) {
  const rows: ArrivalRow[] = [];
  for (const t of sim.trains) {
    const eta = sim.estimateArrival(t, arrivalsStation);
    if (!eta) continue;
    const route = t.routeId ? graph.routes.find(r => r.name === t.routeId) : undefined;
    const destination = route
      ? (t.direction === 'east' ? route.platformAbbrs[route.platformAbbrs.length - 1] : route.platformAbbrs[0])
      : '-';
    rows.push({ trainId: t.id, routeColor: t.color, direction: t.direction, destination, platformId: eta.platformId, etaSeconds: eta.etaSeconds });
  }
  rows.sort((a, b) => a.etaSeconds - b.etaSeconds);
  renderer.setArrivalBoard(arrivalsStation, rows);
}
renderer.render();

for (let y = 0; y < screen.height; y++) {
  let line = '';
  for (let x = 0; x < screen.width; x++) {
    line += screen.cells[y][x].char;
  }
  console.log(line.trimEnd());
}
