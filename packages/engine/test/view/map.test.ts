/**
 * Kartvyn (V15–V19): bara garanterad information.
 *
 * sampleState: inner (south, Eye Jenny + ghouls), justicar (north, Archon Mary Stuart),
 * prince (north, controller av north), baron (west, controller av west),
 * bishop (east, dold Archbishop som Prince, controller av east), untitled (isle).
 */
import { describe, expect, it } from 'vitest';
import {
  buildPlayerView,
  cloneJson,
  createRegistry,
  resolveRound,
  SKELETON_ACTIONS,
  startGame,
  type ActionDefinition,
  type CityId,
  type GameState,
  type MapOccupant,
  type MinionId,
  type Mutable,
  type PlayerId,
  type RoundEvent,
  type Submission,
  type SubmittedAction,
} from '../../src/index.js';
import { content, P, sampleState } from '../fixtures.js';

const to = (ctx: { entry: { action: SubmittedAction } }) => ctx.entry.action.params!.to as CityId;

/** Synlig förflyttning (stealth +1): destinationen är både mål och slutposition. */
const travel: ActionDefinition = {
  id: 'travel',
  name: 'Travel',
  category: 'personal',
  performer: 'vampire',
  stealth: 1,
  cost: 0,
  targets: (ctx) => ({ cities: [to(ctx)] }),
  destination: to,
  resolve: (ctx) => {
    ctx.player.location = to(ctx);
    return { status: 'resolved' };
  },
};

/** Osynlig förflyttning. */
const sneak: ActionDefinition = { ...travel, id: 'sneak', name: 'Sneak', stealth: 'undetectable' };

/** Aktion på plats, valfritt riktad mot en annan stad (params.target). */
const scheme: ActionDefinition = {
  id: 'scheme',
  name: 'Scheme',
  category: 'personal',
  performer: 'vampire',
  stealth: -5,
  cost: 0,
  targets: ({ entry }) => (entry.action.params?.target ? { cities: [entry.action.params.target as CityId] } : {}),
  resolve: () => ({ status: 'resolved' }),
};

/** Minionaktion på plats. */
const lurk: ActionDefinition = {
  id: 'lurk',
  name: 'Lurk',
  category: 'minion',
  performer: 'minion',
  stealth: -5,
  cost: 0,
  resolve: () => ({ status: 'resolved' }),
};

/** Search-liknande: handlern berättar för aktören var en namngiven vampyr är (`sighted`). */
const peek: ActionDefinition = {
  id: 'peek',
  name: 'Peek',
  category: 'personal',
  performer: 'vampire',
  stealth: 'undetectable',
  cost: 0,
  resolve: (ctx) => {
    const target = ctx.state.players[ctx.entry.action.params!.player as PlayerId]!;
    ctx.emit('sighted', { subject: { kind: 'vampire', playerId: target.id }, at: target.location });
    return { status: 'resolved' };
  },
};

const registry = createRegistry([...Object.values(SKELETON_ACTIONS), travel, sneak, scheme, lurk, peek]);

const vamp = (actionId: string, params?: SubmittedAction['params']): SubmittedAction =>
  params ? { actionId, performer: { kind: 'vampire' }, params } : { actionId, performer: { kind: 'vampire' } };

type Plan = Partial<Record<PlayerId, SubmittedAction[]>>;

function play(state: GameState, plan: Plan, seed = 'map'): { state: GameState; events: RoundEvent[] } {
  const subs: Record<PlayerId, Submission> = {};
  for (const [pid, actions] of Object.entries(plan) as [PlayerId, SubmittedAction[]][]) {
    subs[pid] = { playerId: pid, actions, royalPrivilegesToSpend: 0, locked: true, updatedAt: 0 };
  }
  const r = resolveRound(state, subs, seed, { content, registry });
  if (r.status !== 'completed') throw new Error('oväntad paus');
  return { state: r.state, events: r.resolution.events };
}

const minionByName = (s: GameState, name: string): MinionId => Object.values(s.minions).find((m) => m.name === name)!.id;

