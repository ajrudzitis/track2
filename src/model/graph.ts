/**
 * Track topology graph built from parsed map data.
 */

import type { MapFile, SwitchDef } from '../parser/types.js';
import type { Segment, Platform, Switch, TrackGroup, Route } from './types.js';
import { ANSI_COLORS } from './types.js';
import { type Signal, generateSignals } from './signal.js';

const DEFAULT_SEGMENT_WIDTH = 16;
const DEFAULT_LAYOVER_SECONDS = 60;

export class TrackGraph {
  segments: Map<string, Segment> = new Map();
  signals: Signal[] = [];
  trackGroups: TrackGroup[] = [];
  routes: Route[] = [];

  static fromMapFile(mapFile: MapFile): TrackGraph {
    const graph = new TrackGraph();

    for (const groupDef of mapFile.trackGroups) {
      const tg: TrackGroup = {
        name: groupDef.name,
        westSegments: [],
        eastSegments: [],
      };

      // Build west track segments
      for (const elem of groupDef.westTrack) {
        let seg: Segment;
        if (elem.type === 'platform') {
          seg = graph.createPlatform(elem.id, groupDef.name, 'west', mapFile.config.dwell);
        } else if (elem.type === 'switch') {
          seg = graph.createSwitch(elem.id, groupDef.name, 'west');
        } else {
          seg = graph.createSegment(elem.id, 'plain', groupDef.name, 'west');
        }
        tg.westSegments.push(seg.id);
      }

      // Build east track segments
      for (const elem of groupDef.eastTrack) {
        let seg: Segment;
        if (elem.type === 'platform') {
          seg = graph.createPlatform(elem.id, groupDef.name, 'east', mapFile.config.dwell);
        } else if (elem.type === 'switch') {
          seg = graph.createSwitch(elem.id, groupDef.name, 'east');
        } else {
          seg = graph.createSegment(elem.id, 'plain', groupDef.name, 'east');
        }
        tg.eastSegments.push(seg.id);
      }

      // Link segments in sequence
      graph.linkSequence(tg.westSegments);
      graph.linkSequence(tg.eastSegments);

      // Auto-generate signals at segment boundaries
      graph.signals.push(...generateSignals(tg.westSegments, groupDef.name, 'west'));
      graph.signals.push(...generateSignals(tg.eastSegments, groupDef.name, 'east'));

      graph.trackGroups.push(tg);
    }

    graph.linkSwitches(mapFile.switches);
    graph.collapseJunctions();
    graph.resolveRoutes(mapFile);

    return graph;
  }

  /**
   * A switch with exactly one path on each side. It can be locked and traversed
   * but offers no routing choice, so the layout collapses it to a 1-column anchor
   * where an incoming cross-group diagonal lands flush with the next regular segment.
   */
  static isJunction(sw: Switch): boolean {
    const westPaths = (sw.prev ? 1 : 0) + (sw.divergingPrev ? 1 : 0);
    const eastPaths = (sw.next ? 1 : 0) + (sw.divergingNext ? 1 : 0);
    return westPaths === 1 && eastPaths === 1;
  }

  private collapseJunctions(): void {
    for (const seg of this.segments.values()) {
      if (seg.type === 'switch' && TrackGraph.isJunction(seg as Switch)) {
        seg.displayWidth = 1;
      }
    }
  }

  private linkSwitches(switchDefs: SwitchDef[]): void {
    for (const def of switchDefs) {
      const from = this.requireSwitch(def.from, 'switch link source');
      const to = this.requireSwitch(def.to, 'switch link target');

      // Link them as a diagonal connection.
      // from -> to represents an Eastbound crossover path.
      from.divergingNext = to.id;
      to.divergingPrev = from.id;

      if (def.bidirectional) {
        // Also link the other diagonal for Westbound crossover path.
        to.divergingNext = from.id;
        from.divergingPrev = to.id;
      }
    }
  }

  private resolveRoutes(mapFile: MapFile): void {
    for (const routeDef of mapFile.routes) {
      if (routeDef.platforms.length < 2) {
        throw new Error(`Route "${routeDef.name}" must include at least two platforms`);
      }

      if (routeDef.trackGroupName && !this.trackGroups.some(t => t.name === routeDef.trackGroupName)) {
        throw new Error(`Route "${routeDef.name}" references unknown trackgroup "${routeDef.trackGroupName}"`);
      }
      if (!(routeDef.color in ANSI_COLORS)) {
        throw new Error(`Route "${routeDef.name}" references unknown color "${routeDef.color}"`);
      }

      const route: Route = {
        name: routeDef.name,
        color: ANSI_COLORS[routeDef.color],
        platformAbbrs: routeDef.platforms,
        trackGroupName: routeDef.trackGroupName,
        trainIds: routeDef.trainIds,
        trainCount: routeDef.trainCount,
        layover: routeDef.layover ?? mapFile.config.layover ?? DEFAULT_LAYOVER_SECONDS,
      };
      this.validateRoutePlatforms(route);
      this.validateRouteTurnbacks(route);
      this.routes.push(route);
    }
  }

