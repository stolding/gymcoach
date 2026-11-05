# Wijzigingen

Versienummers volgen MAJOR.MINOR.PATCH:
- **PATCH** (laatste cijfer): elke wijziging of reparatie
- **MINOR** (middelste cijfer): een kleine nieuwe functie
- **MAJOR** (eerste cijfer): een grote wijziging

## 2.1.0 — 5 november 2026
GymCoach in het Duits, en taalkeuze met vlaggetjes.
- Duits woordenboek compleet, met de uitleg *So funktioniert GymCoach* en de voorwaarden in het Duits (de Nederlandse tekst van de voorwaarden is leidend). Oefeningen komen van Speediance in het Duits.
- Taalkeuze met vlaggetjes op het inlogscherm, in de menubalk en in het gebruikersvenster. De keuze op het inlogscherm wordt per browser onthouden; in de app wordt hij voor je account bewaard.
- Gebruikersvenster: nieuw blok *Voorkeuren* met taal en thema, en een knop naar alle instellingen.
- Duitse zelfstandige naamwoorden houden hun hoofdletter midden in een zin; de weeknaam in de editor komt uit het woordenboek.
- Brochure in het Engels en Duits (`documentatie/GymCoach-brochure-en.pdf`, `-de.pdf`), met schermbeelden in die taal; README toont de Engelse pagina's. Het voorbeeldrapport in alle brochures gebruikt nu demodata.

