# 🎪 Ngư Trường Giải Trí – Tài liệu module

Module giải trí của Thiên Tông Fishing: 4 trò chơi nhỏ + Linh Điểm (điểm giải trí riêng) + bảng xếp hạng tuần/mùa + nhiệm vụ ngày + thành tích.
**Không đụng tới logic câu cá, ví xu, kho đồ, thú cưng** – module chỉ ghi vào các bảng `arcade_*` riêng.

## 1. Cài đặt / nâng cấp

Không cần làm gì thêm ngoài cập nhật mã nguồn rồi khởi động lại bot:

1. Chép đè mã nguồn mới (hoặc `git pull`), **giữ nguyên `.env` và thư mục `data/`/`backups/`**.
2. Khởi động bot. Tự động xảy ra:
   - **Migration 003** tạo các bảng `arcade_*` (bot tự sao lưu DB trước khi nâng cấp nếu đã có dữ liệu).
   - **Đăng ký lệnh** `/ngutruong` (autosetup so sánh hash lệnh → tự PUT lệnh mới).
   - **Tải 119 emoji pixel** `ng_*` lên làm Application Emoji (chạy nền, vài phút; trong lúc chờ bot dùng emoji Unicode dự phòng, mọi thứ vẫn chơi được).
3. Thủ công (nếu tắt `AUTO_SETUP=0`): `npm run deploy` rồi `npm run emojis`.
4. Lệnh tiền tố `.` cần Message Content Intent (xem README) – slash command không cần.

Rollback: quay lại bản cũ vẫn chạy được vì bảng `arcade_*` chỉ được thêm vào (bot cũ bỏ qua); riêng migration 3 đã ghi vào DB nên bot cũ sẽ báo "Database mới hơn bot" – khi đó khôi phục bản sao lưu trước nâng cấp bằng `/restore_db`.

## 2. Hướng dẫn từng lệnh

Mọi thứ mở từ **`/ngutruong`** (hoặc `.ngutruong`, `.nt`). Màn hình riêng tư (chỉ bạn thấy), có hàng nút điều hướng `Sảnh · Đua · Xúc xắc · Hộp · Đố`.

| Lệnh slash | Gõ tắt | Làm gì |
|---|---|---|
| `/ngutruong menu` | `.nt` | Sảnh: điểm hôm nay/trần, cấp bậc, tuần/mùa, lượt còn lại, nhiệm vụ chờ nhận |
| `/ngutruong dua` | `.dua` `.race` | **Đoán Ngư Vương** – chọn cá thắng cuộc đua |
| `/ngutruong taixiu` | `.taixiu` `.tx` | **Tài Xỉu Linh Vận** – đoán Tài/Xỉu/Bão |
| `/ngutruong bihop` | `.bihop` `.hop` | **Linh Bảo Bí Hộp** – mở hộp sưu tầm (có xem tỉ lệ, lịch sử) |
| `/ngutruong quiz` | `.quiz` | **Truy Tìm Linh Ngư** – 10 câu đố về cá |
| `/ngutruong xephang` | `.bxhgt` | Bảng xếp hạng: tuần · mùa (tháng) · mùa trước · tích luỹ |
| `/ngutruong nhiemvu` | `.nvgt` | Nhiệm vụ ngày + nút nhận thưởng |
| `/ngutruong thanhtich` | | 19 thành tích + danh hiệu |
| `/ngutruong suutam` | `.suutam` | Bộ sưu tập 30 Linh Bảo |
| `/ngutruong thongke` | | Thống kê từng trò, hồ sơ giải trí |
| `/ngutruong huongdan` | | Hướng dẫn trong game |

### 🏁 Đoán Ngư Vương
1. Bấm **Vào đường đua** → bot lấy 4–6 cá ngẫu nhiên từ dữ liệu cá của game. Mỗi cá có **Tốc độ / Thể lực / May mắn** (suy ra từ phẩm cấp, cân nặng và hệ số riêng của loài) và **1 đặc tính**: Nước Rút, Bền Bỉ, Khởi Đầu Nhanh, May Mắn, Ẩn Mình, Thất Thường. Có **ước tính xác suất thắng** (mô phỏng 400 lần).
2. Chọn cá ở menu, bấm **Xuất phát** (chọn xong là chốt; không chọn trong 3 phút thì huỷ, không mất lượt).
3. Đua 6 vòng, mỗi vòng ~2,4 s, tin nhắn tự cập nhật thanh tiến độ. Kết quả được máy chủ quyết định **lúc xuất phát** nên không thể can thiệp.
4. Điểm: đoán đúng **24** + thưởng "ngựa ô" (0–16, cá càng ít khả năng thắng càng nhiều) + chuỗi (+2/lần, tối đa +20); vào top 3 **6**; còn lại **2**. Tối đa 15 cuộc/ngày.

