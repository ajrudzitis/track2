#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { Terminal } from './view/terminal.js';
import { InputHandler } from './view/input.js';
import { Renderer } from './view/renderer.js';
import { parseMapFile } from './parser/parser.js';
import { TrackGraph } from './model/graph.js';
import { computeLayout } from './view/layout.js';

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

function draw(): void {
  renderer.render();
  terminal.flush();
}

function shutdown(): void {
  input.stop();
  terminal.exit();
  process.exit(0);
}

const input = new InputHandler((key: string) => {
  if (key === 'q' || key === '\x03') {
    shutdown();
  }
});

// Start
terminal.enter();
input.start();
draw();

// Redraw on resize
process.stdout.on('resize', () => {
  draw();
});
