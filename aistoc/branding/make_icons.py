"""Generate Windows icons and desktop brand images from the AISTOC logo."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

SIZES = (16, 24, 32, 48, 64, 128, 256)


def _square(image: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    copy = image.convert("RGBA")
    copy.thumbnail((size, size), Image.Resampling.LANCZOS)
    left = (size - copy.width) // 2
    top = (size - copy.height) // 2
    canvas.paste(copy, (left, top), copy)
    return canvas


def make_icons(source: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    image = Image.open(source)
    _square(image, 512).save(out_dir / "icon.png")
    _square(image, 256).save(out_dir / "icon.ico", sizes=[(s, s) for s in SIZES])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("AISTOC.jpg"))
    parser.add_argument("--out", type=Path, default=Path("aistoc/branding/icons"))
    args = parser.parse_args()
    make_icons(args.source, args.out)


if __name__ == "__main__":
    main()