### 🎲 Tài Xỉu Linh Vận
3 xúc xắc. **3–10 = Xỉu**, **11–18 = Tài** (đúng 108/216 mỗi bên). **Bão** = 3 viên giống nhau (6/216). Bấm Xỉu/Tài/Bão → hoạt ảnh lăn 3 viên → kết quả, lịch sử 12 ván gần nhất.
Điểm: đúng **8** (+2 mỗi ván trong chuỗi, tối đa +10), sai **1**, Bão trúng **70**. 40 lượt/ngày, hồi chiêu 2,5 s. **Không có cược xu/vật phẩm ở bất kỳ đâu.**

### 🎁 Linh Bảo Bí Hộp
5 bậc hộp, **miễn phí**, mở khoá theo cấp bậc: Gỗ (Tập Sự) · Đồng (Ngư Khách) · Bạc (Ngư Sĩ) · Vàng (Ngư Tướng) · Thiên Tông (Ngư Vương). Giới hạn/ngày: 8 · 6 · 4 · 3 · 2.
Mỗi lần ra 1 trong **30 Linh Bảo** (6 phẩm: Thường → Thần Thoại) + Linh Điểm theo phẩm × hệ số hộp. Trùng quy đổi 50% điểm. Có **bảo hiểm may mắn** (hộp Đồng→Thiên Tông): đủ số lần liên tiếp không ra phẩm tốt thì lần sau chắc chắn ra. Nút **Tỉ lệ** hiện đầy đủ xác suất từng bậc. Hiệu ứng mở 3 khung: hộp rung → nứt sáng → lộ Linh Bảo.

### 🧠 Truy Tìm Linh Ngư
10 câu/vòng, 4 đáp án, sinh trực tiếp từ dữ liệu cá (khu vực, phẩm cấp, nhóm, giá/kg, độ khó, EXP, cân nặng tối đa, khung giờ). Độ khó tăng: câu 1–3 (⭐), 4–7 (⭐⭐), 8–10 (⭐⭐⭐). Thời gian mỗi câu 15 → 13 → 11 giây (đồng hồ chỉ chạy sau khi bấm **Bắt đầu**).
Điểm/câu đúng: 4 + 2×độ khó + thưởng nhanh (0–3) + chuỗi (+1/lần, tối đa +5). Cuối vòng: ≥80% đúng **+10**, 10/10 **+20**. 6 vòng/ngày.

### 💠 Linh Điểm, cấp bậc, xếp hạng
- Tối đa **500 LĐ/ngày** từ trò chơi (phần vượt bị cắt, hiển thị rõ). Thưởng **nhiệm vụ & thành tích không bị trần**.
- Cấp bậc theo điểm tích luỹ: Tập Sự 0 · Ngư Khách 300 · Ngư Sĩ 1.200 · Ngư Tướng 3.500 · Ngư Vương 9.000.
- Bảng **tuần** (thứ Hai→Chủ nhật), **mùa** (mỗi tháng, giữ lịch sử các mùa trước) và **tích luỹ**; chỉ tính điểm từ trò chơi đã qua trần ngày.
- **Nhiệm vụ ngày**: 3 nhiệm vụ ngẫu nhiên theo người + "Bốn Phương Tám Hướng" (chơi đủ 4 trò). Tiến độ tính theo ngày (múi giờ `TZ_OFFSET_HOURS`).

## 3. Thiết kế kỹ thuật

| Vấn đề | Cách xử lý |
|---|---|
| Không trả thưởng hai lần | Sổ cái `arcade_ledger` có `UNIQUE(user, game, ref)`; mọi lần cộng điểm đi qua `repo.award()` trong giao dịch. Cuộc đua/vòng đố chốt bằng `UPDATE … WHERE status='active'` (chỉ một lần). |
| Bấm đúp / spam | Router khoá theo người chơi + token-bucket; thêm hồi chiêu riêng từng trò; nút có chỉ số câu/phiên nên nút cũ bị bỏ qua; nút bị tắt khi đang hoạt ảnh. |
| Khởi động lại | Trạng thái phiên ở bảng `arcade_sessions` (index duy nhất 1 phiên đang chạy/người/trò). Hoạt ảnh **không giữ trạng thái**: mỗi khung tính từ DB + giờ máy chủ. Tác vụ nền `arcade.sweep()` (30 s) và lần tương tác kế tiếp tự chốt phiên quá hạn đúng một lần. |
| Công bằng/RNG | `crypto.randomInt` phía máy chủ; kết quả đua/xúc xắc/hộp sinh trước khi hiển thị. Tỉ lệ hộp công khai trong UI. |
| Không đụng kinh tế | Không import ví/kho/cá/thú; test hồi quy kiểm tra xu, kho, EXP không đổi. |
| Phân quyền | Mọi nút là `v|<userId>|…` – người khác bấm bị từ chối; dữ liệu đầu vào được kiểm tra (số nguyên, phạm vi, tập giá trị). Lệnh quản trị cũ không đổi. |
| Sao lưu | Bảng `arcade_*` nằm cùng file SQLite nên tự có trong `/backupdb`, auto-backup, `/restore_db`. |

