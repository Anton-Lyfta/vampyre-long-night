import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONTENT,
  TEST_MAP,
  addCharacter,
  buildCampaignInput,
  canonicalJson,
  createGameState,
  createLobby,
  deriveCharacter,
  emptyBacklog,
  joinCampaign,
  leaveCampaign,
  listCharacters,
  playerStat,
  playerVp,
  removeCharacter,
  updateCharacter,
  validateCharacterBuild,
  validateState,
  type CampaignLobby,
  type CharacterBacklog,
  type CharacterBuild,
  type CharacterId,
  type CityId,
  type PlayerId,
} from '../src/index.js';

const content = DEFAULT_CONTENT;

const INNER_CIRCLE: CharacterBuild = {
  name: 'Lady Margaret',
  concept: 'Gammal pengar, nya fiender.',
  clan: 'ventrue',
  title: 'inner_circle',
  disguise: null,
  minions: {
    packageIndex: 0,
    picks: [
      { type: 'ghoul', name: 'Ron' },
      { type: 'eye', name: 'Jenny' },
      { type: 'ghoul', name: 'G1' },
      { type: 'ghoul', name: 'G2' },
    ],
  },
  masteredDisciplines: ['dominate', 'fortitude', 'presence'],
  startingUpgrades: [
    { option: 1, kind: 'stat', stat: 'stealth' },
    { option: 3, kind: 'blood' },
  ],
  expPurchases: [
    { upgrade: 'greater_strength' },
    { upgrade: 'greater_strength' },
    { upgrade: 'my_treasure' },
    { upgrade: 'extra_discipline', discipline: 'auspex' },
  ],
};

const PRINCE: CharacterBuild = {
  name: 'Prince Victor',
  concept: '',
  clan: 'nosferatu',
  title: 'prince',
  disguise: null,
  minions: { packageIndex: 0, picks: [{ type: 'primogen', name: 'The Elder' }] },
  masteredDisciplines: ['obfuscate'],
  startingUpgrades: [
    { option: 2, kind: 'city_blood_flow' },
    { option: 3, kind: 'city_intercept' },
  ],
  expPurchases: [{ upgrade: 'unseen' }, { upgrade: 'unseen' }],
};

const BARON: CharacterBuild = {
  name: 'Baron Jack',
  concept: '',
  clan: 'brujah',
  title: 'baron',
  disguise: null,
  minions: {
    packageIndex: 1,
    picks: [
      { type: 'eye', name: 'Watcher' },
      { type: 'ghoul', name: 'Muscle' },
    ],
  },
  masteredDisciplines: ['potence'],
  startingUpgrades: [
    { option: 0, kind: 'extra_discipline', discipline: 'fortitude' },
    { option: 3, kind: 'city_special', special: 'anarch_free_press' },
  ],
  expPurchases: [
    { upgrade: 'mastered_discipline', discipline: 'fortitude' },
    { upgrade: 'eyes_of_the_night' },
    { upgrade: 'my_treasure' },
  ],
};

const ARCHBISHOP: CharacterBuild = {
  name: 'Brother Szlachta',
  concept: '',
  clan: 'tzimisce',
  title: 'archbishop',
  disguise: 'baron',
  minions: {
    packageIndex: 0,
    picks: [
      { type: 'harpy', name: 'Gossip' },
      { type: 'ghoul', name: 'Servant' },
    ],
  },
  masteredDisciplines: ['vicissitude'],
  startingUpgrades: [
    { option: 1, kind: 'stat', stat: 'strength' },
    { option: 2, kind: 'city_special', special: 'anarch_stronghold' },
  ],
  expPurchases: [
    { upgrade: 'extra_discipline', discipline: 'protean' },
    { upgrade: 'mastered_discipline', discipline: 'protean' },
    { upgrade: 'greater_strength' },
  ],
};

const messages = (build: CharacterBuild): string[] =>
  validateCharacterBuild(build, content).map((i) => `${i.path}: ${i.message}`);

