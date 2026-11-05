from pathlib import Path

from PIL import Image

from aistoc.branding.make_icons import make_icons


def test_make_icons_writes_expected_sizes(tmp_path: Path):
    source = Path(__file__).parent.parent.parent / "AISTOC.jpg"
    out = tmp_path / "icons"
    make_icons(source, out)
    assert (out / "icon.png").exists()
    assert (out / "icon.ico").exists()
    png = Image.open(out / "icon.png")
    assert png.size == (512, 512)
    ico = Image.open(out / "icon.ico")
    assert ico.size == (256, 256)
    assert (out / "icon.ico").stat().st_size > 10_000
