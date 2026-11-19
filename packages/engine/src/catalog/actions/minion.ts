/**
 * Minion actions (gd:221–358). Wait and Strike, Investigate Eye och zombiens Hunt for Me är borttagna (docs/engine/not-fixed-actions.md).
 */
import type { MinionType } from '../../state/enums.js';
import type { ActionDefinition } from '../../round/actions.js';
import type { ParamSpec } from '../types.js';
import { define, movesTo, type Def } from '../define.js';
import {
  characterParam,
  choiceParam,
  citiesAdjacentTo,
  citiesWithin,
  cityFeatures,
  cityParam,
  here,
  ownMinion,
  playerParam,
  sailDestinations,
} from '../options.js';

const minion = (types: MinionType[], d: Omit<Def, 'category' | 'performer' | 'minionTypes'>): ActionDefinition =>
  define({ ...d, category: 'minion', performer: 'minion', minionTypes: types });

const toAdjacent: ParamSpec = cityParam('to', 'Till stad', (ctx) => citiesAdjacentTo(ctx, here(ctx)));
const toPort: ParamSpec = cityParam('to', 'Till hamn', (ctx) => sailDestinations(ctx, here(ctx)));

const level = (ctx: Parameters<NonNullable<ParamSpec['options']>>[0]): number => {
  const p = ctx.action.performer;
  return p.kind === 'minion' ? (ownMinion(ctx.view, p.minionId)?.effectiveLevel ?? 1) : 1;
};

const PRIMOGEN_CHOICES = [
  ['stability', '+1 Stability'],
  ['intercept', '+1 Intercept'],
  ['masquerade', '+1 Masquerade'],
  ['influence', '+1 Influence'],
  ['elysium', 'Special: Elysium'],
  ['camarilla_order', 'Special: Camarilla Order'],
  ['secure_haven', 'Special: Secure Haven'],
] as const;

export const MINION_ACTIONS: ActionDefinition[] = [
  // --- Gemensamma
  minion(['ghoul', 'harpy', 'eye'], {
    id: 'minion_move',
    name: 'Move',
    stealth: 0,
    cost: 5,
    zombie: true,
    params: [toAdjacent],
    moves: movesTo(),
  }),
  minion(['ghoul', 'harpy', 'eye', 'archon'], {
    id: 'minion_sail',
    name: 'Sail',
    stealth: 0,
    cost: 15,
    params: [toPort],
    moves: movesTo(),
  }),
  minion(['harpy', 'archon'], { id: 'bodyguard', name: 'Bodyguard', stealth: 0, cost: 10 }),
  // --- Ghoul
  minion(['ghoul'], { id: 'bleed_the_enemy', name: 'Bleed the Enemy', stealth: 1, cost: 0 }),
  minion(['ghoul'], { id: 'partner_in_crime', name: 'Partner in Crime', stealth: 0, cost: 10 }),
  minion(['ghoul'], {
    id: 'ghoul_sabotage',
    name: 'Sabotage',
    stealth: 2,
    cost: 15,
    params: [
      choiceParam('stat', 'Effekt', [
        ['stability', '−1 Stability'],
        ['intercept', '−1 Intercept'],
      ]),
    ],
  }),
  minion(['ghoul'], {
    id: 'move_the_master',
    name: 'Move the Master',
    stealth: 2,
    cost: 10,
    // Flyttar vampyren till minionens stad (om vampyren är i torpor).
    moves: (ctx) =>
      ctx.view.me.status === 'torpor' ? [{ performer: { kind: 'vampire' }, to: here(ctx) }] : [],
  }),
  // --- Harpy
  minion(['harpy'], {
    id: 'suicide_mission',
    name: 'Suicide Mission',
    stealth: -2,
    cost: 10,
    params: [{ key: 'feature', label: 'Special i minionens stad', kind: 'feature', options: (ctx) => cityFeatures(ctx, here(ctx), 'specials') }],
  }),
  minion(['harpy'], { id: 'guard_the_master', name: 'Guard the Master', stealth: 1, cost: 10 }),
  // --- Eye
  minion(['eye'], { id: 'hide_and_spy', name: 'Hide and Spy', stealth: 1, cost: 0 }),
  minion(['eye'], {
    id: 'keep_an_eye_on_them',
    name: 'Keep an Eye on Them',
    stealth: 2,
    cost: 10,
    params: [
      playerParam('target', 'Vampyr i samma stad'),
      choiceParam('question', 'Fråga', [
        ['blood', 'Hur mycket blood har vampyren?'],
        ['artifacts', 'Vilka artefakter har den?'],
        ['vp', 'Har den mer VP än jag?'],
      ]),
    ],
  }),
  minion(['eye'], { id: 'hide_the_master', name: 'Hide the Master', stealth: 0, cost: 10 }),
  // --- Primogen
  minion(['primogen'], {
    id: 'build_on_the_masters_kingdom',
    name: "Build on the Master's Kingdom",
    stealth: 'cant_be_hidden',
    cost: 0,
    // Ett val per level; samma val får tas flera gånger (Elysium kan byggas flera gånger, gd:318).
    params: (ctx) =>
      Array.from({ length: level(ctx) }, (_, i) => choiceParam(`choice${i + 1}`, `Förbättring ${i + 1}`, PRIMOGEN_CHOICES)),
  }),
  // --- Archon
  minion(['archon'], {
    id: 'archon_movement',
    name: 'Archon Movement',
    stealth: 2,
    cost: 5,
    params: [cityParam('to', 'Stad högst 2 steg bort', (ctx) => citiesWithin(ctx, here(ctx), 2))],
    moves: movesTo(),
  }),
  minion(['archon'], {
    id: 'archon_attack',
    name: 'Attack',
    stealth: -1,
    cost: 10,
    params: [characterParam('target', 'Vampyr eller minion i samma stad')],
  }),
  minion(['archon'], {
    id: 'follow_them',
    name: 'Follow Them',
    stealth: 2,
    cost: 15,
    params: [characterParam('target', 'Vampyr eller minion i samma stad')],
  }),
  minion(['archon'], { id: 'sabbat_interrogations', name: 'Sabbat Interrogations', stealth: 0, cost: 20 }),
  minion(['archon'], { id: 'the_masters_will', name: "The Master's Will", stealth: 0, cost: 30 }),
  // --- Zombie (Vestment of Vileness)
];

