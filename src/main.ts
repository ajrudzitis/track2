#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseMapFile } from './parser/parser.js';
import { TrackGraph } from './model/graph.js';
import { computeLayout } from './view/layout.js';
import { Simulation } from './model/simulation.js';
import { runDebug } from './debug.js';
import { runSimulation } from './runtime.js';
import { NodeStdoutSink, NodeStdinSource } from './view/node-io.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Track2 — Subway Simulation');
  console.log('Usage: track2 [--debug [ticks]] <mapfile.map>');
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
const source = readFileSync(mapFile, 'utf-8');

if (debugMode) {
  // Layout populates geometry-derived data on the model (e.g. switch conflict
  // sets used by interlocking), so compute it before the simulation runs even
  // in headless debug mode.
  const mapData = parseMapFile(source);
  const graph = TrackGraph.fromMapFile(mapData);
  computeLayout(graph);
  const sim = new Simulation(graph);
  sim.setSpeed(mapData.config.speed);
  if (graph.routes.length > 0) {
    sim.spawnRouteTrains();
  } else {
    sim.spawnDefaultTrains('cyan');
  }
  runDebug(sim, graph, debugTicks);
  process.exit(0);
}

runSimulation({
  mapSource: source,
  output: new NodeStdoutSink(),
  input: new NodeStdinSource(),
  onQuit: () => process.exit(0),
});
