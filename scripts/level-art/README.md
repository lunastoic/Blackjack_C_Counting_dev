# Level art

The level-node art for the Modern ladder (`assets/levels/map{N}/level-{L}.png`) is
drawn as SVG and rendered through headless Chrome. Luna Luxe's six are painted PNGs;
every other casino's, and the three alternative sets, come from here.

- `icons.py` — the SVG parts: card, deck, shoe, chip, badge, stopwatch, laurel, …
  (one 100×100 viewBox per icon, the casino card-back colours in `BACKS`).
- `sets.py` — one glyph per level (`glyph(mid, lvl, back)`) and the three frames
  that wrap it: **A · Crest**, **B · Hero Card**, **C · Medallion**. `art(set, mid, lvl)`
  returns the finished `<svg>`.
- `render_sets.py` — renders a set as a 6×6 grid in one Chrome screenshot, then trims
  and pads each cell to a 512px PNG the way the shipped set was exported.
- `briefs.py` — one 260×104 vignette per level (`scene(mid, lvl)`) for the level brief:
  the level's own cards, pads, pauses and entry boxes in place of the three example cards.
- `build_briefs.py` — rebuilds the mock-up's "Level brief · every level" section: the Card
  Rain brief four ways (today's pills vs. A stat tiles / B fine print / C placard) and all
  36 briefs on their casino's slab, titles/pace/copy read from `src/engine/dojo/training.ts`.
- `build_sheet.py` — rebuilds the mock-up's "Asset sheet" section so each level shows
  the shipped art plus the three sets, for picking.

```sh
python3 render_sets.py a b c --preview          # sets_preview.png to eyeball
python3 render_sets.py b --out ../../assets/levels   # export set B → map{N}/set-b/level-{L}.png
python3 build_sheet.py <saved-artifact.html> <out.html>   # then publish out.html to the mock-up
python3 build_briefs.py <saved-artifact.html> <out.html> --preview previews/   # same, for the briefs section
```

Needs Pillow and Google Chrome at `/Applications/Google Chrome.app`. Text uses the
Jersey 20 webfont, fetched from Google Fonts at render time.
