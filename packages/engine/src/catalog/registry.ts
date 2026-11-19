/** Den fullständiga katalogen (ACTION_CATALOG). Se index.ts. */
import { actionCost, actionIncome, actionParams, createRegistry, type ActionDefinition, type ActionRegistry } from '../round/actions.js';
import { ARTIFACT_ACTIONS } from './actions/artifact.js';
import { DISCIPLINE_ACTIONS } from './actions/discipline.js';
import { FACTION_ACTIONS } from './actions/faction.js';
import { MINION_ACTIONS } from './actions/minion.js';
import { PERSONAL_ACTIONS } from './actions/personal.js';
import { define } from './define.js';
import { strParam } from './options.js';
import type { CatalogContext } from './types.js';

/** Faction actions utan titelkrav, som (M)Presence kan utföra (gd:1260). */
const presenceTargets = (): ActionDefinition[] => FACTION_ACTIONS.filter((d) => !d.titles && !d.requires);

const chosen = (ctx: CatalogContext): ActionDefinition | null => {
  const id = strParam(ctx, 'action');
  return presenceTargets().find((d) => d.id === id) ?? null;
};

/**
 * (M)Presence: "Make any faction action that does not require a title." Kostnad,
 * val, inkomst och förflyttning är den valda aktionens. Sektkravet gäller inte
 * (annars vore aktionen bara en extra action, K9).
 */
const PRESENCE_M = define({
  id: 'presence_m',
  name: '(M) Presence',
  category: 'discipline',
  performer: 'vampire',
  stealth: 0,
  cost: (ctx) => {
    const d = chosen(ctx);
    return d ? actionCost(d, ctx) : 0;
  },
  income: (ctx) => {
    const d = chosen(ctx);
    return d ? actionIncome(d, ctx) : 0;
  },
  maxPerRound: 1,
  requires: { discipline: { key: 'presence', level: 'mastered' } },
  params: (ctx) => [
    {
      key: 'action',
      label: 'Faction action',
      kind: 'choice',
      options: () => presenceTargets().map((d) => ({ value: d.id, label: d.name })),
    },
    ...(chosen(ctx) ? actionParams(chosen(ctx)!, ctx) : []),
  ],
  eligible: (ctx) => chosen(ctx)?.eligible?.(ctx) ?? null,
  moves: (ctx) => chosen(ctx)?.moves?.(ctx) ?? [],
});

export const ACTION_CATALOG: ActionRegistry = createRegistry([
  ...PERSONAL_ACTIONS,
  ...FACTION_ACTIONS,
  ...DISCIPLINE_ACTIONS,
  PRESENCE_M,
  ...MINION_ACTIONS,
  ...ARTIFACT_ACTIONS,
]);

