# Plan: spelarens huvudskärm (UI steg 1)

Källa: Gustafs beskrivning i projekttråden 2026-11-19 och mockupen `docs/for_agents/main_player_screen.png`.
Mockupen visar UX-upplägget, inte styling. Styling är medvetet neutral tills vidare.

## Stack

Nytt workspace-paket `packages/web`: React 19 + Vite + TypeScript (Gustafs val 2026-11-19).
Ingen router, inget state-bibliotek än. Drag-and-drop med dnd-kit (`@dnd-kit/sortable`), som även
stöder tangentbord och pekskärm. Tester: Vitest + Testing Library + jsdom.

## Arkitektur

```
PlayerView (motorn)  ─┐
actionkatalog        ─┼─>  PlayerScreenPort (src/screen/port.ts)  ─>  React-komponenter
analyzeSubmission    ─┘
```

- Komponenterna känner bara till typerna i `src/screen/model.ts`, aldrig `GameState` eller `PlayerView`.
- `src/screen/localPort.ts` implementerar porten genom att köra motorn i webbläsaren på demokampanjen
  (`createDemoRound()`). Det är bara för utveckling: enligt SPEC B1 ska motorn köras på servern, och då
  byts den här porten mot en som anropar servern. Komponenterna påverkas inte.
- `src/screen/catalogShim.ts` är en tillfällig actionkatalog (vilka actions, vilka mål, kostnad) byggd på
  skelettets `SKELETON_ACTIONS`. Den ersätts av motorns katalog från tråden "Bygg actionkatalog och mål i motorn".
- `src/screen/mapModel.ts` gör kartmodellen av `PlayerView`. Andra spelares vampyrer och minions på kartan
  kräver motorns "garanterad info" från tråden "Visa bara garanterad info på kartan"; tills dess visas bara
  egna pjäser, vilket redan följer regeln om att bara visa garanterad information.

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

1. **AP räknar bara vampyrens slots** (motorns `slotsUsed`/`budget.total`). Minions har en egen action var
   och räknas inte i X/Y. Mockupens 4/4 med två Move och två Bleed (en av en minion) kan tolkas båda sätten.
2. **Confirm är avstängd även vid andra fel än för många actions**, t.ex. om listan kostar mer blood än
   spelaren har. Felet visas på raden.
3. **Årtal** ("Year XXXX" i mockupen) finns inte i motorn. Visar bara "Rond X av 8" tills vidare.
4. **Flikarna** utöver kartan är platshållare med namn gissade från mockupens ikoner.
