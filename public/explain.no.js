// «Slik fungerer GymCoach» (norsk bokmål): hva appen gjør og valgene bak beregningene.
// Hver seksjon har en id, slik at appen kan hoppe rett til en del. Samme id-er som explain.nl.js.

export default [
  {
    id: 'starten', title: 'Ny: koble til',
    html: `<p>Tre koblinger setter GymCoach i gang. Speediance trengs for planen og treningsøktene. Vekten og Apple Health kan vente: uten de målingene blir Kropp, helsescoren og aktivitetene tomme.</p>
    <h4>Speediance-konto</h4>
    <ol>
      <li>Gå til <b>Innstillinger → Speediance-konto</b>.</li>
      <li>Fyll inn e-postadressen og passordet til Speediance-kontoen din. I Europa er regionen som regel <b>EU</b>.</li>
      <li>Velg Gym Monster, eller trykk <b>Finn maskinen min</b>.</li>
      <li><b>Lagre og test</b>. GymCoach henter deretter øvelseskatalogen til den maskinen.</li>
    </ol>
    <p>Passordet blir på din egen server. Velg deretter mål, dager og minutter under Trening, og lag den første ukeplanen.</p>
    <h4>Withings-vekt</h4>
    <p>Dette har to deler. Først lager administratoren en tilkobling hos Withings, én gang. Deretter kobler hver bruker sin egen vekt. Nøklene står ikke på vekten og ikke i Withings-appen på telefonen. Withings lager dem på utviklersiden.</p>
    <p><b>Én gang, av administratoren</b></p>
    <ol>
      <li>Gå til <b>developer.withings.com</b> og logg inn med en Withings-konto.</li>
      <li>Åpne <b>Dashboard</b> og velg <b>Create an application</b>. Type: <b>Public API</b>. Gi appen et navn, for eksempel GymCoach.</li>
      <li>Withings viser deretter en <b>Client ID</b> og en <b>Client secret</b>. Det er nøklene. Kopier dem og la siden stå åpen til de er inne i GymCoach.</li>
      <li>I GymCoach: <b>Innstillinger → Withings</b>. Blokken <b>Withings-app</b> ser du bare som administrator.</li>
      <li>Ved Callback-URL trykker du <b>Fyll inn adressen til denne siden</b>. Det kommer en adresse som slutter på <code>/api/withings/callback</code>. Trykk <b>Kopier</b> og lim den inn i callback-feltet hos Withings. Den må være helt lik.</li>
      <li>Lim Client ID og Client secret inn i GymCoach og trykk <b>Lagre</b>.</li>
    </ol>
    <p><b>Deretter, av hver bruker</b>, også administratoren</p>
    <ol>
      <li>Bli på <b>Innstillinger → Withings</b>.</li>
      <li>Trykk den oransje knappen <b>Koble til Withings</b>. En Withings-side åpnes.</li>
      <li>Logg inn med Withings-kontoen til vekten, samme konto som i Withings-appen på telefonen. Gi tilgang.</li>
      <li>Du ser <b>Withings koblet til</b>. Lukk fanen. I GymCoach står det deretter <b>koblet til</b>, og målingene er hentet.</li>
    </ol>
    <p>Mangler knappen <b>Koble til Withings</b>, har administratoren ikke lagret Client ID og Client secret ennå. På selve vekten stiller du ingenting. Vei deg som vanlig, helst fastende, om morgenen, før du dusjer. Hvilepulsen på vekten er en stående øyeblikksmåling.</p>
    <h4>Apple Health</h4>
    <p>Tilkoblingsnøkkelen lager du selv i GymCoach. Den finner du ingen andre steder. Den begynner med <code>gch_</code> og vises bare én gang. Mister du den, trykk <b>Ny nøkkel</b>. Den gamle virker da ikke lenger.</p>
    <p><b>På datamaskinen, i GymCoach</b></p>
    <ol>
      <li>Gå til <b>Innstillinger → Apple Health</b>.</li>
      <li>Trykk <b>Lag tilkoblingsnøkkel</b>.</li>
      <li>En grønn boks vises med to linjer. Linjen <b>URL</b> slutter på <code>/api/health/ingest</code>. Hele den linjen limer du ikke inn på iPhone. Du trenger adressen til GymCoach, uten den slutten. For eksempel <code>https://gymcoach.stolding.com</code>, eller hjemme <code>http://192.168.1.50:8765</code>.</li>
      <li>Den andre linjen er nøkkelen. Trykk <b>Kopier nøkkel</b> og ta vare på den til den står på iPhone.</li>
    </ol>
    <p><b>På iPhone, i GymCoach Sync</b></p>
    <p>Appen har to adresser. De må du ikke blande. Knappene på iPhone er på nederlandsk.</p>
    <ol>
      <li>Installer <b>GymCoach Sync</b> via TestFlight og åpne appen.</li>
      <li>For å se planen logger du inn med adressen til GymCoach-siden, brukernavnet ditt og passordet til GymCoach. Det er ikke tilkoblingsnøkkelen.</li>
      <li>For å sende Apple Health: fane <b>Meer</b> → <b>Synchroniseren</b>. Fyll inn samme adresse der, uten <code>/api/health/ingest</code>. I feltet <b>Koppelsleutel</b> limer du inn nøkkelen som begynner med <code>gch_</code>. Trykk <b>Toon</b> hvis du vil sjekke at den stemmer.</li>
      <li>Trykk <b>Test verbinding</b>. iPhone spør om tilgang til Helse. Gi tilgang til det GymCoach ber om: økter, puls, skritt, energi, distanse, hvilepuls, HRV, VO2max og kosthold.</li>
      <li>Trykk deretter én gang på <b>Volledige historie versturen</b>, slik at eldre turer og dager kommer med. Nye data går deretter av seg selv, høyst én gang i timen.</li>
    </ol>
    <p><b>Automatisch alleen thuis</b> betyr: bare på wifi, og bare når serveren din er tilgjengelig. Slå det av hvis du bruker GymCoach over internett. <b>Test verbinding</b> og <b>Nu synchroniseren</b> virker likevel.</p>
    <p>GymCoach Sync leser økter (gange, sykling og resten), puls, skritt, aktiv energi, distanse, hvilepuls, HRV, VO2max og kosthold. Styrkeøkter som Speediance selv skriver til Apple Health, hopper GymCoach over, slik at ingenting telles dobbelt. Heller en annen app: under Innstillinger → Apple Health står <b>Eller: sett opp Health Auto Export</b>, der samme URL og nøkkel skal inn. Nøkkelen hører i headeren <code>Authorization</code>, som <code>Bearer</code> etterfulgt av nøkkelen.</p>
    <p>Hvilepulsen fra Apple Watch er dagsverdien. GymCoach bruker den når det finnes nok dager; ellers målingen fra vekten.</p>`,
  },
  {
    id: 'kort', title: 'Kort sagt',
    html: `<ol>
      <li><b>Hent.</b> GymCoach henter treningsøktene dine fra Speediance-kontoen din: per øvelse sett, repetisjoner, vekter, tider og (hvis du bruker pulsbånd) pulsen din.</li>
      <li><b>Planlegg.</b> Faste regler gjør innstillingene og historikken din om til en ukeplan. KI-coachen (hvis den er satt opp) kan deretter komme med forslag, men bare innenfor grenser, og du bestemmer.</li>
      <li><b>På maskinen.</b> Med ett klikk ligger en treningsøkt på Gym Monster som et program, med vekter, repetisjoner og pause allerede fylt inn.</li>
      <li><b>Se tilbake.</b> En rapport etter hver treningsøkt; pluss Trening og Tilbakeblikk, sammen med Withings-målingene dine og aktivitetene dine fra Apple Health.</li>
    </ol>
    <p>Alt kjører på din egen server. Dataene dine går bare til Speediance, Withings og Apple (som du kobler til selv) og, hvis du bruker KI-coachen, til KI-tjenesten administratoren har valgt.</p>`,
  },
  {
    id: 'schermen', title: 'Skjermene',
    html: `<p>Skjermbildene er av en eksempelbruker, Sam Demo. Treninger, vekt og Apple Health er oppdiktet. På oversikten av en fane står oransje nummer. Deretter kommer et nærbilde av hver blokk. Bildene viser den nederlandske appen.</p>
    <h4>Oversikt</h4>
    <p>Dette er startsiden. En hilsen øverst, deretter blokkene under hverandre.</p>
    <img class="guide-shot" src="/guide/overzicht.png" alt="Oversikten til Sam Demo, med et nummer på hver blokk">
    <ol>
      <li><b>Hilsen.</b> Dato, navnet ditt og et tips, for eksempel en rekord eller hvor mange treninger som fortsatt er åpne denne uken.</li>
      <li><b>Restitusjon og poeng.</b> Til venstre om du er uthvilt (hvilepuls, HRV, fullførte repetisjoner). Til høyre helsepoengene fra 0 til 10, høyere er bedre, med linjen over ukene.</li>
      <li><b>Muskelrestitusjon.</b> Figuren og en linje per muskelgruppe. Under 20 % utmattelse er grønt, deretter går fargen via oransje mot rødt. Over 100 % forblir rødt. Knappene slår en muskelgruppe av eller på.</li>
      <li><b>Neste trening.</b> Den neste treningen som fortsatt er åpen, med beregnet tid.</li>
      <li><b>Ukemål.</b> Ringen teller øktene i planen, også en gåtur. Ved ukemålet er sirkelen full. Gjør du mer, går en lysere oransje ring langs den ytre halvdelen, til hele planen er full.</li>
      <li><b>Rekke.</b> Hvor mange uker på rad du nådde ukemålet.</li>
      <li><b>Volum.</b> Kilo denne uken, sammenlignet med forrige uke.</li>
      <li><b>Minutter.</b> Treningstid og kcal denne uken.</li>
      <li><b>Kropp.</b> Siste vekt, fettprosent og retningen de siste ukene.</li>
      <li><b>Helsestatus.</b> En tekst fra KI-coachen om de siste fire ukene. Uten KI-coach står det «Maak status» her.</li>
      <li><b>Mål.</b> Om du ligger på skjema, med streken for dagens kcal og protein. Knappen åpner fanen Mål.</li>
      <li><b>Styrke.</b> Beregnet 1RM for de tyngste øvelsene de siste fire ukene, med en liten linje.</li>
      <li><b>Rekorder.</b> Nye rekorder de siste fjorten dagene.</li>
      <li><b>Kalender.</b> Åtte uker. En rute er en treningsdag; fargen er minuttene den dagen. Pek på en uke for ukessummen, klikk en dag for øvelsene.</li>
      <li><b>Planen denne uken.</b> Figuren viser utmattelse: under 20 % grønt, deretter via oransje mot rødt, over 100 % rødt. Ved siden av antall treninger, arbeidssettene og de tyngste muskelgruppene.</li>
    </ol>
    <img class="guide-shot" src="/guide/overzicht-herstel.png" alt="Restitusjon til venstre og helsepoengene til høyre">
    <p class="guide-cap muted small">Restitusjon og poeng ved siden av hverandre. Grønt betyr at ingenting står imot. Poengene nevner hva som telte, her fettprosent og BMI.</p>
    <img class="guide-shot" src="/guide/overzicht-spieren.png" alt="Muskelrestitusjon med figur og linjer">
    <p class="guide-cap muted small">Muskelrestitusjon. Figuren er standen nå. Linjene er restitusjon per dag.</p>
    <img class="guide-shot" src="/guide/overzicht-volgende.png" alt="Neste trening og ukeringen">
    <p class="guide-cap muted small">Neste trening til venstre, ringen for ukemålet til høyre.</p>
    <img class="guide-shot" src="/guide/overzicht-midden.png" alt="Fliser, helsestatus og mål">
    <p class="guide-cap muted small">De fire flisene, deretter helsestatusen og sammendraget av målet.</p>
    <img class="guide-shot" src="/guide/overzicht-kracht.png" alt="Styrke og rekorder">
    <p class="guide-cap muted small">Styrke til venstre, rekorder til høyre.</p>
    <img class="guide-shot" src="/guide/overzicht-kalender.png" alt="Treningskalender og planen for denne uken">
    <p class="guide-cap muted small">Kalender til venstre, planen for denne uken til høyre.</p>
    <h4>Plan</h4>
    <p>Her ligger uken som går til Gym Monster. Du endrer den bare på datamaskinen.</p>
    <img class="guide-shot" src="/guide/plan.png" alt="Fanen Plan for Sam Demo">
    <ol>
      <li><b>Topp og knapper.</b> Uken, pilene til en eldre uke, og knappene for en ny trening, et nytt forslag og KI-coachen.</li>
      <li><b>Muskler og tid.</b> Foran og bak. Listen ved siden av er planlagt tid og sett per muskelgruppe. Klikk en gruppe for å se den på figuren.</li>
      <li><b>Treninger.</b> Ett kort per dag: navn, minutter, øvelser, og om den allerede er gjort. Utviding viser sett og vekter. Under sender du den til apparatet, redigerer den eller bytter den ut.</li>
      <li><b>Maler.</b> Treninger du lagrer selv, og treninger som er delt på denne serveren.</li>
      <li><b>Programmer.</b> Det som allerede ligger på Gym Monster-kontoen din. Listen henter du med Vis programmer.</li>
    </ol>
    <img class="guide-shot" src="/guide/plan-spieren.png" alt="Figuren og muskellisten for uken">
    <p class="guide-cap muted small">Ukeoversikten: figuren og fordelingen på muskelgruppene.</p>
    <img class="guide-shot" src="/guide/plan-sessies.png" alt="Tre treningskort, to av dem allerede gjort">
    <p class="guide-cap muted small">Dagene i uken. En fullført økt har en heltrukken grønn kant. En stolpe under målet viser om du gikk forbi det: den ekstra delen er lysere. En uteaktivitet som er i gang men ikke har nådd ukemålet, har en stiplet oransje kant. Kardio ute har ikke et program på apparatet; aktiviteten kommer fra Apple Health.</p>
    <h4>Mål</h4>
    <p>Det du spiser mot det som passer målet. Vekten selv blir under Kropp.</p>
    <img class="guide-shot" src="/guide/doel.png" alt="Fanen Mål for Sam Demo">
    <ol>
      <li><b>Mål og stand.</b> De beregnede kcal og proteinet, og om dagen allerede er der.</li>
      <li><b>Sett et mål.</b> Kropp (kilo og uker), styrke per muskelgruppe, skritt per dag og aktiviteter per uke. Lagring lar målet begynne på nytt.</li>
      <li><b>Vekt.</b> Målingene dine og den rette linjen til målvekten.</li>
      <li><b>Inntak.</b> Det du spiste, mot målkcal den dagen. Tidligere dager bruker den ekte aktiviteten fra Apple Health. I dag blir snittet av 7 dager, og det går opp når en trening er planlagt.</li>
      <li><b>Styrke.</b> Indeksen for den valgte muskelgruppen, her ryggen, mot linjen for styrkemålet.</li>
      <li><b>Dager.</b> En tabell per dag: trening, skritt, inntak og om det holdt seg innenfor målet.</li>
    </ol>
    <img class="guide-shot" src="/guide/doel-formulier.png" alt="Skjemaet for å sette et mål">
    <p class="guide-cap muted small">Skjemaet. Skritt og aktiviteter står under; dem ser du på hele siden ovenfor.</p>
    <h4>Kropp</h4>
    <p>Vekten og sammensetningen. Ingen treningsgraf.</p>
    <img class="guide-shot" src="/guide/lichaam.png" alt="Fanen Kropp for Sam Demo">
    <ol>
      <li><b>Tittel.</b> Kroppsvekt.</li>
      <li><b>Vekt.</b> Om Withings er koblet til, og en knapp for å legge inn en måling selv.</li>
      <li><b>Helsepoeng.</b> Samme poengsum som på Oversikt, her med kategoriene kropp, hjerte, kondisjon og annet.</li>
      <li><b>Sammensetning.</b> Fliser for vekt, fett, muskelmasse og de andre verdiene fra vekten, med en graf. Grønt eller rødt følger om poengsummen blir bedre eller dårligere, ikke om tallet steg. Dra et rektangel over grafen for å zoome inn på den perioden; dobbeltklikk eller datoknappen viser den valgte perioden igjen.</li>
      <li><b>Målinger.</b> Listen, sammenfoldet. Åpne den for hver veiedag.</li>
    </ol>
    <h4>Trening</h4>
    <p>Det du gjorde på Gym Monster. Klikk en rad for øvelser, sett og vekter.</p>
    <img class="guide-shot" src="/guide/training.png" alt="Fanen Trening for Sam Demo">
    <ol>
      <li><b>Tittel.</b> Trening.</li>
      <li><b>Grafer.</b> Tre ved siden av hverandre: treninger per uke, volum per uke og minutter per uke.</li>
      <li><b>Treninger.</b> Tabellen. En rad åpner rapporten for den treningen.</li>
      <li><b>Per øvelse.</b> Velg en øvelse. Grafen er utviklingen i beregnet 1RM.</li>
    </ol>
    <h4>Tilbakeblikk</h4>
    <p>Alt for en periode du velger øverst til høyre. Utskrift og PDF bruker samme periode. Siden er lang; numrene går ovenfra og ned.</p>
    <img class="guide-shot" src="/guide/terugkijken.png" alt="Fanen Tilbakeblikk for Sam Demo">
    <ol>
      <li><b>Topp.</b> Perioden, pluss Skriv ut og PDF.</li>
      <li><b>Over årene.</b> Alle år med data, uavhengig av den valgte perioden. En stolpe er en måned, uten dag. Du velger stolpene (treningsminutter, antall treninger eller volum) og linjen (vekt, muskelmasse eller fett %). Mørkere når måneden lå lavere enn din høyeste måned. Volum er bare Gym Monster.</li>
      <li><b>Tall.</b> Fliser for perioden: treninger, per uke, tid, kcal, ukerekke, favorittdag, volum, sett, repetisjoner per sett, tyngste vekt, rekorder og muskelgrupper.</li>
      <li><b>Kardio.</b> Aktiviteter fra Apple Health i denne perioden.</li>
      <li><b>Balanse og masse.</b> Fordelingen av volumet til venstre, muskelmasse mot treningsvolumet til høyre.</li>
      <li><b>Styrke.</b> Indeksen per muskelgruppe. 100 er starten av perioden. En prikk slår en gruppe av eller på.</li>
      <li><b>Kilometer og skritt.</b> Kilometer per uke og skritt per dag.</li>
      <li><b>Per muskelgruppe.</b> Volum, sett og det beste beregnede 1RM.</li>
      <li><b>Sett per uke.</b> En stolpe per muskelgruppe. Grønt ligger i retningslinjen for nybegynnere, omtrent 6 til 12 arbeidssett.</li>
      <li><b>Detalj.</b> De samme muskelgruppene i en tabell, per uke.</li>
      <li><b>Per øvelse.</b> Volum og den tyngste vekten per øvelse. Progresjon er endringen i beregnet 1RM mellom de to siste ukene du gjorde øvelsen. Hver uke bruker medianen av øktene.</li>
      <li><b>Mønstre.</b> Hvilke bevegelsesmønstre (press, trekk, knebøy) du gjorde.</li>
      <li><b>Kalender.</b> De samme åtte ukene som på Oversikt, for den valgte perioden.</li>
      <li><b>Når.</b> Hvilke dager og timer du trener. Avkrysningen teller med gange og sykling.</li>
      <li><b>Restitusjon og energi.</b> Om belastningen passer restitusjonen, og forbrent energi ved siden av vekten.</li>
    </ol>
    <h4>Innstillinger</h4>
    <p>Menyen til venstre, den åpne delen til høyre. Sam Demo er ikke administrator, så KI-coach og Brukere mangler. De to ser du bare som administrator.</p>
    <img class="guide-shot" src="/guide/instellingen.png" alt="Innstillinger, med Speediance-kontoen åpen">
    <ul>
      <li><b>Speediance-konto.</b> E-post, passord, region og Gym Monster. Lagre og test henter katalogen. Finn maskinen min velger modellen.</li>
      <li><b>Trening.</b> Mål, dager, minutter, erfaring, deload, oppvarming, nedkjøling og om uken er én plan.</li>
      <li><b>Kropp og mål.</b> Kjønn, fødselsår, fødselsdato, maksimal puls, figur og høyde. De styrer grafene og poengsummen.</li>
      <li><b>Apple Health.</b> Her lager du tilkoblingsnøkkelen. Hvordan det gjøres, står under Ny: koble til.</li>
      <li><b>Withings.</b> Knappen Koble til Withings. Bare administratoren fyller inn Client ID.</li>
      <li><b>E-post.</b> Adressen din, og om du vil ha en PDF etter en trening. Administratoren setter opp e-postserveren.</li>
      <li><b>Synk og katalog.</b> Når siste synkronisering var, og hvor mange øvelser det finnes for maskinen din.</li>
      <li><b>Håndbok.</b> Denne teksten.</li>
      <li><b>Vilkår.</b> Teksten du godtar ved første start.</li>
      <li><b>Om GymCoach.</b> Versjon og lisens.</li>
    </ul>`,
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
    <p><b>Tilbehør.</b> Hvis du ikke bruker et tilbehør (stang, benk, håndtak, tau, belte, ro-/skihåndtak eller matte), slår du det av under Innstillinger → Trening. Øvelser som trenger det, vises ikke lenger i planen din, i bytter eller i forslagene fra KI-coachen. GymCoach utleder hvilket tilbehør en øvelse trenger ut fra navnet (for eksempel <i>Barbell</i>, <i>Rope</i>, <i>Incline</i>, <i>Seated</i>) og øvelsestypen. I velgeren filtrerer du listen på det utstyret. Ingen valg viser alt; flere valg viser øvelser som bruker minst ett av dem.</p>
    <p><b>Fokus og tid.</b> Fokusområder kommer først og får et ekstra sett så lenge treningsøkten holder seg innenfor tiden du har satt. GymCoach anslår varigheten til 4 s per repetisjon pluss pause. Når du lager en plan, kan du valgfritt legge korte økter på dagene mellom de vanlige: én muskelgruppe, lettere, og ikke hovedmuskelen i økten før eller etter.</p>
    <p><b>Oppvarming og nedtrapping.</b> De kommer fra oppvarmings- og tøyeøvelsene i katalogen, tilpasset over- eller underkropp. Hver økt og hver uke får et annet utvalg, så det ikke er de samme øvelsene hver gang. I Rediger kan du legge til eller fjerne øvelser eller endre sekundene, og På nytt velger et annet utvalg. Lagre beholder det på denne økten.</p>
    <p><b>Rediger selv.</b> Med <i>Rediger</i> endrer du en treningsøkt: sett, repetisjoner, vekt, pause og modus per sett (standard, eksentrisk, isokinetisk, konstant, spotter), rekkefølgen, oppvarmingen og nedtrappingen. Figuren og settene per muskelgruppe for hele uken oppdateres med en gang. En redigert treningsøkt er <i>låst</i>: ved et nytt forslag blir den stående, og vektene følger progresjonen din, unntatt øvelser med <i>fast vekt</i>. Med <i>Slett</i> tar du én økt ut av denne uken, med <i>Erstatt</i> setter du en annen i stedet. De andre øktene blir. Du kan også legge inn en gåtur, en sykkeltur, svømming, padel eller en annen aktivitet.</p>
    <p><b>Supersett.</b> To eller flere øvelser vekselvis, uten pause imellom; etter hver runde pausen til den siste øvelsen. På Gym Monster vises de som vekslende steg (A1, A2, A1, A2 …), fordi et program ikke har supersett.</p>
    <p><b>Egne treningsøkter og maler.</b> Med <i>+ Ny treningsøkt</i> bygger du en treningsøkt selv (tom, som kopi eller fra en mal). Du lagrer en treningsøkt som mal under <i>Treningsøkter</i>, og du kan dele den med alle på serveren din. Den som legger en delt mal inn i planen sin, får vekter fra egen historikk, eller en startvekt hvis øvelsen ikke er gjort før.</p>
    <p><b>Én uke.</b> Med <i>Uke som én plan</i> på (Innstillinger → Trening) flyttes en øvelse til en senere dag når hovedmuskelen ikke er uthvilt. Over- og underkropp holdes fra hverandre, en låst økt blir stående, og ukesummen per muskelgruppe blir den samme. Planen viser restitusjonen ved starten av hver økt. Når du lager en ny ukeplan, velger du ukedag og tidspunkt for hver økt. Restitusjonen går som en stolpe gjennom hele uken, i blokker på 6 timer. Har du allerede gjort en øvelse, teller den ekte vekten, ikke bare planen. En knapp bytter mellom en gradvis fargeovergang og en stabel. Valget blir lagret. En hvit linje står på øyeblikket nå: riktig dag, riktig blokk på 6 timer, og stedet inne i blokken. Den samme linjen står også i GymCoach Sync. Dra en prikk i stolpen til en annen blokk: de andre øktene den dagen følger med, og restitusjonen regnes med en gang på nytt. Slå av bryteren og lag en ny ukeplan for å få de faste dagene tilbake.</p>
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
      <li><b>Alder.</b> Bestemmer den anslåtte makspulsen, referanseområdene for kroppsfett, VO2max-grensene og pulsbølgehastigheten. Fødselsdatoen setter alderen i helsestatusen på måledagen; uten dato gjelder fødselsåret. KI-coachen får alderen og kjønnet ditt og vet at styrketrening blir ekstra viktig for skjelett og muskelmasse fra omtrent 50 år.</li>
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
      <dt>Sammenligning i rapporten</dt><dd>Med gjennomsnittet av de siste 4 gangene du gjorde den samme økten på Gym Monster (ukenummeret i navnet teller ikke), ellers de siste 4 treningsøktene dine. En gåtur samme dag teller ikke.</dd>
      <dt>Årsoversikt</dt><dd>Under Tilbakeblikk åpner Årsoversikt en PDF for de siste 52 ukene: stolper for helsescore, vekt, øvelser og minutter per uke, og økter stablet etter type. Scoren står til neste måling, så du ser endringen gjennom året. Gym Monster og øvrig idrett. Pluss helsescoren og de viktigste tallene. Én side, klar til utskrift.</dd>
      <dt>Tid under spenning og pause</dt><dd>Fra tidene Gym Monster lagrer per repetisjon og per pause.</dd>
      <dt>Puls</dt><dd>Per sett fra Gym Monster (med pulsbånd); forløpet over hele treningsøkten, også i pausene, kommer fra Apple Health (Apple Watch). Soner: 50–60% av makspulsen din restitusjon, 60–70% basis, 70–80% aerob, 80–90% terskel, 90%+ maksimal.</dd>
      <dt>Restitusjon</dt><dd>Restitusjonsscoren bruker hvilepulsen din fra Apple Health (Apple Watch): gjennomsnittet av de siste 7 dagene mot de 4 ukene før. Er det færre enn 10 slike dager, brukes Withings-vekten. I Tilbakeblikk og under Kropp kommer hvilepulsen fra Apple Health så snart det finnes dager, ellers fra vekten. 3 slag høyere: pass på; 5 eller mer: sannsynligvis ikke restituert, eller du er i ferd med å bli syk.</dd>
      <dt>Kropp</dt><dd>BMI ifølge WHO. Kroppsfett mot tabellene til Gallagher et al. (2000), etter alder og kjønn. FFMI (fettfri masse ÷ høyde²), med grenser etter kjønn. Pulsbølgehastighet med grenser etter alder; en høyere verdi betyr stivere årer. Vekt, fett, muskelmasse, FFMI, pulsbølgehastighet og ECW/TBW kommer fra Withings-vekten. ECW/TBW er vannet utenfor cellene delt på alt kroppsvann; under 0,40 er vanlig, og over det følger du trenden. Hvilepuls, HRV og VO2max på samme side kommer fra Apple Watch.</dd>
      <dt>Energi og skritt</dt><dd>Aktiv energi fra Apple Health (det du forbrenner oppå hvileforbrenningen); uten Apple Health kaloriene fra treningsøktene dine. Skrittmål 8 000 per dag som standard. For gange, svømming og andre aktiviteter setter du et ukemål under Mål. I ukeplanen hører aktiviteten til hele uken, ikke til én dag og ett klokkeslett. Forslaget ved siden av kommer fra de siste fire ukene i Apple Health, eller fra en fast retningslinje når den målingen ikke er der ennå.</dd>
      <dt>Helsescore</dt><dd>Et tall fra 1,0 til 10,0 for kjønn og alder, på Oversikt og under Kropp. Fire kategorier teller: kroppssammensetning, hjerte og årer, kondisjon og restitusjon, og annet. Hver måling i en kategori teller likt. Vekt, fett, muskelmasse, FFMI, visceralt fett, beinprosent, pulsbølgehastighet, karalder, metabolsk alder, nervehelse og forholdet mellom ekstracellulært vann og totalt kroppsvann kommer fra Withings-vekten, som gjennomsnitt av de to siste veiingene. Hvilepuls og HRV er sju dager fra Apple Health; VO2max er det siste anslaget fra Apple Watch. En høyere score er alltid bedre. For selve målingen er grønt den sunnere retningen: en BMI som går mot 22 er grønn, en BMI som går lenger fra 22 er rød. Scoretallet får samme farge. Dette oppsummerer dine egne tall. Det er ingen diagnose.</dd>
    </dl>
    <p class="muted small">Alle verdier er anslag for din egen fremgang, ikke medisinske målinger.</p>`,
  },
  {
    id: 'signalen', title: 'Signaler: restitusjon og justering',
    html: `<p>GymCoach setter sammen data fra ulike kilder. Hvert signal alene sier lite; sammen sier de mer.</p>
    <dl class="explain-dl">
      <dt>Nedbremsing innenfor et sett</dt><dd>Gym Monster lagrer tiden per repetisjon. GymCoach sammenligner de to siste repetisjonene med de to første. Opptil 25% saktere er friskt, 25–40% hardt, fra 40% gikk settet til grensen. Forskning på hastighetstap viser at det å stoppe rundt 20–25% favoriserer styrke, og at det å gå lenger kan gi mer muskelvekst (Hickmott et al. 2022). Hvis du klarer alle repetisjonene, men de siste var 40% eller mer saktere, blir vekten stående én gang til. Bevisst langsomme modi (eksentrisk, isokinetisk) teller ikke.</dd>
      <dt>Restitusjonsscore</dt><dd>Fra hvilepulsen (Apple Health, dagsverdien fra Apple Watch; ved færre enn 10 dager vekten) og HRV (også Apple Health), de siste 7 dagene mot de 4 ukene før, pluss repetisjonene du klarte og nedbremsingen i de tre siste treningsøktene dine. Hvilepulsen varierer omtrent 10% fra dag til dag og HRV 10–20% (Buchheit 2014), så ett avvikende signal betyr ingenting: først når to eller flere peker samme vei, sier scoren <i>pass på</i>, og ved tydelige avvik <i>ta det rolig</i>. Da kan du gjøre neste treningsøkt lettere (10% mindre vekt, ett sett færre), og deload-uken kommer tidligere enn den faste rytmen. HRV teller med, men avgjør aldri alene: i styrketrening ga HRV-styrt trening ingen ekstra fremgang (Bittencourt et al. 2024); i utholdenhetstrening en liten fordel (Granero-Gallegos et al. 2020).</dd>
      <dt>Vektnedgangstakt</dt><dd>Ved vektnedgang sammenligner GymCoach den ukentlige vektnedgangen din med muskelmassen din (Withings, siste 4 uker). Utøvere som gikk ned ~0,7% per uke, beholdt muskelmassen; ved ~1,4% per uke gjorde de det ikke (Garthe et al. 2011). Hvis du går raskere enn ~1% per uke og muskelmassen synker, får du et tips; planen holder treningsvolumet oppe.</dd>
      <dt>Kondisjon rett før styrketrening</dt><dd>En gåtur eller sykkeltur som sluttet innen 3 timer før en styrketreningsøkt, vises i rapporten. Å kombinere utholdenhets- og styrketrening koster ikke muskelmasse eller maksimal styrke, men noe eksplosiv styrke når begge er i samme treningsøkt; ikke med 3 timer eller mer imellom (Schumann et al. 2021).</dd>
      <dt>HRV og VO2max</dt><dd>Fra Apple Watch, via GymCoach Sync eller Health Auto Export. HRV (SDNN, i ms) varierer mye mellom personer: sammenlign med deg selv. VO2max er et anslag fra Apple Watch og viser hva gange og kondisjon gir. Grafen setter anslaget mot grove grenser etter alder og kjønn.</dd>
    </dl>
    <p class="muted small">Dette er observasjoner, ikke en diagnose. En høyere hvilepuls kan også bety sykdom; ved plager, oppsøk lege.</p>`,
  },
  {
    id: 'ai', title: 'KI-coachen',
    html: `<p>KI-coachen går gjennom planen for neste uke. Den sammenligner den med de siste ukene, det du fikk til, trenden og restitusjonen. Den kan bare bytte en øvelse fra katalogen din, eller foreslå passformen: balanse (en øvelse til en annen dag), en øvelse som går igjen, lengden, og oppvarming eller nedtrapping. Vekt og repetisjoner blir i appen. Du ser forskjellen og krysser av det du vil ta med. Er coachen av, eller avkrysningen ved et nytt forslag av, blir den ikke spurt.</p>
    <p><b>Egne treningsøkter.</b> Coachen ser hvilke økter du har bygget, redigert eller låst selv. Der foreslår den bare et bytte, med en begrunnelse, og det er ikke avkrysset som standard. Den fjerner eller flytter ikke øvelser der. Med <i>KI-råd</i> på en økt ber du om råd bare for den økten.</p>
    <p><b>Helsestatus.</b> Under Oversikt lager den samme koblingen et sammendrag av målingene de siste 4 ukene: Withings, Apple Watch og treningsvolum. Oppdraget forutsetter en fastende morgenmåling, før dusjen, og en stående hvilepuls på vekten. Søvnlengde følger ikke med; GymCoach lagrer den ikke. Det er ingen diagnose, og planen endres ikke.</p>
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
