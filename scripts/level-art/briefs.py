"""Per-level vignettes for the level brief — one 260×104 scene per level, in place of
the three example cards that every brief shows today. Each scene shows what the level
actually asks for (its cards, its answer pads, its pauses), drawn with icons.py.

    scene(mid, lvl) -> '<svg …>…</svg>'
"""
import icons as I
from sets import crown, fan, sign_card, chip_stacks, tray, scale_bar, gauge, grid_chart, fraction

B = I.BACKS
CREAM, EDGE, INK, RED, GOLD, GOLD_DEEP, MINT = I.CREAM, I.EDGE, I.INK, I.RED, I.GOLD, I.GOLD_DEEP, I.MINT
SOFT_RED, MUTED, PLAQUE, PLAQUE_EDGE = '#FF8A80', '#A8B8AC', '#5A1F2A', '#7A2E3B'
g = I.g
W, H = 260, 104


def t(x, y, s, size=12, fill=CREAM, anchor='middle', font='var(--jr)', extra=''):
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{font}" font-size="{size}" fill="{fill}" {extra}>{s}</text>'


def mono(x, y, s, size=9, fill=MUTED, anchor='middle', extra=''):
    return t(x, y, s, size, fill, anchor, 'var(--mono)', extra)


def pad(cx, cy, label, w=40, h=22, hot=False, face='#4A3F3A', deep='#2C2421', lbl=CREAM, size=14):
    """A bevelled answer pad; hot = the gold book play."""
    if hot:
        face, deep, lbl = GOLD, GOLD_DEEP, '#1E1607'
    body = (f'<rect x="{-w/2}" y="{-h/2+3}" width="{w}" height="{h}" rx="6" fill="#2B1D05"/>'
            f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="6" fill="{face}" stroke="#2B1D05" stroke-width="1.5"/>'
            f'<rect x="{-w/2+2}" y="{h/2-5}" width="{w-4}" height="3" rx="1.5" fill="{deep}"/>'
            + t(0, size * 0.36, label, size, lbl))
    if hot:
        body = f'<rect x="{-w/2-3}" y="{-h/2-3}" width="{w+6}" height="{h+9}" rx="9" fill="{GOLD}" opacity=".28"/>' + body
    return g(body, cx, cy)


def entry(cx, cy, label, value='', w=64, h=26, caret=True):
    """A dark entry box with its prompt above and the typed value (gold)."""
    body = (f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="7" fill="#000000A6" stroke="{CREAM}" stroke-opacity=".22" stroke-width="1.5"/>'
            + t(0, 6, value, 16, GOLD))
    if caret:
        vx = len(value) * 4.6 + 3
        body += f'<rect x="{vx}" y="-7" width="1.6" height="14" fill="{GOLD}"/>'
    lw = len(label) * 4.9
    lx = min(0, (W - 4) - cx - lw / 2) if cx + lw / 2 > W - 4 else 0
    body += mono(lx, -h / 2 - 4, label, 8, MUTED)
    return g(body, cx, cy)


def arrow(x1, y1, x2, y2, col=GOLD, wdt=2.2):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="{wdt}" stroke-linecap="round" marker-end="url(#ah)"/>')


def defs():
    return (f'<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">'
            f'<path d="M0 0 L10 5 L0 10Z" fill="{GOLD}"/></marker></defs>')


def strikes(cx, cy, used, total, gap=14):
    out = ''
    for i in range(total):
        x = (i - (total - 1) / 2) * gap
        col = SOFT_RED if i < used else CREAM
        op = 1 if i < used else .35
        out += f'<text x="{x}" y="5" text-anchor="middle" font-family="var(--sys)" font-weight="700" font-size="14" fill="{col}" opacity="{op}">✕</text>'
    return g(out, cx, cy)


def meter(cx, cy, w, fill, h=8):
    body = (f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="{h/2}" fill="#000000B3" stroke="#2B1D05" stroke-width="1.5"/>'
            f'<rect x="{-w/2+1}" y="{-h/2+1}" width="{max(0,(w-2)*fill)}" height="{h-2}" rx="{(h-2)/2}" fill="url(#rail)"/>')
    return g(body, cx, cy)


def rail_def():
    return ('<linearGradient id="rail" x1="0" x2="1"><stop offset="0" stop-color="#FF3F3F"/><stop offset=".4" stop-color="#FF9A1F"/>'
            '<stop offset=".68" stop-color="#FFD23F"/><stop offset="1" stop-color="#3BE477"/></linearGradient>')


