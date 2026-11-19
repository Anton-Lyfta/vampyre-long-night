# Plan: spelarens huvudskärm (UI steg 1)

Källa: Gustafs beskrivning i projekttråden 2026-11-19 och mockupen `docs/for_agents/main_player_screen.png`.
Mockupen visar UX-upplägget, inte styling. Styling är medvetet neutral tills vidare.

## Stack

Nytt workspace-paket `packages/web`: React 19 + Vite + TypeScript (Gustafs val 2026-11-19).
Ingen router, inget state-bibliotek än. Drag-and-drop med dnd-kit (`@dnd-kit/sortable`), som även
stöder tangentbord och pekskärm. Tester: Vitest + Testing Library + jsdom.

## Arkitektur

```
PlayerView (motorn, inkl. map och resources) ─┐
listAvailableActions / nextParam / analyzeDraft ─┼─>  PlayerScreenPort (src/screen/model.ts)  ─>  React-komponenter
submitActions (servern; lokalt i dev)          ─┘
```

- Komponenterna känner bara till typerna i `src/screen/model.ts`, aldrig `GameState` eller `PlayerView`.
- `src/screen/viewPort.ts` implementerar porten med motorns katalog (`listAvailableActions`, `nextParam`,
  `analyzeDraft`) och kartvy (`PlayerView.map`). Allt räknas från spelarens `PlayerView`, så porten kan köras
  i klienten utan att se dold information. Entries får `key` = radens uid, så pekare mellan entries håller vid
  drag-and-drop.
- `src/screen/localPort.ts` bygger vyn från demokampanjen (`createDemoRound()`) och lämnar in med motorns
  `submitActions`. Det är bara för utveckling: i spelet görs inlämningen av servern (SPEC B1), och bara
  `submit`/`unlock`/`isLocked` byts ut.

## Skärmens delar

| Del | Komponent | Data |
|---|---|---|
| Resursrad: blood, VP, artefakter, minions, röster | `ResourceBar.tsx` | `me.blood`, `me.vp`, `me.artifacts.length`, `me.minions.length`, `me.ivoryTowerVotes` |
| Karta: städer färgade efter faction, kopplingar, kända pjäser | `GameMap.tsx` (SVG) | `cities`, `players` (skenbar sekt för controller) |
| Flikmeny uppe till höger, första = karta | `TabMenu.tsx` | statisk lista, övriga flikar är platshållare |
| Egen vampyr: namn, titel, Strength/Stealth/Intercept | `VampirePanel.tsx` | `me` |
| Actions för ronden | `ActionPanel.tsx` + `ActionComposer.tsx` | porten |
| Rond | hörnruta på kartan | `round`, `maxRounds` |

### Actionpanelen

- En tom banner. Klick öppnar en dropdown med alla actions spelaren har, vampyrens och varje egen minions.
- Kräver actionen mål visas nästa dropdown med giltiga mål (t.ex. Move: grannstäder till platsen där
  vampyren står *efter* tidigare Move i listan). Steg kommer ett i taget tills actionen är klar.
- Klar action hamnar i listan och en ny tom banner visas under.
- Varje rad visar kostnad i blood, och deterministisk inkomst om actionen ger det.
- "X/Y action points used" och total kostnad (minus deterministisk inkomst) under listan.
- Fler actions än AP är tillåtet att lägga till, men "Confirm actions" är avstängd då.
- Raderna kan dras om och tas bort.
- "Confirm actions" lämnar in listan. Efter inlämning är listan låst tills spelaren väljer att ändra.

## Antaganden som ska bekräftas av Gustaf

1. ~~AP~~ **Bekräftat av Gustaf 2026-11-19:** X/Y AP räknar bara vampyrens slots. Varje minion har en
   action och får en egen ruta "Namn: X/Y" bredvid (Y = 1, eller 2 med Anarch Mission).
2. **Confirm är avstängd även vid andra fel än för många actions**, t.ex. om listan kostar mer blood än
   spelaren har. Felet visas på raden.
3. **Bekräftat av Gustaf 2026-11-19:** inget årtal, bara aktuell rond ("Rond X av 8").
4. **Flikarna** utöver kartan är platshållare med namn gissade från mockupens ikoner.
