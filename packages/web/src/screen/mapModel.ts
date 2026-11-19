/**
 * Kartmodellen ur en `PlayerView`. Regeln (Gustaf 2026-11-19): kartan visar bara
 * information spelaren garanterat vet. Egna pjäser syns alltid. Andras pjäser
 * syns bara om spelaren såg dem förra ronden; den modellen kommer från tråden
 * "Visa bara garanterad info på kartan" och skickas in som `sightings`.
 * Ingen "last known position".
 */
import type { PlayerView } from '@vampyre/engine';
import type { FactionKey, MapCity, MapModel, MapPiece } from './model';

export interface Position {
  x: number;
  y: number;
}

/** En annan spelares pjäs som spelaren garanterat vet var den är. */
export interface Sighting {
  cityId: string;
  piece: Omit<MapPiece, 'own'>;
}

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 700;

/** Städerna jämnt på en ellips, i id-ordning. Används när kartan saknar positioner. */
export function fallbackLayout(cityIds: readonly string[]): Record<string, Position> {
  const out: Record<string, Position> = {};
  const n = cityIds.length;
  cityIds.forEach((id, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
    out[id] = {
      x: Math.round(MAP_WIDTH / 2 + Math.cos(a) * MAP_WIDTH * 0.38),
      y: Math.round(MAP_HEIGHT / 2 + Math.sin(a) * MAP_HEIGHT * 0.38),
    };
  });
  return out;
}

export function buildMapModel(
  view: PlayerView,
  opts: { positions?: Record<string, Position>; sightings?: readonly Sighting[] } = {},
): MapModel {
  const factionOf = new Map(view.players.map((p) => [p.id as string, p.faction as FactionKey]));
  const fallback = fallbackLayout(view.cities.map((c) => c.id));

  const piecesByCity = new Map<string, MapPiece[]>();
  const add = (cityId: string | null, piece: MapPiece) => {
    if (!cityId) return;
    const list = piecesByCity.get(cityId) ?? [];
    if (!list.some((x) => x.kind === piece.kind && x.id === piece.id)) list.push(piece);
    piecesByCity.set(cityId, list);
  };

  const me = view.me;
  if (me.status !== 'burned') {
    add(me.location, { id: me.id, kind: 'vampire', name: me.name, own: true, ownerName: me.name });
  }
  for (const m of me.minions) {
    add(m.location, {
      id: m.id,
      kind: 'minion',
      name: m.name,
      own: true,
      ownerName: me.name,
      minionType: m.type,
    });
  }
  for (const s of opts.sightings ?? []) add(s.cityId, { ...s.piece, own: false });

  const cities: MapCity[] = view.cities.map((c) => {
    const pos = opts.positions?.[c.id] ?? fallback[c.id]!;
    return {
      id: c.id,
      name: c.name,
      x: pos.x,
      y: pos.y,
      faction: c.controllerId ? (factionOf.get(c.controllerId) ?? null) : null,
      pieces: piecesByCity.get(c.id) ?? [],
    };
  });

  const links: [string, string][] = [];
  for (const c of view.cities) for (const n of c.adjacent) if (c.id < n) links.push([c.id, n]);

  return { cities, links };
}
