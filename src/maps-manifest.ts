/**
 * Curated list of demo maps, in feature-tour order. Each entry references
 * a file under `maps/` and gives it a short label and description so a
 * host (CLI listing, web picker, etc.) can present them to users.
 *
 * This module is data-only — it doesn't read the filesystem. Hosts
 * load the file contents themselves (`readFileSync`, Vite glob import,
 * etc.) using the `file` property as a key.
 */

export interface MapManifestEntry {
  /** Filename, relative to the `maps/` directory. */
  file: string;
  /** Short label for menu display (≤ ~24 chars). */
  label: string;
  /** One-line description of what the map demonstrates. */
  description: string;
}

export const MAPS_MANIFEST: MapManifestEntry[] = [
  {
    file: '10-two-routes.map',
    label: 'Two routes (showcase)',
    description: 'Six-station mainline forking to a three-station branch; eight trains, two routes.',
  },
  {
    file: 'link-light-rail.map',
    label: 'Sound Transit Link',
    description: 'Link 1 & 2 Lines: shared Lynnwood–CID trunk with east branch to Redmond, 20 trains.',
  },
  {
    file: '02-segments.map',
    label: 'Segments',
    description: 'Plain segments with boundary tick marks.',
  },
  {
    file: '03-platforms.map',
    label: 'Platforms',
    description: 'Station platforms with 3-char labels.',
  },
  {
    file: '04-signals.map',
    label: 'Signals',
    description: 'Auto-generated signals at segment boundaries.',
  },
  {
    file: '05-trains.map',
    label: 'Trains',
    description: 'Train movement, dwell, signal respect.',
  },
  {
    file: '06-routes.map',
    label: 'Routes',
    description: 'Cyclic routes with multiple trains per route.',
  },
  {
    file: '07-switches.map',
    label: 'Switches',
    description: 'Crossovers and branch switches.',
  },
  {
    file: '08-terminal.map',
    label: 'Terminus layover',
    description: 'Terminus crossover with per-route layover timer.',
  },
  {
    file: '08b-scrolling.map',
    label: 'Horizontal scrolling',
    description: 'Maps wider than the viewport scroll horizontally.',
  },
  {
    file: '09-advanced.map',
    label: 'Branch links',
    description: 'Routes spanning separate track groups via branch links.',
  },
  {
    file: '09b-chain.map',
    label: 'Chain reservation',
    description: 'Multi-switch chain reservation (atomic, deadlock-free).',
  },
  {
    file: '09c-aspects.map',
    label: '3-aspect signals',
    description: 'Yellow-caution aspect ahead of a red signal.',
  },
];
