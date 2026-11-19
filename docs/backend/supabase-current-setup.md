# Supabase: nuvarande setup och vad som kan återanvändas

Kartläggning av Supabase-projektet **"Vampire"** (ref `pyybhldmqfbnmtoujwtm`, region `eu-west-1`, Postgres 17.6) gjord 2026-11-19, direkt efter att projektet återställts från paus. Allt är läst via Supabase-connectorn, read-only: ingenting i databasen har ändrats.

Syftet är att andra agenter ska kunna läsa vad som finns utan att gå in i databasen, och se per del vad som kan återanvändas mot motorns nuvarande modell (`packages/engine`, beslut i `docs/engine/001_motorbeslut.md` och `docs/decisions/`).

## Sammanfattning

- **Databasen är tom.** Alla 26 tabeller i `public` har 0 rader (räknat med `count(*)`, inte bara statistik). `auth.users` har 0 användare. Det finns ingen speldata att migrera.
- **Tre generationer finns, och de passar inte ihop:**
  1. Prototypens schema (dokumenterat i `docs/prototype/research/003_database_schema.md`: `players`, `city_contests`, `round_phase` …). Finns **inte** i databasen längre.
  2. Det schema som faktiskt ligger i databasen nu (migrationer 2026-06-03 till 2026-06-10). En annan, generisk modell: `characters`, `rounds`, `actions`, `events`, `combats`, `chat_*`.
  3. Edge-funktionen `resolve-round` (deployad 2026-03-19) är skriven mot generation 1. Den läser tabeller och kolumner som inte finns, så den kan inte köras mot dagens schema.
