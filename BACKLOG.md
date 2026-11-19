# Backlog

Sidofynd som inte hör till pågående scope. Skriv var fyndet gjordes.

## Motorbeslut (hittat under `docs/engine/001_motorbeslut.md`)

- [ ] **Kartdata saknas/motsägelsefull.** `docs/prototype/plans/001_map_improvement.md` listar 37 adjacency-par men säger 36; `007_campaign_setup.md` säger 34. Startvärden per stad (blood flow, stability, MS, intercept) och sea region per hamn finns inte i repot (prototypens `seed.js` följde inte med). Måste bekräftas med GM innan British Isles-kartan blir standardmall (SPEC Part C #14). — hittad under: docs/engine/001_motorbeslut.md
- [ ] **Regelboken säger emot sig själv om ≥/>** vid intercept mot stealth (gd:114/115/925 vs gd:498/913). Provisoriskt ≥ (M16). Rätta regelboken när Gustaf bekräftat. — hittad under: docs/engine/001_motorbeslut.md
- [ ] **Rundbreakdown i regelboken numrerar income-fasen som 4a–4c** (gd:955–957) och end-of-round hoppar från 4c till 4e. Kosmetiskt, men bör rättas. — hittad under: docs/engine/001_motorbeslut.md
- [ ] **Klan-synlighet:** prototypens backlog funderade på att dölja klan. Provisoriskt publikt (M2). — hittad under: docs/engine/001_motorbeslut.md

## State och typer (hittat under `docs/decisions/state.md`)

- [ ] **Regelbokens stavning av artefakter** (gd:411, 420, 422, 426): Vispers in a bottle, Ring of Tremer, Scepter of Venture, Ravanos boots. Normaliserat i koden (S18); rätta regelboken.
- [ ] **Kopierad text i Baron-avsnittet** (gd:551): "Princes can build influence in cities they control" står under Barons. Troligen kvar från Prince-avsnittet.
- [ ] **Rule of Three och avdrag** (gd:530): regeln nämner bara bonusar. Bekräfta att avdrag (Banu Haqim −1, Seduction −1) inte kapas (S7).

## Ronden (hittat under rondens skelett, `docs/engine/round-skeleton-plan.md`)
- [ ] Riktiga aktionseffekter: skelettets `SKELETON_ACTIONS` är stubbar utan effekt (steg 3).
- [ ] Faserna 2a–2c, 4a–4d och 5a–5c är tomma krokar: contest-straff, storm, masquerade-kaskad, Ventrue +10, klan-curses, missions, Archon-loyalty, income från städer och bleeds, start-of-turn-VP.
- [ ] Fight for Control-strider som löses i fas 4a nästa rond (spänner över rondgränsen).
- [ ] Pending choices för målet (M8): fight/flee, acceptera Invite, återvända till contestad stad.
- [ ] Klanregler som påverkar budget eller Trifle: Lasombra (ingen Trifle om mindre blood än förra ronden), Tremere (enda Thaumaturgy kostar ingen action), Salubri (en Give per rond).
- [ ] Bränd minion kan lämna dinglande referenser (strider, effekter, Follow Them). Behöver en gemensam `burnMinion` i state när de modellerna används.
- [ ] Brujah-rabatt mitt i ronden ska återbetalas i fas 5 (M7).
- [ ] `ActionDefinition` är data + TypeScript-handler; utvärdera "data + effektprimitiver" (SPEC B11) när några aktioner byggts (R19).
- [ ] Per-spelare-vyer ska filtrera `RoundResolution.events` (steg 4). Events saknar ännu `audience` (M18).

## Vyer (hittat under `docs/engine/views-plan.md`)
- [ ] **Världseffekter i vyn:** `OngoingEffect` utan ägare (debattutfall m.m.) syns inte för spelare. Behöver ett publik-fält på effekten (V13).
- [ ] **Torpor publikt eller dolt?** Provisoriskt dolt (V4). Bekräfta mot hur Discord-spelet gjorde.
- [ ] **Vy av en pausad strid:** `RoundResolution` under `awaitingCombat` har ingen spelarvy. Byggs med combat.
- [ ] **Avslöjande aktioner:** Investigate, Search, Auspex m.fl. ska kunna göra dolda fält synliga för en spelare. Behöver en modell för "känd information" per spelare när aktionerna byggs.
- [ ] **Motsägelse om controller-sikt:** gd:115 säger "target and originate", gd:498 "against or in". Tolkat som samma sak (startstad + målstäder).

## Karaktärsskapande (hittat under `docs/decisions/characters.md`)
- [ ] **Ring of Tremere är avstängd** (K14): den ligger inte i slumppoolen eftersom man ska välja disciplin när man får den (gd:420). Hitta ett sätt att hantera valet (startartefakt, Search, My treasure, stöld) och slå på den igen.
- [ ] **Toreador-obsession** (C8) dras fortfarande inte vid kampanjstart.

## Actionkatalog (hittat under `docs/decisions/catalog.md`)
- [ ] **Bundna discipliner:** Ring of Tremere och (M)Thaumaturgy-skapade artefakter har ingen aktion i katalogen; inte heller artefaktaktioner som (M)Thaumaturgy gett permanent (`grantedArtifactActions`) (K15).
- [ ] **Hide and Spy** ska spärra minionens action nästa rond (gd:296). Kräver att förra rondens aktioner sparas.
- [ ] **Martinelli's Ring** ska ta bort Dementation så länge man bär den (gd:395).
- [ ] **(M)Presence-stealth** ska vara den valda aktionens; observationen läser idag `def.stealth` (0) (K9).
- [ ] **Känd information i målval:** när motorn vet vad en spelare garanterat vet (kartvyn), sortera kända mål "i samma stad" överst (K3).
- [ ] **Regelbokens rubrik "Bottles wealth of the camarilla"** (gd:1047) ska vara Bottomless Wealth. "Presens"/"Pressens" och "Visisetude" är också felstavade.
- [ ] **Dold aktör per aktion:** Gustaf 2026-11-19: vissa actions har en gömd aktör (man får veta att något hänt men inte vem, om man inte lyckas med en rullning), och det skiljer sig mellan actions. Regelboken säger inte vilka. Lägg ett fält på `ActionDefinition` (t.ex. `actorHidden`) i katalogen och låt observationen (`observersOfAction`) läsa det, när listan över vilka actions det gäller finns.

### Olösta designfrågor från actionkatalogen (väntar på lead game designer)
Designern är inte tillgänglig live (Gustaf 2026-11-19). Motorn bygger på det provisoriska valet tills vidare.
- [ ] **Unresolved: mål "i samma stad" (K3).** Ska dropdownen för Attack!, Diablerie, Dominate m.fl. lista alla vampyrer och minions (provisoriskt, läcker inga positioner) eller bara de spelaren vet är där?
- [ ] **Unresolved: (M) Presence (K9).** Får den utföra andra sekters faction actions utan titelkrav? Provisoriskt ja.
- [ ] **Unresolved: Thaumaturgy bas (K10).** Får man ge vilken disciplin som helst, eller bara en man själv har? Provisoriskt vilken som helst.
- [ ] **Unresolved: upprepade val (K11).** Får Anarch Revolt, Build on the Master's Kingdom och Organize Resistance välja samma effekt flera gånger? Provisoriskt ja.
- [ ] **Unresolved: not-fixed-actions** (`docs/engine/not-fixed-actions.md`): Wait and Strike, Dementation, (M) Dementation, Investigate, Investigate Eye, Troublemaker, Orders from the Top, Crown of Malkav och Hunt for Me ska byggas om så att de kan lösas utan GM.
- [ ] **Unresolved: missions är borttagna ur spelet** (Gustaf 2026-11-19). Recruit an Archon, Archon-loyalty (gd:332) och Justicar-VP behöver nya regler.
- [ ] **Unresolved: Chimerstry och (M) Chimerstry** byggs om.
