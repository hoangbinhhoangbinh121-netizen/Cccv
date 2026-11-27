#!/usr/bin/env python3
"""Cắt bảng emoji Ngư Trường do người dùng cung cấp (assets-source/sheet3.png, trang 1–4) → assets/arcade/*.png (128×128, nền trong suốt).
Bản vẽ gốc của bot được giữ ở assets-source/arcade-original/ (chạy với --restore để quay lại).
Trang 5–6 trong ảnh quá nhỏ (~40px) nên KHÔNG dùng; 6 mặt xúc xắc die_1…die_6 cũng KHÔNG dùng vì ảnh vẽ sai số chấm (game cần đúng số), box_crack/box_lock cũng giữ bản cũ vì ô tương ứng trong ảnh vẽ sai nội dung; các emoji không có trong ảnh giữ nguyên bản cũ.
Chạy: python3 scripts/import-sheet3.py [--preview thư_mục] [--restore]"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-source", "sheet3.png"); OUT = os.path.join(ROOT, "assets", "arcade"); ORIG = os.path.join(ROOT, "assets-source", "arcade-original")
cat = json.load(open(os.path.join(ROOT, "data", "arcade-emoji.json"), encoding="utf8")); ids = [x["id"] for x in cat]
if "--restore" in sys.argv:
    for f in os.listdir(ORIG): shutil.copy(os.path.join(ORIG, f), os.path.join(OUT, f))
    print("Đã khôi phục bản vẽ gốc"); sys.exit(0)
# (tâm x của 5 cột, tâm y của các hàng, danh sách id theo thứ tự đọc)
PANELS = [
    ([95, 247, 399, 548, 697], [85, 210, 328], ids[0:15]),
    ([848, 1005, 1160, 1310, 1460], [85, 210, 326], ids[15:30]),
    ([82, 242, 400, 548, 695], [476, 565, 652], ids[32:44]),
    ([850, 1003, 1160, 1313, 1460], [478, 567, 655], ids[44:55] + [None, 'box_spark', None, 'box_pity']),  # ô hàng cuối của ảnh bị đổi thứ tự/vẽ sai → chỉ lấy ô đúng
]
SKIP = {f"die_{n}" for n in range(1, 7)}
H = 50  # nửa cạnh vùng quét
img = Image.open(SRC).convert("RGB"); A = np.array(img).astype(np.float32)

def cut(cx, cy):
    x0, y0 = max(0, cx - H), max(0, cy - 46); box = A[y0:cy + 33, x0:cx + H]
    mx, mn = box.max(2), box.min(2); r, g, b = box[..., 0], box[..., 1], box[..., 2]
    bg = (mx < 128) & (b > r + 7) & (mx > 18)               # caro xanh tối của ô nền
    lab, n = ndi.label(bg); border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    back = np.isin(lab, list(border))
    alpha = (~back).astype(np.float32)
    alpha = ndi.binary_opening(alpha > 0, iterations=2).astype(np.float32)
    lab2, n2 = ndi.label(alpha > 0, structure=np.ones((3, 3)))   # giữ mảnh lớn nhất + mảnh gần nó (viền/nhãn rời bị bỏ)
    if n2 > 1:
        sizes = ndi.sum(alpha > 0, lab2, index=range(1, n2 + 1)); big = int(np.argmax(sizes)) + 1
        keep = lab2 == big; near = ndi.binary_dilation(keep, iterations=6)
        for i in range(1, n2 + 1):
            if i != big and sizes[i - 1] > 160 and (lab2 == i)[near].any(): keep |= lab2 == i
        alpha = keep.astype(np.float32)
    alpha = ndi.binary_fill_holes(alpha > 0).astype(np.float32)
    rgba = np.dstack([box, alpha * 255]).astype(np.uint8); ys, xs = np.where(alpha > 0)
    return Image.fromarray(rgba, "RGBA").crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

done = []
for xs, ys, lst in PANELS:
    for k, id_ in enumerate(lst):
        if id_ is None or id_ in SKIP: continue
        tile = cut(xs[k % 5], ys[k // 5]); s = 116 / max(tile.size); tile = tile.resize((max(1, round(tile.width * s)), max(1, round(tile.height * s))), Image.LANCZOS)
        out = Image.new("RGBA", (128, 128), (0, 0, 0, 0)); out.paste(tile, ((128 - tile.width) // 2, (128 - tile.height) // 2), tile); out.save(os.path.join(OUT, id_ + ".png")); done.append(id_)
print(f"Đã thay {len(done)}/{len(ids)} emoji bằng bản vẽ mới; giữ bản cũ: {len(ids) - len(done)}")
if "--preview" in sys.argv:
    d = sys.argv[sys.argv.index("--preview") + 1]; os.makedirs(d, exist_ok=True); W = 12
    sh = Image.new("RGBA", (W * 130, ((len(done) + W - 1) // W) * 262), (40, 56, 90, 255))
    for k, id_ in enumerate(done):
        for row, src in enumerate((ORIG, OUT)):
            t = Image.open(os.path.join(src, id_ + ".png")).convert("RGBA"); sh.paste(t, ((k % W) * 130 + 1, (k // W) * 262 + row * 130 + 1), t)
    sh.save(os.path.join(d, "compare.png"))
