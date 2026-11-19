/** Demokampanjen för utveckling: välj spelare med `?player=prince` (se DEMO_PLAYERS). */
import { DEMO_PLAYERS, createDemoRound } from '@vampyre/engine';
import { createLocalPort } from './localPort';
import type { PlayerScreenPort } from './model';

export type DemoPlayerKey = keyof typeof DEMO_PLAYERS;

export function isDemoPlayerKey(k: string | null): k is DemoPlayerKey {
  return k !== null && k in DEMO_PLAYERS;
}

export function createDemoPort(player: DemoPlayerKey = 'prince'): PlayerScreenPort {
  const { state, events } = createDemoRound();
  return createLocalPort({ state, events, playerId: DEMO_PLAYERS[player] });
}
