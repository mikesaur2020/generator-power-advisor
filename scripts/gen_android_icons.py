#!/usr/bin/env python3
"""
Generate Android launcher icons + splash from the finalized production master.

Adaptive icon (API 26+):
  - background layer = slate vertical gradient (full-bleed), per density bitmap
  - foreground layer = gauge arc + lightning bolt, centered within the 66% safe
    zone (no mountains — they'd sit in the maskable bleed region)
Legacy icons (pre-26): ic_launcher / ic_launcher_round = the FULL app icon
  (gradient + gauge + bolt + arc + mountains), square and circular.
Play Store icon: 512 full artwork.
Splash: slate field + centered gauge/bolt mark (matches iOS splash).

Reuses drawing primitives from make_appicon.py. Deterministic.
Run: python3 scripts/gen_android_icons.py
"""
import os
import sys
import math
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_appicon as M  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, ".."))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
MASTER = os.path.join(ROOT, "assets", "branding",
                      "generator-power-advisor-icon-1024.png")
BRANDING = os.path.join(ROOT, "assets", "branding")

SS = 4  # supersample

# adaptive layer px per density (108dp base)
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
# legacy square/round icon px per density (48dp base)
LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def _bolt_points(cx, top, h):
    unit = [(0.560, 0.000), (0.130, 0.540), (0.430, 0.540),
            (0.180, 1.000), (0.880, 0.400), (0.560, 0.400)]
    bw = h * 0.70
    return [(cx - bw * 0.5 + ux * bw, top + uy * h) for ux, uy in unit]


def foreground(px):
    """Gauge arc + bolt, centered, ~safe-zone scale, transparent bg."""
    S = px * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S * 0.5
    R = S * 0.232
    arc_w = S * 0.058
    a0, a1 = 150.0, 390.0
    sweep = a1 - a0
    M.draw_arc_band(d, cx, cy, R, int(arc_w), a0, a1, M.ARC_TRACK)
    M.rounded_cap(d, cx, cy, R, a0, arc_w, M.ARC_TRACK)
    M.rounded_cap(d, cx, cy, R, a1, arc_w, M.ARC_TRACK)
    for f0, f1, col in [(0.0, 0.56, M.ARC_GREEN), (0.56, 0.80, M.ARC_AMBER),
                        (0.80, 1.0, M.ARC_RED)]:
        M.draw_arc_band(d, cx, cy, R, int(arc_w), a0 + sweep * f0,
                        a0 + sweep * f1, col)
    M.rounded_cap(d, cx, cy, R, a0, arc_w, M.ARC_GREEN)
    M.rounded_cap(d, cx, cy, R, a1, arc_w, M.ARC_RED)
    bolt_h = S * 0.285
    d.polygon(_bolt_points(cx, cy - bolt_h * 0.50, bolt_h), fill=M.WHITE)
    return img.resize((px, px), Image.LANCZOS)


def background(px):
    """Full-bleed slate vertical gradient."""
    return M.vertical_gradient(px * SS, M.BG_TOP, M.BG_BOT).resize(
        (px, px), Image.LANCZOS).convert("RGB")


def circular(im):
    s = im.size[0]
    mask = Image.new("L", (s * 4, s * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
    mask = mask.resize((s, s), Image.LANCZOS)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def save(img, *parts):
    path = os.path.join(RES, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return path


def main():
    master = Image.open(MASTER).convert("RGB")
    n = 0
    for dens, px in ADAPTIVE.items():
        save(foreground(px), f"mipmap-{dens}", "ic_launcher_foreground.png")
        save(background(px), f"mipmap-{dens}", "ic_launcher_background.png")
        n += 2
    for dens, px in LEGACY.items():
        sq = master.resize((px, px), Image.LANCZOS)
        save(sq, f"mipmap-{dens}", "ic_launcher.png")
        save(circular(sq), f"mipmap-{dens}", "ic_launcher_round.png")
        n += 2
    # Play Store icon (512) for Play Console — not bundled in the APK
    master.resize((512, 512), Image.LANCZOS).save(
        os.path.join(BRANDING, "play-store-icon-512.png"))
    print(f"wrote {n} launcher pngs + play-store-icon-512.png")


if __name__ == "__main__":
    main()
