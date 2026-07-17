# Asset Migration Plan — Assets.xcassets → Expo

Source (read-only): `/Users/cluna/BlackjackCardCounter/BlackjackCardCounter/Assets.xcassets`
Status: **inventory only — nothing has been copied yet** (awaiting review, per Milestone 0 instructions).

## Inventory summary (verified by script against every `Contents.json`)

- 178 imagesets + 1 appiconset + 1 colorset. **Every file referenced by a `Contents.json` exists — no missing files.**
- **Every imageset ships a single 1x PNG.** There are no @2x/@3x variants anywhere, so migration is a flat copy of one PNG per imageset (no scale-suffix work needed, but also no high-density variants to gain).
- Catalog weight: **113 MB**. Representative sizes: card faces 500×700 (~320 KB each), chips 500×500 (~52 KB), felts/maps/dealer 1024×1024 (1.1–1.5 MB each).
- ~60 loose PNG/JPGs sit *beside* the imagesets (see "Do not migrate").
- Training cards are genuinely different art from regular cards (hashes differ) — both sets migrate.

## Proposed Expo folder structure (to be created at migration time)

```
assets/
  cards/            52 faces + deck-cover.png        (from Cards/)
  training-cards/   52 faces, t_ prefix dropped      (from TrainingCards/)
  chips/
    default/        chip-1,5,10,25,50,100            (from Chips/Chip_*)
    inferno/        chip-5,25,50,250,500             (from Chips/InfernoChips)
    europa/         chip-25,50,100,500,1000          (from Chips/EuropaChips)
    ganymede/       chip-100,250,500,2500,5000       (from Chips/GangChips)
    titan/          chip-250,1000,2500,10000,25000   (from Chips/TitanChips)
  maps/             casino art + lock/unlock icons   (from MapImages/)
  tables/           6 suede felts                    (from TableTextures/)
  buttons/          action/deal/redo/autoplay/home   (from AppAssets/)
  map-cards/        carousel backs map1–map6         (from AppAssets/Map*B*)
  dealer/           house-dealer.png                 (from HouseDealer.imageset)
  branding/         title art, app icon source       (from AppAssets + AppIcon)
  audio/            (empty — no source audio exists; to be sourced)
  fonts/            (empty — no source fonts exist; Google Fonts via expo-font)
  images/           existing Expo starter icons (keep icon/splash/adaptive until replaced)
```

Naming convention: lowercase kebab/snake, no spaces, no interior dots (Metro parses suffixes like `.ios`/`@2x` from filenames — names such as `gang_2.5k.png` are hazardous). Rank-suit pattern: `ace-of-spades.png`, `10-of-clubs.png`.

## Typed asset registry

React Native requires static `require()` calls, so migration includes `src/assets/registry.ts` (Milestone 2):

- `CARD_FACES: Record<"regular" | "training", Record<CardId, ImageSource>>` where `CardId` = `"${Rank}-${Suit}"` (104 explicit requires).
- `CHIP_SETS: Record<ChipSetId, Record<number, ImageSource>>` keyed by denomination.
- `MAP_ART`, `TABLE_FELTS`, `BUTTONS`, `BRANDING` records.
- A test asserts every registry entry resolves and that all 52 ranks × suits exist per skin.

## Migration table (imageset → new path)

### Cards (53 imagesets — migrate)

| Original imageset (Cards/) | New path | Notes |
|---|---|---|
| `2OfClubs` … `10OfClubs`, `JackOfClubs`, `QueenOfClubs`, `KingOfClubs`, `AceOfClubs` (13) | `assets/cards/2-of-clubs.png` … | 1x only, 500×700 |
| 13 × Diamonds (imagesets named `…OfDiamonds`) | `assets/cards/…-of-diamonds.png` | Inner *files* are inconsistently named (`10OfDiamond.png`, singular) — the imageset name is authoritative |
| 13 × Hearts | `assets/cards/…-of-hearts.png` | |
| 13 × Spades | `assets/cards/…-of-spades.png` | Inner files include typos (`2OfSppades.png`) — normalize on copy |
| `DeckCover` | `assets/cards/deck-cover.png` | Card back used for hole card & shoe |

### Training cards (52 imagesets — migrate)

`TrainingCards/T_<Rank>Of<Suit>` → `assets/training-cards/<rank>-of-<suit>.png`. Note the imageset `T_JackOfDiamond` (singular — rename to `jack-of-diamonds.png`). No training deck-cover exists; training mode reuses `cards/deck-cover.png`.

### Chips (26 imagesets — migrate)

| Original | New path | Rename notes |
|---|---|---|
| `Chips/Chip_1,5,10,25,50,100` | `assets/chips/default/chip-<n>.png` | `Chip_10` exists but no map uses a 10 denomination — migrate anyway (cheap, future-proof) |
| `Chips/InfernoChips/Inferno_5,25,50,250,500` | `assets/chips/inferno/chip-<n>.png` | |
| `Chips/EuropaChips/Europa_25,50,100,500,1k` | `assets/chips/europa/chip-<n>.png` | `1k` → `chip-1000.png` |
| `Chips/GangChips/gang_100,250,500,2.5k,5k` | `assets/chips/ganymede/chip-<n>.png` | `2.5k` → `chip-2500.png` (dot in name), `5k` → `chip-5000.png` |
| `Chips/TitanChips/Titan_250,1k,2.5k,10k,25_K` | `assets/chips/titan/chip-<n>.png` | `Titan_25_K` → `chip-25000.png`, `2.5k` → `chip-2500.png` |

**No Kepler chip set exists.** Original code gives Kepler the default chips; the spec allows "a premium set". Decision pending (see IMPLEMENTATION_PLAN).

