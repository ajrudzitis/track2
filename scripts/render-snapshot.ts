// Dump a plain-text snapshot of the rendered map (no ANSI, no animation).
// Usage: tsx scripts/render-snapshot.ts <map>

import { readFileSync } from 'node:fs';
import { ScreenBuffer } from '../src/view/terminal.js';
import { Renderer } from '../src/view/renderer.js';
import { parseMapFile } from '../src/parser/parser.js';
import { TrackGraph } from '../src/model/graph.js';
import { computeLayout } from '../src/view/layout.js';
import { Simulation } from '../src/model/simulation.js';

const mapPath = process.argv[2];
if (!mapPath) {
  console.error('usage: tsx scripts/render-snapshot.ts <map>');
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
renderer.render();

for (let y = 0; y < screen.height; y++) {
  let line = '';
  for (let x = 0; x < screen.width; x++) {
    line += screen.cells[y][x].char;
  }
  console.log(line.trimEnd());
}
