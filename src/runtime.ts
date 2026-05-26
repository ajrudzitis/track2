/**
 * Headless entry point: given a map source and a pair of I/O adapters,
 * runs the full TUI loop (parse, layout, simulate, render, route input).
 *
 * The Node CLI (`main.ts`) wires `NodeStdoutSink` + `NodeStdinSource`;
 * a browser host wires xterm.js adapters. Both call this function with
 * a map source string.
 */

import { Terminal } from './view/terminal.js';
import { InputHandler } from './view/input.js';
import { Renderer, type ArrivalRow } from './view/renderer.js';
import { parseMapFile } from './parser/parser.js';
import { TrackGraph } from './model/graph.js';
import { computeLayout } from './view/layout.js';
import { Simulation } from './model/simulation.js';
import type { OutputSink, InputSource } from './view/io.js';

const SCROLL_COLUMNS = 8;
const SCROLL_ROWS = 2;

export interface RunOptions {
  mapSource: string;
  output: OutputSink;
  input: InputSource;
  /** Invoked when the user quits (q or Ctrl+C). The runtime has already
   *  stopped the sim, stopped input, and called `output.exit()` by then. */
  onQuit?: () => void;
  /** Simulation tick interval in milliseconds. Defaults to 60. */
  tickMs?: number;
}

export interface SimulationHandle {
  /** Stop the sim and tear down terminal state. Does not invoke `onQuit`. */
  stop(): void;
}

export function runSimulation(opts: RunOptions): SimulationHandle {
  const { mapSource, output, input, onQuit, tickMs = 60 } = opts;

  const mapData = parseMapFile(mapSource);
  const graph = TrackGraph.fromMapFile(mapData);
  const layout = computeLayout(graph);

  const sim = new Simulation(graph);
  sim.setSpeed(mapData.config.speed);
  if (graph.routes.length > 0) {
    sim.spawnRouteTrains();
  } else {
    sim.spawnDefaultTrains('cyan');
  }

  const terminal = new Terminal(output);
  const renderer = new Renderer(terminal.screen);
  renderer.setData(graph, layout);

  const stationAbbrs = graph.stationAbbrsInOrder();
  let arrivalStationIdx: number | null = null;

  function destinationFor(train: typeof sim.trains[number]): string {
    if (!train.routeId) return '-';
    const route = graph.routes.find((r) => r.name === train.routeId);
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

  function formatClock(seconds: number): string {
    const s = Math.floor(seconds);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return hh > 0
      ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
      : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  function draw(): void {
    renderer.setTrains(sim.trains);
    renderer.setSpeedDisplay(`${sim.currentSpeed.toFixed(2)}x`);
    renderer.setSimClock(formatClock(sim.simElapsedSeconds));
    if (arrivalStationIdx !== null && stationAbbrs.length > 0) {
      const abbr = stationAbbrs[arrivalStationIdx];
      renderer.setArrivalBoard(abbr, computeArrivalRows(abbr));
    } else {
      renderer.setArrivalBoard(null, []);
    }
    renderer.render();
    terminal.flush();
  }

  let stopped = false;
  function shutdown(triggerQuit: boolean): void {
    if (stopped) return;
    stopped = true;
    sim.stop();
    inputHandler.stop();
    terminal.exit();
    if (triggerQuit) onQuit?.();
  }

  const inputHandler = new InputHandler(input, (key: string) => {
    if (key === 'q' || key === '\x03') {
      shutdown(true);
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
      let changed = false;
      if (renderer.isHelpOpen()) {
        renderer.setHelpOpen(false);
        changed = true;
      }
      if (arrivalStationIdx !== null) {
        arrivalStationIdx = null;
        changed = true;
      }
      if (changed) draw();
    } else if (key === 'h') {
      renderer.setHelpOpen(!renderer.isHelpOpen());
      draw();
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

  terminal.enter();
  inputHandler.start();
  terminal.onResize(() => draw());
  draw();

  sim.start(() => draw(), tickMs);

  return { stop: () => shutdown(false) };
}
