/**
 * Blood: Bleed och inkomst som betalas i fas 5 (gd:95 "income comes at the start
 * of the next round", gd:955–957).
 *
 * - Bleed sänker stadens blood flow resten av ronden och ger spelaren lika mycket
 *   blood i fas 5b (gd:895). Man kan inte få mer än stadens kvarvarande blood flow
 *   (gd:1138, E7).
 * - Annan inkomst (Bottomless Wealth, Diamond of Toreador …) samlas under ronden
 *   och betalas i fas 5c (gd:957).
 *
 * Inkomsten ligger i `RoundResolution.scratch.income` tills den betalas, så att
 * den överlever en paus för strid (M11). Beslut: docs/decisions/effects.md.
 */
import type { ActionContext } from '../round/actions.js';
import type { Json } from '../round/types.js';
import type { CityId, PlayerId } from '../state/ids.js';
import { cityStat } from '../state/queries.js';
import type { GameState } from '../state/types.js';

export interface IncomeItem {
  amount: number;
  source: string;
  entryId: string;
}

/** Inkomst per spelare som väntar på fas 5. Ren JSON i `scratch.income`. */
export interface PendingIncome {
  bleed: IncomeItem[];
  other: IncomeItem[];
}

type Scratch = { [key: string]: Json };

export function pendingIncome(scratch: Scratch, playerId: PlayerId): PendingIncome {
  const all = (scratch.income ??= {}) as unknown as Record<string, PendingIncome>;
  return (all[playerId] ??= { bleed: [], other: [] });
}

export function allPendingIncome(scratch: Scratch): Record<string, PendingIncome> {
  return (scratch.income ?? {}) as unknown as Record<string, PendingIncome>;
}

export interface BleedResult {
  /** Summan tärningarna gav, före taket. */
  rolled: number;
  /** Det staden förlorar: `rolled`, högst stadens kvarvarande blood flow. */
  drained: number;
  /** Det spelaren får i fas 5b (efter t.ex. Picky eater). */
  gained: number;
}

/**
 * Bleedar en stad (gd:895): stadens blood flow sänks med beloppet resten av
 * ronden och spelaren får beloppet i fas 5b. Beloppet kapas vid stadens
 * kvarvarande blood flow (E7). `penalty` dras från det spelaren får men inte
 * från staden (Picky eater, E8).
 */
export function bleedCity(
  ctx: ActionContext,
  cityId: CityId,
  rolled: number,
  opts: { penalty?: number; dice?: number[] } = {},
): BleedResult {
  const flow = cityStat(ctx.state as GameState, ctx.content, cityId, 'bloodFlow');
  const drained = Math.max(0, Math.min(rolled, flow));
  const gained = Math.max(0, drained - (opts.penalty ?? 0));
  if (drained > 0) {
    ctx.state.cities[cityId]!.modifiers.push({
      stat: 'bloodFlow',
      amount: -drained,
      source: `bleed:${ctx.entry.id}`,
      expiresAfterRound: ctx.state.round,
    });
  }
  if (gained > 0) {
    pendingIncome(ctx.scratch, ctx.entry.playerId).bleed.push({
      amount: gained,
      source: ctx.entry.action.actionId,
      entryId: ctx.entry.id,
    });
  }
  const data: { [key: string]: Json } = { cityId, rolled, drained, gained };
  if (opts.dice) data.dice = [...opts.dice];
  ctx.emit('bled', data);
  return { rolled, drained, gained };
}

/** Blood som spelaren får i fas 5c (gd:957). */
export function addIncome(ctx: ActionContext, amount: number): void {
  if (amount <= 0) return;
  pendingIncome(ctx.scratch, ctx.entry.playerId).other.push({
    amount,
    source: ctx.entry.action.actionId,
    entryId: ctx.entry.id,
  });
  ctx.emit('income_pending', { amount, phase: '5c_other_income' });
}

const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);

/** Slår `count` D`sides` och returnerar tärningarna och summan. */
export function rollSum(ctx: ActionContext, count: number, sides: number): { dice: number[]; total: number } {
  const dice = ctx.rng.roll(count, sides);
  return { dice, total: sum(dice) };
}
