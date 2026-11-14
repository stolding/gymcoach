// „So funktioniert GymCoach“ (Deutsch): was die App macht und die Entscheidungen hinter den Berechnungen.
// Jeder Abschnitt hat eine id, damit die App direkt zu einem Teil springen kann. Gleiche ids wie explain.nl.js.

export default [
  {
    id: 'kort', title: 'Kurz gesagt',
    html: `<ol>
      <li><b>Abrufen.</b> GymCoach holt deine Trainings aus deinem Speediance-Konto: pro Übung die Sätze, Wiederholungen, Gewichte, Zeiten und (wenn du einen Brustgurt trägst) deine Herzfrequenz.</li>
      <li><b>Planen.</b> Feste Regeln machen aus deinen Einstellungen und deinem Verlauf einen Wochenplan. Der KI-Coach (falls eingerichtet) darf danach Vorschläge machen, aber nur innerhalb von Grenzen, und du entscheidest.</li>
      <li><b>Aufs Gerät.</b> Mit einem Klick ist ein Training als Programm auf deinem Gym Monster, mit Gewichten, Wiederholungen und Pausen schon ausgefüllt.</li>
      <li><b>Rückblick.</b> Nach jedem Training ein Bericht; dazu Training und Rückblick, zusammen mit deinen Withings-Messungen und deinen Aktivitäten aus Apple Health.</li>
    </ol>
    <p>Alles läuft auf deinem eigenen Server. Deine Daten gehen nur an Speediance, Withings und Apple (die du selbst verbindest) und, wenn du den KI-Coach nutzt, an den KI-Dienst, den der Administrator gewählt hat.</p>`,
  },
  {
    id: 'plan', title: 'Der Wochenplan',
    html: `<p><b>Aufteilung.</b> Die Zahl der Trainings pro Woche bestimmt die Aufteilung: 2 oder 3 Tage Ganzkörper (A/B/C), 4 Tage Oberkörper/Unterkörper. Jedes Training füllt feste Bewegungsmuster (Drücken, Ziehen, Kniebeuge, Hüftbeuge, …) mit einer Übung aus dem Katalog deines Geräts.</p>
    <p><b>Vorgabe pro Ziel</b> (Arbeitssätze):</p>
    <table class="about-tbl"><thead><tr><td></td><td>Grundübung</td><td>Isolation</td></tr></thead><tbody>
      <tr><td class="muted">Muskelaufbau</td><td>3 × 8–12, 90 s Pause</td><td>3 × 10–15, 60 s</td></tr>
      <tr><td class="muted">Kombination</td><td>3 × 10–12, 60 s</td><td>3 × 12–15, 45 s</td></tr>
      <tr><td class="muted">Abnehmen</td><td>3 × 12–15, 45 s</td><td>2 × 15–20, 30 s</td></tr>
      <tr><td class="muted">Cardio-Zirkel</td><td colspan="2">3 × 15–20, leicht (60 %), 20 s Pause</td></tr>
    </tbody></table>
    <p class="muted small">Fortgeschritten: ein zusätzlicher Satz bei Grundübungen. Neue Übung: zuerst zwei Einheiten mit 2 Sätzen, für die Technik.</p>
    <p><b>Progression</b> (doppelte Progression): Schaffst du in allen Sätzen das obere Ende des Wiederholungsbereichs, steigt das Gewicht (+2 kg Grundübung, +1 kg Isolation) und du beginnst wieder unten. Schaffst du das untere Ende, +1 Wiederholung. Zweimal hintereinander unter dem Ziel: −10 %.</p>
    <p><b>Deload.</b> Alle soundso viele Trainingswochen (einstellbar, Standard 6) eine leichtere Woche: ein Satz weniger und 10 % leichter. Wochen ohne Training zählen nicht.</p>
    <p><b>Zubehör.</b> Wenn du ein Zubehör nicht nutzt (Stange, Bank, Griffe, Seil, Gurt, Ruder-/Skigriff oder Matte), schalte es unter Einstellungen → Training aus. Übungen, die es brauchen, erscheinen dann nicht mehr in deinem Plan, beim Tauschen oder in den Vorschlägen des KI-Coachs. GymCoach leitet aus dem Namen (zum Beispiel <i>Barbell</i>, <i>Rope</i>, <i>Incline</i>, <i>Seated</i>) und der Art der Übung ab, welches Zubehör sie braucht.</p>
    <p><b>Fokus und Zeit.</b> Fokusbereiche kommen zuerst und bekommen einen zusätzlichen Satz, solange das Training innerhalb deiner eingestellten Zeit bleibt. GymCoach schätzt die Dauer mit 4 s pro Wiederholung plus Pausen.</p>
    <p><b>Selbst bearbeiten.</b> Mit <i>Bearbeiten</i> änderst du ein Training: Sätze, Wiederholungen, Gewicht, Pause und Modus pro Satz (Standard, exzentrisch, isokinetisch, konstant, Spotter), die Reihenfolge, das Aufwärmen und das Cool-down. Die Figur und die Sätze pro Muskelgruppe für die ganze Woche aktualisieren sich sofort. Ein bearbeitetes Training ist <i>fixiert</i>: bei einem neuen Vorschlag bleibt es, und die Gewichte folgen deiner Progression, außer bei Übungen mit <i>festem Gewicht</i>. Mit <i>Löschen</i> nimmst du ein Training aus dieser Woche, mit <i>Ersetzen</i> setzt du ein anderes an seine Stelle. Die anderen Trainings bleiben.</p>
    <p><b>Supersätze.</b> Zwei oder mehr Übungen abwechselnd, ohne Pause dazwischen; nach jeder Runde die Pause der letzten Übung. Auf dem Gym Monster erscheinen sie als abwechselnde Schritte (A1, A2, A1, A2 …), weil ein Programm keine Supersätze kennt.</p>
    <p><b>Eigene Trainings und Vorlagen.</b> Mit <i>+ Neues Training</i> baust du ein Training selbst (leer, als Kopie oder aus einer Vorlage). Unter <i>Trainings</i> speicherst du ein Training als Vorlage und kannst es mit allen auf deinem Server teilen. Wer eine geteilte Vorlage in seinen Plan holt, bekommt Gewichte aus dem eigenen Verlauf oder ein Startgewicht, wenn er die Übung noch nicht gemacht hat.</p>
    <p><b>Eine Woche.</b> Mit <i>Woche als ein Plan</i> an (Einstellungen → Training) rückt eine Übung auf einen späteren Tag, wenn der Hauptmuskel noch nicht erholt ist. Ober- und Unterkörper bleiben getrennt, ein fixiertes Training bleibt stehen, und die Wochensumme pro Muskelgruppe bleibt gleich. Der Plan zeigt die Erholung zu Beginn jedes Trainings. Schalte es aus und erstelle einen neuen Wochenplan, um die festen Tage zurückzubekommen.</p>
    <p><b>Vorige Wochen.</b> GymCoach bewahrt jeden Wochenplan auf. Mit den Pfeilen neben dem Wochentitel blickst du zurück: pro Übung, was geplant war und was du gemacht hast, mit ✓ (geschafft), ↓ (weniger Sätze, Wiederholungen oder Gewicht), ↑ (mehr) oder – (nicht gemacht). Ein gutes Training holst du in diese Woche zurück oder speicherst es als Vorlage.</p>
    <p><b>Wochennummer.</b> Der Plan trägt die Kalenderwoche, in der er erstellt wurde, zum Beispiel <i>GC 2026-W45 Full Body A</i> auf deinem Gerät.</p>`,
  },
  {
    id: 'persoonlijk', title: 'Männer, Frauen und Alter',
    html: `<p>Forschung zeigt, dass Männer und Frauen Muskelmasse und Kraft <b>relativ gleich schnell</b> aufbauen; im Oberkörper machen Frauen relativ sogar etwas schneller Fortschritte (Roberts et al., 2020, Metaanalyse). Männer beginnen allerdings höher, vor allem im Oberkörper. Muskeln, Übungen und Prinzipien sind für alle gleich.</p>
    <p>Wo es doch einen Unterschied macht, und was GymCoach damit tut:</p>
    <ul>
      <li><b>Erholung zwischen Sätzen.</b> Frauen erholen sich zwischen Sätzen meist schneller (in einer Studie schafften sie mit kurzer Pause fast doppelt so viele Wiederholungen; bei einem einzelnen Satz gab es keinen Unterschied). <i>GymCoach:</i> 20 % kürzere Pausen für Frauen.</li>
      <li><b>Volumen.</b> Frauen vertragen oft etwas mehr Volumen pro Training, ohne sich langsamer zu erholen. <i>GymCoach:</i> Fokusübungen bis zu 5 Sätze statt 4, und Grundübungen einen zusätzlichen Satz, wenn die Zeit es zulässt (nicht in einer Deload-Woche).</li>
      <li><b>Maximale Herzfrequenz.</b> Für Frauen gibt es eine eigene, besser passende Formel: Gulati, 206 − 0,88 × Alter. Für Männer und allgemein: Tanaka, 208 − 0,7 × Alter. Wenn du dein echtes Maximum aus einem Test kennst, trage es ein; es hat immer Vorrang.</li>
      <li><b>Deine eigene Erholung zählt am meisten.</b> Die Unterschiede zwischen Menschen sind größer als zwischen Männern und Frauen. Darum schaut GymCoach auch auf deine eigenen Sätze: Sinken deine Wiederholungen in späteren Sätzen im Schnitt um 20 % oder mehr, wird die Pause 25 % länger; schaffst du dreimal hintereinander in jedem Satz alle Wiederholungen, etwas kürzer (−10 %). Die Pause bleibt zwischen 30 s (Isolation 20 s) und 180 s.</li>
      <li><b>Alter.</b> Bestimmt die geschätzte maximale Herzfrequenz, die Richtwerte für Körperfett, die VO2max-Grenzen und die Pulswellengeschwindigkeit. Das Geburtsdatum setzt das Alter im Gesundheitsstatus am Messtag; ohne Datum gilt das Geburtsjahr. Der KI-Coach erhält dein Alter und Geschlecht und weiß, dass Krafttraining ab etwa 50 Jahren für Knochen und Muskelmasse besonders wichtig wird.</li>
      <li><b>Körperfigur.</b> Die Muskelkarten zeigen eine männliche, weibliche oder neutrale Figur. Nur die Form unterscheidet sich.</li>
    </ul>
    <p class="muted small">Bei <i>nicht-binär</i>, <i>anderes</i> oder <i>möchte ich nicht angeben</i> wählst du selbst, welche Tabelle GymCoach verwendet (oder keine: dann die allgemeinen Werte) und welche Figur du siehst. Was du wählst, wirkt sich nur auf diese Berechnungen aus.</p>`,
  },
  {
    id: 'meten', title: 'Wie GymCoach misst',
    html: `<dl class="explain-dl">
      <dt>Geschätztes 1RM</dt><dd>Das Gewicht, das du einmal heben könntest, geschätzt mit der Epley-Formel: Gewicht × (1 + Wiederholungen ÷ 30). So lassen sich Sätze mit unterschiedlichen Wiederholungen fair vergleichen. Pro Training zählt der beste Satz.</dd>
      <dt>Volumen</dt><dd>Wiederholungen × Kilo, über alle Sätze addiert: wie viel Arbeit du geleistet hast. GymCoach verwendet das Volumen, das der Gym Monster pro Satz speichert; bei Übungen mit zwei Griffen zählen beide Seiten (2 × das Gewicht pro Griff). Gewichte und geschätztes 1RM gelten pro Griff, wie auf dem Gerät.</dd>
      <dt>Muskelkarte</dt><dd>Jede Übung zählt für die Muskelgruppen, die sie trainiert: der Hauptmuskel als 1 Satz, unterstützende Muskeln als ½ Satz.</dd>
      <dt>Kraftindex</dt><dd>Pro Muskelgruppe das geschätzte 1RM im Verhältnis zum ersten Mal im gewählten Zeitraum (= 100). 110 heißt 10 % stärker.</dd>
      <dt>Gleichgewicht</dt><dd>Arbeitssätze Drücken gegenüber Ziehen und Oberkörper gegenüber Unterkörper. Etwa 1 : 1 ist ausgeglichen.</dd>
      <dt>Rekorde</dt><dd>Ein Rekord ist ein Training, in dem eine Übung ein höheres geschätztes 1RM erreicht hat als je zuvor.</dd>
      <dt>Vergleich im Bericht</dt><dd>Mit dem Durchschnitt der letzten 4 Male, die du dasselbe Training gemacht hast (die Wochennummer im Namen zählt nicht), sonst mit deinen letzten 4 Trainings.</dd>
      <dt>Zeit unter Spannung und Pausen</dt><dd>Aus den Zeiten, die der Gym Monster pro Wiederholung und pro Pause speichert.</dd>
      <dt>Herzfrequenz</dt><dd>Pro Satz vom Gym Monster (mit Brustgurt); der Verlauf über das ganze Training, einschließlich der Pausen, kommt aus Apple Health (Apple Watch). Zonen: 50–60 % deines Maximums Erholung, 60–70 % Grundlage, 70–80 % aerob, 80–90 % Schwelle, 90 %+ Maximum.</dd>
      <dt>Erholung</dt><dd>Der Erholungswert nutzt deinen Ruhepuls aus Apple Health (Apple Watch): den Durchschnitt der letzten 7 Tage gegenüber den 4 Wochen davor. Gibt es weniger als 10 solcher Tage, dann die Messungen der Withings-Waage. Im Rückblick und unter Körper kommt der Ruhepuls aus Apple Health, sobald es Tage gibt, sonst von der Waage. 3 Schläge höher: Achtung; 5 oder mehr: wahrscheinlich nicht erholt, oder du wirst krank.</dd>
      <dt>Körper</dt><dd>BMI nach der WHO. Körperfett nach den Tabellen von Gallagher et al. (2000), nach Alter und Geschlecht. FFMI (fettfreie Masse ÷ Größe²), mit Grenzen nach Geschlecht. Pulswellengeschwindigkeit mit Grenzen nach Alter; ein höherer Wert bedeutet steifere Gefäße. Gewicht, Fett, Muskelmasse, FFMI und Pulswellengeschwindigkeit kommen von der Withings-Waage. Ruhepuls, HRV und VO2max auf derselben Seite kommen von der Apple Watch.</dd>
      <dt>Energie und Schritte</dt><dd>Aktive Energie aus Apple Health (was du über deinen Grundumsatz hinaus verbrennst); ohne Apple Health die Kalorien deiner Trainings. Schrittziel standardmäßig 8.000 pro Tag.</dd>
    </dl>
    <p class="muted small">Alle Werte sind Schätzungen für deinen eigenen Fortschritt, keine medizinischen Messungen.</p>`,
  },
  {
    id: 'signalen', title: 'Signale: Erholung und Anpassen',
    html: `<p>GymCoach legt Daten aus verschiedenen Quellen nebeneinander. Jedes Signal für sich sagt wenig; zusammen sagen sie mehr.</p>
    <dl class="explain-dl">
      <dt>Verlangsamung im Satz</dt><dd>Der Gym Monster speichert die Zeit pro Wiederholung. GymCoach vergleicht die letzten zwei Wiederholungen mit den ersten zwei. Bis 25 % langsamer ist frisch, 25–40 % schwer, ab 40 % ging der Satz bis zum Limit. Forschung zum Geschwindigkeitsverlust zeigt, dass ein Abbruch bei etwa 20–25 % die Kraft begünstigt und Weitermachen mehr Muskelwachstum bringen kann (Hickmott et al. 2022). Schaffst du alle Wiederholungen, aber die letzten waren 40 % oder mehr langsamer, bleibt das Gewicht noch einmal gleich. Bewusst langsame Modi (exzentrisch, isokinetisch) zählen nicht.</dd>
      <dt>Erholungswert</dt><dd>Aus dem Ruhepuls (Apple Health, der Tageswert der Apple Watch; bei weniger als 10 Tagen die Waage) und der HRV (ebenfalls Apple Health), die letzten 7 Tage gegenüber den 4 Wochen davor, plus den geschafften Wiederholungen und der Verlangsamung in deinen letzten drei Trainings. Der Ruhepuls schwankt von Tag zu Tag um etwa 10 %, die HRV um 10–20 % (Buchheit 2014); ein einzelnes abweichendes Signal sagt daher nichts: erst wenn zwei oder mehr in dieselbe Richtung zeigen, steht der Wert auf <i>Achtung</i>, bei deutlichen Abweichungen auf <i>ruhig angehen</i>. Dann kannst du das nächste Training leichter machen (10 % weniger Gewicht, ein Satz weniger), und die Deload-Woche kommt früher als im festen Rhythmus. Die HRV zählt mit, entscheidet aber nie allein: beim Krafttraining brachte HRV-gesteuertes Training keinen zusätzlichen Gewinn (Bittencourt et al. 2024); beim Ausdauertraining einen kleinen Vorteil (Granero-Gallegos et al. 2020).</dd>
      <dt>Abnehmtempo</dt><dd>Beim Abnehmen vergleicht GymCoach deinen wöchentlichen Gewichtsverlust mit deiner Muskelmasse (Withings, letzte 4 Wochen). Athleten, die ~0,7 % pro Woche abnahmen, behielten ihre Muskelmasse; bei ~1,4 % pro Woche nicht (Garthe et al. 2011). Nimmst du schneller als ~1 % pro Woche ab und sinkt deine Muskelmasse, bekommst du einen Tipp; der Plan hält das Trainingsvolumen.</dd>
      <dt>Cardio kurz vor dem Krafttraining</dt><dd>Ein Spaziergang oder eine Radtour, die innerhalb von 3 Stunden vor einem Krafttraining endete, steht im Bericht. Ausdauer- und Krafttraining zusammen kosten keine Muskelmasse oder Maximalkraft, aber etwas Schnellkraft, wenn beides in einer Einheit liegt; nicht mit 3 Stunden oder mehr dazwischen (Schumann et al. 2021).</dd>
      <dt>HRV und VO2max</dt><dd>Von der Apple Watch, über GymCoach Sync oder Health Auto Export. Die HRV (SDNN, in ms) unterscheidet sich stark zwischen Menschen: vergleiche mit dir selbst. VO2max ist eine Schätzung der Apple Watch und zeigt, was Gehen und Cardio bringen. Die Grafik setzt die Schätzung gegen grobe Grenzen nach Alter und Geschlecht.</dd>
    </dl>
    <p class="muted small">Das sind Beobachtungen, keine Diagnose. Ein höherer Ruhepuls kann auch auf eine Krankheit hindeuten; bei Beschwerden: zum Arzt.</p>`,
  },
  {
    id: 'ai', title: 'Der KI-Coach',
    html: `<p>Der KI-Coach erhält deine Einstellungen, Alter und Geschlecht, deine letzten Trainings, Gewicht und Aktivitäten sowie den Plan, den die Regeln erstellt haben. Er darf Übungen tauschen (nur aus deinem eigenen Katalog) und Sätze (2–5), Wiederholungen (5–20) und Gewicht (höchstens 15 %) anpassen. Jede Änderung wird geprüft, und du wählst, was du übernimmst.</p>
    <p><b>Deine eigenen Trainings.</b> Der Coach sieht, welche Trainings du selbst gebaut, bearbeitet oder fixiert hast, mit ihrer Struktur (Supersätze, Modi, Pausen, festes Gewicht). Dort schlägt er Änderungen nur mit Begründung vor, und diese Vorschläge sind standardmäßig nicht angehakt. Übernimmst du einen, bleibt die Struktur: Gewicht und Wiederholungen verschieben sich pro Satz, ein festes Gewicht ändert sich nie. Mit <i>KI-Rat</i> bei einem Training fragst du nur für dieses Training um Rat.</p>
    <p><b>Gesundheitsstatus.</b> Unter Übersicht fasst dieselbe Verbindung die Messungen der letzten 4 Wochen zusammen: Withings, die Apple Watch und das Trainingsvolumen. Der Auftrag geht von einer nüchternen Morgenmessung vor dem Duschen aus, und von einem stehenden Ruhepuls auf der Waage. Die Schlafdauer geht nicht mit, GymCoach speichert sie nicht. Es ist keine Diagnose, und der Plan ändert sich dadurch nicht.</p>
    <p>Der Coach antwortet in deiner Sprache.</p>
    <p>Bei Schmerzen oder Beschwerden: wende dich an deinen Arzt oder einen Physiotherapeuten.</p>`,
  },
  {
    id: 'bronnen', title: 'Quellen',
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
