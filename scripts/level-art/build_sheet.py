"""Rebuild the mock-up's "Asset sheet" so every level shows the shipped art plus the three
alternative sets (Crest / Hero Card / Medallion), stacked per level, labelled per row."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sets as S

if len(sys.argv) != 3:
    sys.exit('usage: python3 build_sheet.py <saved-artifact.html> <out-page.html>\n'
             '  saved-artifact.html: the mock-up as the Artifact read saves it; out-page.html: what to publish back')
SRC, OUT = sys.argv[1], sys.argv[2]

s = open(SRC, encoding='utf8').read()

# ── locate the current sheet: heading, note, and the .ma-sheet block ──
i = s.find('<h3 class="sub">Asset sheet — every level and reward, all six casinos</h3>')
assert i > 0
ms = s.find('<div class="ma-sheet">', i)
sec_end = s.find('</section>', ms)
old_block = s[i:sec_end]

# pull each casino's current tiles (suede colour, name, and the six <img> data URIs + titles) from the old sheet
chunks = old_block.split('<div class="ma-srow" style="--suede:')[1:]
assert len(chunks) == 6, len(chunks)
casinos = []
for body in chunks:
    suede = body[:7]
    name = re.search(r'<div class="hud-t">([^<]+)</div><div class="hud-s">Map (\d)</div>', body)
    tiles = re.findall(r'<div class="ma-tile"><div class="ma-ico"><img src="([^"]+)" alt=""></div><b>([^<]+)</b></div>', body)
    assert name and len(tiles) == 6, (name, len(tiles))
    casinos.append((int(name.group(2)), name.group(1), suede, tiles))
casinos.sort()

KEYS = [('now', 'Now'), ('a', 'A · Crest'), ('b', 'B · Hero Card'), ('c', 'C · Medallion')]


def row(mid, name, suede, tiles):
    out = [f'<div class="ma-srow ma-alt" style="--suede:{suede}">']
    out.append(f'<div class="ma-sname"><div class="hud-c marquee"><div class="hud-t">{name}</div><div class="hud-s">Map {mid}</div></div>'
               '<div class="ma-keys">' + ''.join(f'<i class="{k}">{label}</i>' for k, label in KEYS) + '</div></div>')
    for lvl, (uri, title) in enumerate(tiles, 1):
        out.append(f'<div class="ma-col"><b>{title}</b>'
                   f'<div class="ma-ico now"><img src="{uri}" alt=""></div>'
                   + ''.join(f'<div class="ma-ico">{S.art(k, mid, lvl)}</div>' for k in 'abc')
                   + '</div>')
    out.append('</div>')
    return ''.join(out)


NEW_BLOCK = (
    '<h3 class="sub" id="altsets">Asset sheet — every level and reward, all six casinos</h3>\n'
    '<p class="note">Every level node at 100pt on its casino’s suede. The top row of each casino is the art the app ships today; '
    'under it, three alternative sets to pick from, drawn in the same style and carrying the casino’s own colour — '
    '<b>A · Crest</b>, a shield with the level on a ribbon; <b>B · Hero Card</b>, one big card with the level’s glyph as its face art and the casino back behind; '
    '<b>C · Medallion</b>, a casino chip with the glyph on its inlay and the level’s prop tucked behind. '
    'Pick a set per casino or mix per level — whichever is chosen exports to 512px exactly like the shipped set.</p>\n'
    '<div class="ma-sheet">' + ''.join(row(*c) for c in casinos) + '</div>\n'
)
s = s[:i] + NEW_BLOCK + s[sec_end:]

# ── css: the stacked variant: row labels on the left, four icons per level column ──
CSS = '''
/* asset sheet — alternative sets stacked per level */
.ma-srow.ma-alt{grid-template-columns:170px repeat(6,minmax(0,1fr));align-items:start}
.ma-alt .ma-sname{position:relative;padding-top:46px}
.ma-alt .ma-sname .hud-c.marquee{position:absolute;top:0;left:0;right:0}
.ma-alt .ma-sname .hud-c.marquee .hud-t{font-size:16px;line-height:16px}
.ma-keys{display:flex;flex-direction:column;gap:6px}
.ma-keys i{height:104px;display:flex;align-items:center;font:12px/14px var(--mono);font-style:normal;letter-spacing:.5px;text-transform:uppercase;color:var(--aMuted);border-top:1px dashed #ffffff22;padding-top:2px}
.ma-keys i.now{color:var(--cream)}
.ma-col{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
.ma-col>b{height:40px;display:flex;align-items:flex-end;justify-content:center;text-align:center;font:16px/17px var(--jr);font-weight:400;letter-spacing:.5px;color:var(--cream);text-shadow:1px 2px 0 #000c;text-transform:uppercase;padding-bottom:4px}
.ma-col .ma-ico{border-top:1px dashed #ffffff22;padding-top:2px}
.ma-col .ma-ico.now{border-top-color:#ffffff44}
@media (max-width:1100px){.ma-srow.ma-alt{grid-template-columns:repeat(3,minmax(0,1fr))}.ma-alt .ma-sname{grid-column:1/-1}.ma-keys{display:none}}
'''
anchor = '.ma-tile span{font:10px/13px var(--mono);color:var(--aMuted)}'
j = s.find(anchor)
assert j > 0
j = s.find('\n', j) + 1
# the old breakpoint line follows; keep it and append ours after it
k = s.find('\n', j) + 1
s = s[:k] + CSS + s[k:]

# ── what-changed list ──
li = '  <li>Map card → level art for every casino; two mystery rewards on the trail</li>'
assert li in s
s = s.replace(li, li + '\n  <li>Level art → three alternative sets per casino on the asset sheet: Crest, Hero Card, Medallion</li>', 1)

# publish the inner page, as before: from <title> up to </body>
head_end = s.find('<title>')
tail = s.rfind('</body>')
page = s[head_end:tail]
open(OUT, 'w', encoding='utf8').write(page)
print('page', len(page) / 1e6, 'MB', '· svg added', sum(len(S.art(k, m, l)) for k in 'abc' for m in range(1, 7) for l in range(1, 7)) / 1e3, 'KB')
