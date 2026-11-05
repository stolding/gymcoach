// Uitleg "Hoe GymCoach werkt": wat de app doet en welke keuzes er achter de berekeningen zitten.
// Elke sectie heeft een id, zodat je vanuit de app direct naar een onderdeel kunt springen.

export const EXPLAIN = [
  {
    id: 'kort', title: 'In het kort',
    html: `<ol>
      <li><b>Ophalen.</b> GymCoach haalt je trainingen op van je Speediance-account: per oefening de sets, herhalingen, gewichten, tijden en (als je een hartslagband draagt) je hartslag.</li>
      <li><b>Plannen.</b> Uit je instellingen en je historie maakt een vaste set regels een weekplan. De AI-coach (als die is ingesteld) mag daarna voorstellen doen, maar alleen binnen grenzen en jij beslist.</li>
      <li><b>Op het toestel.</b> Met één klik staat een training als programma op je Gym Monster, met gewichten, herhalingen en rust al ingevuld.</li>
      <li><b>Terugkijken.</b> Na elke training een rapport; daarnaast statistieken, analyse en voortgang, samen met je metingen van Withings en je activiteiten uit Apple Health.</li>
    </ol>
    <p>Alles draait op je eigen server. Je gegevens gaan alleen naar Speediance, Withings en Apple (die je zelf koppelt) en, als je de AI-coach gebruikt, naar de AI-dienst die de beheerder heeft gekozen.</p>`,
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
    <p><b>Focus en tijd.</b> Focusgebieden komen vooraan en krijgen een extra set zolang de training binnen je ingestelde tijd blijft. GymCoach schat de duur met 4 s per herhaling plus de rust.</p>
    <p><b>Zelf aanpassen.</b> Met <i>Bewerken</i> pas je een training aan: sets, herhalingen, gewicht, rust en modus per set (standaard, excentrisch, isokinetisch, constant, spotter), de volgorde, de warming-up en de cooldown. Het figuur en de sets per spiergroep voor de hele week rekenen direct mee. Een bewerkte training is <i>vastgezet</i>: bij een nieuw voorstel blijft hij staan en schuiven de gewichten mee met je progressie, behalve bij oefeningen met <i>vast gewicht</i>.</p>
    <p><b>Supersets.</b> Twee of meer oefeningen om en om, zonder rust ertussen; na elke ronde de rust van de laatste oefening. Op de Gym Monster staan ze als afwisselende stappen (A1, A2, A1, A2 …), omdat een programma geen supersets kent.</p>
    <p><b>Eigen trainingen en sjablonen.</b> Met <i>+ Nieuwe training</i> maak je zelf een training (leeg, als kopie of uit een sjabloon). Een training bewaar je als sjabloon in <i>Trainingen</i>, en die kun je delen met iedereen op je server. Wie een gedeeld sjabloon in zijn plan zet, krijgt gewichten uit zijn eigen historie, of een startgewicht als hij de oefening nog niet deed.</p>
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
      <li><b>Leeftijd.</b> Bepaalt de geschatte maximale hartslag en de richtwaarden voor vetpercentage. De AI-coach krijgt je leeftijd en geslacht mee en weet dat krachttraining vanaf ongeveer 50 jaar extra belangrijk is voor botten en spiermassa.</li>
      <li><b>Lichaamsfiguur.</b> De spierkaarten tonen een mannelijk, vrouwelijk of neutraal figuur. Alleen de vorm verschilt.</li>
    </ul>
    <p class="muted small">Bij <i>non-binair</i>, <i>anders</i> of <i>zeg ik liever niet</i> kies je zelf met welke tabel GymCoach rekent (of geen: dan de algemene waarden) en welk figuur je ziet. Wat je kiest, bepaalt alleen deze berekeningen.</p>`,
  },
  {
    id: 'meten', title: 'Hoe GymCoach meet',
    html: `<dl class="explain-dl">
      <dt>Geschat 1RM</dt><dd>Het gewicht dat je één keer zou kunnen tillen, geschat met de formule van Epley: gewicht × (1 + herhalingen ÷ 30). Zo kun je sets met verschillende herhalingen eerlijk vergelijken. Per training telt de beste set.</dd>
      <dt>Volume</dt><dd>Sets × herhalingen × kilo's, opgeteld. Een maat voor hoeveel werk je hebt gedaan.</dd>
      <dt>Spierkaart</dt><dd>Elke oefening telt mee voor de spiergroepen die hij traint: de hoofdspier als 1 set, meewerkende spieren als ½ set.</dd>
      <dt>Krachtindex</dt><dd>Per spiergroep het geschatte 1RM ten opzichte van de eerste keer in de gekozen periode (= 100). 110 betekent 10% sterker.</dd>
      <dt>Balans</dt><dd>Werksets duwen tegenover trekken, en bovenlichaam tegenover onderlichaam. Rond 1 : 1 is evenwichtig.</dd>
      <dt>Records</dt><dd>Een record is een training waarin een oefening een hoger geschat 1RM haalde dan ooit ervoor.</dd>
      <dt>Vergelijking in het rapport</dt><dd>Met het gemiddelde van de laatste 4 keer dezelfde training (het weeknummer in de naam telt niet mee), of anders je laatste 4 trainingen.</dd>
      <dt>Tijd onder spanning en rust</dt><dd>Uit de tijden die de Gym Monster per herhaling en per pauze opslaat.</dd>
      <dt>Hartslag</dt><dd>Per set van de Gym Monster (met hartslagband); het verloop over de hele training, ook in de rust, komt van Apple Health (Apple Watch). Zones: 50–60% van je maximum herstel, 60–70% basis, 70–80% aeroob, 80–90% drempel, 90%+ maximaal.</dd>
      <dt>Herstel</dt><dd>Je hartslag in rust van de laatste 7 dagen tegenover de 4 weken daarvoor. 3 slagen hoger: let op; 5 of meer: waarschijnlijk niet hersteld of je wordt ziek.</dd>
      <dt>Lichaam</dt><dd>BMI volgens de WHO. Vetpercentage tegen de tabellen van Gallagher e.a. (2000), naar leeftijd en geslacht. FFMI (vetvrije massa ÷ lengte²): vanaf 17 (mannen) of 14 (vrouwen) goed. Spiermassa en vet komen van de Withings-weegschaal.</dd>
      <dt>Energie en stappen</dt><dd>Actieve energie uit Apple Health (wat je verbrandt bovenop je rustverbruik); zonder Apple Health de calorieën van je trainingen. Stappendoel standaard 8.000 per dag.</dd>
    </dl>
    <p class="muted small">Alle waarden zijn schattingen voor je eigen voortgang, geen medische metingen.</p>`,
  },
  {
    id: 'ai', title: 'De AI-coach',
    html: `<p>De AI-coach krijgt je instellingen, leeftijd en geslacht, je recente trainingen, gewicht en activiteiten, en het plan van de regels. Hij mag oefeningen wisselen (alleen uit je eigen catalogus), en sets (2–5), herhalingen (5–20) en gewicht (hooguit 15%) aanpassen. Elke wijziging wordt gecontroleerd en jij kiest wat je overneemt. Bij pijn of klachten: huisarts of fysiotherapeut.</p>`,
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
    </ul>`,
  },
];
