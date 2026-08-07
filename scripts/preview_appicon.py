#!/usr/bin/env python3
"""
Render a preview sheet of the master icon at App Store sizes, with the iOS
superellipse-ish corner mask applied, on a neutral checker so edges are visible.
Run after make_appicon.py.
"""
import os
from PIL import Image, ImageDraw

here = os.path.dirname(os.path.abspath(__file__))
master = Image.open(os.path.join(here, "build", "appicon-1024.png")).convert("RGB")

SIZES = [1024, 180, 120, 60, 29]
GAP = 40
PAD = 40
LABEL_H = 34


def rounded(img, radius_frac=0.2237):
    """Apply an iOS-style rounded-corner mask (approx continuous-corner look)."""
    s = img.size[0]
    r = int(s * radius_frac)
    mask = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


# checker background
def checker(w, h, c1=(220, 224, 230), c2=(198, 204, 212), cell=16):
    bg = Image.new("RGB", (w, h), c1)
    px = bg.load()
    for y in range(h):
        for x in range(w):
            if ((x // cell) + (y // cell)) % 2:
                px[x, y] = c2
    return bg


# lay sizes out left-to-right, bottom-aligned
total_w = PAD * 2 + sum(SIZES) + GAP * (len(SIZES) - 1)
max_h = max(SIZES)
total_h = PAD * 2 + max_h + LABEL_H
sheet = checker(total_w, total_h)
draw = ImageDraw.Draw(sheet)

x = PAD
baseline = PAD + max_h
for s in SIZES:
    icon = master.resize((s, s), Image.LANCZOS)
    icon = rounded(icon)
    y = baseline - s
    sheet.paste(icon, (x, y), icon)
    draw.text((x, baseline + 8), f"{s}x{s}", fill=(40, 48, 60))
    x += s + GAP

out = os.path.join(here, "build", "appicon-preview.png")
sheet.save(out)
print("wrote", out)

# also save individual sized previews (rounded, on white) for the user
for s in SIZES:
    icon = master.resize((s, s), Image.LANCZOS)
    icon = rounded(icon)
    bg = Image.new("RGB", (s, s), (255, 255, 255))
    bg.paste(icon, (0, 0), icon)
    bg.save(os.path.join(here, "build", f"preview-{s}.png"))
print("wrote individual previews")
