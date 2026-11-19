/**
 * TILLFÄLLIG actionkatalog för UI:t, byggd på skelettets `SKELETON_ACTIONS`.
 *
 * Ersätts av motorns katalog från tråden "Bygg actionkatalog och mål i motorn"
 * (vilka actions spelaren har, giltiga mål, kostnad och inkomst). Allt här är
 * gissningar som räcker för att bygga och testa skärmen, inte regler.
 *
 * Körs bara i `localPort.ts` (utveckling). Får därför läsa `GameState`, men
 * visar bara mål som spelaren vet om: andras vampyrer och minions syns inte som
 * mål förrän motorn har en modell för garanterad information.
 */
import {
  actionCost,
  effectiveFactions,
  effectiveTitles,
  type ActionDefinition,
  type ActionRegistry,
  type CityId,
  type Content,
  type GameState,
  type MinionId,
  type Player,
  type PlayerId,
  type SubmittedAction,
} from '@vampyre/engine';
import type { ActionChoice, DraftAction, Params, PerformerRef, TargetStep } from './model';

export interface ShimContext {
  state: GameState;
  content: Content;
  registry: ActionRegistry;
  playerId: PlayerId;
}

const player = (ctx: ShimContext): Player => {
  const p = ctx.state.players[ctx.playerId];
  if (!p) throw new Error(`Okänd spelare ${ctx.playerId}`);
  return p;
};

const cityName = (ctx: ShimContext, id: string | null | undefined): string =>
  (id && ctx.state.cities[id as CityId]?.name) || '?';

/** Var vampyren och minionerna står efter listans Move-actions. */
export function positionsAfter(
  ctx: ShimContext,
  draft: readonly DraftAction[],
): { vampire: CityId | null; minions: Record<string, CityId> } {
  const p = player(ctx);
  let vampire = p.location;
  const minions: Record<string, CityId> = {};
  for (const m of Object.values(ctx.state.minions)) {
    if (m.owner.kind === 'player' && m.owner.id === p.id) minions[m.id] = m.location;
  }
  for (const a of draft) {
    const to = a.params.to;
    if (typeof to !== 'string') continue;
    if (a.actionId === 'move' && a.performer.kind === 'vampire') vampire = to as CityId;
    if (a.actionId === 'minion_move' && a.performer.kind === 'minion') minions[a.performer.minionId] = to as CityId;
  }
  return { vampire, minions };
}

const performerCity = (ctx: ShimContext, before: readonly DraftAction[], performer: PerformerRef): CityId | null => {
  const pos = positionsAfter(ctx, before);
  return performer.kind === 'vampire' ? pos.vampire : (pos.minions[performer.minionId] ?? null);
};

const neighbours = (ctx: ShimContext, city: CityId | null) =>
  (city ? (ctx.state.cities[city]?.adjacent ?? []) : []).map((id) => ({ value: id, label: cityName(ctx, id) }));

const ownMinions = (ctx: ShimContext) =>
  Object.values(ctx.state.minions)
    .filter((m) => m.owner.kind === 'player' && m.owner.id === ctx.playerId)
    .sort((a, b) => a.id.localeCompare(b.id));

/** Målsteg per action. Returnerar nästa steg som saknas i `params`, eller null. */
export function nextStep(
  ctx: ShimContext,
  before: readonly DraftAction[],
  actionId: string,
  performer: PerformerRef,
  params: Params,
): TargetStep | null {
  const p = player(ctx);
  const steps: TargetStep[] = [];
  switch (actionId) {
    case 'move':
    case 'minion_move':
      steps.push({ kind: 'select', param: 'to', label: 'Till', options: neighbours(ctx, performerCity(ctx, before, performer)) });
      break;
    case 'attack':
      // Mål måste vara i samma stad. UI:t känner bara till garanterad information,
      // och den modellen finns inte än, så listan är tom.
      steps.push({ kind: 'select', param: 'target', label: 'Mål', options: [] });
      break;
    case 'anarch_mission':
      steps.push({
        kind: 'select',
        param: 'minionId',
        label: 'Minion',
        options: ownMinions(ctx).map((m) => ({ value: m.id, label: m.name })),
      });
      break;
    case 'give':
      steps.push({
        kind: 'select',
        param: 'to',
        label: 'Till',
        options: Object.values(ctx.state.players)
          .filter((o) => o.id !== p.id && o.status !== 'burned')
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((o) => ({ value: o.id, label: o.name })),
      });
      steps.push({ kind: 'number', param: 'blood', label: 'Blood', min: 1, max: Math.max(1, p.blood) });
      break;
    case 'buy_votes':
      steps.push({ kind: 'number', param: 'blood', label: 'Blood', min: 1, max: Math.max(1, p.blood) });
      break;
    case 'grow_in_power':
      steps.push({ kind: 'number', param: 'exp', label: 'EXP', min: 1, max: Math.max(1, p.exp.unspent) });
      break;
  }
  return steps.find((s) => params[s.param] === undefined) ?? null;
}

