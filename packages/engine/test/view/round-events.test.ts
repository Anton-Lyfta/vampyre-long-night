import { describe, expect, it } from 'vitest';
import {
  buildPlayerView,
  createDemoGame,
  createDemoRound,
  createRegistry,
  DEMO_PLAYERS,
  resolveRound,
  SKELETON_ACTIONS,
  startGame,
  type ActionDefinition,
  type CityId,
  type PlayerId,
  type Submission,
} from '../../src/index.js';
import { content, P, sampleState } from '../fixtures.js';

/** Resa med mål: synligheten räknas i avreseorten innan handlern flyttar vampyren (M18). */
const travel: ActionDefinition = {
  id: 'travel',
  name: 'Travel',
  category: 'personal',
  performer: 'vampire',
  stealth: 1,
  cost: 0,
  targets: ({ entry }) => ({ cities: [entry.action.params!.to as CityId] }),
  destination: ({ entry }) => entry.action.params!.to as CityId,
  resolve: (ctx) => {
    ctx.player.location = ctx.entry.action.params!.to as CityId;
    ctx.emit('arrived', { city: ctx.player.location });
    return { status: 'resolved' };
  },
};
const registry = createRegistry([...Object.values(SKELETON_ACTIONS), travel]);

const sub = (playerId: PlayerId, actions: Submission['actions']): Submission => ({
  playerId,
  actions,
  royalPrivilegesToSpend: 0,
  locked: true,
  updatedAt: 0,
});

describe('rondens events får publik (M18)', () => {
  const state = startGame(sampleState());
  const result = resolveRound(
    state,
    { [P.justicar]: sub(P.justicar, [{ actionId: 'travel', performer: { kind: 'vampire' }, params: { to: 'east' } }]) },
    'r1',
    { content, registry },
  );
  if (result.status !== 'completed') throw new Error('oväntad paus');
  const { events } = result.resolution;
  const view = (pid: PlayerId) => buildPlayerView(result.state, content, pid, { events });

  it('alla events har en publik', () => {
    for (const e of events) expect(e.audience).toBeDefined();
  });

  it('observatörer räknas i avreseorten och målstaden', () => {
    const observed = events.find((e) => e.kind === 'action_observed')!;
    // North (start, intercept 1) → Prince; east (mål, intercept 2) → Bishop. Stealth 0 + 1 = 1.
    expect(observed.audience).toEqual({ kind: 'players', ids: [P.prince, P.bishop] });
    expect(observed.data).toEqual({
      actionId: 'travel',
      performer: { kind: 'vampire', playerId: P.justicar },
      targets: { cities: ['east'], players: [], minions: [] },
      at: 'east',
    });
  });

  it('observatören ser vem, aktion och mål, men inte aktörens egna events', () => {
    const kinds = view(P.prince).events.map((e) => e.kind);
    expect(kinds).toContain('action_observed');
    expect(kinds).not.toContain('arrived');
    expect(view(P.prince).events.filter((e) => e.playerId === P.justicar)).toEqual([]);
  });

  it('aktören ser sina egna events men inte vem som såg', () => {
    const v = view(P.justicar);
    expect(v.events.map((e) => e.kind)).toEqual(expect.arrayContaining(['actions_paid', 'action_resolved', 'arrived']));
    expect(v.events.map((e) => e.kind)).not.toContain('action_observed');
    expect(JSON.stringify(v.events)).not.toContain('audience');
  });

  it('betalning och upkeep är privata; slotordning bara för GM; ny rond publik', () => {
    const baron = view(P.baron).events;
    expect(baron.filter((e) => e.kind === 'actions_paid' || e.kind === 'upkeep_paid').every((e) => e.playerId === P.baron)).toBe(true);
    expect(baron.map((e) => e.kind)).not.toContain('slot_started');
    expect(baron.map((e) => e.kind)).toContain('round_advanced');
    expect(baron.map((e) => e.kind)).not.toContain('action_observed');
  });
});

describe('demokampanjen', () => {
  it('startar i rond 1 och ger en vy för varje spelare', () => {
    const state = createDemoGame();
    expect(state.round).toBe(1);
    for (const pid of Object.values(DEMO_PLAYERS)) {
      const v = buildPlayerView(state, content, pid);
      expect(v.me.id).toBe(pid);
      expect(v.players).toHaveLength(5);
      expect(v.cities.length).toBeGreaterThan(0);
    }
  });

  it('demorondens events filtreras, och den dolda Archbishopen syns bara för sig själv', () => {
    const { state, events } = createDemoRound();
    expect(state.round).toBe(2);
    for (const pid of Object.values(DEMO_PLAYERS)) {
      const json = JSON.stringify(buildPlayerView(state, content, pid, { events }));
      expect(json.includes('"archbishop"')).toBe(pid === DEMO_PLAYERS.hiddenArchbishop);
      expect(json.includes('slot_started')).toBe(false);
    }
  });

  it('egen vy har härledda värden', () => {
    const v = buildPlayerView(createDemoGame(), content, DEMO_PLAYERS.innerCircle);
    expect(v.me.vp).toBe(3);
    expect(v.me.baseActionBudget).toBeGreaterThan(0);
    expect(v.me.minions.map((m) => m.name)).toEqual(['Ronald', 'Jenny Wren']);
    expect(v.me.artifacts.map((a) => a.definition)).toEqual(['black_gloves']);
    const hidden = v.players.find((p) => p.id === DEMO_PLAYERS.hiddenArchbishop)!;
    expect(hidden).toMatchObject({ title: 'prince', faction: 'camarilla' });
    expect(hidden.sabbatIdentity).toBeUndefined();
  });
});
