# Beslut: karaktärsskapande, backlog och anslutning till kampanj

**Datum:** 2026-11-18
**Status:** K1 och K2 kommer från Gustaf. Övriga är Claudes provisoriska standardval; ändra raden här och koden i `packages/engine/src/characters/` om du vill annorlunda.
**Plan:** [`docs/engine/character-creation-plan.md`](../engine/character-creation-plan.md) · **Kod:** `packages/engine/src/characters/`

## Snabböversikt: de beslut som påverkar spelet mest

| # | Fråga | Valt |
|---|---|---|
| K1 | Vem väljer titel? | **Spelaren** (Gustaf). Avviker från gd:658 där GM delar ut titeln. |
| K2 | Justicar? | Inte valbar i V1 (Gustaf). Kan slås på per kampanj. |
| K7 | Vilka discipliner får bemästras? | Alla som karaktären har efter klan, startuppgradering och EXP-köp. |
| K12 | Finns tak per titel i en kampanj? | Valfritt, standard obegränsat. **Öppen fråga**, se nedan. |
| K14 | Ring of Tremere som startartefakt | Binds seedat till en disciplin karaktären saknar. Provisoriskt. |

---

## K1. Spelaren väljer titel
**Beslut:** Titeln är en del av karaktärsbygget och väljs av spelaren.
**Avvikelse:** gd:658 och SPEC A3 säger att GM delar ut titel (och stad). Gustaf har bestämt att spelaren väljer. Startstaden placeras fortfarande av GM vid kampanjstart (K13), eftersom en backlog-karaktär inte vet vilken karta den hamnar på.

## K2. Justicar finns inte i V1
**Beslut:** `V1_CREATABLE_TITLES = inner_circle, prince, baron, archbishop`. Justicars definition ligger kvar i content och kan tillåtas med `allowedTitles` (kampanj) eller `CharacterRulesOptions` (validering).
**Motivering:** Designern bygger om rollen (Gustaf). Att behålla definitionen gör att state, vyer och ronden inte behöver ändras.

## K3. Archbishop
**Beslut:** En Archbishop väljer förklädnad, Prince eller Baron, och byggs med förklädnadens startpaket: minions, bemästringar, startuppgraderingar, EXP, blood, Royal Privileges och startstad (SPEC A3). Sann sekt blir Sabbat, `disguise` får förklädnadens titel och sekt.

## K4. Bygget är en JSON med alla val
**Beslut:** `CharacterBuild` innehåller namn, koncept (fritext), klan, titel, förklädnad, minionpaket och val per plats (typ och namn), bemästrade discipliner, två startuppgraderingar och EXP-köp. `validateCharacterBuild` returnerar **alla** fel med en sökväg (`expPurchases[2].discipline`), så att ett UI kan visa dem live. `deriveCharacter` ger det färdiga resultatet.
**Motivering:** Samma mönster som `validateState`. Ett halvfärdigt bygge är UI-state och sparas inte.

## K5. Startuppgraderingar
**Beslut:** Exakt två olika alternativ ur titelpaketet (gd:672). Valet anger alternativets index och typ, plus underval: disciplin (Gain another discipline), stat (+1 Strength/Stealth/Intercept enligt titelns lista), minion (typ och namn, level från paketet) eller special (Baron). Stat-uppgraderingen har källan `creation:stat_upgrade` (S7).

## K6. Extra discipline
**Beslut:** Både startuppgraderingen och EXP-köpet tillåter valfri disciplin som karaktären inte redan har (gd:855). Två köp av samma disciplin är fel.

## K7. Bemästring
**Beslut:** Titelns bemästringar (gd:669) och EXP-köpet Mastered discipline får gälla vilken disciplin karaktären har, även en som lärts in i samma bygge. Ordningen i listan spelar ingen roll: inlärning räknas före bemästring. En disciplin kan bara bemästras en gång.
**Motivering:** Regelboken begränsar inte titelns bemästringar till klanens discipliner. Ett bygge är ett val i sin helhet, inte en sekvens.

## K8. EXP
**Beslut:** Kostnaderna ligger i `content.expUpgrades` (gd:855–860). Summan av köpen ska vara **exakt** titelns start-EXP (gd:676: "You must spend all EXP"). Stat-köpen får göras högst 3 gånger var (gd:857–859). Spenderad EXP bokförs i `Player.exp.spentTotal` och räknas mot taket 12 (gd:861).

## K9. Slumpartefakter
**Beslut:** Titelns artefakt (Inner Circle) och varje My treasure dras vid kampanjstart, inte vid skapandet. Kampanjens artefakter är standard en av varje artefakt med `inRandomPool`; de blandas med `deriveSeed(seed, 'creation', 'artifacts')` och delas ut i platsordning. Resten blir kampanjens pool. Räcker inte poolen är det ett fel.
**Motivering:** En backlog-karaktär ska kunna användas i flera kampanjer, och artefakterna är unika inom en kampanj.

## K10. Backlog
**Beslut:** `CharacterBacklog` per användare (`ownerId` är plattformens id). Bara giltiga karaktärer sparas, med id `character-<n>` från en räknare som aldrig återanvänds och en `version` som räknas upp vid ändring. Motorn lagrar inget; plattformen sparar backloggen.

## K11. Kampanjen får en kopia
**Beslut:** När en spelare går med kopieras bygget till platsen (med karaktärs-id och version). Senare ändringar eller borttagning i backloggen påverkar inte kampanjen. Samma karaktär får användas i flera kampanjer samtidigt.
**Motivering:** Kampanjer är isolerade (SPEC B5). En karaktär i backloggen är en mall, inte en levande vampyr.

## K12. Lobbyn
**Beslut:** `joinCampaign` tar `{ kind: 'existing', characterId }` eller `{ kind: 'new', build }`. En ny karaktär sparas också i backloggen. Regler: en plats per användare, högst `maxPlayers` (20), titeln måste vara tillåten i kampanjen, och `titleLimits` (per sann titel) får inte överskridas. Standard är inga tak. `leaveCampaign` frigör platsen.
**Öppen fråga:** Utan tak kan alla välja samma titel. Med tak på Archbishop kan en spelare som nekas räkna ut hur många Sabbat som finns. Behöver Gustafs beslut om fördelning.

## K13. Kampanjstart
**Beslut:** `buildCampaignInput` tar lobbyn, en seed, kartan och GM:s placering per användare och ger `CreateGameInput` för `createGameState`. Stadstitlar (Prince, Baron, förklädd Archbishop) kontrollerar staden de placeras i, och stadsuppgraderingarna (+25 blood flow, +2 intercept, Anarch-specials) läggs på den. Två stadstitlar kan inte dela startstad. Player-id delas ut i anslutningsordning.
**Ändring i delad kod:** `PlayerSetup.startingCityUpgrades` (valfritt) i `state/create.ts`; specials blir `CityFeature` med `data.origin = 'starting_upgrade'`.

## K14. Ring of Tremere som startartefakt
**Beslut:** Ringen kräver att man väljer disciplin när man får den (gd:420). Dras den som startartefakt binds den seedat till en disciplin karaktären saknar. Provisoriskt; bör bli spelarens val när plattformen har ett flöde för det.
**Ändring i delad kod:** `validateState` tillåter nu en obunden Ring of Tremere i poolen eller i en stad (ingen har fått den än). Tidigare krävdes bunden disciplin överallt, vilket gjorde att ringen inte kunde ligga i poolen.

## Inte med än
- Toreador-obsessionen (C8) dras inte vid start (som tidigare, S21).
- Justicar-missions.
- GM-godkännande av karaktärer (SPEC B2 nämner det som alternativ).
