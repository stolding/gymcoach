// «Slik fungerer GymCoach» (norsk bokmål): hva appen gjør og valgene bak beregningene.
// Hver seksjon har en id, slik at appen kan hoppe rett til en del. Samme id-er som explain.nl.js.

export default [
  {
    id: 'kort', title: 'Kort sagt',
    html: `<ol>
      <li><b>Hent.</b> GymCoach henter treningsøktene dine fra Speediance-kontoen din: per øvelse sett, repetisjoner, vekter, tider og (hvis du bruker pulsbånd) pulsen din.</li>
      <li><b>Planlegg.</b> Faste regler gjør innstillingene og historikken din om til en ukeplan. KI-coachen (hvis den er satt opp) kan deretter komme med forslag, men bare innenfor grenser, og du bestemmer.</li>
      <li><b>På maskinen.</b> Med ett klikk ligger en treningsøkt på Gym Monster som et program, med vekter, repetisjoner og pause allerede fylt inn.</li>
      <li><b>Se tilbake.</b> En rapport etter hver treningsøkt; pluss statistikk, analyse og fremgang, sammen med Withings-målingene dine og aktivitetene dine fra Apple Health.</li>
    </ol>
    <p>Alt kjører på din egen server. Dataene dine går bare til Speediance, Withings og Apple (som du kobler til selv) og, hvis du bruker KI-coachen, til KI-tjenesten administratoren har valgt.</p>`,
  },
  {
    id: 'plan', title: 'Ukeplanen',
    html: `<p><b>Oppsett.</b> Antall treningsøkter per uke bestemmer fordelingen: 2 eller 3 dager helkropp (A/B/C), 4 dager overkropp/underkropp. Hver treningsøkt fyller faste bevegelsesmønstre (press, trekk, knebøy, hoftehengsel, …) med en øvelse fra maskinens katalog.</p>
    <p><b>Forskrivning per mål</b> (arbeidssett):</p>
    <table class="about-tbl"><thead><tr><td></td><td>Baseøvelse</td><td>Isolasjonsøvelse</td></tr></thead><tbody>
      <tr><td class="muted">Muskelbygging</td><td>3 × 8–12, 90 s pause</td><td>3 × 10–15, 60 s</td></tr>
      <tr><td class="muted">Kombinasjon</td><td>3 × 10–12, 60 s</td><td>3 × 12–15, 45 s</td></tr>
      <tr><td class="muted">Vektnedgang</td><td>3 × 12–15, 45 s</td><td>2 × 15–20, 30 s</td></tr>
      <tr><td class="muted">Kondisjonssirkel</td><td colspan="2">3 × 15–20, lett (60%), 20 s pause</td></tr>
    </tbody></table>
    <p class="muted small">Avansert: ett ekstra sett på baseøvelser. Ny øvelse: to treningsøkter med 2 sett først, for teknikk.</p>
    <p><b>Progresjon</b> (dobbel progresjon): hvis du når toppen av repetisjonsområdet i alle sett, går vekten opp (+2 kg baseøvelse, +1 kg isolasjonsøvelse) og du starter nederst igjen. Hvis du når bunnen, +1 repetisjon. To ganger på rad under målet: −10%.</p>
    <p><b>Deload.</b> Hver så mange treningsuker (justerbart, standard 6) en lettere uke: ett sett færre og 10% lettere. Uker uten trening teller ikke.</p>
    <p><b>Tilbehør.</b> Hvis du ikke bruker et tilbehør (stang, benk, håndtak, tau, belte, ro-/skihåndtak eller matte), slår du det av under Innstillinger → Trening. Øvelser som trenger det, vises ikke lenger i planen din, i bytter eller i forslagene fra KI-coachen. GymCoach utleder hvilket tilbehør en øvelse trenger ut fra navnet (for eksempel <i>Barbell</i>, <i>Rope</i>, <i>Incline</i>, <i>Seated</i>) og øvelsestypen.</p>
    <p><b>Fokus og tid.</b> Fokusområder kommer først og får et ekstra sett så lenge treningsøkten holder seg innenfor tiden du har satt. GymCoach anslår varigheten til 4 s per repetisjon pluss pause.</p>
    <p><b>Rediger selv.</b> Med <i>Rediger</i> endrer du en treningsøkt: sett, repetisjoner, vekt, pause og modus per sett (standard, eksentrisk, isokinetisk, konstant, spotter), rekkefølgen, oppvarmingen og nedtrappingen. Figuren og settene per muskelgruppe for hele uken oppdateres med en gang. En redigert treningsøkt er <i>låst</i>: ved et nytt forslag blir den stående, og vektene følger progresjonen din, unntatt øvelser med <i>fast vekt</i>.</p>
    <p><b>Supersett.</b> To eller flere øvelser vekselvis, uten pause imellom; etter hver runde pausen til den siste øvelsen. På Gym Monster vises de som vekslende steg (A1, A2, A1, A2 …), fordi et program ikke har supersett.</p>
    <p><b>Egne treningsøkter og maler.</b> Med <i>+ Ny treningsøkt</i> bygger du en treningsøkt selv (tom, som kopi eller fra en mal). Du lagrer en treningsøkt som mal under <i>Treningsøkter</i>, og du kan dele den med alle på serveren din. Den som legger en delt mal inn i planen sin, får vekter fra egen historikk, eller en startvekt hvis øvelsen ikke er gjort før.</p>
    <p><b>Tidligere uker.</b> GymCoach tar vare på hver ukeplan. Med pilene ved siden av uketittelen ser du tilbake: per øvelse hva som var planlagt og hva du gjorde, med ✓ (oppnådd), ↓ (færre sett, repetisjoner eller vekt), ↑ (mer) eller – (ikke gjort). En god treningsøkt kan hentes tilbake til denne uken eller lagres som mal.</p>
    <p><b>Ukenummer.</b> Planen bærer kalenderuken den ble laget i, for eksempel <i>GC 2026-W45 Full Body A</i> på maskinen din.</p>`,
  },
  {
    id: 'persoonlijk', title: 'Menn, kvinner og alder',
    html: `<p>Forskning viser at menn og kvinner bygger muskelmasse og styrke <b>like raskt relativt sett</b>; i overkroppen går kvinner til og med litt raskere frem relativt sett (Roberts et al., 2020, metaanalyse). Menn starter høyere, særlig i overkroppen. Musklene, øvelsene og prinsippene er de samme for alle.</p>
    <p>Der det likevel utgjør en forskjell, og hva GymCoach gjør med det:</p>
    <ul>
      <li><b>Restitusjon mellom sett.</b> Kvinner restituerer vanligvis raskere mellom sett (i én studie klarte de nesten dobbelt så mange repetisjoner med kort pause; med ett enkelt sett var det ingen forskjell). <i>GymCoach:</i> 20% kortere pause for kvinner.</li>
      <li><b>Volum.</b> Kvinner tåler ofte litt mer volum per treningsøkt uten å restituere saktere. <i>GymCoach:</i> fokusøvelser opptil 5 sett i stedet for 4, og baseøvelser et ekstra sett når tiden tillater det (ikke i en deload-uke).</li>
      <li><b>Maksimal puls.</b> For kvinner finnes det en egen formel som passer bedre: Gulati, 206 − 0,88 × alder. For menn og generelt: Tanaka, 208 − 0,7 × alder. Hvis du kjenner den virkelige makspulsen din fra en test, legger du den inn; den har alltid forrang.</li>
      <li><b>Din egen restitusjon teller mest.</b> Forskjellene mellom personer er større enn mellom menn og kvinner. Derfor ser GymCoach også på dine egne sett: hvis repetisjonene dine i snitt faller med 20% eller mer i senere sett, blir pausen 25% lenger; hvis du klarer alle repetisjonene i hvert sett tre ganger på rad, litt kortere (−10%). Pausen holder seg mellom 30 s (isolasjonsøvelse 20 s) og 180 s.</li>
      <li><b>Alder.</b> Bestemmer den anslåtte makspulsen og referanseområdene for kroppsfett. KI-coachen får alderen og kjønnet ditt og vet at styrketrening blir ekstra viktig for skjelett og muskelmasse fra omtrent 50 år.</li>
      <li><b>Kroppsfigur.</b> Muskelkartene viser en mannlig, kvinnelig eller nøytral figur. Bare formen er forskjellig.</li>
    </ul>
    <p class="muted small">Med <i>ikke-binær</i>, <i>annet</i> eller <i>ønsker ikke å oppgi</i> velger du selv hvilken tabell GymCoach bruker (eller ingen: da de generelle verdiene) og hvilken figur du ser. Det du velger, påvirker bare disse beregningene.</p>`,
  },
  {
    id: 'meten', title: 'Slik måler GymCoach',
    html: `<dl class="explain-dl">
      <dt>Anslått 1RM</dt><dd>Vekten du kunne løfte én gang, anslått med Epley-formelen: vekt × (1 + repetisjoner ÷ 30). Slik kan du sammenligne sett med ulike repetisjoner på en rettferdig måte. Per treningsøkt teller det beste settet.</dd>
      <dt>Volum</dt><dd>Repetisjoner × kilo, lagt sammen over alle sett: hvor mye arbeid du gjorde. GymCoach bruker volumet Gym Monster lagrer per sett; for øvelser med to håndtak teller begge sider (2 × vekten per håndtak). Vekter og anslått 1RM er per håndtak, som på maskinen.</dd>
      <dt>Muskelkart</dt><dd>Hver øvelse teller for muskelgruppene den trener: hovedmuskelen som 1 sett, støttemuskler som ½ sett.</dd>
      <dt>Styrkeindeks</dt><dd>Per muskelgruppe det anslåtte 1RM sett i forhold til første gang i den valgte perioden (= 100). 110 betyr 10% sterkere.</dd>
      <dt>Balanse</dt><dd>Arbeidssett press mot trekk, og overkropp mot underkropp. Omtrent 1 : 1 er balansert.</dd>
      <dt>Rekorder</dt><dd>En rekord er en treningsøkt der en øvelse nådde et høyere anslått 1RM enn noen gang før.</dd>
      <dt>Sammenligning i rapporten</dt><dd>Med gjennomsnittet av de siste 4 gangene du gjorde den samme treningsøkten (ukenummeret i navnet teller ikke), ellers de siste 4 treningsøktene dine.</dd>
      <dt>Tid under spenning og pause</dt><dd>Fra tidene Gym Monster lagrer per repetisjon og per pause.</dd>
      <dt>Puls</dt><dd>Per sett fra Gym Monster (med pulsbånd); forløpet over hele treningsøkten, også i pausene, kommer fra Apple Health (Apple Watch). Soner: 50–60% av makspulsen din restitusjon, 60–70% basis, 70–80% aerob, 80–90% terskel, 90%+ maksimal.</dd>
      <dt>Restitusjon</dt><dd>Hvilepulsen din de siste 7 dagene sammenlignet med de 4 ukene før. 3 slag høyere: pass på; 5 eller mer: sannsynligvis ikke restituert, eller du er i ferd med å bli syk.</dd>
      <dt>Kropp</dt><dd>BMI ifølge WHO. Kroppsfett mot tabellene til Gallagher et al. (2000), etter alder og kjønn. FFMI (fettfri masse ÷ høyde²): bra fra 17 (menn) eller 14 (kvinner). Muskelmasse og fett kommer fra Withings-vekten.</dd>
      <dt>Energi og skritt</dt><dd>Aktiv energi fra Apple Health (det du forbrenner oppå hvileforbrenningen); uten Apple Health kaloriene fra treningsøktene dine. Skrittmål 8 000 per dag som standard.</dd>
    </dl>
    <p class="muted small">Alle verdier er anslag for din egen fremgang, ikke medisinske målinger.</p>`,
  },
  {
    id: 'signalen', title: 'Signaler: restitusjon og justering',
    html: `<p>GymCoach setter sammen data fra ulike kilder. Hvert signal alene sier lite; sammen sier de mer.</p>
    <dl class="explain-dl">
      <dt>Nedbremsing innenfor et sett</dt><dd>Gym Monster lagrer tiden per repetisjon. GymCoach sammenligner de to siste repetisjonene med de to første. Opptil 25% saktere er friskt, 25–40% hardt, fra 40% gikk settet til grensen. Forskning på hastighetstap viser at det å stoppe rundt 20–25% favoriserer styrke, og at det å gå lenger kan gi mer muskelvekst (Hickmott et al. 2022). Hvis du klarer alle repetisjonene, men de siste var 40% eller mer saktere, blir vekten stående én gang til. Bevisst langsomme modi (eksentrisk, isokinetisk) teller ikke.</dd>
      <dt>Restitusjonsscore</dt><dd>Fra hvilepulsen og HRV (siste 7 dager mot de 4 ukene før), repetisjonene du klarte og nedbremsingen i de tre siste treningsøktene dine. Hvilepulsen varierer omtrent 10% fra dag til dag og HRV 10–20% (Buchheit 2014), så ett avvikende signal betyr ingenting: først når to eller flere peker samme vei, sier scoren <i>pass på</i>, og ved tydelige avvik <i>ta det rolig</i>. Da kan du gjøre neste treningsøkt lettere (10% mindre vekt, ett sett færre), og deload-uken kommer tidligere enn den faste rytmen. HRV teller med, men avgjør aldri alene: i styrketrening ga HRV-styrt trening ingen ekstra fremgang (Bittencourt et al. 2024); i utholdenhetstrening en liten fordel (Granero-Gallegos et al. 2020).</dd>
      <dt>Vektnedgangstakt</dt><dd>Ved vektnedgang sammenligner GymCoach den ukentlige vektnedgangen din med muskelmassen din (Withings, siste 4 uker). Utøvere som gikk ned ~0,7% per uke, beholdt muskelmassen; ved ~1,4% per uke gjorde de det ikke (Garthe et al. 2011). Hvis du går raskere enn ~1% per uke og muskelmassen synker, får du et tips; planen holder treningsvolumet oppe.</dd>
      <dt>Kondisjon rett før styrketrening</dt><dd>En gåtur eller sykkeltur som sluttet innen 3 timer før en styrketreningsøkt, vises i rapporten. Å kombinere utholdenhets- og styrketrening koster ikke muskelmasse eller maksimal styrke, men noe eksplosiv styrke når begge er i samme treningsøkt; ikke med 3 timer eller mer imellom (Schumann et al. 2021).</dd>
      <dt>HRV og VO2max</dt><dd>Fra Apple Watch, via GymCoach Sync eller Health Auto Export. HRV (SDNN, i ms) varierer mye mellom personer: sammenlign med deg selv. VO2max er et anslag fra Apple Watch og viser hva gange og kondisjon gir.</dd>
    </dl>
    <p class="muted small">Dette er observasjoner, ikke en diagnose. En høyere hvilepuls kan også bety sykdom; ved plager, oppsøk lege.</p>`,
  },
  {
    id: 'ai', title: 'KI-coachen',
    html: `<p>KI-coachen får innstillingene, alderen og kjønnet ditt, de siste treningsøktene, vekten og aktivitetene dine, og planen som reglene har laget. Den kan bytte øvelser (bare fra din egen katalog) og justere sett (2–5), repetisjoner (5–20) og vekt (høyst 15%). Hver endring blir kontrollert, og du velger hva du godtar.</p>
    <p><b>Egne treningsøkter.</b> Coachen ser hvilke treningsøkter du har bygget, redigert eller låst selv, med strukturen deres (supersett, modi, pause, fast vekt). Der foreslår den bare endringer med en begrunnelse, og de forslagene er ikke avkrysset som standard. Hvis du godtar ett, blir strukturen stående: vekt og repetisjoner forskyves per sett, en fast vekt endres aldri. Med <i>KI-råd</i> på en treningsøkt ber du om råd bare for den treningsøkten.</p>
    <p>Coachen svarer på språket ditt.</p>
    <p>Ved smerte eller plager: oppsøk lege eller fysioterapeut.</p>`,
  },
  {
    id: 'bronnen', title: 'Kilder',
    html: `<ul class="small">
      <li>Roberts BM et al. (2020). Sex differences in resistance training: a systematic review and meta-analysis. <i>J Strength Cond Res</i>.</li>
      <li>The effects of biological sex on fatigue during and recovery from resistance exercise. <i>PeerJ</i>.</li>
      <li>Gulati M et al. (2010). Heart rate response to exercise stress testing in asymptomatic women. <i>Circulation</i>.</li>
      <li>Tanaka H et al. (2001). Age-predicted maximal heart rate revisited. <i>J Am Coll Cardiol</i>.</li>
      <li>Gallagher D et al. (2000). Healthy percentage body fat ranges. <i>Am J Clin Nutr</i>.</li>
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
