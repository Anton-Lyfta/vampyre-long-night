/**
 * Kartvyn: det spelaren **garanterat** vet om var vampyrer och minions finns
 * (beslut V15–V19 i `docs/decisions/views.md`).
 *
 * - Egen vampyr och egna minions syns alltid.
 * - Andras vampyrer och minions syns bara om spelaren såg dem under den senast
 *   upplösta ronden (en observerad aktion med position, eller ett `sighted`-event)
 *   **och** de fortfarande är kvar där. Ingen "last known position".
 */
import type { Content } from '../content/index.js';
import type { Faction, MinionType } from '../state/enums.js';
import type { CityId, MinionId, PlayerId } from '../state/ids.js';
import { sortedValues } from '../state/json.js';
import { apparentFaction } from '../state/queries.js';
import type { GameState } from '../state/types.js';
import type { Json, RoundEvent } from '../round/types.js';
import { eventVisibleTo } from './events.js';

export type MapOccupant =
  | {
      kind: 'vampire';
      playerId: PlayerId;
      name: string;
      /** Sant för spelarens egen vampyr. */
      own: boolean;
    }
  | {
      kind: 'minion';
      minionId: MinionId;
      name: string;
      ownerId: PlayerId;
      type: MinionType;
      level: number;
      own: boolean;
    };

export interface MapCityView {
  id: CityId;
  name: string;
  /** Från kartmallen; `null` om mallen saknar position. */
  position: { x: number; y: number } | null;
  adjacent: CityId[];
  controllerId: PlayerId | null;
  /** Controllerns skenbara sekt (en dold Archbishop färgar som sin förklädnad). `null` = okontrollerad. */
  faction: Faction | null;
  contested: boolean;
  /** Vampyrer och minions spelaren garanterat vet är här, vampyrer först, sedan id-ordning. */
  occupants: MapOccupant[];
}

export interface MapView {
  /** Ronden observationerna kommer från, eller `null` innan någon rond har lösts. */
  sightingsFromRound: number | null;
  cities: MapCityView[];
  /** Grannpar (a < b), en gång per par, för att rita kopplingar. */
  connections: [CityId, CityId][];
}

type Subject = { kind: 'vampire'; playerId: PlayerId } | { kind: 'minion'; minionId: MinionId; ownerId: PlayerId };

interface Sighting {
  subject: Subject;
  at: CityId;
}

/** Senast upplösta ronden: under inlämningen av rond N är det N−1. */
export function lastResolvedRound(state: GameState): number | null {
  const r = state.phase === 'finished' ? state.round : state.round - 1;
  return r >= 1 ? r : null;
}

const isRecord = (v: Json | undefined): v is { [key: string]: Json } =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Läser vem som sågs ur ett `action_observed`- eller `sighted`-event. */
function subjectOf(v: Json | undefined): Subject | null {
  if (!isRecord(v)) return null;
  if (v.kind === 'vampire' && typeof v.playerId === 'string') return { kind: 'vampire', playerId: v.playerId as PlayerId };
  if (v.kind === 'minion' && typeof v.minionId === 'string') {
    const owner = typeof v.controllerId === 'string' ? v.controllerId : v.ownerId;
    if (typeof owner === 'string') return { kind: 'minion', minionId: v.minionId as MinionId, ownerId: owner as PlayerId };
  }
  return null;
}

/**
 * Observationer med position som spelaren fick under `round`, i eventordning.
 *
 * - `action_observed` med `at` (V16): utföraren sågs i `at`.
 * - `sighted` med `{ subject, at }`: generiskt event för Search, Bowl of Convergence m.fl.
 */
export function sightingsFor(events: readonly RoundEvent[], viewerId: PlayerId, round: number): Sighting[] {
  const out: Sighting[] = [];
  for (const e of events) {
    if (e.round !== round || !eventVisibleTo(e, viewerId) || !e.data) continue;
    if (typeof e.data.at !== 'string') continue;
    const subject =
      e.kind === 'action_observed' ? subjectOf(e.data.performer) : e.kind === 'sighted' ? subjectOf(e.data.subject) : null;
    if (subject) out.push({ subject, at: e.data.at as CityId });
  }
  return out;
}

const subjectKey = (s: Subject) => (s.kind === 'vampire' ? `v:${s.playerId}` : `m:${s.minionId}`);

export function buildMapView(
  state: GameState,
  _content: Content,
  viewerId: PlayerId,
  events: readonly RoundEvent[],
): MapView {
  const occupants = new Map<CityId, MapOccupant[]>();
  const place = (city: CityId, o: MapOccupant) => {
    const list = occupants.get(city) ?? [];
    list.push(o);
    occupants.set(city, list);
  };

  // Egna: alltid.
  const me = state.players[viewerId]!;
  if (me.location !== null) place(me.location, { kind: 'vampire', playerId: me.id, name: me.name, own: true });
  for (const m of sortedValues(state.minions)) {
    if (m.owner.kind === 'player' && m.owner.id === viewerId) {
      place(m.location, { kind: 'minion', minionId: m.id, name: m.name, ownerId: viewerId, type: m.type, level: m.level, own: true });
    }
  }

  // Andras: senaste observationen per subjekt i senast upplösta ronden, bara om den fortfarande stämmer (V17).
  const round = lastResolvedRound(state);
  const latest = new Map<string, Sighting>();
  if (round !== null) for (const s of sightingsFor(events, viewerId, round)) latest.set(subjectKey(s.subject), s);
  for (const { subject, at } of latest.values()) {
    if (subject.kind === 'vampire') {
      if (subject.playerId === viewerId) continue;
      const p = state.players[subject.playerId];
      if (!p || p.status === 'burned' || p.location !== at) continue;
      place(at, { kind: 'vampire', playerId: p.id, name: p.name, own: false });
    } else {
      const m = state.minions[subject.minionId];
      if (!m || m.owner.kind !== 'player' || m.owner.id === viewerId) continue;
      if (m.owner.id !== subject.ownerId || m.location !== at) continue;
      place(at, { kind: 'minion', minionId: m.id, name: m.name, ownerId: m.owner.id, type: m.type, level: m.level, own: false });
    }
  }

  const occupantOrder = (o: MapOccupant) => (o.kind === 'vampire' ? `0:${o.playerId}` : `1:${o.minionId}`);
  const cities = sortedValues(state.cities).map((c): MapCityView => {
    const controller = c.controllerId !== null ? state.players[c.controllerId] : undefined;
    return {
      id: c.id,
      name: c.name,
      position: c.position ? { x: c.position.x, y: c.position.y } : null,
      adjacent: [...c.adjacent],
      controllerId: c.controllerId,
      faction: controller ? apparentFaction(controller) : null,
      contested: c.contestants.length > 0,
      occupants: (occupants.get(c.id) ?? []).sort((a, b) => (occupantOrder(a) < occupantOrder(b) ? -1 : 1)),
    };
  });
  const connections: [CityId, CityId][] = [];
  for (const c of cities) for (const n of c.adjacent) if (c.id < n) connections.push([c.id, n]);

  return { sightingsFromRound: round, cities, connections };
}
