// Uitleg "Hoe GymCoach werkt" (Nederlands): wat de app doet en welke keuzes er achter de berekeningen zitten.
// Elke sectie heeft een id, zodat je vanuit de app direct naar een onderdeel kunt springen.

export default [
  {
    id: 'starten', title: 'Nieuw: koppelen',
    html: `<p>Drie koppelingen zetten GymCoach aan het werk. Speediance is nodig voor het plan en de trainingen. De weegschaal en Apple Health mogen later: zonder die metingen blijven Lichaam, de gezondheidsscore en de activiteiten leeg.</p>
    <h4>Speediance-account</h4>
    <ol>
      <li>Ga naar <b>Instellingen → Speediance-account</b>.</li>
      <li>Vul het e-mailadres en het wachtwoord van je Speediance-account in. In Europa is de regio meestal <b>EU</b>.</li>
      <li>Kies je Gym Monster, of tik op <b>Detecteer mijn toestel</b>.</li>
      <li><b>Opslaan en testen</b>. GymCoach haalt daarna de oefeningencatalogus van dat toestel op.</li>
    </ol>
    <p>Het wachtwoord blijft op je eigen server staan. Kies daarna bij Training je doel, dagen en minuten, en maak je eerste weekplan.</p>
    <h4>Withings-weegschaal</h4>
    <p>Dit gaat in twee delen. Eerst maakt de beheerder eenmalig een koppeling bij Withings. Daarna koppelt iedere gebruiker de eigen weegschaal. De sleutels staan niet op de weegschaal en niet in de Withings-app op je telefoon. Withings maakt ze aan op de ontwikkelaarssite.</p>
    <p><b>Eenmalig, door de beheerder</b></p>
    <ol>
      <li>Ga naar <b>developer.withings.com</b> en log in met een Withings-account.</li>
      <li>Open <b>Dashboard</b> en kies <b>Create an application</b>. Type: <b>Public API</b>. Geef de app een naam, bijvoorbeeld GymCoach.</li>
      <li>Withings toont daarna een <b>Client ID</b> en een <b>Client secret</b>. Dat zijn de sleutels. Kopieer ze en laat die pagina open tot ze in GymCoach staan.</li>
      <li>In GymCoach: <b>Instellingen → Withings</b>. Het blok <b>Withings-app</b> zie je alleen als beheerder.</li>
      <li>Bij Callback-URL klik je op <b>Vul adres van deze pagina in</b>. Er komt een adres dat eindigt op <code>/api/withings/callback</code>. Klik op <b>Kopieer</b> en plak het bij Withings in het veld voor de callback. Het moet precies hetzelfde zijn.</li>
      <li>Plak Client ID en Client secret in GymCoach en klik op <b>Opslaan</b>.</li>
    </ol>
    <p><b>Daarna, door iedere gebruiker</b>, ook de beheerder zelf</p>
    <ol>
      <li>Blijf op <b>Instellingen → Withings</b>.</li>
      <li>Klik op de oranje knop <b>Koppel Withings</b>. Er opent een pagina van Withings.</li>
      <li>Log in met het Withings-account van de weegschaal, hetzelfde account als in de Withings-app op je telefoon. Sta toegang toe.</li>
      <li>Je ziet <b>Withings gekoppeld</b>. Sluit dat tabblad. In GymCoach staat daarna <b>gekoppeld</b> en de metingen zijn opgehaald.</li>
    </ol>
    <p>Staat de knop <b>Koppel Withings</b> er niet, dan heeft de beheerder Client ID en Client secret nog niet opgeslagen. Op de weegschaal zelf hoef je niets in te stellen. Weeg zoals je gewend bent, bij voorkeur nuchter, ’s ochtends, vóór het douchen. De rusthartslag op de weegschaal is een staande momentmeting.</p>
    <h4>Apple Health</h4>
    <p>De koppelsleutel maak je zelf in GymCoach. Die haal je nergens anders vandaan. Hij begint met <code>gch_</code> en wordt maar één keer getoond. Ben je hem kwijt, klik dan op <b>Nieuwe sleutel</b>. De oude werkt dan niet meer.</p>
    <p><b>Op de computer, in GymCoach</b></p>
    <ol>
      <li>Ga naar <b>Instellingen → Apple Health</b>.</li>
      <li>Klik op <b>Koppelsleutel maken</b>.</li>
      <li>Er verschijnt een groen vak met twee regels. De regel <b>URL</b> eindigt op <code>/api/health/ingest</code>. Die hele regel plak je niet in de iPhone. Je hebt het adres van je GymCoach nodig, zonder dat eind. Bijvoorbeeld <code>https://gymcoach.stolding.com</code>, of thuis <code>http://192.168.1.50:8765</code>.</li>
      <li>De andere regel is de sleutel. Klik op <b>Kopieer sleutel</b> en bewaar hem tot hij in de iPhone staat.</li>
    </ol>
    <p><b>Op de iPhone, in GymCoach Sync</b></p>
    <p>De app heeft twee adressen. Die mag je niet door elkaar halen.</p>
    <ol>
      <li>Installeer <b>GymCoach Sync</b> via TestFlight en open de app.</li>
      <li>Om het plan te bekijken log je in met het adres van je GymCoach-site, je gebruikersnaam en het wachtwoord van GymCoach. Dat is niet de koppelsleutel.</li>
      <li>Om Apple Health te sturen: tab <b>Meer</b> → <b>Synchroniseren</b>. Vul daar hetzelfde adres in, zonder <code>/api/health/ingest</code>. In het veld <b>Koppelsleutel</b> plak je de sleutel die met <code>gch_</code> begint. Tik op <b>Toon</b> als je wilt zien of hij goed staat.</li>
      <li>Tik op <b>Test verbinding</b>. De iPhone vraagt toegang tot Gezondheid. Sta toe wat GymCoach vraagt: workouts, hartslag, stappen, energie, afstand, rusthartslag, HRV, VO2max en voeding.</li>
      <li>Tik daarna één keer op <b>Volledige historie versturen</b>, zodat oudere wandelingen en dagen meekomen. Nieuwe gegevens gaan daarna vanzelf, hooguit één keer per uur.</li>
    </ol>
    <p><b>Automatisch alleen thuis</b> betekent: alleen op wifi, en alleen als je server bereikbaar is. Zet dat uit als je GymCoach via internet gebruikt. <b>Test verbinding</b> en <b>Nu synchroniseren</b> werken ook dan.</p>
    <p>GymCoach Sync leest workouts (wandelen, fietsen en de rest), hartslag, stappen, actieve energie, afstand, rusthartslag, HRV, VO2max en voeding. Krachttrainingen die Speediance zelf naar Apple Health schrijft, slaat GymCoach over, zodat niets dubbel telt. Liever een andere app: op Instellingen → Apple Health staat onder <b>Of: Health Auto Export instellen</b> hoe je dezelfde URL en sleutel daar invult. De sleutel hoort in de header <code>Authorization</code>, als <code>Bearer</code> gevolgd door de sleutel.</p>
    <p>De rusthartslag van de Apple Watch is de dagwaarde. Die gebruikt GymCoach zodra er genoeg dagen zijn; anders de meting van de weegschaal.</p>`,
  },
  {
    id: 'kort', title: 'In het kort',
    html: `<ol>
      <li><b>Ophalen.</b> GymCoach haalt je trainingen op van je Speediance-account: per oefening de sets, herhalingen, gewichten, tijden en (als je een hartslagband draagt) je hartslag.</li>
      <li><b>Plannen.</b> Uit je instellingen en je historie maakt een vaste set regels een weekplan. De AI-coach (als die is ingesteld) mag daarna voorstellen doen, maar alleen binnen grenzen en jij beslist.</li>
      <li><b>Op het toestel.</b> Met één klik staat een training als programma op je Gym Monster, met gewichten, herhalingen en rust al ingevuld.</li>
      <li><b>Terugkijken.</b> Na elke training een rapport; daarnaast Training en Terugkijken, samen met je metingen van Withings en je activiteiten uit Apple Health.</li>
    </ol>
    <p>Alles draait op je eigen server. Je gegevens gaan alleen naar Speediance, Withings en Apple (die je zelf koppelt) en, als je de AI-coach gebruikt, naar de AI-dienst die de beheerder heeft gekozen.</p>`,
  },
  {
    id: 'schermen', title: 'De schermen',
    html: `<p>De schermafbeeldingen zijn van een voorbeeldgebruiker, Sam Demo. Trainingen, weegschaal en Apple Health zijn verzonnen. Op het overzicht van een tab staan oranje nummers. Daarna volgt per blok een close-up.</p>
    <h4>Overzicht</h4>
    <p>Dit is de startpagina. Bovenaan een begroeting, daarna de blokken onder elkaar.</p>
    <img class="guide-shot" src="/guide/overzicht.png" alt="Overzicht van Sam Demo, met een nummer op elk blok">
    <ol>
      <li><b>Begroeting.</b> Datum, je naam en een tip, bijvoorbeeld een record of hoeveel trainingen deze week nog openstaan.</li>
      <li><b>Herstel en score.</b> Links of je uitgerust bent (rusthartslag, HRV, gehaalde herhalingen). Rechts de gezondheidsscore van 0 tot 10, hoger is beter, met de lijn over de weken.</li>
      <li><b>Spierherstel.</b> Het lichaamsschema en de lijnen per spiergroep. Oranje is vermoeid, groen is hersteld. De knoppen zetten een spiergroep aan of uit.</li>
      <li><b>Volgende training.</b> De eerstvolgende training die nog openstaat, met de geschatte tijd.</li>
      <li><b>Weekdoel.</b> De ring telt de trainingen uit het plan, ook een wandeling. Bij het weekdoel is de cirkel vol. Doe je er meer, dan loopt een helderdere oranje ring over de buitenste helft, tot het hele plan vol is.</li>
      <li><b>Reeks.</b> Hoeveel weken achter elkaar je het weekdoel haalde.</li>
      <li><b>Volume.</b> Kilo deze week, vergeleken met vorige week.</li>
      <li><b>Minuten.</b> Trainingstijd en kcal deze week.</li>
      <li><b>Lichaam.</b> Laatste gewicht, vetpercentage en de richting van de laatste weken.</li>
      <li><b>Gezondheidsstatus.</b> Een tekst van de AI-coach over de laatste vier weken. Zonder AI-coach blijft hier “Maak status” staan.</li>
      <li><b>Doel.</b> Of je op schema ligt, met de streep voor kcal en eiwit van vandaag. De knop gaat naar het tabblad Doel.</li>
      <li><b>Kracht.</b> Geschat 1RM van je zwaarste oefeningen in de laatste vier weken, met een kleine lijn.</li>
      <li><b>Records.</b> Nieuwe records van de laatste veertien dagen.</li>
      <li><b>Kalender.</b> Acht weken. Een vak is een trainingsdag; de kleur is de minuten van die dag. Klik een dag voor de oefeningen.</li>
      <li><b>Plan deze week.</b> Het lichaamsschema van de geplande belasting, het aantal trainingen, de werksets en de zwaarste spiergroepen.</li>
    </ol>
    <img class="guide-shot" src="/guide/overzicht-herstel.png" alt="Herstel links en de gezondheidsscore rechts">
    <p class="guide-cap muted small">Herstel en score naast elkaar. Groen betekent dat er niets tegenzit. De score noemt wat meewoog, hier vetpercentage en BMI.</p>
    <img class="guide-shot" src="/guide/overzicht-spieren.png" alt="Spierherstel met lichaamsschema en lijnen">
    <p class="guide-cap muted small">Spierherstel. Het figuur is de stand nu. De lijnen zijn het herstel per dag.</p>
    <img class="guide-shot" src="/guide/overzicht-volgende.png" alt="Volgende training en de weekring">
    <p class="guide-cap muted small">Links de volgende training, rechts de ring van het weekdoel.</p>
    <img class="guide-shot" src="/guide/overzicht-midden.png" alt="Tegels, gezondheidsstatus en doel">
    <p class="guide-cap muted small">De vier tegels, daaronder de gezondheidsstatus en de samenvatting van het doel.</p>
    <img class="guide-shot" src="/guide/overzicht-kracht.png" alt="Kracht en records">
    <p class="guide-cap muted small">Kracht links, records rechts.</p>
    <img class="guide-shot" src="/guide/overzicht-kalender.png" alt="Trainingskalender en het plan van deze week">
    <p class="guide-cap muted small">Kalender links, het plan van deze week rechts.</p>
    <h4>Plan</h4>
    <p>Hier staat de week die op de Gym Monster komt. Je wijzigt hem alleen op de computer.</p>
    <img class="guide-shot" src="/guide/plan.png" alt="Tabblad Plan van Sam Demo">
    <ol>
      <li><b>Kop en knoppen.</b> De week, de pijlen naar een oudere week, en de knoppen voor een nieuwe training, een nieuw voorstel en de AI-coach.</li>
      <li><b>Spieren en tijd.</b> Voor- en achterkant. De lijst ernaast is de geplande tijd en de sets per spiergroep. Klik een spiergroep om hem in het figuur te zien.</li>
      <li><b>Trainingen.</b> Een kaart per dag: naam, minuten, oefeningen, en of hij al gedaan is. Opklappen toont sets en gewichten. Daaronder zet je hem op het toestel, bewerk je hem, of vervang je hem.</li>
      <li><b>Sjablonen.</b> Eigen trainingen die je bewaart, en trainingen die op deze server gedeeld zijn.</li>
      <li><b>Programma’s.</b> Wat er al op je Gym Monster-account staat. Die lijst haal je op met Toon programma’s.</li>
    </ol>
    <img class="guide-shot" src="/guide/plan-spieren.png" alt="Lichaamsschema en de spierlijst van de week">
    <p class="guide-cap muted small">Het weekoverzicht: figuur en de verdeling over de spiergroepen.</p>
    <img class="guide-shot" src="/guide/plan-sessies.png" alt="Drie trainingskaarten, waarvan twee al gedaan">
    <p class="guide-cap muted small">De dagen van de week. Een gehaalde training heeft een dichte groene rand. Een balk onder het doel toont of je eroverheen ging: het extra stuk is helderder. Een activiteit buiten die al bezig is maar het weekdoel nog niet haalt, heeft een gestippelde oranje rand. Cardio buiten heeft geen programma op het toestel; die activiteit komt uit Apple Health.</p>
    <h4>Doel</h4>
    <p>Wat je eet tegenover wat bij het doel past. De weegschaal zelf blijft onder Lichaam.</p>
    <img class="guide-shot" src="/guide/doel.png" alt="Tabblad Doel van Sam Demo">
    <ol>
      <li><b>Streef en stand.</b> De berekende kcal en het eiwit, en of vandaag daar al op zit.</li>
      <li><b>Doel stellen.</b> Lichaam (kilogram en weken), kracht per spiergroep, stappen per dag en activiteiten per week. Bewaren laat het doel opnieuw beginnen.</li>
      <li><b>Gewicht.</b> Je metingen en de rechte lijn naar het streefgewicht.</li>
      <li><b>Inname.</b> Wat je at, tegen de streep van de streefkcal.</li>
      <li><b>Kracht.</b> De index van de gekozen spiergroep, hier de rug, tegen de lijn van het krachtdoel.</li>
      <li><b>Dagen.</b> Een tabel per dag: training, stappen, inname en of het binnen het doel viel.</li>
    </ol>
    <img class="guide-shot" src="/guide/doel-formulier.png" alt="Het formulier om een doel te stellen">
    <p class="guide-cap muted small">Het formulier. Stappen en activiteiten staan eronder; die zie je op de hele pagina hierboven.</p>
    <h4>Lichaam</h4>
    <p>De weegschaal en de samenstelling. Geen trainingsgrafiek.</p>
    <img class="guide-shot" src="/guide/lichaam.png" alt="Tabblad Lichaam van Sam Demo">
    <ol>
      <li><b>Titel.</b> Lichaamsgewicht.</li>
      <li><b>Weegschaal.</b> Of Withings gekoppeld is, en een knop om zelf een meting toe te voegen.</li>
      <li><b>Gezondheidsscore.</b> Dezelfde score als op Overzicht, hier met de categorieën lichaam, hart, conditie en overig.</li>
      <li><b>Samenstelling.</b> Tegels voor gewicht, vet, spiermassa en de andere waarden van de weegschaal, met een grafiek. Groen of rood volgt of de score er beter of slechter van wordt, niet of het getal steeg.</li>
      <li><b>Metingen.</b> De lijst, ingeklapt. Openen toont elke weegdag.</li>
    </ol>
    <h4>Training</h4>
    <p>Wat je op de Gym Monster hebt gedaan. Klik een rij voor de oefeningen, sets en gewichten.</p>
    <img class="guide-shot" src="/guide/training.png" alt="Tabblad Training van Sam Demo">
    <ol>
      <li><b>Titel.</b> Training.</li>
      <li><b>Grafieken.</b> Drie naast elkaar: trainingen per week, volume per week en minuten per week.</li>
      <li><b>Trainingen.</b> De tabel. Een rij opent het rapport van die training.</li>
      <li><b>Per oefening.</b> Kies een oefening. De grafiek is het verloop van het geschatte 1RM.</li>
    </ol>
    <h4>Terugkijken</h4>
    <p>Alles over een periode die je rechtsboven kiest. Afdrukken en PDF gebruiken diezelfde periode. De pagina is lang; de nummers lopen van boven naar beneden.</p>
    <img class="guide-shot" src="/guide/terugkijken.png" alt="Tabblad Terugkijken van Sam Demo">
    <ol>
      <li><b>Kop.</b> De periode, plus Afdrukken en PDF.</li>
      <li><b>Cijfers.</b> Tegels over de periode: trainingen, per week, tijd, kcal, weekreeks, favoriete dag, volume, sets, herhalingen per set, zwaarste gewicht, records en spiergroepen.</li>
      <li><b>Cardio.</b> Activiteiten uit Apple Health in deze periode.</li>
      <li><b>Balans en massa.</b> Links de verdeling van het volume, rechts spiermassa tegen het trainingsvolume.</li>
      <li><b>Kracht.</b> De index per spiergroep. 100 is het begin van de periode. Een stip zet een spiergroep aan of uit.</li>
      <li><b>Kilometers en stappen.</b> Kilometers per week en stappen per dag.</li>
      <li><b>Per spiergroep.</b> Volume, sets en het beste geschatte 1RM.</li>
      <li><b>Sets per week.</b> Een balk per spiergroep. Groen valt in de richtlijn voor beginners, ongeveer 6 tot 12 werksets.</li>
      <li><b>Detail.</b> Dezelfde spiergroepen in een tabel, per week.</li>
      <li><b>Per oefening.</b> Volume en het zwaarste gewicht per oefening.</li>
      <li><b>Patronen.</b> Welke bewegingspatronen (duwen, trekken, squat) je deed.</li>
      <li><b>Kalender.</b> Dezelfde acht weken als op Overzicht, voor de gekozen periode.</li>
      <li><b>Wanneer.</b> Op welke dagen en uren je traint. Het vinkje telt wandelen en fietsen mee.</li>
      <li><b>Herstel en energie.</b> Of de belasting bij je herstel past, en de verbrande energie naast het gewicht.</li>
    </ol>
    <h4>Instellingen</h4>
    <p>Links het menu, rechts het open onderdeel. Sam Demo is geen beheerder, dus AI-coach en Gebruikers ontbreken. Die twee zie je alleen als beheerder.</p>
    <img class="guide-shot" src="/guide/instellingen.png" alt="Instellingen, met Speediance-account open">
    <ul>
      <li><b>Speediance-account.</b> E-mail, wachtwoord, regio en Gym Monster. Opslaan en testen haalt de catalogus op. Detecteer mijn toestel kiest het model.</li>
      <li><b>Training.</b> Doel, dagen, minuten, ervaring, deload, warming-up, cooldown en of de week één plan is.</li>
      <li><b>Lichaam en doelen.</b> Geslacht, geboortejaar, geboortedatum, maximale hartslag, figuur en lengte. Die sturen de grafieken en de score.</li>
      <li><b>Apple Health.</b> Hier maak je de koppelsleutel. Hoe dat gaat staat bij Nieuw: koppelen.</li>
      <li><b>Withings.</b> De knop Koppel Withings. De Client ID vult alleen de beheerder in.</li>
      <li><b>E-mail.</b> Je adres, en of je na een training een PDF wilt. De mailserver stelt de beheerder in.</li>
      <li><b>Sync en catalogus.</b> Wanneer de laatste sync was, en hoeveel oefeningen er voor je toestel staan.</li>
      <li><b>Handleiding.</b> Deze tekst.</li>
      <li><b>Voorwaarden.</b> De tekst die je bij de eerste start accepteert.</li>
      <li><b>Over GymCoach.</b> Versie en licentie.</li>
    </ul>`,
  },
  {
    id: 'plan', title: 'Het weekplan',
    html: `<p><b>Schema.</b> Het aantal trainingen per week bepaalt de indeling: 2 of 3 dagen full body (A/B/C), 4 dagen boven/onder. Elke training vult vaste bewegingspatronen (duwen, trekken, squat, hip hinge, …) met een oefening uit de catalogus van jouw toestel.</p>
    <p><b>Voorschrift per doel</b> (werksets):</p>
    <table class="about-tbl"><thead><tr><td></td><td>Samengesteld</td><td>Isolatie</td></tr></thead><tbody>
      <tr><td class="muted">Spieropbouw</td><td>3 × 8–12, 90 s rust</td><td>3 × 10–15, 60 s</td></tr>
      <tr><td class="muted">Combinatie</td><td>3 × 10–12, 60 s</td><td>3 × 12–15, 45 s</td></tr>
      <tr><td class="muted">Afvallen</td><td>3 × 12–15, 45 s</td><td>2 × 15–20, 30 s</td></tr>
      <tr><td class="muted">Cardio-circuit</td><td colspan="2">3 × 15–20, licht (60%), 20 s rust</td></tr>
    </tbody></table>
    <p class="muted small">Gevorderd: één set extra op samengestelde oefeningen. Nieuwe oefening: eerst twee keer met 2 sets, voor de techniek.</p>
    <p><b>Progressie</b> (dubbele progressie): haal je in alle sets de bovenkant van de bandbreedte, dan gaat het gewicht omhoog (+2 kg samengesteld, +1 kg isolatie) en begin je weer onderaan. Haal je de onderkant, dan +1 herhaling. Twee keer achter elkaar onder het doel: −10%.</p>
    <p><b>Deload.</b> Elke zoveel trainingsweken (instelbaar, standaard 6) een lichtere week: een set minder en 10% lichter. Weken zonder training tellen niet mee.</p>
    <p><b>Accessoires.</b> Gebruik je een accessoire niet (stang, bank, handgrepen, touw, heupgordel, roei- en skihandvat of mat), zet het dan uit bij Instellingen → Training. Oefeningen die het nodig hebben, komen dan niet meer in je plan, bij wisselen of in de voorstellen van de AI-coach. Welk accessoire een oefening nodig heeft, leidt GymCoach af uit de naam (bijvoorbeeld <i>Barbell</i>, <i>Rope</i>, <i>Incline</i>, <i>Seated</i>) en het soort oefening.</p>
    <p><b>Focus en tijd.</b> Focusgebieden komen vooraan en krijgen een extra set zolang de training binnen je ingestelde tijd blijft. GymCoach schat de duur met 4 s per herhaling plus de rust.</p>
    <p><b>Zelf aanpassen.</b> Met <i>Bewerken</i> pas je een training aan: sets, herhalingen, gewicht, rust en modus per set (standaard, excentrisch, isokinetisch, constant, spotter), de volgorde, de warming-up en de cooldown. Het figuur en de sets per spiergroep voor de hele week rekenen direct mee. Een bewerkte training is <i>vastgezet</i>: bij een nieuw voorstel blijft hij staan en schuiven de gewichten mee met je progressie, behalve bij oefeningen met <i>vast gewicht</i>. Met <i>Wissen</i> haal je één training uit deze week, met <i>Vervangen</i> zet je er een andere voor in de plaats. De andere trainingen blijven staan. Daarbij kun je ook een wandeling, fietstocht, zwemmen, padel of een andere activiteit invoegen.</p>
    <p><b>Supersets.</b> Twee of meer oefeningen om en om, zonder rust ertussen; na elke ronde de rust van de laatste oefening. Op de Gym Monster staan ze als afwisselende stappen (A1, A2, A1, A2 …), omdat een programma geen supersets kent.</p>
    <p><b>Eigen trainingen en sjablonen.</b> Met <i>+ Nieuwe training</i> maak je zelf een training (leeg, als kopie of uit een sjabloon). Een training bewaar je als sjabloon in <i>Trainingen</i>, en die kun je delen met iedereen op je server. Wie een gedeeld sjabloon in zijn plan zet, krijgt gewichten uit zijn eigen historie, of een startgewicht als hij de oefening nog niet deed.</p>
    <p><b>Eén week.</b> Met <i>Week als één plan</i> aan (Instellingen → Training) schuift een oefening naar een latere dag als die hoofdspier nog niet uitgerust is. Boven- en onderlichaam blijven apart, een vastgezette training blijft staan, en het weektotaal per spiergroep blijft gelijk. Op het weekplan zie je het herstel aan het begin van elke training. Bij een nieuw weekplan kies je de weekdag en het dagdeel van elke training. Het herstel loopt als een balk door de hele week, in blokken van 6 uur. Een knop wisselt tussen een geleidelijk kleurverloop en een stapel. Die keuze blijft bewaard. Sleep een bolletje in de balk naar een ander blok: de andere trainingen van die dag gaan mee en het herstel wordt meteen herberekend. Zet de schakelaar uit en maak een nieuw weekplan om de vaste dagen terug te krijgen.</p>
    <p><b>Vorige weken.</b> GymCoach bewaart elk weekplan. Met de pijltjes naast de weektitel kijk je terug: per oefening wat er gepland stond en wat je deed, met ✓ (gehaald), ↓ (minder sets, herhalingen of gewicht), ↑ (meer) of – (niet gedaan). Een goede training haal je zo terug naar deze week of bewaar je als sjabloon.</p>
    <p><b>Weeknummer.</b> Het plan draagt de kalenderweek waarin het is gemaakt, bijvoorbeeld <i>GC 2026-W45 Full Body A</i> op je toestel.</p>`,
  },
  {
    id: 'persoonlijk', title: 'Man, vrouw en leeftijd',
    html: `<p>Onderzoek laat zien dat mannen en vrouwen <b>procentueel even snel</b> spiermassa en kracht opbouwen; bij het bovenlichaam gaan vrouwen procentueel zelfs iets sneller vooruit (Roberts e.a., 2020, meta-analyse). Mannen beginnen wel hoger, vooral in het bovenlichaam. De spieren, oefeningen en principes zijn voor iedereen gelijk.</p>
    <p>Waar het wél verschil maakt, en wat GymCoach ermee doet:</p>
    <ul>
      <li><b>Herstel tussen sets.</b> Vrouwen herstellen tussen sets meestal sneller (in een studie haalden ze bij korte rust bijna twee keer zoveel herhalingen; bij één set was er geen verschil). <i>GymCoach:</i> rust 20% korter voor vrouwen.</li>
      <li><b>Volume.</b> Vrouwen verdragen per training vaak iets meer volume zonder trager te herstellen. <i>GymCoach:</i> focusoefeningen tot 5 sets in plaats van 4, en basisoefeningen een extra set als de tijd het toelaat (niet in een deload-week).</li>
      <li><b>Maximale hartslag.</b> Voor vrouwen is een eigen formule die beter klopt: Gulati, 206 − 0,88 × leeftijd. Voor mannen en algemeen: Tanaka, 208 − 0,7 × leeftijd. Ken je je echte maximum uit een test, vul die dan in; die gaat altijd voor.</li>
      <li><b>Eigen herstel weegt het zwaarst.</b> De verschillen tussen mensen zijn groter dan die tussen man en vrouw. Daarom kijkt GymCoach ook naar je eigen sets: zakken je herhalingen in latere sets met gemiddeld 20% of meer, dan wordt de rust 25% langer; haal je drie keer op rij in elke set al je herhalingen, dan iets korter (−10%). Rust blijft tussen 30 s (isolatie 20 s) en 180 s.</li>
      <li><b>Leeftijd.</b> Bepaalt de geschatte maximale hartslag, de richtwaarden voor vetpercentage, de VO2max-grenzen en de polsgolfsnelheid. De geboortedatum rekent de leeftijd in de gezondheidsstatus uit op de meetdag; zonder datum geldt het geboortejaar. De AI-coach krijgt je leeftijd en geslacht mee en weet dat krachttraining vanaf ongeveer 50 jaar extra belangrijk is voor botten en spiermassa.</li>
      <li><b>Lichaamsfiguur.</b> De spierkaarten tonen een mannelijk, vrouwelijk of neutraal figuur. Alleen de vorm verschilt.</li>
    </ul>
    <p class="muted small">Bij <i>non-binair</i>, <i>anders</i> of <i>zeg ik liever niet</i> kies je zelf met welke tabel GymCoach rekent (of geen: dan de algemene waarden) en welk figuur je ziet. Wat je kiest, bepaalt alleen deze berekeningen.</p>`,
  },
  {
    id: 'meten', title: 'Hoe GymCoach meet',
    html: `<dl class="explain-dl">
      <dt>Geschat 1RM</dt><dd>Het gewicht dat je één keer zou kunnen tillen, geschat met de formule van Epley: gewicht × (1 + herhalingen ÷ 30). Zo kun je sets met verschillende herhalingen eerlijk vergelijken. Per training telt de beste set.</dd>
      <dt>Volume</dt><dd>Herhalingen × kilo's, opgeteld over alle sets: hoeveel werk je hebt gedaan. GymCoach neemt het volume dat de Gym Monster per set opslaat; bij oefeningen met twee handgrepen tellen beide kanten mee (2 × het gewicht per handgreep). Gewichten en geschat 1RM zijn per handgreep, zoals op het toestel.</dd>
      <dt>Spierkaart</dt><dd>Elke oefening telt mee voor de spiergroepen die hij traint: de hoofdspier als 1 set, meewerkende spieren als ½ set.</dd>
      <dt>Krachtindex</dt><dd>Per spiergroep het geschatte 1RM ten opzichte van de eerste keer in de gekozen periode (= 100). 110 betekent 10% sterker.</dd>
      <dt>Balans</dt><dd>Werksets duwen tegenover trekken, en bovenlichaam tegenover onderlichaam. Rond 1 : 1 is evenwichtig.</dd>
      <dt>Records</dt><dd>Een record is een training waarin een oefening een hoger geschat 1RM haalde dan ooit ervoor.</dd>
      <dt>Vergelijking in het rapport</dt><dd>Met het gemiddelde van de laatste 4 keer dezelfde training (het weeknummer in de naam telt niet mee), of anders je laatste 4 trainingen.</dd>
      <dt>Tijd onder spanning en rust</dt><dd>Uit de tijden die de Gym Monster per herhaling en per pauze opslaat.</dd>
      <dt>Hartslag</dt><dd>Per set van de Gym Monster (met hartslagband); het verloop over de hele training, ook in de rust, komt van Apple Health (Apple Watch). Zones: 50–60% van je maximum herstel, 60–70% basis, 70–80% aeroob, 80–90% drempel, 90%+ maximaal.</dd>
      <dt>Herstel</dt><dd>De herstelscore gebruikt je hartslag in rust uit Apple Health (Apple Watch): het gemiddelde van de laatste 7 dagen tegenover de 4 weken daarvoor. Zijn er minder dan 10 van die dagen, dan de metingen van de Withings-weegschaal. Op Terugkijken en op Lichaam komt de hartslag in rust uit Apple Health zodra er dagen zijn, anders van de weegschaal. 3 slagen hoger: let op; 5 of meer: waarschijnlijk niet hersteld of je wordt ziek.</dd>
      <dt>Lichaam</dt><dd>BMI volgens de WHO. Vetpercentage tegen de tabellen van Gallagher e.a. (2000), naar leeftijd en geslacht. FFMI (vetvrije massa ÷ lengte²), met grenzen per geslacht. Polsgolfsnelheid met grenzen per leeftijd; een hogere waarde betekent stijvere vaten. Gewicht, vet, spiermassa, FFMI, polsgolfsnelheid en ECW/TBW komen van de Withings-weegschaal. ECW/TBW is het water buiten de cellen gedeeld door al het lichaamswater; onder 0,40 is gebruikelijk, daarboven kijk je naar de trend. Hartslag in rust, HRV en VO2max op dezelfde pagina komen van de Apple Watch.</dd>
      <dt>Energie en stappen</dt><dd>Actieve energie uit Apple Health (wat je verbrandt bovenop je rustverbruik); zonder Apple Health de calorieën van je trainingen. Stappendoel standaard 8.000 per dag. Voor wandelen, zwemmen en andere activiteiten stel je op Doel een weekdoel. Het voorstel ernaast komt uit je laatste vier weken in Apple Health, of uit een vaste richtlijn als die meting er nog niet is.</dd>
      <dt>Gezondheidsscore</dt><dd>Een getal van 1,0 tot 10,0 voor jouw geslacht en leeftijd, op Overzicht en op Lichaam. Vier categorieën tellen mee: lichaamssamenstelling, hart en vaten, conditie en herstel, en overig. Elke meting in een categorie telt even zwaar. Gewicht, vet, spiermassa, FFMI, visceraal vet, botpercentage, polsgolfsnelheid, vaatleeftijd, metabole leeftijd, zenuwgezondheid en de verhouding buiten- en totaalwater komen van de Withings-weegschaal, als gemiddelde van de laatste twee wegingen. Rusthartslag en HRV zijn zeven dagen uit Apple Health; VO2max is de laatste schatting van de Apple Watch. Een hogere score is altijd beter. Bij de meting zelf is groen de gezondere richting: een BMI die naar 22 zakt is groen, een BMI die verder van 22 af gaat is rood. Het scoregetal krijgt dezelfde kleur. Dit vat je eigen cijfers samen. Het is geen diagnose.</dd>
    </dl>
    <p class="muted small">Alle waarden zijn schattingen voor je eigen voortgang, geen medische metingen.</p>`,
  },
  {
    id: 'signalen', title: 'Signalen: herstel en bijsturen',
    html: `<p>GymCoach legt gegevens uit verschillende bronnen naast elkaar. Elk signaal staat los weinig vast; samen zeggen ze meer.</p>
    <dl class="explain-dl">
      <dt>Vertraging binnen een set</dt><dd>De Gym Monster bewaart de tijd per herhaling. GymCoach vergelijkt de laatste twee herhalingen met de eerste twee. Tot 25% trager is fris, 25–40% zwaar, vanaf 40% ging de set tot het uiterste. Onderzoek naar snelheidsverlies laat zien dat stoppen rond 20–25% gunstig is voor kracht en dat doorgaan meer spiergroei kan geven (Hickmott e.a. 2022). Haal je alle herhalingen maar werden de laatste 40% of meer trager, dan blijft het gewicht nog één keer gelijk. Bewust trage modi (excentrisch, isokinetisch) tellen niet mee.</dd>
      <dt>Herstelscore</dt><dd>Uit je rusthartslag (Apple Health, de dagwaarde van de Apple Watch; bij minder dan 10 dagen de weegschaal) en HRV (ook Apple Health), de laatste 7 dagen tegenover de 4 weken ervoor, plus de herhalingen die je haalde en de vertraging in je laatste drie trainingen. Rusthartslag schommelt dag op dag zo'n 10% en HRV 10–20% (Buchheit 2014), daarom zegt één afwijkend signaal niets: pas als twee of meer dezelfde kant op wijzen, staat de score op <i>let op</i>, en bij duidelijke afwijkingen op <i>rustig aan</i>. Dan kun je de volgende training lichter maken (10% minder gewicht, een set minder), en komt de deloadweek eerder dan het vaste ritme. HRV laat GymCoach meewegen maar niet alleen beslissen: bij krachttraining gaf trainen op basis van HRV geen extra winst (Bittencourt e.a. 2024); bij duurtraining een klein voordeel (Granero-Gallegos e.a. 2020).</dd>
      <dt>Afvaltempo</dt><dd>Bij afvallen vergelijkt GymCoach je gewichtsverlies per week met je spiermassa (Withings, laatste 4 weken). Atleten die ~0,7% per week afvielen, behielden hun spiermassa; bij ~1,4% per week niet (Garthe e.a. 2011). Ga je sneller dan ~1% per week en daalt je spiermassa, dan krijg je een tip; het plan houdt het trainingsvolume op peil.</dd>
      <dt>Cardio vlak voor krachttraining</dt><dd>Een wandel- of fietsactiviteit die binnen 3 uur vóór een krachttraining eindigde, staat in het rapport. Duur- en krachttraining samen kosten geen spiermassa of maximale kracht, wel wat explosieve kracht als ze in één sessie vallen; met 3 uur of meer ertussen niet (Schumann e.a. 2021).</dd>
      <dt>HRV en VO2max</dt><dd>Van de Apple Watch, via GymCoach Sync of Health Auto Export. HRV (SDNN, in ms) verschilt sterk tussen mensen: vergelijk met jezelf. VO2max is een schatting van de Apple Watch en laat zien wat wandelen en cardio opleveren. De grafiek zet die schatting tegen globale grenzen per leeftijd en geslacht.</dd>
    </dl>
    <p class="muted small">Dit zijn waarnemingen, geen diagnose. Een hogere rusthartslag kan ook op ziekte wijzen; bij klachten: naar de dokter.</p>`,
  },
  {
    id: 'ai', title: 'De AI-coach',
    html: `<p>De AI-coach krijgt je instellingen, leeftijd en geslacht, je recente trainingen, gewicht en activiteiten, en het plan van de regels. Hij mag oefeningen wisselen (alleen uit je eigen catalogus), en sets (2–5), herhalingen (5–20) en gewicht (hooguit 15%) aanpassen. Elke wijziging wordt gecontroleerd en jij kiest wat je overneemt.</p>
    <p><b>Eigen trainingen.</b> De coach ziet welke trainingen je zelf hebt gemaakt, bewerkt of vastgezet, met hun opbouw (supersets, modi, rust, vast gewicht). Daar stelt hij alleen iets voor met een reden, en die voorstellen staan standaard uit. Neem je er een over, dan blijft de opbouw staan: gewicht en herhalingen schuiven per set mee, vast gewicht verandert nooit. Met <i>AI-advies</i> op een training vraag je advies voor alleen die training.</p>
    <p><b>Gezondheidsstatus.</b> Op Overzicht maakt dezelfde koppeling een samenvatting van de metingen over de laatste 4 weken: Withings, de Apple Watch en het trainingsvolume. De opdracht gaat uit van een nuchtere ochtendmeting, vóór het douchen, en van een staande rusthartslag op de weegschaal. Slaapduur gaat niet mee, die bewaart GymCoach niet. Het is geen diagnose en het plan verandert er niet door.</p>
    <p>De coach antwoordt in jouw taal.</p>
    <p>Bij pijn of klachten: huisarts of fysiotherapeut.</p>`,
  },
  {
    id: 'bronnen', title: 'Bronnen',
    html: `<ul class="small">
      <li>Roberts BM e.a. (2020). Sex differences in resistance training: a systematic review and meta-analysis. <i>J Strength Cond Res</i>.</li>
      <li>The effects of biological sex on fatigue during and recovery from resistance exercise. <i>PeerJ</i>.</li>
      <li>Gulati M e.a. (2010). Heart rate response to exercise stress testing in asymptomatic women. <i>Circulation</i>.</li>
      <li>Tanaka H e.a. (2001). Age-predicted maximal heart rate revisited. <i>J Am Coll Cardiol</i>.</li>
      <li>Gallagher D e.a. (2000). Healthy percentage body fat ranges. <i>Am J Clin Nutr</i>.</li>
      <li>Epley B (1985). Poundage chart. <i>Boyd Epley Workout</i>.</li>
      <li>Hickmott LM et al. (2022). The effect of load and volume autoregulation on muscular strength and hypertrophy: a systematic review and meta-analysis. <i>Sports Medicine – Open</i> 8:9.</li>
      <li>Garthe I et al. (2011). Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. <i>Int J Sport Nutr Exerc Metab</i> 21(2).</li>
      <li>Schumann M et al. (2022). Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis. <i>Sports Med</i>.</li>
      <li>Buchheit M (2014). Monitoring training status with HR measures: do all roads lead to Rome? <i>Front Physiol</i>.</li>
      <li>Bittencourt D et al. (2024). Effects of individualized resistance training prescription with heart rate variability in older women. <i>Front Physiol</i>.</li>
      <li>Granero-Gallegos A et al. (2020). HRV-based training for improving VO2max in endurance athletes. <i>Int J Environ Res Public Health</i> 17:7999.</li>
    </ul>`,
  },
];
