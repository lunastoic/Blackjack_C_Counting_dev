"""Three alternative level-art sets for every casino, built on icons.py.

Set A · Crest      — shield in the casino colour, gold rim, glyph inside, level numeral on a ribbon
Set B · Hero Card  — one big playing card as the canvas, glyph as its face art, casino back behind
Set C · Medallion  — a casino chip in the casino colour, glyph on a dark inlay, accessory behind

Each level has one GLYPH (centred at 0,0, fits a ~44×44 box) shared by the three frames.
"""
import math
import icons as I

B = I.BACKS
CREAM, EDGE, INK, RED, GOLD, GOLD_DEEP, MINT = I.CREAM, I.EDGE, I.INK, I.RED, I.GOLD, I.GOLD_DEEP, I.MINT
PLAQUE, PLAQUE_EDGE = '#5A1F2A', '#7A2E3B'
SOFT_RED = '#FF8A80'

# the casino's sunken felt (two steps darker than its suede) and its edge
FELTS = {1: ('#1C5238', '#2A6A4A'), 2: ('#4A1A0C', '#7A3418'), 3: ('#163A66', '#2E5E9A'),
         4: ('#33205C', '#5A3A8A'), 5: ('#0F3A28', '#2A6A4A'), 6: ('#5A4210', '#8A6A14')}


