"""Rebuild the mock-up's "Level brief · every level" section.

    python3 build_briefs.py <saved-artifact.html> <out-page.html> [--preview DIR]

saved-artifact.html: the mock-up as the Artifact read saves it. out-page.html: the inner
page to publish back (from <title> to </body>). --preview DIR also writes standalone
pages (the page's CSS + the new section only) for a headless-Chrome look.

The section has two parts:
  1. "Labelling the rules" — the Card Rain brief four ways: today's pills, then A · stat
     tiles, B · one line of fine print, C · a placard of label/value rows.
  2. One brief per level, 36 in all, on each casino's slab, with a vignette of what the
     level asks for (briefs.py) in place of the three example cards, and the rules as
     stat tiles (A).
Level titles, pace and copy are read from src/engine/dojo/training.ts so the sheet
tracks the app.
"""
import html
import os
import re
import sys

import briefs

HERE = os.path.dirname(os.path.abspath(__file__))
TRAINING = os.path.join(HERE, '..', '..', 'src', 'engine', 'dojo', 'training.ts')

CASINOS = {
    1: ('Luna Luxe Casino', 'Running Count Basics', '', '--felt:#00000080;--feltDeep:#000000A6'),
    2: ('Io Inferno Lounge', 'Basic Strategy', 'orange', '--felt:#8A3A1280;--feltDeep:#8A3A12A6'),
    3: ('Europa Ice Palace', 'True Count', 'blue', '--felt:#1F4F8A80;--feltDeep:#1F4F8AA6'),
    4: ('Ganymede Grand', 'Betting the Count', 'purple', '--felt:#5A3A8A80;--feltDeep:#5A3A8AA6'),
    5: ('Titan Methane Mirage', 'Playing the Count', 'green', '--felt:#1E6E4A80;--feltDeep:#1E6E4AA6'),
    6: ('Kepler Fortune', 'Final Exam', 'yellow', '--felt:#8A6A1480;--feltDeep:#8A6A14A6'),
}
SPEED_LABEL = {'beginner': 'Beginner', 'easy': 'Easy', 'normal': 'Normal', 'fast': 'Fast', 'veryFast': 'Very fast', 'casino': 'Casino'}

# star targets + their unit, as starTargets()/streakUnit() give them (dumped 2026-10-19)
STARS = {
    (1, 1): ([11, 21, 32], 'right'), (1, 2): ([1, 2, 3], 'grids'), (1, 3): ([8, 16, 24], 'right'), (1, 4): ([4, 8, 12], 'checks'), (1, 5): ([5, 10, 15], 'hands'), (1, 6): ([1, 2, 3], 'rounds'),
    (2, 1): ([11, 21, 32], 'right'), (2, 2): ([1, 2, 3], 'waves'), (2, 3): ([8, 16, 24], 'right'), (2, 4): ([10, 20, 30], 'hands'), (2, 5): ([6, 12, 18], 'hands'), (2, 6): ([20, 40, 60], 'hands'),
    (3, 1): ([8, 16, 24], 'right'), (3, 2): ([1, 2, 3], 'grids'), (3, 3): ([8, 16, 24], 'right'), (3, 4): ([4, 8, 12], 'checks'), (3, 5): ([6, 12, 18], 'hands'), (3, 6): ([8, 16, 24], 'checks'),
    (4, 1): ([11, 21, 32], 'right'), (4, 2): ([1, 2, 3], 'waves'), (4, 3): ([8, 16, 24], 'right'), (4, 4): ([5, 10, 15], 'checks'), (4, 5): ([8, 15, 23], 'hands'), (4, 6): ([9, 18, 27], 'checks'),
    (5, 1): ([11, 21, 32], 'right'), (5, 2): ([1, 2, 3], 'sets'), (5, 3): ([8, 16, 24], 'right'), (5, 4): ([7, 14, 21], 'right'), (5, 5): ([8, 15, 23], 'hands'), (5, 6): ([10, 20, 30], 'checks'),
    (6, 1): ([11, 21, 32], 'right'), (6, 2): ([1, 2, 3], 'stages'), (6, 3): ([6, 12, 18], 'checks'), (6, 4): ([18, 36, 54], 'checks'), (6, 5): ([13, 25, 38], 'hands'), (6, 6): ([30, 60, 90], 'hands'),
}

