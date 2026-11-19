# Beslut: actionkatalog och målval

**Datum:** 2026-11-19
**Status:** Fattade av Claude. K2 bekräftat av Gustaf 2026-11-19. K3, K9, K10 och K11 är designfrågor som står som unresolved i BACKLOG.md (designern är inte tillgänglig live); motorn använder valet här tills vidare. Övriga är provisoriska standardval; ändra raden här och koden i `packages/engine/src/catalog/` om du vill annorlunda.
**Plan:** [`docs/engine/catalog-plan.md`](../engine/catalog-plan.md) · **Bygger på:** [`round.md`](round.md) (R3, R4, R6, R19), [`views.md`](views.md), [`001_motorbeslut.md`](../engine/001_motorbeslut.md) (M4–M7, M17)

## Snabböversikt: de beslut som påverkar spelet mest

| # | Fråga | Valt |
|---|---|---|
| K2 ✅ | Räknas minionaktioner i "X/Y action points"? | Nej. AP = vampyrens slots. Varje minion visar sin egen action (1/1, 2/2 med Anarch Mission). |
| K3 ⏸️ | Vad visar dropdownen för mål "i samma stad" (Attack!, Diablerie, Dominate …)? | Alla vampyrer och andras minions. Är målet inte där misslyckas actionen och kostnaden återbetalas (gd:95). |
| K4 | Räknas målval från platsen efter tidigare Move i listan? | Ja, som i skärmbilden (Move Snuk→Blorg, sedan Move Blorg→Smorg). |
| K9 | Vad får (M)Presence utföra? | Valfri faction action utan titelkrav, även andra sekters. |

---

## K1. Allt räknas från spelarens vy
**Beslut:** Meny, målval, kostnad och utkastanalys räknas från `PlayerView`, inte `GameState`. Servern (`analyzeSubmission`) bygger vyn och kör samma `analyzeDraft` som gränssnittet.
**Motivering:** Gränssnittet och servern blir alltid överens, och ett målval kan aldrig avslöja något spelaren inte redan får veta.

## K2. Action points
**Status:** ✅ Bekräftat av Gustaf 2026-11-19: "Minions bör ha sin egen X/Y actions, korrekt. Minions har en action var, visa en ruta för varje minion spelaren har."
**Beslut:** "X/Y action points used" räknar bara vampyrens slots (`ap`). Minionaktioner räknas per minion (`minionActions`: used/allowed). Trifle-aktionen och gratisaktioner (Give, Buy Votes, Bag of Gifts, The Evil Eye) visar 0 AP.
**Motivering:** Regelboken ger varje minion en egen action utöver vampyrens budget (gd:217, M4). Skärmbilden visar 4/4 med en minion-Bleed bland tre vampyraktioner; det kan vara en förenkling i skissen.

## K3. Mål som kräver dold information (unresolved, BACKLOG)
**Beslut:** Mål "i samma stad" eller "i din domän" listar alla tänkbara mål (alla icke-brända vampyrer, andras minions, alla artefakter), inte bara de som faktiskt är där. Kontrollen görs vid upplösning; misslyckas den återbetalas kostnaden.
**Motivering:** En lista med bara de närvarande skulle läcka positioner. Så spelades Discord-spelet: man namnger ett mål och GM säger om det inte var där. Alternativ som Gustaf kan välja: sortera de man garanterat vet är där överst, när "känd information" finns (BACKLOG).

## K4. Positioner genom listan
**Beslut:** Mål räknas från positionerna efter tidigare entries i listan som flyttar vampyren eller en minion (Move, Sail, (M)Celerity, Expansion med contest, Anarch Revolt med contest, Conquer in the Name of Cain, Ravnos Boots, The Demeter, minionernas Move/Sail/Archon Movement, Anarch Highway, Scepter of Ventrue, Move the Master). Om destinationen är okänd (Second Tradition flyttar till målets stad) godtas alla städer för senare mål i listan. Vid upplösning misslyckas en entry vars mål inte stämmer längre (t.ex. om en tidigare Move misslyckades) och återbetalas.

## K5. Utkast får vara ofullständiga
**Beslut:** `analyzeDraft` godtar entries där val saknas (fel `incomplete`, `nextParam` säger vad som saknas) och listor över budget (`over_budget`). `canConfirm` är falsk så länge något fel finns. `submitActions` avvisar sådana listor (R4); vid upplösning stryks ofullständiga entries (R3).
**Motivering:** Gustaf: spelaren får lägga till fler actions än budgeten men inte bekräfta.

## K6. Give räknar bortgivet blood som kostnad
**Beslut:** Give kostar 0 enligt regeln, men blood som ges bort räknas in i entryns kostnad och listans total.
**Motivering:** Blodet lämnar spelaren och ska räknas mot "har du råd", och återbetalas om Give misslyckas.

## K7. Inkomst bara när den är deterministisk
**Beslut:** `income` sätts bara för fast blood till spelaren själv: Bottomless Wealth (+250), Call a Crusade! (+250), Diamond of Toreador (+25), Organize Resistance (+50 per "gain blood"-val) och (M)Presence när den valda aktionen har fast inkomst. Bleed, Bleed the Enemy, Esbat, Bloodspot Dice, (M)Animalism-vargar och Anarch Revolt-bleed visar ingen inkomst.

