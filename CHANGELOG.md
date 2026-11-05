# Wijzigingen

Versienummers volgen MAJOR.MINOR.PATCH:
- **PATCH** (laatste cijfer): elke wijziging of reparatie
- **MINOR** (middelste cijfer): een kleine nieuwe functie
- **MAJOR** (eerste cijfer): een grote wijziging

## 1.9.0 — 5 november 2026
- Eigen trainingen: *+ Nieuwe training* in het plan, leeg, als kopie van een training uit het plan, of uit een sjabloon. Eigen trainingen staan vast, blijven bij een nieuw voorstel en krijgen progressie; *Uit plan halen* verwijdert ze weer.
- Sjablonen (*Trainingen* onder het plan): bewaar een training met *Opslaan als sjabloon* in de editor; in dit plan zetten, bewerken (in de editor), delen met iedereen op de server of niet meer delen, verwijderen. Sjablonen van anderen zie je bij *Gedeeld op deze server*: in je plan zetten of kopiëren naar je eigen trainingen. De gewichten passen zich aan de gebruiker aan (eigen historie, anders een startgewicht).
- Meewerkende spieren uit de Speediance-gegevens tellen nu blijvend mee in de spierkaart.

## 1.8.0 — 5 november 2026
- Oefening toevoegen: onderaan kies je waar de oefeningen heen gaan (warming-up, oefeningen of cooldown). De kiezer opent op de juiste soort; ontbreekt die soort in de catalogus van je toestel, dan zie je alles.
- Wisselen in de editor: per oefening een andere kiezen, met de kiezer op dezelfde spiergroep.
- "Niet meer voorstellen" in het scherm Oefening bekijken (zonder dat het plan opnieuw wordt gemaakt).
- Plan: per training *Vastzetten* / *Losmaken*, en *Terug naar voorstel* bij een bewerkte training.

## 1.7.0 — 5 november 2026
- Trainingseditor stap 2: oefeningen toevoegen aan oefeningen, warming-up en cooldown. Bladeren per spiergroep en soort (kracht, eigen gewicht, warming-up, stretch, herstel …), zoeken op naam, filters (eerder gedaan, "niet meer voorstellen" verbergen). Per oefening je historie; nieuwe oefeningen krijgen sets, herhalingen, rust en gewicht volgens je doel en historie (of het aanbevolen startgewicht van Speediance).
- Oefening bekijken: demovideo van de coach, foto's met aandachtspunten, uitvoering in stappen, ademhaling, wat je moet voelen, veelgemaakte fout, hoofd- en meewerkende spieren, Speediance-voorinstellingen en je eigen verloop (geschat 1RM). Bladeren met vorige/volgende.
- Gedeelde cache: uitleg per oefening staat 30 dagen in de database voor alle gebruikers; foto's en video's worden pas bij bekijken gedownload naar `data/media` en daarna vanaf de eigen server getoond (met ondersteuning voor doorspoelen in video). Back-ups slaan deze cache over.

## 1.6.0 — 5 november 2026
- Trainingseditor (stap 1): knop *Bewerken* bij elke training. Pas sets, herhalingen, gewicht, rust en modus per set aan (standaard, excentrisch, isokinetisch, constant, spotter), voeg sets toe of verwijder ze, alle sets gelijk, opwarmset, piramide, volgorde, oefeningen verwijderen, warming-up en cooldown aanpassen. Rechts live het figuur, duur, sets, volume, duwen/trekken en de sets per spiergroep voor de hele week, met waarschuwingen. Ongedaan maken, terug naar voorstel.
- Bewerkte trainingen staan standaard vast: bij een nieuw voorstel blijven ze staan en schuiven de gewichten mee met de progressie (uit te zetten per oefening met *vast gewicht*). De modus per set gaat mee naar de Gym Monster.
- Teksten van de editor staan in `public/i18n.js`, als begin van meertaligheid.

