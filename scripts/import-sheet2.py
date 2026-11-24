#!/usr/bin/env python3
"""Cắt bảng ảnh tổng hợp assets-source/sheet2.png (hiệu ứng, khung phẩm cấp, khu vực, thú cưng, mồi)
thành PNG 128x128 nền trong suốt → assets/effects, locations, pets, baits.
Ánh xạ tên trong ảnh → tên tệp của bot nằm ở NAME_MAP bên dưới.
Chạy: python3 scripts/import-sheet2.py [--preview thư_mục]   (cần Pillow, numpy, scipy)"""
import colorsys, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-source", "sheet2.png")
OUT = os.path.join(ROOT, "assets")
SIZE = 128
BG = np.array([2, 22, 49], dtype=np.float32)

img = Image.open(SRC).convert("RGB")
RGB = np.array(img).astype(np.float32)
DIST = np.sqrt(((RGB - BG) ** 2).sum(2))


def rgba_of(x0, y0, x1, y1, fill_holes=False):
    """Tách nền xanh đen → ảnh RGBA float (alpha 0..1, màu đã gỡ nền)."""
    crop = RGB[y0:y1, x0:x1]
    d = DIST[y0:y1, x0:x1]
    a = np.clip((d - 20) / 40.0, 0, 1)
    if fill_holes:
        solid = ndi.binary_closing(d > 45, iterations=2)
        solid = ndi.binary_fill_holes(solid)
        a = np.where(solid, 1.0, a)
    col = BG + (crop - BG) / np.maximum(a, 0.08)[..., None]
    col = np.clip(col, 0, 255)
    col[a < 0.02] = 0
    a = np.where(a < 0.06, 0, a)
    # bỏ mảnh vụn
    lab, n = ndi.label(a > 0, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndi.sum(a > 0, lab, index=range(1, n + 1))
        for i, s in enumerate(sizes, 1):
            if s < 6:
                a[lab == i] = 0
    return np.dstack([col, a])


def bbox(t):
    ys, xs = np.where(t[..., 3] > 0.12)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def resize(t, nw, nh):
    pm = t.copy()
    pm[..., :3] *= pm[..., 3:4]
    chans = [Image.fromarray(pm[..., i].astype(np.float32), "F").resize((nw, nh), Image.LANCZOS) for i in range(4)]
    o = np.dstack([np.array(c) for c in chans])
    a = np.clip(o[..., 3:4], 0, 1)
    o[..., :3] = np.where(a > 0.01, o[..., :3] / np.maximum(a, 0.01), 0)
    o[..., 3:4] = a
    return o


def to_tile(t, scale=None, stretch=None, ypad=0):
    x0, y0, x1, y1 = bbox(t)
    t = t[y0:y1, x0:x1]
    h, w = t.shape[:2]
    if stretch:
        nw, nh = stretch
    else:
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    o = resize(t, nw, nh)
    o = np.clip(o, 0, 1 if False else 255)
    a = np.clip(o[..., 3], 0, 1)
    a = np.where(a < 0.08, 0, np.where(a > 0.92, 1, a))
    rgba = np.dstack([np.clip(o[..., :3], 0, 255), a * 255]).astype(np.uint8)
    tile = Image.fromarray(rgba, "RGBA")
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(tile, ((SIZE - nw) // 2, (SIZE - nh) // 2 + ypad), tile)
    return canvas


def runs(mask1d, gap):
    idx = np.where(mask1d)[0]
    if len(idx) == 0:
        return []
    out, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p > gap:
            out.append((s, p + 1)); s = i
        p = i
    out.append((s, p + 1))
    return out


def columns(x0, x1, y0, y1, gap, expect, thr=45):
    m = (DIST[y0:y1, x0:x1] > thr).any(0)
    r = [(a + x0, b + x0) for a, b in runs(m, gap)]
    r = [(a, b) for a, b in r if b - a > 6]
    if len(r) != expect:
        raise SystemExit(f"Tìm được {len(r)} cột, cần {expect}: {r}")
    return r


def hue_shift(tile, dh=0.0, sat=1.0, val=1.0):
    a = np.array(tile).astype(np.float32)
    rgb = a[..., :3] / 255.0
    mx, mn = rgb.max(2), rgb.min(2)
    v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6.0
    h = (h + dh) % 1.0
    s = np.clip(s * sat, 0, 1); v = np.clip(v * val, 0, 1)
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    out = np.zeros_like(rgb)
    for k, (rr, gg, bb) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k
        out[..., 0][m], out[..., 1][m], out[..., 2][m] = rr[m], gg[m], bb[m]
    a[..., :3] = out * 255
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def save(tile, d, name):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
    tile.save(os.path.join(OUT, d, f"{name}.png"))


def main():
    # ---------------- hiệu ứng (ô đo tay: x0,y0,x1,y1; bỏ phần nhãn chữ) ----------------
    FX = {
        "bite": (30, 28, 150, 143), "bubbles": (185, 20, 280, 143), "confetti": (298, 18, 435, 143),
        "exp_orb": (445, 30, 556, 143), "flame": (578, 16, 692, 143),
        "levelup": (20, 180, 158, 276), "ripple": (165, 192, 326, 277), "shine": (350, 180, 487, 277),
        "sparkle": (498, 180, 622, 277), "splash": (652, 172, 818, 279),
    }
    tiles = {}
    for n, r in FX.items():
        tiles[n] = rgba_of(*r)
    mx = max(max(bbox(t)[2] - bbox(t)[0], bbox(t)[3] - bbox(t)[1]) for t in tiles.values())
    for n, t in tiles.items():
        save(to_tile(t, scale=(SIZE - 8) / mx), "effects", n)
    print("✔ hiệu ứng:", len(FX))

    # ---------------- khung phẩm cấp ----------------
    FR = {
        "common": (715, 15, 840, 124), "rare": (841, 15, 962, 124), "epic": (964, 15, 1076, 124),
        "legendary": (1077, 15, 1189, 124), "mythic": (1190, 10, 1295, 126),
        "divine": (826, 150, 966, 271), "transcendent": (1074, 150, 1212, 271),
    }
    fr = {n: to_tile(rgba_of(*r), stretch=(116, 116)) for n, r in FR.items()}
    # khung "unique" bị khung "transcendent" che mất nửa phải → dựng lại bằng cách lật nửa trái
    u = rgba_of(966, 150, 1073, 271)
    ux0, uy0, ux1, uy1 = bbox(u)
    u = u[uy0:uy1, ux0:ux1]
    half = u[:, : u.shape[1] // 2]
    u2 = np.concatenate([half, half[:, ::-1]], axis=1)
    fr["unique"] = to_tile(u2, stretch=(116, 116))
    NAME = {"common": "pho_thong", "rare": "hiem", "epic": "quy_hiem", "legendary": "su_thi", "mythic": "co_dai",
            "divine": "than_cap", "unique": "doc_nhat", "transcendent": "than_thoai"}
    for k, v in NAME.items():
        save(fr[k], "effects", f"khung_{v}")
    save(hue_shift(fr["mythic"], dh=-0.045, sat=1.15, val=1.0), "effects", "khung_huyen_thoai")
    print("✔ khung phẩm cấp: 9 (khung_huyen_thoai dựng từ 'mythic' đổi sang cam)")

    # ---------------- khu vực ----------------
    LOC = ["ao_lang", "bien_sau", "hai_vuc_co_dai", "ho_thanh_binh", "long_hai", "rung_nguyen_sinh", "song_bang", "vuc_tham"]
    cols = columns(14, 1298, 345, 495, 3, 8, thr=60)
    for (x0, x1), name in zip(cols, LOC):
        ys = np.where((DIST[338:500, x0:x1] > 30).mean(1) > 0.5)[0]
        y0, y1 = 338 + ys.min(), 338 + ys.max() + 1
        crop = img.crop((x0, y0, x1, y1))
        s = SIZE / (x1 - x0)
        nh = round((y1 - y0) * s)
        crop = crop.resize((SIZE, max(nh, SIZE)), Image.LANCZOS)
        top = max(0, int((crop.height - SIZE) * 0.35))
        save(crop.crop((0, top, SIZE, top + SIZE)).convert("RGBA"), "locations", name)
    print("✔ khu vực: 8")

    # ---------------- thú cưng ----------------
    P = ["cao_bien_cuu_vi", "cao_bien_nho", "hai_long_con", "hai_long_vuong", "huyen_vu_co_dai", "linh_dang_bien_sau",
         "linh_thu_vuc_tham", "meo_hoang_kim", "meo_muop_cau_ca", "rai_ca_ngoc", "rai_ca_song", "rua_da"]
    names = []
    for p in P:
        names += [f"thu_{p}", f"thu_{p}_tienhoa"]
    bands = [(555, 674), (694, 820), (840, 961)]
    pt = []
    for (y0, y1) in bands:
        for (x0, x1) in columns(14, 1298, y0, y1, 6, 8, thr=70):
            pt.append(rgba_of(max(14, x0 - 3), y0, min(1298, x1 + 3), y1, fill_holes=True))
    mx = max(max(bbox(t)[2] - bbox(t)[0], bbox(t)[3] - bbox(t)[1]) for t in pt)
    for t, n in zip(pt, names):
        save(to_tile(t, scale=(SIZE - 8) / mx), "pets", n)
    print("✔ thú cưng:", len(pt))

    # ---------------- mồi ----------------
    B = ["moi_bot_gao_thom", "moi_ca_moi_nho", "moi_gioi_bo", "moi_giun_dat", "moi_moi_bang_tinh", "moi_moi_gia_bac",
         "moi_moi_long_lan", "moi_moi_phat_quang", "moi_moi_re_co_thu", "moi_moi_thai_co", "moi_moi_than_cap", "moi_tom_nho"]
    bt = [rgba_of(max(14, x0 - 3), 1014, min(1298, x1 + 3), 1133, fill_holes=True) for x0, x1 in columns(14, 1298, 1014, 1133, 6, 12, thr=70)]
    mx = max(max(bbox(t)[2] - bbox(t)[0], bbox(t)[3] - bbox(t)[1]) for t in bt)
    for t, n in zip(bt, B):
        save(to_tile(t, scale=(SIZE - 12) / mx), "baits", n)
    print("✔ mồi:", len(bt))


if __name__ == "__main__":
    main()
