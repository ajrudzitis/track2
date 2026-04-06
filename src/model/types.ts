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
