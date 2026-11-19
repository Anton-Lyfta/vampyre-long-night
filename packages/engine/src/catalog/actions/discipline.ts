/**
 * Discipline actions (gd:1214–1281). Basaktionen kräver disciplinen, (M)-aktionen
 * att den är bemästrad.
 */
import { DISCIPLINES, type Discipline, type DisciplineLevel } from '../../state/enums.js';
import type { ActionDefinition } from '../../round/actions.js';
import type { CityId, MinionId } from '../../state/ids.js';
import type { CatalogContext, ParamSpec } from '../types.js';
import { define, movesTo, type Def } from '../define.js';
import {
  characterParam,
  choiceParam,
  citiesAdjacentTo,
  citiesWithin,
  cityById,
  cityParam,
  allCities,
  here,
  knownMinionLevel,
  laterEntries,
  listParam,
  ownMinion,
  ownMinions,
  othersMinions,
  playerParam,
  strParam,
  textParam,
  vampires,
} from '../options.js';
import { STAT_CHOICES } from './personal.js';

const disc = (key: Discipline, level: DisciplineLevel, d: Omit<Def, 'category' | 'performer' | 'requires'>): ActionDefinition =>
  define({ ...d, category: 'discipline', performer: 'vampire', requires: { discipline: { key, level } } });

const B = 'basic' as const;
const M = 'mastered' as const;

const DISCIPLINE_NAMES = (ctx: CatalogContext, d: Discipline) => ctx.content.disciplines[d].name;

/** Entries längre ner i listan som vampyren själv gör, i angivna kategorier. */
const ownLaterEntry = (key: string, label: string, categories: string[]): ParamSpec => ({
  key,
  label,
  kind: 'entry',
  options: (ctx) =>
    laterEntries(
      ctx,
      (a) => a.performer.kind === 'vampire' && categories.includes(ctx.registry[a.actionId]?.category ?? ''),
      (a, i) => `${i + 1}. ${ctx.registry[a.actionId]?.name ?? a.actionId}`,
    ),
});

