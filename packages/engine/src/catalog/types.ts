/**
 * Typer för actionkatalogen: vad en aktion kräver, vilka val (params) den har,
 * och hur giltiga alternativ räknas fram.
 *
 * Allt här räknas från `PlayerView`, inte från `GameState`. Det gör att
 * gränssnittet kan köra samma funktioner som servern, och att ett målval aldrig
 * kan avslöja dold information (en dropdown som bara visar vampyrerna som
 * faktiskt står i staden skulle läcka positioner). Beslut: docs/decisions/catalog.md.
 */
import type { Content } from '../content/index.js';
import type { ArtifactKey } from '../content/artifacts.js';
import type { Discipline, DisciplineLevel } from '../state/enums.js';
import type { CityId, MinionId } from '../state/ids.js';
import type { PlayerView } from '../view/player.js';
import type { Performer, SubmittedAction } from '../round/types.js';
import type { ActionRegistry } from '../round/actions.js';

/**
 * Var spelarens vampyr och minions befinner sig inför en viss entry i listan,
 * efter de förflyttningar som tidigare entries i listan gör (Move, Sail,
 * Archon Movement …). `null` = okänt (t.ex. efter Second Tradition, där man
 * flyttar till målets stad som man inte vet var den är).
 */
export interface ProjectedPositions {
  vampire: CityId | null;
  minions: Record<MinionId, CityId | null>;
}

/** Det en kostnads-, inkomst- eller kravfunktion får veta. */
export interface CatalogContext {
  view: PlayerView;
  content: Content;
  /** Entryn som bedöms. `params` kan vara ofullständiga när den byggs upp. */
  action: SubmittedAction;
  /** Positioner inför den här entryn (efter tidigare förflyttningar i listan). */
  positions: ProjectedPositions;
  /** Hela listan och entryns index i den. */
  list: readonly SubmittedAction[];
  index: number;
  /** Katalogen som används (för aktioner som pekar på andra aktioner). */
  registry: ActionRegistry;
}

export type ParamKind =
  /** Stad: value = CityId. */
  | 'city'
  /** Vampyr: value = PlayerId. */
  | 'player'
  /** Minion (egen eller annans): value = MinionId. */
  | 'minion'
  /** Vampyr eller minion: value = PlayerId eller MinionId (id:n är unika över typer). */
  | 'character'
  /** En av spelarens egna artefakter: value = ArtifactId. */
  | 'artifact'
  /** En artefakt i spelet, namngiven via sin definition: value = ArtifactKey. */
  | 'artifact_key'
  | 'sea_region'
  /** Problem eller special i en stad: value = CityFeatureId. */
  | 'feature'
  /** En annan entry i samma lista: value = entryns `key`. */
  | 'entry'
  /** Fast lista av alternativ: value = alternativets id. */
  | 'choice'
  /** Heltal inom ett intervall. */
  | 'number'
  /** Fritext (Wait and Strike-villkor, (M)Chimerstry). */
  | 'text';

export type ParamValue = string | number;

export interface ParamOption {
  value: ParamValue;
  label: string;
  /** Extra text till gränssnittet, t.ex. "kostar 50". */
  hint?: string;
}

export interface NumberRange {
  min: number;
  max: number;
  step: number;
}

/** Ett val som spelaren gör för en aktion. Valen görs i ordning (steg för steg). */
export interface ParamSpec {
  key: string;
  label: string;
  kind: ParamKind;
  /** Flerval: värdet är en lista med distinkta alternativ, min–max stycken. */
  multiple?: { min: number; max: number };
  /** Giltiga alternativ. Krävs för alla typer utom `number` och `text`. */
  options?: (ctx: CatalogContext) => ParamOption[];
  /** För `number`. */
  range?: (ctx: CatalogContext) => NumberRange;
  /** För `text`: max antal ord. */
  maxWords?: number;
}

/** Krav som går att läsa direkt från spelarens egen vy. */
export interface ActionRequirements {
  /** Disciplin på minst angiven nivå (permanent eller tillfällig). */
  discipline?: { key: Discipline; level: DisciplineLevel };
  /** Vampyren bär en artefakt med den här definitionen. */
  artifact?: ArtifactKey;
  /** Bara vampyrer utan titel (Conquer New Territory). */
  noTitle?: boolean;
  /** Archbishop: `hidden` = fortfarande förklädd, `exposed` = avslöjad. */
  archbishop?: 'hidden' | 'exposed';
  /** Aktionen får bara göras i torpor (Soul Gem of Etrius). */
  onlyInTorpor?: boolean;
  /** Bara Vestment of Vileness-zombien (Hunt for Me, gd:402). */
  zombieOnly?: boolean;
}

/** En förflyttning som en entry gör om den lyckas. `to: null` = okänd destination. */
export interface ProjectedMove {
  performer: Performer;
  to: CityId | null;
}
