#!/usr/bin/env python3
"""Ghép các PNG trong một thư mục thành ảnh xem trước (contact sheet) có nhãn.
Dùng: python3 scripts/contact_sheet.py <thư_mục_assets> <ảnh_ra.png> [cột] [cỡ_ô] [nền]"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
cell = int(sys.argv[4]) if len(sys.argv) > 4 else 128
bg = sys.argv[5] if len(sys.argv) > 5 else "#1b2433"
files = sorted(f for f in os.listdir(src) if f.endswith(".png"))
font = None
for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
    if os.path.exists(p):
        font = ImageFont.truetype(p, 10)
        break
font = font or ImageFont.load_default()
rows = (len(files) + cols - 1) // cols
label_h = 16
W, H = cols * cell, rows * (cell + label_h)
sheet = Image.new("RGB", (W, H), bg)
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(os.path.join(src, f)).convert("RGBA")
    if cell != im.width:
        im = im.resize((cell, cell), Image.NEAREST)
    x, y = (i % cols) * cell, (i // cols) * (cell + label_h)
    sheet.paste(im, (x, y), im)
    name = f[:-4]
    if len(name) > cell // 6:
        name = name[: cell // 6 - 1] + "…"
    d.text((x + 3, y + cell + 2), name, fill="#cfd8e8", font=font)
sheet.save(out)
print(f"{out}: {len(files)} ảnh, {W}x{H}")
