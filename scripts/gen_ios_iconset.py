#!/usr/bin/env python3
"""
Generate the complete iOS AppIcon.appiconset from the 1024 master and write a
Contents.json that populates every standard slot (iPhone + iPad + App Store).

All icons are opaque RGB, full-bleed (no baked-in rounded corners, no alpha) —
iOS applies the corner mask. The App Store 1024 must have no alpha channel.

Run: python3 scripts/gen_ios_iconset.py
"""
import json
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(HERE, "build", "appicon-1024.png")
DEST = os.path.abspath(os.path.join(
    HERE, "..", "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset"))

# (idiom, size_pt, scale) -> Xcode standard slots
SLOTS = [
    ("iphone", 20, 2), ("iphone", 20, 3),
    ("iphone", 29, 2), ("iphone", 29, 3),
    ("iphone", 40, 2), ("iphone", 40, 3),
    ("iphone", 60, 2), ("iphone", 60, 3),
    ("ipad", 20, 1), ("ipad", 20, 2),
    ("ipad", 29, 1), ("ipad", 29, 2),
    ("ipad", 40, 1), ("ipad", 40, 2),
    ("ipad", 76, 1), ("ipad", 76, 2),
    ("ipad", 83.5, 2),
    ("ios-marketing", 1024, 1),
]


def fmt_pt(pt):
    return str(int(pt)) if float(pt).is_integer() else str(pt)


def main():
    master = Image.open(MASTER).convert("RGB")
    assert master.size == (1024, 1024), master.size

    # remove any stale pngs in the set
    for f in os.listdir(DEST):
        if f.endswith(".png"):
            os.remove(os.path.join(DEST, f))

    images = []
    made = {}  # px -> filename (dedupe identical pixel sizes)
    for idiom, pt, scale in SLOTS:
        px = int(round(pt * scale))
        fname = f"AppIcon-{fmt_pt(pt)}x{fmt_pt(pt)}@{scale}x.png"
        # marketing icon gets a clean canonical name
        if idiom == "ios-marketing":
            fname = "AppIcon-1024.png"
        path = os.path.join(DEST, fname)
        if not os.path.exists(path):
            img = master if px == 1024 else master.resize((px, px), Image.LANCZOS)
            # opaque, no alpha
            img.convert("RGB").save(path, format="PNG")
        images.append({
            "filename": fname,
            "idiom": idiom,
            "scale": f"{scale}x",
            "size": f"{fmt_pt(pt)}x{fmt_pt(pt)}",
        })

    contents = {"images": images, "info": {"author": "xcode", "version": 1}}
    with open(os.path.join(DEST, "Contents.json"), "w") as fh:
        json.dump(contents, fh, indent=2)
        fh.write("\n")

    # report
    pngs = sorted(f for f in os.listdir(DEST) if f.endswith(".png"))
    print(f"Wrote {len(images)} slots, {len(pngs)} unique png files to:\n  {DEST}")
    for f in pngs:
        w, h = Image.open(os.path.join(DEST, f)).size
        print(f"  {f:28s} {w}x{h}")


if __name__ == "__main__":
    main()
