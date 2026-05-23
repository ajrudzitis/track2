/**
 * Core model types for the track topology.
 */

export interface Segment {
  id: string;
  type: 'plain' | 'platform' | 'switch';
  displayWidth: number;
  trackGroupName: string;
  trackDirection: 'west' | 'east';
  next: string | null;  // next segment id (straight)
  prev: string | null;  // prev segment id (straight)
}

export interface Platform extends Segment {
  type: 'platform';
  stationAbbr: string;   // 3-char abbreviation
  stationName: string;
  dwellTime: number;      // seconds
}

export interface Switch extends Segment {
  type: 'switch';
  divergingNext: string | null;
  divergingPrev: string | null;
  state: 'straight' | 'diverging';
  lockedBy: string | null; // train ID currently traversing/locking the switch
}

export interface TrackGroup {
  name: string;
  westSegments: string[];   // segment ids in order
  eastSegments: string[];   // segment ids in order
}

export type TrainState = 'running' | 'stopped' | 'dwelling';

export interface Train {
  id: string;                // 4-char display ID
  segmentId: string;         // current segment
  position: number;          // 0.0–1.0 progress through segment
  direction: 'west' | 'east'; // current direction of travel
  state: TrainState;
  dwellRemaining: number;    // seconds remaining at platform (0 if not dwelling)
  color: number;             // ANSI color code for background
  trackGroupName: string;
  trackDirection: 'west' | 'east'; // which track the train is on
  routeId?: string;          // name of the route this train belongs to
  lastPlatformIndex?: number; // index of the last platform visited in the route
}

export interface Route {
  name: string;
  color: number;             // resolved ANSI background color code
  platformAbbrs: string[];   // station abbreviations from the route def
  trackGroupName?: string;   // optional scope; omitted routes may span trackgroups
  trainIds: string[];        // custom train IDs (may be empty)
  trainCount: number;        // total number of trains to spawn
  layover: number;           // seconds dwell at first/last platform (terminus)
}

export const ANSI_COLORS: Record<string, number> = {
  red: 41, green: 42, yellow: 43, blue: 44,
  magenta: 45, cyan: 46, white: 47,
};