## 2.0.0 — 5 november 2026
GymCoach is meertalig: Nederlands en Engels (fase 6 van issue #1). Voor Nederlandse gebruikers verandert er niets behalve de nieuwe taalkeuze; schermen, PDF-rapporten, mail en een nieuw plan zijn voor en na vergeleken en gelijk.
- Taalkeuze in Instellingen → Training: *Automatisch* (de taal van je browser) of een vaste taal. Ook het inlogscherm volgt de taal van de browser. Rapporten, mails en de AI-coach gebruiken dezelfde taal; bij *Automatisch* onthoudt de server de taal van je browser voor mails bij automatisch syncen.
- Engels woordenboek compleet, met de uitleg *Hoe GymCoach werkt* en de voorwaarden in het Engels (de Nederlandse tekst van de voorwaarden is leidend).
- Uitleg en beelden van oefeningen komen van Speediance in jouw taal als Speediance die heeft, anders in het Engels.
- Een plan dat in de ene taal is gemaakt, wordt in de andere taal getoond: namen van patronen, cardiodagen en vaste adviezen worden vertaald (eigen namen blijven staan).
- Laatste losse teksten naar het woordenboek: cardio-tegels, segmentbalans, hartslagtegel, tegels van het trainingsrapport, doseringen van warming-up en cooldown, uren, decimalen in de taal van de gebruiker.

## 1.17.0 — 5 november 2026
Meertaligheid, fase 5: rapport, mail en AI-coach. Voor Nederlandse gebruikers verandert er niets; PDF-rapporten, mail en trainingsgegevens zijn voor en na vergeleken en gelijk.
- PDF-rapport en mail na een training in de taal van de gebruiker, ook datums en getallen; meervoud via het woordenboek.
- Vergelijking, hartslagzones en de uitleg van de maximale hartslag (rapport en analyse) uit het woordenboek.
- Foutmeldingen van de mailserver en de AI-coach vertaald.
- De AI-coach antwoordt in de taal van de gebruiker (advies en redenen).
- Uitleg en beelden van oefeningen in de taal van de gebruiker als Speediance die goed levert (nu Engels en Duits), anders Engels; de kiezer toont welke taal.

## 1.16.0 — 5 november 2026
Meertaligheid, fase 4: server en plan. Voor gebruikers verandert er nog niets; teksten en een nieuw gemaakt plan zijn voor en na vergeleken en gelijk.
- Foutmeldingen en meldingen van de server (`server.js`, inloggen, Withings) in de taal van de gebruiker, via `tr()` uit `lib/lang.js`.
- Regels-engine: notities bij progressie, rust en deload, de tip op het overzicht en de namen van cardiodagen uit het woordenboek. Labels van bewegingspatronen, focusgebieden, accessoires, spiergroepen en dagsoorten worden bij het lezen vertaald.
- Activiteiten uit Apple Health worden bij het tonen vertaald (de database houdt de Nederlandse naam).
- Het controlescript herkent sleutels die met een voorvoegsel worden samengesteld.

## 1.15.0 — 5 november 2026
Meertaligheid, fase 3: alle tabbladen en vensters in `public/app.js` via het woordenboek (ongeveer 650 sleutels). Voor gebruikers verandert er nog niets; alle teksten zijn voor en na vergeleken.
- Vaste lijsten (doelen, dagsoorten, thema's, activiteiten, lichaamsmetingen, perioden) via `tmap()`, dat bij het lezen vertaalt.
- Meervoud via de woordenboeken (bijv. "1 training" / "3 trainingen") in plaats van Nederlandse uitgangen in de code.
- Datums, maand- en dagnamen in de taal van de gebruiker via `Intl` (`localeOf()`), ook in de editor.

## 1.14.0 — 5 november 2026
Meertaligheid, fase 1 en 2 (zie issue #1). Voor gebruikers verandert er nog niets; de app blijft Nederlands.
- Woordenboeken per taal in `public/locales/` (`nl.js` is de bron, `en.js` volgt). `public/i18n.js` doet het vertalen voor browser én server: plaatshouders, meervoud via `Intl.PluralRules`, terugval Engels → Nederlands, en opmaak van getallen, datums en duur met `Intl`.
- Vaste teksten in de pagina via `data-i18n` (ook `-html`, `-placeholder`, `-title`, `-aria-label`, `-label` en `-vars`); `index.html` heeft geen losse Nederlandse tekst meer (175 nieuwe sleutels).
- Server: `lib/lang.js` vertaalt in de taal van de gebruiker; fouten kunnen een code uit het woordenboek meegeven.
- Instelling `lang` per gebruiker (nog verborgen tot de Engelse vertaling compleet is).
- `tools/i18n-check.mjs`: controleert sleutels en vertalingen en telt Nederlandse tekst buiten het woordenboek; het aantal mag niet stijgen (`tools/i18n-baseline.json`). Draait in de GitHub-workflow vóór het bouwen van het image.

## 1.13.1 — 5 november 2026
- Afspraken voor commitberichten bijgewerkt.

## 1.13.0 — 5 november 2026
- Vorige weken terugkijken in Plan: met ‹ › naast de weektitel blader je door bewaarde weekplannen. Per week: trainingen gedaan, sets gehaald, volume en tijd. Per training per oefening wat gepland stond tegenover wat je deed (✓ gehaald, ↓ minder, ↑ meer, – niet gedaan), en oefeningen die je deed maar niet gepland waren. Vanuit een vorige week kun je een training naar deze week kopiëren, als sjabloon bewaren of het rapport openen.
- Elk weekplan wordt nu bewaard (tabel `plan_archive`, per week de laatste versie). De geschiedenis begint bij deze versie; het huidige plan wordt meteen bewaard.

## 1.12.1 — 5 november 2026
- Accessoires die je niet gebruikt staan nu duidelijk aangegeven: felle rode rand en een zachte rode achtergrond.

## 1.12.0 — 5 november 2026
- Accessoires die je niet gebruikt (Instellingen → Training): stang, bank, handgrepen, touw, heupgordel, roei- en skihandvat en mat. Oefeningen die zo'n accessoire nodig hebben, komen niet meer in je plan, niet bij wisselen en niet in de voorstellen van de AI-coach, net als in de Speediance-app. Per gebruiker. In de oefeningenkiezer staan ze standaard verborgen (met een filter om ze toch te tonen). GymCoach leidt het accessoire af uit de naam en het soort oefening, omdat de catalogus van Speediance het niet meegeeft.

## 1.11.2 — 5 november 2026
- Vragen en bevestigingen (opslaan als sjabloon, op het toestel zetten, verwijderen, wachtwoord instellen …) in een eigen GymCoach-venster in de stijl van de app, in plaats van het venster van de browser met het IP-adres van de server erboven. Verwijderen heeft een rode knop. Nieuw bestand `public/dialogs.js`.

## 1.11.1 — 5 november 2026
- Brochure: nieuwe pagina *Zelf samenstellen* over de editor, supersets, sjablonen en de AI-coach (nu 9 pagina's); afbeeldingen in `documentatie/afbeeldingen/` en de README's bijgewerkt, met schermafbeeldingen van de editor en de kiezer.
- `documentatie/ARCHITECTUUR.md`: editor, eigen trainingen, sjablonen, supersets, volume en de nieuwe routes.
- Editor: bij Volume staat nu "herh. × kg, alle handgrepen".

## 1.11.0 — 5 november 2026
- AI-coach voor eigen trainingen: de coach weet welke trainingen je zelf hebt gemaakt, bewerkt of vastgezet, en ziet de opbouw (supersets, modi, rust, piramides en vast gewicht). Hij respecteert die opbouw en stelt alleen iets voor met een reden. Zijn voorstellen voor eigen trainingen staan standaard uit: je vinkt zelf aan wat je overneemt. Overnemen houdt de opbouw per set intact; vast gewicht verandert nooit.
- Nieuwe knop *AI-advies* op elke training in het plan: advies voor alleen die training, in de context van je week.
- Volume telt nu echt: bij oefeningen met twee handgrepen tellen beide kanten mee (de *capacity* die Speediance per set opslaat). Het totaal in het rapport is gelijk aan de som van de oefeningen, en statistieken, weekvolume, voortgang en vergelijkingen rekenen op dezelfde manier. Geplande volumes in het plan en de editor gebruiken de verhouding die uit je eigen trainingen blijkt.
- Supersets getest op de Gym Monster: om en om, rust en herhalingen kloppen, en het rapport voegt de stappen samen tot oefeningen met hun sets.

## 1.10.0 — 5 november 2026
- Supersets in de editor: *+ Superset* koppelt een oefening aan de volgende (ook drie of meer). In een blauw kader met het aantal rondes en de rust na elke ronde; *Superset opheffen* maakt ze weer los. In het plan staan ze als A1, A2 …
- Naar de Gym Monster gaat een superset om en om per ronde (A1, A2, A1, A2 …) met 5 s om te wisselen en de ingestelde rust na de laatste oefening van de ronde. Nog te testen op het toestel.
- Historie: als een oefening vaker in één training voorkomt (superset), worden de sets samengevoegd, zodat progressie en rapport kloppen.

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
