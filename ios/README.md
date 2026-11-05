# GymCoach Sync (iPhone)

Kleine iPhone-app die uit Apple Health precies leest wat GymCoach nodig heeft en het naar je eigen GymCoach-server stuurt:

- **Workouts** (iPhone en Apple Watch): soort, start/eind, duur, afstand, actieve energie, gemiddelde en maximale hartslag, het hartslagverloop tijdens de workout (ook in de rust tussen sets), bron.
- **Dagtotalen**: stappen, actieve energie, wandel-/loopafstand en hartslag in rust.

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

1. GymCoach → Instellingen → Apple Health → *Koppelsleutel maken*.
2. In de app: serveradres (bijv. `http://192.168.1.50:8765` thuis, of `https://gymcoach.example.com` via je VPS) en de sleutel. *Test verbinding*.
3. *Volledige historie versturen* (eenmalig), daarna gaat het vanzelf.

Gewone `http://` naar je thuisnetwerk is toegestaan; buitenshuis heb je een bereikbaar adres nodig (VPS met tunnel, zie de hoofd-README, of Tailscale).
