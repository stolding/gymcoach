# GymCoach — afspraken voor wijzigingen

- **Versie** staat in `package.json` en verschijnt in de app (Instellingen → Over GymCoach, inlogscherm).
  Bij **elke** wijziging de versie ophogen (MAJOR.MINOR.PATCH):
  - PATCH (laatste cijfer): elke wijziging of reparatie
  - MINOR (middelste cijfer): een kleine nieuwe functie
  - MAJOR (eerste cijfer): een grote wijziging
  Zet er een regel bij in `CHANGELOG.md`.
- De iOS-app (GymCoach Sync, `ios/project.yml`, MARKETING_VERSION) heeft een eigen versienummer.
- Logo: `public/logo.svg` is hetzelfde ontwerp als het app-icoon van GymCoach Sync. PNG-iconen (`icon-180/192/512.png`, `favicon-32.png`) opnieuw maken als het logo verandert.
- UI is Nederlands; donker thema is de standaard.
- Copyright: © A. Stoelwinder Holding B.V., open source onder de MIT-licentie (zie LICENSE).
- README in twee talen: `README.md` (Engels) en `README.nl.md` (Nederlands) samen bijwerken. Brochure-PDF en `documentatie/afbeeldingen/` samen bijwerken.