# icon values for the stat tiles
ICON = {
    'timer': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9M9.5 2.5h5M12 2.5V6M18 7l1.5-1.5"/></svg>',
    'keypad': '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8.5" r="1.5"/><circle cx="12" cy="8.5" r="1.5"/><circle cx="16" cy="8.5" r="1.5"/><circle cx="8" cy="12.5" r="1.5"/><circle cx="12" cy="12.5" r="1.5"/><circle cx="16" cy="12.5" r="1.5"/><rect x="7" y="15.5" width="10" height="2.4" rx="1.2"/></svg>',
    'players': '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="8" r="3.2"/><path d="M2 19c0-3.5 2.7-6 6-6s6 2.5 6 6z"/><circle cx="17" cy="9" r="2.6" opacity=".7"/><path d="M14.5 19c.2-2.6 1.4-4.6 3.3-5.5 2.4.3 4.2 2.6 4.2 5.5z" opacity=".7"/></svg>',
    'flame': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2 .8-3.3 1.6-4.4.3 1.4 1 2.4 2.1 2.6C10.2 8.5 10.5 5 12 2z"/></svg>',
    'strike': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
}

# the rules as stat tiles: (value, label); an 'i:' value is an icon. Then any fine print.
LEDGER = {
    (1, 1): ([('3', 'strikes')], ''),
    (1, 2): ([('3', 'strikes'), ('i:timer', 'meter runs with the grid up')], ''),
    (1, 3): ([('3', 'strikes')], ''),
    (1, 4): ([('2', 'misses allowed'), ('5–10', 'cards a check'), ('i:timer', 'timed answer'), ('i:keypad', 'exact entry')], ''),
    (1, 5): ([('10', 'hands'), ('1', 'deck'), ('8s', 'per count call')], 'Graded: counts · 80% clears, 100% for ★★★'),
    (1, 6): ([('2 / 3', 'rounds to clear'), ('39–48', 'stops at card'), ('i:timer', 'timed answer'), ('i:keypad', 'exact entry')], 'A fresh deck each round'),
    (2, 1): ([('3', 'strikes')], ''),
    (2, 2): ([('3', 'strikes'), ('i:timer', 'meter runs while you play')], ''),
    (2, 3): ([('3', 'strikes')], ''),
    (2, 4): ([('20', 'hands'), ('2', 'decks')], 'Graded: counts · 80% clears, 100% for ★★★'),
    (2, 5): ([('12', 'hands'), ('2', 'decks'), ('8s', 'per count call')], 'Graded: counts · 80% clears, 100% for ★★★'),
    (2, 6): ([('40', 'hands'), ('2', 'decks'), ('3+3', 'move / count strikes')], 'Graded: counts · 85% clears, 100% for ★★★'),
    (3, 1): ([('3', 'strikes')], ''),
    (3, 2): ([('3', 'strikes'), ('i:timer', 'meter runs while you play')], ''),
    (3, 3): ([('3', 'strikes')], ''),
    (3, 4): ([('2', 'misses allowed'), ('2', 'decks'), ('i:timer', 'timed answer'), ('i:keypad', 'exact entry')], ''),
    (3, 5): ([('12', 'hands'), ('4', 'decks'), ('10s', 'per count call')], 'Graded: counts · 80% clears, 100% for ★★★'),
    (3, 6): ([('2', 'misses allowed'), ('4', 'decks'), ('i:players', '2 players + dealer'), ('i:keypad', 'exact entry')], ''),
    (4, 1): ([('2', 'strikes')], ''),
    (4, 2): ([('2', 'strikes'), ('i:timer', 'meter runs while you play')], ''),
    (4, 3): ([('2', 'strikes')], ''),
    (4, 4): ([('2', 'misses allowed'), ('4', 'decks'), ('i:timer', 'timed answer'), ('i:keypad', 'exact entry')], ''),
    (4, 5): ([('15', 'hands'), ('6', 'decks')], 'Graded: counts, bets · 85% clears, 100% for ★★★'),
    (4, 6): ([('2', 'misses allowed'), ('6', 'decks'), ('i:players', '3 players + dealer'), ('i:keypad', 'exact entry')], ''),
    (5, 1): ([('2', 'strikes')], ''),
    (5, 2): ([('2', 'strikes'), ('i:timer', 'meter runs while you play')], ''),
    (5, 3): ([('2', 'strikes')], ''),
    (5, 4): ([('2', 'strikes')], ''),
    (5, 5): ([('15', 'hands'), ('8', 'decks')], 'Graded: counts, bets, insurance, index plays · 85% clears, 100% for ★★★'),
    (5, 6): ([('3', 'misses allowed'), ('8', 'decks'), ('i:players', '3 players + dealer'), ('i:keypad', 'exact entry')], ''),
    (6, 1): ([('1', 'strike')], ''),
    (6, 2): ([('1', 'strike'), ('i:timer', 'meter runs while you play')], ''),
    (6, 3): ([('1', 'miss allowed'), ('6', 'decks'), ('i:players', '3 players + dealer'), ('i:keypad', 'exact entry')], ''),
    (6, 4): ([('0', 'misses allowed'), ('8', 'decks'), ('i:timer', 'timed answer'), ('i:keypad', 'exact entry')], ''),
    (6, 5): ([('25', 'hands'), ('8', 'decks')], 'Graded: counts, bets, insurance, index plays · 90% clears, 100% for ★★★'),
    (6, 6): ([('60', 'hands'), ('8', 'decks'), ('i:flame', 'pit boss watches')], 'Graded: counts, bets, insurance, index plays · 90% clears, 100% for ★★★ · ramp too fast and the pit boss backs you off'),
}

