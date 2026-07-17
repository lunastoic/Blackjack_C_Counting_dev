# Architecture — Blackjack Card Counter (React Native rebuild)

Audit date: 2026-07-13 (Milestone 0).
(read-only copy in the original Swift repo — do not modify).

## 1. Goals and constraints

- Phone-only (iPhone + Android), portrait-first, fully offline.
- One shared TypeScript codebase on Expo SDK 57 / React Native 0.86 (New Architecture).
- The blackjack engine is pure TypeScript with zero React or React Native imports, testable under Node.
- One explicit round-phase state machine; no competing boolean flags.
- All gameplay animation via React Native Reanimated 4 (worklets on the UI thread). No `motion/react`, no DOM.

## 2. Layered architecture

```
┌─────────────────────────────────────────────────────┐
│ app/ (src/app)      Expo Router screens (thin)      │
├─────────────────────────────────────────────────────┤
│ src/features        Screen-level composition, hooks │
│ src/components      Reusable presentational pieces  │
│ src/animation       Reanimated orchestration hooks  │
├─────────────────────────────────────────────────────┤
│ src/stores          Zustand slices (game session,   │
│                     economy, progression, settings, │
│                     achievements)                    │
├─────────────────────────────────────────────────────┤
│ src/services        audio, haptics (side effects)   │
│ src/persistence     AsyncStorage + Zod schemas      │
├─────────────────────────────────────────────────────┤
│ src/engine          PURE TypeScript. No RN imports. │
│                     cards, shoe, hands, rules,      │
│                     counting, strategy, machine,    │
│                     payouts                          │
└─────────────────────────────────────────────────────┘
```

Dependency rule: arrows only point downward. `src/engine` imports nothing from the layers above it. Stores import the engine; components import stores; screens import features. Services are only called from stores/features, never from the engine.

## 3. Engine domains (`src/engine`)

| Module | Responsibility |
|---|---|
| `cards/` | `Suit`, `Rank`, `Card`, deck construction, card value tables |
| `shoe/` | Multi-deck shoe (1/2/4/6/8), seeded/injectable RNG shuffle, penetration thresholds (warn at 14 cards for 1–2 decks, 52 for 4+) |
| `blackjack/` | Hand evaluation (hard/soft totals, soft detection, blackjack detection, bust), dealer policy (S17: stand on soft 17), split eligibility (equal *value*, 10+K qualifies, one split max), double eligibility |
| `counting/` | Hi-Lo values (2–6 = +1, 7–9 = 0, 10/J/Q/K/A = −1), running count over *visible* cards only, true count = running ÷ decks remaining, rounded to nearest 0.5 |
| `strategy/` | Basic-strategy tables (hard, soft, pairs) exactly as in spec §6; pair detection by value; works on split hands |
| `payouts/` | Natural 3:2, win 1:1, push returns bet, split-hand 21 pays 1:1 |
| `state-machine/` | Phase enum + legal-transition table + guards (see §5) |

The engine deals in plain data (no `UUID` side effects at module load, no timers). Animation timing, cooldowns (~0.6 s action anti-spam), and dealer-speed scaling live in the orchestration layer, not the engine.

RNG is injected (`(n: number) => number`) so shuffles are deterministic in tests.

## 4. Domain types (`src/types` + engine-local types)

Explicit types required by the spec and prompt:

- `Suit`, `Rank`, `Card` (engine)
- `Hand`, `SplitHand` (engine) — a round holds 1–2 player hands; split hands track per-hand bet, doubled flag, and play order (right hand first)
- `Shoe` (engine)
- `GameMode` = `training | regular | quiz`
- `PlayerAction` = `hit | stand | double | split`
- `RoundPhase` = `betting | dealing | playerTurn | dealerTurn | resolution | payout | collecting | shuffling`
- `HandResult` = `blackjack | win | push | loss | bust | dealerBlackjack`
- `CasinoMap` (id, name, unlock level, max bet, chip denominations, art keys, felt key)
- `Achievement`, `AchievementProgress`
- `LifetimeStats` (hands, blackjacks, doubles, splits, wins, pushes, losses, streaks, no-bust counters, perfect-strategy hands, dealer-bust wins, count peaks, chips collected, …)
- `GameSettings` (deck counts per mode, aid toggles, sound, haptics, dealer speed, reduced motion)
- `PersistedSaveData` (versioned envelope, see §7)