describe('validateCharacterBuild', () => {
  it.each([
    ['Inner Circle', INNER_CIRCLE],
    ['Prince', PRINCE],
    ['Baron', BARON],
    ['Archbishop', ARCHBISHOP],
  ])('godkänner ett giltigt %s-bygge', (_, build) => {
    expect(messages(build)).toEqual([]);
  });

  it('nekar Justicar i V1', () => {
    expect(messages({ ...PRINCE, title: 'justicar' })).toEqual(['title: titeln justicar går inte att välja']);
  });

  it('tillåter Justicar om kampanjen uttryckligen tillåter den', () => {
    const justicar: CharacterBuild = {
      ...PRINCE,
      title: 'justicar',
      minions: { packageIndex: 0, picks: [{ type: 'archon', name: 'Agent' }] },
      masteredDisciplines: ['obfuscate', 'potence'],
      startingUpgrades: [
        { option: 0, kind: 'extra_discipline', discipline: 'auspex' },
        { option: 3, kind: 'blood' },
      ],
    };
    expect(validateCharacterBuild(justicar, content, { allowedTitles: ['justicar'] })).toEqual([]);
  });

  it('kräver förklädnad för Archbishop och bara för Archbishop', () => {
    expect(messages({ ...ARCHBISHOP, disguise: null })).toEqual([
      'disguise: en Archbishop måste välja förklädnad (Prince eller Baron)',
    ]);
    expect(messages({ ...PRINCE, disguise: 'baron' })).toEqual(['disguise: bara en Archbishop har förklädnad']);
  });

  it('Archbishop använder förklädnadens startpaket', () => {
    // Förklädd till Prince: Prince-paketets minions och uppgraderingar gäller.
    const asPrince: CharacterBuild = { ...PRINCE, title: 'archbishop', disguise: 'prince' };
    expect(messages(asPrince)).toEqual([]);
    expect(messages({ ...BARON, title: 'archbishop', disguise: 'prince' })).not.toEqual([]);
  });

  it('kräver att all start-EXP spenderas, varken mer eller mindre', () => {
    expect(messages({ ...PRINCE, expPurchases: [{ upgrade: 'unseen' }] })).toEqual([
      'expPurchases: all start-EXP måste spenderas: titeln ger 4, köpen kostar 2',
    ]);
    expect(messages({ ...PRINCE, expPurchases: [...PRINCE.expPurchases, { upgrade: 'my_treasure' }] })).toEqual([
      'expPurchases: all start-EXP måste spenderas: titeln ger 4, köpen kostar 5',
    ]);
  });

  it('tillåter högst tre köp av samma stat-uppgradering', () => {
    const build: CharacterBuild = {
      ...INNER_CIRCLE,
      expPurchases: [
        { upgrade: 'greater_strength' },
        { upgrade: 'greater_strength' },
        { upgrade: 'greater_strength' },
      ],
    };
    expect(messages(build)).toEqual([]);
    expect(
      messages({ ...build, expPurchases: [...build.expPurchases.slice(0, 2), { upgrade: 'greater_strength' }, { upgrade: 'greater_strength' }] }),
    ).toContain('expPurchases[3]: Greater strength kan köpas högst 3 gånger');
  });

  it('bemästrar bara discipliner karaktären har, och bara en gång', () => {
    expect(messages({ ...PRINCE, masteredDisciplines: ['auspex'] })).toEqual([
      'masteredDisciplines[0]: kan inte bemästra auspex: karaktären har den inte',
    ]);
    expect(
      messages({
        ...PRINCE,
        expPurchases: [
          { upgrade: 'mastered_discipline', discipline: 'obfuscate' },
          { upgrade: 'my_treasure' },
          { upgrade: 'unseen' },
        ],
      }),
    ).toEqual(['expPurchases[0].discipline: obfuscate är redan bemästrad']);
  });

  it('kräver titelns antal bemästrade discipliner', () => {
    expect(messages({ ...INNER_CIRCLE, masteredDisciplines: ['dominate'] })).toEqual([
      'masteredDisciplines: titeln ger 3 bemästrade discipliner, fick 1',
    ]);
  });

  it('kan bemästra en disciplin som köps med EXP i samma bygge, oavsett ordning', () => {
    const reordered: CharacterBuild = {
      ...ARCHBISHOP,
      expPurchases: [...ARCHBISHOP.expPurchases].reverse(),
    };
    expect(messages(reordered)).toEqual([]);
  });

  it('nekar extra disciplin som karaktären redan har', () => {
    expect(
      messages({
        ...BARON,
        startingUpgrades: [
          { option: 0, kind: 'extra_discipline', discipline: 'celerity' },
          { option: 3, kind: 'city_special', special: 'anarch_free_press' },
        ],
      }),
    ).toContain('startingUpgrades[0].discipline: har redan celerity');
  });

  it('kräver två olika startuppgraderingar som matchar titelns alternativ', () => {
    expect(messages({ ...PRINCE, startingUpgrades: [PRINCE.startingUpgrades[0]!] })).toEqual([
      'startingUpgrades: välj exakt 2 startuppgraderingar, fick 1',
    ]);
    expect(
      messages({ ...PRINCE, startingUpgrades: [PRINCE.startingUpgrades[0]!, PRINCE.startingUpgrades[0]!] }),
    ).toEqual(['startingUpgrades[1].option: alternativ 2 är redan valt']);
    expect(
      messages({ ...PRINCE, startingUpgrades: [{ option: 0, kind: 'blood' }, PRINCE.startingUpgrades[1]!] }),
    ).toEqual(['startingUpgrades[0].kind: alternativ 0 är extra_discipline, inte blood']);
    expect(
      messages({ ...PRINCE, startingUpgrades: [{ option: 1, kind: 'stat', stat: 'intercept' }, PRINCE.startingUpgrades[1]!] }),
    ).toEqual(['startingUpgrades[0].stat: intercept är inte tillåten (stealth/strength)']);
  });

  it('kontrollerar minionpaketet: index, antal, typ och namn', () => {
    expect(messages({ ...PRINCE, minions: { packageIndex: 2, picks: [] } })).toEqual([
      'minions.packageIndex: minionpaket 2 finns inte (0–1)',
    ]);
    expect(messages({ ...PRINCE, minions: { packageIndex: 0, picks: [] } })).toEqual([
      'minions.picks: paketet har 1 platser, fick 0 val',
    ]);
    expect(messages({ ...PRINCE, minions: { packageIndex: 0, picks: [{ type: 'ghoul', name: ' ' }] } })).toEqual([
      'minions.picks[0].name: minionen måste ha ett namn',
      'minions.picks[0].type: ghoul är inte tillåten här (primogen)',
    ]);
  });

  it('Tremere kan inte välja en LV3-minion (The broken pyramid)', () => {
    const tremere: CharacterBuild = {
      ...INNER_CIRCLE,
      clan: 'tremere',
      masteredDisciplines: ['auspex', 'dominate', 'thaumaturgy'],
      startingUpgrades: [
        { option: 2, kind: 'minion', minion: { type: 'harpy', name: 'Big Harpy' } },
        { option: 3, kind: 'blood' },
      ],
      expPurchases: [
        { upgrade: 'greater_strength' },
        { upgrade: 'greater_strength' },
        { upgrade: 'my_treasure' },
        { upgrade: 'extra_discipline', discipline: 'potence' },
      ],
    };
    expect(messages(tremere)).toEqual([
      'startingUpgrades[0].minion: Tremere kan inte ha LV3-minions (The broken pyramid)',
    ]);
    expect(messages({ ...tremere, clan: 'ventrue', masteredDisciplines: INNER_CIRCLE.masteredDisciplines })).toEqual(
      [],
    );
  });

  it('kräver ett namn', () => {
    expect(messages({ ...PRINCE, name: '   ' })).toEqual(['name: namnet får inte vara tomt']);
  });
});