/** Vilka andra (inte egna) som syns var på kartan. */
function othersOnMap(state: GameState, viewer: PlayerId, events: readonly RoundEvent[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of buildPlayerView(state, content, viewer, { events }).map.cities) {
    const names = c.occupants.filter((o) => !o.own).map((o: MapOccupant) => o.name);
    if (names.length) out[c.id] = names;
  }
  return out;
}

describe('kartan: städer och kopplingar', () => {
  const view = buildPlayerView(startGame(sampleState()), content, P.baron);

  it('alla städer med position, grannar och controllerns skenbara sekt', () => {
    const byId = Object.fromEntries(view.map.cities.map((c) => [c.id, c]));
    expect(Object.keys(byId)).toEqual(['east', 'isle', 'north', 'south', 'west']);
    expect(byId.north).toMatchObject({ controllerId: P.prince, faction: 'camarilla', position: { x: 200, y: 100 } });
    expect(byId.west).toMatchObject({ controllerId: P.baron, faction: 'anarch' });
    // Dold Archbishop: staden färgas som förklädnaden.
    expect(byId.east).toMatchObject({ controllerId: P.bishop, faction: 'camarilla' });
    expect(byId.south).toMatchObject({ controllerId: null, faction: null, contested: false });
  });

  it('varje grannpar en gång', () => {
    expect(view.map.connections).toEqual([
      ['east', 'north'],
      ['east', 'south'],
      ['isle', 'south'],
      ['north', 'south'],
      ['north', 'west'],
      ['south', 'west'],
    ]);
  });
});

describe('kartan: egna pjäser och resursraden', () => {
  const state = startGame(sampleState());

  it('egen vampyr och egna minions syns alltid, andra inte utan observationer', () => {
    const v = buildPlayerView(state, content, P.inner);
    expect(v.map.sightingsFromRound).toBeNull();
    const south = v.map.cities.find((c) => c.id === 'south')!;
    expect(south.occupants.map((o) => [o.kind, o.name, o.own])).toEqual([
      ['vampire', 'Lady Inner', true],
      ['minion', 'Ron', true],
      ['minion', 'Jenny', true],
      ['minion', 'G1', true],
      ['minion', 'G2', true],
    ]);
    for (const pid of Object.values(P)) expect(othersOnMap(state, pid, [])).toEqual({});
  });

  it('resursraden', () => {
    const v = buildPlayerView(state, content, P.inner);
    expect(v.resources).toEqual({ blood: v.me.blood, vp: 3, artifacts: 1, minions: 4, ivoryTowerVotes: 4 });
    expect(buildPlayerView(state, content, P.baron).resources.ivoryTowerVotes).toBe(0);
  });
});

