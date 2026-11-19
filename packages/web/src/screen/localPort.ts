/**
 * Utvecklingsport: kör motorn i webbläsaren mot en kampanj i minnet.
 *
 * SPEC B1: i spelet ska motorn bara köras på servern och klienten bara få sin
 * `PlayerView`. Den här porten håller hela `GameState` och är därför bara för
 * utveckling och tester. En serverport implementerar samma `PlayerScreenPort`.
 */
import {
  DEFAULT_CONTENT,
  SKELETON_ACTIONS,
  analyzeSubmission,
  buildPlayerView,
  openRound,
  setLocked,
  submitActions,
  type ActionRegistry,
  type Content,
  type GameState,
  type PlayerId,
  type PlayerView,
  type RoundEvent,
  type RoundWindow,
  type Submission,
} from '@vampyre/engine';
import * as shim from './catalogShim';
import { buildMapModel, type Position, type Sighting } from './mapModel';
import type { DraftAction, DraftAnalysis, MainScreenData, PlayerScreenPort, VampireSummary } from './model';

export interface LocalPortOptions {
  state: GameState;
  playerId: PlayerId;
  events?: readonly RoundEvent[];
  content?: Content;
  registry?: ActionRegistry;
  positions?: Record<string, Position>;
  sightings?: readonly Sighting[];
}

/** Motorn har ingen klocka (M10). Utvecklingsporten använder en fast tid och en deadline långt fram. */
const NOW = 0;
const FAR_DEADLINE = Number.MAX_SAFE_INTEGER;

export function titleLabel(view: PlayerView, content: Content): string | null {
  const me = view.me;
  if (!me.title) return null;
  const name = content.titles[me.title].name;
  const domain = me.domain[0] ? view.cities.find((c) => c.id === me.domain[0])?.name : undefined;
  const ofDomain = (me.title === 'prince' || me.title === 'baron') && domain ? ` of ${domain}` : '';
  const disguise = me.disguise ? ` (som ${content.titles[me.disguise.title].name})` : '';
  return `${name}${ofDomain}${disguise}`;
}

export function createLocalPort(opts: LocalPortOptions): PlayerScreenPort {
  const content = opts.content ?? DEFAULT_CONTENT;
  const registry = opts.registry ?? SKELETON_ACTIONS;
  const { state, playerId } = opts;
  const ctx: shim.ShimContext = { state, content, registry, playerId };
  let window: RoundWindow = openRound(state, { seed: 'local-dev', deadline: FAR_DEADLINE });

  const submission = (draft: readonly DraftAction[]): Submission => ({
    playerId,
    actions: draft.map(shim.toSubmitted),
    royalPrivilegesToSpend: 0,
    locked: false,
    updatedAt: NOW,
  });

  const analyze = (draft: readonly DraftAction[]): DraftAnalysis => {
    const a = analyzeSubmission(state, submission(draft), { registry, content });
    const entries = draft.map((d, i) => ({
      label: shim.describe(ctx, draft.slice(0, i), d),
      performerName:
        d.performer.kind === 'vampire'
          ? (state.players[playerId]?.name ?? '')
          : (state.minions[d.performer.minionId as keyof GameState['minions']]?.name ?? '?'),
      performerKind: d.performer.kind,
      cost: shim.costOf(ctx, d),
      income: shim.incomeOf(d),
      errors: [
        ...shim.entryProblems(ctx, draft.slice(0, i), d),
        ...a.errors.filter((e) => e.entryIndex === i).map((e) => e.message),
      ],
    }));
    return {
      entries,
      apUsed: a.slotsUsed,
      apTotal: a.budget?.total ?? 0,
      totalCost: a.totalCost,
      totalIncome: entries.reduce((s, e) => s + (e.income ?? 0), 0),
      errors: a.errors.filter((e) => e.entryIndex === undefined).map((e) => e.message),
      warnings: a.warnings.map((w) => w.message),
      canConfirm: a.ok && entries.every((e) => e.errors.length === 0),
    };
  };

  return {
    load(): MainScreenData {
      const view = buildPlayerView(state, content, playerId, opts.events ? { events: opts.events } : {});
      const vampire: VampireSummary = {
        name: view.me.name,
        titleLabel: titleLabel(view, content),
        stats: { ...view.me.stats },
      };
      return {
        round: { round: view.round, maxRounds: view.maxRounds },
        resources: {
          blood: view.me.blood,
          vp: view.me.vp,
          artifacts: view.me.artifacts.length,
          minions: view.me.minions.length,
          votes: view.me.ivoryTowerVotes,
        },
        vampire,
        map: buildMapModel(view, {
          ...(opts.positions ? { positions: opts.positions } : {}),
          ...(opts.sightings ? { sightings: opts.sightings } : {}),
        }),
      };
    },
    actionChoices: (draft) => shim.actionChoices(ctx, draft),
    nextStep: (before, actionId, performer, params) => shim.nextStep(ctx, before, actionId, performer, params),
    analyze,
    confirm(draft) {
      const { locked: _l, updatedAt: _u, ...sub } = submission(draft);
      const res = submitActions(window, state, sub, NOW, { registry, content });
      if (!res.ok) return { ok: false, errors: res.validation.errors.map((e) => e.message) };
      window = setLocked(res.window, playerId, true, NOW);
      return { ok: true, errors: [] };
    },
    unlock() {
      if (window.submissions[playerId]) window = setLocked(window, playerId, false, NOW);
    },
    isLocked: () => window.submissions[playerId]?.locked === true,
  };
}
