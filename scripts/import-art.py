#!/usr/bin/env python3
"""Cắt 3 ảnh sprite sheet do chủ dự án cung cấp (assets-source/rods.png, items.png, ui.png)
thành từng PNG 128x128 nền trong suốt → assets/rods, assets/items, assets/ui.

Chạy: python3 scripts/import-art.py        (cần Pillow, numpy, scipy – chỉ cần khi nhập lại ảnh nguồn)
Thứ tự ô trong ảnh được ánh xạ bằng scripts/art-map.json (có thể chỉnh tay nếu muốn đổi vị trí cần câu).
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-source")
OUT = os.path.join(ROOT, "assets")
SIZE = 128
MARGIN = 4


def load_map():
    with open(os.path.join(ROOT, "scripts", "art-map.json"), encoding="utf-8") as f:
        return json.load(f)


def find_sprites(rgb, bg, rows, cols, dil_it=7):
    """Trả về danh sách (mask_nhóm, bbox) theo thứ tự đọc (trái→phải, trên→dưới)."""
    d = np.sqrt(((rgb - bg) ** 2).sum(2))
    obj = d > 38
    dil = ndi.binary_dilation(obj, iterations=dil_it)
    lab, n = ndi.label(dil)
    h, w = obj.shape
    expected = rows * cols
    areas = ndi.sum(obj, lab, index=range(1, n + 1))
    order = np.argsort(areas)[::-1]
    big = [int(i) + 1 for i in order[:expected] if areas[i] > 150]
    if len(big) < expected:
        raise SystemExit(f"Chỉ tìm được {len(big)}/{expected} sprite – kiểm tra lại ảnh nguồn")
    cents = {i: ndi.center_of_mass(obj, lab, i) for i in big}
    # gom các mảnh nhỏ (tia sáng, lấp lánh) vào sprite lớn gần nhất
    group = {i: [i] for i in big}
    for i in range(1, n + 1):
        if i in big or areas[i - 1] < 3:
            continue
        cy, cx = ndi.center_of_mass(obj, lab, i)
        j = min(big, key=lambda k: (cents[k][0] - cy) ** 2 + (cents[k][1] - cx) ** 2)
        if ((cents[j][0] - cy) ** 2 + (cents[j][1] - cx) ** 2) ** 0.5 < 0.45 * max(h / rows, w / cols):
            group[j].append(i)
    # sắp xếp theo hàng/cột
    items = sorted(big, key=lambda k: cents[k][0])
    rowsets = [sorted(items[r * cols:(r + 1) * cols], key=lambda k: cents[k][1]) for r in range(rows)]
    # hàng cuối có thể thiếu ô
    ordered = [k for r in rowsets for k in r]
    res = []
    for k in ordered:
        m = np.isin(lab, group[k]) & dil
        ys, xs = np.where(m & obj)
        res.append((m, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
    return res


def find_sprites_cells(rgb, bg, row_cols, dil_it=2):
    """Gán mảnh liên thông vào ô lưới theo tâm của nó (dùng khi các icon nằm sát nhau / hàng cuối ít ô hơn)."""
    d = np.sqrt(((rgb - bg) ** 2).sum(2))
    obj = d > 38
    dil = ndi.binary_dilation(obj, iterations=dil_it)
    lab, n = ndi.label(dil)
    h, w = obj.shape
    nrows = len(row_cols)
    cells = {}
    for i in range(1, n + 1):
        ys, xs = np.where((lab == i) & obj)
        if len(xs) < 4:
            continue
        cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
        r = min(nrows - 1, int(cy / (h / nrows)))
        c = min(row_cols[r] - 1, int(cx / (w / row_cols[r])))
        cells.setdefault((r, c), []).append(i)
    res = []
    for r, nc in enumerate(row_cols):
        for c in range(nc):
            ids = cells.get((r, c))
            if not ids:
                raise SystemExit(f"Ô ({r},{c}) trống")
            m = np.isin(lab, ids)
            ys, xs = np.where(m & obj)
            res.append((m, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
    return res


UI_ROW_EDGES = [0, 219, 432, 635, 830, 1024]
UI_COL_EDGES = [[0, 288, 540, 788, 1033, 1278, 1536]] * 4 + [[0, 296, 567, 845, 1145, 1536]]


def find_sprites_edges(rgb, bg, row_edges, col_edges):
    """Cắt theo ô chữ nhật đã đo tay – dùng khi các icon bị nối nhau bởi vùng sáng mờ."""
    d = np.sqrt(((rgb - bg) ** 2).sum(2))
    obj = d > 38
    res = []
    for r in range(len(row_edges) - 1):
        for c in range(len(col_edges[r]) - 1):
            y0, y1, x0, x1 = row_edges[r], row_edges[r + 1], col_edges[r][c], col_edges[r][c + 1]
            cell = np.zeros_like(obj)
            cell[y0:y1, x0:x1] = obj[y0:y1, x0:x1]
            ys, xs = np.where(cell)
            if len(xs) < 50:
                raise SystemExit(f"Ô ({r},{c}) trống")
            m = ndi.binary_dilation(cell, iterations=3)
            m[:y0] = False; m[y1:] = False; m[:, :x0] = False; m[:, x1:] = False
            res.append((m, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
    return res


def make_tile(rgb, bg, m, bbox, scale):
    x0, y0, x1, y1 = bbox
    pad = 6
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(rgb.shape[1], x1 + pad), min(rgb.shape[0], y1 + pad)
    crop = rgb[y0:y1, x0:x1]
    msk = m[y0:y1, x0:x1]
    d = np.sqrt(((crop - bg) ** 2).sum(2))
    alpha = np.clip((d - 22) / 18.0, 0, 1)  # 22→0, 40→1: mép mềm, viền đen (d≈47) giữ nguyên đặc
    alpha[~msk] = 0
    rgba = np.dstack([crop, alpha * 255]).astype(np.float32)
    # premultiply để resize không bị viền tối
    pm = rgba.copy()
    pm[..., :3] *= pm[..., 3:4] / 255.0
    h, w = pm.shape[:2]
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    chans = [Image.fromarray(pm[..., i]).resize((nw, nh), Image.LANCZOS) for i in range(4)]
    out = np.dstack([np.array(c) for c in chans])
    a = out[..., 3:4]
    out[..., :3] = np.where(a > 0, out[..., :3] * 255.0 / np.maximum(a, 1), 0)
    out = np.clip(out, 0, 255).astype(np.uint8)
    # tối thiểu hoá nửa trong suốt rải rác để giữ cảm giác pixel art
    out[..., 3] = np.where(out[..., 3] < 24, 0, np.where(out[..., 3] > 232, 255, out[..., 3]))
    # bỏ các mảnh vụn <5px (phần rìa của ô bên cạnh)
    lab, n = ndi.label(out[..., 3] > 0, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndi.sum(out[..., 3] > 0, lab, index=range(1, n + 1))
        for i, sz in enumerate(sizes, 1):
            if sz < 5:
                out[lab == i, 3] = 0
    tile = Image.fromarray(out, "RGBA")
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(tile, ((SIZE - nw) // 2, (SIZE - nh) // 2), tile)
    return canvas


def process(sheet, rows, cols, names, outdir, uniform_scale=True, dil_it=7, row_cols=None):
    img = Image.open(os.path.join(SRC, f"{sheet}.png")).convert("RGB")
    rgb = np.array(img).astype(np.float32)
    bg = np.median(rgb.reshape(-1, 3), axis=0)
    sprites = find_sprites_edges(rgb, bg, UI_ROW_EDGES, UI_COL_EDGES) if row_cols else find_sprites(rgb, bg, rows, cols, dil_it)
    if len(sprites) < len(names):
        raise SystemExit(f"{sheet}: {len(sprites)} sprite < {len(names)} tên")
    maxdim = max(max(b[2] - b[0], b[3] - b[1]) + 12 for _, b in sprites)
    base = (SIZE - 2 * MARGIN) / maxdim
    os.makedirs(os.path.join(OUT, outdir), exist_ok=True)
    for (m, bbox), name in zip(sprites, names):
        if uniform_scale:
            scale = base
        else:
            scale = (SIZE - 2 * MARGIN) / (max(bbox[2] - bbox[0], bbox[3] - bbox[1]) + 12)
        make_tile(rgb, bg, m, bbox, scale).save(os.path.join(OUT, outdir, f"{name}.png"))
    print(f"✔ {sheet}: {len(names)} ảnh → assets/{outdir}")


def main():
    mp = load_map()
    rod_ids = mp["rods"]["order_in_sheet"]  # rod id theo thứ tự đọc trong ảnh
    process("rods", 4, 5, rod_ids, "rods", uniform_scale=True)
    process("items", 7, 10, mp["items"]["order_in_sheet"], "items", uniform_scale=True, dil_it=3)
    process("ui", 5, 6, mp["ui"]["order_in_sheet"], "ui", uniform_scale=True, dil_it=6, row_cols=[6, 6, 6, 6, 5])


if __name__ == "__main__":
    main()
