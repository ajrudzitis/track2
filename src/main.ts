#!/usr/bin/env node

import { Terminal } from './view/terminal.js';
import { InputHandler } from './view/input.js';
import { Renderer } from './view/renderer.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Track2 — Subway Simulation");
  console.log("Usage: track2 <mapfile.map>");
  process.exit(0);
}

const mapFile = args[0];

const terminal = new Terminal();
const renderer = new Renderer(terminal.screen);

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
  if (key === 'q' || key === '\x03') { // q or Ctrl-C
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