describe('deriveCharacter', () => {
  it('räknar fram Inner Circle-karaktären', () => {
    const r = deriveCharacter(INNER_CIRCLE, content);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    const c = r.value;
    expect(c.faction).toBe('camarilla');
    expect(c.blood).toBe(300);
    expect(c.disciplines).toEqual({ auspex: 'basic', dominate: 'mastered', fortitude: 'mastered', presence: 'mastered' });
    expect(c.statBonuses).toEqual([
      { stat: 'stealth', amount: 1, source: 'creation:stat_upgrade' },
      { stat: 'strength', amount: 2, source: 'exp:greater_strength' },
    ]);
    expect(c.minions.map((m) => `${m.name}:${m.type}${m.level}`)).toEqual(['Ron:ghoul2', 'Jenny:eye2', 'G1:ghoul1', 'G2:ghoul1']);
    expect(c.randomArtifacts).toBe(2);
    expect(c.startingVp).toBe(3);
    expect(c.expSpent).toBe(6);
    expect(c.startsWithCity).toBe(false);
  });

  it('ger Archbishop sann sekt Sabbat och förklädnadens sekt utåt', () => {
    const r = deriveCharacter(ARCHBISHOP, content);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.value.faction).toBe('sabbat');
    expect(r.value.title).toBe('archbishop');
    expect(r.value.disguise).toEqual({ title: 'baron', faction: 'anarch' });
    expect(r.value.startsWithCity).toBe(true);
    expect(r.value.startingCityUpgrades).toEqual([{ kind: 'special', key: 'anarch_stronghold' }]);
  });
});