export const DISCIPLINE_ACTIONS: ActionDefinition[] = [
  // --- Animalism
  disc('animalism', B, { id: 'animalism', name: 'Animalism', stealth: 'undetectable', cost: 0 }),
  disc('animalism', M, {
    id: 'animalism_m',
    name: '(M) Animalism',
    stealth: 2,
    cost: 10,
    params: (ctx) => {
      const specs: ParamSpec[] = [
        choiceParam('mode', 'Välj', [
          ['wolves', 'Vargar jagar blood i alla grannstäder'],
          ['birds', 'Fåglar: +2 intercept resten av ronden'],
          ['rats', 'Råttor: grannstad −1 intercept'],
        ]),
      ];
      if (strParam(ctx, 'mode') === 'rats') specs.push(cityParam('city', 'Grannstad', (c) => citiesAdjacentTo(c, here(c))));
      return specs;
    },
  }),
  // --- Auspex
  disc('auspex', B, {
    id: 'auspex',
    name: 'Auspex',
    stealth: 'undetectable',
    cost: 10,
    trifle: true,
    params: [
      playerParam('target', 'Vampyr'),
      {
        key: 'learn',
        label: 'Välj två',
        kind: 'choice',
        multiple: { min: 2, max: 2 },
        options: () => [
          { value: 'lowest_faction', label: 'Lägsta stealth på en faction action' },
          { value: 'highest_personal', label: 'Högsta stealth på en personal action' },
          { value: 'minions_here', label: 'Alla actions av vampyrens minions i din stad' },
        ],
      },
    ],
  }),
  disc('auspex', M, {
    id: 'auspex_m',
    name: '(M) Auspex',
    stealth: 'undetectable',
    cost: 10,
    params: (ctx) => {
      const specs: ParamSpec[] = [
        choiceParam('mode', 'Välj', [
          ['track', 'Följ en vampyrs väg denna rond'],
          ['locate', 'Hitta upp till 5 vampyrer, minions eller artefakter'],
        ]),
      ];
      if (strParam(ctx, 'mode') === 'track') specs.push(playerParam('target', 'Vampyr'));
      if (strParam(ctx, 'mode') === 'locate') {
        specs.push({
          key: 'targets',
          label: 'Vampyrer och minions',
          kind: 'character',
          multiple: { min: 0, max: 5 },
          options: (c) => [...vampires(c), ...othersMinions(c)],
        });
        specs.push({
          key: 'artifacts',
          label: 'Artefakter',
          kind: 'artifact_key',
          multiple: { min: 0, max: 5 },
          options: (c) =>
            Object.values(c.content.artifacts)
              .filter((a) => a.key !== 'thaumaturgic_creation')
              .map((a) => ({ value: a.key, label: a.name })),
        });
      }
      return specs;
    },
    eligible: (ctx) => {
      if (strParam(ctx, 'mode') !== 'locate') return null;
      const n = listParam(ctx, 'targets').length + listParam(ctx, 'artifacts').length;
      return n >= 1 && n <= 5 ? null : 'Välj 1–5 att hitta';
    },
  }),
  // --- Celerity
  disc('celerity', B, {
    id: 'celerity',
    name: 'Celerity',
    stealth: 0,
    cost: 10,
    resolve: (ctx) => {
      ctx.resolveImmediately(2);
      return { status: 'resolved' };
    },
  }),
  disc('celerity', M, {
    id: 'celerity_m',
    name: '(M) Celerity',
    stealth: 0,
    cost: 20,
    params: [cityParam('to', 'Stad högst 3 steg bort', (ctx) => citiesWithin(ctx, here(ctx), 3))],
    moves: movesTo(),
  }),
  // --- Chimerstry
  disc('chimerstry', B, {
    id: 'chimerstry',
    name: 'Chimerstry',
    stealth: 2,
    cost: 10,
    trifle: true,
    params: [
      cityParam('city', 'Grannstad', (ctx) => citiesAdjacentTo(ctx, here(ctx))),
      {
        key: 'target',
        label: 'Vampyr (inte stadens controller)',
        kind: 'player',
        options: (ctx) => {
          const controller = cityById(ctx.view, strParam(ctx, 'city') as CityId)?.controllerId ?? null;
          return vampires(ctx, { includeSelf: true }).filter((o) => o.value !== controller);
        },
      },
    ],
  }),
  disc('chimerstry', M, {
    id: 'chimerstry_m',
    name: '(M) Chimerstry',
    stealth: 2,
    cost: 15,
    params: [textParam('message', 'Meddelande till Information Highway', 250)],
  }),
  // Dementation och (M) Dementation kräver GM och är borttagna (docs/engine/not-fixed-actions.md).
  // --- Dominate
  disc('dominate', B, {
    id: 'dominate',
    name: 'Dominate',
    stealth: 1,
    cost: 0,
    params: [characterParam('target', 'Vampyr eller minion i samma stad'), cityParam('to', 'Till stad', (ctx) => allCities(ctx))],
  }),
  disc('dominate', M, {
    id: 'dominate_m',
    name: '(M) Dominate',
    stealth: 0,
    cost: (ctx) => {
      const level = knownMinionLevel(ctx.view, strParam(ctx, 'target') ?? '');
      return level === null ? 0 : ([25, 50, 100][level - 1] ?? 100);
    },
    params: [{ key: 'target', label: 'Annans minion', kind: 'minion', options: (ctx) => othersMinions(ctx) }],
  }),
  // --- Fortitude
  disc('fortitude', B, { id: 'fortitude', name: 'Fortitude', stealth: 'undetectable', cost: 10 }),
  disc('fortitude', M, { id: 'fortitude_m', name: '(M) Fortitude', stealth: 'undetectable', cost: 0, trifle: true }),
  // --- Obfuscate
  disc('obfuscate', B, {
    id: 'obfuscate',
    name: 'Obfuscate',
    stealth: 'undetectable',
    cost: 0,
    params: [ownLaterEntry('entry', 'Personal- eller discipline-action längre ner', ['personal', 'discipline'])],
  }),
  disc('obfuscate', M, { id: 'obfuscate_m', name: '(M) Obfuscate', stealth: 'undetectable', cost: 10 }),
  // --- Oblivion
  disc('oblivion', B, {
    id: 'oblivion',
    name: 'Oblivion',
    stealth: 1,
    cost: 10,
    params: [playerParam('target', 'Vampyr', { includeSelf: true })],
  }),
  disc('oblivion', M, {
    id: 'oblivion_m',
    name: '(M) Oblivion',
    stealth: 2,
    cost: 15,
    params: [
      {
        key: 'entries',
        label: 'Upp till 2 minion-actions längre ner',
        kind: 'entry',
        multiple: { min: 1, max: 2 },
        options: (ctx) =>
          laterEntries(
            ctx,
            (a) => a.performer.kind === 'minion',
            (a, i) => `${i + 1}. ${ctx.registry[a.actionId]?.name ?? a.actionId}`,
          ),
      },
    ],
  }),
  // --- Potence
  disc('potence', B, { id: 'potence', name: 'Potence', stealth: 'undetectable', cost: 0 }),
  disc('potence', M, {
    id: 'potence_m',
    name: '(M) Potence',
    stealth: 0,
    cost: 10,
    params: [{ key: 'target', label: 'Minion LV2 eller lägre i samma stad', kind: 'minion', options: (ctx) => othersMinions(ctx, { maxLevel: 2 }) }],
  }),
  // --- Presence
  disc('presence', B, {
    id: 'presence',
    name: 'Presence',
    stealth: 'undetectable',
    cost: 0,
    params: (ctx) => {
      const specs: ParamSpec[] = [
        choiceParam('mode', 'Vems faction action', [
          ['own', 'Min egen, längre ner i listan'],
          ['other', 'En annan vampyrs'],
        ]),
      ];
      if (strParam(ctx, 'mode') === 'own') specs.push(ownLaterEntry('entry', 'Faction action längre ner', ['faction']));
      if (strParam(ctx, 'mode') === 'other') specs.push(playerParam('target', 'Vampyr'));
      return specs;
    },
  }),
  // (M) Presence definieras i catalog/index.ts eftersom den behöver hela katalogen.
  // --- Protean
  disc('protean', B, {
    id: 'protean',
    name: 'Protean',
    stealth: 'undetectable',
    cost: 10,
    params: [choiceParam('stat', '+1 på', STAT_CHOICES)],
  }),
  disc('protean', M, {
    id: 'protean_m',
    name: '(M) Protean',
    stealth: 'undetectable',
    cost: 10,
    params: [
      {
        key: 'arrangement',
        label: 'Ny fördelning av basvärden',
        kind: 'choice',
        options: (ctx) => {
          const base = { strength: 0, stealth: 0, intercept: 0 };
          for (const m of ctx.view.me.modifiers) if (m.expiresAfterRound === null) base[m.stat] += m.amount;
          const values = [base.strength, base.stealth, base.intercept];
          const seen = new Set<string>();
          const out = [];
          for (const [a, b, c] of [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0],
          ] as const) {
            const v = `${values[a]}/${values[b]}/${values[c]}`;
            if (seen.has(v)) continue;
            seen.add(v);
            out.push({ value: v, label: `Strength ${values[a]}, Stealth ${values[b]}, Intercept ${values[c]}` });
          }
          return out;
        },
      },
    ],
  }),
  // --- Thaumaturgy
  disc('thaumaturgy', B, {
    id: 'thaumaturgy',
    name: 'Thaumaturgy',
    stealth: -1,
    cost: 10,
    trifle: true,
    params: [
      playerParam('target', 'Vampyr', { includeSelf: true }),
      {
        key: 'discipline',
        label: 'Disciplin (basaktion)',
        kind: 'choice',
        options: (ctx) => DISCIPLINES.map((d) => ({ value: d, label: DISCIPLINE_NAMES(ctx, d) })),
      },
    ],
  }),
  disc('thaumaturgy', M, {
    id: 'thaumaturgy_m',
    name: '(M) Thaumaturgy',
    stealth: 0,
    cost: 50,
    params: (ctx) => {
      const specs: ParamSpec[] = [
        choiceParam('mode', 'Välj', [
          ['burn_artifact', 'Bränn en artefakt och ge dess action till en vampyr'],
          ['create', 'Skapa en artefakt med en av dina basdiscipliner'],
        ]),
      ];
      if (strParam(ctx, 'mode') === 'burn_artifact') {
        specs.push({
          key: 'artifact',
          label: 'Egen artefakt',
          kind: 'artifact',
          options: (c) => c.view.me.artifacts.map((a) => ({ value: a.id, label: c.content.artifacts[a.definition].name })),
        });
        specs.push(playerParam('target', 'Vampyr i samma stad', { includeSelf: true }));
      }
      if (strParam(ctx, 'mode') === 'create') {
        specs.push({
          key: 'discipline',
          label: 'Disciplin',
          kind: 'choice',
          options: (c) =>
            DISCIPLINES.filter((d) => c.view.me.disciplines[d] !== undefined).map((d) => ({
              value: d,
              label: DISCIPLINE_NAMES(c, d),
            })),
        });
      }
      return specs;
    },
  }),
  // --- Vicissitude
  disc('vicissitude', B, {
    id: 'vicissitude',
    name: 'Vicissitude',
    stealth: 0,
    cost: 10,
    params: (ctx) => {
      const specs: ParamSpec[] = [
        choiceParam('mode', 'Välj', [
          ['gain_ghoul', 'Få en LV1 Ghoul'],
          ['gain_harpy', 'Få en LV1 Harpy'],
          ['gain_eye', 'Få en LV1 Eye'],
          ['merge', 'Bränn två likadana minions, få en level högre'],
        ]),
      ];
      if (strParam(ctx, 'mode') === 'merge')
        specs.push({
          key: 'minions',
          label: 'Två minions av samma typ och level i din stad',
          kind: 'minion',
          multiple: { min: 2, max: 2 },
          options: (c) => ownMinions(c, { maxLevel: 2, types: ['ghoul', 'harpy', 'eye'], inCity: c.positions.vampire }),
        });
      return specs;
    },
    eligible: (ctx) => {
      if (strParam(ctx, 'mode') !== 'merge') return null;
      const [a, b] = listParam(ctx, 'minions').map((id) => ownMinion(ctx.view, id as MinionId));
      if (!a || !b) return 'Välj två egna minions';
      return a.type === b.type && a.effectiveLevel === b.effectiveLevel ? null : 'Minionerna måste ha samma typ och level';
    },
  }),
  disc('vicissitude', M, {
    id: 'vicissitude_m',
    name: '(M) Vicissitude',
    stealth: 1,
    cost: 0,
    params: [
      { key: 'minionId', label: 'Minion', kind: 'minion', options: (ctx) => ownMinions(ctx, { types: ['ghoul', 'harpy', 'eye'] }) },
      {
        key: 'type',
        label: 'Ny typ',
        kind: 'choice',
        options: (ctx) => {
          const current = ownMinion(ctx.view, strParam(ctx, 'minionId') as MinionId)?.type;
          return (
            [
              ['ghoul', 'Ghoul'],
              ['harpy', 'Harpy'],
              ['eye', 'Eye'],
            ] as const
          )
            .filter(([t]) => t !== current)
            .map(([value, label]) => ({ value, label }));
        },
      },
    ],
  }),
];
