/**
 * AST types for parsed .map files.
 */

export interface MapFile {
  config: MapConfig;
  trackGroups: TrackGroupDef[];
  routes: RouteDef[];
}

export interface MapConfig {
  speed: number;
  dwell: number;     // seconds
  layover: number;   // seconds
}

export interface TrackGroupDef {
  name: string;
  westTrack: TrackElement[];
  eastTrack: TrackElement[];
}

export type TrackElement =
  | { type: 'segment'; id: string }
  | { type: 'platform'; id: string };

export interface RouteDef {
  name: string;
  color: string;
  platforms: string[];
  trainCount: number;
  trainIds: string[];
}
