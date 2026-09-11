"""Build padded, alpha-trimmed Linux icons from the existing mascot artwork."""
import pathlib
import sys
import gi

gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf

source = GdkPixbuf.Pixbuf.new_from_file(sys.argv[1])
assert source.get_has_alpha(), "Expected transparent mascot artwork"
pixels = source.get_pixels()
stride = source.get_rowstride()
channels = source.get_n_channels()
points = [(x, y) for y in range(source.get_height())
          for x in range(source.get_width())
          if pixels[y * stride + x * channels + channels - 1] > 8]
assert points, "Mascot artwork is empty"
left = min(x for x, y in points)
top = min(y for x, y in points)
width = max(x for x, y in points) - left + 1
height = max(y for x, y in points) - top + 1
cropped = source.new_subpixbuf(left, top, width, height)
root = pathlib.Path(sys.argv[2])
for size in (32, 48, 64, 128, 256, 512):
    scale = (size * 0.96) / max(width, height)
    w, h = max(1, round(width * scale)), max(1, round(height * scale))
    art = cropped.scale_simple(w, h, GdkPixbuf.InterpType.BILINEAR)
    canvas = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, True, 8, size, size)
    canvas.fill(0)
    art.copy_area(0, 0, w, h, canvas, (size - w) // 2, (size - h) // 2)
    target = root / f"{size}x{size}" / "apps" / "spooly-linux-test.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.savev(str(target), "png", [], [])
print(f"Icon crop: {left},{top} {width}x{height}; six sizes generated")
