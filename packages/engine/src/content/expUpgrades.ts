/**
 * EXP-uppgraderingar (gd:853–861, SPEC A3). Används vid karaktärsskapande och
 * av Grow in Power (gd:1167). Kostnad och tak är data så att en kampanj kan
 * justera dem (SPEC B11).
 */
import type { Stat } from '../state/enums.js';

export const EXP_UPGRADE_KEYS = [
  'extra_discipline',
  'mastered_discipline',
  'greater_strength',
  'unseen',
  'eyes_of_the_night',
  'my_treasure',
] as const;
export type ExpUpgradeKey = (typeof EXP_UPGRADE_KEYS)[number];

export interface ExpUpgradeDefinition {
  readonly key: ExpUpgradeKey;
  readonly name: string;
  readonly cost: number;
  /** Stat-uppgraderingar: vilken stat och max antal köp (gd:857–859: max +3). */
  readonly stat: { readonly stat: Stat; readonly maxPurchases: number } | null;
  readonly text: string;
}

export const EXP_UPGRADE_DEFINITIONS: Readonly<Record<ExpUpgradeKey, ExpUpgradeDefinition>> = {
  extra_discipline: {
    key: 'extra_discipline',
    name: 'Extra discipline',
    cost: 1,
    stat: null,
    text: "Your vampire learns one more discipline. Pick any discipline you don't have and add it to your vampyre.",
  },
  mastered_discipline: {
    key: 'mastered_discipline',
    name: 'Mastered discipline',
    cost: 1,
    stat: null,
    text: 'You master a discipline you already have. Choose a discipline you have and gain access to its master discipline.',
  },
  greater_strength: {
    key: 'greater_strength',
    name: 'Greater strength',
    cost: 2,
    stat: { stat: 'strength', maxPurchases: 3 },
    text: 'Get +1 Strength. A vampyre can get a maximum of +3 strength from this upgrade.',
  },
  unseen: {
    key: 'unseen',
    name: 'Unseen',
    cost: 2,
    stat: { stat: 'stealth', maxPurchases: 3 },
    text: 'Get +1 Stealth. A vampyre can get a maximum of +3 Stealth from this upgrade.',
  },
  eyes_of_the_night: {
    key: 'eyes_of_the_night',
    name: 'Eyes of the night',
    cost: 2,
    stat: { stat: 'intercept', maxPurchases: 3 },
    text: 'Get +1 Intercept. A vampyre can get a maximum of +3 Intercept from this upgrade.',
  },
  my_treasure: {
    key: 'my_treasure',
    name: 'My treasure',
    cost: 1,
    stat: null,
    text: 'Get a random artifact.',
  },
};