## 5. Round state machine

`RoundPhase` is the single authoritative source. Legal transitions:

```
betting    → dealing                    (bet > 0, Deal pressed)
dealing    → playerTurn                 (no natural blackjack)
dealing    → resolution                 (natural blackjack short-circuit)
playerTurn → playerTurn                 (hit on same/next split hand)
playerTurn → dealerTurn                 (stand/bust/21/double resolved on last hand)
dealerTurn → resolution                 (dealer stands ≥17 / busts; hole-card-only reveal if all player hands busted)
resolution → payout
payout     → collecting
collecting → shuffling                  (penetration threshold reached)
collecting → betting                    (otherwise)
shuffling  → betting                    (count reset to 0)
```

Anything else throws in dev and is a tested invariant. UI booleans (`canDeal`, `showActions`, `isCollecting`…) are *derived* from the phase, never stored.

The hole card is dealt face down during `dealing` (deal order: player 1 → dealer hole down → player 2 → dealer up) and enters the running count only when flipped in `dealerTurn`.

## 6. Stores (Zustand, multiple slices — never one mega-store)

| Store | Contents | Persisted? |
|---|---|---|
| `useGameStore` | Current round: phase, shoe, hands, bets, visible-count, mode, per-session settings. Created per table session (vanilla store factory), not global-forever. | No (session only) |
| `useEconomyStore` | Chip balance, last bet, daily/ad reward timestamps | Yes |
| `useProgressionStore` | XP, level (30 XP/level, max 25, +1000 chips per level-up), unlocked map ids | Yes |
| `useAchievementsStore` | Lifetime stats + unlocked achievements + toast queue | Yes |
| `useSettingsStore` | Sound, haptics, dealer speed (0.5×–2.0×), deck counts per mode, aid toggles, reduced motion | Yes |

Stores call engine functions to compute next state; they never re-implement rules.

## 7. Persistence (`src/persistence`)

- AsyncStorage with a single versioned envelope per store (`bcc/v1/economy`, `bcc/v1/progression`, …).
- Every payload validated with Zod on read; invalid/missing data falls back to defaults (chips 500, level 1, map 1 unlocked, decks 6, underglow on, hints on, pulse off, charts off, sound/haptics on, speed 1.0).
- `schemaVersion` + a migration ladder from day one so Milestone 6 save-migration is trivial.
- Writes are debounced/batched; gameplay never awaits a write.

## 8. Services

- `services/audio`: expo-audio wrapper; preloaded sound map; respects sound toggle. (No audio files exist in the original project — see risks.)
- `services/haptics`: expo-haptics wrapper; respects haptic toggle; semantic API (`cardDealt()`, `chipPlaced()`, `won()`, …).

Both are no-op friendly so the engine/stores can be tested without native modules.

## 9. Animation orchestration (`src/animation`)

