/**
 * Huvudskärmens modell: det enda komponenterna känner till.
 *
 * Komponenterna ser aldrig `GameState` eller `PlayerView`. All data går genom
 * `PlayerScreenPort`, som i utveckling kör motorn lokalt (`localPort.ts`) och i
 * produktion ska prata med servern (SPEC B1: motorn körs bara på servern).
 */

export type FactionKey = 'camarilla' | 'anarch' | 'sabbat';

// ---------------------------------------------------------------------------
// Resurser, vampyr, rond

export interface Resources {
  blood: number;
  vp: number;
  artifacts: number;
  minions: number;
  /** Röster i Vampiric Society (alla sekter röstar). */
  votes: number;
}

export interface VampireSummary {
  name: string;
  /** Titel som text, t.ex. "Prince of North". null = ingen titel. */
  titleLabel: string | null;
  stats: { strength: number; stealth: number; intercept: number };
}

export interface RoundInfo {
  round: number;
  maxRounds: number;
}

// ---------------------------------------------------------------------------
// Karta

export interface MapPiece {
  id: string;
  kind: 'vampire' | 'minion';
  name: string;
  /** Spelarens egen pjäs. */
  own: boolean;
  /** Ägarens namn (för andras pjäser). */
  ownerName: string;
  /** Minion-typ, t.ex. "Ghoul". */
  minionType?: string;
}

export interface MapCity {
  id: string;
  name: string;
  /** Position i kartans koordinatsystem (0–1000 × 0–700). */
  x: number;
  y: number;
  /** Kontrollerande faction som spelaren ser den. null = ingen controller. */
  faction: FactionKey | null;
  /** Bara pjäser spelaren garanterat vet är här. */
  pieces: MapPiece[];
}

export interface MapModel {
  cities: MapCity[];
  /** Oriktade kopplingar, varje par en gång. */
  links: [string, string][];
}

// ---------------------------------------------------------------------------
// Actions

export type PerformerRef = { kind: 'vampire' } | { kind: 'minion'; minionId: string };

export type ParamValue = string | number;
export type Params = Record<string, ParamValue>;

/** En action som går att välja i dropdownen. */
export interface ActionChoice {
  /** Unik nyckel för (action, performer). */
  key: string;
  actionId: string;
  performer: PerformerRef;
  /** Vem som utför den, t.ex. vampyrens eller minionens namn. */
  performerName: string;
  performerKind: 'vampire' | 'minion';
  name: string;
  /** Satt om actionen inte går att välja nu, med skälet. */
  disabledReason?: string;
}

/** Nästa val för en action under uppbyggnad. */
export type TargetStep =
  | {
      kind: 'select';
      param: string;
      label: string;
      options: { value: string; label: string }[];
    }
  | {
      kind: 'number';
      param: string;
      label: string;
      min: number;
      max: number;
    };

/** En färdig action i spelarens lista. */
export interface DraftAction {
  /** Lokal id för listan (stabil vid omsortering). */
  uid: string;
  actionId: string;
  performer: PerformerRef;
  params: Params;
}

export interface DraftEntryInfo {
  /** T.ex. "Move från North till East". */
  label: string;
  performerName: string;
  performerKind: 'vampire' | 'minion';
  /** Blood-kostnad. */
  cost: number;
  /** Deterministisk blood-inkomst, eller null om actionen inte ger en säker inkomst. */
  income: number | null;
  /** Fel som gäller just den här raden. */
  errors: string[];
}

/** En minions egna actions (varje minion har en action, Anarch Mission kan ge en till). */
export interface MinionActionCount {
  minionId: string;
  name: string;
  used: number;
  allowed: number;
}

export interface DraftAnalysis {
  entries: DraftEntryInfo[];
  /** Bara vampyrens slots. */
  apUsed: number;
  apTotal: number;
  /** En rad per egen minion, i id-ordning. */
  minionActions: MinionActionCount[];
  totalCost: number;
  totalIncome: number;
  /** Fel som inte hör till en enskild rad. */
  errors: string[];
  warnings: string[];
  canConfirm: boolean;
}

export interface ConfirmResult {
  ok: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Porten

export interface MainScreenData {
  round: RoundInfo;
  resources: Resources;
  vampire: VampireSummary;
  map: MapModel;
}

export interface PlayerScreenPort {
  load(): MainScreenData;
  /** Alla actions spelaren kan välja, givet listan hittills (t.ex. efter en Move). */
  actionChoices(draft: readonly DraftAction[]): ActionChoice[];
  /**
   * Nästa val för en action under uppbyggnad, eller null när actionen är klar.
   * `before` = listans actions före den nya (avgör t.ex. var vampyren står).
   */
  nextStep(
    before: readonly DraftAction[],
    actionId: string,
    performer: PerformerRef,
    params: Params,
  ): TargetStep | null;
  analyze(draft: readonly DraftAction[]): DraftAnalysis;
  /** Lämnar in listan. */
  confirm(draft: readonly DraftAction[]): ConfirmResult;
  /** Låser upp en inlämnad lista. */
  unlock(): void;
  isLocked(): boolean;
}
