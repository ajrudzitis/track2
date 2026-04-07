/**
 * Core model types for the track topology.
 */

export interface Segment {
  id: string;
  type: 'plain' | 'platform';
  displayWidth: number;
  trackGroupName: string;
  trackDirection: 'west' | 'east';
  next: string | null;  // next segment id
  prev: string | null;  // prev segment id
}

export interface Platform extends Segment {
  type: 'platform';
  stationAbbr: string;   // 3-char abbreviation
  stationName: string;
  dwellTime: number;      // seconds
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
}
