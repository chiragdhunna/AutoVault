#!/usr/bin/env python3
"""Generate AutoVault's extension icons (16/32/48/128) as PNGs.

Draws a padlock on a blue rounded-square at 512px (supersampled) and downscales
with LANCZOS for crisp small sizes. Run: python3 scripts/make-icons.py
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)

M = 512  # master size


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_master() -> Image.Image:
    img = Image.new("RGBA", (M, M), (0, 0, 0, 0))

    # Vertical gradient background
    top = (59, 120, 255)   # #3b78ff
    bot = (32, 80, 200)    # #2050c8
    grad = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(M):
        gd.line([(0, y), (M, y)], fill=lerp(top, bot, y / M) + (255,))

    # Rounded-square mask
    mask = Image.new("L", (M, M), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([8, 8, M - 8, M - 8], radius=112, fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    white = (255, 255, 255, 255)
    keyhole = (33, 69, 143, 255)

    # Shackle (the "U" above the body)
    d.arc([182, 150, 330, 300], start=180, end=360, fill=white, width=38)

    # Lock body
    d.rounded_rectangle([150, 232, 362, 410], radius=30, fill=white)

    # Keyhole
    d.ellipse([238, 285, 274, 321], fill=keyhole)
    d.polygon([(248, 308), (264, 308), (272, 372), (240, 372)], fill=keyhole)

    return img


def main() -> None:
    master = make_master()
    for size in (128, 48, 32, 16):
        icon = master.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT, f"icon-{size}.png")
        icon.save(path)
        print("wrote", os.path.abspath(path))


if __name__ == "__main__":
    main()
