# App Store Release Checklist — $2.99 Paid App

Status legend: [ ] = you do it, [x] = already done in the repo.

## Legal / compliance position (why this app is sellable)

- Card counting is legal; teaching it is legal. Apple allows blackjack
  trainer/simulation apps.
- The app must stay **simulation only**: no real-money play, no prizes with
  cash value, no links or referrals to real casinos or betting sites. It
  currently complies.
- Age rating: in App Store Connect's questionnaire answer **Simulated
  Gambling: Frequent/Intense** → the app gets an 18+ rating. That is normal
  for this category and does not block a paid app.
- Real-money gambling rules (must be free, licensed, geo-restricted) do NOT
  apply because there is no real money involved.
- Google Play (later): same position — declare simulated gambling in the
  content questionnaire; paid app is allowed.

## Repo config (done)

- [x] `ios.bundleIdentifier`: `com.lunastoic.lunaluxeblackjack`
- [x] `ios.buildNumber` / `android.versionCode` set
- [x] `ITSAppUsesNonExemptEncryption: false` (skips the export-compliance
      question on every upload; correct because the app uses no custom crypto)
- [x] `eas.json` with a production build profile (auto-increments build number)
- [x] `PRIVACY_POLICY.md` (host it — see step 3)
- [x] Achievements + statistics already implemented in-app

## Steps to ship (in order)

1. **App Store Connect setup** (appstoreconnect.apple.com)
   - Agreements, Tax, and Banking → sign the **Paid Apps** agreement and enter
     banking + tax info. Without this you cannot charge $2.99. Can take a few
     days to clear — do this first.
   - Create the app record: platform iOS, bundle ID
     `com.lunastoic.lunaluxeblackjack` (register it under Identifiers if
     prompted), pick the public name (e.g. "Blackjack Card Counter — Trainer";
     exact names may be taken, variants are fine).
   - Pricing: choose the $2.99 tier, select territories.

2. **Age rating questionnaire**: Simulated Gambling = Frequent/Intense.
   Everything else No/None. Accept the resulting 18+ rating.

3. **Privacy**
   - Host `PRIVACY_POLICY.md` at a public URL (GitHub Pages on this repo is
     free: Settings → Pages, or a gist). Paste the URL into App Store Connect.
   - App Privacy section: declare **Data Not Collected** (true — everything is
     on-device, no analytics/ads/accounts).

4. **Build & submit** (from the project folder)
   ```bash
   npm install -g eas-cli
   eas login                      # your Expo account (free)
   eas build -p ios --profile production   # signs with your Apple account
   eas submit -p ios              # uploads the build to App Store Connect
   ```
   EAS walks you through Apple credentials/certificates automatically.

5. **Store listing**
   - Screenshots: required for 6.9" (iPhone Pro Max) — take them in the iOS
     Simulator (`npx expo run:ios`) or on-device. 3–10 images.
   - Description: emphasize "training / practice / learn card counting".
     Include the line "Simulation only — no real-money gambling" (reviewers
     look for this).
   - Keywords, support URL (GitHub repo page works), promo text.

6. **Submit for review.** In Review Notes, state: "This app is a blackjack
   strategy and card-counting trainer. Simulated chips only; no real-money
   wagering; no links to gambling services." Typical review: 1–3 days.

## Common rejection traps (avoid)

- Any button/link that could be read as directing users to real gambling.
- Crashes on launch on a clean install — test a production build once before
  submitting (`eas build --profile preview`, install on your phone).
- Screenshots showing debug UI or placeholder text.

## Google Play later

Same codebase: `eas build -p android --profile production`, one-time $25
developer fee, same simulated-gambling declaration, same privacy answers.