describe('kartan: andras positioner (V16, V17)', () => {
  const start = startGame(sampleState());

  it('en observerad förflyttning visar vampyren i destinationen för dem som såg den', () => {
    const r = play(start, { [P.justicar]: [vamp('travel', { to: 'east' })] });
    expect(r.state.round).toBe(2);
    // Prince såg avresan i north, Bishop ankomsten som controller av east.
    expect(othersOnMap(r.state, P.prince, r.events)).toEqual({ east: ['Justicar Judge'] });
    expect(othersOnMap(r.state, P.bishop, r.events)).toEqual({ east: ['Justicar Judge'] });
    expect(othersOnMap(r.state, P.baron, r.events)).toEqual({});
    expect(buildPlayerView(r.state, content, P.prince, { events: r.events }).map.sightingsFromRound).toBe(1);
  });

  it('sedd, sedan lämnat osedd: ingen "last known position"', () => {
    const r = play(start, { [P.justicar]: [vamp('scheme'), vamp('sneak', { to: 'west' })] });
    const prince = buildPlayerView(r.state, content, P.prince, { events: r.events });
    expect(prince.events.some((e) => e.kind === 'action_observed')).toBe(true);
    expect(othersOnMap(r.state, P.prince, r.events)).toEqual({});
  });

  it('sedd på plats och kvar: syns där', () => {
    const r = play(start, { [P.justicar]: [vamp('scheme')] });
    expect(othersOnMap(r.state, P.prince, r.events)).toEqual({ north: ['Justicar Judge'] });
  });

  it('bara som controller av målstaden: vet vem och vad, inte var', () => {
    const r = play(start, { [P.baron]: [vamp('scheme', { target: 'east' })] });
    const observed = r.events.filter((e) => e.kind === 'action_observed');
    const bishopEvent = observed.find((e) => e.audience.kind === 'players' && e.audience.ids.includes(P.bishop))!;
    expect(bishopEvent.data).not.toHaveProperty('at');
    expect(bishopEvent.audience).toEqual({ kind: 'players', ids: [P.bishop] });
    expect(othersOnMap(r.state, P.bishop, r.events)).toEqual({});
  });

  it('observerad minion syns med typ och ägare', () => {
    const s = start;
    const mary = minionByName(s, 'Mary Stuart');
    const r = play(s, { [P.justicar]: [{ actionId: 'lurk', performer: { kind: 'minion', minionId: mary } }] });
    const north = buildPlayerView(r.state, content, P.prince, { events: r.events }).map.cities.find((c) => c.id === 'north')!;
    expect(north.occupants.filter((o) => !o.own)).toEqual([
      { kind: 'minion', minionId: mary, name: 'Mary Stuart', ownerId: P.justicar, type: 'archon', level: 2, own: false },
    ]);
  });

  it('sighted-event (Search m.fl.) placerar subjektet för mottagaren', () => {
    const r = play(start, { [P.baron]: [vamp('peek', { player: P.untitled })] });
    expect(othersOnMap(r.state, P.baron, r.events)).toEqual({ isle: ['Nobody'] });
    expect(othersOnMap(r.state, P.prince, r.events)).toEqual({});
  });

  it('observationer gäller bara senast upplösta ronden', () => {
    const r1 = play(start, { [P.justicar]: [vamp('scheme')] }, 'r1');
    const r2 = play(r1.state, {}, 'r2');
    expect(othersOnMap(r2.state, P.prince, [...r1.events, ...r2.events])).toEqual({});
  });

  it('bränd vampyr eller minion med ny ägare försvinner från kartan', () => {
    const mary = minionByName(start, 'Mary Stuart');
    const r = play(start, {
      [P.justicar]: [vamp('scheme'), { actionId: 'lurk', performer: { kind: 'minion', minionId: mary } }],
    });
    const s = cloneJson(r.state) as Mutable<GameState>;
    s.players[P.justicar]!.status = 'burned';
    s.players[P.justicar]!.location = null;
    s.minions[mary]!.owner = { kind: 'player', id: P.inner };
    expect(othersOnMap(s as GameState, P.prince, r.events)).toEqual({});
  });
});

describe('kartan läcker inget utan observation', () => {
  it('ingen spelare ser någon annans pjäs utan ett synligt event med position', () => {
    const start = startGame(sampleState());
    const r = play(start, {
      [P.justicar]: [vamp('sneak', { to: 'south' })],
      [P.baron]: [vamp('scheme', { target: 'east' })],
      [P.untitled]: [vamp('scheme')],
    });
    for (const viewer of Object.values(P)) {
      const v = buildPlayerView(r.state, content, viewer, { events: r.events });
      const seen = new Set(
        v.events
          .filter((e) => (e.kind === 'action_observed' || e.kind === 'sighted') && e.data && 'at' in e.data)
          .map((e) => JSON.stringify(e.data!.performer ?? e.data!.subject)),
      );
      for (const c of v.map.cities) {
        for (const o of c.occupants.filter((x) => !x.own)) {
          const key =
            o.kind === 'vampire'
              ? JSON.stringify({ kind: 'vampire', playerId: o.playerId })
              : JSON.stringify({ kind: 'minion', minionId: o.minionId, controllerId: o.ownerId });
          expect(seen.has(key)).toBe(true);
        }
      }
    }
  });
});
