/**
 * Bron van de brochure (nl, en, de). Schrijft HTML; tools/brochure-render.ps1
 * maakt daar de pagina-PNG's en de drie PDF's van.
 *
 *   node tools/brochure-build.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'documentatie', 'brochure');
const logo = '../../public/logo.svg';

const css = `
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #101114; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #f3f1ec; }
  .page {
    width: 794px; height: 1123px; overflow: hidden; position: relative;
    background: #101114; padding: 40px 42px 50px;
    page-break-after: always; break-after: page;
  }
  .kicker { color: #ff7a2e; font-weight: 700; letter-spacing: .12em; font-size: 13px; text-transform: uppercase; }
  h1 { font-size: 38px; line-height: 1.05; letter-spacing: -.02em; margin: 10px 0 12px; font-weight: 750; }
  .lead { color: #b7b8be; font-size: 16.5px; line-height: 1.4; margin: 0 0 18px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .card { background: #1b1d22; border: 1px solid #2c2e34; border-radius: 14px; padding: 16px 16px; }
  .card h2 { margin: 2px 0 6px; font-size: 16.5px; }
  .card p, .card li { margin: 0; color: #c5c6cc; font-size: 13.5px; line-height: 1.4; }
  .card ul { margin: 4px 0 0; padding-left: 16px; }
  .card li { margin: 2px 0; }
  .ico { color: #ff7a2e; font-size: 14px; }
  footer {
    position: absolute; left: 40px; right: 40px; bottom: 18px;
    display: flex; justify-content: space-between; color: #8d8f96;
    font-size: 11px; border-top: 1px solid #2a2c31; padding-top: 8px;
  }
  .mock { background: #17181c; border: 1px solid #2c2e34; border-radius: 16px; padding: 14px; }
  .row { display: flex; gap: 10px; }
  .pill { background: #26282e; border-radius: 999px; padding: 3px 8px; font-size: 11px; color: #d7d8de; }
  .orange { color: #ff7a2e; }
  .bar { height: 7px; background: #2a2c31; border-radius: 99px; overflow: hidden; }
  .bar > span { display: block; height: 100%; background: #ff7a2e; }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .tile { background: #1b1d22; border-radius: 10px; padding: 8px; }
  .tile b { display: block; font-size: 16px; }
  .tile span { color: #9a9ca3; font-size: 10px; }
  .cover-top { display: flex; justify-content: space-between; align-items: center; }
  .brand { display: flex; gap: 8px; align-items: center; font-weight: 700; }
  .brand img { width: 28px; height: 28px; }
  table.mini { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.mini td { padding: 5px 0; border-bottom: 1px solid #2a2c31; }
  table.mini td:last-child { text-align: right; color: #ff7a2e; }
  .note { margin-top: 10px; color: #9a9ca3; font-size: 12px; }
  .steps { display: flex; gap: 8px; margin-top: 12px; }
  .step { flex: 1; background: #1b1d22; border-radius: 12px; padding: 10px; }
  .step b { display: block; color: #ff7a2e; font-size: 12px; }
  .step span { font-size: 12px; color: #d7d8de; }
  @page { size: 210mm 297mm; margin: 0; }
`;

function shell(pages) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${pages}</body></html>`;
}

function page(n, foot, inner) {
  return `<section class="page">${inner}<footer><span>${foot}</span><span>${n}</span></footer></section>`;
}

const copy = {
  nl: {
    foot: 'GymCoach · voorbeelddata',
    pages: [
      (n) => page(n, 'versie 2.32.15', `
        <div class="cover-top"><div class="brand"><img src="${logo}" alt="">GymCoach</div><span class="pill">voor de Speediance Gym Monster</span></div>
        <h1 style="font-size:40px;margin-top:28px">Je eigen AI-trainer.<br>Een plan dat met je meegroeit.</h1>
        <p class="lead">GymCoach leest je trainingen, maakt elke week een schema, volgt je doel en je gezondheidsscore, en zet het plan met één klik op het toestel. Je data blijft op jouw server.</p>
        <div class="mock">
          <div class="row" style="justify-content:space-between"><div><div class="kicker">Volgende training</div><b>Full Body A</b><div style="color:#9a9ca3;font-size:12px">12 oefeningen · ±45 min</div></div><div style="text-align:right"><b class="orange">2 / 3</b><div style="color:#9a9ca3;font-size:12px">deze week</div></div></div>
          <div class="tiles" style="margin-top:12px">
            <div class="tile"><span>Reeks</span><b>4</b></div>
            <div class="tile"><span>Volume</span><b>9,2 t</b></div>
            <div class="tile"><span>Kracht</span><b>+26%</b></div>
            <div class="tile"><span>Score</span><b>6,3</b></div>
          </div>
        </div>
        <div class="grid3" style="margin-top:16px">
          <div class="card"><div class="ico">01</div><h2>Persoonlijk weekplan</h2><p>Op wat je de vorige keer echt tilde, en op spieren die nog moeten herstellen.</p></div>
          <div class="card"><div class="ico">02</div><h2>Doel en score</h2><p>Lichaam, kracht, stappen en activiteiten. De gezondheidsscore loopt van 0 tot 10.</p></div>
          <div class="card"><div class="ico">03</div><h2>Thuis, en onderweg</h2><p>In de browser en alleen-lezen op de iPhone. De handleiding zit in de app.</p></div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Verder in deze brochure</h2><p>Het weekplan en de editor. Lichaam, Withings en Apple Health. Terugkijken, met afdrukken en PDF. Het rapport na elke training. Doel, gezondheidsscore en de handleiding. En hoe je het op je eigen server zet.</p></div>`),
      (n) => page(n, 'Wat GymCoach doet', `
        <div class="kicker">Van toestel naar plan</div>
        <h1>GymCoach doet het werk tussen twee trainingen.</h1>
        <p class="lead">De Gym Monster stuurt elke set naar de Speediance-cloud. GymCoach haalt die binnen en maakt het volgende voorstel.</p>
        <div class="grid2">
          <div class="card"><h2>Slimme progressie</h2><p>Haal je het maximum, dan gaat het gewicht omhoog. Mis je het twee keer, dan 10% terug. Elke zesde week is een deload, eerder als herstel daarom vraagt. Een sessie die ver van de mediaan van die oefening ligt, telt niet mee in de krachtindex.</p></div>
          <div class="card"><h2>Past in jouw week</h2><p>Per dag kracht, circuit of buiten, met een focus. De week is één plan: een oefening schuift naar een latere dag als die spier nog niet hersteld is. Een wandeling of andere activiteit hoort in dezelfde week.</p></div>
          <div class="card"><h2>Warming-up en cooldown</h2><p>Rek- en spieractivatie van de spiergroepen van die dag, en een cooldown erna. Klaar om te starten, niet alleen een lijst oefeningen.</p></div>
          <div class="card"><h2>AI-coach</h2><p>Stel een vraag over je schema. Het antwoord gebruikt je echte cijfers: volume, herstel en wat je de vorige keer tilde. Jij beslist wat je overneemt.</p></div>
          <div class="card"><h2>Eén klik naar het toestel</h2><p>Controleren, dan versturen. Eén training wissen of vervangen laat de rest staan. Oefeningen staan ingeklapt tot je ze opent. De volgorde volgt de kabelpositie op de Gym Monster.</p></div>
          <div class="card"><h2>Lichaam, Health en score</h2><p>Withings levert gewicht, vet en spiermassa. Apple Health levert activiteiten, stappen, hartslag, HRV en VO2max. Daaroverheen ligt een gezondheidsscore van 0 tot 10.</p></div>
        </div>
        <div class="steps"><div class="step"><b>1 · Plan</b><span>De week staat klaar.</span></div><div class="step"><b>2 · Train</b><span>Op de Gym Monster.</span></div><div class="step"><b>3 · Sync</b><span>Sets komen binnen.</span></div><div class="step"><b>4 · Groei</b><span>Het plan schuift mee.</span></div></div>`),
      (n) => page(n, 'Het weekplan', `
        <div class="kicker">Elke week opnieuw</div>
        <h1>Een schema op jouw cijfers, niet op een standaardprogramma.</h1>
        <p class="lead">Spiergroepen, focus en de trainingen van deze week. Open een oefening voor sets, gewicht en waarom het plan dit voorstelt.</p>
        <div class="mock">
          <div class="row" style="gap:6px;margin-bottom:10px"><span class="pill orange">Borst</span><span class="pill">Rug</span><span class="pill">Benen</span><span class="pill">Schouders</span></div>
          <div style="margin-bottom:6px;font-size:12px;color:#9a9ca3">Borst · 12 / 16 sets</div>
          <div class="bar"><span style="width:75%"></span></div>
          <div style="margin:10px 0 6px;font-size:12px;color:#9a9ca3">Rug · 10 / 16 sets</div>
          <div class="bar"><span style="width:62%"></span></div>
          <div class="card" style="margin-top:12px">
            <b>Maandag · Full Body A · kracht</b>
            <p>1. Dual-Handle Bench Press · 4×8–12 · 32 kg<br>2. Lat Pulldown · 4×8–12 · 40 kg</p>
          </div>
        </div>
        <div class="grid3" style="margin-top:12px">
          <div class="card"><h2>Eén plan</h2><p>Herstel verdeelt oefeningen over de week. Een zware spier komt niet twee dagen achter elkaar terug.</p></div>
          <div class="card"><h2>Activiteiten</h2><p>Wandelen, zwemmen of een sport buiten de krachttraining. Apple Health vult de balk als je het gedaan hebt.</p></div>
          <div class="card"><h2>Zelf bijsturen</h2><p>Eén training wissen of vervangen. De rest van de week blijft. Oefeningen klap je open als je ze wilt zien.</p></div>
        </div>`),
      (n) => page(n, 'Zelf samenstellen', `
        <div class="kicker">De editor</div>
        <h1>Pas elk voorstel aan. Of bouw je eigen training.</h1>
        <p class="lead">Bewerk een training uit het plan, begin leeg, kopieer er een of kies een sjabloon. De figuur en de sets per spiergroep rekenen direct mee.</p>
        <div class="grid3">
          <div class="card"><h2>Alles per set</h2><p>Herhalingen, gewicht, rust en de modus van de Gym Monster: standaard, excentrisch, isokinetisch, constant of spotter. Met piramide en opwarmset in één klik.</p></div>
          <div class="card"><h2>Supersets</h2><p>Twee of meer oefeningen om en om, zonder rust ertussen. Op het toestel staan ze als afwisselende stappen, met rust na elke ronde.</p></div>
          <div class="card"><h2>Oefeningen bekijken</h2><p>Blader per spiergroep, soort en materiaal, met video, aandachtspunten en uitleg. Eén keer opgehaald en op je eigen server bewaard.</p></div>
          <div class="card"><h2>Vastgezet, en toch vooruit</h2><p>Een bewerkte training blijft staan bij een nieuw plan. De gewichten groeien mee met je progressie, behalve waar je vast gewicht kiest.</p></div>
          <div class="card"><h2>Sjablonen delen</h2><p>Bewaar een training als sjabloon. Op een server met meer gebruikers krijgt ieder zijn eigen geschiedenis.</p></div>
          <div class="card"><h2>AI-coach kijkt mee</h2><p>Ook bij je eigen training. De opbouw blijft staan; elk voorstel heeft een reden en jij vinkt aan wat je overneemt.</p></div>
        </div>
        <p class="note">Warming-up en cooldown stel je op dezelfde manier samen. De volgorde van de oefeningen volgt de kabelpositie, zodat je op het toestel niet steeds opnieuw hoeft te wisselen.</p>`),
      (n) => page(n, 'Lichaam', `
        <div class="kicker">Withings en Apple Health</div>
        <h1>Je lichaam, naast je training.</h1>
        <p class="lead">De weegschaal en de iPhone vullen dezelfde tab. De kleur zegt of de meting gezonder werd, niet of het getal steeg.</p>
        <div class="tiles">
          <div class="tile"><span>Gewicht</span><b>82,4</b></div>
          <div class="tile"><span>Vet</span><b>18%</b></div>
          <div class="tile"><span>Spier</span><b>64 kg</b></div>
          <div class="tile"><span>FFMI</span><b>21</b></div>
          <div class="tile"><span>Polsgolf</span><b>6,4</b></div>
          <div class="tile"><span>HRV</span><b>48</b></div>
          <div class="tile"><span>VO2max</span><b>44</b></div>
          <div class="tile"><span>Score</span><b>6,3</b></div>
        </div>
        <div class="grid2" style="margin-top:12px">
          <div class="card"><h2>De kleur volgt de score</h2><p>Groener als de meting de gezondheidsscore omhoog trekt. Een BMI die naar 22 gaat wordt groener, ook als het getal daalt. Een rusthartslag die stijgt wordt roder, ook al is “hoger” hier geen vooruitgang.</p></div>
          <div class="card"><h2>Samenstelling</h2><p>Vet, spiermassa en de verdeling over armen, benen en romp. ECW/TBW is het water buiten de cellen gedeeld door al het lichaamswater; onder 0,40 is gebruikelijk. De cijfers komen van de Withings-weegschaal, zodra die is gekoppeld.</p></div>
          <div class="card"><h2>Hart en conditie</h2><p>Rusthartslag, HRV, VO2max en polsgolfsnelheid uit Apple Health. Stappen en activiteiten van dezelfde iPhone vullen het doel van de week.</p></div>
          <div class="card"><h2>Geen medisch oordeel</h2><p>De score en de kleuren zijn een samenvatting van je eigen metingen, om te zien of het de goede kant op gaat. Ze vervangen geen arts.</p></div>
        </div>`),
      (n) => page(n, 'Terugkijken', `
        <div class="kicker">Cijfers over langere tijd</div>
        <h1>Terugkijken: kracht, volume en herstel in één tab.</h1>
        <p class="lead">Voorheen heette dit Analyse. Dezelfde grafieken, plus afdrukken en een PDF van de hele tab.</p>
        <div class="grid2">
          <div class="card"><h2>Krachtindex</h2><p>100 is je start. De lijn is de mediaan van je sessies, zodat één uitschieter het beeld niet trekt. Een sessie die meer dan 15% van die mediaan afwijkt, telt niet mee.</p></div>
          <div class="card"><h2>Volume en sets</h2><p>Totaal per week, per spiergroep, en of de week in balans is. Een spiergroep die achterblijft zie je terug in het volgende plan.</p></div>
          <div class="card"><h2>Wanneer en herstel</h2><p>Op welke dagen je trainde, hoe lang je herstelde, en of de verbrande energie meeloopt met je gewicht.</p></div>
          <div class="card"><h2>Kilometers en stappen</h2><p>Cardio en de stappenteller naast de krachttraining, uit Apple Health. Zo zie je de week zoals je die echt bewoog.</p></div>
          <div class="card"><h2>Afdrukken en PDF</h2><p>De hele tab past op papier. Een blok dat niet meer op de pagina past, schuift in zijn geheel naar de volgende.</p></div>
          <div class="card"><h2>Records</h2><p>Je zwaarste set per oefening, en wanneer die viel. Het trainingsrapport na afloop mailt dezelfde soort cijfers per sessie.</p></div>
        </div>`),
      (n) => page(n, 'Na elke training', `
        <div class="kicker">In je mailbox</div>
        <h1>Je trainingsrapport, vanzelf na elke sessie.</h1>
        <p class="lead">Zodra de training binnen is, maakt GymCoach een PDF en mailt die naar je toe. Of je opent hem in de app.</p>
        <div class="grid2">
          <div class="card"><h2>Kerncijfers</h2><p>Duur, sets, volume, calorieën en hartslag, plus de figuur met de sets per spiergroep.</p></div>
          <div class="card"><h2>Vergeleken met de vorige keer</h2><p>Duur, volume, sets en hartslag tegenover het gemiddelde van de laatste vier keer dezelfde training.</p></div>
          <div class="card"><h2>Tijd onder spanning</h2><p>Hoeveel van de training echt aan het werk was, hoeveel rust, en hoe lang per herhaling.</p></div>
          <div class="card"><h2>Hartslag met zones</h2><p>Het verloop van de Apple Watch, met de minuten per zone, van herstel tot maximaal.</p></div>
          <div class="card"><h2>Elke oefening</h2><p>Sets, herhalingen, gewicht en records, vergeleken met de vorige keer, en of de laatste herhalingen trager werden.</p></div>
          <div class="card"><h2>Je eigen mailbox</h2><p>Aan of uit per gebruiker bij Instellingen → E-mail. Werkt met elke eigen SMTP-server. Het rapport in de brochure is voorbeelddata.</p></div>
        </div>`),
      (n) => page(n, 'Afgestemd op jou', `
        <div class="kicker">Mannen, vrouwen, en je eigen herstel</div>
        <h1>Hetzelfde programma, andere cijfers.</h1>
        <p class="lead">Geslacht, hartslag en herstel bepalen de rust, de sets en de kleuren. Iedereen houdt zijn eigen geschiedenis.</p>
        <div class="grid2">
          <div class="card"><h2>Rust en sets</h2><p>Vrouwen krijgen in de standaard ongeveer 20% kortere rust en waar het past een set extra. De formules voor maximale hartslag verschillen per geslacht. Je kunt de rust ook zelf vastzetten.</p></div>
          <div class="card"><h2>Je eigen herstel</h2><p>Na een zware sessie wacht een spiergroep langer. Dat is jouw patroon, niet een tabel uit een boek. De week schuift de oefening naar een dag waarop die spier weer mee kan.</p></div>
          <div class="card"><h2>Taal</h2><p>Nederlands, Engels, Duits en Noors. De brochure zelf is er in het Nederlands, Engels en Duits.</p></div>
          <div class="card"><h2>Handleiding</h2><p>Instellingen → Handleiding, en op de iPhone onder Meer. Koppelen, hoe er gemeten wordt, de gezondheidsscore, en elk scherm met een voorbeeld.</p></div>
        </div>
        <div class="card" style="margin-top:10px"><h2>Wat je zelf invult</h2><p>Geslacht, geboortedatum, lengte en eenheden staan bij Instellingen. Het stappendoel, de activiteiten en het lichaamsdoel staan op de tab Doel. De weegschaal koppel je eenmalig; daarna komen de metingen vanzelf.</p></div>`),
      (n) => page(n, 'Techniek', `
        <div class="kicker">Op je eigen server</div>
        <h1>Geen account bij ons. Geen abonnement.</h1>
        <p class="lead">GymCoach is open source (MIT). De site praat alleen met jouw server. Er gaan geen trainingsgegevens naar een dienst van derden, behalve de koppelingen die je zelf aanzet.</p>
        <div class="card"><h2>Installeren</h2><p>git clone, daarna bash install.sh, daarna de browser op http://ip-van-de-server:8765. Node.js 22.5 of nieuwer. Linux. Getest met Gym Monster model 1.</p></div>
        <div class="grid2" style="margin-top:10px">
          <div class="card"><h2>Nodig</h2><ul><li>Speediance Gym Monster</li><li>Een Linux-server met Node 22.5+</li><li>Een browser op je laptop</li></ul></div>
          <div class="card"><h2>Optioneel</h2><ul><li>Withings-weegschaal</li><li>GymCoach Sync op de iPhone</li><li>Eigen mailbox (SMTP)</li><li>Claude, of een lokaal model</li></ul></div>
        </div>
        <p class="note">De iPhone-app leest alleen: overzicht, plan, doel en lichaam. Koppelen van Apple Health gebruikt een aparte sleutel, niet je inlogsessie. De sleutel maak je in GymCoach; op de telefoon vul je het adres van de site in.</p>`),
      (n) => page(n, 'Doel', `
        <div class="kicker">Waar je naartoe werkt</div>
        <h1>Een doel voor lichaam, kracht, stappen en activiteiten.</h1>
        <p class="lead">De tab Doel houdt de lijn bij. De weegschaal zelf blijft op Lichaam. Profiel en eenheden blijven bij Instellingen.</p>
        <div class="grid2">
          <div class="card"><h2>Lichaam</h2><p>Kies hoeveel kilo je wilt bewegen en in hoeveel weken. GymCoach trekt de rechte lijn en zet je wegingen ernaast. Vetpercentage en spiermassa kunnen mee, als je die invult.</p></div>
          <div class="card"><h2>Kracht per spiergroep</h2><p>Tot zes spiergroepen, met een percentage en een datum. Het plan kiest de oefeningen die daarbij horen. Je hoeft geen oefening voor oefening een doel te zetten.</p></div>
          <div class="card"><h2>Stappen</h2><p>Een doel per dag. De iPhone levert het aantal via Apple Health, samen met de rest van de dagtotalen.</p></div>
          <div class="card"><h2>Activiteiten</h2><p>Wandelen, zwemmen, padel: hoe vaak, hoe lang, en eventueel een afstand. GymCoach stelt doelen voor uit je laatste vier weken. Apple Health kleurt de balk als het gelukt is.</p></div>
          <div class="card"><h2>Eten</h2><p>De streefinname komt uit Mifflin-St Jeor, met je doel erin verwerkt, plus een hoeveelheid eiwit. Uurwaarden uit Apple Health worden opgeteld tot een dagtotaal.</p></div>
          <div class="card"><h2>Het schema blijft van jou</h2><p>Het plan kan meeschuiven met je doel, als je dat aanzet. Zet je het uit, dan blijft het schema zoals je het had, en volgt alleen de grafiek je lijn.</p></div>
        </div>`),
      (n) => page(n, 'Gezondheidsscore', `
        <div class="kicker">0 tot 10</div>
        <h1>Eén score, opgebouwd uit je eigen metingen.</h1>
        <p class="lead">Hoger is beter. De score staat op Overzicht en op Lichaam, en in GymCoach Sync met dezelfde koppen.</p>
        <div class="mock">
          <div class="row" style="align-items:center;justify-content:space-between"><div><div class="kicker">Nu</div><b style="font-size:28px">6,3</b></div><div style="flex:1;margin-left:16px"><div class="bar"><span style="width:63%"></span></div></div></div>
          <table class="mini" style="margin-top:8px"><tr><td>Lichaam</td><td>vet, visceraal vet, FFMI, BMI, bot</td></tr><tr><td>Hart</td><td>rusthartslag, polsgolf, vasculaire leeftijd</td></tr><tr><td>Conditie</td><td>VO2max en HRV</td></tr><tr><td>Overig</td><td>zenuw, metabole leeftijd, ECW/TBW</td></tr></table>
        </div>
        <div class="grid2" style="margin-top:12px">
          <div class="card"><h2>De pijl is niet het doel</h2><p>Een getal dat stijgt is niet vanzelf goed. De kleur kijkt of die meting de score omhoog of omlaag trekt. Zo wordt een dalend vetpercentage groen en een stijgende rusthartslag rood.</p></div>
          <div class="card"><h2>Op de iPhone</h2><p>Koppen per categorie, een icoon per meting, en een tabel met het verloop. Alleen lezen: wijzigen doe je op de site.</p></div>
        </div>
        <p class="note">De score is een hulpmiddel om je reeks metingen te volgen. Het is geen diagnose en geen advies van een arts.</p>`),
      (n) => page(n, 'Handleiding', `
        <div class="kicker">In de app, en op de iPhone</div>
        <h1>Uitleg bij elk scherm, met een voorbeeld.</h1>
        <p class="lead">Instellingen → Handleiding. Op de iPhone staat hetzelfde onder Meer. De plaatjes zijn van een voorbeeldgebruiker, zodat je ziet wat elk blok toont.</p>
        <div class="grid2">
          <div class="card"><h2>Nieuw: koppelen</h2><p>Withings: de beheerder maakt een app op developer.withings.com, daarna Koppel Withings. Apple Health: in GymCoach een koppelsleutel (begint met gch_), op de iPhone het adres van de site. Dat adres is niet het ingest-adres.</p></div>
          <div class="card"><h2>De schermen</h2><p>Overzicht, Plan, Doel, Lichaam, Training, Terugkijken en Instellingen. Per tab een genummerde pagina en een close-up per blok, met wat je daar ziet.</p></div>
          <div class="card"><h2>Hoe er gemeten wordt</h2><p>Progressie, herstel, de gezondheidsscore en waar een cijfer vandaan komt. Dezelfde tekst als deze brochure, maar naast de knoppen die je echt gebruikt.</p></div>
          <div class="card"><h2>Onderweg</h2><p>GymCoach Sync toont overzicht, plan, doel, lichaam en de score. Wijzigen, mail en de koppelingen doe je op de site. Zonder wifi thuis kan de health-sync wachten, als je dat zo instelt.</p></div>
        </div>
        <p class="note">De handleiding volgt de taal van de app: Nederlands, Engels, Duits of Noors.</p>`),
    ],
  },
  en: {
    foot: 'GymCoach · sample data',
    pages: null,
  },
};

const enPages = [
  (n) => page(n, 'version 2.32.15', `
    <div class="cover-top"><div class="brand"><img src="${logo}" alt="">GymCoach</div><span class="pill">for the Speediance Gym Monster</span></div>
    <h1 style="font-size:40px;margin-top:28px">Your own AI trainer.<br>A plan that grows with you.</h1>
    <p class="lead">GymCoach reads your sessions, builds each week, tracks your goal and your health score, and sends the plan to the machine in one click. Your data stays on your server.</p>
    <div class="mock">
      <div class="row" style="justify-content:space-between"><div><div class="kicker">Next session</div><b>Full Body A</b><div style="color:#9a9ca3;font-size:12px">12 exercises · ±45 min</div></div><div style="text-align:right"><b class="orange">2 / 3</b><div style="color:#9a9ca3;font-size:12px">this week</div></div></div>
      <div class="tiles" style="margin-top:12px">
        <div class="tile"><span>Streak</span><b>4</b></div>
        <div class="tile"><span>Volume</span><b>9.2 t</b></div>
        <div class="tile"><span>Strength</span><b>+26%</b></div>
        <div class="tile"><span>Score</span><b>6.3</b></div>
      </div>
    </div>
    <div class="grid3" style="margin-top:16px">
      <div class="card"><div class="ico">01</div><h2>A personal week</h2><p>Based on what you actually lifted, and on muscles that still need to recover.</p></div>
      <div class="card"><div class="ico">02</div><h2>Goal and score</h2><p>Body, strength, steps and activities. The health score runs from 0 to 10.</p></div>
      <div class="card"><div class="ico">03</div><h2>At home, and away</h2><p>In the browser, and read-only on iPhone. The guide lives in the app.</p></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Also in this brochure</h2><p>The week plan and the editor. Body, Withings and Apple Health. Looking back, with print and PDF. The report after every session. Goal, health score and the guide. And how to run it on your own server.</p></div>`),
  (n) => page(n, 'What GymCoach does', `
    <div class="kicker">From machine to plan</div>
    <h1>GymCoach does the work between two sessions.</h1>
    <p class="lead">The Gym Monster sends every set to the Speediance cloud. GymCoach pulls that in and drafts the next plan.</p>
    <div class="grid2">
      <div class="card"><h2>Smart progression</h2><p>Hit the top of the range and the weight goes up. Miss it twice and it comes back 10%. Every sixth week is a deload, sooner if recovery asks. A session far from that exercise’s median does not move the strength index.</p></div>
      <div class="card"><h2>Fits your week</h2><p>Each day is strength, circuit or outdoors, with a focus. The week is one plan: an exercise moves to a later day when that muscle has not recovered. A walk or other activity belongs in the same week.</p></div>
      <div class="card"><h2>Warm-up and cooldown</h2><p>Mobility and activation for the muscles of that day, and a cooldown after. Ready to start, not just a list of exercises.</p></div>
      <div class="card"><h2>AI coach</h2><p>Ask about your plan. The answer uses your real numbers: volume, recovery and what you lifted last time. You choose what to keep.</p></div>
      <div class="card"><h2>One click to the machine</h2><p>Review, then send. Delete or replace one session and the rest stays. Exercises stay collapsed until you open them. Order follows the cable position on the Gym Monster.</p></div>
      <div class="card"><h2>Body, Health and score</h2><p>Withings supplies weight, fat and muscle. Apple Health supplies activities, steps, heart rate, HRV and VO2max. A health score from 0 to 10 sits on top.</p></div>
    </div>
    <div class="steps"><div class="step"><b>1 · Plan</b><span>The week is ready.</span></div><div class="step"><b>2 · Train</b><span>On the Gym Monster.</span></div><div class="step"><b>3 · Sync</b><span>Sets come in.</span></div><div class="step"><b>4 · Grow</b><span>The plan moves with you.</span></div></div>`),
  (n) => page(n, 'The week plan', `
    <div class="kicker">Every week again</div>
    <h1>A plan from your numbers, not from a stock program.</h1>
    <p class="lead">Muscle groups, focus and this week’s sessions. Open an exercise for sets, weight and why the plan suggests it.</p>
    <div class="mock">
      <div class="row" style="gap:6px;margin-bottom:10px"><span class="pill orange">Chest</span><span class="pill">Back</span><span class="pill">Legs</span><span class="pill">Shoulders</span></div>
      <div style="margin-bottom:6px;font-size:12px;color:#9a9ca3">Chest · 12 / 16 sets</div>
      <div class="bar"><span style="width:75%"></span></div>
      <div style="margin:10px 0 6px;font-size:12px;color:#9a9ca3">Back · 10 / 16 sets</div>
      <div class="bar"><span style="width:62%"></span></div>
      <div class="card" style="margin-top:12px"><b>Monday · Full Body A · strength</b><p>1. Dual-Handle Bench Press · 4×8–12 · 32 kg<br>2. Lat Pulldown · 4×8–12 · 40 kg</p></div>
    </div>
    <div class="grid3" style="margin-top:12px">
      <div class="card"><h2>One plan</h2><p>Recovery spreads exercises across the week. A tired muscle does not come back on the next day.</p></div>
      <div class="card"><h2>Activities</h2><p>Walking, swimming or a sport outside the weights. Apple Health fills the bar when you have done it.</p></div>
      <div class="card"><h2>Adjust it</h2><p>Delete or replace one session. The rest of the week stays. Open an exercise when you want the detail.</p></div>
    </div>`),
  (n) => page(n, 'Build it yourself', `
    <div class="kicker">The editor</div>
    <h1>Change any suggestion. Or build your own session.</h1>
    <p class="lead">Edit a session from the plan, start empty, copy one or pick a template. The figure and the sets per muscle update immediately.</p>
    <div class="grid3">
      <div class="card"><h2>Every set</h2><p>Reps, weight, rest and the Gym Monster mode: standard, eccentric, isokinetic, constant or spotter. Pyramid and warm-up set in one click.</p></div>
      <div class="card"><h2>Supersets</h2><p>Two or more exercises alternating, with no rest between them. On the machine they are alternating steps, with rest after each round.</p></div>
      <div class="card"><h2>Browse exercises</h2><p>By muscle, type and equipment, with video, cues and an explanation. Fetched once and stored on your server.</p></div>
      <div class="card"><h2>Locked, and still moving</h2><p>An edited session stays when a new plan is built. Weights still follow your progression, except where you pinned the weight.</p></div>
      <div class="card"><h2>Share templates</h2><p>Save a session as a template. On a server with several people, each keeps their own history.</p></div>
      <div class="card"><h2>The AI coach watches</h2><p>Also on a session you built. The structure stays; every suggestion has a reason and you tick what you take.</p></div>
    </div>
    <p class="note">Warm-up and cooldown are edited the same way. Exercise order follows the cable position, so you are not swapping the cable on every change.</p>`),
  (n) => page(n, 'Body', `
    <div class="kicker">Withings and Apple Health</div>
    <h1>Your body, next to your training.</h1>
    <p class="lead">The scale and the iPhone fill the same tab. Colour says whether the reading got healthier, not whether the number went up.</p>
    <div class="tiles">
      <div class="tile"><span>Weight</span><b>82.4</b></div>
      <div class="tile"><span>Fat</span><b>18%</b></div>
      <div class="tile"><span>Muscle</span><b>64 kg</b></div>
      <div class="tile"><span>FFMI</span><b>21</b></div>
      <div class="tile"><span>Pulse wave</span><b>6.4</b></div>
      <div class="tile"><span>HRV</span><b>48</b></div>
      <div class="tile"><span>VO2max</span><b>44</b></div>
      <div class="tile"><span>Score</span><b>6.3</b></div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="card"><h2>Colour follows the score</h2><p>Greener when the reading pulls the health score up. A BMI moving toward 22 turns greener even if the number falls. A rising resting heart rate turns redder, because higher is not progress here.</p></div>
      <div class="card"><h2>Composition</h2><p>Fat, muscle and the split across arms, legs and torso. ECW/TBW is the water outside the cells divided by all body water; below 0.40 is usual. The numbers come from the Withings scale once it is linked.</p></div>
      <div class="card"><h2>Heart and fitness</h2><p>Resting heart rate, HRV, VO2max and pulse-wave velocity from Apple Health. Steps and activities from the same iPhone fill the week’s goal.</p></div>
      <div class="card"><h2>Not a medical opinion</h2><p>The score and the colours summarise your own readings, so you can see the direction. They do not replace a doctor.</p></div>
    </div>`),
  (n) => page(n, 'Looking back', `
    <div class="kicker">Numbers over a longer stretch</div>
    <h1>Looking back: strength, volume and recovery on one tab.</h1>
    <p class="lead">This tab used to be called Analysis. The same charts, plus print and a PDF of the whole tab.</p>
    <div class="grid2">
      <div class="card"><h2>Strength index</h2><p>100 is your start. The line is the median of your sessions, so one outlier does not drag the picture. A session more than 15% off that median is left out.</p></div>
      <div class="card"><h2>Volume and sets</h2><p>Weekly totals, per muscle, and whether the week is balanced. A muscle that falls behind shows up in the next plan.</p></div>
      <div class="card"><h2>When, and recovery</h2><p>Which days you trained, how long you recovered, and whether burned energy tracks your weight.</p></div>
      <div class="card"><h2>Kilometres and steps</h2><p>Cardio and the step count beside the weights, from Apple Health. The week as you actually moved.</p></div>
      <div class="card"><h2>Print and PDF</h2><p>The whole tab fits on paper. A block that no longer fits moves entirely onto the next page.</p></div>
      <div class="card"><h2>Records</h2><p>Your heaviest set per exercise, and when it happened. The session report emails the same kind of numbers after each workout.</p></div>
    </div>`),
  (n) => page(n, 'After every session', `
    <div class="kicker">In your inbox</div>
    <h1>Your workout report, mailed after every session.</h1>
    <p class="lead">Once the session has arrived, GymCoach builds a PDF and mails it to you. Or you open it in the app.</p>
    <div class="grid2">
      <div class="card"><h2>Headline numbers</h2><p>Duration, sets, volume, calories and heart rate, plus the figure with sets per muscle.</p></div>
      <div class="card"><h2>Compared with last time</h2><p>Duration, volume, sets and heart rate against the average of the last four times you did the same session.</p></div>
      <div class="card"><h2>Time under tension</h2><p>How much of the session was real work, how much was rest, and how long each rep took.</p></div>
      <div class="card"><h2>Heart rate zones</h2><p>The Apple Watch trace, with minutes per zone, from recovery to max.</p></div>
      <div class="card"><h2>Every exercise</h2><p>Sets, reps, weight and records against last time, and whether the last reps slowed down.</p></div>
      <div class="card"><h2>Your own mailbox</h2><p>On or off per user under Settings → Email. Works with any mailbox you run (SMTP). The report in this brochure is sample data.</p></div>
    </div>`),
  (n) => page(n, 'Tuned to you', `
    <div class="kicker">Men, women, and your own recovery</div>
    <h1>The same program, different numbers.</h1>
    <p class="lead">Sex, heart rate and recovery set the rest, the sets and the colours. Everyone keeps their own history.</p>
    <div class="grid2">
      <div class="card"><h2>Rest and sets</h2><p>Women get about 20% shorter rest by default, and an extra set where it fits. Max-heart-rate formulas differ by sex. You can pin the rest yourself.</p></div>
      <div class="card"><h2>Your own recovery</h2><p>After a hard session a muscle waits longer. That is your pattern, not a table from a book. The week moves the exercise to a day when that muscle can work again.</p></div>
      <div class="card"><h2>Language</h2><p>Dutch, English, German and Norwegian. This brochure is in Dutch, English and German.</p></div>
      <div class="card"><h2>Guide</h2><p>Settings → Guide, and on iPhone under More. Connecting, how readings are taken, the health score, and every screen with an example.</p></div>
    </div>
    <div class="card" style="margin-top:10px"><h2>What you fill in</h2><p>Sex, date of birth, height and units live in Settings. The step goal, activities and body goal live on the Goal tab. Link the scale once; readings arrive on their own after that.</p></div>`),
  (n) => page(n, 'Technology', `
    <div class="kicker">On your own server</div>
    <h1>No account with us. No subscription.</h1>
    <p class="lead">GymCoach is open source (MIT). The site talks only to your server. Training data is not sent to a third party, except the links you turn on yourself.</p>
    <div class="card"><h2>Install</h2><p>git clone, then bash install.sh, then the browser at http://your-server-ip:8765. Node.js 22.5 or newer. Linux. Tested with Gym Monster model 1.</p></div>
    <div class="grid2" style="margin-top:10px">
      <div class="card"><h2>You need</h2><ul><li>A Speediance Gym Monster</li><li>A Linux server with Node 22.5+</li><li>A browser on your laptop</li></ul></div>
      <div class="card"><h2>Optional</h2><ul><li>A Withings scale</li><li>GymCoach Sync on iPhone</li><li>Your own mailbox (SMTP)</li><li>Claude, or a local model</li></ul></div>
    </div>
    <p class="note">The iPhone app is read-only: overview, plan, goal and body. Linking Apple Health uses a separate key, not your login. You create the key in GymCoach; on the phone you enter the site address.</p>`),
  (n) => page(n, 'Goal', `
    <div class="kicker">What you are working toward</div>
    <h1>A goal for body, strength, steps and activities.</h1>
    <p class="lead">The Goal tab keeps the line. The scale itself stays on Body. Profile and units stay in Settings.</p>
    <div class="grid2">
      <div class="card"><h2>Body</h2><p>Choose how many kilos to move and in how many weeks. GymCoach draws the straight line and plots your weigh-ins beside it. Fat percentage and muscle can join in if you set them.</p></div>
      <div class="card"><h2>Strength by muscle</h2><p>Up to six muscle groups, with a percentage and a date. The plan picks the exercises that belong to them. You do not set a goal exercise by exercise.</p></div>
      <div class="card"><h2>Steps</h2><p>A target per day. The iPhone supplies the count through Apple Health, with the rest of the daily totals.</p></div>
      <div class="card"><h2>Activities</h2><p>Walking, swimming, padel: how often, how long, and a distance if you want one. GymCoach suggests targets from your last four weeks. Apple Health fills the bar when you have done it.</p></div>
      <div class="card"><h2>Intake</h2><p>The calorie target comes from Mifflin-St Jeor, with your goal worked in, plus a protein amount. Hourly Apple Health values add up to one daily total.</p></div>
      <div class="card"><h2>The plan stays yours</h2><p>The plan can follow your goal when you turn that on. Leave it off and the plan stays as it was; only the chart follows your line.</p></div>
    </div>`),
  (n) => page(n, 'Health score', `
    <div class="kicker">0 to 10</div>
    <h1>One score, built from your own readings.</h1>
    <p class="lead">Higher is better. The score is on Overview and on Body, and in GymCoach Sync under the same headings.</p>
    <div class="mock">
      <div class="row" style="align-items:center"><div><div class="kicker">Now</div><b style="font-size:28px">6.3</b></div><div style="flex:1;margin-left:16px"><div class="bar"><span style="width:63%"></span></div></div></div>
      <table class="mini" style="margin-top:8px"><tr><td>Body</td><td>fat, visceral fat, FFMI, BMI, bone</td></tr><tr><td>Heart</td><td>resting heart rate, pulse wave, vascular age</td></tr><tr><td>Fitness</td><td>VO2max and HRV</td></tr><tr><td>Other</td><td>nerve, metabolic age, ECW/TBW</td></tr></table>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="card"><h2>The arrow is not the goal</h2><p>A rising number is not automatically good. Colour looks at whether that reading pulls the score up or down. A falling fat percentage turns green; a rising resting heart rate turns red.</p></div>
      <div class="card"><h2>On iPhone</h2><p>A heading per category, an icon per reading, and a table of the trend. Read-only: you change things on the site.</p></div>
    </div>
    <p class="note">The score helps you follow your own series of readings. It is not a diagnosis and not a doctor’s advice.</p>`),
  (n) => page(n, 'Guide', `
    <div class="kicker">In the app, and on iPhone</div>
    <h1>An explanation of every screen, with an example.</h1>
    <p class="lead">Settings → Guide. On iPhone the same guide is under More. The pictures are a sample user, so you can see what each block shows.</p>
    <div class="grid2">
      <div class="card"><h2>New: connecting</h2><p>Withings: an admin creates an app at developer.withings.com, then Link Withings. Apple Health: create a pairing key in GymCoach (it starts with gch_), and on the iPhone enter the site address. That address is not the ingest address.</p></div>
      <div class="card"><h2>The screens</h2><p>Overview, Plan, Goal, Body, Training, Looking back and Settings. Each tab has a numbered page and a close-up of every block, with what you see there.</p></div>
      <div class="card"><h2>How it is measured</h2><p>Progression, recovery, the health score and where a number comes from. The same story as this brochure, next to the buttons you actually use.</p></div>
      <div class="card"><h2>Away from home</h2><p>GymCoach Sync shows overview, plan, goal, body and the score. Editing, mail and the links stay on the site. Off home wifi, health sync can wait if you set it that way.</p></div>
    </div>
    <p class="note">The guide follows the app language: Dutch, English, German or Norwegian.</p>`),
];

const dePages = [
  (n) => page(n, 'Version 2.32.15', `
    <div class="cover-top"><div class="brand"><img src="${logo}" alt="">GymCoach</div><span class="pill">für die Speediance Gym Monster</span></div>
    <h1 style="font-size:38px;margin-top:28px">Dein eigener KI-Trainer.<br>Ein Plan, der mitwächst.</h1>
    <p class="lead">GymCoach liest deine Einheiten, baut jede Woche, verfolgt Ziel und Gesundheitsscore und schickt den Plan mit einem Klick aufs Gerät. Deine Daten bleiben auf deinem Server.</p>
    <div class="mock">
      <div class="row" style="justify-content:space-between"><div><div class="kicker">Nächste Einheit</div><b>Full Body A</b><div style="color:#9a9ca3;font-size:12px">12 Übungen · ±45 Min.</div></div><div style="text-align:right"><b class="orange">2 / 3</b><div style="color:#9a9ca3;font-size:12px">diese Woche</div></div></div>
      <div class="tiles" style="margin-top:12px">
        <div class="tile"><span>Serie</span><b>4</b></div>
        <div class="tile"><span>Volumen</span><b>9,2 t</b></div>
        <div class="tile"><span>Kraft</span><b>+26%</b></div>
        <div class="tile"><span>Score</span><b>6,3</b></div>
      </div>
    </div>
    <div class="grid3" style="margin-top:16px">
      <div class="card"><div class="ico">01</div><h2>Persönliche Woche</h2><p>Nach dem, was du wirklich gehoben hast, und nach Muskeln, die noch erholen müssen.</p></div>
      <div class="card"><div class="ico">02</div><h2>Ziel und Score</h2><p>Körper, Kraft, Schritte und Aktivitäten. Der Gesundheitsscore läuft von 0 bis 10.</p></div>
      <div class="card"><div class="ico">03</div><h2>Zu Hause und unterwegs</h2><p>Im Browser und nur lesend auf dem iPhone. Die Anleitung steckt in der App.</p></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Weiter in dieser Broschüre</h2><p>Der Wochenplan und der Editor. Körper, Withings und Apple Health. Zurückblicken, mit Drucken und PDF. Der Bericht nach jeder Einheit. Ziel, Gesundheitsscore und die Anleitung. Und wie du es auf deinem eigenen Server laufen lässt.</p></div>`),
  (n) => page(n, 'Was GymCoach tut', `
    <div class="kicker">Vom Gerät zum Plan</div>
    <h1>GymCoach arbeitet zwischen zwei Einheiten.</h1>
    <p class="lead">Die Gym Monster schickt jeden Satz in die Speediance-Cloud. GymCoach holt das ab und macht den nächsten Vorschlag.</p>
    <div class="grid2">
      <div class="card"><h2>Kluge Steigerung</h2><p>Schaftest du das Maximum, steigt das Gewicht. Verfehlst du es zweimal, geht es 10% zurück. Jede sechste Woche ist ein Deload, früher wenn die Erholung das verlangt. Eine Einheit weit weg vom Median dieser Übung zählt nicht im Kraftindex.</p></div>
      <div class="card"><h2>Passt in deine Woche</h2><p>Pro Tag Kraft, Zirkel oder draußen, mit einem Fokus. Die Woche ist ein Plan: eine Übung rutscht auf einen späteren Tag, wenn der Muskel noch nicht erholt ist. Ein Spaziergang gehört in dieselbe Woche.</p></div>
      <div class="card"><h2>Aufwärmen und Cool-down</h2><p>Mobilisation und Aktivierung der Muskeln dieses Tages, und ein Cool-down danach. Startklar, nicht nur eine Übungsliste.</p></div>
      <div class="card"><h2>KI-Coach</h2><p>Frag nach deinem Plan. Die Antwort nutzt deine echten Zahlen: Volumen, Erholung und was du zuletzt gehoben hast. Du entscheidest, was du übernimmst.</p></div>
      <div class="card"><h2>Ein Klick aufs Gerät</h2><p>Prüfen, dann senden. Eine Einheit löschen oder ersetzen lässt den Rest stehen. Übungen bleiben eingeklappt, bis du sie öffnest. Die Reihenfolge folgt der Kabelposition.</p></div>
      <div class="card"><h2>Körper, Health und Score</h2><p>Withings liefert Gewicht, Fett und Muskelmasse. Apple Health liefert Aktivitäten, Schritte, Puls, HRV und VO2max. Darüber liegt ein Gesundheitsscore von 0 bis 10.</p></div>
    </div>
    <div class="steps"><div class="step"><b>1 · Plan</b><span>Die Woche steht.</span></div><div class="step"><b>2 · Trainieren</b><span>An der Gym Monster.</span></div><div class="step"><b>3 · Sync</b><span>Sätze kommen an.</span></div><div class="step"><b>4 · Wachsen</b><span>Der Plan zieht mit.</span></div></div>`),
  (n) => page(n, 'Der Wochenplan', `
    <div class="kicker">Jede Woche neu</div>
    <h1>Ein Plan aus deinen Zahlen, nicht aus einem Standardprogramm.</h1>
    <p class="lead">Muskelgruppen, Fokus und die Einheiten dieser Woche. Öffne eine Übung für Sätze, Gewicht und den Grund des Vorschlags.</p>
    <div class="mock">
      <div class="row" style="gap:6px;margin-bottom:10px"><span class="pill orange">Brust</span><span class="pill">Rücken</span><span class="pill">Beine</span><span class="pill">Schultern</span></div>
      <div style="margin-bottom:6px;font-size:12px;color:#9a9ca3">Brust · 12 / 16 Sätze</div>
      <div class="bar"><span style="width:75%"></span></div>
      <div style="margin:10px 0 6px;font-size:12px;color:#9a9ca3">Rücken · 10 / 16 Sätze</div>
      <div class="bar"><span style="width:62%"></span></div>
      <div class="card" style="margin-top:12px"><b>Montag · Full Body A · Kraft</b><p>1. Dual-Handle Bench Press · 4×8–12 · 32 kg<br>2. Lat Pulldown · 4×8–12 · 40 kg</p></div>
    </div>
    <div class="grid3" style="margin-top:12px">
      <div class="card"><h2>Ein Plan</h2><p>Die Erholung verteilt Übungen über die Woche. Ein müder Muskel kommt nicht am nächsten Tag wieder.</p></div>
      <div class="card"><h2>Aktivitäten</h2><p>Gehen, Schwimmen oder eine Sportart neben dem Krafttraining. Apple Health füllt den Balken, wenn du es geschafft hast.</p></div>
      <div class="card"><h2>Selbst nachsteuern</h2><p>Eine Einheit löschen oder ersetzen. Der Rest der Woche bleibt. Übungen klappst du auf, wenn du sie sehen willst.</p></div>
    </div>`),
  (n) => page(n, 'Selbst zusammenstellen', `
    <div class="kicker">Der Editor</div>
    <h1>Pass jeden Vorschlag an. Oder bau deine eigene Einheit.</h1>
    <p class="lead">Bearbeite eine Einheit aus dem Plan, fang leer an, kopiere eine oder wähle eine Vorlage. Figur und Sätze pro Muskel rechnen sofort mit.</p>
    <div class="grid3">
      <div class="card"><h2>Alles pro Satz</h2><p>Wiederholungen, Gewicht, Pause und der Modus der Gym Monster: Standard, exzentrisch, isokinetisch, konstant oder Spotter. Pyramide und Aufwärmsatz in einem Klick.</p></div>
      <div class="card"><h2>Supersätze</h2><p>Zwei oder mehr Übungen im Wechsel, ohne Pause dazwischen. Am Gerät sind das wechselnde Schritte, mit Pause nach jeder Runde.</p></div>
      <div class="card"><h2>Übungen ansehen</h2><p>Nach Muskel, Art und Material, mit Video, Hinweisen und Erklärung. Einmal geholt und auf deinem Server gespeichert.</p></div>
      <div class="card"><h2>Fest, und trotzdem voran</h2><p>Eine bearbeitete Einheit bleibt bei einem neuen Plan stehen. Die Gewichte wachsen mit, außer wo du das Gewicht festgesetzt hast.</p></div>
      <div class="card"><h2>Vorlagen teilen</h2><p>Speichere eine Einheit als Vorlage. Auf einem Server mit mehreren Personen hat jeder seine eigene Geschichte.</p></div>
      <div class="card"><h2>Der KI-Coach schaut mit</h2><p>Auch bei deiner eigenen Einheit. Der Aufbau bleibt; jeder Vorschlag hat einen Grund, und du hakst an, was du übernimmst.</p></div>
    </div>
    <p class="note">Aufwärmen und Cool-down stellst du genauso zusammen. Die Reihenfolge folgt der Kabelposition, damit du am Gerät nicht ständig umsteckst.</p>`),
  (n) => page(n, 'Körper', `
    <div class="kicker">Withings und Apple Health</div>
    <h1>Dein Körper, neben dem Training.</h1>
    <p class="lead">Waage und iPhone füllen denselben Tab. Die Farbe sagt, ob der Wert gesünder wurde, nicht ob die Zahl stieg.</p>
    <div class="tiles">
      <div class="tile"><span>Gewicht</span><b>82,4</b></div>
      <div class="tile"><span>Fett</span><b>18%</b></div>
      <div class="tile"><span>Muskel</span><b>64 kg</b></div>
      <div class="tile"><span>FFMI</span><b>21</b></div>
      <div class="tile"><span>Pulswelle</span><b>6,4</b></div>
      <div class="tile"><span>HRV</span><b>48</b></div>
      <div class="tile"><span>VO2max</span><b>44</b></div>
      <div class="tile"><span>Score</span><b>6,3</b></div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="card"><h2>Die Farbe folgt dem Score</h2><p>Grüner, wenn der Wert den Gesundheitsscore nach oben zieht. Ein BMI Richtung 22 wird grüner, auch wenn die Zahl sinkt. Ein steigender Ruhepuls wird röter, denn höher ist hier kein Fortschritt.</p></div>
      <div class="card"><h2>Zusammensetzung</h2><p>Fett, Muskelmasse und die Verteilung auf Arme, Beine und Rumpf. ECW/TBW ist das Wasser außerhalb der Zellen geteilt durch das gesamte Körperwasser; unter 0,40 ist üblich. Die Zahlen kommen von der Withings-Waage, sobald sie verbunden ist.</p></div>
      <div class="card"><h2>Herz und Kondition</h2><p>Ruhepuls, HRV, VO2max und Pulswellengeschwindigkeit aus Apple Health. Schritte und Aktivitäten desselben iPhones füllen das Wochenziel.</p></div>
      <div class="card"><h2>Kein medizinisches Urteil</h2><p>Score und Farben fassen deine eigenen Messungen zusammen, damit du die Richtung siehst. Sie ersetzen keinen Arzt.</p></div>
    </div>`),
  (n) => page(n, 'Zurückblicken', `
    <div class="kicker">Zahlen über längere Zeit</div>
    <h1>Zurückblicken: Kraft, Volumen und Erholung in einem Tab.</h1>
    <p class="lead">Früher hieß das Analyse. Dieselben Grafiken, plus Drucken und ein PDF des ganzen Tabs.</p>
    <div class="grid2">
      <div class="card"><h2>Kraftindex</h2><p>100 ist dein Start. Die Linie ist der Median deiner Einheiten, damit ein Ausreißer das Bild nicht zieht. Eine Einheit, die mehr als 15% von diesem Median abweicht, zählt nicht.</p></div>
      <div class="card"><h2>Volumen und Sätze</h2><p>Summe pro Woche, pro Muskel, und ob die Woche im Gleichgewicht ist. Ein Muskel, der zurückbleibt, taucht im nächsten Plan auf.</p></div>
      <div class="card"><h2>Wann und Erholung</h2><p>An welchen Tagen du trainiert hast, wie lange du erholt hast, und ob die verbrannte Energie mit dem Gewicht mitläuft.</p></div>
      <div class="card"><h2>Kilometer und Schritte</h2><p>Cardio und der Schrittzähler neben dem Krafttraining, aus Apple Health. Die Woche, wie du sie wirklich bewegt hast.</p></div>
      <div class="card"><h2>Drucken und PDF</h2><p>Der ganze Tab passt auf Papier. Ein Block, der nicht mehr auf die Seite passt, rutscht vollständig auf die nächste.</p></div>
      <div class="card"><h2>Rekorde</h2><p>Dein schwerster Satz pro Übung, und wann er fiel. Der Bericht nach der Einheit mailt dieselbe Art Zahlen pro Sitzung.</p></div>
    </div>`),
  (n) => page(n, 'Nach jeder Einheit', `
    <div class="kicker">In deinem Postfach</div>
    <h1>Dein Trainingsbericht, von selbst nach jeder Einheit.</h1>
    <p class="lead">Sobald die Einheit da ist, macht GymCoach ein PDF und schickt es dir. Oder du öffnest es in der App.</p>
    <div class="grid2">
      <div class="card"><h2>Kennzahlen</h2><p>Dauer, Sätze, Volumen, Kalorien und Puls, plus die Figur mit den Sätzen pro Muskel.</p></div>
      <div class="card"><h2>Gegen das letzte Mal</h2><p>Dauer, Volumen, Sätze und Puls gegen den Schnitt der letzten vier Male derselben Einheit.</p></div>
      <div class="card"><h2>Zeit unter Spannung</h2><p>Wie viel der Einheit echte Arbeit war, wie viel Pause, und wie lange pro Wiederholung.</p></div>
      <div class="card"><h2>Puls mit Zonen</h2><p>Der Verlauf der Apple Watch, mit den Minuten pro Zone, von Erholung bis maximal.</p></div>
      <div class="card"><h2>Jede Übung</h2><p>Sätze, Wiederholungen, Gewicht und Rekorde gegen das letzte Mal, und ob die letzten Wiederholungen langsamer wurden.</p></div>
      <div class="card"><h2>Dein eigenes Postfach</h2><p>An oder aus pro Nutzer unter Einstellungen → E-Mail. Funktioniert mit jedem eigenen SMTP-Server. Der Bericht in der Broschüre sind Beispieldaten.</p></div>
    </div>`),
  (n) => page(n, 'Auf dich abgestimmt', `
    <div class="kicker">Männer, Frauen, und deine Erholung</div>
    <h1>Dasselbe Programm, andere Zahlen.</h1>
    <p class="lead">Geschlecht, Puls und Erholung bestimmen Pause, Sätze und Farben. Jeder behält seine eigene Geschichte.</p>
    <div class="grid2">
      <div class="card"><h2>Pause und Sätze</h2><p>Frauen bekommen standardmäßig etwa 20% kürzere Pausen und wo es passt einen Satz extra. Die Formeln für den Maximalpuls unterscheiden sich. Die Pause kannst du auch selbst festsetzen.</p></div>
      <div class="card"><h2>Deine Erholung</h2><p>Nach einer harten Einheit wartet eine Muskelgruppe länger. Das ist dein Muster, keine Tabelle aus einem Buch. Die Woche schiebt die Übung auf einen Tag, an dem der Muskel wieder kann.</p></div>
      <div class="card"><h2>Sprache</h2><p>Niederländisch, Englisch, Deutsch und Norwegisch. Die Broschüre gibt es auf Niederländisch, Englisch und Deutsch.</p></div>
      <div class="card"><h2>Anleitung</h2><p>Einstellungen → Anleitung, und auf dem iPhone unter Mehr. Verbinden, wie gemessen wird, der Gesundheitsscore, und jeder Bildschirm mit einem Beispiel.</p></div>
    </div>
    <div class="card" style="margin-top:10px"><h2>Was du selbst einträgst</h2><p>Geschlecht, Geburtsdatum, Größe und Einheiten stehen unter Einstellungen. Schrittziel, Aktivitäten und Körperziel stehen auf dem Tab Ziel. Die Waage verbindest du einmal; danach kommen die Messungen von selbst.</p></div>`),
  (n) => page(n, 'Technik', `
    <div class="kicker">Auf deinem eigenen Server</div>
    <h1>Kein Konto bei uns. Kein Abo.</h1>
    <p class="lead">GymCoach ist Open Source (MIT). Die Seite spricht nur mit deinem Server. Trainingsdaten gehen an keinen Dritten, außer den Verbindungen, die du selbst einschaltest.</p>
    <div class="card"><h2>Installieren</h2><p>git clone, dann bash install.sh, dann den Browser auf http://ip-des-servers:8765. Node.js 22.5 oder neuer. Linux. Getestet mit Gym Monster Modell 1.</p></div>
    <div class="grid2" style="margin-top:10px">
      <div class="card"><h2>Nötig</h2><ul><li>Speediance Gym Monster</li><li>Ein Linux-Server mit Node 22.5+</li><li>Ein Browser auf dem Laptop</li></ul></div>
      <div class="card"><h2>Optional</h2><ul><li>Withings-Waage</li><li>GymCoach Sync auf dem iPhone</li><li>Eigenes Postfach (SMTP)</li><li>Claude oder ein lokales Modell</li></ul></div>
    </div>
    <p class="note">Die iPhone-App liest nur: Übersicht, Plan, Ziel und Körper. Apple Health koppelt mit einem eigenen Schlüssel, nicht mit deiner Anmeldung. Den Schlüssel erstellst du in GymCoach; auf dem Telefon trägst du die Adresse der Seite ein.</p>`),
  (n) => page(n, 'Ziel', `
    <div class="kicker">Worauf du hinarbeitest</div>
    <h1>Ein Ziel für Körper, Kraft, Schritte und Aktivitäten.</h1>
    <p class="lead">Der Tab Ziel hält die Linie. Die Waage selbst bleibt unter Körper. Profil und Einheiten bleiben unter Einstellungen.</p>
    <div class="grid2">
      <div class="card"><h2>Körper</h2><p>Wähle, wie viele Kilo du bewegen willst und in wie vielen Wochen. GymCoach zieht die gerade Linie und setzt deine Wiegungen daneben. Fettanteil und Muskelmasse können mit, wenn du sie einträgst.</p></div>
      <div class="card"><h2>Kraft pro Muskelgruppe</h2><p>Bis zu sechs Muskelgruppen, mit einem Prozent und einem Datum. Der Plan wählt die passenden Übungen. Du musst nicht Übung für Übung ein Ziel setzen.</p></div>
      <div class="card"><h2>Schritte</h2><p>Ein Ziel pro Tag. Das iPhone liefert die Zahl über Apple Health, zusammen mit den übrigen Tagessummen.</p></div>
      <div class="card"><h2>Aktivitäten</h2><p>Gehen, Schwimmen, Padel: wie oft, wie lange, und auf Wunsch eine Distanz. GymCoach schlägt Ziele aus deinen letzten vier Wochen vor. Apple Health färbt den Balken, wenn es geklappt hat.</p></div>
      <div class="card"><h2>Essen</h2><p>Die Zielaufnahme kommt aus Mifflin-St Jeor, mit deinem Ziel verrechnet, plus eine Proteinmenge. Stundenwerte aus Apple Health werden zu einer Tagessumme addiert.</p></div>
      <div class="card"><h2>Der Plan bleibt deiner</h2><p>Der Plan kann deinem Ziel folgen, wenn du das einschaltest. Lässt du es aus, bleibt der Plan wie er war, und nur die Grafik folgt deiner Linie.</p></div>
    </div>`),
  (n) => page(n, 'Gesundheitsscore', `
    <div class="kicker">0 bis 10</div>
    <h1>Ein Score aus deinen eigenen Messungen.</h1>
    <p class="lead">Höher ist besser. Der Score steht auf Übersicht und auf Körper, und in GymCoach Sync unter denselben Überschriften.</p>
    <div class="mock">
      <div class="row" style="align-items:center"><div><div class="kicker">Jetzt</div><b style="font-size:28px">6,3</b></div><div style="flex:1;margin-left:16px"><div class="bar"><span style="width:63%"></span></div></div></div>
      <table class="mini" style="margin-top:8px"><tr><td>Körper</td><td>Fett, viszerales Fett, FFMI, BMI, Knochen</td></tr><tr><td>Herz</td><td>Ruhepuls, Pulswelle, Gefäßalter</td></tr><tr><td>Kondition</td><td>VO2max und HRV</td></tr><tr><td>Weiteres</td><td>Nerv, Stoffwechselalter, ECW/TBW</td></tr></table>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="card"><h2>Der Pfeil ist nicht das Ziel</h2><p>Eine steigende Zahl ist nicht von selbst gut. Die Farbe schaut, ob der Wert den Score nach oben oder unten zieht. Ein sinkender Fettanteil wird grün, ein steigender Ruhepuls rot.</p></div>
      <div class="card"><h2>Auf dem iPhone</h2><p>Überschriften je Kategorie, ein Symbol je Messung, und eine Tabelle mit dem Verlauf. Nur lesen: ändern tust du auf der Seite.</p></div>
    </div>
    <p class="note">Der Score hilft, deine eigene Messreihe zu verfolgen. Er ist keine Diagnose und kein ärztlicher Rat.</p>`),
  (n) => page(n, 'Anleitung', `
    <div class="kicker">In der App und auf dem iPhone</div>
    <h1>Erklärung zu jedem Bildschirm, mit einem Beispiel.</h1>
    <p class="lead">Einstellungen → Anleitung. Auf dem iPhone steht dasselbe unter Mehr. Die Bilder sind von einem Beispielnutzer, damit du siehst, was jeder Block zeigt.</p>
    <div class="grid2">
      <div class="card"><h2>Neu: verbinden</h2><p>Withings: der Verwalter legt eine App auf developer.withings.com an, danach Withings verbinden. Apple Health: in GymCoach einen Kopplungsschlüssel (beginnt mit gch_), auf dem iPhone die Adresse der Seite. Das ist nicht die Ingest-Adresse.</p></div>
      <div class="card"><h2>Die Bildschirme</h2><p>Übersicht, Plan, Ziel, Körper, Training, Zurückblicken und Einstellungen. Pro Tab eine nummerierte Seite und eine Nahaufnahme je Block, mit dem, was du dort siehst.</p></div>
      <div class="card"><h2>Wie gemessen wird</h2><p>Steigerung, Erholung, der Gesundheitsscore und woher eine Zahl kommt. Dieselbe Geschichte wie diese Broschüre, neben den Knöpfen, die du wirklich benutzt.</p></div>
      <div class="card"><h2>Unterwegs</h2><p>GymCoach Sync zeigt Übersicht, Plan, Ziel, Körper und den Score. Ändern, Mail und die Verbindungen bleiben auf der Seite. Ohne WLAN zu Hause kann der Health-Sync warten, wenn du das so einstellst.</p></div>
    </div>
    <p class="note">Die Anleitung folgt der Sprache der App: Niederländisch, Englisch, Deutsch oder Norwegisch.</p>`),
];

copy.nl.pages = copy.nl.pages;
copy.en = { foot: 'GymCoach · sample data', pages: enPages };
copy.de = { foot: 'GymCoach · Beispieldaten', pages: dePages };

const names = [
  'brochure-1-voorkant',
  'brochure-2-wat-gymcoach-doet',
  'brochure-3-weekplan',
  'brochure-4-zelf-samenstellen',
  'brochure-5-lichaam',
  'brochure-6-inzicht',
  'brochure-7-trainingsrapport',
  'brochure-8-afgestemd-op-jou',
  'brochure-9-techniek',
  'brochure-10-doel',
  'brochure-11-score',
  'brochure-12-handleiding',
];

for (const lang of ['nl', 'en', 'de']) {
  const dir = join(outDir, lang);
  mkdirSync(dir, { recursive: true });
  const pages = copy[lang].pages.map((fn, i) => fn(i + 1));
  pages.forEach((html, i) => {
    writeFileSync(join(dir, `${names[i]}.html`), shell(html));
  });
  writeFileSync(join(dir, 'alle.html'), shell(pages.join('\n')));
}

writeFileSync(join(outDir, 'paginas.json'), JSON.stringify(names, null, 2));
console.log('brochure html', names.length, 'pagina\'s × 3 talen');
