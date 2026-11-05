# GymCoach — architectuur

Hoe de code in elkaar zit, voor wie GymCoach wil aanpassen of uitbreiden. Wat de app doet en hoe de berekeningen werken, staat ook in de app zelf: Instellingen → Over GymCoach → *Hoe GymCoach werkt* (`public/explain.js`).

## Uitgangspunten

- **Geen afhankelijkheden.** Alleen Node.js 22.5+: `node:http`, `node:sqlite`, `node:crypto`, `node:tls`. Geen npm-pakketten, geen build-stap. De browserkant is gewone JavaScript-modules zonder framework.
- **Zelf hosten.** Eén proces, één SQLite-database, meerdere gebruikers. Draait in Docker of als systemd-gebruikersdienst. Er is geen centrale server: elke installatie staat op zichzelf.
- **Regels eerst, AI optioneel.** Het plan komt altijd uit een vaste set regels (`lib/engine.js`). De AI-coach mag alleen voorstellen doen binnen grenzen; de gebruiker beslist.
- **Nederlands, donker thema standaard.** Alle tekst in de app is Nederlands.

## Overzicht

```
 Gym Monster ── Speediance-cloud ──► speediance-cli ──► lib/cli.js, lib/speediance.js ─┐
 Withings-weegschaal ──────────────────────────────────► lib/withings.js ───────────────┤
 iPhone (GymCoach Sync / Health Auto Export) ── POST /api/health/ingest ► lib/health.js ┤
                                                                                         ▼
                                       server.js (HTTP, routes, sync, per-gebruiker-context)
                                         │            │              │
                                 lib/store.js   lib/engine.js   lib/insights.js   lib/ai.js
                                  (SQLite)      (plan, stats)   (rapport, analyse) (AI-coach)
                                         │
                                 lib/summary.js + lib/pdf.js (rapport als PDF) ─ lib/mail.js (SMTP)
                                         │
                               public/ (app in de browser: app.js, bodymap.js, explain.js, terms.js)
```

## Bestanden

