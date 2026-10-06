"""SVG blueprint art for the level nodes and reward nodes — one 100×100 viewBox per icon."""
import math

CREAM = '#F5EEDC'
EDGE = '#E2B95B'
INK = '#1E1607'
RED = '#C9342E'
GOLD = '#F2C445'
GOLD_DEEP = '#C9971F'
FELT = '#1F5A3E'
FELT_EDGE = '#2A6A4A'
SHOE = '#1B1714'
MINT = '#6FD693'

BACKS = {1: '#A8262A', 2: '#C24A1B', 3: '#3B7EC9', 4: '#7B4FB8', 5: '#2C8C5E', 6: '#C99A22'}
SUIT_CHAR = {'s': '♠', 'h': '♥', 'd': '♦', 'c': '♣'}


def g(inner, cx=0, cy=0, rot=0, extra='', scale=1):
    sc = f' scale({scale})' if scale != 1 else ''
    return f'<g transform="translate({cx} {cy}) rotate({rot}){sc}" {extra}>{inner}</g>'


def card(cx, cy, rot=0, rank=None, suit=None, w=34, h=48, back=None, face_extra='', op=1):
    """A card centred on (cx, cy). Face with rank+suit, or a back in the map colour."""
    x, y = -w / 2, -h / 2
    r = 3.5
    if back:
        body = (
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{back}" stroke="{EDGE}" stroke-width="1.6"/>'
            f'<rect x="{x+4}" y="{y+4}" width="{w-8}" height="{h-8}" rx="2" fill="none" stroke="{CREAM}" stroke-opacity=".55" stroke-width="1.2"/>'
            f'<path d="M0 {-h*0.22} L{w*0.2} 0 L0 {h*0.22} L{-w*0.2} 0Z" fill="{CREAM}" fill-opacity=".35"/>'
        )
    else:
        col = RED if suit in ('h', 'd') else INK
        ch = SUIT_CHAR.get(suit, '')
        body = (
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{CREAM}" stroke="{EDGE}" stroke-width="1.6"/>'
            f'<text x="{x+3.5}" y="{y+11}" font-family="var(--sys)" font-weight="700" font-size="10" fill="{col}">{rank or ""}</text>'
            f'<text x="{x+3.5}" y="{y+20}" font-family="var(--sys)" font-size="9" fill="{col}">{ch}</text>'
            f'<text x="{w*0.12}" y="{h*0.30}" text-anchor="middle" font-family="var(--sys)" font-size="{h*0.5}" fill="{col}">{ch}</text>'
            + face_extra
        )
    return g(body, cx, cy, rot, f'opacity="{op}"' if op != 1 else '')


def deck(cx, cy, back, n=7, w=44, h=60, rot=0, step=1.8):
    """A stack of cards seen from a little above: tan edges under a back."""
    parts = []
    for i in range(n - 1, 0, -1):
        parts.append(
            f'<rect x="{-w/2}" y="{-h/2 + i*step}" width="{w}" height="{h}" rx="3.5" fill="{"#E8DCC0" if i % 2 else "#D8C9A6"}" stroke="#B9A67C" stroke-width=".8"/>'
        )
    parts.append(card(0, 0, 0, w=w, h=h, back=back))
    return g(''.join(parts), cx, cy, rot)


def half_deck(cx, cy, back, rot=0):
    return deck(cx, cy, back, n=4, w=44, h=60, rot=rot)


def shoe(cx, cy, back, decks=6, scale=1.0, label=''):
    """The dealing shoe: a black wedge with gold trim, card backs stacked on the slope."""
    s = scale
    body = (
        f'<path d="M-40 26 L-40 -2 L30 -30 L40 -20 L40 26 Z" fill="{SHOE}" stroke="{EDGE}" stroke-width="1.6" stroke-linejoin="round"/>'
        f'<path d="M-40 26 L40 26 L40 32 L-40 32Z" fill="#0E0B09" stroke="{EDGE}" stroke-width="1.2"/>'
        f'<path d="M-34 -2 L26 -26 L34 -20 L34 -10 L-34 12Z" fill="{back}" stroke="{CREAM}" stroke-opacity=".5" stroke-width="1"/>'
    )
    # visible deck edges on the slope
    for i in range(decks):
        y = -12 + i * 4.2
        body += f'<line x1="-32" y1="{y+12}" x2="{30 - i*0.5}" y2="{y-12}" stroke="#E8DCC0" stroke-opacity=".6" stroke-width="1.4"/>'
    body += f'<path d="M-40 -2 L30 -30" stroke="{EDGE}" stroke-width="1.6"/>'
    if label:
        body += f'<text x="0" y="22" text-anchor="middle" font-family="var(--jr)" font-size="13" fill="{GOLD}" letter-spacing="1">{label}</text>'
    return g(body, cx, cy, scale=s)


