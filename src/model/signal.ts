/**
 * Signal model. Signals guard segment boundaries and prevent collisions.
 */

export type SignalState = 'red' | 'green' | 'straight' | 'diverge';

export interface Signal {
  id: string;
  state: SignalState;
  // 3-aspect caution: signal would be clear, but the NEXT signal a train would
  // encounter after passing this one is currently red. Renderer paints the
  // glyph yellow while preserving whatever symbol `state` would otherwise
  // produce (●, →, ↗, etc.). Has no meaning when state === 'red'.
  caution: boolean;
  facingDirection: 'west' | 'east';  // which direction of travel this signal faces
  segmentBefore: string;             // segment id on the approach side
  segmentAfter: string;              // segment id being guarded
  x: number;                         // screen x position (set by layout)
}

/**
 * Auto-generate signals at every segment boundary in a track.
 * Each boundary gets a pair: one facing each direction.
 */
export function generateSignals(
  segmentIds: string[],
  trackGroupName: string,
  trackDirection: 'west' | 'east'
): Signal[] {
  const signals: Signal[] = [];
  let counter = 1;

  for (let i = 0; i < segmentIds.length - 1; i++) {
    const leftSeg = segmentIds[i];
    const rightSeg = segmentIds[i + 1];
    const prefix = `${trackGroupName[0]}${trackDirection[0]}`.toUpperCase();

    // Signal facing eastbound trains (traveling left to right)
    signals.push({
      id: `${prefix}${counter}E`,
      state: 'green',
      caution: false,
      facingDirection: 'east',
      segmentBefore: leftSeg,
      segmentAfter: rightSeg,
      x: 0,
    });

    // Signal facing westbound trains (traveling right to left)
    signals.push({
      id: `${prefix}${counter}W`,
      state: 'green',
      caution: false,
      facingDirection: 'west',
      segmentBefore: rightSeg,
      segmentAfter: leftSeg,
      x: 0,
    });

    counter++;
  }

  return signals;
}