- A `RoundChoreographer` layer maps phase transitions to Reanimated sequences (deal ~0.5 s travel + ~0.26 s flip per card, payout chips, sweep-to-deck collection, shuffle notice). One card-collection system, not two (spec fix #7).
- All durations multiplied by `dealerSpeed` from settings; reduced-motion setting collapses sequences to near-instant with cross-fades.
- The choreographer signals completion back to the store, which advances the phase — the machine owns the truth, animations follow it.
- Shared element positions (deck origin, hand slots, bet circle, chip tray) come from a layout registry measured with `onLayout`, so the same choreography works on all phone sizes.

## 10. Screens (Expo Router)

The project uses `src/app` (Expo Router auto-detects it; the prompt's suggested tree has `app/` at repo root — keeping everything under `src/` is a deliberate, supported deviation).

```
src/app/
  _layout.tsx          root stack, providers, splash
  index.tsx            Home (dark red theme, hero, header)
  maps.tsx             carousel of 6 casinos
  settings.tsx         global settings
  rewards.tsx          daily + broke recovery
  achievements.tsx
  how-to-play.tsx
  game/[mapId].tsx     table (mode passed as param: training | regular)
  quiz/[mapId].tsx     quiz mode
```

Android back button and gesture nav are handled per-screen (confirm-exit during an active round).

## 11. Design direction (via UI/UX Pro Max skill)

Skill run: `search.py "premium mobile casino card game dark luxury gold" --design-system`. Adopted with adjustments (skill's "Liquid Glass" style conflicts with the prompt's "avoid excessive glassmorphism" — we keep the premium-dark-plus-gold color strategy and reject heavy translucency):

- Palette (Luna Luxe): near-black `#0C0A09` background, deep burgundy `#3D0F14`–`#5C1A22` surfaces, warm gold CTA/accents `#CA8A04`/`#D4AF37`, cream text `#FAF7F0`; suede felt textures from the original assets.
- Typography: a display serif for titles (skill suggests Bodoni Moda) + a clean geometric sans (Jost) for UI, loaded with expo-font — final font choice is a Milestone 2 decision.
- Motion: ease-out entrances, 1–2 animated focal points per view, no fast/cheap animations (skill anti-patterns), everything respects reduced motion.
- Accessibility: 4.5:1 text contrast, ≥44 pt touch targets, `accessibilityLabel` on all interactive elements, count/glow information duplicated in text (never color-only), safe areas via react-native-safe-area-context.

## 12. Testing

- Runner: `jest` + `jest-expo` preset (to be added in Milestone 1). Engine tests import from `src/engine` only and run without any native mocks.
- Engine coverage targets the full list in the prompt (deck integrity, shoe sizes, Hi-Lo per rank, hidden/revealed hole card, shuffle reset, true-count rounding to 0.5, totals, soft detection, S17, 3:2 vs 1:1 split-21, split-by-value incl. 10+K, one-split max, double eligibility, full strategy tables, penetration thresholds, machine transition legality).
- Store-level tests (XP, level-ups, max level, unlocks, achievement progress, daily cooldown) run with mocked persistence.
- Component/UI testing is deferred to later milestones; engine and stores carry the correctness burden.

## 13. Dependency decisions

Installed today (all pass `npx expo-doctor` 20/20 and `expo install --check`): expo ~57.0.4, react 19.2.3, react-native 0.86.0, expo-router, react-native-reanimated 4.5.0, react-native-worklets, react-native-gesture-handler, react-native-safe-area-context, react-native-screens, expo-image, expo-font, expo-splash-screen, expo-constants, expo-device, expo-linking, expo-status-bar, expo-system-ui, expo-symbols, expo-web-browser, expo-glass-effect, @expo/ui, react-dom, react-native-web, typescript ~6.0.3.

To add (each via `npx expo install` / npm, all Expo-SDK-57 compatible):

| Package | Why |
|---|---|
| `zustand` | Store slices (required by prompt) |
| `zod` | Persistence schema validation (required by prompt) |
| `@react-native-async-storage/async-storage` | Persistence (required by prompt) |
| `expo-haptics` | Haptic feedback (required by prompt) |
| `expo-audio` | Sound effects (required by prompt) |
| `expo-linear-gradient` | Felt/table gradients (required by prompt) |
| `expo-asset` | Asset preloading (required by prompt) |
| `jest`, `jest-expo`, `@types/jest` (dev) | Engine unit tests |

To remove (unused for a phone-only custom-skinned game): `expo-web-browser`, `expo-glass-effect`, `@expo/ui`, `expo-symbols` (iOS-only SF Symbols; not cross-platform), `react-native-web` + `react-dom` (no web target). `expo-device` is optional; harmless to keep. Removal happens at the start of Milestone 2 so the starter app keeps building until then.

No backend, database, auth, analytics, ad SDK, or payment code — the "watch ad" reward is simulated per spec.