def clock_pill(cx, cy, text, w=46):
    return g(f'<rect x="{-w/2}" y="-9" width="{w}" height="18" rx="9" fill="#0E3423" stroke="{MINT}" stroke-width="1.4"/>'
             + t(0, 4.5, text, 11, MINT), cx, cy)


def stage_pips(cx, cy, labels, gap=52):
    """★ / ★★ / ★★★ with a word under each — a staged drill's three stages."""
    out = ''
    for i, lab in enumerate(labels):
        x = (i - 1) * gap
        out += t(x, 0, '★' * (i + 1), 12, GOLD, extra='letter-spacing="-1"') + mono(x, 11, lab, 7.5, CREAM)
    return g(out, cx, cy)


def seat(cx, cy, cards, back=None, rot=0, w=16, h=22, faded=False):
    """A player's two cards and a chip under them."""
    op = ' opacity=".55"' if faded else ''
    return f'<g{op}>' + I.hand(cx, cy, rot, cards, w=w, h=h, back=back) + '</g>'


def dealer(cx, cy, up, back, w=16, h=22):
    return I.card(cx - 6, cy, -4, up[0], up[1], w=w, h=h) + I.card(cx + 7, cy, 4, w=w, h=h, back=back)


def table_arc(cx, cy, rx=96, ry=40):
    return g(f'<path d="M{-rx} 0 A{rx} {ry} 0 0 1 {rx} 0" fill="none" stroke="{GOLD}" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="4 3"/>', cx, cy)


def bubble(cx, cy, text, w=74):
    return g(f'<path d="M{-w/2} -10 h{w} a5 5 0 0 1 5 5 v10 a5 5 0 0 1 -5 5 h{-w/2+10} l-7 7 v-7 h{-w/2+2} a5 5 0 0 1 -5 -5 v-10 a5 5 0 0 1 5 -5z" fill="{CREAM}" stroke="{GOLD_DEEP}" stroke-width="1.2"/>'
             + t(0, 4, text, 10, INK, font='var(--mono)'), cx, cy)


def slider(cx, cy, w=150, pos=0.5, left='HIT', right='STAND'):
    body = (f'<rect x="{-w/2}" y="-5" width="{w}" height="10" rx="5" fill="#000000B3" stroke="#2B1D05" stroke-width="1.5"/>'
            f'<rect x="{-w/2+1}" y="-4" width="{(w-2)*pos}" height="8" rx="4" fill="{SOFT_RED}" opacity=".8"/>'
            f'<rect x="{-w/2+1+(w-2)*pos}" y="-4" width="{(w-2)*(1-pos)}" height="8" rx="4" fill="{MINT}" opacity=".8"/>'
            f'<rect x="{-w/2+(w)*pos-3}" y="-10" width="6" height="20" rx="3" fill="{GOLD}" stroke="#2B1D05" stroke-width="1"/>'
            + t(-w / 2, 18, '−5', 10, MUTED) + t(w / 2, 18, '+5', 10, MUTED) + t(-w / 2 + (w) * pos, 18, '0', 10, GOLD)
            + t(-w / 4, -11, left, 10, SOFT_RED) + t(w / 4, -11, right, 10, MINT))
    return g(body, cx, cy)


def chart_strip(cx, cy, rows, hot=2):
    """A sliver of the bet ramp: TC → units."""
    out = ''
    for i, (tc, u) in enumerate(rows):
        y = (i - (len(rows) - 1) / 2) * 11
        fill = GOLD if i == hot else 'none'
        col = INK if i == hot else CREAM
        out += (f'<rect x="-30" y="{y-5}" width="60" height="10" rx="2" fill="{fill}" stroke="{CREAM}" stroke-opacity=".25" stroke-width=".8"/>'
                + mono(-14, y + 3, tc, 8, col) + mono(14, y + 3, u, 8, col))
    return g(out, cx, cy)


def pit_boss(cx, cy):
    body = (f'<circle cy="-14" r="9" fill="#2B1D05" stroke="{EDGE}" stroke-width="1.2"/>'
            f'<rect x="-9" y="-16" width="18" height="4" rx="1" fill="#0E0B09"/>'
            f'<path d="M-16 14 Q-14 -2 0 -2 Q14 -2 16 14Z" fill="#1C0A0D" stroke="{EDGE}" stroke-width="1.2"/>'
            f'<path d="M0 -2 L-3 4 L0 12 L3 4Z" fill="{RED}"/>')
    return g(body, cx, cy)


# ───────────────────────── scenes ─────────────────────────

def scene(mid, lvl):
    b = B[mid]
    s = SCENES[(mid, lvl)](b)
    return (f'<svg class="lb-vig-svg" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">'
            f'{defs()}<defs>{rail_def()}</defs>{s}</svg>')