Bảng: `arcade_player` (thống kê JSON) · `arcade_points` (all/ngày/tuần/mùa) · `arcade_ledger` · `arcade_sessions` · `arcade_history` · `arcade_items` · `arcade_counter` · `arcade_ach`.

## 4. Danh sách file

**Thêm mới**
- `data/arcade.json` (cấu hình & nội dung), `data/arcade-emoji.json` (catalog emoji)
- `src/database/migrations/003_arcade.js`, `src/database/repositories/arcade.js`
- `src/systems/arcade/{race,dice,box,quiz}.js` (logic thuần), `src/services/arcadeService.js`
- `src/ui/arcadeUI.js`, `src/interactions/views/arcade.js`, `src/commands/arcade/index.js`
- `scripts/pixel/arcade.js`, `scripts/pixel/arcade-catalog.js`, `scripts/generate-arcade-art.js`, `scripts/arcade_sheets.py`
- `assets/arcade/*.png` (119 emoji 128×128), `docs/ARCADE.md`, `docs/ARCADE-EMOJI.md`, `docs/arcade-emoji/*` (bảng đánh số, CSV)
- `tests/arcade.test.js` (40 kiểm thử)

**Sửa nhỏ**
- `src/services/gameData.js` (nạp + kiểm tra `arcade.json`) · `src/services/scheduler.js` (sweep 30 s, dọn dẹp)
- `src/interactions/registry.js` (đăng ký 7 view) · `src/interactions/router.js` (móc `afterShow` cho hoạt ảnh – 3 dòng)
- `src/prefix.js` (bí danh `.nt`, lối tắt `.dua .taixiu .bihop .quiz …`) · `src/ui/emoji.js` (loại `arcade`)
- `src/interactions/views/profile.js` (trang trợ giúp) · `scripts/generate-pixel-art.js` (tiền tố manifest `ng`) · `assets/manifest.json` · `README.md`

**Không sửa:** `fishingService`, `economyService`, `petService`, `shopService`, `marketService`, `bossService`, mọi bảng cũ.

## 5. Vẽ lại emoji
Xem `docs/ARCADE-EMOJI.md` (bảng STT · mã `:ng_xxx:` · file · ý nghĩa · nơi dùng) và ảnh đánh số `docs/arcade-emoji/sheet-01…08.png`. Thay file PNG cùng tên (128×128, nền trong suốt) trong `assets/arcade/` rồi khởi động lại: bot nhận ra hash manifest đổi và tải lại emoji. (Emoji đã tải trên Discord cùng tên sẽ được giữ nguyên; muốn thay ảnh trên Discord hãy xoá emoji cũ trong Developer Portal → Emojis trước.)

### Nguồn ảnh emoji hiện tại
49/119 emoji (#1–#15 chung/cấp bậc, #16–#30 đua cá, #32–#39 tài xỉu ngoại trừ 6 mặt xúc xắc, #45–#55 các hộp, #58 tia sáng, #59 bảo hiểm) lấy từ bảng ảnh do bạn gửi (`assets-source/sheet3.png`, cắt bằng `scripts/import-sheet3.py`). Còn lại giữ bản vẽ bằng code vì: mặt xúc xắc trong ảnh vẽ sai số chấm; một số ô (khoá/nứt hộp) vẽ sai nội dung; các trang có Linh Bảo, phẩm, đố và giao diện trong ảnh quá nhỏ (~40px) hoặc không có. Bản gốc lưu ở `assets-source/arcade-original/` (`python3 scripts/import-sheet3.py --restore` để quay lại). Gửi thêm bảng lớn hơn của các trang 5–8 thì thay nốt được.

## 6. Giới hạn đã biết
- Chưa kiểm thử với Discord thật (môi trường phát triển không có token); giao diện được kiểm bằng bộ giả lập kiểm tra giới hạn payload của Discord (≤5 hàng, ≤25 thành phần, độ dài custom_id/embed…).
- Hoạt ảnh dùng sửa tin nhắn tương tác (hiệu lực 15 phút); quá hạn thì bấm **Làm mới**/mở lại lệnh – trạng thái vẫn đúng.
- Màn hình là riêng tư (ephemeral) nên không có "khán giả" trong kênh; nếu muốn công khai chỉ cần đổi cờ `flags` trong `src/commands/arcade/index.js`.
