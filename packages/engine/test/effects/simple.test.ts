import { describe, expect, it } from 'vitest';
import { ACTION_CATALOG, stubbedActionIds } from '../../src/catalog/registry.js';
import { resolveRound } from '../../src/round/resolve.js';
import type { RoundEvent, RoundResult, SubmittedAction } from '../../src/round/types.js';
import type { CityId, MinionId, PlayerId } from '../../src/state/ids.js';
import { cloneJson } from '../../src/state/json.js';
import { playerStat } from '../../src/state/queries.js';
import type { GameState, Mutable } from '../../src/state/types.js';
import { assertValidState } from '../../src/state/validate.js';
import { content, e, sub, subs, v, world, type World } from '../round/fixtures.js';

const opts = { content, registry: ACTION_CATALOG };

function run(w: World, lists: Record<string, SubmittedAction[]>, state: GameState = w.state): RoundResult & { status: 'completed' } {
  const s = subs(...Object.entries(lists).map(([k, actions]) => sub(w.P[k]!, actions)));
  const r = resolveRound(state, s, 'r1', opts);
  if (r.status !== 'completed') throw new Error('väntade completed');
  assertValidState(r.state, content);
  return r;
}

const events = (r: RoundResult, kind: string): RoundEvent[] => r.resolution.events.filter((ev) => ev.kind === kind);
const status = (r: RoundResult, pid: PlayerId, i: number) => r.resolution.entries[e(pid, i)]!.status;
/** Staten som den var under ronden (modifiers som gällde rond 1). */
const duringRound = (s: GameState): GameState => ({ ...cloneJson(s), round: 1 }) as GameState;

describe('personliga buffar', () => {
  it('Watchful Eyes, In the Shadows och Blood for Blood ger +1 ronden ut', () => {
    const w = world({ a: { title: 'prince' } });
    const r = run(w, { a: [v('watchful_eyes'), v('in_the_shadows'), v('blood_for_blood')] });
    const s = duringRound(r.state);
    expect(playerStat(s, content, w.P.a!, 'intercept')).toBe(1);
    expect(playerStat(s, content, w.P.a!, 'stealth')).toBe(1);
    expect(playerStat(s, content, w.P.a!, 'strength')).toBe(1);
    // Nästa rond är buffarna borta.
    expect(playerStat(r.state, content, w.P.a!, 'intercept')).toBe(0);
    expect(events(r, 'stat_buffed').every((ev) => ev.audience.kind === 'players')).toBe(true);
  });

  it('Hide ger +5 stealth trots Rule of Three (E15)', () => {
    const w = world({ a: { title: null } });
    const r = run(w, { a: [v('hide')] });
    expect(playerStat(duringRound(r.state), content, w.P.a!, 'stealth')).toBe(5);
  });

  it('buffen syns för aktioner senare samma rond: In the Shadows döljer en Bleed för en vampyr med intercept 0 (M16: syns vid intercept ≥ stealth)', () => {
    const w = world({ a: { title: null, clan: 'brujah' }, o: { title: null } });
    const s = w.state;
    const seen = (lists: SubmittedAction[]) =>
      events(run(w, { a: lists }, s), 'action_observed').filter(
        (ev) => ev.data!.actionId === 'bleed' && ev.audience.kind === 'players' && ev.audience.ids.includes(w.P.o!),
      ).length;
    expect(seen([v('bleed')])).toBe(1);
    expect(seen([v('in_the_shadows'), v('bleed')])).toBe(0);
  });
});