function vampireEligible(def: ActionDefinition, p: Player): string | null {
  if (def.titles && !def.titles.some((t) => effectiveTitles(p).includes(t))) return 'Kräver annan titel';
  if (def.factions && !def.factions.some((f) => effectiveFactions(p).includes(f))) return 'Kräver annan sekt';
  if (p.status === 'torpor' && !def.allowedInTorpor) return 'Vampyren är i torpor';
  return null;
}

/** Alla actions spelaren kan välja: vampyrens först, sedan varje egen minions. */
export function actionChoices(ctx: ShimContext, draft: readonly DraftAction[]): ActionChoice[] {
  const p = player(ctx);
  if (p.status === 'burned') return [];
  const defs = Object.values(ctx.registry);
  const out: ActionChoice[] = [];
  const withTargetCheck = (choice: ActionChoice): ActionChoice => {
    if (choice.disabledReason) return choice;
    const first = nextStep(ctx, draft, choice.actionId, choice.performer, {});
    if (first?.kind === 'select' && first.options.length === 0) return { ...choice, disabledReason: 'Inga kända mål' };
    if (choice.actionId === 'grow_in_power' && p.exp.unspent === 0) return { ...choice, disabledReason: 'Ingen EXP' };
    return choice;
  };

  for (const def of defs.filter((d) => d.performer === 'vampire')) {
    if (vampireEligible(def, p)) continue;
    out.push(
      withTargetCheck({
        key: `vampire:${def.id}`,
        actionId: def.id,
        performer: { kind: 'vampire' },
        performerName: p.name,
        performerKind: 'vampire',
        name: def.name,
      }),
    );
  }
  for (const m of ownMinions(ctx)) {
    for (const def of defs.filter((d) => d.performer === 'minion')) {
      if (def.minionTypes && !def.minionTypes.includes(m.type)) continue;
      out.push(
        withTargetCheck({
          key: `minion:${m.id}:${def.id}`,
          actionId: def.id,
          performer: { kind: 'minion', minionId: m.id },
          performerName: m.name,
          performerKind: 'minion',
          name: def.name.replace(' (minion)', ''),
        }),
      );
    }
  }
  return out;
}

/** Radtext, t.ex. "Move från North till East" eller "Bleed i North". */
export function describe(ctx: ShimContext, before: readonly DraftAction[], a: DraftAction): string {
  const def = ctx.registry[a.actionId];
  const name = def?.name.replace(' (minion)', '') ?? a.actionId;
  const here = cityName(ctx, performerCity(ctx, before, a.performer));
  switch (a.actionId) {
    case 'move':
    case 'minion_move':
      return `${name} från ${here} till ${cityName(ctx, a.params.to as string)}`;
    case 'bleed':
    case 'bleed_the_enemy':
      return `${name} i ${here}`;
    case 'anarch_mission':
      return `${name}: ${ctx.state.minions[a.params.minionId as MinionId]?.name ?? '?'}`;
    case 'give':
      return `${name} ${a.params.blood} blood till ${ctx.state.players[a.params.to as PlayerId]?.name ?? '?'}`;
    case 'buy_votes':
      return `${name} för ${a.params.blood} blood`;
    case 'grow_in_power':
      return `${name}: ${a.params.exp} EXP`;
    default:
      return name;
  }
}

export function toSubmitted(a: DraftAction): SubmittedAction {
  return {
    actionId: a.actionId,
    performer: a.performer.kind === 'vampire' ? { kind: 'vampire' } : { kind: 'minion', minionId: a.performer.minionId as MinionId },
    params: { ...a.params },
  };
}

export function costOf(ctx: ShimContext, a: DraftAction): number {
  const def = ctx.registry[a.actionId];
  if (!def) return 0;
  const c = actionCost(def, { state: ctx.state, content: ctx.content, player: player(ctx), action: toSubmitted(a) });
  return Number.isFinite(c) ? c : 0;
}

/**
 * Deterministisk inkomst per action. Skelettet har ingen sådan action (t.ex.
 * Bottomless Wealth of the Camarilla saknas), så tabellen är tom. Bleed ger
 * inkomst men den är inte deterministisk och visas därför inte.
 */
const DETERMINISTIC_INCOME: Record<string, number> = {};

export function incomeOf(a: DraftAction): number | null {
  return DETERMINISTIC_INCOME[a.actionId] ?? null;
}

/** Fel som shimmen hittar själv, t.ex. en Move som inte längre går efter omsortering. */
export function entryProblems(ctx: ShimContext, before: readonly DraftAction[], a: DraftAction): string[] {
  if (a.actionId !== 'move' && a.actionId !== 'minion_move') return [];
  const from = performerCity(ctx, before, a.performer);
  const to = a.params.to;
  if (typeof to !== 'string') return ['Saknar mål'];
  const ok = from !== null && (ctx.state.cities[from]?.adjacent ?? []).includes(to as CityId);
  return ok ? [] : [`${cityName(ctx, to)} är inte granne till ${cityName(ctx, from)}`];
}
