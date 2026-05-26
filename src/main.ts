#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { Terminal } from './view/terminal.js';
import { InputHandler } from './view/input.js';
import { Renderer, type ArrivalRow } from './view/renderer.js';
import { parseMapFile } from './parser/parser.js';
import { TrackGraph } from './model/graph.js';
import { computeLayout } from './view/layout.js';
import { Simulation } from './model/simulation.js';
import { runDebug } from './debug.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Track2 — Subway Simulation");
  console.log("Usage: track2 [--debug [ticks]] <mapfile.map>");
  process.exit(0);
}

const debugIdx = args.indexOf('--debug');
const debugMode = debugIdx >= 0;
let debugTicks = 1000;
if (debugMode) {
  args.splice(debugIdx, 1);
  if (args.length > 0 && /^\d+$/.test(args[0])) {
    debugTicks = parseInt(args.shift()!, 10);
  }
}

const mapFile = args[0];

// Parse the map file
const source = readFileSync(mapFile, 'utf-8');
const mapData = parseMapFile(source);
const graph = TrackGraph.fromMapFile(mapData);

// Layout populates geometry-derived data on the model (e.g. switch conflict
// sets used by interlocking), so compute it before the simulation runs even
// in headless debug mode.
const layout = computeLayout(graph);

// Set up simulation
const sim = new Simulation(graph);
sim.setSpeed(mapData.config.speed);
if (graph.routes.length > 0) {
  sim.spawnRouteTrains();
} else {
  sim.spawnDefaultTrains('cyan');
}

if (debugMode) {
  runDebug(sim, graph, debugTicks);
  process.exit(0);
}
const terminal = new Terminal();
const renderer = new Renderer(terminal.screen);
renderer.setData(graph, layout);
const SCROLL_COLUMNS = 8;
const SCROLL_ROWS = 2;

const stationAbbrs = graph.stationAbbrsInOrder();
let arrivalStationIdx: number | null = null;

function destinationFor(train: typeof sim.trains[number]): string {
  if (!train.routeId) return '-';
  const route = graph.routes.find(r => r.name === train.routeId);
  if (!route || route.platformAbbrs.length === 0) return '-';
  return train.direction === 'east'
    ? route.platformAbbrs[route.platformAbbrs.length - 1]
    : route.platformAbbrs[0];
}

function computeArrivalRows(abbr: string): ArrivalRow[] {
  const rows: ArrivalRow[] = [];
  for (const train of sim.trains) {
    const eta = sim.estimateArrival(train, abbr);
    if (!eta) continue;
    rows.push({
      trainId: train.id,
      routeColor: train.color,
      direction: train.direction,
      destination: destinationFor(train),
      platformId: eta.platformId,
      etaSeconds: eta.etaSeconds,
    });
  }
  rows.sort((a, b) => a.etaSeconds - b.etaSeconds);
  return rows;
}

function draw(): void {
  renderer.setTrains(sim.trains);
  renderer.setSpeedDisplay(`${sim.currentSpeed.toFixed(2)}x`);
  if (arrivalStationIdx !== null && stationAbbrs.length > 0) {
    const abbr = stationAbbrs[arrivalStationIdx];
    renderer.setArrivalBoard(abbr, computeArrivalRows(abbr));
  } else {
    renderer.setArrivalBoard(null, []);
  }
  renderer.render();
  terminal.flush();
}

function shutdown(): void {
  sim.stop();
  input.stop();
  terminal.exit();
  process.exit(0);
}

const input = new InputHandler((key: string) => {
  if (key === 'q' || key === '\x03') {
    shutdown();
  } else if (key === '+' || key === '=') {
    sim.increaseSpeed();
  } else if (key === '-' || key === '_') {
    sim.decreaseSpeed();
  } else if (key === 'left') {
    renderer.scrollBy(-SCROLL_COLUMNS);
    draw();
  } else if (key === 'right') {
    renderer.scrollBy(SCROLL_COLUMNS);
    draw();
  } else if (key === 'up') {
    renderer.scrollVerticallyBy(-SCROLL_ROWS);
    draw();
  } else if (key === 'down') {
    renderer.scrollVerticallyBy(SCROLL_ROWS);
    draw();
  } else if (key === 'home') {
    renderer.scrollToStart();
    draw();
  } else if (key === 'end') {
    renderer.scrollToEnd();
    draw();
  } else if (key === 'a') {
    if (stationAbbrs.length === 0) return;
    arrivalStationIdx = arrivalStationIdx === null ? 0 : null;
    draw();
  } else if (key === '\x1b') {
    if (arrivalStationIdx !== null) {
      arrivalStationIdx = null;
      draw();
    }
  } else if (key === '[') {
    if (arrivalStationIdx === null || stationAbbrs.length === 0) return;
    arrivalStationIdx = (arrivalStationIdx - 1 + stationAbbrs.length) % stationAbbrs.length;
    draw();
  } else if (key === ']') {
    if (arrivalStationIdx === null || stationAbbrs.length === 0) return;
    arrivalStationIdx = (arrivalStationIdx + 1) % stationAbbrs.length;
    draw();
  }
});

// Start
terminal.enter();
input.start();
draw();

// Start simulation loop — redraws on each tick
sim.start(() => draw(), 60);

// Redraw on resize
process.stdout.on('resize', () => {
  draw();
});
