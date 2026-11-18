/**
 * Karaktärsskapande (SPEC A3/B7, beslut i docs/decisions/characters.md).
 *
 * En `CharacterBuild` är spelarens val, oberoende av kampanj, karta och state.
 * Den sparas i spelarens backlog och kopieras till en kampanj när spelaren går
 * med. Allt här är ren JSON.
 */
import type { Clan, Discipline, DisguiseTitle, MinionType, Stat, Title } from '../state/enums.js';

/** Ett val per plats i titelns minionpaket: vilken typ och vad minionen heter. */
export interface MinionPick {
  readonly type: MinionType;
  readonly name: string;
}

/**
 * En av de två startuppgraderingarna (gd:672). `option` är index i titelpaketets
 * `upgradeOptions`; `kind` måste matcha alternativets typ. Underval anges i
 * samma objekt.
 */
export type StartingUpgradeChoice =
  | { readonly option: number; readonly kind: 'extra_discipline'; readonly discipline: Discipline }
  | { readonly option: number; readonly kind: 'stat'; readonly stat: Stat }
  | { readonly option: number; readonly kind: 'minion'; readonly minion: MinionPick }
  | { readonly option: number; readonly kind: 'blood' }
  | { readonly option: number; readonly kind: 'city_blood_flow' }
  | { readonly option: number; readonly kind: 'city_intercept' }
  | { readonly option: number; readonly kind: 'city_special'; readonly special: string };

/** Ett EXP-köp (gd:853–860). Samma uppgradering får köpas flera gånger där reglerna tillåter. */
export type ExpPurchase =
  | { readonly upgrade: 'extra_discipline'; readonly discipline: Discipline }
  | { readonly upgrade: 'mastered_discipline'; readonly discipline: Discipline }
  | { readonly upgrade: 'greater_strength' }
  | { readonly upgrade: 'unseen' }
  | { readonly upgrade: 'eyes_of_the_night' }
  | { readonly upgrade: 'my_treasure' };

export interface CharacterBuild {
  readonly name: string;
  /** Fritext om bakgrund (gd:660). Ingen mekanisk effekt. */
  readonly concept: string;
  readonly clan: Clan;
  /** Sann titel. Justicar är inte valbar i V1 (K2). */
  readonly title: Title;
  /** Krävs för Archbishop (förklädnaden, gd:635), annars `null`. */
  readonly disguise: DisguiseTitle | null;
  readonly minions: {
    /** Index i titelpaketets `minionOptions`. */
    readonly packageIndex: number;
    /** Ett val per plats i paketet, i paketets ordning. */
    readonly picks: readonly MinionPick[];
  };
  /** Discipliner som titeln låter spelaren bemästra (gd:669). Exakt titelns antal. */
  readonly masteredDisciplines: readonly Discipline[];
  /** Exakt två olika alternativ (gd:672). */
  readonly startingUpgrades: readonly StartingUpgradeChoice[];
  /** Hela start-EXP:n måste spenderas (gd:676). */
  readonly expPurchases: readonly ExpPurchase[];
}

/** Ett fel i ett bygge. `path` pekar ut fältet så att UI:t kan markera det. */
export interface CreationIssue {
  readonly path: string;
  readonly message: string;
}

export type CreationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly CreationIssue[] };
