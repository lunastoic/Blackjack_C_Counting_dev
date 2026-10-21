"""Card-edge grain for the side of a stack (DeckGauge). One sheet per pitch,
bigger than any face the gauge draws (100×140 pt), shown at its natural size
and cropped by the face. Each pitch is one card edge: a dark hairline where
two cards meet, a faint bright hairline where the card under it catches the
light, sparse paper grain between, and every so often a darker, worn edge.
Authored at 1×/2×/3× so a line stays one device pixel."""
# Usage (from the repo root): python3 scripts/assets/make_stack_edges.py [out_dir]
# Rewrites assets/cards/stack/card-edges*.png, the grain DeckGauge lays over a stack.

import math, random, sys
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/cards/stack"
W_PT, H_PT = 100, 140

def sheet(pitch_pt, scale, name):
    random.seed(11)
    w, h = W_PT * scale, H_PT * scale
    pitch = max(2, round(pitch_pt * scale))
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    y0 = 0
    while y0 + pitch <= h:
        phase = random.random() * math.tau
        depth = random.uniform(0.75, 1.0)
        worn = random.random() < 0.09
        for x in range(w):
            wob = 0.5 + 0.5 * math.sin(phase + x / w * math.tau * 3)
            a = 0.15 + 0.15 * wob * depth + (0.16 if worn else 0)
            px[x, y0 + pitch - 1] = (74, 54, 32, int(255 * min(a, 0.5)))
            if pitch >= 4:
                px[x, y0] = (255, 252, 240, int(255 * (0.08 + 0.08 * (1 - wob))))
            for y in range(1 if pitch >= 4 else 0, pitch - 1):
                r = random.random()
                if r < 0.05:
                    px[x, y0 + y] = (60, 45, 30, 16)
                elif r < 0.10:
                    px[x, y0 + y] = (255, 255, 255, 20)
        y0 += pitch
    img.save(f"{OUT}/{name}{'@%dx' % scale if scale > 1 else ''}.png", optimize=True)
    return (w, h, pitch)

for scale in (1, 2, 3):
    print("coarse", scale, sheet(3.0, scale, "card-edges"))       # 1-2 decks: about a card a line
    print("fine  ", scale, sheet(1.75, scale, "card-edges-fine"))  # 4+ decks: tighter grain
