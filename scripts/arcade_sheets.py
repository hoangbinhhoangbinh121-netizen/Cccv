#!/usr/bin/env python3
"""Tạo bảng emoji Ngư Trường có ĐÁNH SỐ: mỗi ô = số thứ tự · mã emoji (ng_...) · tên file · tên gọi.
Ra: docs/arcade-emoji/sheet-XX.png (theo nhóm), docs/ARCADE-EMOJI.md, docs/arcade-emoji/catalog.csv."""
import json, os, csv, sys
from PIL import Image, ImageDraw, ImageFont
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cat = json.load(open(os.path.join(root, "data", "arcade-emoji.json"), encoding="utf8"))
out = os.path.join(root, "docs", "arcade-emoji"); os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith(".png"): os.remove(os.path.join(out, f))
F = lambda s, b=False: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if b else ""), s)
fN, fK, fT, fH = F(15, True), F(12, True), F(12), F(22, True)
COLS, CW, CH, TILE = 5, 250, 236, 128
groups = []
for x in cat:
    if not groups or groups[-1][0] != x["group"]: groups.append((x["group"], []))
    groups[-1][1].append(x)
# gom các nhóm nhỏ vào cùng trang (≤ 20 ô/trang), nhóm lớn tách trang
pages, cur = [], []
for g, items in groups:
    chunks = [items[i:i + 20] for i in range(0, len(items), 20)]
    for ch in chunks:
        if cur and len(cur) + len(ch) > 20: pages.append(cur); cur = []
        cur += [(g, x) for x in ch]
if cur: pages.append(cur)
def wrap(d, text, font, width):
    words, lines, line = text.split(), [], ""
    for w in words:
        t = (line + " " + w).strip()
        if d.textlength(t, font=font) <= width: line = t
        else: lines.append(line); line = w
    if line: lines.append(line)
    return lines
for pi, page in enumerate(pages, 1):
    rows = (len(page) + COLS - 1) // COLS; head = 46
    sheet = Image.new("RGB", (COLS * CW, head + rows * CH), "#141b29"); d = ImageDraw.Draw(sheet)
    titles = sorted({g for g, _ in page}, key=[g for g, _ in page].index)
    nums = [x["no"] for _, x in page]
    d.text((14, 10), "NGƯ TRƯỜNG – EMOJI PIXEL  |  Trang %d/%d  |  #%d–#%d  |  %s" % (pi, len(pages), min(nums), max(nums), " · ".join(titles)), fill="#ffd23f", font=fH)
    for k, (g, x) in enumerate(page):
        cx, cy = (k % COLS) * CW, head + (k // COLS) * CH
        d.rectangle([cx + 6, cy + 6, cx + CW - 6, cy + CH - 6], fill="#1d2738", outline="#33415c")
        tx, ty = cx + (CW - TILE) // 2, cy + 14
        for yy in range(0, TILE, 16):  # nền ô caro để thấy vùng trong suốt
            for xx in range(0, TILE, 16):
                d.rectangle([tx + xx, ty + yy, tx + xx + 15, ty + yy + 15], fill="#26324a" if (xx // 16 + yy // 16) % 2 else "#2d3b57")
        im = Image.open(os.path.join(root, "assets", "arcade", x["id"] + ".png")).convert("RGBA")
        sheet.paste(im, (tx, ty), im)
        d.rounded_rectangle([cx + 12, cy + 10, cx + 12 + 14 + 10 * len(str(x["no"])), cy + 32], radius=6, fill="#e5484d")
        d.text((cx + 19, cy + 13), "#%d" % x["no"], fill="white", font=fN)
        d.text((cx + 14, cy + 148), "ng_" + x["id"], fill="#7df9ff", font=fK)
        d.text((cx + 14, cy + 164), "file: arcade/" + x["id"] + ".png", fill="#8fa1bd", font=F(10))
        for li, ln in enumerate(wrap(d, x["name"] + " — " + x["meaning"], fT, CW - 28)[:3]):
            d.text((cx + 14, cy + 181 + li * 15), ln, fill="#e8eefc" if li == 0 else "#b6c3dc", font=fT)
    sheet.save(os.path.join(out, "sheet-%02d.png" % pi))
# bảng tổng quan
all_im = Image.new("RGB", (14 * 72, ((len(cat) + 13) // 14) * 92 + 8), "#141b29"); d = ImageDraw.Draw(all_im)
for k, x in enumerate(cat):
    im = Image.open(os.path.join(root, "assets", "arcade", x["id"] + ".png")).convert("RGBA").resize((64, 64), Image.NEAREST)
    cx, cy = (k % 14) * 72 + 4, (k // 14) * 92 + 4; all_im.paste(im, (cx, cy), im); d.text((cx + 2, cy + 66), "#%d" % x["no"], fill="#ffd23f", font=F(12, True))
all_im.save(os.path.join(out, "overview.png"))
with open(os.path.join(out, "catalog.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["STT", "Mã emoji", "File", "Nhóm", "Tên gọi", "Nó là gì (để vẽ lại)", "Dùng ở đâu", "Emoji dự phòng"])
    for x in cat: w.writerow([x["no"], ":ng_%s:" % x["id"], "assets/arcade/%s.png" % x["id"], x["group"], x["name"], x["meaning"], x["use"], x["fb"]])
md = ["# Emoji Pixel Art – Ngư Trường Giải Trí", "", "Tổng **%d** emoji, mỗi emoji là 1 file PNG 128×128 (nền trong suốt) trong `assets/arcade/`. Mã emoji trên Discord là `ng_<tên file>`; khi bạn vẽ lại, **giữ nguyên tên file** là bot tự dùng ảnh mới.\n" % len(cat),
      "Ảnh đánh số: `docs/arcade-emoji/sheet-01.png` … `sheet-%02d.png` (theo thứ tự số # dưới đây), tổng quan: `overview.png`, bảng CSV: `catalog.csv`.\n" % len(pages)]
for g, items in groups:
    md += ["## %s" % g, "", "| # | Mã emoji | File | Tên gọi | Nó là gì | Dùng ở đâu |", "|---|---|---|---|---|---|"]
    for x in items: md.append("| %d | `:ng_%s:` | `arcade/%s.png` | %s | %s | %s |" % (x["no"], x["id"], x["id"], x["name"], x["meaning"], x["use"]))
    md.append("")
open(os.path.join(root, "docs", "ARCADE-EMOJI.md"), "w", encoding="utf8").write("\n".join(md))
print("pages", len(pages), "emoji", len(cat))
