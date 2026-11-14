// Uitleg "Hoe GymCoach werkt" (Nederlands): wat de app doet en welke keuzes er achter de berekeningen zitten.
// Elke sectie heeft een id, zodat je vanuit de app direct naar een onderdeel kunt springen.

export default [
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
    <p><b>Zelf aanpassen.</b> Met <i>Bewerken</i> pas je een training aan: sets, herhalingen, gewicht, rust en modus per set (standaard, excentrisch, isokinetisch, constant, spotter), de volgorde, de warming-up en de cooldown. Het figuur en de sets per spiergroep voor de hele week rekenen direct mee. Een bewerkte training is <i>vastgezet</i>: bij een nieuw voorstel blijft hij staan en schuiven de gewichten mee met je progressie, behalve bij oefeningen met <i>vast gewicht</i>. Met <i>Wissen</i> haal je één training uit deze week, met <i>Vervangen</i> zet je er een andere voor in de plaats. De andere trainingen blijven staan.</p>
    <p><b>Supersets.</b> Twee of meer oefeningen om en om, zonder rust ertussen; na elke ronde de rust van de laatste oefening. Op de Gym Monster staan ze als afwisselende stappen (A1, A2, A1, A2 …), omdat een programma geen supersets kent.</p>
    <p><b>Eigen trainingen en sjablonen.</b> Met <i>+ Nieuwe training</i> maak je zelf een training (leeg, als kopie of uit een sjabloon). Een training bewaar je als sjabloon in <i>Trainingen</i>, en die kun je delen met iedereen op je server. Wie een gedeeld sjabloon in zijn plan zet, krijgt gewichten uit zijn eigen historie, of een startgewicht als hij de oefening nog niet deed.</p>
    <p><b>Eén week.</b> Met <i>Week als één plan</i> aan (Instellingen → Training) schuift een oefening naar een latere dag als die hoofdspier nog niet uitgerust is. Boven- en onderlichaam blijven apart, een vastgezette training blijft staan, en het weektotaal per spiergroep blijft gelijk. Op het weekplan zie je het herstel aan het begin van elke training. Zet de schakelaar uit en maak een nieuw weekplan om de vaste dagen terug te krijgen.</p>
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
      <dt>Lichaam</dt><dd>BMI volgens de WHO. Vetpercentage tegen de tabellen van Gallagher e.a. (2000), naar leeftijd en geslacht. FFMI (vetvrije massa ÷ lengte²), met grenzen per geslacht. Polsgolfsnelheid met grenzen per leeftijd; een hogere waarde betekent stijvere vaten. Gewicht, vet, spiermassa, FFMI en polsgolfsnelheid komen van de Withings-weegschaal. Hartslag in rust, HRV en VO2max op dezelfde pagina komen van de Apple Watch.</dd>
      <dt>Energie en stappen</dt><dd>Actieve energie uit Apple Health (wat je verbrandt bovenop je rustverbruik); zonder Apple Health de calorieën van je trainingen. Stappendoel standaard 8.000 per dag.</dd>
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