CARD_RAIN_PILLS = ['2 misses, then out', 'A check every 5–10 cards', 'The meter drains while you answer', 'Exact entry', 'Best 6 checks']

CSS = r"""
/* ─── level brief · every level ─── */
.lb-vig{align-self:stretch;padding:2px 6px 0}
.lb-vig-svg{display:block;width:100%;height:auto}
.lb-ledger{display:flex;justify-content:center;gap:6px;align-self:stretch}
.lb-lg{flex:1 1 0;min-width:0;max-width:118px;display:flex;flex-direction:column;align-items:center;gap:1px;border:1.5px solid var(--infoEdge);border-radius:12px;background:var(--infoFill);padding:5px 4px 4px}
.lb-lg i{font:22px/22px var(--jr);font-style:normal;color:var(--gold);text-shadow:1px 2px 0 #0006;display:flex;align-items:center;justify-content:center;height:22px;letter-spacing:.5px;white-space:nowrap}
.lb-lg i svg{width:20px;height:20px;filter:drop-shadow(1px 2px 0 #0006)}
.lb-lg b{font:600 8.5px/10px var(--mono);letter-spacing:.3px;text-transform:uppercase;color:var(--aMuted);text-align:center}
.lb-fine{font:11px/15px var(--mono);color:var(--aMuted);text-align:center;padding:0 6px}
.lb-fine b{color:var(--cream);font-weight:500}
.lb-facts{font:12px/17px var(--mono);color:var(--aMuted);text-align:center;padding:0 8px}
.lb-facts b{color:var(--cream);font-weight:500}
.lb-kv{align-self:stretch;display:grid;grid-template-columns:max-content 1fr;column-gap:12px;border:1.5px solid var(--infoEdge);border-radius:12px;background:var(--infoFill);padding:3px 12px}
.lb-kv b{font:600 10px/19px var(--mono);letter-spacing:1px;color:var(--gold);text-transform:uppercase;text-align:right}
.lb-kv span{font:12px/19px var(--mono);color:var(--cream)}
.lb-kv > *:nth-child(n+3){border-top:1px solid var(--infoEdge)}
.lb-cap .best{color:var(--gold)}
.lb-rules{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.lb2-map{margin-top:28px}
.lb2-head{display:flex;align-items:baseline;gap:14px;margin:0 0 4px}
.lb2-head h3{font-family:var(--jr);font-weight:400;font-size:28px;line-height:1;margin:0;color:var(--cream);letter-spacing:1px}
.lb2-head span{font:12px var(--mono);color:var(--pageMuted)}
.lb2-grid{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;zoom:.9}
.lb2-tile{width:385px;padding:12px;border-radius:22px;display:flex;flex-direction:column;gap:8px}
.lb2-tile .lb-panel{align-self:stretch}
.lb2-cap{font:11px/15px var(--mono);color:var(--aMuted);text-align:center;padding:0 10px}
.lb2-cap b{color:var(--cream);font-weight:500}
"""


def read_levels():
    src = open(TRAINING, encoding='utf-8').read()
    body = src[src.index('export const TRAINING_MAPS'):src.index('export function trainingMapSpec')]
    levels = {}
    maps = re.split(r'\n\s*mapId:\s*(\d+),', body)[1:]
    for mid, chunk in zip(maps[0::2], maps[1::2]):
        for m in re.finditer(r"title:\s*'((?:[^'\\]|\\.)*)',\s*brief:\s*'((?:[^'\\]|\\.)*)',\s*speed:\s*'(\w+)'", chunk):
            levels.setdefault(int(mid), []).append((m.group(1).replace("\\'", "'"), m.group(2).replace("\\'", "'"), SPEED_LABEL[m.group(3)]))
    for mid in range(1, 7):
        assert len(levels.get(mid, [])) == 6, f'map {mid}: {len(levels.get(mid, []))} levels parsed'
    return levels


