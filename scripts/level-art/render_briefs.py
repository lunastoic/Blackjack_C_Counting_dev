"""Render the level-brief vignettes (briefs.py) to PNGs for the app.

    python3 render_briefs.py [--out ../../assets/briefs]

One headless-Chrome screenshot of a 6×6 sheet, each cell the 260×104 scene at 3×
(780×312) on a transparent ground, cropped to assets/briefs/map{N}/level-{L}.png (3× pixels, no scale suffix — the brief
sizes it by aspect ratio, and Jest's resolver wants the plain name) — the same drawing
the mock-up shows, so the app and the page match.
Needs Pillow and Google Chrome; the Jersey 20 / IBM Plex Mono webfonts load from Google.
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image

import briefs

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
SCALE = 3
CW, CH = briefs.W * SCALE, briefs.H * SCALE

CSS = """
:root{--sys:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--jr:"Jersey 20",Impact,"Arial Narrow",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
html,body{margin:0;background:transparent;overflow:hidden}
.sheet{display:grid;grid-template-columns:repeat(6,%dpx);grid-auto-rows:%dpx}
.cell{width:%dpx;height:%dpx}
.cell svg{display:block;width:100%%;height:100%%}
""" % (CW, CH, CW, CH)


def main():
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join('..', '..', 'assets', 'briefs')
    cells = ''.join(f'<div class="cell">{briefs.scene(m, l)}</div>' for m in range(1, 7) for l in range(1, 7))
    page = ('<!doctype html><html><head><meta charset="utf-8">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Jersey+20&display=swap">'
            f'<style>{CSS}</style></head><body><div class="sheet">{cells}</div></body></html>')
    with tempfile.TemporaryDirectory() as tmp:
        hp, pp = os.path.join(tmp, 'sheet.html'), os.path.join(tmp, 'sheet.png')
        open(hp, 'w', encoding='utf-8').write(page)
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                        '--force-device-scale-factor=1', f'--window-size={6*CW},{6*CH}', '--virtual-time-budget=12000',
                        f'--screenshot={pp}', 'file://' + hp], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL, check=True)
        sheet = Image.open(pp).convert('RGBA')
        assert sheet.size == (6 * CW, 6 * CH), sheet.size
        total = 0
        for m in range(1, 7):
            d = os.path.join(out, f'map{m}')
            os.makedirs(d, exist_ok=True)
            for l in range(1, 7):
                cell = sheet.crop(((l - 1) * CW, (m - 1) * CH, l * CW, m * CH))
                fp = os.path.join(d, f'level-{l}.png')
                cell.save(fp, optimize=True)
                total += os.path.getsize(fp)
        print(f'wrote 36 scenes to {out} ({total/1024:.0f} KB)')


if __name__ == '__main__':
    main()
