#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Track2 — Subway Simulation");
  console.log("Usage: track2 <mapfile.map>");
  process.exit(0);
}

const mapFile = args[0];
console.log(`Loading map: ${mapFile}`);
console.log("Track2 is under construction. Stay tuned!");
