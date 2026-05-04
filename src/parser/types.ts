/**
 * AST types for parsed .map files.
 */
export interface MapFile {
  config: MapConfig;
  trackGroups: TrackGroupDef[];
  routes: RouteDef[];
  switches: SwitchDef[];
}

export interface MapConfig {
  speed: number;
  dwell: number;     // seconds
  layover?: number;  // seconds; falls back to dwell when unset
}

export interface TrackGroupDef {
  name: string;
  westTrack: TrackElement[];
  eastTrack: TrackElement[];
}

export type TrackElement =
  | { type: 'segment'; id: string }
  | { type: 'platform'; id: string }
  | { type: 'switch'; id: string };

export interface SwitchDef {
  from: string; // node ID
  to: string;   // node ID
  bidirectional?: boolean;
}

export interface RouteDef {
  name: string;
  color: string;
  platforms: string[];
  trainCount: number;
  trainIds: string[];
  trackGroupName?: string;
  layover?: number;  // seconds at terminus; falls back to config.layover
}