  private requireSwitch(id: string, context: string): Switch {
    const seg = this.segments.get(id);
    if (!seg) {
      throw new Error(`Unknown switch "${id}" referenced as ${context}`);
    }
    if (seg.type !== 'switch') {
      throw new Error(`Segment "${id}" referenced as ${context} is a ${seg.type}, not a switch`);
    }
    return seg as Switch;
  }

  private validateRoutePlatforms(route: Route): void {
    for (const abbr of route.platformAbbrs) {
      const platforms = this.getStationPlatforms(abbr, route.trackGroupName);
      if (platforms.length === 0) {
        const suffix = route.trackGroupName ? ` in trackgroup "${route.trackGroupName}"` : '';
        throw new Error(
          `Route "${route.name}" references unknown platform abbreviation "${abbr}"${suffix}`
        );
      }
      if (!route.trackGroupName && this.trackGroupsForStation(abbr).length > 1) {
        throw new Error(
          `Route "${route.name}" references ambiguous platform abbreviation "${abbr}". ` +
          'Add trackgroup: to constrain the route, or use unique station abbreviations across trackgroups.'
        );
      }
    }
  }

  private validateRouteTurnbacks(route: Route): void {
    if (route.platformAbbrs.length < 2) {
      throw new Error(`Route "${route.name}" must include at least two platforms`);
    }

    const endpoints = [
      route.platformAbbrs[0],
      route.platformAbbrs[route.platformAbbrs.length - 1],
    ];

    for (const abbr of endpoints) {
      if (!this.isPhysicalTerminusStation(abbr, route.trackGroupName)) {
        throw new Error(
          `Route "${route.name}" endpoint "${abbr}" is not a supported turnback. ` +
          'Route endpoints must be at the physical end of a track until explicit turnback tracks are supported.'
        );
      }
    }
  }

  private isPhysicalTerminusStation(abbr: string, trackGroupName?: string): boolean {
    const platformIds = this.getStationPlatforms(abbr, trackGroupName);
    return platformIds.length > 0 && platformIds.every(id => this.isPhysicalEndSegment(id));
  }

  private isPhysicalEndSegment(segmentId: string): boolean {
    const seg = this.segments.get(segmentId);
    if (!seg) return false;

    const tg = this.trackGroups.find(t => t.name === seg.trackGroupName);
    if (!tg) return false;

    const segmentIds = seg.trackDirection === 'west' ? tg.westSegments : tg.eastSegments;
    return segmentIds[0] === segmentId || segmentIds[segmentIds.length - 1] === segmentId;
  }

  /**
   * Find the segment ID for a platform with the given abbreviation on a specific track.
   */
  findPlatformOnTrack(abbr: string, trackGroupName: string | undefined, trackDirection: 'west' | 'east'): string | undefined {
    for (const tg of this.trackGroups) {
      if (trackGroupName && tg.name !== trackGroupName) continue;
      const segmentIds = trackDirection === 'west' ? tg.westSegments : tg.eastSegments;
      for (const id of segmentIds) {
        const seg = this.segments.get(id);
        if (seg?.type === 'platform' && (seg as Platform).stationAbbr === abbr) {
          return id;
        }
      }
    }
    return undefined;
  }

  /**
   * Find the segment ID for a platform with the given abbreviation on ANY track within a track group.
   */
  findPlatformInGroup(abbr: string, trackGroupName: string): string | undefined {
    return this.findPlatformOnTrack(abbr, trackGroupName, 'west') ||
           this.findPlatformOnTrack(abbr, trackGroupName, 'east');
  }

  /**
   * All platforms with this abbreviation in the given trackgroup. Platforms that share
   * an abbreviation are treated as the platforms of one station.
   */
  getStationPlatformsInGroup(abbr: string, trackGroupName: string): string[] {
    return this.getStationPlatforms(abbr, trackGroupName);
  }

  getStationPlatforms(abbr: string, trackGroupName?: string): string[] {
    const ids: string[] = [];
    for (const tg of this.trackGroups) {
      if (trackGroupName && tg.name !== trackGroupName) continue;
      const west = this.findPlatformOnTrack(abbr, tg.name, 'west');
      if (west) ids.push(west);
      const east = this.findPlatformOnTrack(abbr, tg.name, 'east');
      if (east) ids.push(east);
    }
    return ids;
  }

  private trackGroupsForStation(abbr: string): string[] {
    const names = new Set<string>();
    for (const seg of this.segments.values()) {
      if (seg.type === 'platform' && (seg as Platform).stationAbbr === abbr) {
        names.add(seg.trackGroupName);
      }
    }
    return [...names];
  }

