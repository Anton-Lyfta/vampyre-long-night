import { describe, expect, it } from 'vitest';
import { DEMO_PLAYERS, createDemoRound } from '@vampyre/engine';
import { createLocalPort } from '../src/screen/localPort';
import { createDemoPort } from '../src/screen/demo';
import type { DraftAction } from '../src/screen/model';

const v = { kind: 'vampire' } as const;
let n = 0;
const act = (actionId: string, params: DraftAction['params'] = {}, performer: DraftAction['performer'] = v): DraftAction => ({
  uid: `t${++n}`,
  actionId,
  performer,
  params,
});

describe('localPort: data', () => {
  it('resurser, vampyr och rond för Prince', () => {
    const d = createDemoPort('prince').load();
    expect(d.resources).toMatchObject({ minions: 1, artifacts: 0 });
    expect(d.resources.blood).toBeGreaterThan(0);
    expect(d.vampire.name).toBe('Prince Edmund Hale');
    expect(d.vampire.titleLabel).toBe('Prince of North');
    expect(d.vampire.stats.intercept).toBeGreaterThanOrEqual(1);
    expect(d.round).toEqual({ round: 2, maxRounds: 8 });
  });

  it('dold Archbishop ser sin sanna titel och förklädnaden', () => {
    expect(createDemoPort('hiddenArchbishop').load().vampire.titleLabel).toBe('Archbishop (som Prince)');
  });

  it('kartan har alla städer, kopplingar och controller-faction som spelaren ser den', () => {
    const map = createDemoPort('prince').load().map;
    expect(map.cities.map((c) => c.id).sort()).toEqual(['east', 'isle', 'north', 'south', 'west']);
    expect(map.links).toHaveLength(6);
    const f = Object.fromEntries(map.cities.map((c) => [c.id, c.faction]));
    // East styrs av den dolda Archbishop som syns som Camarilla-Prince.
    expect(f).toMatchObject({ north: 'camarilla', west: 'anarch', east: 'camarilla', south: null });
  });

  it('kartan visar bara egna pjäser (ingen annan info finns än)', () => {
    const map = createDemoPort('prince').load().map;
    const pieces = map.cities.flatMap((c) => c.pieces.map((p) => ({ ...p, city: c.id })));
    expect(pieces.every((p) => p.own)).toBe(true);
    expect(pieces.map((p) => `${p.kind}:${p.city}`).sort()).toEqual(['minion:north', 'vampire:north']);
  });

  it('positioner faller tillbaka på en layout när kartan saknar dem', () => {
    const { state } = createDemoRound();
    const map = createLocalPort({ state, playerId: DEMO_PLAYERS.prince }).load().map;
    expect(new Set(map.cities.map((c) => `${c.x},${c.y}`)).size).toBe(5);
  });
});

describe('localPort: actions', () => {
  it('listar vampyrens och minionernas actions', () => {
    const choices = createDemoPort('innerCircle').actionChoices([]);
    expect(choices.some((c) => c.actionId === 'reward_loyalty' && c.performerKind === 'vampire')).toBe(true);
    expect(choices.some((c) => c.actionId === 'go_anarch')).toBe(true);
    expect(choices.some((c) => c.actionId === 'call_a_crusade')).toBe(false);
    const ronald = choices.filter((c) => c.performerName === 'Ronald').map((c) => c.actionId);
    expect(ronald).toEqual(expect.arrayContaining(['minion_move', 'bleed_the_enemy']));
    const jenny = choices.filter((c) => c.performerName === 'Jenny Wren').map((c) => c.actionId);
    expect(jenny).not.toContain('bleed_the_enemy');
  });

  it('Attack är avstängd när inga mål är kända', () => {
    const attack = createDemoPort('prince').actionChoices([]).find((c) => c.actionId === 'attack');
    expect(attack?.disabledReason).toBe('Inga kända mål');
  });

  it('Move erbjuder grannstäder från platsen efter tidigare Move', () => {
    const port = createDemoPort('prince');
    const first = port.nextStep([], 'move', v, {});
    expect(first?.kind === 'select' && first.options.map((o) => o.value).sort()).toEqual(['east', 'south', 'west']);
    const second = port.nextStep([act('move', { to: 'south' })], 'move', v, {});
    expect(second?.kind === 'select' && second.options.map((o) => o.value).sort()).toEqual(['east', 'isle', 'north', 'west']);
    expect(port.nextStep([], 'move', v, { to: 'east' })).toBeNull();
    expect(port.nextStep([], 'bleed', v, {})).toBeNull();
  });

  it('analys: etiketter, kostnad, AP och för många actions', () => {
    const port = createDemoPort('prince');
    const draft = [act('bleed'), act('move', { to: 'south' }), act('move', { to: 'isle' }), act('bleed')];
    const a = port.analyze(draft);
    expect(a.entries.map((e) => e.label)).toEqual([
      'Bleed i North',
      'Move från North till South',
      'Move från South till Isle',
      'Bleed i Isle',
    ]);
    expect(a.entries.map((e) => e.cost)).toEqual([0, 10, 10, 0]);
    expect(a.totalCost).toBe(20);
    expect(a.apUsed).toBe(4);
    expect(a.apUsed > a.apTotal).toBe(a.apTotal < 4);
    const many = port.analyze([...draft, ...Array.from({ length: 6 }, () => act('bleed'))]);
    expect(many.apUsed).toBe(10);
    expect(many.canConfirm).toBe(false);
  });

  it('en Move som inte längre går efter omsortering flaggas', () => {
    const port = createDemoPort('prince');
    const a = port.analyze([act('move', { to: 'isle' }), act('move', { to: 'south' })]);
    expect(a.entries[0]!.errors[0]).toMatch(/inte granne/);
    expect(a.canConfirm).toBe(false);
  });

  it('minionaktioner räknas inte som vampyrens AP', () => {
    const port = createDemoPort('innerCircle');
    const ronald = port.actionChoices([]).find((c) => c.performerName === 'Ronald' && c.actionId === 'minion_move')!;
    const a = port.analyze([act('bleed'), act('minion_move', { to: 'north' }, ronald.performer)]);
    expect(a.apUsed).toBe(1);
    expect(a.entries[1]).toMatchObject({ label: 'Move från South till North', performerName: 'Ronald', cost: 5, errors: [] });
    expect(a.totalCost).toBe(5);
  });

  it('confirm låser listan och unlock låser upp', () => {
    const port = createDemoPort('prince');
    expect(port.isLocked()).toBe(false);
    expect(port.confirm([act('bleed')])).toEqual({ ok: true, errors: [] });
    expect(port.isLocked()).toBe(true);
    port.unlock();
    expect(port.isLocked()).toBe(false);
  });
});
