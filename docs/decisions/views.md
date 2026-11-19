# Beslut: per-spelare-vyer (steg 4)

**Datum:** 2026-11-18. **Status:** provisoriska, fattade utan Gustafs granskning.
**Bygger på:** `docs/engine/001_motorbeslut.md` (M2, M16–M19, vyprincipen). Plan och research: `docs/engine/views-plan.md`. Kod: `packages/engine/src/view/`.

## Snabböversikt: de beslut som påverkar spelet mest

| # | Fråga | Beslut |
|---|---|---|
| V4 | Syns torpor för andra? | Nej, bara att en vampyr är bränd. |
| V12 | Ser man en aktion som sedan misslyckas? | Ja. Synligheten räknas innan aktionen löses. |
| V12 | Får målet automatiskt veta? | Nej, bara via intercept som alla andra. |
| V13 | Syns världseffekter (t.ex. debattutfall) i vyn? | Inte än. Bara egna effekter tills effekter får en publik-markering. |
| V17 | Visar kartan var någon sågs senast? | Nej. Bara om de sågs förra ronden **och** fortfarande är kvar där. |
| V16 | Vet en Prince var den som riktar en aktion mot hens stad befinner sig? | Nej, bara vem och vad (om aktionen inte startar i staden). |

## V1. Vyn konstrueras från en allowlist
`buildPlayerView` bygger varje fält explicit. Den kopierar aldrig ett state-objekt och tar bort fält, så ett nytt fält i `GameState` syns inte förrän någon lägger till det i vyn. Ett läck-test planterar nya fält och kontrollerar att de inte syns.

## V2. Andra vampyrer
Publikt: id, namn, klan, skenbar titel och sekt (M2), bränd (V4) och om blood hunt är aktiv (M2). Allt annat är dolt, även Royal Privileges, position, VP och stats.

## V3. Minions
Spelarägda minions syns för alla med namn, typ, level och ägare, utan position (gd:403). NPC-ägda minions syns inte, eftersom gd:403 talar om "player stats". Egna minions har position, effektiva stats, upkeep och buren artefakt.

## V4. Status
`burned` är publikt: en bränd vampyr försvinner ur spelet öppet. Torpor är dolt, eftersom M2 inte tar upp det och allowlisten då säger dolt. **Bör bekräftas:** i Discord-spelet kan torpor ha varit allmänt känt.

## V5. Stadens värden
Bas- och effektiva värden (stability, masquerade, intercept, blood flow) är publika. Modifiernas källor syns inte, eftersom M17 säger att buffens källa är dold (t.ex. att det var en Fog Flute).

## V6. Problems och specials
Att de finns, deras nyckel och namn är publikt. `data` (detaljerna) är dolt: det är vad Investigate ger (M2).

## V7. Artefakter
Bara egna artefakter syns, både de vampyren bär och de som egna minions bär (gd:921). Artefakter i en stad eller i poolen syns för ingen.

## V8. Strider
Bara parterna ser en strid (ägaren till varje combatant). Motståndarens Charge-blood är dolt, eftersom båda väljer i hemlighet (gd:162). Tärningsslag och utfall syns för båda parter. Andras observation av en strid sker via events.

## V9. Ivory Tower
Debattens alternativ och resultat är publika, men bara spelarens egna röster syns (gd:578). Totalsiffror syns först när `result` är satt.

## V10. Events i vyn
Varje `RoundEvent` har en obligatorisk `audience` (`public`, `gm` eller en lista spelare), satt när eventet skapas (M18). Vyn visar events där spelaren ingår och tar bort `audience` och `seq`: publiken skulle avslöja vilka andra som såg, och luckor i `seq` hur mycket som hände i det dolda. Hela eventets `data` syns för hela publiken, så olika publiker som ska få veta olika saker får olika events.

## V11. Standardpubliker i ronden
- Events med en spelare (betalning, upkeep, strukna aktioner, egna aktionsevents): bara den spelaren.
- Events utan spelare: bara GM. Det gäller `slot_started`, vars slotordning avslöjar vem som har aktioner i vilken slot.
- `round_advanced`, `game_over`, `game_finished`: publika.
- `sabbat_scheme_agreed`: bara spelare med sann sekt Sabbat.
- Faskrokar och handlers kan ange egen publik.

