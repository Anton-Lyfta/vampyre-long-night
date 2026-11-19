/**
 * Vem som ser en aktion (gd:114–115, gd:913, gd:925; beslut M16–M19).
 *
 * Räknas i ögonblicket aktionen löses och sparas på eventet (M18). Vyerna
 * räknar aldrig om synlighet i efterhand.
 */
import type { Content } from '../content/index.js';
import type { CityId, PlayerId } from '../state/ids.js';
import { compareIds, sortedValues } from '../state/json.js';
import { cityStat, minionStat, playerStat } from '../state/queries.js';
import type { GameState } from '../state/types.js';
import type { ActionStealth } from '../round/actions.js';
import type { Audience, Performer } from '../round/types.js';

export interface ObservedAction {
  /** Spelaren som äger aktionen (vampyren, eller minionens controller). */
  playerId: PlayerId;
  performer: Performer;
  /** Aktionens stealth-modifier enligt definitionen. */
  stealth: ActionStealth;
  /** Städer aktionen riktar sig mot (controller-sikt, gd:115). För Move: destinationen. */
  targetCities: readonly CityId[];
}

/** Var aktionen startar (M18): utförarens stad just nu. `null` om utföraren saknas eller är bränd. */
export function actionOrigin(state: GameState, action: Pick<ObservedAction, 'playerId' | 'performer'>): CityId | null {
  if (action.performer.kind === 'vampire') return state.players[action.playerId]?.location ?? null;
  return state.minions[action.performer.minionId]?.location ?? null;
}

/**
 * Aktionens totala stealth: utförarens stealth + aktionens modifier (gd:114).
 * `null` för undetectable och can't be hidden, som inte jämförs med intercept.
 */
export function totalStealth(state: GameState, content: Content, action: ObservedAction): number | null {
  if (typeof action.stealth !== 'number') return null;
  const own =
    action.performer.kind === 'vampire'
      ? playerStat(state, content, action.playerId, 'stealth')
      : minionStat(state, content, action.performer.minionId, 'stealth');
  return own + action.stealth;
}

/**
 * Spelare som får veta om aktionen, utom den som utför den.
 *
 * - **Undetectable:** ingen.
 * - **Can't be hidden:** alla (`public`).
 * - **Vampyrer i startstaden** med intercept ≥ total stealth (M16).
 * - **Informant-minions** (Eye, Archon) i startstaden med intercept ≥ stealth
 *   rapporterar till sin ägare (M19). Andra minions observerar inget.
 * - **Controllern** av startstaden och av varje målstad, om stadens intercept ≥ stealth (gd:115).
 *
 * Bara aktiva vampyrer får veta något: torpida och brända observerar inte, inte
 * heller via sina minions eller städer (M18, V12).
 */
export function observersOfAction(state: GameState, content: Content, action: ObservedAction): Audience {
  if (action.stealth === 'undetectable') return { kind: 'players', ids: [] };
  if (action.stealth === 'cant_be_hidden') return { kind: 'public' };
  const stealth = totalStealth(state, content, action)!;
  const origin = actionOrigin(state, action);
  const seen = new Set<PlayerId>();

  if (origin !== null) {
    for (const p of sortedValues(state.players)) {
      if (p.status !== 'active' || p.location !== origin) continue;
      if (playerStat(state, content, p.id, 'intercept') >= stealth) seen.add(p.id);
    }
    for (const m of sortedValues(state.minions)) {
      if (m.owner.kind !== 'player' || m.location !== origin) continue;
      if (state.players[m.owner.id]?.status !== 'active') continue;
      if (!content.minionTypes[m.type].traits.includes('informant')) continue;
      if (minionStat(state, content, m.id, 'intercept') >= stealth) seen.add(m.owner.id);
    }
  }

  const watched = new Set<CityId>(action.targetCities);
  if (origin !== null) watched.add(origin);
  for (const cityId of watched) {
    const city = state.cities[cityId];
    if (!city || city.controllerId === null) continue;
    if (state.players[city.controllerId]?.status !== 'active') continue;
    if (cityStat(state, content, cityId, 'intercept') >= stealth) seen.add(city.controllerId);
  }

  seen.delete(action.playerId);
  return { kind: 'players', ids: [...seen].sort(compareIds) };
}
