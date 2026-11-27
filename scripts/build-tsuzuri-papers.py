"""Generate original translucent paper surfaces at a fixed seed.

Requires Pillow and NumPy. Texture artwork version 1, for screen and export.
"""
from pathlib import Path
from random import Random
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 480, 680
OUT = Path(__file__).resolve().parents[1] / "public" / "papers" / "tsuzuri"
OUT.mkdir(parents=True, exist_ok=True)
Y, X = np.mgrid[0:H, 0:W]
EDGE = np.minimum(np.minimum(X, W - 1 - X), np.minimum(Y, H - 1 - Y))

for i in range(1, 9):
    rng = Random(85 + i)
    noise = np.random.default_rng(85 + i).normal(2.8, 1.1, (H, W))
    ink = [(88, 101, 111), (88, 53, 25), (89, 92, 80), (96, 74, 60),
           (141, 102, 45), (131, 77, 36), (84, 103, 61), (244, 220, 178)][i - 1]
    if i == 1:
        noise += 14 * np.exp(-(((X - 38) / 325) ** 2 + ((Y - 230) / 165) ** 2))
        noise += 9 * np.exp(-(((X - 490) / 130) ** 2 + ((Y - 515) / 190) ** 2))
    if i == 6:
        noise += 54 * np.exp(-EDGE / (34 + 7 * np.sin((X + Y) / 60)))
    if i in (2, 8):
        noise += (20 if i == 2 else 7) * np.exp(-EDGE / 12)
    texture = Image.new("RGBA", (W, H), (*ink, 0))
    texture.putalpha(Image.fromarray(noise.clip(0, 64).astype(np.uint8)))
    details = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(details)
    if i in (1, 2, 7, 8):
        for j in range({1: 52, 2: 160, 7: 83, 8: 320}[i]):
            x, y = rng.randrange(W), rng.randrange(H)
            angle = rng.uniform(0, math.tau)
            size = rng.uniform(*{1: (1, 4), 2: (10, 43), 7: (4, 13), 8: (2, 8)}[i])
            dx, dy = math.cos(angle) * size, math.sin(angle) * size
            alpha = rng.randrange(10, 34) if i in (2, 8) else rng.randrange(13, 42)
            draw.line((x, y, x + dx * .45 - dy * .15, y + dy * .45 + dx * .15, x + dx, y + dy),
                      fill=(*ink, alpha), width=2 if i == 7 and j % 3 == 0 else 1)
            if i == 7 and j % 3 == 0:
                draw.polygon(((x, y), (x + 4, y + 1), (x + 2, y + 5)), fill=(111, 82, 43, alpha + 7))
    if i == 3:
        for y in range(0, H, 9):
            draw.line((0, y, W, y), fill=(*ink, 15 if y % 27 else 25))
    if i == 4:
        for x in range(0, W, 5):
            draw.line((x, 0, x, H), fill=(*ink, 22))
        for y in range(2, H, 7):
            draw.line((0, y, W, y), fill=(*ink, 26))
            for x in range(2 + (y % 2) * 4, W, 10):
                draw.line((x, y, x + 4, y + 1), fill=(255, 255, 255, 79))
    if i == 5:
        for _ in range(140):
            x, y = rng.randrange(W), rng.randrange(H)
            if min(x, y, W - x, H - y) > 74:
                continue
            a = rng.randrange(24, 83)
            draw.polygon(((x, y), (x + rng.randrange(2, 7), y + 1), (x + 1, y + rng.randrange(2, 5))),
                         fill=(*ink, a))
    if i in (1, 2, 8):
        details = details.filter(ImageFilter.GaussianBlur(0.35))
    Image.alpha_composite(texture, details).save(OUT / f"PA{i:02}.png", optimize=True)
