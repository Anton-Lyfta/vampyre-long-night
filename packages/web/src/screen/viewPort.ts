/**
 * Porten mot motorns actionkatalog och kartvy. Allt räknas från spelarens
 * `PlayerView` (motorns `listAvailableActions`, `nextParam`, `analyzeDraft`),
 * så samma kod fungerar i klienten och på servern och kan aldrig visa dold
 * information. Bara inlämningen (`submit`) behöver något mer än vyn.
 */
import {
  ACTION_CATALOG,
  analyzeDraft,
  listAvailableActions,
  nextParam,
  projectPositions,
  type ActionRegistry,
  type Content,
  type MinionId,
  type ParamRequest,
  type PlayerView,
  type SubmittedAction,
} from '@vampyre/engine';
import { buildMapModel } from './mapModel';
import type {
  ConfirmResult,
  DraftAction,
  DraftAnalysis,
  MainScreenData,
  PerformerRef,
  PlayerScreenPort,
  TargetStep,
} from './model';

export interface ViewPortOptions {
  view: PlayerView;
  content: Content;
  registry?: ActionRegistry;
  /** Lämnar in listan. Lokalt: motorns submitActions; i spelet: servern. */
  submit: (actions: SubmittedAction[]) => ConfirmResult;
  unlock: () => void;
  isLocked: () => boolean;
}

export function toSubmitted(a: Pick<DraftAction, 'uid' | 'actionId' | 'performer' | 'params'>): SubmittedAction {
  return {
    key: a.uid,
    actionId: a.actionId,
    performer: a.performer.kind === 'vampire' ? { kind: 'vampire' } : { kind: 'minion', minionId: a.performer.minionId as MinionId },
    params: Object.fromEntries(Object.entries(a.params).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])),
  };
}

export function toStep(r: ParamRequest): TargetStep {
  if (r.kind === 'number') {
    const range = r.range ?? { min: 0, max: Number.MAX_SAFE_INTEGER, step: 1 };
    return { kind: 'number', param: r.key, label: r.label, ...range };
  }
  if (r.kind === 'text') return { kind: 'text', param: r.key, label: r.label, ...(r.maxWords !== undefined ? { maxWords: r.maxWords } : {}) };
  return {
    kind: 'select',
    param: r.key,
    label: r.label,
    options: (r.options ?? []).map((o) => ({ value: o.value, label: o.label, ...(o.hint ? { hint: o.hint } : {}) })),
    ...(r.multiple ? { multiple: { ...r.multiple } } : {}),
  };
}

export function titleLabel(view: PlayerView, content: Content): string | null {
  const me = view.me;
  if (!me.title) return null;
  const name = content.titles[me.title].name;
  const domain = me.domain[0] ? view.cities.find((c) => c.id === me.domain[0])?.name : undefined;
  const ofDomain = (me.title === 'prince' || me.title === 'baron') && domain ? ` of ${domain}` : '';
  const disguise = me.disguise ? ` (som ${content.titles[me.disguise.title].name})` : '';
  return `${name}${ofDomain}${disguise}`;
}

export function createViewPort(opts: ViewPortOptions): PlayerScreenPort {
  const { view, content } = opts;
  const registry = opts.registry ?? ACTION_CATALOG;
  const cityName = (id: string | null | undefined) => (id ? (view.cities.find((c) => c.id === id)?.name ?? id) : 'okänd plats');
  const minionName = (id: string) => view.me.minions.find((m) => m.id === id)?.name ?? id;
  const performerName = (p: PerformerRef) => (p.kind === 'vampire' ? view.me.name : minionName(p.minionId));

  /** Radtext: "Move från North till South", "Bleed i North", "Give: Molly Finch, 20". */
  const describe = (list: readonly DraftAction[], i: number): string => {
    const a = list[i]!;
    const def = registry[a.actionId];
    const name = def?.name ?? a.actionId;
    const pos = projectPositions(view, content, list.map(toSubmitted), registry, i);
    const here = a.performer.kind === 'vampire' ? pos.vampire : (pos.minions[a.performer.minionId as MinionId] ?? null);
    const labels = Object.values(a.paramLabels);
    if (def?.moves && labels.length === 1) return `${name} från ${cityName(here)} till ${labels[0]}`;
    if (labels.length > 0) return `${name}: ${labels.join(', ')}`;
    return here ? `${name} i ${cityName(here)}` : name;
  };

  const analyze = (draft: readonly DraftAction[]): DraftAnalysis => {
    const actions = draft.map(toSubmitted);
    const a = analyzeDraft(view, content, { actions, royalPrivilegesToSpend: 0 }, { registry });
    const byIndex = new Map(a.entries.map((e) => [e.index, e]));
    return {
      entries: draft.map((d, i) => {
        const e = byIndex.get(i);
        return {
          label: describe(draft, i),
          performerName: performerName(d.performer),
          performerKind: d.performer.kind,
          cost: e?.cost ?? null,
          income: e?.income ?? null,
          errors: (e?.errors ?? []).map((x) => x.message),
        };
      }),
      apUsed: a.ap.used,
      apTotal: a.ap.total,
      minionActions: view.me.minions.map((m) => {
        const c = a.minionActions.find((x) => x.minionId === m.id);
        return { minionId: m.id, name: m.name, used: c?.used ?? 0, allowed: c?.allowed ?? 1 };
      }),
      totalCost: a.totalCost,
      totalIncome: a.totalIncome,
      errors: a.errors.filter((e) => e.entryIndex === undefined).map((e) => e.message),
      warnings: a.warnings.map((w) => w.message),
      canConfirm: a.canConfirm,
    };
  };

  return {
    load(): MainScreenData {
      return {
        round: { round: view.round, maxRounds: view.maxRounds },
        resources: { ...view.resources },
        vampire: { name: view.me.name, titleLabel: titleLabel(view, content), stats: { ...view.me.stats } },
        map: buildMapModel(view.map),
      };
    },
    actionChoices(draft) {
      const items = listAvailableActions(view, content, draft.map(toSubmitted), { registry });
      return items.map((it) => ({
        key: `${it.performer.kind === 'vampire' ? 'vampire' : `minion:${it.performer.minionId}`}:${it.actionId}`,
        actionId: it.actionId,
        performer: it.performer.kind === 'vampire' ? { kind: 'vampire' } : { kind: 'minion', minionId: it.performer.minionId },
        performerName: performerName(
          it.performer.kind === 'vampire' ? { kind: 'vampire' } : { kind: 'minion', minionId: it.performer.minionId },
        ),
        performerKind: it.performer.kind,
        name: it.name,
        cost: it.cost,
        costVaries: it.costVaries,
        income: it.income,
        ...(it.available ? {} : { disabledReason: it.reason ?? 'Går inte nu' }),
      }));
    },
    nextStep(before, actionId, performer, params) {
      const list = [...before.map(toSubmitted), toSubmitted({ uid: 'new', actionId, performer, params })];
      const r = nextParam(view, content, list, list.length - 1, registry);
      return r ? toStep(r) : null;
    },
    analyze,
    confirm: (draft) => opts.submit(draft.map(toSubmitted)),
    unlock: opts.unlock,
    isLocked: opts.isLocked,
  };
}
