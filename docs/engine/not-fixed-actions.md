# Actions som inte går att automatisera (not-fixed)

**Datum:** 2026-11-19
**Bakgrund:** Gustaf 2026-11-19: designern ska bygga om de actions som kräver manuell input från GM. De listas här som **not-fixed** och är borttagna ur motorn (`ACTION_CATALOG`). Definition of done för motorn v1: det finns inga actions som inte kan lösas automatiskt.
**Kriterium:** En action är not-fixed om den kräver att en människa (GM) hittar på, tolkar eller väljer något som motorn inte har data för. Tärningsslag räknas inte: de görs med seedad slump. Val som spelaren själv gör räknas inte heller, eftersom de görs när actionen läggs in eller som ett väntande val (M8).

Testet `test/catalog/catalog.test.ts` ("aktioner som kräver GM finns inte i motorn") ser till att de inte kommer tillbaka av misstag.

## Not-fixed (borttagna ur motorn)

| Action | Typ | Regel | Varför GM behövs |
|---|---|---|---|
| Wait and Strike | Personal | gd:1153 | Spelaren skriver ett fritt villkor som GM godkänner ("Always check with the GM and get your condition approved"). |
| Wait and Strike | Harpy | gd:263 | Samma som ovan. |
| Dementation | Discipline | gd:1222 | GM skickar en skärmdump från en slumpvis chatt. |
| (M) Dementation | Discipline | gd:1224 | Ett av tre val tvingar målet att göra Investigate, som kräver GM. Move och Bleed med slumpat mål skulle gå att automatisera, om designern stryker Investigate-valet. |
| Investigate | Faction | gd:967 | GM ger information och en ledtråd om ett problem eller en special. |
| Investigate Eye | Eye | gd:291 | Svaren på frågorna ("Vad är ursprunget?", "Hur gör jag det värre?") skrivs av GM. |
| Troublemaker | Faction | gd:970 | GM hittar på ett problem; "the lower the stability the worse the problem". Kräver en problemtabell (Part C #3). |
| Orders from the Top | Justicar | gd:1028 | GM ger en mission. Kräver ett missionsbibliotek med villkor motorn kan kontrollera (Part C #10). |
| Crown of Malkav | Artefakt | gd:418 | Ger en slumpvis skärmdump från en chatt när någon använder Dementation. Artefakten finns kvar (minionbonusen +1 Intercept), men har ingen action. |
| Hunt for Me | Zombie (Vestment of Vileness) | gd:402 | Actionen nämns men definieras aldrig i regelboken. GM fick avgöra vad den gör. Zombien kan fortfarande göra Move. |

## Gränsfall (kvar i motorn)

| Action | Regel | Varför den får stå kvar | Vad som krävs |
|---|---|---|---|
| (M) Chimerstry | gd:1219 | Spelarens text (högst 250 ord) publiceras ordagrant; ingen bedömning. | Plattformen behöver ett publikt "information highway"-flöde som motorn kan skicka texten till (Part C #7). Annars är den också not-fixed. |
| Recruit an Archon | gd:1041 | Själva actionen är automatisk. | Kräver en avklarad mission samma rond. Med Orders from the Top borttagen kan Justicars bara få missions på annat sätt (från en Inner Circle-medlem, gd:919), som inte finns i motorn än. Utan missions misslyckas actionen alltid. |
| Search | gd:976 | "25 % chans att hitta en artefakt" och listan över vampyrer och minions går att räkna. | Inget. |

## Följder

- Disciplinen **Dementation** har inga actions i motorn just nu. Malkavians och andra med Dementation behåller disciplinen, men kan inte använda den förrän designern byggt om actionerna.
- **Justicar-missions** saknar källa i motorn (Orders from the Top är borttagen). Det påverkar Recruit an Archon, Archons loyalty counters (gd:332) och Justicars VP.
- **Problem på städer** skapas inte längre av någon action (Troublemaker är borttagen). Problem kan fortfarande uppstå av andra regler, t.ex. stability 0 (gd:492), som också behöver en problemtabell.
