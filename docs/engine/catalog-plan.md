# Plan: actionkatalog och målval

**Datum:** 2026-11-19
**Bakgrund:** Spelarens huvudskärm (bild i `docs/for_agents/main_player_screen.png`) har en actionpanel: en tom banner som öppnar en dropdown med alla actions spelaren har tillgång till (vampyrens och varje minions), sedan en dropdown per mål med bara giltiga mål, en lista som går att sortera om, "X/Y action points used", total kostnad och "Confirm actions". Motorn hade bara skelettets 16 stubbar utan mål.
**Beslut:** [`docs/decisions/catalog.md`](../decisions/catalog.md) (K1–K21).

## Research (vad som fanns)

- `src/round/actions.ts`: `ActionDefinition` med kostnad, Trifle, slot, titel/sekt/miniontyp, torpor m.m., men inga mål och kostnadsfunktioner mot `GameState`.
- `src/round/validate.ts`: `analyzeSubmission(state, …)` räknade budget, minionbudget, Trifle, Hide, Go Anarch och råd, men kontrollerade inga mål.
- `src/view/player.ts`: `PlayerView` har allt en spelare får veta: egen vampyr (titel, förklädnad, discipliner, artefakter, minions med position), publika städer med grannar, alla vampyrer och minions utan position, Sabbat-baser för Sabbat.
- Regelboken: ca 130 aktioner (gd:962–1281 plus minions gd:221–358 och artefakter gd:384–445). `docs/prototype/research/005_all_actions_reference.md` är en bra översikt men regelboken gäller.

## Plan

1. **Allt räknas från `PlayerView`.** Då kan gränssnittet köra samma funktioner som servern, och ett målval kan aldrig visa dold information (K1, K3).
2. **Aktioner som data:** `ActionDefinition` får `params` (val i ordning, med funktion för giltiga alternativ), `requires` (disciplin, artefakt, titellös, dold/exponerad Archbishop, bara i torpor, zombie), `income`, `moves` (för målval längre ner i listan), `forbidsMovement`, `locksMinions`, `oncePerRoundPer`.
3. **Katalogen:** `src/catalog/actions/` med personal, faction (gemensamma, Camarilla, Anarch, Sabbat), discipline, minion och artefakt. Effekterna är stubbar (R19).
4. **API för gränssnittet:** `listAvailableActions`, `nextParam`, `analyzeDraft`, `projectPositions`.
5. **Servern:** `analyzeSubmission` bygger vyn och kör `analyzeDraft`. `resolveRound` drar kostnaden som analysen räknat. Standardregistret blir `ACTION_CATALOG`.
6. **Tester:** meny per titel/disciplin/minion/artefakt, målval (grannstäder efter tidigare Move, Sail och storm, inget positionsläckage), utkastanalys (AP, minions, Trifle, inkomst, Bottomless Wealth, ofullständiga entries, pekare via key) och att servern ger samma svar. Ett test bygger varje aktion i katalogen klart för att fånga val utan alternativ.

## Inte i den här omgången (BACKLOG)

Aktionernas effekter, Ring of Tremere och andra bundna discipliner, (M)Thaumaturgy-givna artefaktaktioner, Hide and Spy-spärren nästa rond, klanregler som ändrar budget/Trifle, Martinelli's Ring som tar bort Dementation.
