# GymCoach

🇬🇧 English · 🇳🇱 [Nederlands](README.nl.md)

**Your own training coach for the Speediance Gym Monster.**

GymCoach is a self-hosted training dashboard. It reads your workouts through the unofficial [`speediance-cli`](https://github.com/stozo04/speediance-cli), builds a personal plan every week and puts it on your Gym Monster as a program with one click. Measurements from a Withings scale and activities from Apple Health are added automatically.

> **Language:** the app is available in **English**, **Dutch**, **German** and **Norwegian**: pick a flag on the login screen, in the menu bar or in your user menu (*Automatic* follows your browser). Reports, emails and the AI coach use the same language. Exercise videos and instructions come from Speediance in your language when Speediance has it, otherwise in English. The brochure is available in English, Dutch and German.

![GymCoach](public/icon-192.png)

- **Brochure:** [English](documentatie/GymCoach-brochure-en.pdf) · [Nederlands](documentatie/GymCoach-brochure.pdf) · [Deutsch](documentatie/GymCoach-brochure-de.pdf)
- **How the code is organised (Dutch):** [documentatie/ARCHITECTUUR.md](documentatie/ARCHITECTUUR.md)
- **Changes per version:** [CHANGELOG.md](CHANGELOG.md)
- **iPhone app (GymCoach Sync):** [ios/README.md](ios/README.md)

## What it looks like

Pages from the [brochure](documentatie/GymCoach-brochure-en.pdf); click a page to enlarge. All figures are sample data.

<table>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/en/brochure-1-voorkant.png"><img src="documentatie/afbeeldingen/en/brochure-1-voorkant.png" alt="Cover" width="380"></a><br><sub>Cover</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/en/brochure-2-wat-gymcoach-doet.png"><img src="documentatie/afbeeldingen/en/brochure-2-wat-gymcoach-doet.png" alt="What GymCoach does" width="380"></a><br><sub>What GymCoach does</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/en/brochure-3-weekplan.png"><img src="documentatie/afbeeldingen/en/brochure-3-weekplan.png" alt="Your weekly plan" width="380"></a><br><sub>Your weekly plan</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/en/brochure-4-zelf-samenstellen.png"><img src="documentatie/afbeeldingen/en/brochure-4-zelf-samenstellen.png" alt="Build your own" width="380"></a><br><sub>Build your own</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/en/brochure-5-lichaam.png"><img src="documentatie/afbeeldingen/en/brochure-5-lichaam.png" alt="Body measurements" width="380"></a><br><sub>Body measurements</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/en/brochure-6-inzicht.png"><img src="documentatie/afbeeldingen/en/brochure-6-inzicht.png" alt="Insights" width="380"></a><br><sub>Insights</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/en/brochure-7-trainingsrapport.png"><img src="documentatie/afbeeldingen/en/brochure-7-trainingsrapport.png" alt="Workout report" width="380"></a><br><sub>Workout report</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/en/brochure-8-afgestemd-op-jou.png"><img src="documentatie/afbeeldingen/en/brochure-8-afgestemd-op-jou.png" alt="Tailored to you" width="380"></a><br><sub>Tailored to you</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/en/brochure-9-techniek.png"><img src="documentatie/afbeeldingen/en/brochure-9-techniek.png" alt="Technology and installation" width="380"></a><br><sub>Technology and installation</sub></td></tr>
</table>

## Screenshots

With a demo account and sample data; dark theme.

<table>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-overzicht.png"><img src="documentatie/afbeeldingen/app-overzicht.png" alt="Overview" width="420"></a><br><sub>Overview</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-plan.png"><img src="documentatie/afbeeldingen/app-plan.png" alt="Weekly plan" width="420"></a><br><sub>Weekly plan</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-editor.png"><img src="documentatie/afbeeldingen/app-editor.png" alt="Training editor" width="420"></a><br><sub>Training editor</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-kiezer.png"><img src="documentatie/afbeeldingen/app-kiezer.png" alt="Exercise picker by muscle group" width="420"></a><br><sub>Exercise picker by muscle group</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-rapport.png"><img src="documentatie/afbeeldingen/app-rapport.png" alt="Workout report" width="420"></a><br><sub>Workout report</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-analyse.png"><img src="documentatie/afbeeldingen/app-analyse.png" alt="Analysis: calendar with your full history" width="420"></a><br><sub>Analysis: calendar with your full history</sub></td></tr>
<tr><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-statistieken.png"><img src="documentatie/afbeeldingen/app-statistieken.png" alt="Statistics" width="420"></a><br><sub>Statistics</sub></td><td align="center" width="50%"><a href="documentatie/afbeeldingen/app-uitleg.png"><img src="documentatie/afbeeldingen/app-uitleg.png" alt="How GymCoach works (in-app explanation)" width="420"></a><br><sub>How GymCoach works (in-app explanation)</sub></td></tr>
<tr><td align="center"><a href="documentatie/afbeeldingen/app-lichaam.png"><img src="documentatie/afbeeldingen/app-lichaam.png" alt="Body" width="420"></a><br><sub>Body: measurements with reference ranges</sub></td><td align="center"><a href="documentatie/afbeeldingen/app-mobiel.png"><img src="documentatie/afbeeldingen/app-mobiel.png" alt="On a phone" width="200"></a><br><sub>On a phone</sub></td></tr>
</table>

## Features

**Planning and training**
- **Personal weekly plan** based on your goal (muscle gain, combination, fat loss), days per week and available time; per day you can also choose a cardio circuit or outdoor cardio. Exercises that Speediance places with the cables on the base plate are grouped. Without that data, the guess stays on the name. The same muscle group twice in a row stays apart, even when that means one extra cable change. Check on a workout applies that order too, without sending the program to the machine. With *Week as one plan* (Settings → Training, on by default) exercises move to a later day when that muscle group has not recovered. The week view shows recovery at the start of each workout. Off, then a new weekly plan, restores the fixed days. Click a workout for that session only: muscle groups and intensity, fatigue now and after the planned workout, time and volume, and per exercise the instructions with photos and video. On the Goal tab, *Match the plan to this goal* sets that style from the outcome and gives heavier sets to the exercises that train a chosen muscle group. The rest of the plan follows the other goals. Cardio days stay. A workout already on the Gym Monster stays there until you send it again.
- **Automatic progression**: double progression, run-in for new exercises, deload weeks.
- **Tailored to you**: rest and volume adjusted for sex and for your own recovery; maximum heart rate with Tanaka or (for women) Gulati.
- **Weekly focus** on muscle groups; an anatomical figure (male, female or neutral) shows what you train.
- **One click to the Gym Monster**, including warm-up, mobility and cool-down. Programs are named after the calendar week: `GC 2026-W45 Full Body A`.
- **Training editor**: browse the exercise catalogue by muscle group and type, see the coach video, key points and instructions from Speediance (cached on your own server for all users), add exercises to the workout, warm-up or cool-down; edit any workout (sets, reps, weight, rest and Gym Monster mode per set, order, supersets, warm-up and cool-down) with a live muscle map and weekly sets per muscle group; edited workouts are locked and keep progressing when a new plan is made. Create your own workouts (empty, as a copy or from a template), save templates and share them with other users on your server; weights adapt to each user. Supersets go to the Gym Monster as alternating steps, with rest after each round.
- **Look back at previous weeks** in the plan: per exercise what was planned versus what you did (sets, reps, weight), with sessions you can copy to this week or save as a template.
- **Accessories you don't use** (bar, bench, handles, rope, belt, rowing/ski handle, mat): exercises that need them are left out of your plan, swaps and AI suggestions, just like the setting in the Speediance app. Per user.
- **Done this week**: workouts you've already done are marked in the plan.
- **Recovery and signals**: GymCoach combines your data. A recovery score (good / take care / take it easy) from resting heart rate, HRV, reps achieved and how much your reps slow down within a set; with *take it easy* you can make the next workout lighter and the deload week comes earlier. Plus: rep slowdown per set in the report, a warning when you lose weight faster than ~1% per week while losing muscle, and a note when cardio ended within 3 hours before a strength workout. Each with its sources in the app. Overview also shows muscle recovery: a percentage per muscle group from completed sets, with a chart. GymCoach Sync shows the same block. The weekly-plan figure stays the planned load.
- **Optional AI coach** via the Claude API or a local language model (OpenAI-compatible). Suggestions are validated and only applied when you click them.

**Looking back**
- **Workout report** after every workout (in the app, as PDF and by email): comparison with the last 4 sessions, heart rate per set and over the whole workout with zones, time under tension and rest. Clicking a set shows Speediance power and range of motion per rep, left and right separately, with the fade in each. The recovery score still uses the time per rep.
- **Training**: the log. At the top, workouts, volume and minutes per week, and estimated 1RM per exercise.
- **Review**: one period for the numbers (muscle groups, strength index, balance, muscle mass versus volume, km and steps) and the patterns (calendar, when you train, records, energy versus weight, recovery).
- **Body** via Withings: weight, fat %, muscle mass, FFMI (fat-free mass against height, with ranges by sex), pulse wave velocity with ranges by age, segments per arm/leg/trunk, vascular age, with reference ranges. Together with the Apple Watch this becomes a health score from 1.0 to 10.0 for your sex and age, on Overview and on Body. The numbers in that score are the average of the last two weigh-ins; heart rate and HRV over seven days; VO2max the latest estimate. Each reading counts equally.
- **Activities** from Apple Health: all types (walking, cycling, swimming, padel, football, …), plus HRV and the VO2max estimate of the Apple Watch, with ranges by age and sex.

**Use**
- **English, Dutch, German and Norwegian**: choose per user with the flag menu, or let the app follow your browser. Another language needs a dictionary file (`public/locales/`) plus a translation of the in-app explanation and terms.
- **Multiple users**, each with their own account, Speediance account, plan and connections; a wizard guides new users.
- **Explanations in the app**: Settings → About GymCoach → *How GymCoach works* explains the plan and every calculation, with sources. *Changes* on the same page opens the history per version.
- Dark and light theme; works on desktop, tablet and phone.

## Install with Docker (recommended)

All you need is a machine with **Docker** (a mini PC, NAS or home server; Linux, amd64 or arm64) and a Speediance Gym Monster with an account.

```bash
mkdir gymcoach && cd gymcoach
curl -fsSLO https://raw.githubusercontent.com/stolding/gymcoach/main/docker-compose.yml
docker compose up -d
```

Then open `http://<your-server-ip>:8765`. The first time you create the admin account; a wizard then walks you through the terms, your Speediance account, your preferences and your first plan.

- All data lives in the `data/` folder next to `docker-compose.yml` (database and Speediance logins). Back that folder up.
- **Update:** `docker compose pull && docker compose up -d`. After login, and then every hour while GymCoach is open, the admin also gets a window when a newer version is on GitHub, with that command. The `data/` folder stays.
- **Logs:** `docker compose logs -f`
- **Build it yourself** instead of using the ready-made image: clone the repository and run `docker compose up -d --build`.
- The image (`ghcr.io/stolding/gymcoach`) is built automatically for amd64 and arm64 (e.g. Raspberry Pi 4/5).
- Settings go in `environment` in `docker-compose.yml`, see the table below.

## Install without Docker

On a Linux machine with **Node.js 22.5 or newer** and systemd. No npm packages are needed: GymCoach only uses Node.js itself, including its built-in SQLite (`node:sqlite`).

```bash
git clone https://github.com/stolding/gymcoach.git ~/gymcoach
cd ~/gymcoach
bash install.sh
```

The script checks Node.js, installs `speediance-cli` in `~/.local/bin` and starts GymCoach as a systemd user service on port 8765. Update: after login, and then every hour while GymCoach is open, the administrator gets a window when `main` on GitHub is newer, with the changes and an *Update* button. The same check is under Settings → About GymCoach → *Check for updates*. That fetches `main` from GitHub and restarts the service. The directory must be a git clone (`git clone`, as above); `data/` and `.env` stay in place.

## Settings

Via `environment` in `docker-compose.yml`, or in `.env` (see `.env.example`) when installed without Docker:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8765` | Web server port |
| `HOST` | `0.0.0.0` | Address; `127.0.0.1` behind a proxy (without Docker) |
| `TRUST_PROXY` | empty | `1` behind a reverse proxy (real IP and https from the headers) |
| `TZ` | `Europe/Amsterdam` (Docker) | Time zone |
| `GYMCOACH_DATA` | `./data` (Docker: `/data`) | Folder with database and logins |

Optional: a Withings scale with your own Withings developer app; an iPhone with *Health Auto Export* or your own build of *GymCoach Sync*; a Claude API key or a local language model; a mail server.

## Access from outside your home

GymCoach runs at home and is only reachable on your own network by default; there is no central server. To use it away from home (also the iPhone Health sync), set that up yourself, for example with:

- **Tailscale** or another VPN: the simplest option, nothing exposed to the internet;
- a **reverse proxy** with https on your own domain (Caddy, nginx, Traefik, Nginx Proxy Manager) with `TRUST_PROXY=1`;
- a **reverse SSH tunnel to your own VPS** (installation without Docker), see below.

### SSH tunnel to your own VPS

The VPS forwards `127.0.0.1:18765` to GymCoach at home, and the web server on the VPS (e.g. Apache in Plesk) handles https.

Put your VPS details in `.env` (see `.env.example`): `GYMCOACH_VPS_HOST`, `GYMCOACH_VPS_USER`, `GYMCOACH_VPS_KEY` (SSH key without passphrase) and optionally `GYMCOACH_VPS_TUNNEL_PORT`. Then install:

```bash
bash deploy/tunnel/install-tunnel.sh
```

This installs the tunnel plus a watchdog that restarts it when it stops responding (using `autossh` if available). Proxy settings for Apache (Plesk → *Apache & nginx* → *Additional directives for HTTPS*):

```
ProxyPreserveHost On
ProxyTimeout 300
ProxyPass / http://127.0.0.1:18765/
ProxyPassReverse / http://127.0.0.1:18765/
RequestHeader set X-Forwarded-Proto "https"
```

Then set `TRUST_PROXY=1` in `.env` and restart GymCoach.

## Connections

**Apple Health.** With *Health Auto Export – JSON+CSV* from the App Store (REST API to `/api/health/ingest`), or with the iPhone app [GymCoach Sync](ios/README.md) (workouts, heart-rate curve, steps, energy, resting heart rate; automatically in the background). The same app opens on your overview away from home and also shows plan, progress, body composition (including FFMI, pulse wave velocity, HRV and VO2max), the latest health status and the goal, read-only. GymCoach Sync is not in the App Store: you build it with your own Apple developer account via GitHub Actions (see its guide). Create the pairing key under Settings → Apple Health. Strength workouts that Speediance writes to Apple Health itself are skipped, so nothing is counted twice.

**Withings.** The admin creates one Withings developer app (up to 10 users) and enters its details under Settings → Withings. Each user then clicks *Koppel Withings* (connect).

**Mail.** With an SMTP server (Settings → E-mail) you get the report as a PDF after every workout.

**AI coach.** The admin chooses the Claude API or a local server (llama.cpp, Ollama). On Overview the same connection builds a health status: a summary of the last 4 weeks of measurements (Withings, Apple Watch and training volume). The age in that summary comes from the date of birth in Settings. It is not a diagnosis and it does not change the plan. The coach receives your settings, sex and age, recent workouts, weight, activities and the plan. It may swap exercises (only from your own catalogue) and adjust sets (2–5), reps (5–20) and weight (±15%). Nothing is applied unless you click it. It also sees which sessions you built, edited or locked yourself, including their structure (supersets, modes, rest, fixed weights); it respects that structure, suggests changes there only with a reason, and leaves those suggestions unticked. The *AI advice* button on a session asks about that session alone.

**Volume.** GymCoach uses the volume the Gym Monster stores per set, so for two-handle exercises both sides count (2 × the weight per handle). Weights and estimated 1RM are per handle, as on the machine.

## How it works

Explained in detail in the app (*Hoe GymCoach werkt*) and in [documentatie/ARCHITECTUUR.md](documentatie/ARCHITECTUUR.md). In short:

- **Sync.** At start-up and then at a configurable interval GymCoach fetches your workouts, with reps, weights, timings and heart rate per set.
- **Schedule.** 2–3 days: full body; 4 days: upper/lower; 5 days: upper/lower plus full body.
- **Prescription.** Muscle gain 8–12 reps, 90 s rest; fat loss 12–20 reps, 30–45 s rest; *combination* in between. A strength goal uses about 4–6 reps on the exercises that train that muscle group (5–8 for beginners) and longer rest. The other exercises keep the plan's prescription.
- **Progression.** All sets at the top of the range: weight goes up (+2 kg compound, +1 kg isolation). Twice below target: −10%.
- **Run-in and deload.** New exercise: 2 sets first. Every 6 training weeks (configurable) a lighter week.
- **Personal.** Women: 20% shorter rest and a little more volume. Everyone: longer rest when reps drop in later sets.
- **Time.** Exercises are trimmed until the workout fits your configured minutes.

## First time: check the weight unit

The CLI works in kilograms. With your first program, check on the Gym Monster's screen that the weights are right.

## Administration

```bash
docker compose logs -f                  # Docker: logs
journalctl --user -u gymcoach -f        # without Docker: logs
systemctl --user restart gymcoach       # without Docker: restart
```

All data lives in `data/` (permissions 700/600):
- `data/gymcoach.db` — SQLite database with users, settings, plans, workouts, measurements, activities and connections;
- `data/users/<name>/speediance/` — the Speediance login per user (files, because the speediance-cli needs them).

**Backup** (safe while the app is running):

```bash
node backup.js                                              # without Docker: backups/gymcoach-<date>.tar.gz
docker compose exec gymcoach node backup.js /data/backups   # Docker: in data/backups
```

**Restore:** `node restore.js` shows which old JSON data is not yet in the database; `node restore.js --apply` adds it (a copy of the database is made first).

**Upgrading from a version with JSON files:** on first start GymCoach imports `data/*.json` and `data/users/*/*.json` automatically. The old files get the extension `.imported`.

The Speediance API is unofficial. If a Speediance app update breaks something, a new `speediance-cli` will follow: with Docker it comes in a new image (`CLI_VERSION` in the `Dockerfile`); without Docker set `CLI_VERSION` in `install.sh` to the latest version, delete `~/.local/bin/speediance-cli` and run the script again. The Docker image builds that CLI with `tools/speediance-cli-nano.patch`, so GymCoach signs in as NANO. A valid token is reused. The Speediance app on the iPhone and the Gym Monster stay signed in.

## Other Gym Monster models

GymCoach is built and tested on the **Gym Monster 1**. Choose your model under Settings → *Speediance account* or click *Detect my device*; GymCoach then fetches your device's exercise catalogue. If a standard exercise isn't in it, GymCoach picks the same exercise by name, or a cable exercise for the same muscle group.

## Versions

GymCoach follows MAJOR.MINOR.PATCH (see [CHANGELOG.md](CHANGELOG.md), in Dutch); the version is in `package.json` and in the app. The iPhone app has its own version number (`ios/project.yml`).

## Disclaimer

GymCoach is an independent project and not affiliated with Speediance, Withings or Apple. It uses the unofficial Speediance API; a Speediance app update may break things. Training suggestions and measurements are not medical advice: talk to your doctor before you start if you have complaints or risk factors, and see a doctor or physiotherapist if you feel pain.

## License

MIT, see [LICENSE](LICENSE). © 2026 A. Stoelwinder Holding B.V.
