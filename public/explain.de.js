// „So funktioniert GymCoach“ (Deutsch): was die App macht und die Entscheidungen hinter den Berechnungen.
// Jeder Abschnitt hat eine id, damit die App direkt zu einem Teil springen kann. Gleiche ids wie explain.nl.js.

export default [
  {
    id: 'starten', title: 'Neu: verbinden',
    html: `<p>Drei Verbindungen setzen GymCoach in Gang. Speediance brauchst du für den Plan und die Trainings. Waage und Apple Health können warten: ohne diese Messungen bleiben Körper, Gesundheitsscore und Aktivitäten leer.</p>
    <h4>Speediance-Konto</h4>
    <ol>
      <li>Öffne <b>Einstellungen → Speediance-Konto</b>.</li>
      <li>Trag E-Mail und Passwort deines Speediance-Kontos ein. In Europa ist die Region meist <b>EU</b>.</li>
      <li>Wähle deinen Gym Monster, oder tippe auf <b>Mein Gerät erkennen</b>.</li>
      <li><b>Speichern und testen</b>. GymCoach holt danach den Übungskatalog dieses Geräts.</li>
    </ol>
    <p>Das Passwort bleibt auf deinem eigenen Server. Stell danach unter Training Ziel, Tage und Minuten ein und mach deinen ersten Wochenplan.</p>
    <h4>Withings-Waage</h4>
    <p>Das hat zwei Teile. Zuerst legt der Administrator einmalig eine Verbindung bei Withings an. Danach verbindet jeder Benutzer die eigene Waage. Die Schlüssel stehen nicht auf der Waage und nicht in der Withings-App auf dem Telefon. Withings erzeugt sie auf der Entwicklerseite.</p>
    <p><b>Einmalig, durch den Administrator</b></p>
    <ol>
      <li>Geh zu <b>developer.withings.com</b> und melde dich mit einem Withings-Konto an.</li>
      <li>Öffne <b>Dashboard</b> und wähle <b>Create an application</b>. Typ: <b>Public API</b>. Gib der App einen Namen, zum Beispiel GymCoach.</li>
      <li>Withings zeigt danach eine <b>Client ID</b> und ein <b>Client secret</b>. Das sind die Schlüssel. Kopiere sie und lass die Seite offen, bis sie in GymCoach stehen.</li>
      <li>In GymCoach: <b>Einstellungen → Withings</b>. Den Block <b>Withings-App</b> siehst du nur als Administrator.</li>
      <li>Bei Callback-URL klickst du auf <b>Adresse dieser Seite eintragen</b>. Es erscheint eine Adresse, die auf <code>/api/withings/callback</code> endet. Klick auf <b>Kopieren</b> und füge sie bei Withings ins Callback-Feld ein. Sie muss genau gleich sein.</li>
      <li>Füge Client ID und Client secret in GymCoach ein und klick auf <b>Speichern</b>.</li>
    </ol>
    <p><b>Danach, durch jeden Benutzer</b>, auch den Administrator</p>
    <ol>
      <li>Bleib auf <b>Einstellungen → Withings</b>.</li>
      <li>Klick auf den orangen Knopf <b>Withings verbinden</b>. Eine Withings-Seite öffnet sich.</li>
      <li>Melde dich mit dem Withings-Konto der Waage an, demselben Konto wie in der Withings-App auf dem Telefon. Erlaube den Zugriff.</li>
      <li>Du siehst <b>Withings verbunden</b>. Schließ den Tab. In GymCoach steht danach <b>verbunden</b> und die Messungen sind geholt.</li>
    </ol>
    <p>Fehlt der Knopf <b>Withings verbinden</b>, hat der Administrator Client ID und Client secret noch nicht gespeichert. An der Waage selbst stellst du nichts um. Wiege wie gewohnt, möglichst nüchtern, morgens, vor dem Duschen. Der Ruhepuls auf der Waage ist eine stehende Momentmessung.</p>
    <h4>Apple Health</h4>
    <p>Den Verbindungsschlüssel erstellst du selbst in GymCoach. Den suchst du nirgends sonst. Er beginnt mit <code>gch_</code> und wird nur einmal gezeigt. Verlierst du ihn, klick auf <b>Neuer Schlüssel</b>. Der alte funktioniert dann nicht mehr.</p>
    <p><b>Am Computer, in GymCoach</b></p>
    <ol>
      <li>Geh zu <b>Einstellungen → Apple Health</b>.</li>
      <li>Klick auf <b>Verbindungsschlüssel erstellen</b>.</li>
      <li>Ein grünes Feld erscheint mit zwei Zeilen. Die Zeile <b>URL</b> endet auf <code>/api/health/ingest</code>. Die ganze Zeile fügst du nicht ins iPhone ein. Du brauchst die Adresse deines GymCoach, ohne dieses Ende. Zum Beispiel <code>https://gymcoach.stolding.com</code>, oder zu Hause <code>http://192.168.1.50:8765</code>.</li>
      <li>Die andere Zeile ist der Schlüssel. Klick auf <b>Schlüssel kopieren</b> und behalte ihn, bis er im iPhone steht.</li>
    </ol>
    <p><b>Auf dem iPhone, in GymCoach Sync</b></p>
    <p>Die App hat zwei Adressen. Die darfst du nicht vertauschen. Die Knöpfe auf dem iPhone sind auf Niederländisch.</p>
    <ol>
      <li>Installiere <b>GymCoach Sync</b> über TestFlight und öffne die App.</li>
      <li>Um den Plan zu sehen, meldest du dich mit der Adresse deiner GymCoach-Seite, deinem Benutzernamen und dem GymCoach-Passwort an. Das ist nicht der Verbindungsschlüssel.</li>
      <li>Um Apple Health zu senden: Tab <b>Meer</b> → <b>Synchroniseren</b>. Trag dort dieselbe Adresse ein, ohne <code>/api/health/ingest</code>. Ins Feld <b>Koppelsleutel</b> fügst du den Schlüssel ein, der mit <code>gch_</code> beginnt. Tipp auf <b>Toon</b>, wenn du prüfen willst, ob er stimmt.</li>
      <li>Tipp auf <b>Test verbinding</b>. Das iPhone fragt nach dem Zugriff auf Gesundheit. Erlaube, was GymCoach verlangt: Workouts, Herzfrequenz, Schritte, Energie, Distanz, Ruhepuls, HRV, VO2max und Ernährung.</li>
      <li>Tipp danach einmal auf <b>Volledige historie versturen</b>, damit ältere Wege und Tage mitkommen. Neue Daten gehen danach von selbst, höchstens einmal pro Stunde.</li>
    </ol>
    <p><b>Automatisch alleen thuis</b> heißt: nur im WLAN, und nur wenn dein Server erreichbar ist. Schalt das aus, wenn du GymCoach über das Internet nutzt. <b>Test verbinding</b> und <b>Nu synchroniseren</b> funktionieren trotzdem.</p>
    <p>GymCoach Sync liest Workouts (Gehen, Radfahren und den Rest), Herzfrequenz, Schritte, aktive Energie, Distanz, Ruhepuls, HRV, VO2max und Ernährung. Krafttrainings, die Speediance selbst nach Apple Health schreibt, lässt GymCoach aus, damit nichts doppelt zählt. Lieber eine andere App: unter Einstellungen → Apple Health steht bei <b>Oder: Health Auto Export einrichten</b>, wohin dieselbe URL und derselbe Schlüssel gehören. Der Schlüssel kommt in den Header <code>Authorization</code>, als <code>Bearer</code> gefolgt vom Schlüssel.</p>
    <p>Der Ruhepuls der Apple Watch ist der Tageswert. GymCoach nutzt ihn, sobald genug Tage da sind; sonst die Messung der Waage.</p>`,
  },
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
    id: 'schermen', title: 'Die Bildschirme',
    html: `<p>Die Bilder sind von einem Beispielnutzer, Sam Demo. Training, Waage und Apple Health sind erfunden. Auf der Übersicht eines Tabs stehen orange Nummern. Danach folgt eine Nahaufnahme jedes Blocks. Die Bilder zeigen die niederländische App.</p>
    <h4>Übersicht</h4>
    <p>Das ist die Startseite. Oben eine Begrüßung, danach die Blöcke untereinander.</p>
    <img class="guide-shot" src="/guide/overzicht.png" alt="Übersicht von Sam Demo, mit einer Nummer auf jedem Block">
    <ol>
      <li><b>Begrüßung.</b> Datum, Name und ein Hinweis, zum Beispiel ein Rekord oder wie viele Trainings diese Woche noch offen sind.</li>
      <li><b>Erholung und Score.</b> Links, ob du erholt bist (Ruhepuls, HRV, geschaffte Wiederholungen). Rechts der Gesundheitsscore von 0 bis 10, höher ist besser, mit der Linie über die Wochen.</li>
      <li><b>Muskelerholung.</b> Die Figur und eine Linie je Muskelgruppe. Orange ist ermüdet, grün ist erholt. Die Knöpfe schalten eine Muskelgruppe an oder aus.</li>
      <li><b>Nächstes Training.</b> Das nächste Training, das noch offen ist, mit der geschätzten Zeit.</li>
      <li><b>Wochenziel.</b> Der Ring zählt die Einheiten aus dem Plan, auch einen Spaziergang. Beim Wochenziel ist der Kreis voll. Machst du mehr, läuft ein hellerer oranger Ring über die äußere Hälfte, bis der ganze Plan voll ist.</li>
      <li><b>Serie.</b> Wie viele Wochen hintereinander du das Wochenziel geschafft hast.</li>
      <li><b>Volumen.</b> Kilogramm diese Woche, verglichen mit der vorigen.</li>
      <li><b>Minuten.</b> Trainingszeit und kcal diese Woche.</li>
      <li><b>Körper.</b> Letztes Gewicht, Fettanteil und die Richtung der letzten Wochen.</li>
      <li><b>Gesundheitsstatus.</b> Ein Text des KI-Coaches über die letzten vier Wochen. Ohne KI-Coach bleibt hier „Maak status“ stehen.</li>
      <li><b>Ziel.</b> Ob du im Plan liegst, mit dem Balken für kcal und Eiweiß von heute. Der Knopf öffnet den Tab Ziel.</li>
      <li><b>Kraft.</b> Geschätztes 1RM deiner schwersten Übungen der letzten vier Wochen, mit einer kleinen Linie.</li>
      <li><b>Rekorde.</b> Neue Rekorde der letzten vierzehn Tage.</li>
      <li><b>Kalender.</b> Acht Wochen. Ein Feld ist ein Trainingstag; die Farbe sind die Minuten des Tages. Ein Klick zeigt die Übungen.</li>
      <li><b>Plan dieser Woche.</b> Die Figur der geplanten Belastung, die Zahl der Trainings, die Arbeitssätze und die schwersten Muskelgruppen.</li>
    </ol>
    <img class="guide-shot" src="/guide/overzicht-herstel.png" alt="Erholung links und der Gesundheitsscore rechts">
    <p class="guide-cap muted small">Erholung und Score nebeneinander. Grün heißt, dass nichts dagegen spricht. Der Score nennt, was mitzählte, hier Fettanteil und BMI.</p>
    <img class="guide-shot" src="/guide/overzicht-spieren.png" alt="Muskelerholung mit Figur und Linien">
    <p class="guide-cap muted small">Muskelerholung. Die Figur ist der Stand jetzt. Die Linien sind die Erholung je Tag.</p>
    <img class="guide-shot" src="/guide/overzicht-volgende.png" alt="Nächstes Training und der Wochenring">
    <p class="guide-cap muted small">Links das nächste Training, rechts der Ring des Wochenziels.</p>
    <img class="guide-shot" src="/guide/overzicht-midden.png" alt="Kacheln, Gesundheitsstatus und Ziel">
    <p class="guide-cap muted small">Die vier Kacheln, darunter der Gesundheitsstatus und die Zusammenfassung des Ziels.</p>
    <img class="guide-shot" src="/guide/overzicht-kracht.png" alt="Kraft und Rekorde">
    <p class="guide-cap muted small">Kraft links, Rekorde rechts.</p>
    <img class="guide-shot" src="/guide/overzicht-kalender.png" alt="Trainingskalender und der Plan dieser Woche">
    <p class="guide-cap muted small">Kalender links, der Plan dieser Woche rechts.</p>
    <h4>Plan</h4>
    <p>Hier steht die Woche, die auf den Gym Monster kommt. Du änderst sie nur am Computer.</p>
    <img class="guide-shot" src="/guide/plan.png" alt="Tab Plan von Sam Demo">
    <ol>
      <li><b>Kopf und Knöpfe.</b> Die Woche, die Pfeile zu einer älteren Woche und die Knöpfe für ein neues Training, einen neuen Vorschlag und den KI-Coach.</li>
      <li><b>Muskeln und Zeit.</b> Vorne und hinten. Die Liste daneben ist die geplante Zeit und die Sätze je Muskelgruppe. Ein Klick zeigt die Gruppe in der Figur.</li>
      <li><b>Trainings.</b> Eine Karte je Tag: Name, Minuten, Übungen und ob er schon erledigt ist. Aufklappen zeigt Sätze und Gewichte. Darunter schickst du ihn aufs Gerät, bearbeitest ihn oder ersetzt ihn.</li>
      <li><b>Vorlagen.</b> Trainings, die du selbst speicherst, und Trainings, die auf diesem Server geteilt sind.</li>
      <li><b>Programme.</b> Was schon auf deinem Gym-Monster-Konto steht. Die Liste holst du mit Programme anzeigen.</li>
    </ol>
    <img class="guide-shot" src="/guide/plan-spieren.png" alt="Figur und die Muskelliste der Woche">
    <p class="guide-cap muted small">Die Wochenübersicht: Figur und die Verteilung auf die Muskelgruppen.</p>
    <img class="guide-shot" src="/guide/plan-sessies.png" alt="Drei Trainingskarten, zwei davon schon erledigt">
    <p class="guide-cap muted small">Die Tage der Woche. Eine erledigte Einheit hat einen durchgezogenen grünen Rand. Ein Balken unter dem Ziel zeigt, wenn du darüber hinausgingst: das Extra ist heller. Eine Aktivität draußen, die schon läuft aber das Wochenziel noch nicht erreicht, hat einen gestrichelten orangen Rand. Cardio draußen hat kein Programm auf dem Gerät; die Aktivität kommt aus Apple Health.</p>
    <h4>Ziel</h4>
    <p>Was du isst, gegenüber dem, was zum Ziel passt. Die Waage selbst bleibt unter Körper.</p>
    <img class="guide-shot" src="/guide/doel.png" alt="Tab Ziel von Sam Demo">
    <ol>
      <li><b>Soll und Stand.</b> Die berechneten kcal und das Eiweiß, und ob der heutige Tag schon dort ist.</li>
      <li><b>Ziel setzen.</b> Körper (Kilogramm und Wochen), Kraft je Muskelgruppe, Schritte je Tag und Aktivitäten je Woche. Speichern lässt das Ziel neu beginnen.</li>
      <li><b>Gewicht.</b> Deine Messungen und die gerade Linie zum Sollgewicht.</li>
      <li><b>Aufnahme.</b> Was du gegessen hast, gegen die Linie der Soll-kcal.</li>
      <li><b>Kraft.</b> Der Index der gewählten Muskelgruppe, hier der Rücken, gegen die Linie des Kraftziels.</li>
      <li><b>Tage.</b> Eine Tabelle je Tag: Training, Schritte, Aufnahme und ob es im Ziel blieb.</li>
    </ol>
    <img class="guide-shot" src="/guide/doel-formulier.png" alt="Das Formular, um ein Ziel zu setzen">
    <p class="guide-cap muted small">Das Formular. Schritte und Aktivitäten stehen darunter; die siehst du auf der ganzen Seite oben.</p>
    <h4>Körper</h4>
    <p>Die Waage und die Zusammensetzung. Keine Trainingsgrafik.</p>
    <img class="guide-shot" src="/guide/lichaam.png" alt="Tab Körper von Sam Demo">
    <ol>
      <li><b>Titel.</b> Körpergewicht.</li>
      <li><b>Waage.</b> Ob Withings verbunden ist, und ein Knopf, um selbst eine Messung einzutragen.</li>
      <li><b>Gesundheitsscore.</b> Derselbe Score wie in der Übersicht, hier mit den Kategorien Körper, Herz, Fitness und Sonstiges.</li>
      <li><b>Zusammensetzung.</b> Kacheln für Gewicht, Fett, Muskelmasse und die anderen Werte der Waage, mit einer Grafik. Grün oder rot folgt, ob der Score besser oder schlechter wird, nicht ob die Zahl stieg.</li>
      <li><b>Messungen.</b> Die Liste, eingeklappt. Öffnen zeigt jeden Wiegetag.</li>
    </ol>
    <h4>Training</h4>
    <p>Was du auf dem Gym Monster gemacht hast. Eine Zeile öffnet Übungen, Sätze und Gewichte.</p>
    <img class="guide-shot" src="/guide/training.png" alt="Tab Training von Sam Demo">
    <ol>
      <li><b>Titel.</b> Training.</li>
      <li><b>Grafiken.</b> Drei nebeneinander: Trainings je Woche, Volumen je Woche und Minuten je Woche.</li>
      <li><b>Trainings.</b> Die Tabelle. Eine Zeile öffnet den Bericht dieses Trainings.</li>
      <li><b>Je Übung.</b> Wähle eine Übung. Die Grafik ist der Verlauf des geschätzten 1RM.</li>
    </ol>
    <h4>Rückblick</h4>
    <p>Alles über einen Zeitraum, den du rechts oben wählst. Drucken und PDF nutzen denselben Zeitraum. Die Seite ist lang; die Nummern laufen von oben nach unten.</p>
    <img class="guide-shot" src="/guide/terugkijken.png" alt="Tab Rückblick von Sam Demo">
    <ol>
      <li><b>Kopf.</b> Der Zeitraum, plus Drucken und PDF.</li>
      <li><b>Zahlen.</b> Kacheln für den Zeitraum: Trainings, je Woche, Zeit, kcal, Wochenserie, Lieblingstag, Volumen, Sätze, Wiederholungen je Satz, schwerstes Gewicht, Rekorde und Muskelgruppen.</li>
      <li><b>Cardio.</b> Aktivitäten aus Apple Health in diesem Zeitraum.</li>
      <li><b>Balance und Masse.</b> Links die Verteilung des Volumens, rechts Muskelmasse gegen das Trainingsvolumen.</li>
      <li><b>Kraft.</b> Der Index je Muskelgruppe. 100 ist der Anfang des Zeitraums. Ein Punkt schaltet eine Gruppe an oder aus.</li>
      <li><b>Kilometer und Schritte.</b> Kilometer je Woche und Schritte je Tag.</li>
      <li><b>Je Muskelgruppe.</b> Volumen, Sätze und das beste geschätzte 1RM.</li>
      <li><b>Sätze je Woche.</b> Ein Balken je Muskelgruppe. Grün liegt in der Richtlinie für Anfänger, etwa 6 bis 12 Arbeitssätze.</li>
      <li><b>Detail.</b> Dieselben Muskelgruppen in einer Tabelle, je Woche.</li>
      <li><b>Je Übung.</b> Volumen und das schwerste Gewicht je Übung.</li>
      <li><b>Muster.</b> Welche Bewegungsmuster (Drücken, Ziehen, Kniebeuge) du gemacht hast.</li>
      <li><b>Kalender.</b> Dieselben acht Wochen wie in der Übersicht, für den gewählten Zeitraum.</li>
      <li><b>Wann.</b> An welchen Tagen und Stunden du trainierst. Das Häkchen zählt Gehen und Radfahren mit.</li>
      <li><b>Erholung und Energie.</b> Ob die Belastung zur Erholung passt, und die verbrannte Energie neben dem Gewicht.</li>
    </ol>
    <h4>Einstellungen</h4>
    <p>Links das Menü, rechts der offene Teil. Sam Demo ist kein Administrator, deshalb fehlen KI-Coach und Benutzer. Die beiden siehst du nur als Administrator.</p>
    <img class="guide-shot" src="/guide/instellingen.png" alt="Einstellungen, mit dem Speediance-Konto offen">
    <ul>
      <li><b>Speediance-Konto.</b> E-Mail, Passwort, Region und Gym Monster. Speichern und testen holt den Katalog. Mein Gerät erkennen wählt das Modell.</li>
      <li><b>Training.</b> Ziel, Tage, Minuten, Erfahrung, Deload, Aufwärmen, Abwärmen und ob die Woche ein Plan ist.</li>
      <li><b>Körper und Ziele.</b> Geschlecht, Geburtsjahr, Geburtsdatum, maximale Herzfrequenz, Figur und Größe. Die steuern die Grafiken und den Score.</li>
      <li><b>Apple Health.</b> Hier erstellst du den Verbindungsschlüssel. Wie das geht, steht unter Neu: verbinden.</li>
      <li><b>Withings.</b> Der Knopf Withings verbinden. Die Client ID trägt nur der Administrator ein.</li>
      <li><b>E-Mail.</b> Deine Adresse, und ob du nach einem Training ein PDF willst. Den Mailserver richtet der Administrator ein.</li>
      <li><b>Sync und Katalog.</b> Wann die letzte Synchronisation war und wie viele Übungen es für dein Gerät gibt.</li>
      <li><b>Anleitung.</b> Dieser Text.</li>
      <li><b>Bedingungen.</b> Der Text, den du beim ersten Start akzeptierst.</li>
      <li><b>Über GymCoach.</b> Version und Lizenz.</li>
    </ul>`,
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
    <p><b>Aufwärmen und Cool-down.</b> Die kommen aus den Aufwärm- und Dehnübungen des Katalogs, passend zu Ober- oder Unterkörper. Jede Einheit und jede Woche bekommt eine andere Auswahl, also nicht immer dieselben Übungen. Unter Bearbeiten kannst du Übungen hinzufügen, entfernen oder die Sekunden ändern, und Neu wählt eine andere Auswahl. Speichern behält sie bei dieser Einheit.</p>
    <p><b>Selbst bearbeiten.</b> Mit <i>Bearbeiten</i> änderst du ein Training: Sätze, Wiederholungen, Gewicht, Pause und Modus pro Satz (Standard, exzentrisch, isokinetisch, konstant, Spotter), die Reihenfolge, das Aufwärmen und das Cool-down. Die Figur und die Sätze pro Muskelgruppe für die ganze Woche aktualisieren sich sofort. Ein bearbeitetes Training ist <i>fixiert</i>: bei einem neuen Vorschlag bleibt es, und die Gewichte folgen deiner Progression, außer bei Übungen mit <i>festem Gewicht</i>. Mit <i>Löschen</i> nimmst du ein Training aus dieser Woche, mit <i>Ersetzen</i> setzt du ein anderes an seine Stelle. Die anderen Trainings bleiben. Dabei kannst du auch einen Spaziergang, eine Radtour, Schwimmen, Padel oder eine andere Aktivität einfügen.</p>
    <p><b>Supersätze.</b> Zwei oder mehr Übungen abwechselnd, ohne Pause dazwischen; nach jeder Runde die Pause der letzten Übung. Auf dem Gym Monster erscheinen sie als abwechselnde Schritte (A1, A2, A1, A2 …), weil ein Programm keine Supersätze kennt.</p>
    <p><b>Eigene Trainings und Vorlagen.</b> Mit <i>+ Neues Training</i> baust du ein Training selbst (leer, als Kopie oder aus einer Vorlage). Unter <i>Trainings</i> speicherst du ein Training als Vorlage und kannst es mit allen auf deinem Server teilen. Wer eine geteilte Vorlage in seinen Plan holt, bekommt Gewichte aus dem eigenen Verlauf oder ein Startgewicht, wenn er die Übung noch nicht gemacht hat.</p>
    <p><b>Eine Woche.</b> Mit <i>Woche als ein Plan</i> an (Einstellungen → Training) rückt eine Übung auf einen späteren Tag, wenn der Hauptmuskel noch nicht erholt ist. Ober- und Unterkörper bleiben getrennt, ein fixiertes Training bleibt stehen, und die Wochensumme pro Muskelgruppe bleibt gleich. Der Plan zeigt die Erholung zu Beginn jedes Trainings. Bei einem neuen Wochenplan wählst du den Wochentag und die Tageszeit jedes Trainings. Die Erholung läuft als Balken durch die ganze Woche, in Blöcken von 6 Stunden. Hast du eine Übung schon gemacht, zählt das echte Gewicht, nicht nur der Plan. Ein Knopf wechselt zwischen einem allmählichen Farbverlauf und einem Stapel. Die Wahl bleibt gespeichert. Zieh einen Punkt im Balken auf einen anderen Block: die anderen Einheiten dieses Tages gehen mit und die Erholung wird sofort neu gerechnet. Schalte es aus und erstelle einen neuen Wochenplan, um die festen Tage zurückzubekommen.</p>
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
      <dt>Vergleich im Bericht</dt><dd>Mit dem Durchschnitt der letzten 4 Male, die du dasselbe Training auf dem Gym Monster gemacht hast (die Wochennummer im Namen zählt nicht), sonst mit deinen letzten 4 Trainings. Ein Spaziergang am selben Tag zählt nicht.</dd>
      <dt>Jahresbericht</dt><dd>Unter Rückblick öffnet Jahresbericht ein PDF der letzten 52 Wochen: eine Linie für Gewicht, Übungen und Minuten pro Woche, plus Gesundheitsscore und die wichtigsten Zahlen. Nur Trainings am Gym Monster. Eine Seite, druckfertig.</dd>
      <dt>Zeit unter Spannung und Pausen</dt><dd>Aus den Zeiten, die der Gym Monster pro Wiederholung und pro Pause speichert.</dd>
      <dt>Herzfrequenz</dt><dd>Pro Satz vom Gym Monster (mit Brustgurt); der Verlauf über das ganze Training, einschließlich der Pausen, kommt aus Apple Health (Apple Watch). Zonen: 50–60 % deines Maximums Erholung, 60–70 % Grundlage, 70–80 % aerob, 80–90 % Schwelle, 90 %+ Maximum.</dd>
      <dt>Erholung</dt><dd>Der Erholungswert nutzt deinen Ruhepuls aus Apple Health (Apple Watch): den Durchschnitt der letzten 7 Tage gegenüber den 4 Wochen davor. Gibt es weniger als 10 solcher Tage, dann die Messungen der Withings-Waage. Im Rückblick und unter Körper kommt der Ruhepuls aus Apple Health, sobald es Tage gibt, sonst von der Waage. 3 Schläge höher: Achtung; 5 oder mehr: wahrscheinlich nicht erholt, oder du wirst krank.</dd>
      <dt>Körper</dt><dd>BMI nach der WHO. Körperfett nach den Tabellen von Gallagher et al. (2000), nach Alter und Geschlecht. FFMI (fettfreie Masse ÷ Größe²), mit Grenzen nach Geschlecht. Pulswellengeschwindigkeit mit Grenzen nach Alter; ein höherer Wert bedeutet steifere Gefäße. Gewicht, Fett, Muskelmasse, FFMI, Pulswellengeschwindigkeit und ECW/TBW kommen von der Withings-Waage. ECW/TBW ist das Wasser außerhalb der Zellen geteilt durch das gesamte Körperwasser; unter 0,40 ist üblich, darüber zählt die Tendenz. Ruhepuls, HRV und VO2max auf derselben Seite kommen von der Apple Watch.</dd>
      <dt>Energie und Schritte</dt><dd>Aktive Energie aus Apple Health (was du über deinen Grundumsatz hinaus verbrennst); ohne Apple Health die Kalorien deiner Trainings. Schrittziel standardmäßig 8.000 pro Tag. Für Gehen, Schwimmen und andere Aktivitäten stellst du unter Ziel ein Wochenziel. Im Wochenplan gehört die Aktivität zur ganzen Woche, nicht zu einem Tag und einer Uhrzeit. Der Vorschlag daneben kommt aus deinen letzten vier Wochen in Apple Health, oder aus einer festen Richtlinie, wenn diese Messung noch fehlt.</dd>
      <dt>Gesundheitsscore</dt><dd>Eine Zahl von 1,0 bis 10,0 für dein Geschlecht und dein Alter, auf der Übersicht und unter Körper. Vier Kategorien zählen: Körperzusammensetzung, Herz und Gefäße, Kondition und Erholung, und Sonstiges. Jede Messung in einer Kategorie zählt gleich schwer. Gewicht, Fett, Muskelmasse, FFMI, viszerales Fett, Knochenanteil, Pulswellengeschwindigkeit, Gefäßalter, Stoffwechselalter, Nervengesundheit und das Verhältnis von extrazellulärem zu Gesamtkörperwasser kommen von der Withings-Waage, als Mittel der letzten zwei Wägungen. Ruhepuls und HRV sind sieben Tage aus Apple Health; VO2max ist die letzte Schätzung der Apple Watch. Ein höherer Score ist immer besser. Bei der Messung selbst ist Grün die gesündere Richtung: ein BMI, der auf 22 zugeht, ist grün, ein BMI, der sich weiter von 22 entfernt, ist rot. Die Scorezahl bekommt dieselbe Farbe. Das fasst deine eigenen Zahlen zusammen. Es ist keine Diagnose.</dd>
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
    html: `<p>Der KI-Coach erhält deine Einstellungen, Alter und Geschlecht, deine letzten Trainings, Gewicht und Aktivitäten sowie den Plan, den die Regeln erstellt haben. Er darf Übungen tauschen (nur aus deinem eigenen Katalog) und Sätze (2–5), Wiederholungen (5–20) und Gewicht (höchstens 15 % über dem letzten Mal dieser Übung) anpassen. Jede Änderung wird geprüft, und du wählst, was du übernimmst.</p>
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