## K8. Buffar pekar på entries via key
**Beslut:** Obfuscate, Presence (egen) och (M)Oblivion pekar på en senare entry via `SubmittedAction.key`, som gränssnittet sätter. Målet måste ligga efter buffen (gd:95: "buffs and modifiers need to be applied before the action they target") och ha rätt kategori: Obfuscate personal/discipline, Presence faction, (M)Oblivion minionaktioner.
**Motivering:** Ett index skulle peka fel när spelaren drar om ordningen.

## K9. (M)Presence
**Beslut:** "Make any faction action that does not require a title": alla faction actions utan titelkrav, också andra sekters (t.ex. Anarch Free Press för en Camarilla-spelare). Kostnad, val, inkomst och förflyttning är den valda aktionens. En gång per rond.
**Motivering:** Utan andra sekters aktioner vore (M)Presence bara en dyrare kopia av aktioner man redan har. Stealth för (M)Presence är "samma som den valda"; katalogen anger 0 tills observationsreglerna läser den valda aktionens stealth (BACKLOG).

## K10. Thaumaturgy (bas)
**Beslut:** Man väljer en vampyr (även sig själv) och vilken som helst av de 14 disciplinerna (basaktion).
**Motivering:** Regeltexten säger "a discipline action", utan att kräva att man själv har disciplinen.

## K11. Val per counter och level
**Beslut:** Anarch Revolt: ett val per revolt counter efter att countern lagts, samma val får tas flera gånger, "ta kontroll" finns bara när staden får 5 counters. Build on the Master's Kingdom: ett val per level, samma val får tas flera gånger (Elysium "can be built multiple times", gd:318). Organize Resistance: X val (X = den brända minionens level), var och en med egen stad, upprepning tillåten.

## K12. Bottomless Wealth och förflyttning
**Beslut:** En lista med Bottomless Wealth får inte innehålla någon aktion som flyttar vampyren ("can't Move (in any way)"), oavsett ordning. Felet sätts på den senare av de två, så att R3 stryker den.

## K13. Minions som följer med kan inte agera
**Beslut:** Minions som följer med Expansion (contest) eller Second Tradition, och minionen som bränns av Organize Resistance, får inga egna actions i samma lista (fel `minion_locked`).

## K14. Buy Votes för alla
**Beslut:** Buy Votes har inget sektkrav. Regeltexten: "Non-camarilla vampires can vote in the Ivory tower thanks to this action" (gd:572). Det är också en gratisaktion (ingen slot).

## K15. Inte i katalogen än
- Ring of Tremere och (M)Thaumaturgy-skapade artefakter (bunden disciplin) och artefaktaktioner som (M)Thaumaturgy gett permanent.
- Hide and Spy: "can't make an action next turn" kontrolleras inte.
- Recruit an Archon kräver en avklarad mission samma rond; det avgörs vid upplösning.
- Martinelli's Ring tar inte bort Dementation, Tremeres gratis Thaumaturgy och Lasombras Trifle-regel (redan i BACKLOG).
Se BACKLOG.

## K16. Id:n
**Beslut:** Aktioner har snake_case-id. Minionaktioner som flera typer delar har ett id (`minion_move`, `minion_sail`, `bodyguard`). Aktioner med samma namn men olika regler har egna id (`sabotage` för Prince, `anarch_sabotage`, `sabbat_sabotage`, `ghoul_sabotage`; `attack` och `archon_attack`). (M)-aktioner slutar på `_m`. Artefaktaktioner heter `artifact_<nyckel>`. Skelettets id:n behölls.

## K17. Fritext
**Beslut:** (M)Chimerstry-meddelandet är fritext, högst 250 ord (gd:1219). Wait and Strike är borttagen ur motorn, se K20.

## K18. Standardregister
**Beslut:** `resolveRound`, `submitActions` och `analyzeSubmission` använder `ACTION_CATALOG` om inget register skickas in. `SKELETON_ACTIONS` finns kvar för rondens tester.

## K19. Archon Movement
**Beslut:** Ett val: en stad högst två steg bort ("move to an adjacent city, then they may move again").

## K20. Actions som kräver GM är borttagna
**Status:** ✅ Beslutat av Gustaf 2026-11-19: actions som kräver manuell input från GM listas som not-fixed och tas bort ur motorn. Definition of done för motorn v1 är att alla actions löses automatiskt.
**Beslut:** Wait and Strike (vampyr och Harpy), Dementation, (M) Dementation, Investigate, Investigate Eye, Troublemaker, Orders from the Top, Crown of Malkavs action och zombiens Hunt for Me är borttagna. Gustaf 2026-11-19: även Recruit an Archon (missions är borttagna ur spelet), Chimerstry och (M) Chimerstry tas bort och byggs om. Listan, skälen och gränsfallen står i [`docs/engine/not-fixed-actions.md`](../engine/not-fixed-actions.md).