describe('backlog', () => {
  it('sparar, listar, uppdaterar och tar bort karaktärer', () => {
    let b = emptyBacklog('user-a');
    const r1 = addCharacter(b, PRINCE, content);
    if (!r1.ok) throw new Error('add');
    b = r1.backlog;
    const r2 = addCharacter(b, BARON, content);
    if (!r2.ok) throw new Error('add');
    b = r2.backlog;
    expect(listCharacters(b).map((c) => c.build.name)).toEqual(['Prince Victor', 'Baron Jack']);
    expect(r1.characterId).toBe('character-1');

    const u = updateCharacter(b, r1.characterId, { ...PRINCE, name: 'Prince Viktor' }, content);
    if (!u.ok) throw new Error('update');
    expect(u.backlog.characters[r1.characterId]?.version).toBe(2);

    const d = removeCharacter(u.backlog, r1.characterId);
    if (!d.ok) throw new Error('remove');
    expect(listCharacters(d.backlog).map((c) => c.id)).toEqual(['character-2']);
    // Id:n återanvänds inte.
    const r3 = addCharacter(d.backlog, PRINCE, content);
    expect(r3.ok && r3.characterId).toBe('character-3');
  });

  it('sparar inte ogiltiga karaktärer', () => {
    const r = addCharacter(emptyBacklog('user-a'), { ...PRINCE, title: 'justicar' }, content);
    expect(r.ok).toBe(false);
  });
});

function backlogWith(owner: string, ...builds: CharacterBuild[]): { backlog: CharacterBacklog; ids: CharacterId[] } {
  let backlog = emptyBacklog(owner);
  const ids: CharacterId[] = [];
  for (const b of builds) {
    const r = addCharacter(backlog, b, content);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    backlog = r.backlog;
    ids.push(r.characterId);
  }
  return { backlog, ids };
}

