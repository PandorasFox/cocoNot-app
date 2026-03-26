#!/usr/bin/env python3
"""Generate all platform icons from app/public/icons/icon.svg.

Usage: python3 scripts/gen-icons.py

Requires: pip install cairosvg Pillow
"""

import io
import os
import sys

try:
    import cairosvg
    from PIL import Image
except ImportError:
    sys.exit("Missing dependencies. Run: pip3 install cairosvg Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, "public", "icons", "icon.svg")

def render(size: int) -> Image.Image:
    png_data = cairosvg.svg2png(url=SVG, output_width=size, output_height=size)
    return Image.open(io.BytesIO(png_data)).convert("RGB")

def render_padded(size: int, padding_pct: float = 0.25) -> Image.Image:
    """Render SVG into center of a larger canvas with padding.
    Android adaptive icons clip ~25% so the foreground needs safe zone padding."""
    inner = int(size * (1 - padding_pct))
    icon = render(inner)
    # Sample background color from top-left pixel of the full render
    bg = render(size).getpixel((0, 0))
    canvas = Image.new("RGB", (size, size), bg)
    offset = (size - inner) // 2
    canvas.paste(icon, (offset, offset))
    return canvas

def main():
    # -- PWA icons --
    icons_dir = os.path.join(ROOT, "public", "icons")
    for size in [48, 192, 512, 1024]:
        render(size).save(f"{icons_dir}/icon-{size}.png")
        print(f"  PWA: icon-{size}.png")

    # -- iOS --
    ios_icon = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets",
                            "AppIcon.appiconset", "AppIcon-512@2x.png")
    if os.path.isdir(os.path.dirname(ios_icon)):
        render(1024).save(ios_icon)
        print("  iOS: AppIcon-512@2x.png")
    else:
        print("  iOS: skipped (ios/ not present)")

    # -- Android --
    android_res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    if os.path.isdir(android_res):
        mipmap = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
        foreground = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

        for density, px in mipmap.items():
            d = f"{android_res}/mipmap-{density}"
            render(px).save(f"{d}/ic_launcher.png")
            render(px).save(f"{d}/ic_launcher_round.png")
            print(f"  Android {density}: {px}px")

        for density, px in foreground.items():
            d = f"{android_res}/mipmap-{density}"
            render_padded(px).save(f"{d}/ic_launcher_foreground.png")
            print(f"  Android {density} fg: {px}px (padded)")
    else:
        print("  Android: skipped (android/ not present)")

    print("Done.")

if __name__ == "__main__":
    main()