describe('minions', () => {
  it('Get a Minion skapar minionen i vampyrens stad; ingen upkeep samma rond', () => {
    const w = world({ a: { title: null, location: 'east', blood: 100 } });
    const r = run(w, { a: [v('get_a_minion', { type: 'ghoul', level: 2 })] });
    const [ev] = events(r, 'minion_recruited');
    const id = ev!.data!.minionId as MinionId;
    const m = r.state.minions[id]!;
    expect(m).toMatchObject({ type: 'ghoul', level: 2, location: 'east', acquiredRound: 1, owner: { kind: 'player', id: w.P.a! } });
    expect(r.state.players[w.P.a!]!.blood).toBe(50);
    expect(ev!.audience).toEqual({ kind: 'players', ids: [w.P.a!] });
  });

  it('The broken pyramid (Tremere) kan inte rekrytera Lvl 3', () => {
    const w = world({ a: { title: null, clan: 'tremere', blood: 200 } });
    const r = run(w, { a: [v('get_a_minion', { type: 'ghoul', level: 3 })] });
    expect(status(r, w.P.a!, 0)).not.toBe('resolved');
    expect(Object.keys(r.state.minions)).toHaveLength(0);
    expect(r.state.players[w.P.a!]!.blood).toBe(200);
  });

  it('Bestow Gifts höjer en egen minion en level', () => {
    const w = world({ a: { title: null } }, { gh: { owner: 'a', type: 'ghoul', level: 1 } });
    const r = run(w, { a: [v('bestow_gifts', { minionId: w.M.gh! })] });
    expect(r.state.minions[w.M.gh!]!.level).toBe(2);
  });
});

describe('Awaken', () => {
  it('i torpor: tre Awaken (en per rond) väcker vampyren', () => {
    const w = world({ a: { title: null, status: 'torpor' } });
    let state = w.state;
    for (let i = 0; i < 3; i++) {
      const r = run(w, { a: [v('awaken', { target: w.P.a! })] }, state);
      expect(events(r, 'torpor_progress')[0]!.data).toMatchObject({ progress: i + 1, awake: i === 2 });
      state = r.state;
    }
    expect(state.players[w.P.a!]!.status).toBe('active');
    expect(state.players[w.P.a!]!.torpor).toBeNull();
  });

  it('en annan vampyr i samma stad kan väcka; Salubri ger två ticks; målet får inte veta vem', () => {
    const w = world({ t: { title: null, status: 'torpor' }, s: { title: null, clan: 'salubri' } });
    const r = run(w, { s: [v('awaken', { target: w.P.t! })] });
    expect(r.state.players[w.P.t!]!.torpor!.progress).toBe(2);
    const [ev] = events(r, 'torpor_progress');
    expect(ev!.audience).toEqual({ kind: 'players', ids: [w.P.t!] });
    expect(JSON.stringify(ev!.data)).not.toContain(w.P.s!);
  });

  it('Awaken misslyckas om målet inte är i torpor eller i en annan stad', () => {
    const w = world({ t: { title: null, status: 'torpor', location: 'east' }, s: { title: null }, u: { title: null } });
    const r = run(w, { s: [v('awaken', { target: w.P.t! })], u: [v('awaken', { target: w.P.s! })] });
    expect(status(r, w.P.s!, 0)).toBe('failed');
    expect(status(r, w.P.u!, 0)).toBe('failed');
    expect(r.state.players[w.P.t!]!.torpor!.progress).toBe(0);
  });
});

describe('Control the Masquerade', () => {
  it('+1 masquerade, högst 5; når 5 lagas en violation publikt', () => {
    const w = world({ a: { title: 'prince' } });
    expect(run(w, { a: [v('control_the_masquerade', { city: 'north' })] }).state.cities['north' as CityId]!.masquerade).toBe(4);

    const s = cloneJson(w.state) as Mutable<GameState>;
    s.cities['north' as CityId]!.masquerade = 4;
    s.cities['north' as CityId]!.masqueradeViolation = { sinceRound: 1 };
    const r = run(w, { a: [v('control_the_masquerade', { city: 'north' })] }, s as GameState);
    expect(r.state.cities['north' as CityId]!.masquerade).toBe(5);
    expect(r.state.cities['north' as CityId]!.masqueradeViolation).toBeNull();
    expect(events(r, 'masquerade_violation_mended')[0]!.audience).toEqual({ kind: 'public' });
  });
});

it('steg 2:s effekter är inte stubbar', () => {
  const stubs = new Set(stubbedActionIds());
  for (const id of ['watchful_eyes', 'in_the_shadows', 'blood_for_blood', 'hide', 'get_a_minion', 'bestow_gifts', 'awaken', 'control_the_masquerade']) {
    expect(stubs.has(id), id).toBe(false);
  }
});