### Map images (14 imagesets — migrate 9, hold 5)

The original map carousel uses: `RealLunaLuxe`, `RealLounge`, `RealEuropa`, `Ganymede`, `TitanMethane`, `Kepler`, plus `Lock`, `LockedLock`, `unlock`.

| Original | New path | Status |
|---|---|---|
| `RealLunaLuxe` | `assets/maps/luna-luxe.png` | migrate |
| `RealLounge` | `assets/maps/inferno.png` | migrate |
| `RealEuropa` | `assets/maps/europa.png` | migrate |
| `Ganymede` | `assets/maps/ganymede.png` | migrate |
| `TitanMethane` | `assets/maps/titan.png` | migrate |
| `Kepler` | `assets/maps/kepler.png` | migrate |
| `Lock`, `LockedLock`, `unlock` | `assets/maps/lock.png`, `lock-locked.png`, `unlock.png` | migrate |
| `LunaLuxe`, `Europa`, `Europaa`, `Inferno`, `Infernoo` | — | **hold** — superseded variants (all four Europa/Inferno hashes differ; the `Real*` versions are the ones referenced by `MapSelectionView.swift`). Keep in source; do not copy unless a screen needs them |

### Table textures (6 imagesets — migrate)

`Gray_Suede, Blue_Suede, GreenSuede, Orange_Suede, Purple_Suede, Yellow_Suede` → `assets/tables/<color>-suede.png` (normalize `GreenSuede`). Map assignment from original `Map.swift`: Luna=gray, Inferno=orange, Europa=blue, Ganymede=purple, Titan=green, Kepler=yellow. 1024×1024, ~1.5 MB each — prime candidates for compression.

### App assets / buttons (26 imagesets — migrate 25, hold 1)

| Original (AppAssets/) | New path |
|---|---|
| `HitAssetButton`, `StandAssetButton`, `DDAssetButton`, `SplitAssetButton` | `assets/buttons/hit.png`, `stand.png`, `double.png`, `split.png` |
| `DealButton1`, `DealButton2`, `RedoBetButton`, `AutoPlayButton1` | `assets/buttons/deal-1.png`, `deal-2.png`, `redo-bet.png`, `autoplay.png` |
| `CTStart`, `CTSettings`, `CTRewards`, `CTHowToPlay` | `assets/buttons/home-start.png`, `home-settings.png`, `home-rewards.png`, `home-how-to-play.png` |
| `Map1B1`, `Map2B`…`Map6B`, `Map2B2`…`Map6B2` | `assets/map-cards/map<１-6>-front.png` / `-back.png` (exact front/back roles verified against Swift usage at copy time) |
| `Map1Back` | `assets/map-cards/map1-back.png` |
| `BlackJack Card Counter` (title art; space in name) | `assets/branding/title.png` |

Action buttons are small (120×66 @1x) — they may look soft on 3x phones; flagged for a possible re-export at higher resolution later (not fabricated now).

### Dealer & icon

| Original | New path | Notes |
|---|---|---|
| `HouseDealer.imageset/BlackJack Card Counter (4).png` | `assets/dealer/house-dealer.png` | 1024×1024 |
| `AppIcon.appiconset` (`NewLogo.png`, `NewLogo 1.png`, `NewLogo 2.png`) | `assets/branding/app-icon-source.png` | Pick the 1024×1024 variant; wire into `app.json` `icon` at Milestone 6 |

## Do not migrate

- **~54 loose card PNGs** directly inside `Cards/` (e.g. `Cards/2OfSppades.png`, `Cards/10OfDiamond.png`) — stray duplicates of the imageset contents with typo'd names; the `.imageset` copies are authoritative.
- **`Chips/1.png` … `Chips/6.png`** — loose duplicates of the default chip art (the imagesets reference their own copies).
- **`HouseDealer.JPG`** at catalog root — superseded by `HouseDealer.imageset`.
- **`AccentColor.colorset`** — empty color set; theme colors live in `src/theme` as TypeScript tokens.
- Old Expo starter demo images (`react-logo*`, `expo-badge*`, `tutorial-web.png`, `logo-glow.png`, tab icons) — deleted when starter screens are replaced (Milestone 2); `icon.png`/`splash-icon.png`/android adaptive icons stay until branding replaces them.

## Missing assets (must be sourced — do not fabricate)

1. **Audio:** zero sound files in the entire Swift project. All SFX (deal, flip, chip, win, lose, shuffle, button) must be sourced.
2. **Fonts:** none in the original (system fonts were used). Google Fonts via `expo-font` planned.
3. **Kepler chip art** (see above).
4. **Card back for training skin** — none exists; shared `deck-cover.png` is used by design.
5. **High-resolution (2x/3x) variants** — nothing to migrate; all art is 1x.

## Conversion / optimization (needs approval)

- All files are already PNG (one dealer JPG is superseded); **no format conversion required**.
- Recommended at copy time: lossless `oxipng`/`pngquant` pass. Estimated to cut the 113 MB catalog substantially (felts/maps are unoptimized 1.4–1.5 MB PNGs). Originals remain untouched in the Swift project. This alters shipped bytes, so it is a listed owner decision.
- Cards at 500×700 will be displayed at roughly 80–120 pt width; consider downscaling to ~360×504 during optimization if weight remains a problem (also an owner decision).

## Migration procedure (when approved — Milestone 2)

1. Script (`scripts/migrate-assets.mjs`) reads each imageset's `Contents.json`, resolves the 1x file, copies it to the new path with the normalized name. No hand-copying; rerunnable.
2. Optional optimization pass (pending approval).
3. Generate/verify `src/assets/registry.ts`; run the registry completeness test.
4. Spot-check on device: one card, one chip set, one felt, one map at both small and large phone sizes.
