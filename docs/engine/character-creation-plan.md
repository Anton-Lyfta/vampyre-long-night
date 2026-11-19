# Plan: karaktärsskapande, backlog och anslutning till kampanj

**Datum:** 2026-11-18
**Uppdrag (Gustaf):** Spelare väljer klan och titel och spenderar sin EXP utifrån titelns startbudget. Justicars hoppas över i V1 (designern bygger om rollen). Karaktärer sparas i spelarens backlog; när spelaren går med i en kampanj väljer den att skapa en ny karaktär eller använda en befintlig.
**Beslut:** [`docs/decisions/characters.md`](../decisions/characters.md) (K1–K14).

## Research: vad reglerna säger

| Steg (gd:654–679, SPEC A3) | Regel | Hur motorn tar det |
|---|---|---|
| Titel | "given by the GM" (gd:658) | GM tilldelar titel per kampanj; i backloggen väljer spelaren fritt (K1, K12). Justicar ej valbar i V1. Archbishop har förklädnad (Prince/Baron) och får förklädnadens paket (SPEC A3). |
| Klan | valfri av 14, ger 3 discipliner, boon och curse | `CharacterBuild.clan`; disciplinerna från `content.clans`. |
| Startminions | titelns paket, varje minion namnges | Paketindex + ett val (typ, namn) per plats. |
| Bemästra discipliner | titeln anger antal | Exakt N discipliner som karaktären har. |
| Startuppgraderingar | välj 2 av 4 | Två olika alternativ ur titelpaketet, med underval (stat, disciplin, minion, special). |
| EXP | titelns start-EXP, **allt måste spenderas** (gd:676) | Summan av köp = start-EXP exakt. Kostnader i content (`expUpgrades`). |
| EXP-listan (gd:853–861) | Extra discipline 1, Mastered 1, +1 Str/Ste/Int 2 (max +3 var), My treasure 1; tak 12 per kampanj | Som regelboken. |
| Startstad, startartefakt | GM delar ut | Kampanjspecifikt: GM placerar vid kampanjstart, artefakter dras seedat ur kampanjens pool. |

Kringregler som påverkar valideringen:
- Tremere-cursen: inga LV3-minions (gd:815). Gäller även Inner Circles LV3-uppgradering.
- Rule of Three per källa (S7): startuppgraderingen (`creation:stat_upgrade`) och EXP-köpet (`exp:greater_strength` osv.) är olika källor.
- Banu Haqim −1 Strength läggs redan på av `createGameState`.

## Vad som är karaktär och vad som är kampanj

En backlog-karaktär ska kunna återanvändas i flera kampanjer, så den får inte bero på en viss karta eller ett visst state.

| Hör till karaktären (backlog) | Hör till kampanjen (vid start) |
|---|---|
| namn, koncept, klan, titel, förklädnad, minionval och namn, bemästrade discipliner, startuppgraderingar med underval, EXP-köp | titel från GM, startstad/plats (GM), vilka artefakter som dras, player-id |

Stadsuppgraderingar (+25 blood flow, +2 intercept, Anarch-specials) väljs på karaktären men appliceras på den stad GM placerar karaktären i.

## Design

Ny mapp `packages/engine/src/characters/`, ren TypeScript utan I/O, samma regler som resten av motorn (ren JSON, inga klockor, seedad slump).

1. **`types.ts`** — `CharacterBuild` (spelarens val), `StartingUpgradeChoice`, `ExpPurchase`, `CreationIssue`.
2. **`build.ts`** — `validateCharacterBuild(build, content, options)` returnerar alla fel (för live-feedback i UI). `deriveCharacter` räknar fram det färdiga resultatet (blood, discipliner, stat-bonusar per källa, minions, antal slumpartefakter, VP, Royal Privileges, stadsuppgraderingar, spenderad EXP). `startingPackageFor` ger UI:t rätt paket (förklädnadens för Archbishop).
3. **`backlog.ts`** — `CharacterBacklog` per användare: `addCharacter`, `updateCharacter`, `removeCharacter`. Bara giltiga karaktärer sparas; utkast är UI-state.
4. **`lobby.ts`** — `CampaignLobby` före start: `assignTitle` (GM), `joinCampaign` med `{ kind: 'existing', characterId }` (måste ha GM:s titel) eller `{ kind: 'new', build }` (ny karaktär sparas också i backloggen), `leaveCampaign`. Platsen får en **kopia** av karaktären.
5. **`setup.ts`** — `buildCampaignInput(lobby, placements, …)` gör om platserna till `CreateGameInput` för `createGameState`, drar startartefakter seedat och returnerar mappningen användare → `PlayerId`.

Ändringar i delade filer (hålls små, vy-tråden arbetar parallellt):
- `content/expUpgrades.ts` (ny) + fältet `expUpgrades` i `Content`.
- `content/titles.ts`: namn och text för startstadens specials.
- `state/create.ts`: `PlayerSetup.startingCityUpgrades` (valfritt), appliceras på första kontrollerade staden.
- Inget i vylagret.

## Validering

- Enhetstester per regel (varje fel ska ge en tydlig `CreationIssue`).
- Hela flödet: skapa karaktärer → backlog → anslut (ny och befintlig) → `buildCampaignInput` → `createGameState` → `validateState` utan fel.
- Determinism: samma lobby och seed ger byte-identiskt state.
- Dold info: förklädd Archbishop syns som Prince/Baron i state (sann titel i `title`, förklädnad i `disguise`).

## Utanför scope (BACKLOG.md)

Toreador-obsessionen (C8), Justicar-missions, GM-godkännande av karaktärer, persistens och UI.