- **Ingen av dem matchar motorn.** Motorn håller hela spelet som ett JSON-objekt (`GameState`), med rondfönster (`RoundWindow`), pausbar upplösning (`RoundResolution`), events med `audience` och per-spelare-vyer. Databasen är normaliserad per entitet och lägger spellogik (blood-dragning) i SQL.
- **Värt att behålla:** auth-kopplingen (`profiles` + trigger), kampanj/medlemskap/roller med `is_campaign_member`/`is_campaign_gm`, invites-modellen, chat-modellen och idén med `events.visible_to` + `player_round_updates`. Allt behöver säkerhetsfixar (se [Säkerhet](#säkerhet-och-advisors)).
- **Värt att ersätta:** spelstatets tabeller (karta, karaktärer, minions, modifiers, combats), `submit_action`-logiken och edge-funktionen.
- **Allvarligast:** flera RLS-policyer läcker dold information till alla kampanjmedlemmar (allas aktioner, karaktärers sekt och blood, rondens `rng_seed`). Det strider mot SPEC B3 och M2/M9.

## Projekt och plattform

| Del | Läge |
|---|---|
| Projekt | `Vampire`, skapat 2026-02-27, status `ACTIVE_HEALTHY` |
| Scheman | `public`, `auth`, `storage`, `realtime`, `vault`, `graphql`, `graphql_public`, `extensions`, `supabase_migrations` |
| Extensions installerade | `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `pg_graphql`, `supabase_vault`, `plpgsql`. **Inte** `pg_cron` eller `pg_net` (behövs om deadlines ska trigga upplösning från databasen). |
| Auth | 0 användare, 0 identities. Trigger `on_auth_user_created` skapar en `profiles`-rad. Vilka inloggningsmetoder som är på syns inte via SQL; kontrollera i dashboarden (Authentication → Providers). |
| Storage | 0 buckets, 0 objekt. |
| Realtime | Publikationen `supabase_realtime` innehåller **inga** tabeller. Ingen tabell sänder ändringar i dag. |
| Edge functions | En: `resolve-round` (v8, `verify_jwt: false`). Se [egen sektion](#edge-function-resolve-round). |
| Migrationer | 8 st i `supabase_migrations.schema_migrations`, se nedan. Finns inte som filer i något repo vi har. |

### Migrationshistorik

| Version | Namn | Innehåll |
|---|---|---|
| 20260603091414 | (uuid) | `profiles`, `app_role`, `user_roles`, `has_role()`, `handle_new_user()` + trigger, `set_updated_at()` |
| 20260603091429 | (uuid) | Revoke/grant på hjälpfunktionerna |
| 20260603091441 | (uuid) | `set_updated_at()` om, med `search_path` |
| 20260603092206 | (uuid) | Hela spelschemat: 8 enums, 24 tabeller, RLS, index, triggers (174 statements) |
| 20260603092223 | (uuid) | Revoke/grant på `is_campaign_member`/`is_campaign_gm` |
| 20260610084610 | (uuid) | `create_campaign_with_gm()` v1 |
| 20260610085149 | (uuid) | `create_campaign_with_gm()` v2 (seedar karta + rond 1), `submit_action`, `unsubmit_action`, `gm_lock_round`, `gm_advance_round` |
| 20260610120000 | `add_kind_to_city_adjacencies` | Lägger till `city_adjacencies.kind` (`land`/`sea`), som v2 av `create_campaign_with_gm` förutsatte men som saknades |

Fullständig SQL kan hämtas med `select statements from supabase_migrations.schema_migrations where version = '…'`.

## Schemat i `public`

Alla tabeller har RLS påslaget. Alla id:n är `uuid` med `gen_random_uuid()`. Tidsstämplar är `timestamptz default now()`, och `updated_at` sätts av triggern `set_updated_at` på `campaigns`, `characters`, `cities`, `actions`, `combats`, `profiles`.

### Enums

| Enum | Värden |
|---|---|
| `app_role` | `platform_admin` |
| `campaign_role` | `gm`, `player` |
| `campaign_status` | `setup`, `active`, `paused`, `completed`, `archived` |
| `round_status` | `open`, `locked`, `resolving`, `resolved` |
| `action_status` | `draft`, `submitted`, `queued`, `resolving`, `resolved`, `failed`, `cancelled` |
| `combat_status` | `standoff`, `charge`, `combat`, `negotiation`, `press`, `wounds`, `resolved`, `cancelled` |
| `sect` | `camarilla`, `sabbat`, `anarch`, `independent` |
| `invite_status` | `pending`, `accepted`, `revoked`, `expired` |
| `chat_channel_kind` | `all_players`, `sect`, `adhoc`, `combat`, `gm_player` |

### Tabeller

Kolumner i kortform. `→` = foreign key, `(c)` = `ON DELETE CASCADE`, `(n)` = `SET NULL`, annars `NO ACTION`.

**Användare och plattform**

| Tabell | Kolumner | Nycklar/unika |
|---|---|---|
| `profiles` | `id` → auth.users (c), `display_name`, `avatar_url`, `created_at`, `updated_at` | PK `id` |
| `user_roles` | `id`, `user_id` → auth.users (c), `role app_role`, `created_at` | unik (`user_id`, `role`) |

**Kampanj och medlemskap**

| Tabell | Kolumner | Nycklar/unika |
|---|---|---|
| `campaigns` | `id`, `name`, `description`, `status` (default `setup`), `current_round` (0), `max_players` (20), `created_by`, `created_at`, `updated_at` | `created_by` har ingen FK |
| `campaign_members` | `id`, `campaign_id` → campaigns (c), `user_id`, `role campaign_role`, `display_name`, `joined_at` | unik (`campaign_id`, `user_id`); `user_id` har ingen FK |
| `invites` | `id`, `campaign_id` → campaigns (c), `email`, `token` (unik), `role` (default `player`), `status` (default `pending`), `invited_by`, `expires_at`, `created_at` | |

**Referensdata (globalt, inte per kampanj)**

| Tabell | Kolumner |
|---|---|
| `clans` | `id`, `slug` (unik), `name`, `sect`, `description`, `clan_boon`, `clan_curse` |
| `disciplines` | `id`, `slug` (unik), `name`, `description` |
| `clan_disciplines` | PK (`clan_id`, `discipline_id`), `is_in_clan` |
| `action_definitions` | `id`, `slug` (unik), `name`, `category`, `cost_blood`, `cost_actions`, `stealth_default`, `requires_target_type`, `description`, `rules_json jsonb` |
| `minion_types` | `id`, `slug` (unik), `name`, `upkeep_blood`, `description`, `rules_json jsonb` |

**Karta (per kampanj)**

| Tabell | Kolumner |
|---|---|
| `cities` | `id`, `campaign_id` → campaigns (c), `name`, `region`, `base_income` (1), `position_x`, `position_y`, `controller_character_id` (ingen FK), `notes`, tidsstämplar |
| `city_adjacencies` | `id`, `campaign_id` (c), `city_a_id` (c), `city_b_id` (c), `kind` (`land`/`sea`, check) ; unik (`city_a_id`, `city_b_id`) |
| `sea_regions` | `id`, `campaign_id` (c), `name` |
| `city_sea_regions` | PK (`city_id`, `sea_region_id`), båda (c) |

**Karaktärer och tillgångar**

| Tabell | Kolumner |
|---|---|
| `characters` | `id`, `campaign_id` (c), `user_id`, `name`, `title text`, `clan_id` → clans, `sect`, `starting_city_id`, `current_city_id`, `blood` (0), `max_blood` (10), `exp_spent` (0), `exp_cap` (12), `alive` (true), `notes`, tidsstämplar ; unik (`campaign_id`, `user_id`) |
| `character_stat_modifiers` | `id`, `character_id` (c), `stat text`, `value int`, `source text`, `source_kind text`, `notes`, `created_at` |
| `minions` | `id`, `character_id` (c), `minion_type_id`, `name`, `location_city_id`, `alive`, `notes`, `created_at` |

**Ronder, aktioner och utfall**

| Tabell | Kolumner |
|---|---|
| `rounds` | `id`, `campaign_id` (c), `number`, `status` (default `open`), `deadline_at`, `opened_at`, `resolved_at`, `rng_seed text`, `notes` ; unik (`campaign_id`, `number`) |
| `actions` | `id`, `round_id` (c), `campaign_id` (c), `character_id` (c), `action_definition_id`, `order_index`, `status` (default `draft`), `target_kind`, `target_id`, `stealth bool`, `cost_blood`, `payload jsonb`, `resolution_notes`, tidsstämplar |
| `events` | `id`, `campaign_id` (c), `round_id` (c), `action_id` (n), `kind`, `summary`, `payload jsonb`, `visible_to uuid[]`, `is_public bool`, `created_at` |
| `player_round_updates` | `id`, `campaign_id` (c), `round_id` (c), `user_id`, `payload jsonb`, `created_at` ; unik (`round_id`, `user_id`) |

**Strid**

| Tabell | Kolumner |
|---|---|
| `combats` | `id`, `campaign_id` (c), `round_id` (n), `initiating_action_id` (n), `status` (default `standoff`), `city_id`, `attacker_character_id`, `defender_character_id`, `current_step`, `step_deadline_at`, `payload jsonb`, tidsstämplar |
| `combat_steps` | `id`, `combat_id` (c), `step_index`, `step_kind`, `actor_character_id`, `payload jsonb`, `created_at` |
| `combat_promises` | `id`, `combat_id` (c), `from_character_id`, `to_character_id`, `promise_kind`, `payload jsonb`, `honored bool`, `created_at` |

**Chat**

| Tabell | Kolumner |
|---|---|
| `chat_channels` | `id`, `campaign_id` (c), `kind`, `name`, `member_user_ids uuid[]`, `combat_id` (c), `created_at` |
| `chat_messages` | `id`, `channel_id` (c), `sender_user_id`, `sender_character_id`, `body`, `payload jsonb`, `created_at` |

Index utöver PK och unika: `campaign_members(user_id)`, `campaign_members(campaign_id)`, `cities(campaign_id)`, `characters(campaign_id)`, `character_stat_modifiers(character_id)`, `minions(character_id)`, `actions(round_id)`, `actions(character_id)`, `events(campaign_id, round_id)`, `combats(campaign_id)`, `combat_steps(combat_id)`, `chat_channels(campaign_id)`, `chat_messages(channel_id, created_at)`.

## RLS-policyer

Alla policyer gäller rollen `authenticated`. `member` = `is_campaign_member(auth.uid(), campaign_id)`, `gm` = `is_campaign_gm(auth.uid(), campaign_id)`. Policyer på undertabeller går via en `EXISTS` mot föräldern (character, combat, city, channel).

| Tabell | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | alla inloggade | egen (`id = uid`) | egen | – |
| `user_roles` | egna rader | – | – | – |
| `campaigns` | member | `created_by = uid` | gm | gm |
| `campaign_members` | member | `user_id = uid` **eller** gm | gm | gm |
| `invites` | gm (ALL) | gm | gm | gm |
| `clans`, `disciplines`, `clan_disciplines`, `action_definitions`, `minion_types` | alla inloggade | – | – | – |
| `cities`, `city_adjacencies`, `sea_regions`, `city_sea_regions` | member; gm (ALL) | gm | gm | gm |
| `characters` | **member (alla karaktärer i kampanjen)** | egen + member | ägare eller gm | gm |
| `character_stat_modifiers` | **member** ; gm (ALL) | gm | gm | gm |
| `minions` | **member** ; ägare eller gm (ALL) | ägare/gm | ägare/gm | ägare/gm |
| `rounds` | **member (inkl. `rng_seed`)** ; gm (ALL) | gm | gm | gm |
| `actions` | **member (allas aktioner)** | ägare eller gm | ägare eller gm | ägare eller gm |
| `events` | `is_public` eller gm eller `uid = ANY(visible_to)` ; gm (ALL) | gm | gm | gm |
| `player_round_updates` | egen rad eller gm ; gm (ALL) | gm | gm | gm |
| `combats`, `combat_steps`, `combat_promises` | **member** ; gm (ALL) | gm | gm | gm |
| `chat_channels` | gm, eller `all_players` + member, eller `uid = ANY(member_user_ids)` ; gm (ALL) | gm | gm | gm |
| `chat_messages` | samma regel som kanalen | `sender_user_id = uid` + får se kanalen | – | – |

Fetstilt = läcker dold information enligt SPEC B3 (se nästa avsnitt).

## Funktioner (RPC)

Alla i `public`, `SECURITY DEFINER`, `search_path = public`.

| Funktion | Vad den gör | Anmärkning |
|---|---|---|
| `is_campaign_member(user, campaign)` / `is_campaign_gm(user, campaign)` | `EXISTS` mot `campaign_members`. Används i nästan alla policyer. | Security definer undviker RLS-rekursion på `campaign_members` (jfr `docs/prototype/research/006_chat_members_rls_recursion.md`). Bra mönster. |
| `has_role(user, app_role)` | Plattformsroll (`platform_admin`). | Används inte av någon policy. |
| `handle_new_user()` | Trigger på `auth.users`: skapar `profiles` med namn från `full_name`/`name`/e-postprefix. | Återanvändbar som den är. |
| `set_updated_at()` | Trigger. | |
| `create_campaign_with_gm(name, description)` | Skapar kampanj, gör anroparen till GM, **seedar en Europakarta** (Vienna, Prague, Venice, Paris, London, Berlin, Rome, Constantinople, 11 landförbindelser) och öppnar rond 1. | Fel karta: spelet utspelar sig på de brittiska öarna (`content/maps/britishIsles.ts`). Sätter `current_round = 1` direkt, så det finns ingen setup-/lobbyfas. |
| `submit_action(campaign, slug, target_kind, target_id, stealth, payload)` | Hittar anroparens levande karaktär och öppen rond, kollar blood mot `action_definitions.cost_blood`, lägger till en rad sist i listan och **drar blood direkt**. | Krockar med motorn: där betalas allt i fas 1a vid upplösning, ogiltiga entries stryks utan betalning (M7), och listan är hela spelarens `Submission`. Ingen budget-, titel- eller disciplinkontroll. |
| `unsubmit_action(action)` | Tar bort en aktion i öppen rond och ger tillbaka blood (kapat på `max_blood`). | |
| `gm_lock_round(campaign)` | Sätter öppen rond till `locked`. | |
| `gm_advance_round(campaign)` | Markerar aktuell rond och dess aktioner som `resolved` **utan att lösa något**, öppnar nästa rond. | Platshållare för upplösning. |

## Edge function `resolve-round`

Deployad 2026-03-19 (version 8), `verify_jwt: false` men kontrollerar själv anroparen med `auth.getUser()`. 14 filer, ca 1 900 rader TypeScript (Deno):

```
resolve-round/index.ts            orkestrering
resolve-round/phases/             payment, resolve-actions (stub), end-of-round (stub), income, start-next-round (stub)
resolve-round/output/             round-updates (per spelare), round-news, game-log
_shared/load-state.ts             läser hela kampanjen till minnet (Map per tabell)
_shared/write-state.ts            skriver mutationer tillbaka
_shared/types.ts                  radtyper, GameState, MutationLog
_shared/utils/visibility.ts       stealth/intercept-filtrering
```

**Flöde:** POST `{ campaign_id }` → kräver att anroparen är `campaigns.created_by` → kräver `round_phase = 'action_submission'` → sätter `round_phase = 'resolving'` som lås → laddar state → kör faserna i ordning (payment, actions, end-of-round, income, start-next-round), applicerar varje fas mutationer på minnesstatet → genererar game log, per-spelare round updates (filtrerade genom `visibility.ts`) och round news → skriver allt → räknar upp rond och sätter `round_phase` till `combat_pending` om strider skapats, annars `action_submission`. Vid fel återställs `round_phase`.

**Fungerar inte mot dagens schema.** Den läser `campaigns.round_phase` och tabellerna `players`, `city_contests`, `city_problems`, `city_specials`, `clan_definitions`, `active_modifiers`, `player_disciplines`, `artifacts`, `artifact_definitions`, `sabbat_bases`, `missions`, `debates`, `debate_votes`, och skriver till `round_updates`, `round_news`, `game_log`. Ingen av dem finns i databasen nu; de motsvarar prototypens schema i `003_database_schema.md`. Det första anropet skulle alltså fela på kampanjuppslaget.

**Andra observationer:**
- Bara payment och income är implementerade; aktionsupplösningen är en stub som markerar allt `resolved`.
- Skrivningarna körs parallellt med `Promise.all` utan transaktion. Ett fel halvvägs lämnar en halvskriven rond, vilket bryter SPEC B1 (atomisk commit).
- Ingen seed eller PRNG; inget är deterministiskt spårbart.
- `visibility.ts` räknar synlighet i efterhand per spelare; motorn sätter i stället `audience` när eventet skapas (M18, `docs/decisions/views.md`).

## Säkerhet och advisors

### Informationsläckor i RLS (viktigast)

SPEC B3 kräver att dold information aldrig når en klient som inte har rätt till den, och att dataskiktet är ett av två försvar. Dagens policyer bryter mot det på flera ställen:

| Läcka | Varför det är ett problem |
|---|---|
| `actions`: alla medlemmar läser allas aktioner, inklusive mål och `payload` | Hela stealth/intercept-mekaniken blir meningslös. |
| `characters`: alla medlemmar läser alla karaktärer, inklusive `sect`, `blood`, `current_city_id` | Avslöjar dolda Archbishops (sann sekt), exakta resurser (possession-private) och positioner. |
| `rounds.rng_seed`: läsbar för alla medlemmar | M9 säger att seeden är dold. Med seeden kan en spelare förutsäga slump i upplösningen. |
| `character_stat_modifiers`, `minions`, `combats`, `combat_steps`, `combat_promises`: alla medlemmar | Avslöjar stats, minionplaceringar och strider man inte är part i (t.ex. hemliga Charge-bud). |
| `chat_channels` av typen `sect` styrs av `member_user_ids` som GM fyller i | OK i sig, men kräver att plattformen fyller i från sann sekt (B10). |

Slutsats: om databasens tabeller ska spegla spelstatet måste i stort sett all spelstatsläsning gå via en server-genererad vy per spelare, inte via direkt `select` på entitetstabeller. Det stämmer med motorns modell (`buildPlayerView`).

### Övriga säkerhetsfynd från advisors

- `anon` har fulla tabellrättigheter (SELECT/INSERT/UPDATE/DELETE/TRUNCATE …) på alla 26 tabeller i `public`. RLS stoppar läsning eftersom inga policyer gäller `anon`, men tabellerna syns i GraphQL-schemat för icke-inloggade ([lint 0026](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed)).
- `anon` kan köra `create_campaign_with_gm`, `gm_advance_round`, `gm_lock_round`, `submit_action`, `unsubmit_action` via `/rest/v1/rpc/…` ([lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)). Funktionerna kontrollerar `auth.uid()` själva, så det ger fel snarare än åtkomst, men execute bör dras in.
- `is_campaign_member`, `is_campaign_gm` och `has_role` kan anropas av inloggade via RPC ([lint 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). Låg risk, men gör det möjligt att fråga om medlemskap i andras kampanjer.
- `campaign_members` INSERT tillåter `user_id = auth.uid()` utan villkor. Vem som helst som känner till ett kampanj-id kan lägga in sig själv, och i teorin med `role = 'gm'`.
- Invites: bara GM kan läsa `invites`, och det finns ingen funktion för att acceptera en invite. Flödet är inte färdigt.

### Prestanda-advisors

Relevant först när det finns data, men bra att göra rätt från början:
- 48 policyer anropar `auth.uid()` per rad; ska skrivas `(select auth.uid())` ([lint 0003](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)).
- 13 tabeller har två tillåtande SELECT-policyer (en `gm … ALL` plus en `member … SELECT`) ([lint 0006](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)).
- 27 foreign keys saknar index ([lint 0001](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)).
- 13 index oanvända (väntat, tabellerna är tomma).

## Jämförelse med motorn: vad kan återanvändas

Motorns relevanta modell, kort:
- **State:** ett `GameState`-objekt per kampanj, ren JSON, `Record<Id, T>`, id:n som `player-3`, schemaversion. Kartan kopieras in i state. Härledda värden (VP, domän, effektiva stats) lagras inte (S5).
- **Karaktärer:** `CharacterBacklog` per användare med `CharacterSheet { id, build, version }`; kampanjens `CampaignLobby` har `seats` med en kopia av bygget och vilken version som kopierades (K10/K11, `docs/decisions/characters.md`). Plattformen sparar backloggen.
- **Rond:** `RoundWindow { round, seed, deadline, status, submissions }`, där varje `Submission` är spelarens hela ordnade lista plus Royal Privileges, Sabbat scheme och `locked`. Upplösningen är `RoundResolution`, kan pausas på `Interrupt` (strid) och återupptas; plattformen sparar den under pausen (`docs/decisions/round.md`).
- **Utdata:** `RoundEvent` med `audience` (`public` / `gm` / `players: PlayerId[]`) satt när eventet skapas; `buildPlayerView`/GM-vy filtrerar på det.
- **Motorn har ingen klocka och ingen lagring.** Deadlines, seed-generering och persistens är plattformens jobb.

### Per del

| Del i databasen | Bedömning | Hur |
|---|---|---|
| `auth` + `profiles` + `handle_new_user` | **Återanvänd** | Fungerar som den är. Lägg till `(select auth.uid())` i policyerna. |
| `user_roles` / `has_role` / `app_role` | **Återanvänd vid behov** | Bra för en framtida plattformsadmin. Används inte i dag. |
| `campaigns` | **Återanvänd, utöka** | Behåll som metadata-rad (namn, status, skapare, `max_players`). Lägg till motorns kampanjinställningar (antal ronder, lobbykonfiguration) och en pekare till aktuellt state. `current_round` bör härledas från state i stället för att lagras två gånger. |
| `campaign_members` + `is_campaign_member` / `is_campaign_gm` | **Återanvänd, fixa** | Mönstret med security definer-hjälpare är rätt och löser rekursionsproblemet från prototypen. Täpp till INSERT (bara via RPC eller invite), dra in RPC-execute. Notera att motorns `PlayerId` (`player-3`) inte är en användare: en mappning `user_id ↔ PlayerId` per kampanj behövs, och `campaign_members` (eller lobbyns seat) är rätt plats för den. |
| `invites` | **Återanvänd, gör klart** | Modellen (token, roll, status, utgång) räcker. Saknar accept-funktion. |
| `clans`, `disciplines`, `clan_disciplines`, `action_definitions`, `minion_types` | **Ersätt (inspiration)** | Motorns content ligger i TypeScript (`packages/engine/src/content/`) och är testad. Att dubblera den i tabeller ger två sanningskällor. Om content ska bli redigerbart per kampanj (SPEC B4/B11) är en `jsonb`-kopia av content per kampanj, med version, enklare än normaliserade tabeller. `rules_json` visar att även förra försöket landade i JSON för det som inte passar kolumner. |
| `cities`, `city_adjacencies`, `sea_regions`, `city_sea_regions` | **Ersätt** | Motorn kopierar kartan in i state, med fält som saknas här (stability, masquerade, intercept, blood flow, contestants, problems, specials, influence, revolt counters). Seed-kartan i `create_campaign_with_gm` är fel karta. `kind land/sea` och `position_x/y` (för rendering) är värda att ta med till kartinnehållet. |
| `characters` | **Ersätt** | Kampanjbunden och tunn jämfört med motorns `Player`. Saknar backlog helt. Behövs i stället: en tabell för backloggen per användare (en rad per `CharacterSheet` med `build jsonb` och `version`, eller en rad per backlog), plus lobbyns seats per kampanj. Unik (`campaign_id`, `user_id`) motsvarar "en karaktär per kampanj" och kan behållas på seats. |
| `character_stat_modifiers` | **Inspiration** | `source` + `source_kind` är samma idé som motorns `StatModifier.source` (Rule of Three per källa). Men i motorn ligger modifiers i state, inte i en egen tabell. |
| `minions` | **Ersätt** | Ligger i state i motorn (ägare, nivå, plats, loyalty, origin). |
| `rounds` | **Återanvänd, ändra** | `number`, `status`, `deadline_at`, `opened_at`, `resolved_at`, `rng_seed` passar `RoundWindow` väl. Men seeden måste flyttas ut ur en tabell som medlemmar kan läsa (egen tabell utan SELECT-policy, eller bara åtkomlig för service role). Här är också rätt plats att spara `RoundResolution` när upplösningen är pausad, och state före/efter ronden för replay (SPEC B8). |
| `actions` + `submit_action` / `unsubmit_action` | **Ersätt** | Motorns enhet är hela `Submission` per spelare och rond, inte en rad per aktion, och blood dras vid upplösning. Enklast: en rad per (rond, spelare) med `submission jsonb`, `locked`, `updated_at`, som spelaren bara kan läsa och skriva själv, och där servern kör `validateSubmission` vid sparning. |
| `events` (`visible_to`, `is_public`) | **Återanvänd idén** | Ligger nära motorns `audience`. Men `visible_to` är användar-id och motorn använder `PlayerId`; och motorn har också publiken `gm`. Antingen spara `audience jsonb` och låta en server-vy översätta, eller översätta till användar-id när eventet skrivs. |
| `player_round_updates` | **Återanvänd** | Exakt det SPEC B3 kräver: förberäknad uppdatering per spelare, läsbar bara av spelaren och GM. Lagra resultatet av `buildPlayerView` här. Lägg till en motsvarande rad för publika nyheter och GM-loggen. |
| `combats`, `combat_steps`, `combat_promises` | **Inspiration** | Motorns `Combat` ligger i state och strid pausar upplösningen via `Interrupt`/`InterruptAnswer`. Plattformen behöver däremot spara spelarnas hemliga svar (Charge-blood, negotiation) innan de skickas till motorn, och 6-timmars-timers. `combat_steps` som logg av inmatningar med deadline per steg är en bra förlaga för en tabell med interrupt-svar. |
| `chat_channels`, `chat_messages` | **Återanvänd, fixa** | Täcker B10 (all players, sect, ad hoc, combat, GM-spelare). Sect-kanalernas medlemmar måste fyllas i av servern från sann sekt, och kanaler bör kunna skapas från motorns events (t.ex. combat-kanal). Lägg till tabellerna i Realtime-publikationen när chatten byggs. |
| Edge function `resolve-round` | **Ersätt (inspiration)** | Skalet är rätt: GM-kontroll, statuslås mot dubbelkörning, ladda allt → kör → skriv, service role för skrivning. Byt innehållet mot ett anrop till motorpaketet (`resolveRound`/`continueResolution`) och gör skrivningen atomisk (en RPC/transaktion i stället för parallella skrivningar). `visibility.ts` och fasfilerna är ersatta av motorn. |
| Storage, Realtime, cron | **Inget att återanvända** | Inga buckets, ingen publikation, ingen `pg_cron`. Deadline-triggad upplösning (M10) kräver t.ex. `pg_cron` + `pg_net` eller en schemalagd edge function. |

### Två möjliga vägar framåt (inte beslutat)

Eftersom databasen är tom kostar det ingenting att byta schema. Valet påverkar mest hur mycket som behöver översättas mellan motor och databas.

1. **State som dokument (ligger närmast motorn).** En rad per kampanj (eller per rond, för historik) med `state jsonb`, plus tabeller för det som har egna åtkomstregler eller skrivs av spelare: backlog, lobby/seats, submissions, events/round updates, interrupt-svar, chat. Spelare läser aldrig state direkt, bara sina förberäknade vyer. Behåller auth, medlemskap, invites och chat från dagens schema.
2. **Normaliserade tabeller (som dagens schema).** Varje entitet i en egen tabell, laddas och skrivs tillbaka runt varje upplösning. Ger SQL-frågor och RLS per rad, men kräver mappning åt båda hållen för varje fält i `GameState` och RLS som håller jämna steg med alla synlighetsregler.

Motorns principer (ren JSON, hela state i minnet, atomisk commit, server-side vyer) talar för väg 1. Det beslutet hör hemma i en egen plan innan något byggs.

## Hur kartläggningen gjordes

Supabase-connectorn: `get_project`, `list_tables` (verbose), `list_migrations`, `list_extensions`, `list_edge_functions`, `get_edge_function`, `get_advisors` (security, performance), samt `execute_sql` med enbart `select` mot `pg_policies`, `pg_proc`, `information_schema.triggers`, `pg_indexes`, `pg_constraint`, `pg_publication_tables`, `information_schema.role_table_grants`, `supabase_migrations.schema_migrations` och `count(*)` på tabellerna.