describe('joinCampaign', () => {
  it('går med med en befintlig karaktär och kopierar bygget', () => {
    const { backlog, ids } = backlogWith('user-a', PRINCE);
    const r = joinCampaign(createLobby('c1'), backlog, { kind: 'existing', characterId: ids[0]! }, content);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.backlog).toBe(backlog);
    expect(r.seat).toEqual({ userId: 'user-a', characterId: 'character-1', characterVersion: 1, build: PRINCE });

    // Senare ändringar i backloggen påverkar inte kampanjen.
    const u = updateCharacter(backlog, ids[0]!, { ...PRINCE, name: 'Nytt namn' }, content);
    expect(u.ok).toBe(true);
    expect(r.lobby.seats[0]?.build.name).toBe('Prince Victor');
  });

  it('går med med en ny karaktär som också sparas i backloggen', () => {
    const r = joinCampaign(createLobby('c1'), emptyBacklog('user-b'), { kind: 'new', build: BARON }, content);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(listCharacters(r.backlog).map((c) => c.build.name)).toEqual(['Baron Jack']);
    expect(r.seat.characterId).toBe('character-1');
  });

  it('nekar ogiltig ny karaktär utan att ändra backloggen', () => {
    const r = joinCampaign(createLobby('c1'), emptyBacklog('user-b'), { kind: 'new', build: { ...BARON, name: '' } }, content);
    expect(r.ok).toBe(false);
  });

  it('nekar okänd karaktär, dubbel anslutning, full kampanj och full titel', () => {
    const { backlog, ids } = backlogWith('user-a', PRINCE);
    const lobby = createLobby('c1', { titleLimits: { prince: 1 }, maxPlayers: 2 });
    expect(joinCampaign(lobby, backlog, { kind: 'existing', characterId: 'character-9' as CharacterId }, content).ok).toBe(
      false,
    );

    const first = joinCampaign(lobby, backlog, { kind: 'existing', characterId: ids[0]! }, content);
    if (!first.ok) throw new Error('join');
    const again = joinCampaign(first.lobby, first.backlog, { kind: 'new', build: BARON }, content);
    expect(!again.ok && again.issues[0]?.message).toBe('spelaren är redan med i kampanjen');

    const otherPrince = joinCampaign(first.lobby, emptyBacklog('user-b'), { kind: 'new', build: PRINCE }, content);
    expect(!otherPrince.ok && otherPrince.issues[0]?.message).toBe('kampanjen har inga lediga platser för prince');

    const second = joinCampaign(first.lobby, emptyBacklog('user-b'), { kind: 'new', build: BARON }, content);
    if (!second.ok) throw new Error('join');
    const third = joinCampaign(second.lobby, emptyBacklog('user-c'), { kind: 'new', build: INNER_CIRCLE }, content);
    expect(!third.ok && third.issues[0]?.message).toBe('kampanjen är full');
  });

  it('nekar titlar kampanjen inte tillåter', () => {
    const lobby = createLobby('c1', { allowedTitles: ['prince', 'baron'] });
    const r = joinCampaign(lobby, emptyBacklog('user-a'), { kind: 'new', build: INNER_CIRCLE }, content);
    expect(!r.ok && r.issues[0]?.message).toBe('titeln inner_circle går inte att välja');
  });

  it('leaveCampaign frigör platsen men behåller karaktären i backloggen', () => {
    const r = joinCampaign(createLobby('c1'), emptyBacklog('user-a'), { kind: 'new', build: PRINCE }, content);
    if (!r.ok) throw new Error('join');
    expect(leaveCampaign(r.lobby, 'user-a').seats).toEqual([]);
    expect(listCharacters(r.backlog)).toHaveLength(1);
  });
});

function fullLobby(): CampaignLobby {
  let lobby = createLobby('campaign-x');
  const entries: [string, CharacterBuild][] = [
    ['user-ic', INNER_CIRCLE],
    ['user-prince', PRINCE],
    ['user-baron', BARON],
    ['user-arch', ARCHBISHOP],
  ];
  for (const [user, build] of entries) {
    const r = joinCampaign(lobby, emptyBacklog(user), { kind: 'new', build }, content);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    lobby = r.lobby;
  }
  return lobby;
}

const PLACEMENTS = {
  'user-ic': { location: 'south' },
  'user-prince': { location: 'north' },
  'user-baron': { location: 'west' },
  'user-arch': { location: 'isle' },
};