def _hex(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def tint(h, f):
    """f>0 lightens toward white, f<0 darkens toward black."""
    r, g, b = _hex(h)
    if f >= 0:
        r, g, b = (int(c + (255 - c) * f) for c in (r, g, b))
    else:
        r, g, b = (int(c * (1 + f)) for c in (r, g, b))
    return f'#{r:02X}{g:02X}{b:02X}'


g = I.g

# set by each frame before composing its glyph: light face? which frame?
CTX = {'light': False, 'frame': 'a'}

# ───────────────────────── small parts ─────────────────────────


def crown(cx, cy, s=1.0):
    pts = [(-14, 8), (-14, -6), (-7, 1), (0, -10), (7, 1), (14, -6), (14, 8)]
    d = 'M' + ' L'.join(f'{x} {y}' for x, y in pts) + ' Z'
    body = (f'<path d="{d}" fill="{GOLD}" stroke="#2B1D05" stroke-width="1.5" stroke-linejoin="round"/>'
            + ''.join(f'<circle cx="{x}" cy="{y}" r="2.2" fill="{GOLD}" stroke="#2B1D05" stroke-width="1"/>' for x, y in [(-14, -6), (0, -10), (14, -6)]))
    return g(body, cx, cy, scale=s)


def shield_plus(cx, cy, s=1.0, text='+3'):
    d = 'M0 -18 L15 -12 L13 6 Q0 20 -13 6 L-15 -12 Z'
    body = (f'<path d="{d}" fill="#3E9A4E" stroke="#2B1D05" stroke-width="2"/>'
            f'<text y="5" text-anchor="middle" font-family="var(--jr)" font-size="15" fill="#F3ECD9">{text}</text>')
    return g(body, cx, cy, scale=s)


def tag(cx, cy, text, kind='plaque', size=12, w=None):
    """A small rounded tag. kind: plaque (burgundy/gold), mint (felt/mint), red (plaque/soft red)."""
    if kind == 'mint':
        return I.badge(cx, cy, text, fill='#0E3423', edge=MINT, colour=MINT, size=size, w=w)
    if kind == 'red':
        if CTX['frame'] == 'a':
            return I.badge(cx, cy, text, fill='#2B1D05', edge=GOLD_DEEP, colour=SOFT_RED, size=size, w=w)
        return I.badge(cx, cy, text, fill=PLAQUE, edge=PLAQUE_EDGE, colour=SOFT_RED, size=size, w=w)
    if CTX['frame'] == 'a':
        return I.badge(cx, cy, text, fill='#2B1D05', edge=GOLD_DEEP, colour=GOLD, size=size, w=w)
    return I.badge(cx, cy, text, size=size, w=w)


def sign_card(cx, cy, rot, sign, col, w=20, h=28):
    body = (f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="3" fill="{CREAM}" stroke="{EDGE}" stroke-width="1.5"/>'
            f'<text y="{h*0.24}" text-anchor="middle" font-family="var(--sys)" font-weight="700" font-size="{h*0.62}" fill="{col}">{sign}</text>')
    return g(body, cx, cy, rot)


def fan(cards, w=22, h=30, spread=11, tilt=9, back=None):
    """Cards fanned about the origin."""
    n = len(cards)
    out = ''
    for i, c in enumerate(cards):
        k = i - (n - 1) / 2
        rank, suit = c if c else (None, None)
        out += I.card(k * spread, abs(k) * 1.5, k * tilt, rank, suit, w=w, h=h, back=back if not c else None)
    return out


def chip_stacks(cx, cy, colour, counts=(2, 4, 7), rx=7, step=3.2):
    out = ''
    for j, n in enumerate(counts):
        x = (j - 1) * (rx * 2 + 3)
        for i in range(n):
            y = -i * step
            out += (f'<rect x="{x-rx}" y="{y-step}" width="{rx*2}" height="{step}" fill="{colour}" stroke="{INK}" stroke-width=".8"/>'
                    f'<rect x="{x-rx*0.3}" y="{y-step}" width="{rx*0.6}" height="{step}" fill="{CREAM}" opacity=".85"/>')
        top = -n * step
        out += f'<ellipse cx="{x}" cy="{top}" rx="{rx}" ry="{rx*0.4}" fill="{colour}" stroke="{INK}" stroke-width=".8"/>'
        out += f'<ellipse cx="{x}" cy="{top}" rx="{rx*0.55}" ry="{rx*0.22}" fill="none" stroke="{CREAM}" stroke-width=".8"/>'
    return g(out, cx, cy)


def ramp_arrow(cx, cy, s=1.0):
    body = (f'<path d="M-20 10 Q0 -10 20 -4" fill="none" stroke="{GOLD}" stroke-width="3" stroke-linecap="round"/>'
            f'<path d="M14 -11 L21 -4 L12 -1" fill="none" stroke="{GOLD}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
    return g(body, cx, cy, scale=s)


def tray(cx, cy, back, layers=10, s=1.0):
    body = f'<rect x="-16" y="-22" width="32" height="44" rx="3" fill="{CREAM}" fill-opacity=".14" stroke="{CREAM}" stroke-opacity=".7" stroke-width="1.4"/>'
    for i in range(layers):
        y = 18 - i * 3.2
        body += f'<rect x="-12" y="{y}" width="24" height="3.2" fill="{"#E8DCC0" if i % 2 else "#D3C4A0"}" stroke="#B9A67C" stroke-width=".5"/>'
    body += f'<rect x="-12" y="{18 - layers*3.2}" width="24" height="3.4" rx="1" fill="{back}" stroke="{EDGE}" stroke-width="1"/>'
    return g(body, cx, cy, scale=s)


def scale_bar(cx, cy, h=40, ticks=4, labels=None, s=1.0):
    body = f'<line x1="0" y1="{-h/2}" x2="0" y2="{h/2}" stroke="{GOLD}" stroke-width="1.6"/>'
    for i in range(ticks + 1):
        y = h / 2 - i * h / ticks
        body += f'<line x1="0" y1="{y}" x2="6" y2="{y}" stroke="{GOLD}" stroke-width="1.6"/>'
        if labels and i > 0:
            body += f'<text x="9" y="{y+3.5}" font-family="var(--jr)" font-size="10" fill="{GOLD}">{labels[i-1]}</text>'
    return g(body, cx, cy, scale=s)


def gauge(cx, cy, r=13, needle=-35, s=1.0):
    a = math.radians(needle - 90)
    body = (f'<path d="M{-r} 0 A{r} {r} 0 0 1 {r} 0" fill="none" stroke="{CREAM}" stroke-width="4.5"/>'
            f'<path d="M{-r} 0 A{r} {r} 0 0 1 {-r*0.5} {-r*0.87}" fill="none" stroke="{RED}" stroke-width="4.5"/>'
            f'<path d="M{r*0.5} {-r*0.87} A{r} {r} 0 0 1 {r} 0" fill="none" stroke="{MINT}" stroke-width="4.5"/>'
            f'<line x1="0" y1="0" x2="{(r-3)*math.cos(a):.1f}" y2="{(r-3)*math.sin(a):.1f}" stroke="{GOLD}" stroke-width="2.2" stroke-linecap="round"/>'
            f'<circle r="2.4" fill="{GOLD}"/>')
    return g(body, cx, cy, scale=s)


def grid_chart(cx, cy, cols=5, rows=4, cell=7, hot=((1, 1), (3, 2), (2, 0), (4, 3)), s=1.0):
    """A corner of the strategy chart with a few index cells lit gold."""
    w, h = cols * cell, rows * cell
    body = f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="2" fill="{CREAM}" stroke="{GOLD_DEEP}" stroke-width="1.4"/>'
    for c in range(cols):
        for r in range(rows):
            x, y = -w / 2 + c * cell, -h / 2 + r * cell
            fill = GOLD if (c, r) in hot else ('#E8DCC0' if (c + r) % 2 else CREAM)
            body += f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="{fill}" stroke="{GOLD_DEEP}" stroke-opacity=".5" stroke-width=".6"/>'
    return g(body, cx, cy, scale=s)


def tally(cx, cy, n=4, h=18, s=1.0):
    body = ''
    for i in range(n):
        body += f'<line x1="{i*6 - 9}" y1="{-h/2}" x2="{i*6 - 9}" y2="{h/2}" stroke="{GOLD}" stroke-width="2.6" stroke-linecap="round"/>'
    body += f'<line x1="-13" y1="{h/2-2}" x2="13" y2="{-h/2+2}" stroke="{GOLD}" stroke-width="2.6" stroke-linecap="round"/>'
    return g(body, cx, cy, scale=s)


def fraction(cx, cy, top, bottom, result, s=1.0):
    ink = INK if CTX['light'] else CREAM
    bar = GOLD_DEEP if CTX['light'] else GOLD
    res = '#2F8A4A' if CTX['light'] else MINT
    body = (f'<text y="-6" text-anchor="middle" font-family="var(--jr)" font-size="17" fill="{ink}">{top}</text>'
            f'<line x1="-12" y1="-2" x2="12" y2="-2" stroke="{bar}" stroke-width="2"/>'
            f'<text y="14" text-anchor="middle" font-family="var(--jr)" font-size="17" fill="{ink}">{bottom}</text>'
            f'<text x="22" y="6" text-anchor="middle" font-family="var(--jr)" font-size="17" fill="{res}">{result}</text>')
    return g(body, cx, cy, scale=s)


def plusminus(cx, cy, s=1.0):
    plus, minus = ('#2F8A4A', RED) if CTX['light'] else (MINT, SOFT_RED)
    body = (f'<text x="-10" y="7" text-anchor="middle" font-family="var(--sys)" font-weight="700" font-size="24" fill="{plus}">+</text>'
            f'<text x="10" y="7" text-anchor="middle" font-family="var(--sys)" font-weight="700" font-size="24" fill="{minus}">−</text>')
    return g(body, cx, cy, scale=s)


# ───────────────────────── glyphs: one per level, centred, ~44 box ─────────────────────────


def glyph(mid, lvl, back):
    """back: the card-back colour to draw with (the frame may hand in a tint for contrast)."""
    b = back
    if mid == 1:
        return {
            1: I.card(0, 2, -6, 'A', 's', w=30, h=42) + tag(14, -16, '−1', 'red', size=11, w=24),
            2: fan([('10', 's'), ('7', 'h')], w=26, h=36, spread=13) + tag(0, 20, '−1', 'red', size=11, w=24),
            3: fan([('2', 'c'), ('5', 'd'), ('K', 'h')], w=22, h=31, spread=12) + tag(0, 20, '+1', 'mint', size=11, w=24),
            4: fan([('3', 's'), ('4', 'h'), ('K', 'd'), ('5', 'c')], w=19, h=27, spread=10, tilt=8) + tag(0, 20, '+2', 'mint', size=11, w=24),
            5: g(fan([None, None, None], w=18, h=25, spread=9, tilt=6, back=b), -8, 4) + I.card(12, 0, 8, '6', 'h', w=18, h=25) + tag(8, -18, 'RC +3', 'mint', size=10, w=36),
            6: I.shoe(0, 8, b, decks=6, scale=.5) + crown(0, -16, .8),
        }[lvl]
    if mid == 2:
        return {
            1: I.deck(0, 4, b, n=7, w=30, h=40) + tag(14, -18, '→ 0', size=11, w=28),
            2: sign_card(-9, 2, -16, '+1', MINT, w=22, h=30) + sign_card(9, 2, 16, '−1', RED, w=22, h=30) + tag(0, 20, '= 0', size=11, w=26),
            3: I.streaks(-16, 2, length=12, spread=6) + fan([('8', 'd'), ('9', 'c'), ('K', 'h')], w=20, h=28, spread=11),
            4: I.hand(-13, 6, -10, [('9', 'c'), ('4', 'h')], w=14, h=19) + I.hand(0, 2, 0, [('K', 's'), ('6', 'd')], w=14, h=19) + I.hand(13, 6, 10, [('2', 'h'), ('J', 'c')], w=14, h=19) + I.card(0, -16, 0, w=14, h=19, back=b),
            5: I.deck(-9, 4, b, n=5, w=24, h=32) + I.deck(7, 7, b, n=5, w=24, h=32) + I.stopwatch(15, -13, r=8),
            6: I.shoe(0, 8, b, decks=2, scale=.5) + crown(0, -16, .8) + tag(17, 16, '×2', size=10, w=20),
        }[lvl]
    if mid == 3:
        return {
            1: I.deck(-6, 2, b, n=8, w=30, h=40) + scale_bar(16, 2, h=36, ticks=1, labels=['1']),
            2: I.deck(-4, 4, b, n=4, w=30, h=40, rot=-6) + tag(13, -14, '½', size=16, w=22),
            3: I.shoe(0, 4, b, decks=6, scale=.5) + tag(15, -14, '×6', size=11, w=24),
            4: I.deck(-4, 4, b, n=7, w=30, h=40) + tag(13, -15, '+3', 'mint', size=12, w=24),
            5: tray(-7, 1, b) + scale_bar(13, 0, h=34, ticks=4, labels=['1', '2', '3', '4'], s=.9),
            6: I.shoe(0, 8, b, decks=6, scale=.5) + crown(0, -16, .8),
        }[lvl]
    if mid == 4:
        return {
            1: fraction(-4, 0, '+6', '3', '+2'),
            2: I.deck(-5, 4, b, n=4, w=30, h=40, rot=-8) + tag(13, -15, '÷ ½', size=12, w=30),
            3: sign_card(-9, 2, -12, '+', MINT, w=22, h=30) + sign_card(9, 2, 12, '−', RED, w=22, h=30),
            4: I.shoe(-2, 6, b, decks=6, scale=.48) + tag(14, -15, 'TC +2', 'mint', size=10, w=34),
            5: ''.join(I.deck(-12 + i * 8, 6 - i * 3, b, n=3, w=18, h=25) for i in range(4)) + plusminus(8, -14, .7),
            6: I.shoe(-3, 8, b, decks=6, scale=.48) + crown(-3, -16, .7) + gauge(17, 6, r=9),
        }[lvl]
    if mid == 5:
        return {
            1: chip_stacks(0, 18, b) + ramp_arrow(2, -12, .8) + tag(-12, -16, 'TC', size=10, w=20),
            2: I.card(-7, 2, -8, 'A', 's', w=26, h=36) + shield_plus(12, -4, .8),
            3: I.shoe(5, -2, b, decks=4, scale=.42) + I.hand(-12, 12, -8, [('9', 'h'), ('8', 'c')], w=14, h=19) + I.chip(13, 16, 6, b),
            4: I.shoe(-3, 6, b, decks=6, scale=.48) + I.stopwatch(16, -10, r=8),
            5: I.shoe(0, 0, b, decks=6, scale=.48) + I.ribbon_banner(0, 18, 'TEST', w=38),
            6: I.shoe(-3, 8, b, decks=6, scale=.48) + crown(-3, -16, .7) + I.chip(16, 14, 7, b, '8'),
        }[lvl]
    if mid == 6:
        return {
            1: fan([('10', 'h'), ('6', 's')], w=24, h=33, spread=12) + tag(0, 20, 'TC 0 → S', size=9, w=46),
            2: grid_chart(0, 0, cell=8),
            3: I.laurel(0, 2, r=20, colour=GOLD_DEEP if CTX['light'] else CREAM) + I.shoe(0, 6, b, decks=6, scale=.4) + I.star(0, -14, 5),
            4: g(I.cocktail(0, 0), 12, -8, scale=.8) + I.hand(-8, 6, -6, [('A', 's'), ('K', 'h')], w=16, h=22) + I.chip(12, 14, 6, b) + I.chip(18, 6, 6, '#A8262A'),
            5: I.shoe(-4, 6, b, decks=6, scale=.46) + I.hourglass(17, 0, h=22),
            6: I.scroll(0, 2, w=38, h=28) + I.seal(12, 8, r=7) + I.card(-12, -12, -10, 'A', 's', w=14, h=19) + I.card(12, -12, 10, 'K', 'h', w=14, h=19),
        }[lvl]
    raise KeyError


# ───────────────────────── frames ─────────────────────────


def crest(mid, lvl):
    """Set A: shield in the casino colour with gold rim and ink outline; glyph inside; numeral ribbon."""
    CTX.update(light=False, frame='a')
    b = B[mid]
    inner_back = tint(b, .22)
    rib, rib_tail, rib_ink = (PLAQUE, '#3B1219', GOLD) if mid == 6 else (GOLD, GOLD_DEEP, INK)
    d = 'M50 10 C66 10 78 14 86 16 L86 50 C86 70 70 84 50 92 C30 84 14 70 14 50 L14 16 C22 14 34 10 50 10 Z'
    d_in = 'M50 17 C63 17 73 20 80 22 L80 50 C80 66 67 78 50 85 C33 78 20 66 20 50 L20 22 C27 20 37 17 50 17 Z'
    body = (
        f'<path d="{d}" fill="{b}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
        f'<path d="{d}" fill="{b}" stroke="{EDGE}" stroke-width="2.2" stroke-linejoin="round"/>'
        f'<path d="{d_in}" fill="{tint(b, -.18)}" stroke="{CREAM}" stroke-opacity=".3" stroke-width="1"/>'
        + g(glyph(mid, lvl, inner_back), 50, 45, scale=.96)
        # numeral ribbon across the bottom
        + f'<path d="M25 76 L19 80 L25 90 L29 86 Z" fill="{rib_tail}" stroke="{INK}" stroke-width="1"/>'
        f'<path d="M75 76 L81 80 L75 90 L71 86 Z" fill="{rib_tail}" stroke="{INK}" stroke-width="1"/>'
        f'<rect x="25" y="77" width="50" height="12" rx="2" fill="{rib}" stroke="{INK}" stroke-width="1.2"/>'
        f'<text x="50" y="86.5" text-anchor="middle" font-family="var(--jr)" font-size="11.5" fill="{rib_ink}" letter-spacing="1">LEVEL {lvl}</text>'
    )
    return body


def hero_card(mid, lvl):
    """Set B: one big card as the canvas, the glyph as its face art; a casino back peeks behind."""
    CTX.update(light=True, frame='b')
    b = B[mid]
    index_col = tint(b, -.3) if mid != 6 else '#7A5A10'
    face_col = tint(b, .72)
    w, h = 56, 78
    face = (
        f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="5" fill="{face_col}" stroke="{EDGE}" stroke-width="1.8"/>'
        f'<rect x="{-w/2+4.5}" y="{-h/2+4.5}" width="{w-9}" height="{h-9}" rx="3" fill="none" stroke="{index_col}" stroke-opacity=".45" stroke-width="1"/>'
        f'<text x="{-w/2+4}" y="{-h/2+13}" font-family="var(--jr)" font-size="13" fill="{index_col}">{lvl}</text>'
        f'<text x="{w/2-4}" y="{h/2-5}" text-anchor="end" font-family="var(--jr)" font-size="13" fill="{index_col}" transform="rotate(180 {w/2-4} {h/2-8.5})">{lvl}</text>'
        + g(glyph(mid, lvl, b), 0, 1, scale=.95)
    )
    return I.card(60, 54, 12, w=w - 6, h=h - 6, back=b) + g(face, 45, 50, -6)


def medallion(mid, lvl):
    """Set C: a casino chip in the casino colour; the glyph sits on a dark felt inlay; an accessory behind."""
    CTX.update(light=False, frame='c')
    b = B[mid]
    felt, felt_edge = FELTS[mid]
    r = 33
    cx, cy = 48, 54
    # accessory peeking out behind the chip
    shoe_levels = {(1, 6), (2, 6), (3, 3), (3, 6), (4, 4), (4, 6), (5, 3), (5, 4), (5, 5), (5, 6), (6, 3), (6, 5)}
    timed = {(2, 5), (5, 4), (6, 5)}
    if (mid, lvl) in shoe_levels:
        acc = I.shoe(70, 36, b, decks=6, scale=.55)
    elif (mid, lvl) in timed:
        acc = I.stopwatch(74, 30, r=12)
    else:
        acc = I.card(72, 36, 22, w=28, h=40, back=b) + I.card(80, 44, 34, w=28, h=40, back=b)
    dashes = ''.join(f'<path d="M{r*0.98} 0 L{r*0.74} 0" stroke="{CREAM}" stroke-width="{r*0.26}" transform="rotate({i*45})"/>' for i in range(8))
    chip = (
        f'<circle r="{r+2}" fill="{INK}"/>'
        f'<circle r="{r}" fill="{b}" stroke="{EDGE}" stroke-width="1.6"/>'
        + dashes
        + f'<circle r="{r*0.74}" fill="{felt}" stroke="{GOLD}" stroke-width="1.6"/>'
        f'<circle r="{r*0.68}" fill="none" stroke="{CREAM}" stroke-opacity=".25" stroke-width="1"/>'
        + g(glyph(mid, lvl, tint(b, .18)), 0, 0, scale=.9)
    )
    return acc + g(chip, cx, cy)


FRAMES = {'a': crest, 'b': hero_card, 'c': medallion}
SET_NAMES = {'a': 'Crest', 'b': 'Hero Card', 'c': 'Medallion'}


def art(set_key, mid, lvl):
    return f'<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">{FRAMES[set_key](mid, lvl)}</svg>'
