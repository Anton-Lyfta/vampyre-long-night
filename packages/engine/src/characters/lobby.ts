/**
 * Kampanjens lobby före start: vilka spelare som gått med och med vilken
 * karaktär (K10–K13).
 *
 * En spelare går med antingen med en befintlig karaktär ur sin backlog eller
 * med en ny, som då också sparas i backloggen. Platsen får en kopia av bygget,
 * så att senare ändringar i backloggen inte påverkar kampanjen.
 */
import type { Content } from '../content/index.js';
import type { Title } from '../state/enums.js';
import { addCharacter, type CharacterBacklog, type CharacterId } from './backlog.js';
import { V1_CREATABLE_TITLES, validateCharacterBuild } from './build.js';
import type { CharacterBuild, CreationIssue } from './types.js';

export interface CampaignLobbyConfig {
  /** Titlar som får användas i kampanjen. Standard: V1:s titlar (utan Justicar). */
  readonly allowedTitles: readonly Title[];
  /** Max antal karaktärer per sann titel. Saknad nyckel = obegränsat (K12). */
  readonly titleLimits: Readonly<Partial<Record<Title, number>>>;
  /** Standard 20 (gd:5). */
  readonly maxPlayers: number;
}

export interface CampaignSeat {
  readonly userId: string;
  readonly characterId: CharacterId;
  /** Backlog-versionen som kopierades. */
  readonly characterVersion: number;
  readonly build: CharacterBuild;
}

export interface CampaignLobby {
  readonly campaignId: string;
  readonly config: CampaignLobbyConfig;
  /** I anslutningsordning. Ordningen bestämmer player-id vid start. */
  readonly seats: readonly CampaignSeat[];
}

export const DEFAULT_LOBBY_CONFIG: CampaignLobbyConfig = {
  allowedTitles: V1_CREATABLE_TITLES,
  titleLimits: {},
  maxPlayers: 20,
};

export function createLobby(campaignId: string, config: Partial<CampaignLobbyConfig> = {}): CampaignLobby {
  return { campaignId, config: { ...DEFAULT_LOBBY_CONFIG, ...config }, seats: [] };
}

export type JoinRequest =
  | { readonly kind: 'existing'; readonly characterId: CharacterId }
  | { readonly kind: 'new'; readonly build: CharacterBuild };

export type JoinResult =
  | {
      readonly ok: true;
      readonly lobby: CampaignLobby;
      /** Oförändrad för `existing`; med den nya karaktären för `new`. */
      readonly backlog: CharacterBacklog;
      readonly seat: CampaignSeat;
    }
  | { readonly ok: false; readonly issues: readonly CreationIssue[] };

/**
 * Låter backloggens ägare gå med i kampanjen. Kontrollerar att spelaren inte
 * redan är med, att det finns plats, att titeln är tillåten och inte full, och
 * att karaktären är giltig mot kampanjens regler.
 */
export function joinCampaign(
  lobby: CampaignLobby,
  backlog: CharacterBacklog,
  request: JoinRequest,
  content: Content,
): JoinResult {
  const fail = (path: string, message: string): JoinResult => ({ ok: false, issues: [{ path, message }] });
  const userId = backlog.ownerId;
  const options = { allowedTitles: lobby.config.allowedTitles };

  if (lobby.seats.some((s) => s.userId === userId)) return fail('userId', 'spelaren är redan med i kampanjen');
  if (lobby.seats.length >= lobby.config.maxPlayers) return fail('lobby', 'kampanjen är full');

  let build: CharacterBuild;
  if (request.kind === 'existing') {
    const sheet = backlog.characters[request.characterId];
    if (sheet === undefined) return fail('characterId', `okänd karaktär ${request.characterId}`);
    build = sheet.build;
  } else {
    build = request.build;
  }

  const issues = validateCharacterBuild(build, content, options);
  if (issues.length > 0) return { ok: false, issues };

  const limit = lobby.config.titleLimits[build.title];
  if (limit !== undefined && lobby.seats.filter((s) => s.build.title === build.title).length >= limit) {
    return fail('title', `kampanjen har inga lediga platser för ${build.title}`);
  }

  let nextBacklog = backlog;
  let characterId: CharacterId;
  let characterVersion: number;
  if (request.kind === 'existing') {
    characterId = request.characterId;
    characterVersion = (backlog.characters[characterId] as { version: number }).version;
  } else {
    const added = addCharacter(backlog, build, content, options);
    if (!added.ok) return added;
    nextBacklog = added.backlog;
    characterId = added.characterId;
    characterVersion = 1;
  }

  const seat: CampaignSeat = { userId, characterId, characterVersion, build };
  return { ok: true, lobby: { ...lobby, seats: [...lobby.seats, seat] }, backlog: nextBacklog, seat };
}

/** Lämnar lobbyn. Karaktären finns kvar i backloggen. */
export function leaveCampaign(lobby: CampaignLobby, userId: string): CampaignLobby {
  return { ...lobby, seats: lobby.seats.filter((s) => s.userId !== userId) };
}
