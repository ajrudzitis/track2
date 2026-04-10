/**
 * Parser for .map files. Block-oriented: config...end, trackgroup...end, route...end.
 */

import type { MapFile, MapConfig, TrackGroupDef, TrackElement, RouteDef, SwitchDef } from './types.js';

const DEFAULT_CONFIG: MapConfig = {
  speed: 1.0,
  dwell: 15,
  layover: 60,
};

export function parseMapFile(source: string): MapFile {
  const lines = source.split('\n');
  const result: MapFile = {
    config: { ...DEFAULT_CONFIG },
    trackGroups: [],
    routes: [],
    switches: [],
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === '' || line.startsWith('%%')) {
      i++;
      continue;
    }

    if (line === 'config') {
      const [config, next] = parseConfigBlock(lines, i + 1);
      result.config = { ...DEFAULT_CONFIG, ...config };
      i = next;
    } else if (line.startsWith('trackgroup ')) {
      const name = line.slice('trackgroup '.length).trim();
      const [group, next] = parseTrackGroupBlock(name, lines, i + 1);
      result.trackGroups.push(group);
      i = next;
    } else if (line.startsWith('route ')) {
      const name = line.slice('route '.length).trim();
      const [route, next] = parseRouteBlock(name, lines, i + 1);
      result.routes.push(route);
      i = next;
    } else if (line === 'switches') {
      const [sws, next] = parseSwitchesBlock(lines, i + 1);
      result.switches = sws;
      i = next;
    } else {
      i++;
    }
  }

  return result;
}

function parseSwitchesBlock(lines: string[], start: number): [SwitchDef[], number] {
  const switches: SwitchDef[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === 'end') return [switches, i + 1];
    if (line === '' || line.startsWith('%%')) { i++; continue; }

    // Parse sw1 -> sw2
    const parts = line.split('->').map(s => s.trim());
    if (parts.length === 2) {
      switches.push({ from: parts[0], to: parts[1] });
    }
    i++;
  }
  return [switches, i];
}

function parseConfigBlock(lines: string[], start: number): [Partial<MapConfig>, number] {
  const config: Partial<MapConfig> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === 'end') return [config, i + 1];

    const [key, value] = splitKV(line);
    if (key === 'speed') config.speed = parseFloat(value);
    else if (key === 'dwell') config.dwell = parseTime(value);
    else if (key === 'layover') config.layover = parseTime(value);

    i++;
  }
  return [config, i];
}

function parseTrackGroupBlock(name: string, lines: string[], start: number): [TrackGroupDef, number] {
  const group: TrackGroupDef = { name, westTrack: [], eastTrack: [] };
  let i = start;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === 'end') return [group, i + 1];

    if (line.startsWith('west:') || line.startsWith('north:')) {
      const prefix = line.startsWith('west:') ? 'west:' : 'north:';
      group.westTrack = parseTrackLine(line.slice(prefix.length).trim());
    } else if (line.startsWith('east:') || line.startsWith('south:')) {
      const prefix = line.startsWith('east:') ? 'east:' : 'south:';
      group.eastTrack = parseTrackLine(line.slice(prefix.length).trim());
    }

    i++;
  }
  return [group, i];
}

function parseTrackLine(line: string): TrackElement[] {
  const elements: TrackElement[] = [];
  // Match [PLATFORM_ID], ---segment_id---, and <switch_id> patterns
  const tokens = line.match(/\[[^\]]+\]|---[^-]+---|<[^>]+>/g) || [];
  for (const token of tokens) {
    const t = token.trim();
    if (t.startsWith('[') && t.endsWith(']')) {
      elements.push({ type: 'platform', id: t.slice(1, -1) });
    } else if (t.startsWith('---') && t.endsWith('---')) {
      elements.push({ type: 'segment', id: t.slice(3, -3) });
    } else if (t.startsWith('<') && t.endsWith('>')) {
      elements.push({ type: 'switch', id: t.slice(1, -1) });
    }
  }
  return elements;
}

function parseRouteBlock(name: string, lines: string[], start: number): [RouteDef, number] {
  const route: RouteDef = { name, color: '#ffffff', platforms: [], trainCount: 0, trainIds: [] };
  let i = start;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === 'end') return [route, i + 1];

    const [key, value] = splitKV(line);
    if (key === 'color') route.color = value;
    else if (key === 'platforms') route.platforms = value.split(',').map(s => s.trim());
    else if (key === 'trains') route.trainCount = parseInt(value, 10);
    else if (key === 'ids') route.trainIds = value.split(',').map(s => s.trim());
    else if (key === 'trackgroup') route.trackGroupName = value;

    i++;
  }
  return [route, i];
}

function splitKV(line: string): [string, string] {
  const idx = line.indexOf(':');
  if (idx < 0) return [line, ''];
  return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
}

function parseTime(value: string): number {
  value = value.trim();
  if (value.endsWith('s')) return parseFloat(value.slice(0, -1));
  if (value.endsWith('m')) return parseFloat(value.slice(0, -1)) * 60;
  return parseFloat(value);
}
