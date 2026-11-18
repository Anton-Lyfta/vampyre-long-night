/**
 * GM-vyn: hela state och alla events, utan filtrering. Kopior, så att anroparen
 * inte kan mutera motorns state via vyn.
 */
import { cloneJson } from '../state/json.js';
import type { GameState } from '../state/types.js';
import type { RoundEvent } from '../round/types.js';

export interface GmView {
  state: GameState;
  events: RoundEvent[];
}

export function buildGmView(state: GameState, events: readonly RoundEvent[] = []): GmView {
  return { state: cloneJson(state), events: cloneJson([...events]) };
}
