# Implementation Plan — Blackjack Card Counter

Milestone 0 (this audit) is complete. Spec: `/Users/cluna/BlackjackCardCounter/REBUILD_SPEC.md`. Architecture: `docs/ARCHITECTURE.md`. Assets: `docs/ASSET_MIGRATION.md`.

## Milestone 0 findings (audit results)

- `npx expo-doctor`: **20/20 checks passed**. `npx expo install --check`: **dependencies up to date**. Node v22.13.1, npm 10.9.2.
- Expo SDK 57 / RN 0.86 / React 19.2.3 / Reanimated 4.5 / TypeScript 6.0 (strict). `reactCompiler` and `typedRoutes` experiments enabled in `app.json`.
- Router lives at `src/app` (starter tabs demo). `tsconfig` maps `@/* → ./src/*`, `@/assets/* → ./assets/*`.
- **Workspace incident:** at audit start, every tracked file (package.json, app.json, src/, assets/, …) had been deleted from the working tree (only `.cursor/`, `.expo/`, `.git` remained). They were restored with `git restore .` from the initial commit. The small pre-existing modifications to `app.json` / `package.json` recorded before the deletion could not be recovered.
- Original Swift app inspected read-only: ~14.8k lines of Swift; largest files 2,379 (TrainingModeView) and 2,192 (ChipWinLoseAnimation) — confirms spec fix #10 (keep files small).
- Asset catalog: 113 MB, 178 imagesets all present at 1x only, plus ~60 loose duplicate PNGs. **No audio files and no font files exist anywhere in the original project.**
- UI/UX Pro Max skill run for design system (premium dark + gold; see ARCHITECTURE §11).

## Contradictions, gaps, and risks

1. **No audio assets exist.** Spec §15.4 requires wiring sound, but there are no sound files to migrate. Sounds must be sourced/created (royalty-free casino SFX) — decision needed on sourcing.
2. **Kepler chips undefined.** Spec says denominations "250 … 25000 (or a premium set)", but the original code assigns Kepler the default Luna chip art (1/5/25/50/100) and no Kepler chip art exists. Decision: reuse Titan denominations/art, reuse Luna art with Titan denominations, or commission new art.
3. **Achievement catalog is under-specified.** Spec §9 says 17 achievements but enumerates ~15; the original `StatsKey` enum tracks only 11 stats and several listed achievements (perfect-strategy hands, dealer-bust wins, count above +10, comeback win, all-in bet, bet 500, collect 1000 chips) have no stat counters in the old code. The rebuild must define the definitive 17-item catalog — proposal to be confirmed before Milestone 5.
4. **iPad conflict.** Spec fix #9 says don't artificially restrict iPad; the rebuild prompt says phone-only. Resolution: build phone-only (prompt wins), but never gate features by device type, so a tablet layout can come later.
5. **True count divisor.** "Decks remaining" is not precisely defined. Assumption: `cardsRemaining / 52` as a real number (floored at 0.5 deck to avoid division blow-ups), result rounded to nearest 0.5. Confirm in Milestone 1 review.
6. **Asset weight.** 113 MB of 1x PNGs (cards ~320 KB each, felts ~1.5 MB) would bloat the app badly. Migration plan proposes lossless/lossy optimization at copy time — needs owner approval since it alters shipped pixels (originals untouched).
7. **Naming hazards.** Several asset names need normalization for Metro (`gang_2.5k`, `Titan_25_K`, `BlackJack Card Counter.imageset`, files with spaces/typos like `2OfSppades.png`, `10OfDiamond.png`). Covered in ASSET_MIGRATION.
8. **Quiz ambiguity.** After 9-in-a-row and claiming 250 chips, the streak is assumed to reset to 0. Wrong answers reset the streak but the spec doesn't say whether XP was already banked per correct answer — assumption: yes, 3 XP per correct answer is kept.
9. **React Compiler + Reanimated 4** are both enabled/new; if worklet compilation misbehaves, disabling the `reactCompiler` experiment is the first lever.
10. **Felt text rule.** Spec fix #6: engine is S17 and any table art text must say "Dealer stands on soft 17". The suede textures are plain (no text), so the rule label is rendered in UI text — no art dependency.

## Milestone 1 — Pure game engine (next up)

Scope (no UI, no stores, no assets):

