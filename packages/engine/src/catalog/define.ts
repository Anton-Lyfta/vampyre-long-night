/**
 * Hjälpare för att skriva aktionsdefinitioner kort.
 */
import type { ActionDefinition, ActionOutcome, ActionTargets, TargetContext } from '../round/actions.js';
import type { Json, Performer } from '../round/types.js';
import type { CityId, MinionId, PlayerId } from '../state/ids.js';
import { strParam } from './options.js';
import type { CatalogContext, ProjectedMove } from './types.js';

/** Effekterna är inte byggda än: aktionen löses utan effekt (R19). */
export const stub = (): ActionOutcome => ({ status: 'resolved' });

export type Def = Omit<ActionDefinition, 'resolve'> & Partial<Pick<ActionDefinition, 'resolve'>>;

/**
 * Fyller i standardvärden: stubb-effekt och mål lästa från valen. Varje
 * sträng i params som är id för en stad, vampyr eller minion räknas som mål
 * (controller-sikt och vad observatörer ser, M17/M18).
 */
export function define(d: Def): ActionDefinition {
  return { targets: targetsFromParams, ...d, resolve: d.resolve ?? stub };
}

export function targetsFromParams({ state, entry }: TargetContext): ActionTargets {
  const cities = new Set<CityId>();
  const players = new Set<PlayerId>();
  const minions = new Set<MinionId>();
  const visit = (v: Json | undefined) => {
    if (typeof v === 'string') {
      if (v in state.cities) cities.add(v as CityId);
      else if (v in state.players) players.add(v as PlayerId);
      else if (v in state.minions) minions.add(v as MinionId);
    } else if (Array.isArray(v)) v.forEach(visit);
  };
  for (const v of Object.values(entry.action.params ?? {})) visit(v);
  const out: ActionTargets = {};
  if (cities.size) out.cities = [...cities].sort();
  if (players.size) out.players = [...players].sort();
  if (minions.size) out.minions = [...minions].sort();
  return out;
}

/** Utföraren flyttar till staden i `params[key]`. */
export const movesTo =
  (key = 'to') =>
  (ctx: CatalogContext): ProjectedMove[] => [{ performer: ctx.action.performer, to: strParam(ctx, key) as CityId | null }];

export const vampire: Performer = { kind: 'vampire' };
