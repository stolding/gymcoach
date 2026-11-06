# GymCoach

🇬🇧 [English](README.md) · 🇳🇱 Nederlands

**Je eigen trainingscoach voor de Speediance Gym Monster.**

GymCoach is een trainingsdashboard dat je zelf host. Het leest je trainingen uit via de onofficiële [`speediance-cli`](https://github.com/stozo04/speediance-cli), maakt elke week een persoonlijk schema en zet dat met één klik als programma op je Gym Monster. Metingen van een Withings-weegschaal en activiteiten uit Apple Health komen er automatisch bij.

![GymCoach](public/icon-192.png)

- **Brochure:** [Nederlands](documentatie/GymCoach-brochure.pdf) · [English](documentatie/GymCoach-brochure-en.pdf) · [Deutsch](documentatie/GymCoach-brochure-de.pdf)
- **Hoe de code in elkaar zit:** [documentatie/ARCHITECTUUR.md](documentatie/ARCHITECTUUR.md)
- **Wijzigingen per versie:** [CHANGELOG.md](CHANGELOG.md)
- **iPhone-app (GymCoach Sync):** [ios/README.md](ios/README.md)

## Zo ziet GymCoach eruit

Uit de [brochure](documentatie/GymCoach-brochure.pdf); klik op een pagina voor het groot formaat. Alle cijfers zijn voorbeelddata.

<table>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/brochure-1-voorkant.png"><img src="documentatie/afbeeldingen/brochure-1-voorkant.png" alt="Voorkant" width="380"></a><br><sub>Voorkant</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/brochure-2-wat-gymcoach-doet.png"><img src="documentatie/afbeeldingen/brochure-2-wat-gymcoach-doet.png" alt="Wat GymCoach doet" width="380"></a><br><sub>Wat GymCoach doet</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/brochure-3-weekplan.png"><img src="documentatie/afbeeldingen/brochure-3-weekplan.png" alt="Je weekplan" width="380"></a><br><sub>Je weekplan</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/brochure-4-zelf-samenstellen.png"><img src="documentatie/afbeeldingen/brochure-4-zelf-samenstellen.png" alt="Zelf samenstellen" width="380"></a><br><sub>Zelf samenstellen</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/brochure-5-lichaam.png"><img src="documentatie/afbeeldingen/brochure-5-lichaam.png" alt="Lichaamsmetingen" width="380"></a><br><sub>Lichaamsmetingen</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/brochure-6-inzicht.png"><img src="documentatie/afbeeldingen/brochure-6-inzicht.png" alt="Inzicht" width="380"></a><br><sub>Inzicht</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/brochure-7-trainingsrapport.png"><img src="documentatie/afbeeldingen/brochure-7-trainingsrapport.png" alt="Trainingsrapport" width="380"></a><br><sub>Trainingsrapport</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/brochure-8-afgestemd-op-jou.png"><img src="documentatie/afbeeldingen/brochure-8-afgestemd-op-jou.png" alt="Afgestemd op jou" width="380"></a><br><sub>Afgestemd op jou</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/brochure-9-techniek.png"><img src="documentatie/afbeeldingen/brochure-9-techniek.png" alt="Techniek en installatie" width="380"></a><br><sub>Techniek en installatie</sub></td></tr>
</table>

## Schermen uit de app

Met een demo-account en voorbeelddata; donker thema.

<table>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-overzicht.png"><img src="documentatie/afbeeldingen/app-overzicht.png" alt="Overzicht" width="420"></a><br><sub>Overzicht</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-plan.png"><img src="documentatie/afbeeldingen/app-plan.png" alt="Weekplan" width="420"></a><br><sub>Weekplan</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-editor.png"><img src="documentatie/afbeeldingen/app-editor.png" alt="Trainingseditor" width="420"></a><br><sub>Trainingseditor</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-kiezer.png"><img src="documentatie/afbeeldingen/app-kiezer.png" alt="Oefeningen kiezen per spiergroep" width="420"></a><br><sub>Oefeningen kiezen per spiergroep</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-rapport.png"><img src="documentatie/afbeeldingen/app-rapport.png" alt="Trainingsrapport" width="420"></a><br><sub>Trainingsrapport</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-analyse.png"><img src="documentatie/afbeeldingen/app-analyse.png" alt="Analyse: kalender met je hele historie" width="420"></a><br><sub>Analyse: kalender met je hele historie</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-statistieken.png"><img src="documentatie/afbeeldingen/app-statistieken.png" alt="Statistieken" width="420"></a><br><sub>Statistieken</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-uitleg.png"><img src="documentatie/afbeeldingen/app-uitleg.png" alt="Hoe GymCoach werkt (uitleg in de app)" width="420"></a><br><sub>Hoe GymCoach werkt (uitleg in de app)</sub></td></tr>
<tr><td align="center"><a href="documentatie/afbeeldingen/app-lichaam.png"><img src="documentatie/afbeeldingen/app-lichaam.png" alt="Lichaam" width="420"></a><br><sub>Lichaam: metingen met richtwaarden</sub></td><td align="center"><a href="documentatie/afbeeldingen/app-mobiel.png"><img src="documentatie/afbeeldingen/app-mobiel.png" alt="Op de telefoon" width="200"></a><br><sub>Op de telefoon</sub></td></tr>
</table>

## Functies

**Plannen en trainen**
- **Persoonlijk weekplan** op basis van doel (spieropbouw, combinatie, afvallen), dagen per week en beschikbare tijd; per dag kun je ook een cardio-circuit of cardio buiten kiezen.
- **Automatische progressie**: dubbele progressie, inloop bij nieuwe oefeningen, deloadweken.
- **Persoonlijk afgestemd**: rust en volume per geslacht en op je eigen herstel; maximale hartslag met Tanaka of (voor vrouwen) Gulati.
- **Weekfocus** op spiergroepen; een anatomisch figuur (man, vrouw of neutraal) laat zien wat er getraind wordt.
- **Met één klik op de Gym Monster**, met warming-up, mobiliteit en cooldown. Programma's heten naar de kalenderweek: `GC 2026-W45 Full Body A`.
- **Trainingseditor**: blader door de oefeningen per spiergroep en soort, bekijk de video van de coach, de aandachtspunten en de uitleg van Speediance (gedeeld bewaard op je eigen server), voeg oefeningen toe aan de training, warming-up of cooldown; pas elke training aan (sets, herhalingen, gewicht, rust en Gym Monster-modus per set, volgorde, supersets, warming-up en cooldown) met live spierkaart en sets per spiergroep voor de hele week; bewerkte trainingen staan vast en schuiven mee met je progressie bij een nieuw voorstel. Maak eigen trainingen (leeg, als kopie of uit een sjabloon), bewaar sjablonen en deel ze met andere gebruikers op je server; de gewichten passen zich per gebruiker aan. Supersets gaan als afwisselende stappen naar de Gym Monster, met rust na elke ronde.
- **Vorige weken terugkijken** in het plan: per oefening wat gepland stond tegenover wat je deed (sets, herhalingen, gewicht), en trainingen die je naar deze week kopieert of als sjabloon bewaart.
- **Accessoires die je niet gebruikt** (stang, bank, handgrepen, touw, heupgordel, roei- en skihandvat, mat): oefeningen die ze nodig hebben, blijven buiten je plan, wisselen en de voorstellen van de AI-coach, net als de instelling in de Speediance-app. Per gebruiker.
- **Gedaan deze week**: wat je al hebt getraind staat gemarkeerd in het plan.
- **Herstel en signalen**: GymCoach combineert je gegevens. Een herstelscore (goed / let op / rustig aan) uit rusthartslag, HRV, gehaalde herhalingen en hoeveel trager je herhalingen binnen een set worden; bij *rustig aan* maak je de volgende training lichter en komt de deloadweek eerder. Verder: vertraging per set in het rapport, een waarschuwing als je sneller dan ~1% per week afvalt en spiermassa verliest, en een melding als cardio binnen 3 uur vóór een krachttraining eindigde. Steeds met de bronnen in de app.
- **Optionele AI-coach** via de Claude API of een lokaal taalmodel (OpenAI-compatibel). Aanpassingen worden gecontroleerd en alleen toegepast als jij erop klikt.

**Terugkijken**
- **Trainingsrapport** na elke training (in de app, als PDF en per mail): vergelijking met de laatste 4 keer, hartslag per set en over de hele training met zones, tijd onder spanning en rust.
- **Statistieken**: per spiergroep, krachtindex, duwen/trekken- en boven/onder-balans, records, spiermassa tegen volume, km per week en stappen.
- **Analyse**: kalender met je volledige historie (maand en jaar), wanneer je traint, records-tijdlijn, energie tegen gewicht en herstel (rusthartslag tegen belasting).
- **Lichaam** via Withings: gewicht, vet%, spiermassa, segmenten per arm/been/romp, vasculaire leeftijd, met richtwaarden.
- **Activiteiten** uit Apple Health: alle soorten (wandelen, fietsen, zwemmen, padel, voetbal, …) in jouw taal, plus HRV en de VO2max-schatting van de Apple Watch.

**Gebruik**
- **Nederlands, Engels en Duits**: kies per gebruiker met de vlaggetjes (inlogscherm, menubalk of je gebruikersmenu), of laat de app de taal van je browser volgen. Rapporten, mails en de AI-coach gebruiken dezelfde taal. Uitleg en video's van oefeningen komen van Speediance in jouw taal als Speediance die heeft, anders in het Engels. Een taal toevoegen vraagt een woordenboek (`public/locales/`) en een vertaling van de uitleg en de voorwaarden.
- **Meerdere gebruikers**, elk met eigen account, Speediance-account, plan en koppelingen; een wizard begeleidt nieuwe gebruikers.
- **Uitleg in de app**: Instellingen → Over GymCoach → *Hoe GymCoach werkt* legt het plan en alle berekeningen uit, met bronnen. *Wijzigingen* op dezelfde pagina opent de geschiedenis per versie.
- Donker en licht thema; werkt op pc, tablet en telefoon.

## Installeren met Docker (aanbevolen)

Je hebt alleen een machine met **Docker** nodig (een mini-pc, NAS of server thuis; Linux, amd64 of arm64) en een Speediance Gym Monster met account.

```bash
mkdir gymcoach && cd gymcoach
curl -fsSLO https://raw.githubusercontent.com/stolding/gymcoach/main/docker-compose.yml
docker compose up -d
```

Open daarna `http://<ip-van-je-server>:8765`. De eerste keer maak je het beheerdersaccount aan; daarna helpt een wizard je met de voorwaarden, je Speediance-account, je voorkeuren en je eerste plan.

- Alle gegevens staan in de map `data/` naast `docker-compose.yml` (database en Speediance-logins). Maak daar een back-up van.
- **Bijwerken:** `docker compose pull && docker compose up -d`
- **Logs:** `docker compose logs -f`
- **Zelf bouwen** in plaats van het kant-en-klare image: clone de repository en draai `docker compose up -d --build`.
- Het image (`ghcr.io/stolding/gymcoach`) wordt automatisch gebouwd voor amd64 en arm64 (bijv. Raspberry Pi 4/5).
- Instellingen via `environment` in `docker-compose.yml`, zie de tabel hieronder.

## Installeren zonder Docker

Op een Linux-machine met **Node.js 22.5 of nieuwer** en systemd. Er zijn geen npm-pakketten nodig: GymCoach gebruikt alleen Node.js zelf, met de ingebouwde SQLite (`node:sqlite`).

```bash
git clone https://github.com/stolding/gymcoach.git ~/gymcoach
cd ~/gymcoach
bash install.sh
```

Het script controleert Node.js, installeert `speediance-cli` in `~/.local/bin` en start GymCoach als systemd-gebruikersdienst op poort 8765. Bijwerken: Instellingen → Over GymCoach → *Controleren op updates* (alleen de beheerder). Die haalt `main` van GitHub en herstart de dienst. De map moet een git-clone zijn (`git clone`, zoals hierboven); `data/` en `.env` blijven staan.

## Instellingen

Via `environment` in `docker-compose.yml`, of in `.env` (zie `.env.example`) bij een installatie zonder Docker:

| Variabele | Standaard | Betekenis |
|---|---|---|
| `PORT` | `8765` | Poort van de webserver |
| `HOST` | `0.0.0.0` | Adres; `127.0.0.1` achter een proxy (zonder Docker) |
| `TRUST_PROXY` | leeg | `1` achter een reverse proxy (echte IP en https uit de headers) |
| `TZ` | `Europe/Amsterdam` (Docker) | Tijdzone |
| `GYMCOACH_DATA` | `./data` (Docker: `/data`) | Map met database en logins |

Optioneel: een Withings-weegschaal met een eigen Withings-ontwikkelaarsapp; een iPhone met *Health Auto Export* of een eigen build van *GymCoach Sync*; een Claude API-key of een lokaal taalmodel; een mailserver.

## Bereikbaar van buitenaf

GymCoach draait thuis en is standaard alleen in je eigen netwerk bereikbaar; er is geen centrale server. Wil je het buitenshuis gebruiken (ook voor de iPhone-sync), dan regel je dat zelf, bijvoorbeeld met:

- **Tailscale** of een andere VPN: het eenvoudigst, niets open naar internet;
- een **reverse proxy** met https op je eigen domein (Caddy, nginx, Traefik, Nginx Proxy Manager) met `TRUST_PROXY=1`;
- een **reverse SSH-tunnel naar je eigen VPS** (installatie zonder Docker), zie hieronder.

### SSH-tunnel naar je eigen VPS

De VPS stuurt `127.0.0.1:18765` door naar GymCoach thuis, en de webserver op de VPS (bijv. Apache in Plesk) doet https.

Zet de gegevens van je VPS in `.env` (zie `.env.example`): `GYMCOACH_VPS_HOST`, `GYMCOACH_VPS_USER`, `GYMCOACH_VPS_KEY` (SSH-sleutel zonder wachtwoord) en eventueel `GYMCOACH_VPS_TUNNEL_PORT`. Installeer dan:

```bash
bash deploy/tunnel/install-tunnel.sh
```

Dit installeert de tunnel en een bewaker die de tunnel herstart als hij niet meer reageert (met `autossh` als dat aanwezig is). Proxy-instellingen voor Apache (Plesk → *Apache & nginx* → *Additional directives for HTTPS*):

```
ProxyPreserveHost On
ProxyTimeout 300
ProxyPass / http://127.0.0.1:18765/
ProxyPassReverse / http://127.0.0.1:18765/
RequestHeader set X-Forwarded-Proto "https"
```

Zet daarna `TRUST_PROXY=1` in `.env` en herstart GymCoach.

## Koppelingen

**Apple Health.** Met *Health Auto Export – JSON+CSV* uit de App Store (REST API naar `/api/health/ingest`), of met de iPhone-app [GymCoach Sync](ios/README.md) (workouts, hartslagverloop, stappen, energie, rusthartslag; automatisch op de achtergrond). GymCoach Sync staat niet in de App Store: je bouwt hem met je eigen Apple-ontwikkelaarsaccount via GitHub Actions (zie de handleiding). De koppelsleutel maak je bij Instellingen → Apple Health. Krachttrainingen die Speediance zelf naar Apple Health schrijft, worden overgeslagen, zodat niets dubbel telt.

**Withings.** De beheerder maakt één Withings-ontwikkelaarsapp (tot 10 gebruikers) en vult de gegevens in bij Instellingen → Withings. Iedere gebruiker klikt daarna op *Koppel Withings*.

**Mail.** Met een SMTP-server (Instellingen → E-mail) krijg je na elke training het rapport als PDF.

**AI-coach.** De beheerder kiest de Claude API of een lokale server (llama.cpp, Ollama). De coach krijgt je instellingen, geslacht en leeftijd, recente trainingen, gewicht, activiteiten en het plan. Hij mag oefeningen wisselen (alleen uit je eigen catalogus) en sets (2–5), herhalingen (5–20) en gewicht (±15%) aanpassen. Er wordt niets toegepast zonder dat jij erop klikt. Hij ziet ook welke trainingen je zelf hebt gemaakt, bewerkt of vastgezet, met hun opbouw (supersets, modi, rust, vast gewicht); die opbouw respecteert hij, voorstellen doet hij daar alleen met een reden, en ze staan standaard uit. Met de knop *AI-advies* op een training vraag je advies voor alleen die training.

**Volume.** GymCoach neemt het volume dat de Gym Monster per set opslaat, dus bij oefeningen met twee handgrepen tellen beide kanten mee (2 × het gewicht per handgreep). Gewichten en geschat 1RM zijn per handgreep, zoals op het toestel.

## Hoe het werkt

Uitgebreid in de app (*Hoe GymCoach werkt*) en in [documentatie/ARCHITECTUUR.md](documentatie/ARCHITECTUUR.md). In het kort:

- **Sync.** Na de start en daarna op een instelbaar interval haalt GymCoach je trainingen op, met herhalingen, gewichten, tijden en hartslag per set.
- **Schema.** 2–3 dagen: full body; 4 dagen: upper/lower; 5 dagen: upper/lower plus full body.
- **Voorschrift.** Spieropbouw 8–12 herhalingen, 90 s rust; afvallen 12–20 herhalingen, 30–45 s rust; *combinatie* daartussen.
- **Progressie.** Alle sets op de bovenkant: gewicht omhoog (+2 kg samengesteld, +1 kg isolatie). Twee keer onder het doel: −10%.
- **Inloop en deload.** Nieuwe oefening: eerst 2 sets. Elke 6 trainingsweken (instelbaar) een lichtere week.
- **Persoonlijk.** Vrouwen: 20% kortere rust en wat meer volume. Iedereen: langere rust als je herhalingen in latere sets zakken.
- **Tijd.** Oefeningen worden ingekort tot de training in je ingestelde minuten past.

## Eerste keer: controleer de gewichtseenheid

De CLI rekent in kilogram. Kijk bij het eerste programma op het scherm van de Gym Monster of de gewichten kloppen.

## Beheer

```bash
docker compose logs -f                  # Docker: logs
journalctl --user -u gymcoach -f        # zonder Docker: logs
systemctl --user restart gymcoach       # zonder Docker: herstart
```

Alle data staat in `data/` (rechten 700/600):
- `data/gymcoach.db` — SQLite-database met gebruikers, instellingen, plannen, trainingen, metingen, activiteiten en koppelingen;
- `data/users/<naam>/speediance/` — de Speediance-login per gebruiker (bestanden, omdat de speediance-cli die nodig heeft).

**Back-up** (mag terwijl de app draait):

```bash
node backup.js                                    # zonder Docker: backups/gymcoach-<datum>.tar.gz
docker compose exec gymcoach node backup.js /data/backups   # Docker: in data/backups
```

**Herstellen:** `node restore.js` laat zien welke oude JSON-gegevens nog niet in de database staan; `node restore.js --apply` zet ze er alsnog in (eerst wordt een kopie van de database gemaakt).

**Upgraden vanaf een versie met JSON-bestanden:** bij de eerste start importeert GymCoach `data/*.json` en `data/users/*/*.json` automatisch. De oude bestanden krijgen de extensie `.imported`.

De Speediance-API is onofficieel. Breekt een app-update van Speediance iets, dan komt er een nieuwe `speediance-cli`: met Docker zit die in een nieuw image (`CLI_VERSION` in de `Dockerfile`); zonder Docker zet je `CLI_VERSION` in `install.sh` op de nieuwste versie, verwijder je `~/.local/bin/speediance-cli` en draai je het script opnieuw.

## Andere Gym Monster-modellen

GymCoach is gebouwd en getest op de **Gym Monster 1**. Kies bij Instellingen → *Speediance-account* je model of klik op *Detecteer mijn toestel*; GymCoach haalt dan de oefeningencatalogus van jouw toestel op. Staat een standaardoefening er niet in, dan kiest GymCoach dezelfde oefening op naam, of een kabeloefening voor dezelfde spiergroep.

## Versies

GymCoach volgt MAJOR.MINOR.PATCH (zie [CHANGELOG.md](CHANGELOG.md)); de versie staat in `package.json` en in de app. De iPhone-app heeft een eigen versienummer (`ios/project.yml`).

## Disclaimer

GymCoach is een onafhankelijk project en niet verbonden aan Speediance, Withings of Apple. Het gebruikt de onofficiële Speediance-API; een app-update van Speediance kan dingen breken. Trainingsvoorstellen en metingen zijn geen medisch advies: overleg met je huisarts voordat je begint als je klachten of risicofactoren hebt, en bij pijn met een arts of fysiotherapeut.

## Licentie

MIT, zie [LICENSE](LICENSE). © 2026 A. Stoelwinder Holding B.V.
