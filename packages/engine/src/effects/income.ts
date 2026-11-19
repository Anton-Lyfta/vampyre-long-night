/**
 * Inkomstfaserna (gd:955–957, SPEC A16 numrering 5a–5c).
 *
 * - 5a: controllern av varje stad som inte är contested får stadens *nuvarande*
 *   blood flow, alltså efter rondens bleeds (gd:955, gd:507).
 * - 5b: blood från rondens bleeds (gd:956).
 * - 5c: övrig inkomst från aktioner (gd:957).
 *
 * Varje spelare får ett event per fas med sin egen inkomst; ingen annan ser det.
 * Beslut: docs/decisions/effects.md (E9–E11).
 */
import type { PhaseContext } from '../round/resolve.js';
import type { Json } from '../round/types.js';
import type { CityId, PlayerId } from '../state/ids.js';
import { compareIds, sortedIds } from '../state/json.js';
import { cityStat, isContested } from '../state/queries.js';
import type { GameState } from '../state/types.js';
import { allPendingIncome, type IncomeItem } from './blood.js';

/** Fas 5a: stadernas blood flow till controllern. */
export function payCityIncome(ctx: PhaseContext): void {
  const { state } = ctx;
  const perPlayer = new Map<PlayerId, Record<string, number>>();
  for (const id of sortedIds(state.cities)) {
    const city = state.cities[id]!;
    const owner = city.controllerId;
    if (owner === null || isContested(city as GameState['cities'][CityId])) continue;
    const player = state.players[owner];
    if (!player || player.status === 'burned') continue;
    const amount = cityStat(state as GameState, ctx.content, id, 'bloodFlow');
    const row = perPlayer.get(owner) ?? {};
    row[id] = amount;
    perPlayer.set(owner, row);
  }
  for (const pid of [...perPlayer.keys()].sort(compareIds)) {
    const cities = perPlayer.get(pid)!;
    const amount = Object.values(cities).reduce((s, x) => s + x, 0);
    state.players[pid]!.blood += amount;
    ctx.emit('city_income', { amount, cities }, pid);
  }
}

function payPending(ctx: PhaseContext, kind: 'bleed' | 'other', eventKind: string): void {
  const pending = allPendingIncome(ctx.resolution.scratch);
  for (const pid of (Object.keys(pending) as PlayerId[]).sort(compareIds)) {
    const items: IncomeItem[] = pending[pid]![kind];
    if (items.length === 0) continue;
    const player = ctx.state.players[pid];
    // En bränd vampyr får ingen inkomst (gd:901 "removed from the game").
    if (!player || player.status === 'burned') continue;
    const amount = items.reduce((s, i) => s + i.amount, 0);
    player.blood += amount;
    const list: Json = items.map((i) => ({ amount: i.amount, source: i.source, entryId: i.entryId }));
    ctx.emit(eventKind, { amount, items: list }, pid);
  }
}

/** Fas 5b: blood från bleeds. */
export function payBleedIncome(ctx: PhaseContext): void {
  payPending(ctx, 'bleed', 'bleed_income');
}

/** Fas 5c: övrig inkomst. */
export function payOtherIncome(ctx: PhaseContext): void {
  payPending(ctx, 'other', 'other_income');
}
