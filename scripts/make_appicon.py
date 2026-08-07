#!/usr/bin/env python3
"""
Generator Power Advisor — production App Icon generator.

Design brief:
  - Rounded-square icon (full-bleed; iOS applies the corner mask)
  - Slate-blue background (brand palette)
  - Modern white generator load gauge as the primary focal point
  - Integrated white lightning bolt at the gauge center
  - Subtle mountain silhouette across the bottom ~18% (a slightly darker
    slate-blue — a quiet DMSaur brand signature, never dominant)
  - Tasteful muted capacity arc: green (safe) -> amber (near limit) -> red (max)

No text, no initials, no "GPA". Deterministic. Supersampled for crisp edges.

Run: python3 scripts/make_appicon.py
Outputs the 1024 master to scripts/build/appicon-1024.png
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

# ---------------------------------------------------------------- palette
# Slate-blue brand palette. Deep, desaturated, premium (Apple / Garmin / Tesla).
BG_TOP    = (0x3C, 0x53, 0x6B)   # #3C536B  slate-blue, lit from top
BG_BOT    = (0x28, 0x3A, 0x4E)   # #283A4E  deeper slate-blue
MTN_BACK  = (0x30, 0x45, 0x5B)   # #30455B  distant ridge (subtle)
MTN_FRONT = (0x22, 0x33, 0x45)   # #223345  near ridge (darker slate-blue)

WHITE     = (0xFF, 0xFF, 0xFF)
WHITE_DIM = (0xE8, 0xEE, 0xF5)   # faint off-white for tick marks

# Muted, premium capacity-arc colors (understated — not neon, not cartoon).
ARC_TRACK = (0x35, 0x4A, 0x60)   # unlit track behind the arc
ARC_GREEN = (0x5F, 0xA8, 0x78)   # muted safe green
ARC_AMBER = (0xD6, 0xA0, 0x5A)   # muted near-limit amber
ARC_RED   = (0xC0, 0x5B, 0x54)   # muted max red

SS = 4  # supersample factor


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vertical_gradient(size, top, bot):
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        # slight diagonal bias for a soft, premium light
        t = y / (size - 1)
        row = lerp(top, bot, t)
        for x in range(size):
            px[x, y] = row
    return img


def draw_arc_band(draw, cx, cy, radius, width, start, end, color):
    """Thick arc drawn as a series of wedge segments (round caps)."""
    # PIL's arc supports width; use it with round-ish caps via pieslice overlap.
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.arc(bbox, start, end, fill=color, width=width)


def rounded_cap(draw, cx, cy, radius, angle_deg, width, color):
    """Draw a filled circle to round an arc end at the given angle."""
    a = math.radians(angle_deg)
    px = cx + radius * math.cos(a)
    py = cy + radius * math.sin(a)
    r = width / 2
    draw.ellipse([px - r, py - r, px + r, py + r], fill=color)


def build_icon(px_out=1024):
    S = px_out * SS
    img = vertical_gradient(S, BG_TOP, BG_BOT)
    d = ImageDraw.Draw(img)

    cx = S * 0.5
    cy = S * 0.480          # gauge sits slightly above center (room for mountains)
    R  = S * 0.324          # capacity-arc radius (centerline)
    arc_w = S * 0.076       # capacity-arc thickness

    # -------------------------------------------------- capacity arc
    # Speedometer sweep: opens at the bottom, 240deg total.
    # PIL angles: 0=3o'clock, clockwise (y down). 270 = top.
    a0, a1 = 150.0, 390.0
    sweep = a1 - a0
    # Unlit track first (full sweep), then colored zones on top.
    draw_arc_band(d, cx, cy, R, int(arc_w), a0, a1, ARC_TRACK)
    rounded_cap(d, cx, cy, R, a0, arc_w, ARC_TRACK)
    rounded_cap(d, cx, cy, R, a1, arc_w, ARC_TRACK)

    zones = [
        (0.00, 0.56, ARC_GREEN),
        (0.56, 0.80, ARC_AMBER),
        (0.80, 1.00, ARC_RED),
    ]
    for f0, f1, col in zones:
        s = a0 + sweep * f0
        e = a0 + sweep * f1
        draw_arc_band(d, cx, cy, R, int(arc_w), s, e, col)
    # round the two outer ends of the colored arc
    rounded_cap(d, cx, cy, R, a0, arc_w, ARC_GREEN)
    rounded_cap(d, cx, cy, R, a1, arc_w, ARC_RED)

    # -------------------------------------------------- white tick marks
    n_ticks = 9
    tick_len = S * 0.052
    tick_w = max(1, int(S * 0.010))
    r_in = R - arc_w * 0.5 - S * 0.028
    r_out = r_in - tick_len
    for i in range(n_ticks):
        f = i / (n_ticks - 1)
        ang = math.radians(a0 + sweep * f)
        x1 = cx + r_in * math.cos(ang)
        y1 = cy + r_in * math.sin(ang)
        x2 = cx + r_out * math.cos(ang)
        y2 = cy + r_out * math.sin(ang)
        d.line([x1, y1, x2, y2], fill=WHITE_DIM, width=tick_w)

    # -------------------------------------------------- lightning bolt (white)
    # Bolt occupies the gauge center; clean, bold, symmetric-feeling zigzag.
    bolt_h = S * 0.380
    bolt_cx = cx
    bolt_top = cy - bolt_h * 0.50
    # unit bolt (x right, y down) normalized to [0..1] box, then scaled
    unit = [
        (0.560, 0.000),
        (0.130, 0.540),
        (0.430, 0.540),
        (0.180, 1.000),
        (0.880, 0.400),
        (0.560, 0.400),
    ]
    bw = bolt_h * 0.70
    pts = []
    for ux, uy in unit:
        x = bolt_cx - bw * 0.5 + ux * bw
        y = bolt_top + uy * bolt_h
        pts.append((x, y))
    d.polygon(pts, fill=WHITE)

    # small hub circle behind bolt base for a "gauge center" read
    hub_r = S * 0.020
    d.ellipse([cx - hub_r, cy + R * 0.02 - hub_r,
               cx + hub_r, cy + R * 0.02 + hub_r], fill=WHITE)

    # -------------------------------------------------- mountain silhouette
    # Bottom ~18%. Two ridges in darker slate-blue; subtle brand signature.
    base_y = S * 0.955
    # distant ridge
    back = [
        (0, S * 0.885),
        (S * 0.20, S * 0.845),
        (S * 0.40, S * 0.885),
        (S * 0.58, S * 0.835),
        (S * 0.78, S * 0.880),
        (S * 1.00, S * 0.850),
        (S, base_y), (0, base_y),
    ]
    d.polygon(back, fill=MTN_BACK)
    # near ridge (foreground, darker, with a couple of clean peaks)
    front = [
        (0, S * 0.930),
        (S * 0.16, S * 0.895),
        (S * 0.30, S * 0.925),
        (S * 0.46, S * 0.870),
        (S * 0.62, S * 0.920),
        (S * 0.80, S * 0.885),
        (S * 1.00, S * 0.925),
        (S, base_y), (0, base_y),
    ]
    d.polygon(front, fill=MTN_FRONT)

    # -------------------------------------------------- downsample
    out = img.resize((px_out, px_out), Image.LANCZOS)
    return out


def build_splash(px_out=2732):
    """Branded launch screen: slate-blue field with a centered white gauge +
    lightning bolt mark (no mountains — clean and calm for a splash)."""
    S = px_out * SS
    img = vertical_gradient(S, BG_TOP, BG_BOT)
    d = ImageDraw.Draw(img)

    cx = S * 0.5
    cy = S * 0.5
    R = S * 0.150
    arc_w = S * 0.034

    a0, a1 = 150.0, 390.0
    sweep = a1 - a0
    draw_arc_band(d, cx, cy, R, int(arc_w), a0, a1, ARC_TRACK)
    rounded_cap(d, cx, cy, R, a0, arc_w, ARC_TRACK)
    rounded_cap(d, cx, cy, R, a1, arc_w, ARC_TRACK)
    for f0, f1, col in [(0.00, 0.56, ARC_GREEN), (0.56, 0.80, ARC_AMBER), (0.80, 1.00, ARC_RED)]:
        draw_arc_band(d, cx, cy, R, int(arc_w), a0 + sweep * f0, a0 + sweep * f1, col)
    rounded_cap(d, cx, cy, R, a0, arc_w, ARC_GREEN)
    rounded_cap(d, cx, cy, R, a1, arc_w, ARC_RED)

    bolt_h = S * 0.176
    bolt_top = cy - bolt_h * 0.50
    unit = [(0.560, 0.000), (0.130, 0.540), (0.430, 0.540),
            (0.180, 1.000), (0.880, 0.400), (0.560, 0.400)]
    bw = bolt_h * 0.70
    pts = [(cx - bw * 0.5 + ux * bw, bolt_top + uy * bolt_h) for ux, uy in unit]
    d.polygon(pts, fill=WHITE)

    return img.resize((px_out, px_out), Image.LANCZOS)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    outdir = os.path.join(here, "build")
    os.makedirs(outdir, exist_ok=True)
    master = build_icon(1024)
    master.save(os.path.join(outdir, "appicon-1024.png"))
    print("wrote", os.path.join(outdir, "appicon-1024.png"))
    splash = build_splash(2732)
    splash.save(os.path.join(outdir, "splash-2732.png"))
    print("wrote", os.path.join(outdir, "splash-2732.png"))
