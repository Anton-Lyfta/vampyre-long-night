/** Demokampanjen för utveckling: välj spelare med `?player=prince` (se DEMO_PLAYERS). */
import { DEMO_PLAYERS, createDemoRound } from '@vampyre/engine';
import { createLocalPort } from './localPort';
import type { Position } from './mapModel';
import type { PlayerScreenPort } from './model';

/** Layout för testkartan (TEST_MAP saknar positioner). */
export const TEST_MAP_POSITIONS: Record<string, Position> = {
  north: { x: 470, y: 130 },
  east: { x: 800, y: 230 },
  west: { x: 190, y: 330 },
  south: { x: 500, y: 470 },
  isle: { x: 830, y: 590 },
};

export type DemoPlayerKey = keyof typeof DEMO_PLAYERS;

export function isDemoPlayerKey(k: string | null): k is DemoPlayerKey {
  return k !== null && k in DEMO_PLAYERS;
}

export function createDemoPort(player: DemoPlayerKey = 'prince'): PlayerScreenPort {
  const { state, events } = createDemoRound();
  return createLocalPort({ state, events, playerId: DEMO_PLAYERS[player], positions: TEST_MAP_POSITIONS });
}
