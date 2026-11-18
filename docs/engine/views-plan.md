# Research & plan: per-spelare-vyer (steg 4)

**Datum:** 2026-11-18. **Bygger på:** `docs/engine/001_motorbeslut.md` (M2, M16–M19, vyprincipen), `docs/decisions/state.md`, `docs/decisions/round.md` (R1). Beslut som togs här står i `docs/decisions/views.md`.

## 1. Research

### Vad reglerna säger
- **Stealth och intercept (gd:114–115, gd:913, gd:925).** Total stealth = aktionens modifier + utförarens stealth. Alla i samma stad med intercept ≥ total stealth får veta om aktionen. Controllern får veta om aktioner som startar i eller riktar sig mot staden om stadens intercept ≥ stealth. ≥ eller > är motsägelsefullt i regelboken; M16 valde ≥.
- **Possession (gd:921).** Andra vet inte vilka artefakter man har.
- **Minions i player stats (gd:403).** Andra ser minionen, men inte var den är.
- **Influence (gd:911).** Alltid synligt för alla.
- **Ivory Tower (gd:578).** Totalsiffror publika efter rundan, vem som röstat vad är dolt.

### Vad motorn har idag
- `GameState` (`src/state/types.ts`) är byggd så att dold information ligger i egna fält (`Player.disguise`, `sabbat.bases`, `Debate.votes`), men inget hindrar ett UI från att läsa allt.
- `RoundEvent` (`src/round/types.ts`) saknar `audience`. Events från fas 1a/1b (betalning, upkeep, strukna aktioner) är privata men skulle i dag visas för alla som får eventlistan.
- Inlämningar ligger utanför state (R1) och berörs inte av vyerna.

## 2. Plan

### Modul `src/view/`
| Fil | Innehåll |
|---|---|
| `audience.ts` | `Audience`-typen och `observersOfAction()` (M16, M18, M19). |
| `player.ts` | `PlayerView`-typer och `buildPlayerView(state, content, viewerId, { events })`. |
| `gm.ts` | `GmView` och `buildGmView()`: hela state plus alla events. |

### Ändringar i ronden
- `RoundEvent.audience` (obligatoriskt). Varje `emit` anger publik; standard för spelar-events är spelaren själv.
- `ActionDefinition.targets?` ger aktionens mål (städer, vampyrer, minions). Används för controller-sikt och för vad observatören får veta (M17).
- När en aktion lösts skickas ett `action_observed`-event till observatörerna, beräknat i det ögonblicket (M18). Aktörens eget `action_resolved` går bara till aktören.

### Vyprincipen
`buildPlayerView` bygger varje fält explicit från en allowlist. Den kopierar aldrig ett state-objekt med spread eller `cloneJson` och tar bort fält. Ett nytt fält i `GameState` syns alltså inte i vyn förrän någon lägger till det.

### Tester
- **Läck-tester:** kanariesträngar i alla dolda fält (seed, blood, VP, EXP, disguise, sanna titlar, baser, röster, artefakter, positioner, effekter, privata events). Serialisera varje spelares vy och kontrollera att inga främmande kanarier finns där.
- **Observation:** samma stad, ≥-gränsen, torpor, undetectable, cant_be_hidden, controller av start- och målstad, Informant-minions, ej Ghouls.
- **Rond-events:** privata fas 1a-events når bara spelaren; `action_observed` når observatörer.

### Demo
`createDemoGame()` exporteras från paketet: en kampanj på testkartan med en spelare per sekt och titel, så att gränssnittet har något att rendera.

### Utanför scope (→ BACKLOG.md)
- Vyer av en pausad `RoundResolution` under strid (combat-vyn byggs med combat).
- Effekter av Investigate, Search, Auspex osv. som avslöjar dolda fält (kräver aktionerna).
- Synlighet för pågående effekter som är publika (debattutfall).
