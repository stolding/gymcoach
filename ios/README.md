# GymCoach Sync (iPhone)

iPhone-app bij GymCoach. Twee dingen:

- **Onderweg, alleen lezen.** De app opent op het overzicht: herstel, de volgende training, het weekdoel, streak, volume, trainingstijd, gewicht, het doel en het plan van deze week. Daarnaast het schema met sets en gewichten, stappen, inname, voortgang en op Lichaam zeven samenstellingstegels met een grafiek. Het plan en de instellingen wijzig je op de computer. Zonder verbinding blijft de laatst geladen stand zichtbaar.
- **Apple Health** naar je eigen server. Het scherm onderweg heeft GymCoach 2.13.0 of nieuwer nodig. De Health-sync werkt ook met een oudere server.

Uit Apple Health leest de app precies wat GymCoach nodig heeft:

- **Workouts** (iPhone en Apple Watch): soort, start/eind, duur, afstand, actieve energie, gemiddelde en maximale hartslag, het hartslagverloop tijdens de workout (ook in de rust tussen sets), bron.
- **Dagwaarden**: stappen, actieve energie, wandel-/loopafstand, hartslag in rust, hartslagvariabiliteit (HRV, SDNN), VO2max-schatting (Apple Watch) en voeding (calorieën, eiwit, koolhydraten, vet, vezels).

Nieuwe workouts gaan automatisch, ook op de achtergrond (HealthKit background delivery), hooguit één keer per uur. Met *Automatisch alleen thuis* (standaard aan) alleen op wifi en als de server bereikbaar is; zet dit uit als GymCoach via internet bereikbaar is. Gym Monster-trainingen die Speediance zelf naar Apple Health schrijft, slaat de server over; het hartslagverloop ervan wordt wel aan de training gekoppeld voor het rapport.

Versie: `MARKETING_VERSION` in `project.yml` (los van de versie van GymCoach zelf).

## Bouwen zonder Mac

De app wordt gebouwd door GitHub Actions op een macOS-machine (`.github/workflows/ios.yml`). Het Xcode-project wordt met [XcodeGen](https://github.com/yonaskolb/XcodeGen) gemaakt uit `project.yml`.

- Elke push naar `ios/` doet een controle-build (simulator, zonder ondertekenen).
- **Actions → iOS-app → Run workflow** (TestFlight aan), een tag `ios-v…` of een commit met `[testflight]` in de tekst ondertekent de app en zet hem op TestFlight.

### Eenmalig instellen

Gebruik je eigen bundle-ID: pas `bundleIdPrefix` en `PRODUCT_BUNDLE_IDENTIFIER` in `project.yml` aan (bijv. `nl.jouwnaam.gymcoachsync`) en gebruik die hieronder in plaats van `com.stolding.gymcoachsync`.

1. **developer.apple.com → Identifiers → +**: App ID `com.stolding.gymcoachsync`, capability **HealthKit** aan (inclusief *Background Delivery*).
2. **App Store Connect → Apps → +**: nieuwe app, platform iOS, naam bijv. *GymCoach Sync*, bundle-ID `com.stolding.gymcoachsync`, SKU bijv. `gymcoachsync`.
3. **App Store Connect → Users and Access → Integrations → App Store Connect API → +**: sleutel met rol **Admin**. Noteer *Issuer ID* en *Key ID* en download het `.p8`-bestand (kan maar één keer).
4. **GitHub → repo → Settings → Secrets and variables → Actions**: voeg toe
   - `APPLE_TEAM_ID` – je Team ID (developer.apple.com → Membership)
   - `ASC_ISSUER_ID`, `ASC_KEY_ID`
   - `ASC_KEY_P8` – de volledige inhoud van het `.p8`-bestand
5. Draai de workflow. Na 10–30 minuten verwerking staat de build in **TestFlight**; voeg jezelf toe als interne tester en installeer via de TestFlight-app.

## Gebruik

1. Inloggen voor het scherm: adres (standaard `https://gymcoach.stolding.com`), gebruikersnaam en wachtwoord. Het wachtwoord wordt niet bewaard; de sessie wel.
2. GymCoach → Instellingen → Apple Health → *Koppelsleutel maken*.
3. In de app, bij *Apple Health* of *Meer → Synchroniseren*: een **apart** serveradres voor de sync (thuis vaak `http://192.168.1.50:8765`) en de sleutel. *Test verbinding*.
4. *Volledige historie versturen* (eenmalig), daarna gaat het vanzelf.

De twee adressen worden niet gedeeld. *Automatisch alleen thuis* geldt alleen voor de Health-sync. Het scherm probeert zijn eigen adres zodra je de app opent.

Gewone `http://` naar je thuisnetwerk is toegestaan voor de sync. Het scherm onderweg gebruikt het adres dat je daar invult.