  /**
   * Pick the best platform for a train approaching a station.
   *
   * - At a terminus the train will reverse before departing, so we want it to land on
   *   the track that's natural for the *reversed* direction (an eastbound inbound train
   *   aims for the west-track platform so its next outbound run as a westbound train
   *   departs straight). If that platform is occupied by another train on layover, the
   *   inbound train falls back to the same-track terminus platform — DESIGN.md spells
   *   this out, and the next outbound leg will cross over via the same switch pair to
   *   reach the natural outbound track.
   * - At an intermediate station, target the track natural for the train's *direction
   *   of travel*, not its current track. Normally those agree, but if the train fell
   *   back to the wrong-track terminus, this is what tells the autorouter to cross over
   *   at the next switch instead of running head-on into oncoming traffic.
   *
   * Returns the chosen platform's segment id, or undefined if no platform exists.
   */
  pickTargetPlatform(
    abbr: string,
    trackGroupName: string | undefined,
    trainDirection: 'west' | 'east',
    trainTrackDirection: 'west' | 'east',
    isTerminus: boolean,
    occupied: ReadonlySet<string>,
  ): string | undefined {
    const platforms = this.getStationPlatforms(abbr, trackGroupName);
    if (platforms.length === 0) return undefined;

    if (isTerminus) {
      const reversed = trainDirection === 'east' ? 'west' : 'east';
      const preferred = platforms.find(id => this.segments.get(id)?.trackDirection === reversed);
      const fallback = platforms.find(id => this.segments.get(id)?.trackDirection !== reversed);
      if (preferred && !occupied.has(preferred)) return preferred;
      if (fallback && !occupied.has(fallback)) return fallback;
      return preferred ?? fallback;
    }

    // Aim for the track natural for the direction of travel — keeps eastbounds on the
    // east track and westbounds on the west track, and re-aligns a fallback train
    // back onto its natural track at the next opportunity.
    const naturalTrack = platforms.find(id => this.segments.get(id)?.trackDirection === trainDirection);
    const opposite = platforms.find(id => this.segments.get(id)?.trackDirection !== trainDirection);
    return naturalTrack ?? opposite;
  }

  /**
   * Get the segment IDs within a route's extent on a given track
   * (from first route platform to last route platform, inclusive of all segments between).
   */
  getRouteExtent(route: Route, trackDirection: 'west' | 'east'): string[] {
    if (!route.trackGroupName) return [];

    const tg = this.trackGroups.find(t => t.name === route.trackGroupName);
    if (!tg) return [];
    const segmentIds = trackDirection === 'west' ? tg.westSegments : tg.eastSegments;

    const platIds = route.platformAbbrs
      .map(abbr => this.findPlatformOnTrack(abbr, route.trackGroupName, trackDirection))
      .filter((id): id is string => id !== undefined);

    if (platIds.length === 0) return [];

    const indices = platIds.map(id => segmentIds.indexOf(id));
    const startIdx = Math.min(...indices);
    const endIdx = Math.max(...indices);
    return segmentIds.slice(startIdx, endIdx + 1);
  }

  private createSegment(id: string, type: 'plain' | 'platform' | 'switch', trackGroupName: string, direction: 'west' | 'east'): Segment {
    const seg: Segment = {
      id,
      type,
      displayWidth: DEFAULT_SEGMENT_WIDTH,
      trackGroupName,
      trackDirection: direction,
      next: null,
      prev: null,
    };
    this.segments.set(id, seg);
    return seg;
  }

  private createPlatform(id: string, trackGroupName: string, direction: 'west' | 'east', dwellTime: number): Platform {
    const plat: Platform = {
      id,
      type: 'platform',
      displayWidth: DEFAULT_SEGMENT_WIDTH,
      trackGroupName,
      trackDirection: direction,
      next: null,
      prev: null,
      stationAbbr: id.slice(0, 3).toUpperCase(),
      stationName: id,
      dwellTime,
    };
    this.segments.set(id, plat);
    return plat;
  }

  private linkSequence(segmentIds: string[]): void {
    for (let i = 0; i < segmentIds.length - 1; i++) {
      const curr = this.segments.get(segmentIds[i])!;
      const next = this.segments.get(segmentIds[i + 1])!;
      curr.next = next.id;
      next.prev = curr.id;
    }
  }

  private createSwitch(id: string, trackGroupName: string, direction: 'west' | 'east'): Switch {
    let sw = this.segments.get(id) as Switch;
    if (sw && sw.type === 'switch') return sw;

    sw = {
      id,
      type: 'switch',
      displayWidth: 20, // Enough for a clean diagonal without excessive space
      trackGroupName,
      trackDirection: direction,
      next: null,
      prev: null,
      divergingNext: null,
      divergingPrev: null,
      state: 'straight',
      lockedBy: null,
    };
    this.segments.set(id, sw);
    return sw;
  }
}
