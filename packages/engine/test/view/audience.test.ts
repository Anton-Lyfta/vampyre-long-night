import { describe, expect, it } from 'vitest';
import { observersOfAction, type ObservedAction } from '../../src/view/audience.js';
import type { CityId, GameState, MinionId, Mutable } from '../../src/index.js';
import { cloneJson } from '../../src/index.js';
import { content, P, sampleState } from '../fixtures.js';

// sampleState: inner (south, äger Eye LV2 Jenny i south), justicar (north, äger Archon LV2),
// prince (north, controller av north, Primogen LV1 i north, Stealth 1), baron (west),
// bishop (east, controller av east), untitled (isle). Stadsintercept: north 1, east 2, south 3.

function stateWith(edit: (s: Mutable<GameState>) => void = () => {}): GameState {
  const s = cloneJson(sampleState()) as Mutable<GameState>;
  s.round = 1;
  s.phase = 'submission';
  edit(s);
  return s as GameState;
}

const vampire = (playerId: string, stealth: ObservedAction['stealth'], targetCities: string[] = []): ObservedAction => ({
  playerId: playerId as ObservedAction['playerId'],
  performer: { kind: 'vampire' },
  stealth,
  targetCities: targetCities as CityId[],
});

const minionByName = (s: GameState, name: string): MinionId => Object.values(s.minions).find((m) => m.name === name)!.id;

describe('observersOfAction (M16–M19)', () => {
  it('vampyr i samma stad ser vid intercept ≥ stealth, controllern via stadens intercept', () => {
    const s = stateWith();
    // Justicar (Stealth 0) + aktion 0 = 0: Prince ser både personligen och som controller.
    expect(observersOfAction(s, content, vampire(P.justicar, 0))).toEqual({ kind: 'players', ids: [P.prince] });
    // 1: Princens intercept 0 räcker inte, men north har intercept 1 (≥).
    expect(observersOfAction(s, content, vampire(P.justicar, 1))).toEqual({ kind: 'players', ids: [P.prince] });
    // 2: ingen.
    expect(observersOfAction(s, content, vampire(P.justicar, 2))).toEqual({ kind: 'players', ids: [] });
  });

  it('gränsen är ≥, inte > (M16)', () => {
    const s = stateWith((x) => {
      x.players[P.prince]!.modifiers.push({ stat: 'intercept', amount: 2, source: 'test', expiresAfterRound: null });
    });
    // Prince har intercept 2, north 1: stealth 2 syns bara personligen, 3 inte alls.
    expect(observersOfAction(s, content, vampire(P.justicar, 2))).toEqual({ kind: 'players', ids: [P.prince] });
    expect(observersOfAction(s, content, vampire(P.justicar, 3))).toEqual({ kind: 'players', ids: [] });
  });

  it('controllern av målstaden ser (gd:115)', () => {
    const s = stateWith();
    // Total stealth 1. North (start) har intercept 1, east (mål) har 2.
    expect(observersOfAction(s, content, vampire(P.justicar, 1, ['east']))).toEqual({
      kind: 'players',
      ids: [P.prince, P.bishop],
    });
    // Stealth 3 > båda städernas intercept.
    expect(observersOfAction(s, content, vampire(P.justicar, 3, ['east']))).toEqual({ kind: 'players', ids: [] });
  });

  it('torpida och brända vampyrer observerar inte, inte heller som controller', () => {
    const s = stateWith((x) => {
      x.players[P.prince]!.status = 'torpor';
      x.players[P.prince]!.torpor = { progress: 0, required: 3, sinceRound: 1 };
    });
    expect(observersOfAction(s, content, vampire(P.justicar, 0))).toEqual({ kind: 'players', ids: [] });
  });

  it('Informant-minions (Eye, Archon) rapporterar till ägaren; andra minions inte (M19)', () => {
    const s = stateWith((x) => {
      x.players[P.untitled]!.location = 'south' as CityId;
    });
    // Untitled i south, stealth 0 + 2 = 2. Jenny (Eye LV2) har intercept 2 → Inner. South är okontrollerad.
    expect(observersOfAction(s, content, vampire(P.untitled, 2))).toEqual({ kind: 'players', ids: [P.inner] });
    expect(observersOfAction(s, content, vampire(P.untitled, 3))).toEqual({ kind: 'players', ids: [] });

    // Princens Primogen observerar inte: ta bort Archon, flytta Prince bort och Baron till north.
    const t = stateWith((x) => {
      delete x.minions[minionByName(x as GameState, 'Mary Stuart')];
      x.players[P.baron]!.location = 'north' as CityId;
      x.players[P.prince]!.location = 'west' as CityId;
    });
    // Baron i north, stealth 2: Primogen (LV1) ser inget, north (intercept 1) ser inget.
    expect(observersOfAction(t, content, vampire(P.baron, 2))).toEqual({ kind: 'players', ids: [] });
  });

  it('minion som utför: startstad = minionens stad, egen ägare räknas bort', () => {
    const s = stateWith();
    const enzo = minionByName(s, 'Enzo Romano'); // Primogen LV1 i north: Stealth 1.
    const action: ObservedAction = { playerId: P.prince, performer: { kind: 'minion', minionId: enzo }, stealth: 0, targetCities: [] };
    // Total 1. Justicar (intercept 0) nej, Archon LV2 (intercept 2) ja → Justicar. Prince är ägaren.
    expect(observersOfAction(s, content, action)).toEqual({ kind: 'players', ids: [P.justicar] });
  });

  it('undetectable syns för ingen, cant_be_hidden för alla', () => {
    const s = stateWith();
    expect(observersOfAction(s, content, vampire(P.justicar, 'undetectable', ['east']))).toEqual({ kind: 'players', ids: [] });
    expect(observersOfAction(s, content, vampire(P.justicar, 'cant_be_hidden'))).toEqual({ kind: 'public' });
  });
});