| Bestand | Wat |
|---|---|
| `server.js` | HTTP-server: statische bestanden, alle `/api/…`-routes, inloggen, automatische sync, plan maken en naar het toestel sturen. |
| `lib/store.js` | Database (`node:sqlite`): tabellen, lezen/schrijven per gebruiker, import van oude JSON-bestanden, standaardinstellingen. |
| `lib/engine.js` | Regels-engine: schema's, voorschrift per doel, dubbele progressie, rust, deload, focus, tijdbudget; trainingsdetails, statistieken en overzicht; omzetten naar een programma voor de Gym Monster. |
| `lib/insights.js` | Rapport en analyse: vergelijking met eerdere trainingen, hartslag en zones, balans, krachtindex, records, energie, herstel. |
| `lib/ai.js` | AI-coach: Claude API of OpenAI-compatibele server; context opbouwen en de voorgestelde aanpassingen begrenzen. |
| `lib/cli.js` | Aanroepen van `speediance-cli` (trainingen, details, catalogus, programma's maken). |
| `lib/speediance.js` | Directe Speediance-API met de CLI-sessie (programma's tonen en verwijderen). |
| `lib/withings.js` | Withings OAuth en metingen ophalen. |
| `lib/health.js` | Ontvanger voor Apple Health: workouts, hartslagverloop, dagwaarden, koppelsleutel. |
| `lib/exinfo.js` | Uitleg, foto's en video's per oefening van Speediance, met gedeelde cache (database + `data/media`). |
| `lib/acttypes.js` | Soorten activiteiten uit Apple Health → Nederlandse naam en categorie. |
| `lib/auth.js` | Gebruikers, scrypt-wachtwoorden, sessies en cookies. |
| `lib/summary.js` | Trainingsrapport als PDF en als mail. |
| `lib/pdf.js` | Minimale PDF-schrijver (tekst, lijnen, vlakken, SVG-paden). |
| `lib/mail.js` | Minimale SMTP-client (TLS/STARTTLS, AUTH, bijlagen). |
| `public/index.html`, `style.css` | De pagina en de opmaak (thema's via CSS-variabelen). |
| `public/app.js` | De app in de browser: alle tabbladen, grafieken (eigen SVG), instellingen, wizard. |
| `public/editor.js` | Trainingseditor en de kiezer voor oefeningen (met "Oefening bekijken"). |
| `public/dialogs.js` | Eigen vragen en bevestigingen (`askConfirm`, `askText`) in plaats van `confirm()`/`prompt()` van de browser. |
| `public/i18n.js` | Teksten per taal (`t('sleutel')`), begin van meertaligheid. |
| `public/bodymap.js` | Spierkaart (SVG) met man-, vrouw- en neutraal figuur; ook gebruikt door de PDF. |
| `public/explain.js` | Uitleg "Hoe GymCoach werkt". |
| `public/terms.js` | Voorwaarden en gezondheidsverklaring (met versienummer). |
| `backup.js`, `restore.js` | Back-up maken; oude JSON-gegevens terugzetten. |
| `Dockerfile`, `docker-compose.yml` | Container met Node.js 22 en speediance-cli; gegevens in het volume `/data`. Het image wordt gebouwd door `.github/workflows/docker.yml` (amd64 en arm64, naar ghcr.io). |
| `install.sh` | Installatie zonder Docker: Node-controle, speediance-cli, systemd-dienst. |
| `deploy/tunnel/` | Optioneel: reverse SSH-tunnel naar je eigen VPS, met bewaker. |
| `ios/` | iPhone-app GymCoach Sync (SwiftUI, HealthKit), gebouwd via GitHub Actions. |

## Meerdere gebruikers

Elke API-aanroep loopt via `store.runAs(user, fn)`: met `AsyncLocalStorage` weet elke `get…`/`save…` in `lib/store.js` voor welke gebruiker hij werkt, zonder dat het gebruikers-id overal doorgegeven hoeft te worden. Ook de speediance-cli krijgt per gebruiker een eigen map met de login (`data/users/<naam>/speediance/`).

Gedeelde instellingen (AI, Withings-app, SMTP, automatisch syncen) staan in `global_settings` en zijn alleen voor de beheerder te wijzigen.

## Database

`data/gymcoach.db` (WAL-modus). De belangrijkste tabellen:

| Tabel | Inhoud |
|---|---|
| `users`, `auth_sessions` | Accounts en inlogsessies. |
| `global_settings` | Gedeelde instellingen. |
| `user_docs` | Documenten per gebruiker als JSON: `settings`, `plan`, `meta`, `withings`, `health` (koppelsleutel), `workoutHealth` (Apple Health bij Gym Monster-trainingen), … |
| `workouts` | Lijst met trainingen per gebruiker. |
| `training_sessions` | Details per training (sets, herhalingen, gewichten, tijden, hartslag). |
| `body_measurements` | Lichaamsmetingen (Withings en handmatig). |
| `activities` | Activiteiten uit Apple Health. |
| `health_daily` | Dagwaarden: stappen, actieve energie, afstand, rusthartslag. |
| `exercise_library` | Oefeningencatalogus per toesteltype. |
| `exercise_info` | Gedeelde cache: uitleg en beelden per oefening en taal (30 dagen). Foto's en video's staan in `data/media/`. |
| `templates` | Sjablonen voor trainingen: eigenaar, naam, de training als JSON en of hij gedeeld is met alle gebruikers op de server. |
| `avatars` | Profielfoto's. |

Nieuwe kolommen worden bij het opstarten toegevoegd (zie "kolommen die later zijn toegevoegd" in `lib/store.js`).

## Van training tot plan

1. **Sync** (`server.js` → `sync`): nieuwe trainingen ophalen, details per set opslaan, rapport mailen.
2. **Historie** (`engine.buildHistory`): per oefening een log met sets per training.
3. **Plan** (`engine.buildPlan`): schema kiezen → per bewegingspatroon een oefening uit de catalogus (`pickExercise`) → voorschrift per doel → progressie (`progress`) → rust (`restFor`, met geslacht en eigen herstel) → deload → focus en tijdbudget.
4. **Zelf aanpassen** (`public/editor.js`, `PUT /api/plan`): een bewerkte training krijgt `locked`; bij een nieuw plan houdt `engine.progressSession` de opbouw en schuift alleen het gewicht mee met de progressie (behalve sets met `fixed`). Eigen trainingen (`custom`, sleutel `X<n>`) maak je leeg, als kopie of uit een sjabloon (`POST /api/plan/session`); `engine.adaptSession` geeft een gedeeld sjabloon gewichten uit de eigen historie.
5. **AI-coach** (optioneel, `lib/ai.js`): advies en aanpassingen, begrensd door `validateAdjustments`. De coach ziet welke trainingen eigen, bewerkt of vastgezet zijn, met hun opbouw; voorstellen daarvoor staan in de app standaard uit, en `applyAdjustments` laat de opbouw per set intact. Met `{ session }` vraag je advies voor één training.
6. **Naar het toestel** (`engine.toPushPlan` → `cli.push`): programma `GC <jaar>-W<week> <training>` met warming-up en cooldown. Een superset (oefeningen met dezelfde `group`) wordt om en om gezet: per ronde één set van elke oefening, 5 s rust ertussen en de ingestelde rust na de laatste.
7. **Gedaan** (`engine.planStatus`): trainingen van deze kalenderweek worden aan het plan gekoppeld. `engine.buildHistory` voegt de stappen van een superset weer samen tot één oefening met al zijn sets.

**Volume.** Per set neemt GymCoach de `capacity` die Speediance opslaat (alle handgrepen samen; bij twee handgrepen 2 × het gewicht per handgreep), anders herhalingen × gewicht (`engine.setVolume`). Gewicht en geschat 1RM zijn per handgreep. Voor geplande trainingen schat `engine.volumeFactors` per oefening de verhouding uit je eigen historie.

## API

Alle routes staan in het object `routes` in `server.js`, als `'METHODE /pad': async (req, url) => …`. Een route geeft een object terug (wordt JSON), of `{ __binary }` voor een bestand, of `{ __redirect }`. Fouten zijn `Error`-objecten met een `status`.

Groepen:
- **Toestand en weergave**: `/api/state`, `/api/stats`, `/api/analysis`, `/api/workouts`, `/api/workout`, `/api/workout/pdf`, `/api/activities`, `/api/about`.
- **Plan**: `/api/plan/generate`, `/api/plan` (PUT), `/api/plan/session` (POST: nieuwe eigen training; DELETE), `/api/plan/push`, `/api/focus`, `/api/swap`, `/api/avoid`, `/api/alternatives`, `/api/coach`, `/api/coach/apply`, `/api/coach/dismiss`.
- **Oefeningen en sjablonen**: `/api/library` (catalogus met je historie), `/api/exercise/info` (uitleg en beelden, gecachet), `/api/exercise/template`, `/api/media` (foto's en video's uit de cache, met Range), `/api/templates` (GET, POST, DELETE), `/api/template`, `/api/templates/share`.
- **Toestel**: `/api/sync`, `/api/account`, `/api/account/detect`, `/api/programs`, `/api/programs/delete`, `/api/library/refresh`.
- **Koppelingen**: `/api/withings/*`, `/api/health/*` (de ingest-route gebruikt de koppelsleutel in plaats van een sessie), `/api/mail/test`, `/api/workout/mail`.
- **Lichaam**: `/api/bodyweight`.
- **Gebruikers en instellingen**: `/api/auth/*`, `/api/me*`, `/api/users*`, `/api/settings`, `/api/terms/accept`, `/api/avatar`.

## Ontwikkelen en testen

Starten met een aparte datamap en een nep-CLI (zodat je geen echt toestel nodig hebt):

```bash
GYMCOACH_DATA=/tmp/gc-test SPEEDIANCE_BIN=/pad/naar/nep-speediance-cli PORT=8799 node server.js
```

Syntaxcontrole van alles: `for f in server.js lib/*.js public/*.js; do node --check $f; done`.

## Afspraken

- **Versie** in `package.json` (MAJOR.MINOR.PATCH), bij elke wijziging omhoog, met een regel in `CHANGELOG.md`. De app toont de versie in Over GymCoach en op het inlogscherm.
- **Commentaar**: elk bestand begint met een korte uitleg; elke functie heeft een regel commentaar erboven.
- **Logo**: `public/logo.svg` is hetzelfde ontwerp als het app-icoon van GymCoach Sync; maak de PNG-iconen opnieuw als het logo verandert.
- **README** in twee talen: `README.md` (Engels) en `README.nl.md` (Nederlands); wijzig ze samen. Schermafbeeldingen staan in `documentatie/afbeeldingen/app-*.png`.
- **Brochure**: `documentatie/GymCoach-brochure.pdf` en de afbeeldingen per pagina in `documentatie/afbeeldingen/` (gebruikt in de README) samen bijwerken.
- **Licentie**: MIT, © A. Stoelwinder Holding B.V.
