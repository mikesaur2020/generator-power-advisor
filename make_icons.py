#!/usr/bin/env python3
"""
Generate Generator Power Advisor (GPA) app icons and favicons.
Brand mark: a white speedometer/gauge arc with a lightning bolt at its center,
on a Trust-Blue gradient — "measured power." Deterministic, no external assets.
Run: python3 make_icons.py
"""
import math
from PIL import Image, ImageDraw

BRAND_TOP = (75, 144, 240)     # #4b90f0
BRAND_BOT = (32, 105, 214)     # #2069d6
WHITE = (255, 255, 255)

SS = 4  # supersample factor for smooth edges


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_gradient_square(size):
    """Full-bleed diagonal blue gradient (maskable-safe: no transparent corners)."""
    img = Image.new("RGB", (size, size), BRAND_TOP)
    px = img.load()
    for y in range(size):
        for x in range(size):
            # diagonal blend, slightly biased toward vertical
            t = (0.35 * (x / size) + 0.65 * (y / size))
            px[x, y] = lerp(BRAND_TOP, BRAND_BOT, t)
    return img


def bolt_points(cx, cy, h):
    """Lightning bolt polygon centered at (cx,cy) with total height h."""
    w = h * 0.62
    # normalized bolt (x:0..1 left->right, y:0..1 top->bottom)
    pts = [
        (0.60, 0.00), (0.10, 0.56), (0.44, 0.56),
        (0.34, 1.00), (0.90, 0.40), (0.54, 0.40), (0.72, 0.00),
    ]
    out = []
    for nx, ny in pts:
        out.append((cx + (nx - 0.5) * w, cy + (ny - 0.5) * h))
    return out


def render(size):
    S = size * SS
    img = draw_gradient_square(S).convert("RGBA")
    d = ImageDraw.Draw(img)

    cx = cy = S / 2
    # Gauge arc: open at the bottom (like a speedometer)
    r = S * 0.315
    lw = max(2, int(S * 0.058))
    bbox = [cx - r, cy - r, cx + r, cy + r]
    # arc from 130deg .. 410deg (i.e. open ~80deg gap at the bottom)
    d.arc(bbox, start=130, end=410, fill=WHITE, width=lw)
    # rounded end caps for the arc
    cap_r = lw / 2
    for ang in (130, 410):
        ex = cx + r * math.cos(math.radians(ang))
        ey = cy + r * math.sin(math.radians(ang))
        d.ellipse([ex - cap_r, ey - cap_r, ex + cap_r, ey + cap_r], fill=WHITE)
    # a couple of subtle tick marks near the caps
    for ang in (130, 410):
        a = math.radians(ang)
        r1, r2 = r - lw * 1.6, r - lw * 0.2
        d.line([(cx + r1 * math.cos(a), cy + r1 * math.sin(a)),
                (cx + r2 * math.cos(a), cy + r2 * math.sin(a))],
               fill=WHITE, width=max(2, int(lw * 0.5)))

    # Lightning bolt in the center
    d.polygon(bolt_points(cx, cy + S * 0.012, S * 0.40), fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


def render_svg_favicon():
    """A compact SVG version of the mark for crisp favicons at any size."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4b90f0"/><stop offset="1" stop-color="#2069d6"/>
  </linearGradient></defs>
  <rect width="100" height="100" rx="22" fill="url(#g)"/>
  <path d="M50 18.5 A31.5 31.5 0 1 1 49.9 18.5" fill="none" stroke="#fff"
        stroke-width="5.8" stroke-linecap="round"
        transform="rotate(130 50 50)" stroke-dasharray="173 74"/>
  <path d="M56 26 L36 51.5 H53 L47 74 L66 44 H50 L59 26 Z" fill="#fff"/>
</svg>'''


if __name__ == "__main__":
    targets = {
        "icon-192.png": 192,
        "icon-512.png": 512,
        "apple-touch-icon.png": 180,
        "favicon-32.png": 32,
    }
    for name, sz in targets.items():
        render(sz).save(name)
        print("wrote", name, sz)
    with open("favicon.svg", "w") as f:
        f.write(render_svg_favicon())
    print("wrote favicon.svg")
