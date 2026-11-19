/**
 * Kopplar katalogens `moves` (målval i utkastet, K4) till rondens `destination`
 * (var observatörer ser utföraren och vilken controller som får sikt, V16).
 * Båda ska ge samma stad, så destinationen härleds från `moves` i stället för
 * att skrivas två gånger.
 */
import type { ActionDefinition, ActionRegistry, TargetContext } from '../round/actions.js';
import type { CityId, MinionId } from '../state/ids.js';
import { buildPlayerView } from '../view/player.js';
import type { CatalogContext, ProjectedPositions } from './types.js';

/**
 * Destination läst från `moves` vid upplösning: positionerna är de verkliga
 * just då (tidigare förflyttningar i ronden har redan lösts). Okänd stad
 * (`to: null`, t.ex. Second Tradition) ger `null`, alltså "stannar";
 * sådana aktioner sätter `destination` själva.
 */
export function destinationFromMoves(
  def: ActionDefinition,
  registry: () => ActionRegistry,
): ((ctx: TargetContext) => CityId | null) | undefined {
  const moves = def.moves;
  if (!moves) return undefined;
  return ({ state, content, entry }) => {
    const view = buildPlayerView(state, content, entry.playerId);
    const minions: Record<MinionId, CityId | null> = {};
    for (const m of view.me.minions) minions[m.id] = m.location;
    const positions: ProjectedPositions = { vampire: view.me.location, minions };
    const ctx: CatalogContext = {
      view,
      content,
      action: entry.action,
      positions,
      list: [entry.action],
      index: 0,
      registry: registry(),
    };
    const p = entry.action.performer;
    const mv = moves(ctx).find((m) =>
      p.kind === 'vampire' ? m.performer.kind === 'vampire' : m.performer.kind === 'minion' && m.performer.minionId === p.minionId,
    );
    return mv?.to ?? null;
  };
}

/** Sätter `destination` från `moves` på alla aktioner som inte har en egen. */
export function withDestinations(defs: readonly ActionDefinition[], registry: () => ActionRegistry): ActionDefinition[] {
  return defs.map((d) => {
    if (d.destination) return d;
    const destination = destinationFromMoves(d, registry);
    return destination ? { ...d, destination } : d;
  });
}