1. Add dev-deps: `jest`, `jest-expo`, `@types/jest`; `npm test` script.
2. `src/engine/cards`: Suit/Rank/Card, 52-card deck builder, blackjack values, Hi-Lo values.
3. `src/engine/shoe`: multi-deck shoe (1/2/4/6/8), injectable RNG (Fisher–Yates), draw, penetration warning thresholds (14 / 52 cards).
4. `src/engine/blackjack`: hand totals (hard/soft), soft detection, blackjack/bust detection, dealer S17 policy, split eligibility by value (10+K), one-split max, per-hand double-after-split, double eligibility (exactly 2 cards).
5. `src/engine/counting`: running count from visible cards, hole-card exclusion, shuffle reset, true count (÷ decks remaining, round to nearest 0.5).
6. `src/engine/strategy`: hard/soft/pair tables from spec §6, pair matching by value, recommendations for split hands.
7. `src/engine/payouts`: 3:2 natural, 1:1 win, push, split-21 pays 1:1; XP mapping (win 3 / push 2 / loss 1).
8. `src/engine/state-machine`: `RoundPhase` transitions + guards, natural-blackjack short-circuit, all-hands-busted dealer reveal-only rule.
9. Unit tests for every item in the prompt's testing list. Definition of done: `npm test` green, zero React/RN imports inside `src/engine` (enforced by a lint rule or test).

## Milestone 2 — Mobile app foundation

Remove unused deps (`expo-web-browser`, `expo-glass-effect`, `@expo/ui`, `expo-symbols`, `react-native-web`, `react-dom`); add `zustand`, `zod`, `@react-native-async-storage/async-storage`, `expo-haptics`, `expo-audio`, `expo-linear-gradient`, `expo-asset`. Replace starter screens with the real route map; theme tokens (Luna Luxe palette, spacing, type scale); persistence layer + Zod schemas + defaults; economy/progression/settings/achievements stores; audio & haptics services (with placeholder-silent sound map until SFX are sourced); chip+level progression header; global settings screen; app icon/splash swap. First tranche of asset migration (cards, Luna chips, Luna felt, buttons) per ASSET_MIGRATION once the inventory is approved.

## Milestone 3 — Luna Luxe vertical slice (Training Mode)

Full table loop on map 1: betting (chip tray, return/redo, max-bet cap), deal choreography, hit/stand/double/split, dealer play, resolution, payouts with chip animations, collection sweep, shuffle flow, running + true count meter, card underglow, strategy hints, XP awards, persistence of chips/XP, broke-recovery overlay, ~0.6 s action cooldown, dealer-speed scaling.

## Milestone 4 — Additional modes

Regular Mode (aids stripped; cards dealt/remaining/max-bet only), Quiz Mode (3–7 cards @ ~0.8 s, 4 choices, 3 XP, 9-streak → 250 chips), autoplay drill (strategy bot, speed slider, stop-after-hand, auto-clear ~1.5 s), strategy chart overlay, count pulse, dealt-vs-remaining charts.

## Milestone 5 — Progression

All six maps (felts, chip sets, carousel with scale/alpha + dots), lock shake / unlock animation, unlock persistence, full achievement catalog + toasts, lifetime stats screen, rewards (daily 500 w/ countdown, simulated ad 1000 when broke), zero-chips overlay.

## Milestone 6 — Polish & release

Final art pass, sourced audio wired, haptic pass, reduced-motion QA, small (iPhone SE) / large (Pro Max) layout QA, Android back behavior QA, save migration test, dev builds on both platforms, release config (icons, splash, bundle ids), asset weight audit.

## Testing approach summary

Engine: pure Jest suites (Milestone 1, the bulk of correctness). Stores: Jest with in-memory AsyncStorage mock (Milestones 2/5). Machine transitions: table-driven legality tests. UI: manual matrix (2 platforms × small/large phone) each milestone; component tests only where regressions bite (chip math display, meter clamping).

## Decisions needed from the owner

1. Audio sourcing (no original SFX exist) — royalty-free pack acceptable?
2. Kepler chip art/denominations (see risk 2).
3. Definitive 17-achievement catalog (see risk 3).
4. Approve asset optimization (compression) during migration, or ship originals as-is (113 MB source).
5. Font licensing/choice (Bodoni Moda + Jost from Google Fonts suggested).
6. Approve the asset inventory in `docs/ASSET_MIGRATION.md` before any bulk copy (per instruction, nothing has been copied yet).
