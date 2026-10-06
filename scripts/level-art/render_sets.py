"""Render the three alternative level-art sets: one headless-Chrome screenshot per set
(a 6×6 grid of icons), then trim + pad each cell to a 512px PNG like the shipped set.

usage: python3 render_sets.py [a b c] [--out DIR] [--preview]
  --out ../../assets/levels   writes map{N}/set-{x}/level-{L}.png for the chosen sets
  --preview                   writes sets_preview.png: shipped art beside each set, per casino
"""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sets as S
from PIL import Image, ImageDraw

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, 'setexp')
os.makedirs(WORK, exist_ok=True)

CELL = 800          # px per icon cell in the screenshot
ART = 620           # px the 100-unit svg is drawn at inside the cell (art bleeds a little past)
SUEDE = {1: '#3A3532', 2: '#66391C', 3: '#253E58', 4: '#3C2B52', 5: '#1F4634', 6: '#63501A'}

args = [a for a in sys.argv[1:] if not a.startswith('--')]
keys = args or ['a', 'b', 'c']
out_root = None
if '--out' in sys.argv:
    out_root = sys.argv[sys.argv.index('--out') + 1]
preview = '--preview' in sys.argv


def render_set(key):
    cells = ''
    for mid in range(1, 7):
        for lvl in range(1, 7):
            x = (lvl - 1) * CELL + (CELL - ART) // 2
            y = (mid - 1) * CELL + (CELL - ART) // 2
            cells += f'<div class="c" style="left:{x}px;top:{y}px">{S.art(key, mid, lvl)}</div>'
    html = f'''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Jersey+20&display=swap">
<style>:root{{--jr:"Jersey 20",Impact,sans-serif;--mono:"IBM Plex Mono",monospace;--sys:-apple-system,BlinkMacSystemFont,sans-serif}}
html,body{{margin:0;background:transparent;width:{6*CELL}px;height:{6*CELL}px;overflow:hidden}}
.c{{position:absolute;width:{ART}px;height:{ART}px}}
.c svg{{width:{ART}px;height:{ART}px;overflow:visible;filter:drop-shadow(0 18px 11px #000a)}}</style></head>
<body>{cells}</body></html>'''
    hp = os.path.join(WORK, f'set-{key}.html')
    pp = os.path.join(WORK, f'set-{key}.png')
    open(hp, 'w').write(html)
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                    '--force-device-scale-factor=1', f'--window-size={6*CELL},{6*CELL}', '--virtual-time-budget=6000',
                    f'--screenshot={pp}', 'file://' + hp], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL, check=True)
    sheet = Image.open(pp).convert('RGBA')
    assert sheet.size == (6 * CELL, 6 * CELL), sheet.size
    tiles = {}
    for mid in range(1, 7):
        for lvl in range(1, 7):
            cell = sheet.crop(((lvl - 1) * CELL, (mid - 1) * CELL, lvl * CELL, mid * CELL))
            box = cell.split()[3].point(lambda a: 255 if a > 8 else 0).getbbox()
            im = cell.crop(box)
            side = int(max(im.size) * 1.04)
            sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
            sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
            sq = sq.resize((512, 512), Image.LANCZOS)
            tiles[(mid, lvl)] = sq
            if out_root:
                d = os.path.join(out_root, f'map{mid}', f'set-{key}')
                os.makedirs(d, exist_ok=True)
                sq.save(os.path.join(d, f'level-{lvl}.png'), optimize=True)
    return tiles


all_tiles = {k: render_set(k) for k in keys}
print('rendered', {k: len(v) for k, v in all_tiles.items()})

if preview:
    # contact sheet: rows = maps, columns = each level's current art then the chosen sets
    REPO = os.path.normpath(os.path.join(HERE, '..', '..', 'assets', 'levels'))
    T, pad = 150, 8
    cols = 6 * (1 + len(keys))
    W = pad + cols * (T + pad) + 6 * pad
    H = pad + 6 * (T + 28 + pad)
    sheet = Image.new('RGB', (W, H), '#111')
    d = ImageDraw.Draw(sheet)
    for mid in range(1, 7):
        y = pad + (mid - 1) * (T + 28 + pad)
        x = pad
        for lvl in range(1, 7):
            srcs = [('now', Image.open(f'{REPO}/map{mid}/level-{lvl}.png').convert('RGBA'))] + [(k.upper(), all_tiles[k][(mid, lvl)]) for k in keys]
            for label, im in srcs:
                im = im.copy(); im.thumbnail((T, T))
                d.rectangle([x, y, x + T, y + T + 24], fill=SUEDE[mid])
                sheet.paste(im, (x + (T - im.width) // 2, y + (T - im.height) // 2), im)
                d.text((x + 6, y + T + 6), f'L{lvl} {label}', fill='#F3ECD9')
                x += T + pad
            x += pad
    sheet.save(os.path.join(HERE, 'sets_preview.png'))
    print('preview', sheet.size)
