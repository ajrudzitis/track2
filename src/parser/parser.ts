/**
 * Parser for .map files. Block-oriented: config...end, trackgroup...end, route...end.
 */

import type { MapFile, MapConfig, TrackGroupDef, TrackElement, RouteDef, SwitchDef } from './types.js';

const DEFAULT_CONFIG: MapConfig = {
  speed: 1.0,
  dwell: 15,
};

export class MapParseError extends Error {
  constructor(message: string, lineNumber?: number) {
    super(lineNumber ? `Line ${lineNumber}: ${message}` : message);
    this.name = 'MapParseError';
  }
}

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
      throw new MapParseError(`Unexpected top-level line "${line}"`, i + 1);
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

    // Parse sw1 <-> sw2 or sw1 -> sw2
    if (line.includes('<->')) {
      const [from, to] = parseSwitchLink(line, '<->', i + 1);
      switches.push({ from, to, bidirectional: true });
    } else if (line.includes('->')) {
      const [from, to] = parseSwitchLink(line, '->', i + 1);
      switches.push({ from, to });
    } else {
      throw new MapParseError(`Invalid switch link "${line}"`, i + 1);
    }
    i++;
  }
  throw new MapParseError('Unterminated switches block');
}

function parseConfigBlock(lines: string[], start: number): [Partial<MapConfig>, number] {
  const config: Partial<MapConfig> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === 'end') return [config, i + 1];
    if (line === '' || line.startsWith('%%')) { i++; continue; }

    const [key, value] = splitKV(line, i + 1);
    if (key === 'speed') config.speed = parseNumber(value, 'speed', i + 1);
    else if (key === 'dwell') config.dwell = parseTime(value, 'dwell', i + 1);
    else if (key === 'layover') config.layover = parseTime(value, 'layover', i + 1);
    else throw new MapParseError(`Unknown config key "${key}"`, i + 1);

    i++;
  }
  throw new MapParseError('Unterminated config block');
}

function parseTrackGroupBlock(name: string, lines: string[], start: number): [TrackGroupDef, number] {
  const group: TrackGroupDef = { name, westTrack: [], eastTrack: [] };
  let i = start;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === 'end') return [group, i + 1];
    if (line === '' || line.startsWith('%%')) { i++; continue; }

    if (line.startsWith('west:') || line.startsWith('north:')) {
      const prefix = line.startsWith('west:') ? 'west:' : 'north:';
      group.westTrack = parseTrackLine(line.slice(prefix.length).trim(), i + 1);
    } else if (line.startsWith('east:') || line.startsWith('south:')) {
      const prefix = line.startsWith('east:') ? 'east:' : 'south:';
      group.eastTrack = parseTrackLine(line.slice(prefix.length).trim(), i + 1);
    } else {
      throw new MapParseError(`Unknown trackgroup line "${line}"`, i + 1);
    }

    i++;
  }
  throw new MapParseError(`Unterminated trackgroup "${name}" block`);
}

function parseTrackLine(line: string, lineNumber: number): TrackElement[] {
  const elements: TrackElement[] = [];
  const tokenRegex = /\s*(\[[^\]]+\]|---[^-]+---|<[^>]+>)/gy;
  let index = 0;

  while (index < line.length) {
    tokenRegex.lastIndex = index;
    const match = tokenRegex.exec(line);
    if (!match) {
      if (line.slice(index).trim() === '') break;
      throw new MapParseError(`Invalid track token near "${line.slice(index).trim()}"`, lineNumber);
    }

    const t = match[1].trim();
    if (t.startsWith('[') && t.endsWith(']')) {
      elements.push({ type: 'platform', id: parseId(t.slice(1, -1), 'platform', lineNumber) });
    } else if (t.startsWith('---') && t.endsWith('---')) {
      elements.push({ type: 'segment', id: parseId(t.slice(3, -3), 'segment', lineNumber) });
    } else if (t.startsWith('<') && t.endsWith('>')) {
      elements.push({ type: 'switch', id: parseId(t.slice(1, -1), 'switch', lineNumber) });
    }
    index = tokenRegex.lastIndex;
  }

  if (elements.length === 0) {
    throw new MapParseError('Track line must contain at least one element', lineNumber);
  }

  return elements;
}

function parseRouteBlock(name: string, lines: string[], start: number): [RouteDef, number] {
  const route: RouteDef = { name, color: 'cyan', platforms: [], trainCount: 0, trainIds: [] };
  let i = start;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === 'end') return [route, i + 1];
    if (line === '' || line.startsWith('%%')) { i++; continue; }

    const [key, value] = splitKV(line, i + 1);
    if (key === 'color') route.color = value;
    else if (key === 'platforms') route.platforms = parseList(value, 'platforms', i + 1);
    else if (key === 'trains') route.trainCount = parseTrainCount(value, i + 1);
    else if (key === 'ids') route.trainIds = value === '' ? [] : parseList(value, 'ids', i + 1);
    else if (key === 'trackgroup') route.trackGroupName = value;
    else if (key === 'layover') route.layover = parseTime(value, 'layover', i + 1);
    else throw new MapParseError(`Unknown route key "${key}"`, i + 1);

    i++;
  }
  throw new MapParseError(`Unterminated route "${name}" block`);
}

function splitKV(line: string, lineNumber: number): [string, string] {
  const idx = line.indexOf(':');
  if (idx < 0) throw new MapParseError(`Expected key/value line with ":" in "${line}"`, lineNumber);
  return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
}

function parseTime(value: string, fieldName: string, lineNumber: number): number {
  value = value.trim();
  const multiplier = value.endsWith('m') ? 60 : 1;
  const numberText = value.endsWith('s') || value.endsWith('m') ? value.slice(0, -1) : value;
  return parseNumber(numberText, fieldName, lineNumber) * multiplier;
}

function parseNumber(value: string, fieldName: string, lineNumber: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new MapParseError(`Invalid ${fieldName} value "${value}"`, lineNumber);
  }
  return num;
}

function parseTrainCount(value: string, lineNumber: number): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new MapParseError(`Invalid trains value "${value}"`, lineNumber);
  }
  return count;
}

function parseList(value: string, fieldName: string, lineNumber: number): string[] {
  const items = value.split(',').map(s => s.trim()).filter(Boolean);
  if (items.length === 0) {
    throw new MapParseError(`Field "${fieldName}" must include at least one value`, lineNumber);
  }
  return items;
}

function parseId(value: string, idKind: string, lineNumber: number): string {
  const id = value.trim();
  if (id === '') {
    throw new MapParseError(`Empty ${idKind} id`, lineNumber);
  }
  return id;
}

function parseSwitchLink(line: string, operator: string, lineNumber: number): [string, string] {
  const parts = line.split(operator).map(s => s.trim());
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    throw new MapParseError(`Invalid switch link "${line}"`, lineNumber);
  }
  return [parts[0], parts[1]];
}