## 1.5.4 — 5 november 2026
- Voorbereiding trainingseditor: `tools/oefening-info.mjs` toont wat de Speediance-API over een oefening weet (uitleg, beelden, talen); de API-aanroepen kunnen een taal meekrijgen.

## 1.5.3 — 5 november 2026
- README in het Engels (`README.md`) en Nederlands (`README.nl.md`), met schermafbeeldingen van de app.
- Overzicht: bij "Cardio buiten" als volgende training staat nu het advies en geen knop "Zet op Gym Monster" meer.
- Telefoon: de synctijd bovenin is verborgen, zodat de kop niet meer over meerdere regels loopt.

## 1.5.2 — 5 november 2026
- README: de pagina's van de brochure als afbeeldingen ("Zo ziet GymCoach eruit"), in `documentatie/afbeeldingen/`.

## 1.5.1 — 5 november 2026
- "Geen Speediance-abonnement nodig" verwijderd uit de README en de brochure (nieuwe ondertitel op de voorkant: "Een plan dat met je meegroeit.").

## 1.5.0 — 5 november 2026
- Installeren met Docker: `Dockerfile` en `docker-compose.yml`; het image wordt automatisch gebouwd voor amd64 en arm64 en staat op `ghcr.io/stolding/gymcoach`.
- Geen persoonlijke standaardwaarden meer: de VPS-tunnel vraagt om je eigen VPS (`GYMCOACH_VPS_HOST` in `.env`), voorbeeldadressen in Instellingen zijn neutraal. README beschrijft Tailscale, een eigen reverse proxy of een eigen VPS om GymCoach buitenshuis te gebruiken.

## 1.4.8 — 5 november 2026
- Per segment: visceraal vet staat nu in de kolom Vetmassa, met één decimaal en "index" erbij (het is een index zonder eenheid), en met de richtwaarde.

## 1.4.7 — 5 november 2026
- Popups in grafieken dekken de trainingsstreepjes onderaan nooit meer af: is er boven het punt geen ruimte, dan staat de popup naast de hulplijn, altijd binnen het grafiekvlak.

## 1.4.6 — 5 november 2026
- De zonekleur op de tegels staat nu als lijn aan de linkerkant in plaats van bovenaan (popups houden de lijn bovenaan).

## 1.4.5 — 5 november 2026
- Reparatie: popups met een zonekleur stonden soms over de hele breedte onder de grafiek (de opmaak van de tegels gold ook voor de popup).

## 1.4.4 — 5 november 2026
- Popups in grafieken krijgen bovenaan een lijn in de kleur van de zone waar de waarde in valt (groen/geel/rood zoals de achtergrond van de grafiek). De hartslaggrafieken in het rapport hebben nu ook zo'n popup (tijd, gemiddeld, maximaal en zone), in de kleur van de hartslagzone.

## 1.4.3 — 5 november 2026
- Tegels boven de grafieken krijgen een gekleurde lijn bovenaan voor de zone waarin de laatste meting valt: groen goed, geel let op, rood niet goed (dezelfde kleuren als de achtergrond in de grafiek). Hartslag-tegels bij trainingen en activiteiten volgen de kleur van de hartslagzone van het gemiddelde.

## 1.4.2 — 5 november 2026
- Documentatie: elke functie en elk bestand heeft commentaar (ook de iPhone-app); nieuwe README; `documentatie/ARCHITECTUUR.md` (hoe de code in elkaar zit); `.env.example` met proxy- en tunnelinstellingen.
- Brochure bijgewerkt (nieuw logo, nieuwe pagina "Afgestemd op jou", iPhone-app, wizard, buitenshuis via VPS) en als PDF in `documentatie/`.

## 1.4.1 — 5 november 2026
- Uitleg: het gekozen onderdeel blijft oranje gemarkeerd, ook bij korte onderdelen onderaan (AI-coach, Bronnen); helemaal onderaan gescrold wordt het laatste onderdeel gemarkeerd.

