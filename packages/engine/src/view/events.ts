import type { PlayerId } from '../state/ids.js';
import type { RoundEvent } from '../round/types.js';

/** Om spelaren finns i eventets sparade publik (M18). Räknar aldrig om synlighet. */
export function eventVisibleTo(event: RoundEvent, playerId: PlayerId): boolean {
  switch (event.audience.kind) {
    case 'public':
      return true;
    case 'gm':
      return false;
    case 'players':
      return event.audience.ids.includes(playerId);
  }
}