def felt_table(cx, cy, rx=46, ry=30, top_only=True):
    """A slice of table felt with the gold betting arc."""
    body = (
        f'<path d="M{-rx} 0 A{rx} {ry} 0 0 1 {rx} 0 L{rx} 8 L{-rx} 8Z" fill="{FELT}" stroke="{FELT_EDGE}" stroke-width="1.5"/>'
        f'<path d="M{-rx*0.8} 2 A{rx*0.8} {ry*0.72} 0 0 1 {rx*0.8} 2" fill="none" stroke="{GOLD}" stroke-opacity=".7" stroke-width="1.4" stroke-dasharray="4 3"/>'
    )
    return g(body, cx, cy)


def hand(cx, cy, rot, cards, w=22, h=30, back=None):
    """Two or more small cards fanned as one hand."""
    parts = []
    n = len(cards)
    for i, (rank, suit) in enumerate(cards):
        off = (i - (n - 1) / 2) * 9
        parts.append(card(off, 0, (i - (n - 1) / 2) * 8, rank, suit, w=w, h=h, back=back))
    return g(''.join(parts), cx, cy, rot)


def streaks(cx, cy, length=26, spread=9, colour=None):
    """Three speed lines trailing left, fading."""
    col = colour or GOLD
    parts = []
    for i, (dy, op, ln) in enumerate(((-spread, .55, length), (0, .85, length * 1.25), (spread, .55, length))):
        parts.append(f'<line x1="{-ln}" y1="{dy}" x2="0" y2="{dy}" stroke="{col}" stroke-opacity="{op}" stroke-width="3" stroke-linecap="round"/>')
    return g(''.join(parts), cx, cy)


def chip(cx, cy, r, colour, label='', ring=CREAM):
    dashes = ''
    for i in range(6):
        a = i * 60
        dashes += f'<path d="M{r*0.98} 0 L{r*0.72} 0" stroke="{ring}" stroke-width="{r*0.28}" transform="rotate({a})"/>'
    body = (
        f'<circle r="{r}" fill="{colour}" stroke="{INK}" stroke-width="1.5"/>'
        + dashes
        + f'<circle r="{r*0.62}" fill="none" stroke="{ring}" stroke-opacity=".8" stroke-width="1"/>'
        + (f'<text y="{r*0.22}" text-anchor="middle" font-family="var(--jr)" font-size="{r*0.7}" fill="{CREAM}">{label}</text>' if label else '')
    )
    return g(body, cx, cy)


def badge(cx, cy, text, fill='#5A1F2A', edge='#7A2E3B', colour=GOLD, w=None, size=13):
    w = w or (len(text) * size * 0.62 + 12)
    body = (
        f'<rect x="{-w/2}" y="-10" width="{w}" height="20" rx="7" fill="{fill}" stroke="{edge}" stroke-width="1.5"/>'
        f'<text y="5" text-anchor="middle" font-family="var(--jr)" font-size="{size}" fill="{colour}" letter-spacing=".5">{text}</text>'
    )
    return g(body, cx, cy)


def stopwatch(cx, cy, r=14):
    body = (
        f'<rect x="-4" y="{-r-8}" width="8" height="5" rx="1" fill="{GOLD_DEEP}"/>'
        f'<line x1="0" y1="{-r-3}" x2="0" y2="{-r}" stroke="{GOLD_DEEP}" stroke-width="3"/>'
        f'<circle r="{r}" fill="{CREAM}" stroke="{GOLD_DEEP}" stroke-width="3"/>'
        f'<line x1="0" y1="0" x2="0" y2="{-r*0.65}" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>'
        f'<line x1="0" y1="0" x2="{r*0.45}" y2="{r*0.25}" stroke="{RED}" stroke-width="1.6" stroke-linecap="round"/>'
        f'<circle r="1.6" fill="{INK}"/>'
    )
    return g(body, cx, cy)