## 1.4.0 — 5 november 2026
- Spierkaarten met een mannelijk, vrouwelijk of neutraal figuur (automatisch volgens geslacht, of zelf te kiezen); ook in de PDF.
- Berekeningen per geslacht: maximale hartslag voor vrouwen met Gulati (206 − 0,88 × leeftijd), rust 20% korter en wat meer volume per training voor vrouwen. Bij non-binair/anders kies je zelf de tabel.
- Rust wordt ook afgestemd op je eigen herstel: zakken je herhalingen in latere sets, dan langere rust; haal je steeds alles, dan iets korter. De reden staat bij de oefening.
- AI-coach krijgt geslacht en leeftijd mee.
- Nieuw: "Hoe GymCoach werkt" (Instellingen → Over GymCoach, en "Waarom?" bij Lichaam en doelen): uitleg van het plan, de persoonlijke afstemming, hoe alles wordt gemeten, de AI-coach en de bronnen.

## 1.3.2 — 5 november 2026
- Plan gebruikt de kalenderweek (jaar-weeknummer) in plaats van een eigen weekteller: "Week 45 · 2026"; programma's op het toestel heten nu "GC 2026-W45 Full Body A". Oude namen ("GC W12 …") worden nog herkend.

## 1.3.1 — 5 november 2026
Plan: de groene balk "Gedaan op …" staat nu onder de oefeningen, boven de knoppen, zodat alle trainingen dezelfde opbouw houden.

## 1.3.0 — 5 november 2026
Plan: trainingen die deze week al gedaan zijn, krijgen een groene balk "Gedaan op …" met duur, volume en kcal, een vinkje per gedane oefening en de knop "Bekijk training". Bovenaan "x van y gedaan"; Overzicht slaat gedane trainingen over bij "Volgende training".

## 1.2.1 — 5 november 2026
Oefeningencatalogus pas na het koppelen van het Speediance-account en toestel; meteen opgehaald voor dat toestel. Geen standaardlijst meer voor gebruikers zonder account; bron en datum zichtbaar bij Sync en catalogus.

## 1.2.0 — 5 november 2026
Alle soorten activiteiten uit Apple Health herkend, met Nederlandse naam (bijv. Voetbal, Padel, Zwemmen) en nieuwe categorieën: racketsport, teamsport, watersport, wintersport, vechtsport en dansen. Ook oudere gegevens ("Other 41") krijgen de juiste naam. Tempo per sport: zwemmen per 100 m, fietsen in km/u; geen afstand/tempo bij balsporten.

## 1.1.3 — 5 november 2026
Lichaamsgrafiek: activiteiten in een eigen strook tussen de grafiek en de datums.

## 1.1.2 — 5 november 2026
Lichaamsgrafiek: activiteiten alleen als streepjes onderaan, geen gekleurde balken meer over de richtwaarden heen.

## 1.1.1 — 5 november 2026
AI-coach: toegepast of genegeerd advies blijft niet als open voorstel staan (korte regel met "Toon advies"); knop "Negeren"; bij een nieuw plan vervalt het oude advies.

## 1.1.0 — 5 november 2026
Nieuw logo: de halter met het scherm van de Gym Monster (variant C2), in de web-app, als favicon en beginschermicoon, en als app-icoon van GymCoach Sync 1.4.

## 1.0.1 — 5 november 2026
Copyright-vermeldingen aangepast aan open source (MIT-licentie): Over GymCoach, inlogscherm en voorwaarden.

## 1.0.0 — 5 november 2026
Eerste genummerde versie: weekplan en progressie, statistieken en analyse, trainingskalender, lichaamsmetingen (Withings), Apple Health via GymCoach Sync, trainingsrapport per mail, AI-coach, meerdere gebruikers met welkomststappen en voorwaarden, logo en "Over GymCoach".
