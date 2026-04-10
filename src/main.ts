#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { Terminal } from './view/terminal.js';
import { InputHandler } from './view/input.js';
import { Renderer } from './view/renderer.js';
import { parseMapFile } from './parser/parser.js';
import { TrackGraph } from './model/graph.js';
import { computeLayout } from './view/layout.js';
import { Simulation } from './model/simulation.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Track2 — Subway Simulation");
  console.log("Usage: track2 <mapfile.map>");
  process.exit(0);
}

const mapFile = args[0];

// Parse the map file
const source = readFileSync(mapFile, 'utf-8');
const mapData = parseMapFile(source);
const graph = TrackGraph.fromMapFile(mapData);
const layout = computeLayout(graph);

const terminal = new Terminal();
const renderer = new Renderer(terminal.screen);
renderer.setData(graph, layout);

// Set up simulation
const sim = new Simulation(graph);
sim.setSpeed(mapData.config.speed);
if (graph.routes.length > 0) {
  sim.spawnRouteTrains();
} else {
  sim.spawnDefaultTrains('cyan');
}

function draw(): void {
  renderer.setTrains(sim.trains);
  renderer.setSpeedDisplay(`${sim.currentSpeed.toFixed(2)}x`);
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
