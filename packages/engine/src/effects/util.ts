/**
 * Små hjälpare för effekthandlers: läsa val ur entryn, hitta utföraren och ge
 * utfall. Allt läses från arbetskopian av state vid upplösning (inte från
 * spelarens vy), eftersom effekten ska spegla vad som faktiskt gäller just då.
 */
import type { ActionContext, ActionOutcome } from '../round/actions.js';
import type { Json } from '../round/types.js';
import type { CityId, MinionId } from '../state/ids.js';
import type { Minion, Mutable } from '../state/types.js';

export const ok = (): ActionOutcome => ({ status: 'resolved' });

/** Aktionen kunde inte lösas; kostnaden återbetalas av rondmotorn (C11). */
export const fail = (reason: string): ActionOutcome => ({ status: 'failed', reason });

export function arg(ctx: ActionContext, key: string): Json | undefined {
  return ctx.entry.action.params?.[key];
}

export function strArg(ctx: ActionContext, key: string): string | null {
  const v = arg(ctx, key);
  return typeof v === 'string' ? v : null;
}

/** Stad i params[key] som finns på kartan, annars null. */
export function cityArg(ctx: ActionContext, key: string): CityId | null {
  const v = strArg(ctx, key);
  return v !== null && v in ctx.state.cities ? (v as CityId) : null;
}

/** Minionen som utför entryn, eller null för vampyraktioner. */
export function performerMinion(ctx: ActionContext): Mutable<Minion> | null {
  const p = ctx.entry.action.performer;
  return p.kind === 'minion' ? (ctx.state.minions[p.minionId as MinionId] ?? null) : null;
}

/** Staden där utföraren (vampyren eller minionen) är just nu. */
export function performerCity(ctx: ActionContext): CityId | null {
  const p = ctx.entry.action.performer;
  if (p.kind === 'vampire') return ctx.player.location;
  return performerMinion(ctx)?.location ?? null;
}

/** Utförarens beskrivning i events: `{ kind: 'vampire' }` eller `{ kind: 'minion', minionId }`. */
export function performerJson(ctx: ActionContext): { [key: string]: Json } {
  const p = ctx.entry.action.performer;
  return p.kind === 'vampire' ? { kind: 'vampire' } : { kind: 'minion', minionId: p.minionId };
}