def star(cx, cy, r, fill=GOLD, stroke=GOLD_DEEP):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append(f'{rr*math.cos(a):.1f},{rr*math.sin(a):.1f}')
    return g(f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke="{stroke}" stroke-width="1" stroke-linejoin="round"/>', cx, cy)


def laurel(cx, cy, r=30, colour=GOLD):
    """Two laurel branches curving up around a centre."""
    leaves = ''
    for side in (-1, 1):
        for i in range(6):
            a = math.radians(200 + i * 22) if side < 0 else math.radians(-20 - i * 22)
            x = r * math.cos(a)
            y = r * math.sin(a) + 8
            rot = math.degrees(a) + (90 if side < 0 else -90)
            leaves += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="3" ry="6.5" fill="{colour}" transform="rotate({rot:.0f} {x:.1f} {y:.1f})"/>'
        leaves += f'<path d="M{side*r} 8 A{r} {r} 0 0 {1 if side<0 else 0} 0 {8-r}" fill="none" stroke="{colour}" stroke-width="1.5"/>'
    return g(leaves, cx, cy)


def hourglass(cx, cy, h=34):
    w = 20
    body = (
        f'<rect x="{-w/2-3}" y="{-h/2-4}" width="{w+6}" height="4" rx="1" fill="{GOLD_DEEP}"/>'
        f'<rect x="{-w/2-3}" y="{h/2}" width="{w+6}" height="4" rx="1" fill="{GOLD_DEEP}"/>'
        f'<path d="M{-w/2} {-h/2} L{w/2} {-h/2} L2 0 L{w/2} {h/2} L{-w/2} {h/2} L-2 0Z" fill="{CREAM}" fill-opacity=".85" stroke="{GOLD_DEEP}" stroke-width="1.5" stroke-linejoin="round"/>'
        f'<path d="M{-w/2+3} {-h/2+3} L{w/2-3} {-h/2+3} L1 -3 L-1 -3Z" fill="{GOLD}"/>'
        f'<path d="M{-w/2+3} {h/2-1} L{w/2-3} {h/2-1} L{w/2-8} {h/2-6} L{-w/2+8} {h/2-6}Z" fill="{GOLD}"/>'
        f'<line x1="0" y1="0" x2="0" y2="{h/2-6}" stroke="{GOLD}" stroke-width="1.2"/>'
    )
    return g(body, cx, cy)


def cocktail(cx, cy):
    body = (
        f'<path d="M-13 -16 L13 -16 L0 2Z" fill="{CREAM}" fill-opacity=".9" stroke="{GOLD_DEEP}" stroke-width="1.4" stroke-linejoin="round"/>'
        f'<path d="M-9 -13 L9 -13 L0 -1Z" fill="{RED}" fill-opacity=".8"/>'
        f'<line x1="0" y1="2" x2="0" y2="14" stroke="{GOLD_DEEP}" stroke-width="1.8"/>'
        f'<line x1="-7" y1="15" x2="7" y2="15" stroke="{GOLD_DEEP}" stroke-width="2" stroke-linecap="round"/>'
        f'<circle cx="5" cy="-10" r="2.2" fill="{MINT}"/>'
    )
    return g(body, cx, cy)


def ribbon_banner(cx, cy, text, fill=RED, w=64):
    body = (
        f'<path d="M{-w/2-8} -4 L{-w/2} -10 L{-w/2} 10 L{-w/2-8} 4 Z" fill="#8A1F1B"/>'
        f'<path d="M{w/2+8} -4 L{w/2} -10 L{w/2} 10 L{w/2+8} 4 Z" fill="#8A1F1B"/>'
        f'<rect x="{-w/2}" y="-10" width="{w}" height="20" rx="2" fill="{fill}" stroke="{INK}" stroke-width="1"/>'
        f'<text y="5" text-anchor="middle" font-family="var(--jr)" font-size="14" fill="{CREAM}" letter-spacing="2">{text}</text>'
    )
    return g(body, cx, cy)


def seal(cx, cy, r=11):
    pts = []
    for i in range(24):
        a = i * math.pi / 12
        rr = r if i % 2 == 0 else r * 0.82
        pts.append(f'{rr*math.cos(a):.1f},{rr*math.sin(a):.1f}')
    body = (
        f'<path d="M-4 {r-2} L-7 {r+14} L0 {r+9} L7 {r+14} L4 {r-2}Z" fill="{RED}"/>'
        f'<polygon points="{" ".join(pts)}" fill="{GOLD}" stroke="{GOLD_DEEP}" stroke-width="1"/>'
        f'<circle r="{r*0.55}" fill="none" stroke="{GOLD_DEEP}" stroke-width="1"/>'
    )
    return g(body, cx, cy)


def scroll(cx, cy, w=60, h=44):
    body = (
        f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="3" fill="{CREAM}" stroke="{GOLD_DEEP}" stroke-width="1.5"/>'
        f'<rect x="{-w/2-3}" y="{-h/2-4}" width="{w+6}" height="8" rx="4" fill="#E8DCC0" stroke="{GOLD_DEEP}" stroke-width="1.2"/>'
        f'<rect x="{-w/2-3}" y="{h/2-4}" width="{w+6}" height="8" rx="4" fill="#E8DCC0" stroke="{GOLD_DEEP}" stroke-width="1.2"/>'
        f'<line x1="{-w/2+8}" y1="-8" x2="{w/2-8}" y2="-8" stroke="{INK}" stroke-opacity=".5" stroke-width="1.5"/>'
        f'<line x1="{-w/2+8}" y1="-1" x2="{w/2-20}" y2="-1" stroke="{INK}" stroke-opacity=".35" stroke-width="1.5"/>'
        f'<line x1="{-w/2+8}" y1="6" x2="{w/2-26}" y2="6" stroke="{INK}" stroke-opacity=".35" stroke-width="1.5"/>'
    )
    return g(body, cx, cy)


def gift(cx, cy, wrap, ribbon=GOLD, size=38, mystery=True):
    s = size
    body = (
        f'<rect x="{-s/2}" y="{-s/2+8}" width="{s}" height="{s-8}" rx="4" fill="{wrap}" stroke="{INK}" stroke-width="1.5"/>'
        f'<rect x="{-s/2-3}" y="{-s/2+2}" width="{s+6}" height="12" rx="3" fill="{wrap}" stroke="{INK}" stroke-width="1.5"/>'
        f'<rect x="-5" y="{-s/2+2}" width="10" height="{s-2}" fill="{ribbon}" stroke="{INK}" stroke-width="1"/>'
        f'<path d="M0 {-s/2+2} C-4 -16 -18 -22 -14 -10 C-11 -3 -4 -1 0 {-s/2+2} C4 -16 18 -22 14 -10 C11 -3 4 -1 0 {-s/2+2}Z" fill="{ribbon}" stroke="{INK}" stroke-width="1"/>'
    )
    if mystery:
        body += f'<text y="{s/2-3}" text-anchor="middle" font-family="var(--jr)" font-size="18" fill="{CREAM}" stroke="{INK}" stroke-width=".6">?</text>'
    return g(body, cx, cy)


def moneybag(cx, cy, colour='#8A6A38', size=40):
    s = size
    body = (
        f'<path d="M-8 {-s/2+4} L8 {-s/2+4} L14 {-s/2-2} L-14 {-s/2-2}Z" fill="{colour}" stroke="{INK}" stroke-width="1.5" stroke-linejoin="round"/>'
        f'<path d="M-9 {-s/2+5} C-26 {-s/2+16} -26 {s/2-4} 0 {s/2-2} C26 {s/2-4} 26 {-s/2+16} 9 {-s/2+5}Z" fill="{colour}" stroke="{INK}" stroke-width="1.5"/>'
        f'<path d="M-9 {-s/2+5} L9 {-s/2+5}" stroke="{GOLD}" stroke-width="3" stroke-linecap="round"/>'
        f'<text y="{s/2-13}" text-anchor="middle" font-family="var(--jr)" font-size="22" fill="{GOLD}" stroke="{INK}" stroke-width=".6">$</text>'
    )
    return g(body, cx, cy)


def lock_badge(cx, cy):
    return g(
        f'<circle r="9" fill="#4A3F3A" stroke="{INK}" stroke-width="1.5"/>'
        f'<path d="M-3 -1 V-3.5 a3 3 0 0 1 6 0 V-1 h1 a1 1 0 0 1 1 1 v4 a1 1 0 0 1 -1 1 h-8 a1 1 0 0 1 -1 -1 v-4 a1 1 0 0 1 1 -1z M-1.5 -1 h3 V-3.5 a1.5 1.5 0 0 0 -3 0z" fill="{CREAM}"/>',
        cx, cy,
    )


def moon(cx, cy, r=6, colour=GOLD):
    return g(f'<path d="M0 {-r} A{r} {r} 0 1 0 {r*0.9} {r*0.55} A{r*0.72} {r*0.72} 0 1 1 0 {-r}Z" fill="{colour}"/>', cx, cy)


def svg(inner, cls='la', box=100):
    return f'<svg class="{cls}" viewBox="0 0 {box} {box}" xmlns="http://www.w3.org/2000/svg">{inner}</svg>'