def esc(s):
    return html.escape(s, quote=False)


def stars_block(targets, unit, best=None):
    tiles = ''.join(f'<div class="lb-tile"><span class="lb-st">{"★" * (i + 1)}</span><span class="lb-tg">{n} {unit}</span></div>' for i, n in enumerate(targets))
    cap = f'Best run so far: <span class="best">{best} {unit}</span>' if best is not None else 'Your best run determines your stars.'
    return f'<div class="lb-sg"><div class="lb-tab">Star goals</div><div class="lb-inset"><div class="lb-tiles">{tiles}</div><div class="lb-cap">{cap}</div></div></div>'


def ledger_block(tiles, fine):
    out = '<div class="lb-ledger">'
    for value, label in tiles:
        v = ICON[value[2:]] if value.startswith('i:') else esc(value)
        out += f'<div class="lb-lg"><i>{v}</i><b>{esc(label)}</b></div>'
    out += '</div>'
    if fine:
        out += f'<div class="lb-fine">{esc(fine)}</div>'
    return out


def plaque(level, title, pace):
    cls = ' s' if len(title) > 14 else ''
    return (f'<div class="plq"><div class="tab">Level {level}</div><div class="body{cls}">{esc(title)}</div></div>'
            f'<div class="lb-pill">{esc(pace).upper()}</div>')


def panel(mid, lvl, title, brief, pace, rules_html, best=None, vignette=True):
    targets, unit = STARS[(mid, lvl)]
    tokens = CASINOS[mid][3]
    if vignette == 'cards':
        vig = ('<div class="ex lb-ex"><div class="c a"><span class="lb-card lb-c1"></span><b style="color:var(--minus)">−1</b></div>'
               '<div class="c b"><span class="lb-card lb-c2"></span><b style="color:var(--cream)">0</b></div>'
               '<div class="c d"><span class="lb-card lb-c3"></span><b style="color:var(--mint)">+1</b></div></div>')
    else:
        vig = f'<div class="lb-vig">{briefs.scene(mid, lvl)}</div>' if vignette else ''
    return (f'<div class="panel lb-panel lb-slab" style="{tokens};--feltEdge:#FFFFFF1F;--pillc:var(--mint)">'
            + plaque(lvl, title, pace) + vig
            + f'<div class="info">{esc(brief)}</div>'
            + stars_block(targets, unit, best)
            + rules_html
            + '<span class="btn gold lb-start">Start training ▶</span>'
            + '<div class="lb-how"><span class="q">?</span>How this level works</div></div>')


def phone_head(saved, subtitle):
    """The Luna Luxe phone chrome (status bar + HUD) from the Slab figure, retitled."""
    i = saved.index('<h3 id="brief-slab">')
    j = saved.index('<div class="phone suede">', i)
    k = saved.index('<div class="stage lb-stage">', j)
    return saved[j:k].replace('Level 1 · Fast card values', subtitle) + '<div class="stage lb-stage">'


def options_section(saved, levels):
    title, brief, pace = levels[1][3]
    head = phone_head(saved, 'Level 4 · Card Rain')
    today_rules = '<div class="lb-rules">' + ''.join(f'<span class="pill">{esc(p)}</span>' for p in CARD_RAIN_PILLS) + '</div>'
    a_rules = ledger_block(*LEDGER[(1, 4)])
    b_rules = '<div class="lb-facts"><b>2</b> misses allowed · a check every <b>5–10</b> cards · timed answer · exact entry</div>'
    c_rules = ('<div class="lb-kv"><b>Misses</b><span>2, then out</span><b>Checks</b><span>every 5–10 cards</span>'
               '<b>Clock</b><span>drains while you answer</span><b>Entry</b><span>exact</span></div>')
    figs = [
        ('Today', today_rules, None, 'The three example cards of every level, then five pills in three rows — the rules cost more height than the star goals, and <i>Best 6 checks</i> sits among rules it is not one of.', 'cards'),
        ('A · Stat tiles', a_rules, 6, 'One row, in the star-goal tiles’ own language: the number big, the word small; the timer and keypad as icons. The best run moves up into the star-goal caption, next to the targets it is measured against. <b>Recommended.</b>', True),
        ('B · Fine print', b_rules, 6, 'The same facts as one line of mono under the star goals, numbers in cream. The least height of the three; the least scannable too.', True),
        ('C · Placard', c_rules, 6, 'A table placard: label in gold caps, value beside it, a hairline between rows. Four short rows read as a list of rules rather than a paragraph.', True),
    ]
    out = ['<h3 class="sub" id="brief-rules">Labelling the rules — the Card Rain brief four ways</h3>',
           '<p class="note">The brief’s rules come as pills today, one per fact, and they wrap to three or four rows on most levels. Three ways to say the same things in a quarter of the height. The three new ones also carry the Card Rain vignette in place of the three example cards.</p>',
           '<div class="row">']
    for name, rules, best, cap, vig in figs:
        out.append(f'<figure><div class="phone suede">{head}'
                   + panel(1, 4, title, brief, pace, rules, best=best, vignette=vig)
                   + f'</div></div><figcaption><b>{name}</b>{cap}</figcaption></figure>')
    out.append('</div>')
    return '\n'.join(out)


