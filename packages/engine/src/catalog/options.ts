/**
 * Byggstenar för målval. Varje funktion räknar giltiga alternativ från det
 * spelaren vet (PlayerView) och från positionerna inför entryn, aldrig från
 * GameState. Mål som kräver dold information (en vampyr "i samma stad") listar
 * därför alla tänkbara mål; om målet inte är där misslyckas aktionen vid
 * upplösning och kostnaden återbetalas (gd:95). Se docs/decisions/catalog.md (K3).
 */
import type { MinionType, Title, Faction } from '../state/enums.js';
import type { CityId, MinionId, PlayerId } from '../state/ids.js';
import type { CityView, PlayerView, PublicPlayerView } from '../view/player.js';
import type { CatalogContext, ParamOption, ParamSpec, ParamValue } from './types.js';

// ---------------------------------------------------------------------------
// Läsa ur kontexten

/** Värdet för ett redan gjort val, eller undefined. */
export function param(ctx: CatalogContext, key: string): unknown {
  return ctx.action.params?.[key];
}

export function strParam(ctx: CatalogContext, key: string): string | null {
  const v = param(ctx, key);
  return typeof v === 'string' ? v : null;
}

export function numParam(ctx: CatalogContext, key: string): number {
  const v = param(ctx, key);
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

export function listParam(ctx: CatalogContext, key: string): string[] {
  const v = param(ctx, key);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Var den som utför entryn befinner sig, efter tidigare förflyttningar i listan.
 * `null` = okänt (då godtas alla städer som mål, se K4).
 */
export function here(ctx: CatalogContext): CityId | null {
  const p = ctx.action.performer;
  if (p.kind === 'vampire') return ctx.positions.vampire;
  return ctx.positions.minions[p.minionId] ?? null;
}

export function cityById(view: PlayerView, id: CityId): CityView | undefined {
  return view.cities.find((c) => c.id === id);
}

export function playerById(view: PlayerView, id: PlayerId): PublicPlayerView | undefined {
  return view.players.find((p) => p.id === id);
}

export function ownMinion(view: PlayerView, id: MinionId) {
  return view.me.minions.find((m) => m.id === id);
}

/** Level på en minion spelaren känner till (egen: effektiv level; annans: publik level). */
export function knownMinionLevel(view: PlayerView, id: string): number | null {
  const own = view.me.minions.find((m) => m.id === id);
  if (own) return own.effectiveLevel;
  return view.minions.find((m) => m.id === id)?.level ?? null;
}

// ---------------------------------------------------------------------------
// Etiketter

const MINION_TYPE_NAMES: Record<MinionType, string> = {
  ghoul: 'Ghoul',
  harpy: 'Harpy',
  eye: 'Eye',
  primogen: 'Primogen',
  archon: 'Archon',
};

export const minionLabel = (m: { name: string; level: number; type: MinionType }): string =>
  `${m.name} (LV${m.level} ${MINION_TYPE_NAMES[m.type]})`;

export const cityOption = (c: CityView): ParamOption => ({ value: c.id, label: c.name });

const sortByLabel = (a: ParamOption, b: ParamOption) => a.label.localeCompare(b.label, 'en');

// ---------------------------------------------------------------------------
// Städer

/** Alla städer, sorterade på namn. */
export function allCities(ctx: CatalogContext, filter: (c: CityView) => boolean = () => true): ParamOption[] {
  return ctx.view.cities.filter(filter).map(cityOption).sort(sortByLabel);
}

/** Grannstäder till en stad. Okänd utgångspunkt ⇒ alla städer (K4). */
export function citiesAdjacentTo(ctx: CatalogContext, from: CityId | null): ParamOption[] {
  if (from === null) return allCities(ctx);
  const c = cityById(ctx.view, from);
  if (!c) return [];
  return c.adjacent
    .map((id) => cityById(ctx.view, id))
    .filter((x): x is CityView => !!x)
    .map(cityOption)
    .sort(sortByLabel);
}

/** Städer högst `steps` steg bort (utom startstaden). Celerity (M), Archon Movement. */
export function citiesWithin(ctx: CatalogContext, from: CityId | null, steps: number): ParamOption[] {
  if (from === null) return allCities(ctx);
  const seen = new Set<CityId>([from]);
  let frontier: CityId[] = [from];
  for (let i = 0; i < steps; i++) {
    const next: CityId[] = [];
    for (const id of frontier) {
      for (const n of cityById(ctx.view, id)?.adjacent ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  seen.delete(from);
  return allCities(ctx, (c) => seen.has(c.id));
}

/** Hamnar man kan segla till: delar en havsregion utan storm med utgångshamnen (gd:1188). */
export function sailDestinations(ctx: CatalogContext, from: CityId | null): ParamOption[] {
  const ports = (c: CityView) => c.isPort;
  if (from === null) return allCities(ctx, ports);
  const start = cityById(ctx.view, from);
  if (!start || !start.isPort) return [];
  const calm = new Set(
    ctx.view.seaRegions.filter((s) => s.storm === null || s.storm.untilEndOfRound < ctx.view.round).map((s) => s.id),
  );
  const regions = start.seaRegions.filter((r) => calm.has(r));
  return allCities(ctx, (c) => c.id !== from && c.isPort && c.seaRegions.some((r) => regions.includes(r)));
}

/** Städer spelaren kontrollerar. */
export function controlledCities(ctx: CatalogContext): ParamOption[] {
  return allCities(ctx, (c) => c.controllerId === ctx.view.me.id);
}

/** Spelarens domän (gd:534). */
export function domainCities(ctx: CatalogContext): ParamOption[] {
  const domain = new Set(ctx.view.me.domain);
  return allCities(ctx, (c) => domain.has(c.id));
}

/** Stadens sekt = controllerns skenbara sekt (M3). */
export function citySect(view: PlayerView, c: CityView): Faction | null {
  if (!c.controllerId) return null;
  return playerById(view, c.controllerId)?.faction ?? null;
}

export function citiesOfSect(ctx: CatalogContext, sect: Faction): ParamOption[] {
  return allCities(ctx, (c) => citySect(ctx.view, c) === sect);
}

/** Städer med Sabbat-bas (bara Sabbat-spelare ser baserna), valfritt med lägsta level. */
export function sabbatBaseCities(ctx: CatalogContext, minLevel = 1): ParamOption[] {
  const bases = ctx.view.sabbat?.bases ?? {};
  return allCities(ctx, (c) => (bases[c.id]?.level ?? 0) >= minLevel);
}

// ---------------------------------------------------------------------------
// Vampyrer och minions

export interface PlayerFilter {
  includeSelf?: boolean;
  /** Skenbar titel. */
  titles?: (Title | null)[];
  /** Skenbar sekt. */
  factions?: Faction[];
  bloodHunt?: boolean;
}

/** Vampyrer som inte är brända, filtrerade på det som är publikt. */
export function vampires(ctx: CatalogContext, f: PlayerFilter = {}): ParamOption[] {
  return ctx.view.players
    .filter((p) => !p.burned)
    .filter((p) => f.includeSelf || p.id !== ctx.view.me.id)
    .filter((p) => !f.titles || f.titles.includes(p.title))
    .filter((p) => !f.factions || f.factions.includes(p.faction))
    .filter((p) => f.bloodHunt === undefined || p.bloodHunt === f.bloodHunt)
    .map((p) => ({ value: p.id, label: p.name }))
    .sort(sortByLabel);
}

export interface MinionFilter {
  maxLevel?: number;
  minLevel?: number;
  types?: MinionType[];
  /** Egna minions i den här staden (bara egna har kända positioner). */
  inCity?: CityId | null;
  exclude?: string[];
}

/** Egna minions. Positionen är den projicerade inför entryn. */
export function ownMinions(ctx: CatalogContext, f: MinionFilter = {}): ParamOption[] {
  return ctx.view.me.minions
    .filter((m) => f.maxLevel === undefined || m.effectiveLevel <= f.maxLevel)
    .filter((m) => f.minLevel === undefined || m.effectiveLevel >= f.minLevel)
    .filter((m) => !f.types || f.types.includes(m.type))
    .filter((m) => !f.exclude || !f.exclude.includes(m.id))
    .filter((m) => {
      if (f.inCity === undefined) return true;
      const at = ctx.positions.minions[m.id] ?? null;
      return f.inCity === null || at === null || at === f.inCity;
    })
    .map((m) => ({ value: m.id, label: minionLabel({ name: m.name, level: m.effectiveLevel, type: m.type }) }))
    .sort(sortByLabel);
}

/** Andra spelares minions (publika i "player stats", gd:403), utan position. */
export function othersMinions(ctx: CatalogContext, f: MinionFilter = {}): ParamOption[] {
  const names = new Map(ctx.view.players.map((p) => [p.id, p.name]));
  return ctx.view.minions
    .filter((m) => m.ownerId !== ctx.view.me.id)
    .filter((m) => f.maxLevel === undefined || m.level <= f.maxLevel)
    .filter((m) => !f.types || f.types.includes(m.type))
    .map((m) => ({ value: m.id, label: `${minionLabel(m)}, ${names.get(m.ownerId) ?? m.ownerId}` }))
    .sort(sortByLabel);
}

/** Andra vampyrer och andras minions (Attack!, Dominate, Iron Fist …). */
export function characters(ctx: CatalogContext): ParamOption[] {
  return [...vampires(ctx), ...othersMinions(ctx)];
}

// ---------------------------------------------------------------------------
// Övrigt

export function choices(list: readonly (readonly [id: string, label: string])[]): () => ParamOption[] {
  return () => list.map(([value, label]) => ({ value, label }));
}

/** Problem och specials i en stad (de är publika, M2; detaljerna är det inte). */
export function cityFeatures(ctx: CatalogContext, cityId: CityId | null, which: 'problems' | 'specials' | 'both'): ParamOption[] {
  if (!cityId) return [];
  const c = cityById(ctx.view, cityId);
  if (!c) return [];
  const list = which === 'problems' ? c.problems : which === 'specials' ? c.specials : [...c.problems, ...c.specials];
  return list.map((f) => ({ value: f.id, label: f.name }));
}

/**
 * Andra entries i samma lista som en buff kan peka på. Bara entries *efter*
 * denna, eftersom en buff måste ligga före aktionen den gäller (gd:95). Pekaren
 * är entryns `key`, så att den håller när ordningen ändras.
 */
export function laterEntries(
  ctx: CatalogContext,
  accept: (a: CatalogContext['list'][number]) => boolean,
  label: (a: CatalogContext['list'][number], index: number) => string,
): ParamOption[] {
  const out: ParamOption[] = [];
  ctx.list.forEach((a, i) => {
    if (i > ctx.index && a.key && accept(a)) out.push({ value: a.key, label: label(a, i) });
  });
  return out;
}

export const optionValues = (opts: ParamOption[]): Set<ParamValue> => new Set(opts.map((o) => o.value));

// ---------------------------------------------------------------------------
// Korta spec-byggare

export const cityParam = (
  key: string,
  label: string,
  options: (ctx: CatalogContext) => ParamOption[],
): ParamSpec => ({ key, label, kind: 'city', options });

export const playerParam = (key: string, label: string, f: PlayerFilter = {}): ParamSpec => ({
  key,
  label,
  kind: 'player',
  options: (ctx) => vampires(ctx, f),
});

export const characterParam = (key: string, label: string): ParamSpec => ({
  key,
  label,
  kind: 'character',
  options: characters,
});

export const choiceParam = (key: string, label: string, list: readonly (readonly [string, string])[]): ParamSpec => ({
  key,
  label,
  kind: 'choice',
  options: choices(list),
});

export const textParam = (key: string, label: string, maxWords: number): ParamSpec => ({
  key,
  label,
  kind: 'text',
  maxWords,
});