describe('buildCampaignInput', () => {
  const setup = () => {
    const r = buildCampaignInput({ lobby: fullLobby(), seed: 'seed-1', map: TEST_MAP, placements: PLACEMENTS }, content);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    return r.value;
  };

  it('ger ett giltigt starttillstånd för alla titlar', () => {
    const { input, playerIds } = setup();
    const state = createGameState(input, content);
    expect(validateState(state, content)).toEqual([]);
    expect(playerIds).toEqual({
      'user-ic': 'player-1',
      'user-prince': 'player-2',
      'user-baron': 'player-3',
      'user-arch': 'player-4',
    });

    const ic = state.players['player-1' as PlayerId]!;
    expect(ic.blood).toBe(300);
    expect(playerVp(ic)).toBe(3);
    expect(ic.exp).toEqual({ unspent: 0, spentTotal: 6 });
    expect(playerStat(state, content, ic.id, 'strength')).toBe(2);
    expect(playerStat(state, content, ic.id, 'stealth')).toBe(1);
    expect(Object.values(state.artifacts).filter((a) => a.holder.kind === 'player' && a.holder.id === ic.id)).toHaveLength(2);

    const north = state.cities['north' as CityId]!;
    expect(north.controllerId).toBe('player-2');
    expect(north.bloodFlow).toBe(125);
    expect(north.intercept).toBe(3);
    expect(state.players['player-2' as PlayerId]!.royalPrivileges).toBe(2);

    expect(state.cities['west' as CityId]!.specials.map((s) => s.key)).toEqual(['anarch_free_press']);

    const arch = state.players['player-4' as PlayerId]!;
    expect(arch.faction).toBe('sabbat');
    expect(arch.disguise).toEqual({ title: 'baron', faction: 'anarch' });
    expect(state.cities['isle' as CityId]!.controllerId).toBe('player-4');
    expect(state.cities['isle' as CityId]!.specials.map((s) => s.key)).toEqual(['anarch_stronghold']);
    // Tzimisce: +1 Strength (skapande) + 1 (EXP).
    expect(playerStat(state, content, arch.id, 'strength')).toBe(2);

    // Startartefakter: IC 2, Baron 1. Resten ligger i poolen.
    const held = Object.values(state.artifacts).filter((a) => a.holder.kind === 'player');
    const pool = Object.values(state.artifacts).filter((a) => a.holder.kind === 'pool');
    expect(held).toHaveLength(3);
    expect(held.length + pool.length).toBe(Object.values(content.artifacts).filter((a) => a.inRandomPool).length);
    expect(new Set(Object.values(state.artifacts).map((a) => a.definition)).size).toBe(held.length + pool.length);
  });

  it('är deterministisk: samma lobby och seed ger samma state', () => {
    const a = createGameState(setup().input, content);
    const b = createGameState(setup().input, content);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('binder Ring of Tremere till en disciplin karaktären saknar', () => {
    const r = buildCampaignInput(
      { lobby: fullLobby(), seed: 's', map: TEST_MAP, placements: PLACEMENTS, artifactKeys: ['ring_of_tremere', 'black_gloves', 'fog_flute'] },
      content,
    );
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    const all = r.value.input.players.flatMap((p) => p.artifacts ?? []);
    expect(all).toHaveLength(3);
    const ring = all.find((a) => a.definition === 'ring_of_tremere');
    const owner = r.value.input.players.find((p) => p.artifacts?.includes(ring!));
    expect(ring?.boundDiscipline).toBeDefined();
    expect(owner?.disciplines[ring!.boundDiscipline!]).toBeUndefined();
    expect(validateState(createGameState(r.value.input, content), content)).toEqual([]);
  });

  it('rapporterar när artefaktpoolen inte räcker', () => {
    const r = buildCampaignInput(
      { lobby: fullLobby(), seed: 's', map: TEST_MAP, placements: PLACEMENTS, artifactKeys: ['black_gloves'] },
      content,
    );
    expect(!r.ok && r.issues.map((i) => `${i.path}: ${i.message}`)).toEqual([
      'seats[0].artifacts: artefaktpoolen räcker inte till alla startartefakter',
      'seats[2].artifacts: artefaktpoolen räcker inte till alla startartefakter',
    ]);
  });

  it('rapporterar saknad placering, okänd stad och delad startstad', () => {
    const r = buildCampaignInput(
      {
        lobby: fullLobby(),
        seed: 's',
        map: TEST_MAP,
        placements: { 'user-ic': { location: 'atlantis' }, 'user-prince': { location: 'north' }, 'user-baron': { location: 'north' } },
        artifactKeys: ['black_gloves'],
      },
      content,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues.map((i) => i.message)).toEqual([
      'okänd stad "atlantis"',
      'north är redan startstad för Prince Victor',
      'Brother Szlachta saknar startplats',
    ]);
  });

  it('nekar en tom kampanj', () => {
    const r = buildCampaignInput({ lobby: createLobby('c'), seed: 's', map: TEST_MAP, placements: {} }, content);
    expect(!r.ok && r.issues[0]?.message).toBe('kampanjen har inga spelare');
  });
});