def sheet_section(levels):
    out = ['<h3 class="sub" id="brief-levels">Every level, every casino</h3>',
           '<p class="note">Thirty-six briefs, each on its casino’s slab. The picture under the plaque is the level itself — its cards, its pads, its pauses, what it asks you to type — so a player knows what is coming before Start. Title, pace and copy are the app’s own; the rules are stat tiles (A). Star goals keep each level’s unit: right answers, grids, waves, sets, stages, rounds, hands or checks.</p>']
    for mid in range(1, 7):
        name, theme, cls, _ = CASINOS[mid]
        out.append(f'<div class="lb2-map"><div class="lb2-head"><h3>Map {mid} · {esc(name)}</h3><span>{esc(theme)}</span></div><div class="lb2-grid">')
        for lvl in range(1, 7):
            title, brief, pace = levels[mid][lvl - 1]
            tiles, fine = LEDGER[(mid, lvl)]
            out.append(f'<div class="lb2-tile suede {cls}">' + panel(mid, lvl, title, brief, pace, ledger_block(tiles, fine)) + '</div>')
        out.append('</div></div>')
    return '\n'.join(out)


def build_section(saved, levels):
    return ('<section id="briefs-all">\n<h2>Level brief · every level</h2>\n'
            '<p class="note">Two fixes to the brief. The three example cards (−1 · 0 · +1) are right for Card Values and wrong for everything after it — Card Rain, Chip Rush and the Count-Along bosses all showed the same three cards. Each level now gets a small scene of what it actually does. And the rules under the star goals, one pill per fact, took four rows; they become one row of stat tiles.</p>\n'
            f'<style>{CSS}</style>\n' + options_section(saved, levels) + '\n' + sheet_section(levels) + '\n</section>\n')


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    saved = open(src, encoding='utf-8').read()
    levels = read_levels()
    section = build_section(saved, levels)
    # replace an earlier build of the section, else insert before Settings · Look
    if '<section id="briefs-all">' in saved:
        a = saved.index('<section id="briefs-all">')
        b = saved.index('</section>', a) + len('</section>\n')
        page = saved[:a] + section + saved[b:]
    else:
        anchor = saved.index('<section id="look">')
        page = saved[:anchor] + section + saved[anchor:]
    head_end = page.find('<title>')
    tail = page.rfind('</body>')
    inner = page[head_end:tail]
    open(dst, 'w', encoding='utf-8').write(inner)
    print(f'wrote {dst}: {len(inner.encode()):,} bytes (section {len(section.encode()):,}); full page would be {len(page.encode()):,}')
    if preview:
        os.makedirs(preview, exist_ok=True)
        css_start = page.index('<style>', head_end)
        css_end = page.index('</style>', css_start) + len('</style>')
        link = page[page.index('<link', head_end):page.index('>', page.index('<link', head_end)) + 1]
        base = ('<!doctype html><html><head><meta charset="utf-8">' + link + page[css_start:css_end]
                + f'<style>{CSS}</style></head><body><div class="page">')
        opts = options_section(saved, levels)
        open(os.path.join(preview, 'opts.html'), 'w').write(base + '<section>' + opts + '</section></div></body></html>')
        for mid in range(1, 7):
            name, theme, cls, _ = CASINOS[mid]
            part = [f'<section><div class="lb2-map"><div class="lb2-head"><h3>Map {mid} · {esc(name)}</h3><span>{esc(theme)}</span></div><div class="lb2-grid">']
            for lvl in range(1, 7):
                title, brief, pace = levels[mid][lvl - 1]
                part.append(f'<div class="lb2-tile suede {cls}">' + panel(mid, lvl, title, brief, pace, ledger_block(*LEDGER[(mid, lvl)])) + '</div>')
            part.append('</div></div></section>')
            open(os.path.join(preview, f'map{mid}.html'), 'w').write(base + ''.join(part) + '</div></body></html>')
        print('previews in', preview)


if __name__ == '__main__':
    main()
