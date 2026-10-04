"""Render the PWA icons: a round penguin on a sky-blue rounded square.

  python tools/make-icons.py

Needs Pillow. Draws at 1024 px and downsamples, so the edges stay smooth.
Idempotent: re-running overwrites icons/icon-192.png, icons/icon-512.png and
icons/apple-touch-icon.png. The favicon is favicon.svg, drawn by hand with
the same shapes.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'icons'

BG = (191, 227, 247)
ICE = (255, 255, 255)
BODY = (43, 49, 64)
BELLY = (255, 255, 255)
BEAK = (245, 158, 66)
FEET = (242, 163, 163)
EYE = (11, 13, 18)


def ellipse(draw, cx, cy, rx, ry, fill):
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill)


def render(size):
    s = 1024
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s, s], radius=s // 4.5, fill=BG)
    # ice
    ellipse(d, s * 0.5, s * 0.9, s * 0.42, s * 0.07, ICE)
    # flippers
    for sx in (-1, 1):
        fl = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fl)
        ellipse(fd, s * 0.5, s * 0.58, s * 0.075, s * 0.2, BODY)
        fl = fl.rotate(-16 * sx, center=(s * 0.5, s * 0.58), resample=Image.BICUBIC)
        offset = int(sx * s * 0.25)
        img.alpha_composite(fl, (offset, 0) if offset > 0 else (0, 0), (abs(offset) if offset < 0 else 0, 0))
    d = ImageDraw.Draw(img)
    # feet
    ellipse(d, s * 0.4, s * 0.86, s * 0.095, s * 0.04, FEET)
    ellipse(d, s * 0.6, s * 0.86, s * 0.095, s * 0.04, FEET)
    # body and belly
    ellipse(d, s * 0.5, s * 0.53, s * 0.265, s * 0.375, BODY)
    ellipse(d, s * 0.5, s * 0.62, s * 0.18, s * 0.25, BELLY)
    # eyes
    for ex in (0.405, 0.595):
        ellipse(d, s * ex, s * 0.345, s * 0.055, s * 0.055, (255, 255, 255))
        ellipse(d, s * (ex + 0.008), s * 0.345, s * 0.027, s * 0.027, EYE)
        ellipse(d, s * (ex + 0.018), s * 0.335, s * 0.009, s * 0.009, (255, 255, 255))
    # beak
    d.polygon([(s * 0.44, s * 0.42), (s * 0.56, s * 0.42), (s * 0.5, s * 0.5)], fill=BEAK)
    # cheeks
    ellipse(d, s * 0.34, s * 0.44, s * 0.03, s * 0.03, (255, 179, 179, 140))
    ellipse(d, s * 0.66, s * 0.44, s * 0.03, s * 0.03, (255, 179, 179, 140))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size in (('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)):
        render(size).convert('RGB').save(OUT / name, 'PNG', optimize=True)
        print('  icons/%-22s %dx%d' % (name, size, size))
    print('done.')