def _1_1(b):  # one card, three pads
    return (I.card(130, 40, 0, '5', 'h', w=40, h=56)
            + pad(84, 90, '−1', 40, 20, lbl=SOFT_RED) + pad(130, 90, '0', 40, 20) + pad(176, 90, '+1', 40, 20, hot=True))


def _1_2(b):  # a grid, one pair cancelling
    cells = [('2', 'c'), ('K', 'h'), ('8', 's'), ('5', 'd'), ('J', 'c'),
             ('9', 'h'), ('3', 's'), ('Q', 'd'), ('7', 'c'), ('4', 'h'),
             ('A', 's'), ('6', 'd'), ('10', 'c'), ('2', 'h'), ('8', 'd')]
    out = ''
    for i, (r, su) in enumerate(cells):
        x, y = 48 + (i % 5) * 26, 22 + (i // 5) * 30
        op = .35 if (r, su) in (('2', 'c'), ('K', 'h')) else 1
        out += I.card(x, y, 0, r, su, w=22, h=28, op=op)
    out += arrow(52, 14, 70, 14) + I.card(74, 20, -10, '2', 'c', w=22, h=28)
    out += g(t(0, 4, '= 0', 13, MINT), 196, 24)
    out += pad(196, 62, 'TAP 7·8·9', 64, 18, size=10) + mono(206, 90, 'drag +1 onto −1', 7.5)
    return out


def _1_3(b):  # pairs, threes, fours with their net value
    return (g(fan([('10', 's'), ('3', 'h')], w=22, h=30, spread=12), 50, 42) + t(50, 72, '−1+1 = 0', 11, CREAM)
            + g(fan([('2', 'c'), ('5', 'd'), ('K', 'h')], w=22, h=30, spread=12), 130, 42) + t(130, 72, '= +1', 13, MINT)
            + g(fan([('3', 's'), ('4', 'h'), ('K', 'd'), ('Q', 'c')], w=22, h=30, spread=11, tilt=8), 210, 42) + t(210, 72, '= 0', 13, CREAM)
            + stage_pips(130, 90, ['pairs', 'threes', 'fours'], gap=80))


def _1_4(b):  # card rain: falling cards, the pause, the entry
    out = ''
    for i, (x, y, r, su, ln) in enumerate([(36, 18, '6', 'd', 14), (66, 46, 'K', 's', 22), (96, 12, '3', 'c', 10), (126, 56, 'Q', 'h', 26), (158, 30, '9', 's', 18)]):
        out += f'<line x1="{x}" y1="{y-ln-18}" x2="{x}" y2="{y-18}" stroke="{GOLD}" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>'
        out += I.card(x, y, 0, r, su, w=24, h=32)
    out += entry(222, 50, 'COUNT?', '+2', w=60)
    out += mono(110, 96, 'every 5–10 cards the rain pauses', 8)
    return out


def _1_5(b):  # table night: dealer up card, your hand, the book play glowing, the count call
    return (table_arc(130, 70, 100, 34) + dealer(130, 22, ('10', 'h'), b)
            + seat(84, 66, [('9', 'c'), ('7', 'd')], w=18, h=24) + I.chip(84, 90, 7, b)
            + pad(176, 62, 'HIT', 40, 20) + pad(222, 62, 'STAND', 44, 20, hot=True, size=12)
            + clock_pill(38, 30, 'RC? 0:08', 54))


def _1_6(b):  # zero hero: the deal stops early, type the count
    out = I.deck(34, 44, b, n=6, w=30, h=40)
    for i, (r, su) in enumerate([('A', 's'), ('7', 'h'), ('K', 'd'), ('4', 'c'), ('9', 's')]):
        out += I.card(80 + i * 16, 42, -6 + i * 3, r, su, w=20, h=27)
    out += f'<rect x="70" y="76" width="120" height="6" rx="3" fill="#000000B3" stroke="#2B1D05"/>'
    out += f'<rect x="70" y="76" width="{120*44/52}" height="6" rx="3" fill="{GOLD}"/>'
    out += f'<rect x="{70+120*39/52}" y="72" width="{120*9/52}" height="14" rx="2" fill="{MINT}" opacity=".35"/>'
    out += mono(130, 96, 'stops between card 39 and 48', 8)
    out += entry(222, 44, 'COUNT?', '0', w=52) + crown(222, 86, .6)
    return out


def _2_1(b):  # hit or stand: a hand, the up card, four pads
    return (dealer(200, 26, ('10', 's'), b, w=20, h=28) + mono(200, 50, 'dealer', 8)
            + I.hand(66, 32, 0, [('9', 'c'), ('7', 'h')], w=24, h=32) + t(66, 60, '16', 14, CREAM)
            + pad(52, 86, 'HIT', 38, 20, hot=True) + pad(96, 86, 'STAND', 42, 20, size=12)
            + pad(144, 86, 'DOUBLE', 46, 20, size=11) + pad(196, 86, 'SPLIT', 42, 20, size=12))


def _2_2(b):  # swipe strategy: a hand with four arrows and a swipe trail
    out = I.hand(130, 48, 0, [('A', 's'), ('6', 'd')], w=26, h=36)
    out += t(130, 80, 'soft 17', 10, MUTED, font='var(--mono)')
    out += arrow(96, 48, 70, 48) + t(56, 52, 'HIT', 11, CREAM)
    out += arrow(164, 48, 190, 48) + t(206, 52, 'STAND', 11, CREAM)
    out += arrow(130, 22, 130, 8) + t(154, 12, 'DOUBLE', 11, CREAM)
    out += arrow(130, 74, 130, 90) + t(154, 96, 'SPLIT', 11, CREAM)
    out += f'<path d="M150 56 Q176 40 198 48" fill="none" stroke="{GOLD}" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>'
    out += I.badge(226, 20, '×3 combo', fill='#0E3423', edge=MINT, colour=MINT, size=10, w=54)
    return out


def _2_3(b):  # three kinds of hand, a star each
    return (I.hand(50, 36, 0, [('10', 'c'), ('6', 'h')], w=22, h=30) + I.hand(130, 36, 0, [('A', 's'), ('6', 'd')], w=22, h=30)
            + I.hand(210, 36, 0, [('8', 'h'), ('8', 'c')], w=22, h=30)
            + mono(50, 64, 'HARD 16', 8.5, CREAM) + mono(130, 64, 'SOFT 17', 8.5, CREAM) + mono(210, 64, 'PAIR OF 8s', 8.5, CREAM)
            + stage_pips(130, 84, ['8 right', '8 right', '8 right'], gap=80))


def _2_4(b):  # play and count: your hand, no glow; the deal pauses for the count
    return (table_arc(110, 74, 86, 30) + dealer(110, 22, ('6', 'c'), b)
            + seat(70, 66, [('10', 'd'), ('5', 's')], w=18, h=24) + pad(118, 64, 'HIT', 36, 18, size=12) + pad(158, 64, 'STAND', 42, 18, size=11)
            + f'<line x1="196" y1="10" x2="196" y2="94" stroke="{CREAM}" stroke-opacity=".2" stroke-dasharray="3 3"/>'
            + entry(226, 50, 'PAUSE · COUNT?', '+3', w=56) + mono(226, 84, 'every few hands', 7.5))


def _2_5(b):  # table night, 2 decks: graded moves, 8s count call
    return (table_arc(130, 72, 100, 34) + dealer(130, 22, ('9', 'd'), b)
            + seat(84, 66, [('K', 'c'), ('3', 'h')], w=18, h=24) + I.chip(84, 90, 7, b)
            + pad(176, 62, 'HIT', 40, 20) + pad(222, 62, 'STAND', 44, 20, size=12)
            + clock_pill(38, 30, 'RC? 0:08', 54) + I.badge(222, 92, 'move graded', fill=PLAQUE, edge=PLAQUE_EDGE, colour=GOLD, size=9, w=60))


def _2_6(b):  # clean shoe boss: 2-deck shoe, two strike rows
    return (I.shoe(60, 50, b, decks=2, scale=.75) + crown(60, 8, .7)
            + mono(176, 30, 'BAD MOVES', 8) + strikes(176, 46, 1, 3)
            + mono(176, 70, 'WRONG COUNTS', 8) + strikes(176, 86, 0, 3)
            + t(236, 56, '85%', 16, GOLD) + mono(236, 70, 'clears', 7.5))


def _3_1(b):  # decks left: tray vs shoe, tap the decks
    return (tray(60, 44, b, layers=7, s=1.2) + mono(60, 86, 'discards', 8)
            + I.shoe(150, 50, b, decks=4, scale=.7) + scale_bar(206, 44, h=50, ticks=4, labels=['1', '2', '3', '4'])
            + pad(236, 20, '1', 22, 16, size=11) + pad(236, 40, '2', 22, 16, size=11, hot=True) + pad(236, 60, '3', 22, 16, size=11) + pad(236, 80, '4', 22, 16, size=11))


def _3_2(b):  # divide and match: target on top, count tiles onto deck tiles
    out = I.badge(130, 12, 'TARGET  +2', fill=PLAQUE, edge=PLAQUE_EDGE, colour=GOLD, size=11, w=70)
    counts = ['+6', '+4', '−3', '+8']
    decks = ['3', '2', '1½', '4']
    for i, c in enumerate(counts):
        x = 50 + i * 34
        out += sign_card(x, 44, 0, c, MINT if c[0] == '+' else RED, w=24, h=26)
    for i, d in enumerate(decks):
        x = 88 + i * 34
        out += g(f'<rect x="-12" y="-13" width="24" height="26" rx="4" fill="{b}" stroke="{EDGE}" stroke-width="1.4"/>' + t(0, 5, d, 13, CREAM), x, 80)
    out += arrow(58, 60, 84, 70)
    out += mono(222, 48, '+6 ÷ 3', 8, CREAM) + mono(222, 60, '= +2 ✓', 8, MINT)
    return out


def _3_3(b):  # the division, three stages
    return (t(70, 46, '+8', 26, CREAM) + t(104, 46, '÷', 20, GOLD) + I.deck(138, 40, b, n=4, w=26, h=34) + t(138, 72, '2 decks', 9, MUTED, font='var(--mono)')
            + t(176, 46, '=', 20, GOLD) + t(212, 48, '+4', 28, MINT)
            + stage_pips(130, 90, ['whole decks', 'half decks', 'negatives'], gap=84))


def _3_4(b):  # live true count: cards stream from a 2-deck shoe, two entries at the pause
    out = I.shoe(40, 40, b, decks=2, scale=.6)
    for i, (r, su) in enumerate([('4', 'h'), ('J', 's'), ('8', 'd'), ('2', 'c')]):
        out += I.card(92 + i * 22, 40, 0, r, su, w=20, h=27)
    out += entry(200, 36, 'DECKS LEFT?', '1.5', w=50) + entry(200, 82, 'TRUE COUNT?', '+2', w=50)
    out += mono(100, 86, 'both must be right', 8)
    return out


def _3_5(b):  # table night at 4 decks: TRUE count call, 10s
    return (table_arc(130, 72, 100, 34) + dealer(130, 22, ('7', 's'), b)
            + seat(84, 66, [('A', 'h'), ('8', 'c')], w=18, h=24) + I.chip(84, 90, 7, b)
            + pad(176, 62, 'HIT', 40, 20) + pad(222, 62, 'STAND', 44, 20, size=12)
            + clock_pill(42, 30, 'TC? 0:10', 54) + I.shoe(222, 24, b, decks=4, scale=.36))


def _3_6(b):  # count-along boss: two seats play themselves; you call RC then TC
    return (table_arc(110, 74, 86, 30) + dealer(110, 22, ('K', 'c'), b)
            + seat(72, 66, [('10', 'd'), ('9', 's')], w=16, h=22, faded=True) + seat(148, 66, [('5', 'h'), ('6', 'c')], w=16, h=22, faded=True)
            + mono(110, 96, 'autoplay — you just follow the cards', 7.5)
            + entry(226, 36, 'RUNNING?', '+5', w=46) + entry(226, 82, 'TRUE?', '+2', w=46) + crown(16, 16, .55))


def _4_1(b):  # bet the count: TC shown, the ramp beside it, pick the bet
    return (I.badge(56, 30, 'TC +3', fill='#0E3423', edge=MINT, colour=MINT, size=14, w=52)
            + chart_strip(130, 44, [('TC +1', '1u'), ('TC +2', '1u'), ('TC +3', '2u'), ('TC +4', '3u'), ('TC +5', '4u')], hot=2)
            + mono(130, 86, 'chart hides after ten right', 7.5)
            + pad(190, 30, '1', 24, 18, size=12) + pad(218, 30, '2', 24, 18, size=12, hot=True) + pad(246, 30, '3', 24, 18, size=12)
            + pad(190, 56, '4', 24, 18, size=12) + pad(218, 56, '6', 24, 18, size=12) + pad(246, 56, '8', 24, 18, size=12)
            + mono(218, 80, 'units', 8))


def _4_2(b):  # chip rush: TC cards slide to the edge; drop the right stack on the circle
    out = f'<rect x="16" y="20" width="200" height="30" rx="6" fill="#000000A6" stroke="{CREAM}" stroke-opacity=".2"/>'
    for i, (tc, x) in enumerate([('+1', 40), ('+4', 96), ('+2', 152)]):
        out += sign_card(x, 35, 0, tc, MINT, w=22, h=24)
        out += f'<line x1="{x-18}" y1="35" x2="{x-26}" y2="35" stroke="{GOLD}" stroke-opacity=".5" stroke-width="2"/>'
    out += f'<line x1="214" y1="16" x2="214" y2="54" stroke="{SOFT_RED}" stroke-width="2" stroke-dasharray="3 2"/>' + mono(236, 38, 'edge', 8, SOFT_RED)
    out += f'<circle cx="180" cy="82" r="13" fill="none" stroke="{GOLD}" stroke-width="1.6" stroke-dasharray="3 2"/>'
    out += chip_stacks(70, 92, b, counts=(1, 3, 5)) + arrow(104, 84, 162, 84)
    return out


def _4_3(b):  # ramp stages: what you're given at each stage
    return (I.badge(50, 30, 'TC +4', fill='#0E3423', edge=MINT, colour=MINT, size=12, w=46)
            + I.badge(130, 24, 'RC +8', fill=PLAQUE, edge=PLAQUE_EDGE, colour=GOLD, size=11, w=46) + I.badge(130, 46, '2 decks', fill=PLAQUE, edge=PLAQUE_EDGE, colour=CREAM, size=10, w=50)
            + I.badge(210, 24, 'RC +9', fill=PLAQUE, edge=PLAQUE_EDGE, colour=GOLD, size=11, w=46) + I.badge(210, 46, '2½ decks', fill=PLAQUE, edge=PLAQUE_EDGE, colour=CREAM, size=10, w=54)
            + t(130, 70, '→ 3 units', 13, MINT)
            + stage_pips(130, 90, ['count shown', 'work it out', 'half decks'], gap=80))


def _4_4(b):  # count then bet: stream from a 4-deck shoe, no count, type the bet
    out = I.shoe(40, 40, b, decks=4, scale=.6)
    for i, (r, su) in enumerate([('6', 'c'), ('3', 'h'), ('Q', 's'), ('5', 'd'), ('9', 'c')]):
        out += I.card(90 + i * 20, 40, 0, r, su, w=18, h=25)
    out += mono(130, 70, 'no count shown', 8, SOFT_RED)
    out += entry(222, 44, 'YOUR BET?', '2u', w=52) + chip_stacks(222, 92, b, counts=(1, 2, 3), rx=5, step=2.6)
    return out


def _4_5(b):  # table night, 6 decks: you size every bet
    return (table_arc(120, 74, 92, 32) + dealer(120, 22, ('8', 'h'), b)
            + seat(80, 64, [('J', 'd'), ('A', 's')], w=16, h=22)
            + f'<circle cx="150" cy="70" r="12" fill="none" stroke="{GOLD}" stroke-width="1.4" stroke-dasharray="3 2"/>' + chip_stacks(150, 78, b, counts=(3,), rx=6, step=3)
            + I.badge(60, 94, 'bet graded', fill=PLAQUE, edge=PLAQUE_EDGE, colour=GOLD, size=9, w=56) + I.badge(150, 98, 'move graded', fill=PLAQUE, edge=PLAQUE_EDGE, colour=GOLD, size=9, w=60)
            + clock_pill(224, 30, 'RC? ×3', 46) + I.shoe(224, 70, b, decks=6, scale=.36))


def _4_6(b):  # count-along boss: three seats, three calls
    return (table_arc(100, 76, 80, 28) + dealer(100, 20, ('4', 'd'), b, w=14, h=20)
            + seat(44, 60, [('9', 's'), ('8', 'h')], w=14, h=19, faded=True) + seat(100, 66, [('K', 'c'), ('7', 'd')], w=14, h=19, faded=True) + seat(156, 60, [('A', 'h'), ('6', 's')], w=14, h=19, faded=True)
            + entry(212, 22, 'RUNNING?', '+6', w=42, h=20) + entry(212, 56, 'TRUE?', '+2', w=42, h=20) + entry(212, 90, 'BET?', '1u', w=42, h=20)
            + crown(14, 14, .5))


def _5_1(b):  # insurance: dealer Ace, TC shown, insure or not
    return (dealer(70, 40, ('A', 's'), b, w=28, h=38) + mono(70, 72, 'dealer shows an Ace', 8)
            + I.badge(150, 26, 'TC +3', fill='#0E3423', edge=MINT, colour=MINT, size=14, w=52)
            + pad(150, 62, 'INSURE', 56, 20, hot=True, size=12) + pad(214, 62, 'NO', 40, 20, size=12)
            + mono(150, 92, 'insure only at +3 or higher', 7.5))


def _5_2(b):  # flip point: a hand, the slider sweeping, STOP where the move flips
    return (I.hand(44, 36, 0, [('10', 'c'), ('6', 'h')], w=20, h=27) + t(44, 62, '16 vs 10', 9, MUTED, font='var(--mono)') + I.card(44, 88, 0, '10', 's', w=14, h=19)
            + slider(150, 48, w=140, pos=.5)
            + pad(224, 86, 'STOP', 44, 22, face=RED, deep='#8A1F1B', size=13))


def _5_3(b):  # play change stages: a chart cell flips at its index
    return (I.hand(54, 40, 0, [('10', 'c'), ('2', 'h')], w=20, h=27) + mono(54, 66, '12 vs 3', 8.5, CREAM) + I.card(54, 90, 0, '3', 'd', w=14, h=19)
            + grid_chart(130, 40, cols=5, rows=4, cell=10, hot=((2, 1),), s=1.1)
            + mono(130, 70, 'TC +2 → STAND', 8.5, MINT)
            + t(206, 24, '★', 12, GOLD) + mono(206, 36, 'top plays', 7.5, CREAM)
            + t(206, 54, '★★', 12, GOLD, extra='letter-spacing="-1"') + mono(206, 66, 'all plays', 7.5, CREAM)
            + t(206, 84, '★★★', 12, GOLD, extra='letter-spacing="-1"') + mono(206, 96, 'mixed with normal hands', 7.5, CREAM))


def _5_4(b):  # change or not: a fast stream of hands with counts, two pads
    out = I.streaks(30, 40, length=14, spread=8)
    for i, (cards, tc, x) in enumerate([([('9', 'c'), ('7', 'd')], 'TC +4', 60), ([('A', 's'), ('7', 'h')], 'TC −1', 118), ([('10', 'd'), ('2', 's')], 'TC +3', 176)]):
        out += I.hand(x, 34, 0, cards, w=18, h=24) + I.badge(x, 60, tc, fill='#0E3423', edge=MINT, colour=MINT, size=9, w=40)
    out += pad(92, 90, 'CHART', 50, 18, size=11) + pad(154, 90, 'CHANGE', 54, 18, hot=True, size=11)
    out += I.stopwatch(232, 40, r=10) + mono(232, 66, 'fast', 8)
    return out


def _5_5(b):  # table night, 8 decks: insurance line, plays, bets, count
    return (table_arc(120, 74, 92, 32) + dealer(120, 20, ('A', 'd'), b)
            + f'<path d="M50 48 A70 24 0 0 1 190 48" fill="none" stroke="{GOLD}" stroke-opacity=".7" stroke-width="1"/>' + t(120, 44, 'INSURANCE PAYS 2 TO 1', 7, GOLD, extra='letter-spacing="1"')
            + seat(84, 72, [('8', 'c'), ('8', 'h')], w=16, h=22) + chip_stacks(150, 84, b, counts=(4,), rx=6, step=3)
            + I.shoe(230, 28, b, decks=6, scale=.36)
            + I.badge(230, 62, 'graded', fill=PLAQUE, edge=PLAQUE_EDGE, colour=GOLD, size=9, w=44) + mono(230, 78, 'INS · PLAYS', 7, CREAM) + mono(230, 88, 'BETS · COUNT', 7, CREAM))


def _5_6(b):  # count-along boss, 8 decks, dealer Ace
    return (table_arc(100, 76, 80, 28) + dealer(100, 20, ('A', 's'), b, w=14, h=20)
            + seat(44, 60, [('5', 's'), ('9', 'h')], w=14, h=19, faded=True) + seat(100, 66, [('Q', 'c'), ('6', 'd')], w=14, h=19, faded=True) + seat(156, 60, [('A', 'h'), ('A', 'c')], w=14, h=19, faded=True)
            + entry(212, 22, 'TRUE?', '+3', w=42, h=20) + entry(212, 56, 'BET?', '2u', w=42, h=20) + entry(212, 90, 'INSURANCE?', 'YES', w=42, h=20)
            + crown(14, 14, .5) + I.shoe(248, 12, b, decks=6, scale=.24))


def _6_1(b):  # casino speed: a group at dealer pace, the fast meter, one strike
    return (I.streaks(60, 40, length=18, spread=9) + g(fan([('7', 'c'), ('K', 'd'), ('2', 's')], w=24, h=32, spread=13), 120, 40)
            + pad(196, 28, '−1', 32, 18, lbl=SOFT_RED, size=12) + pad(232, 28, '0', 32, 18, hot=True, size=12) + pad(214, 52, '+1', 32, 18, lbl=MINT, size=12)
            + meter(130, 78, 180, .22) + mono(130, 96, 'one miss ends it', 8, SOFT_RED) + strikes(236, 80, 0, 1))


def _6_2(b):  # busy table: flashes, then flips face down
    out = table_arc(90, 70, 72, 26) + dealer(90, 20, ('K', 'h'), b, w=12, h=17)
    for i, (x, y, cards) in enumerate([(40, 58, [('3', 'c'), ('9', 'd')]), (74, 66, [('J', 's'), ('6', 'h')]), (108, 66, [('A', 'c'), ('5', 's')]), (142, 58, [('8', 'd'), ('8', 'c')])]):
        out += seat(x, y, cards, w=12, h=17)
    out += t(36, 16, '⚡ 2.5s', 10, GOLD)
    out += arrow(166, 44, 184, 44)
    out += table_arc(216, 70, 40, 16) + I.card(216, 22, 0, w=12, h=17, back=b)
    for x in (196, 216, 236):
        out += I.hand(x, 58, 0, [(None, None), (None, None)], w=12, h=17, back=b)
    out += entry(216, 92, 'COUNT?', '+1', w=44, h=18, caret=False)
    return out


def _6_3(b):  # distractions: chips flying, sound, the dealer chatting
    return (table_arc(110, 74, 86, 30) + dealer(110, 22, ('9', 's'), b)
            + seat(66, 66, [('K', 'd'), ('7', 'c')], w=15, h=20, faded=True) + seat(110, 70, [('6', 'h'), ('5', 's')], w=15, h=20, faded=True) + seat(154, 66, [('A', 'c'), ('10', 'h')], w=15, h=20, faded=True)
            + I.chip(28, 40, 7, b) + I.chip(40, 30, 6, '#A8262A') + t(26, 66, '🔊', 11)
            + bubble(196, 20, 'Where you from?', 84)
            + entry(226, 70, 'COUNT?', '−2', w=46, h=20) + mono(226, 96, 'keep counting', 7))


def _6_4(b):  # long shift: two 8-deck shoes, count resets, one miss
    out = I.shoe(50, 44, b, decks=6, scale=.62) + t(50, 84, 'SHOE 1', 10, GOLD, extra='letter-spacing="1"')
    out += arrow(96, 44, 128, 44) + I.badge(112, 26, 'RC → 0', fill=PLAQUE, edge=PLAQUE_EDGE, colour=GOLD, size=9, w=44)
    out += I.shoe(174, 44, b, decks=6, scale=.62) + t(174, 84, 'SHOE 2', 10, GOLD, extra='letter-spacing="1"')
    out += I.streaks(236, 36, length=10, spread=6) + mono(236, 60, 'casino', 7.5) + mono(236, 70, 'speed', 7.5) + strikes(236, 88, 0, 1)
    out += mono(112, 98, 'a check about every 15 cards', 7.5)
    return out


def _6_5(b):  # a long night: 25 hands, everything graded, the hourglass
    return (table_arc(110, 74, 86, 30) + dealer(110, 22, ('Q', 'c'), b)
            + seat(70, 66, [('9', 'd'), ('9', 'h')], w=16, h=22) + chip_stacks(130, 78, b, counts=(2, 5), rx=5, step=2.8)
            + I.hourglass(220, 34, h=26) + t(220, 70, '25 hands', 11, CREAM) + mono(220, 84, 'casino speed', 7.5)
            + mono(110, 98, 'counts · bets · moves · insurance · plays', 7))


def _6_6(b):  # final boss: the pit boss watches the whole shoe
    return (pit_boss(40, 50) + mono(40, 86, 'pit boss', 8)
            + I.shoe(120, 50, b, decks=6, scale=.7) + crown(120, 8, .7)
            + gauge(190, 60, r=14, needle=20) + mono(190, 80, 'heat', 8)
            + t(236, 52, '90%', 16, GOLD) + mono(236, 66, 'clears', 7.5) + mono(236, 78, 'no back-off', 7))


SCENES = {
    (1, 1): _1_1, (1, 2): _1_2, (1, 3): _1_3, (1, 4): _1_4, (1, 5): _1_5, (1, 6): _1_6,
    (2, 1): _2_1, (2, 2): _2_2, (2, 3): _2_3, (2, 4): _2_4, (2, 5): _2_5, (2, 6): _2_6,
    (3, 1): _3_1, (3, 2): _3_2, (3, 3): _3_3, (3, 4): _3_4, (3, 5): _3_5, (3, 6): _3_6,
    (4, 1): _4_1, (4, 2): _4_2, (4, 3): _4_3, (4, 4): _4_4, (4, 5): _4_5, (4, 6): _4_6,
    (5, 1): _5_1, (5, 2): _5_2, (5, 3): _5_3, (5, 4): _5_4, (5, 5): _5_5, (5, 6): _5_6,
    (6, 1): _6_1, (6, 2): _6_2, (6, 3): _6_3, (6, 4): _6_4, (6, 5): _6_5, (6, 6): _6_6,
}
