/**
 * Kartmodellen ur motorns `PlayerView.map`. Motorn avgör vad spelaren
 * garanterat vet (V15–V19): egna pjäser alltid, andras bara om de sågs förra
 * ronden och fortfarande är kvar. Ingen "last known position".
 * Här skalas bara positionerna till kartans rityta.
 */
import type { MapView } from '@vampyre/engine';
import type { FactionKey, MapModel } from './model';

export interface Position {
  x: number;
  y: number;
}

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 700;
const MARGIN = 90;

/** Städerna jämnt på en ellips, i id-ordning. Används för städer som saknar position. */
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

/** Skalar kartmallens koordinater till ritytan och behåller proportionerna. */
export function fitPositions(positions: Record<string, Position>): Record<string, Position> {
  const pts = Object.values(positions);
  if (pts.length === 0) return {};
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min((MAP_WIDTH - 2 * MARGIN) / w, (MAP_HEIGHT - 2 * MARGIN) / h);
  const offX = (MAP_WIDTH - w * scale) / 2;
  const offY = (MAP_HEIGHT - h * scale) / 2;
  return Object.fromEntries(
    Object.entries(positions).map(([id, p]) => [
      id,
      { x: Math.round(offX + (p.x - minX) * scale), y: Math.round(offY + (p.y - minY) * scale) },
    ]),
  );
}

export function buildMapModel(map: MapView): MapModel {
  const allPlaced = map.cities.every((c) => c.position !== null);
  const layout = allPlaced
    ? fitPositions(Object.fromEntries(map.cities.map((c) => [c.id, c.position!])))
    : fallbackLayout(map.cities.map((c) => c.id));
  const ownerName = (id: string) => map.cities.flatMap((c) => c.occupants).find((o) => o.kind === 'vampire' && o.playerId === id)?.name;

  return {
    cities: map.cities.map((c) => ({
      id: c.id,
      name: c.name,
      x: layout[c.id]!.x,
      y: layout[c.id]!.y,
      faction: c.faction as FactionKey | null,
      pieces: c.occupants.map((o) =>
        o.kind === 'vampire'
          ? { id: o.playerId, kind: 'vampire' as const, name: o.name, own: o.own, ownerName: o.name }
          : {
              id: o.minionId,
              kind: 'minion' as const,
              name: o.name,
              own: o.own,
              ownerName: ownerName(o.ownerId) ?? '',
              minionType: o.type,
            },
      ),
    })),
    links: map.connections.map(([a, b]) => [a, b] as [string, string]),
  };
}