## V12. Observation av aktioner
När en aktion ska lösas skapas ett `action_observed`-event till observatörerna (`observersOfAction`, M16–M19). Det innehåller vem (för minion: minionen och controllern), aktion och mål (M17).
- Synligheten räknas **innan** handlern körs, med positioner och stats just då (M18). En aktion som sedan misslyckas har ändå setts.
- Entries som blockeras (bränd, torpor, minionen borta) observeras inte, eftersom de aldrig utförs.
- Bara aktiva vampyrer observerar, även via sina Informant-minions och städer (M18).
- Målen kommer från `ActionDefinition.targets`. Utan `targets` har aktionen inga mål, och bara startstadens controller har controller-sikt. Målet själv får inte veta något automatiskt.
- `undetectable` ger ingen observatör; `cant_be_hidden` gör eventet publikt.

## V13. Pågående effekter
Bara spelarens egna effekter (`ownerId`) syns. Effekter utan ägare (debattutfall, stormar via effekt) syns inte i vyn än, eftersom `data` kan innehålla vad som helst. De behöver en publik-markering. Lagt i BACKLOG.

## V14. Övrigt
- Missions syns bara för sin Justicar.
- Seed, id-räknare och stridernas trigger syns för ingen spelare.
- Sabbat-spelare (sann sekt) ser Sabbat-baser och `sabbatIdentity` för dolda Archbishops (gd:637).
- GM-vyn (`buildGmView`) är hela state och alla events, som kopior.

## V15. Kartan (`PlayerView.map`, 2026-11-19)
Huvudskärmens karta byggs av `buildMapView` (`src/view/map.ts`). Den visar alla städer med position (från kartmallen, `City.position`), grannar, controller, `contested` och controllerns **skenbara** sekt för färgen, så en stad som styrs av en dold Archbishop färgas som förklädnaden även för Sabbat-spelare. `connections` listar varje grannpar en gång.

## V16. Vad en observation säger om position
`action_observed` får fältet `at` (staden där utföraren är efter aktionen: `destination ?? startstad`) bara för observatörer som vet det:
- vampyrer och Informant-minions i startstaden, startstadens controller, och destinationens controller (för förflyttningar).
- Controllern av en **annan** målstad får ett eget `action_observed` utan `at`: hen vet vem och vad, inte var aktören är.

Förflyttningar anger sin slutstad med `ActionDefinition.destination` (läst innan handlern körs, som `targets`). Utan `destination` antas utföraren stanna. `observerGroups` ger uppdelningen; `observersOfAction` är som förut unionen.

## V17. Bara garanterad position, ingen "last known position"
En annan spelares vampyr eller minion står på kartan bara om
1. spelaren fick en observation med position (`action_observed` med `at`, eller `sighted`) under **senast upplösta ronden** (`round − 1` under inlämningen), och
2. subjektet fortfarande är där nu: inte bränt, samma stad, och för minions samma ägare.

Senaste observationen per subjekt gäller. Egen vampyr och egna minions syns alltid.
**Kostnad, flaggad till Gustaf:** villkor 2 läses ur dold state. Om man såg X i A och X sedan lämnade osedd försvinner X från kartan, så spelaren kan dra slutsatsen att X flyttat. Alternativet (visa ändå) kan visa fel information.

## V18. Resursraden (`PlayerView.resources`)
`blood`, `vp`, antal egna artefakter (även de egna minions bär), antal egna minions och `ivoryTowerVotes`. Rösterna är titelns grundröster (gd:578, 582–585), 0 för icke-Camarilla, utan Buy Votes (som köps per rond i aktionslistan). Vampyrpanelen (namn, titel, Strength/Stealth/Intercept) finns redan i `me`.

## V19. `sighted`-event för informationsaktioner
Aktioner som avslöjar var någon är (Search, Bowl of Convergence, S.H.R.E.K NET) skapar `sighted` med `{ subject, at }` och mottagaren som publik. `subject` är `{ kind: 'vampire', playerId }` eller `{ kind: 'minion', minionId, ownerId }`. Kartan läser det på samma sätt som `action_observed`.

## Demo
`createDemoGame()` och `createDemoRound()` ger en giltig kampanj på testkartan, med fem spelare (Inner Circle, Prince, Baron, dold Archbishop, utan titel) för gränssnittet. Justicars är utelämnade eftersom rollen inte finns i V1.
