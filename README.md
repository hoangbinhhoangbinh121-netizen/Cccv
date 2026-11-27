# 🎣 Thiên Tông Fishing Bot

Bot Discord **câu cá Pixel Art RPG** chạy độc lập: Node.js + discord.js v14 + SQLite. Toàn bộ trò chơi vận hành bằng Embed, Button, Select Menu và Modal — không cần bot ngoài.

| | |
|---|---|
| Phẩm cấp | 9 (Phổ Thông → Độc Nhất) |
| Cá | 100 loài (88 thường · 8 boss · 4 sự kiện) × 5 biến thể (Thường, Khổng Lồ, Bạch Tạng, Ánh Kim, Cầu Vồng) |
| Cần câu | 20 mẫu, 10 bậc (Gỗ → Thần Cấp); nâng cấp · cường hoá +15 · khảm ngọc · thức tỉnh · nội tại · chế tạo · phân giải · đổi skin |
| Khu vực | 8 (Ao Làng → Hải Vực Cổ Đại), mỗi nơi có thời tiết, giờ trong ngày, tài nguyên, boss riêng |
| Khác | 12 thú cưng (2 giai đoạn) · 8 boss + tổ đội · 9 mẫu sự kiện · nhiệm vụ ngày/tuần/chuỗi · thành tựu + danh hiệu · chợ người chơi · 8 bảng xếp hạng |
| Hình ảnh | 282 ảnh Pixel Art 128×128 PNG nền trong suốt (xem `docs/preview/`) |
| Quản trị ngay trên Discord | `/fishing-admin` · `/fishing-event` · `/fishing-config` · `/fishing-backup` · **`/backupdb`** · **`/restore_db`** |

---

## 1. Cài đặt nhanh

Yêu cầu: **Node.js ≥ 20** (khuyến nghị 22 LTS). Với `better-sqlite3` trên Linux/macOS/Windows có sẵn bản dựng sẵn; nếu máy không biên dịch được, bot tự dùng `node:sqlite` (Node ≥ 22.5).

```bash
# 1) Tạo bot tại https://discord.com/developers/applications
#    Bot → Reset Token (lấy DISCORD_TOKEN); General Information → Application ID (CLIENT_ID)
#    OAuth2 → URL Generator: scope  bot + applications.commands ; quyền: Send Messages, Embed Links, Attach Files, Use External Emojis
# 2) Cấu hình
cp .env.example .env        # điền DISCORD_TOKEN, CLIENT_ID, (GUILD_ID), OWNER_IDS
npm install
npm run validate            # kiểm tra 282 ảnh + manifest
npm run deploy              # đăng ký slash command (có GUILD_ID → hiệu lực ngay)
npm run emojis              # (khuyên dùng) tải Pixel Art lên làm emoji của bot (Application Emoji)
npm start
```

Lần đầu `npm start` sẽ tự tạo `data/fishing.sqlite`, chạy migration và nạp dữ liệu từ `data/*.json`.
Người chơi **tự đăng ký** ở lần dùng lệnh đầu tiên (tặng 500 xu, cần Gỗ, 20 mồi giun).

**Biến môi trường chính** (`.env.example` có giải thích đầy đủ):

| Biến | Ý nghĩa |
|---|---|
| `OWNER_IDS` | ID Discord của chủ bot (phân tách bằng dấu phẩy). **Chỉ chủ bot** dùng được `/restore_db`, `/fishing-restore`, `reset-user`, `upload-emojis`. Để trống = các lệnh nhạy cảm bị khoá. |
| `ADMIN_ROLE_ID` | Role quản trị game (dùng `/fishing-admin`, `/backupdb`…). Người có quyền *Administrator* của server cũng dùng được. |
| `ANNOUNCE_CHANNEL_ID` | Kênh nhận thông báo boss/sự kiện/cá cực hiếm. |
| `BACKUP_*` | Chu kỳ và chính sách giữ backup (đổi được ngay trên Discord bằng `/fishing-config`). |

> **Ảnh & emoji.** Bot luôn hiển thị được ảnh (đính kèm vào embed). `npm run emojis` thêm bước tải 282 ảnh lên làm *Application Emoji* để icon cá/cần/vật phẩm hiện ngay trong chữ (cần discord.js ≥ 14.17). Chưa tải thì dùng emoji Unicode dự phòng.

---

## 2. Cách chơi (tóm tắt)

1. `/cauca` – thả câu. Đợi nút **GIẬT CẦN** hiện ra (không giật sớm!), rồi bấm trong thời gian cho phép.
2. Cá mắc câu → **mini-game kéo cá** theo lượt: mỗi lượt cá làm một chiêu
   *Lao đi → **Thả dây*** · *Vùng vẫy → **Giữ*** · *Mệt lả → **Kéo***. Đúng thì cá mất sức; sai thì dây căng, căng 100% là **đứt dây**. Chỉ số Chống thoát (Resist) có cơ hội cứu dây.
3. Cá bắt được vào kho cá: **Bán** (`/ban_ca`, `/khoca`), **Khoá** 🔒, **đăng chợ**, hoặc giữ làm sưu tầm (`/codex`).
4. Lên cấp → mở khu vực (`/khuvuc`) và cần mạnh hơn (`/cuahang`, `/chetao`, `/nangcap`, `/cuonghoa`, `/khamda`, `/thuctinh`).
5. Boss: `/boss` xem, `/toidau` đánh (lập tổ đội để cộng sát thương). Sự kiện: `/sukien`. Hằng ngày: `/daily`, `/nhiemvu`, `/thanh_tuu`.

### Lệnh tiền tố `.` (lười gõ `/`)
Gõ ngay trong kênh: `.cauca`, `.kho`, `.cuahang`, `.thongtin`… hoặc bí danh ngắn (`.c`, `.tt`, `.dd`, `.nv`, `.bxh`…). Gõ **`.lenh`** để xem tất cả.
* Tham số đọc theo đúng khai báo của lệnh `/` tương ứng: `.cauca ao lang` (tự khớp tên khu vực), `.giaodich @bạn 1k` (hỗ trợ `1k`, `2.5m`, `1.000.000`), `.fishing-backup tao …`. Giá trị có dấu cách đặt trong "ngoặc kép".
* Dùng chung bộ giới hạn tốc độ, khoá theo người chơi và kiểm tra quyền với lệnh `/` — admin/chủ bot vẫn phải đúng quyền.
* Lệnh `.` trả lời ở kênh công khai (tin nhắn thường); lệnh `/` thì tin trả lời chỉ mình bạn thấy.
* **Cần bật quyền đọc tin nhắn:** Developer Portal → ứng dụng → **Bot** → *Privileged Gateway Intents* → bật **Message Content Intent** → Save, rồi khởi động lại bot. Chưa bật thì bot vẫn chạy bình thường (chỉ ghi cảnh báo) nhưng không đọc được lệnh `.`; lệnh `/` không bị ảnh hưởng.
* Đổi tiền tố: `PREFIX=!` trong `.env`; tắt hẳn: `PREFIX_ENABLED=0`. Bot cần quyền *View Channel*, *Send Messages*, *Embed Links*, *Attach Files* trong kênh.

### Danh sách lệnh

| Nhóm | Lệnh |
|---|---|
| Câu cá | `/cauca` `/khuvuc` `/codex` `/sukien` |
| Người chơi | `/thongtin` `/daily` `/nhiemvu` `/thanh_tuu` `/bangxephang` `/huongdan` |
| Cần câu | `/cancau` `/nangcap` `/cuonghoa` `/khamda` `/thuctinh` `/chetao` |
| Kho | `/kho` `/khoca` `/ban_ca` `/sudung` |
| Kinh tế | `/cuahang` `/giaodich` · chợ: `/thitruong` `/muamoi` |
| Thú cưng & Boss | `/thucung` `/boss` `/toidau` |
| Quản trị | `/fishing-admin` `/fishing-event` `/fishing-config` `/fishing-backup` `/fishing-restore` **`/backupdb`** **`/restore_db`** |

---

## 🎪 Ngư Trường Giải Trí (module mới)
`/ngutruong` (hoặc `.nt`): Đoán Ngư Vương (đua cá), Tài Xỉu Linh Vận, Linh Bảo Bí Hộp, Truy Tìm Linh Ngư + Linh Điểm riêng, xếp hạng tuần/mùa, nhiệm vụ ngày, thành tích. **Không cược xu/vật phẩm.** Chi tiết: [docs/ARCADE.md](docs/ARCADE.md) · emoji pixel: [docs/ARCADE-EMOJI.md](docs/ARCADE-EMOJI.md).

## 3. Quản trị, sao lưu & khôi phục ngay trên Discord

Lệnh quản trị mặc định **ẩn với người thường**, và được kiểm tra quyền lại trong mã (không chỉ dựa vào Discord).

### Sao lưu
* **Tự động**: mặc định mỗi 60 phút (bỏ qua nếu dữ liệu không đổi). Dùng `VACUUM INTO` nên bản chụp **nhất quán** ngay cả khi bot đang chạy; nén gzip + ghi SHA-256 vào `backups/index.json`.
* **Tự xoá bản cũ** (không đầy ổ đĩa): giữ `backup_keep_auto` bản tự động mới nhất **+ 1 bản/ngày** trong `backup_max_age_days` ngày, `backup_keep_manual` bản thủ công, và luôn giữ dưới `backup_max_total_mb` MB. Bản **📌 ghim**, bản trước-khôi-phục và bản mới nhất không bị xoá. Chạy mỗi lần tạo backup; hoặc `/fishing-backup don-dep xemtruoc:true` để xem trước.
* Ngoài ra bot tự backup **trước mỗi lần nâng cấp schema** và **khi tắt bot** (SIGINT/SIGTERM).
* `/backupdb [ghichu] [taive]` – sao lưu ngay (kèm tệp tải về nếu ≤ 24 MB).
* `/fishing-backup` – `tao` · `danh-sach` (bảng điều khiển: chọn/kiểm tra/ghim/xoá/khôi phục) · `tai-ve` · `xoa` · `ghim` · `don-dep` · `trang-thai`.

### Khôi phục (chỉ chủ bot – `OWNER_IDS`)
`/restore_db [ten] [tep]` (hoặc `/fishing-restore`): chọn bản trong máy chủ (mặc định **mới nhất**) hoặc **tải lên** tệp `.sqlite`/`.sqlite.gz`.
1. Bot **kiểm tra** tệp: gzip hợp lệ, `PRAGMA integrity_check`, schema không mới hơn bot, checksum (nếu có), số người chơi.
2. Hiện báo cáo & nút **Khôi phục**; bấm → phải **gõ `KHOI PHUC`** vào biểu mẫu.
3. Bot tạm dừng nhận lệnh, **tự tạo bản `prerestore`**, thay DB, chạy migration, huỷ & hoàn mồi các phiên câu đang dở. **Lỗi giữa chừng → tự hoàn tác** về bản trước.

### Các lệnh quản trị khác
`/fishing-admin`: `give-xu` `give-item` `give-rod` `give-fish` `set-level` `ban` `unban` `reset-user` `user-info` `unstick` `boss-spawn` `weather-set` `announce` `stats` `audit-log` `transactions` `integrity-check` `maintenance` `reload-data` `upload-emojis`.
`/fishing-event`: `tao` `danh-sach` `xem` `ket-thuc` `huy`. `/fishing-config`: `xem` `dat` (tỷ lệ phí chợ, backup, giới hạn…). Mọi thao tác ghi vào `admin_log` (`/fishing-admin audit-log`).

---

## 4. Kiến trúc

```
src/
  index.js  bot.js            khởi động, client Discord, thông báo sự kiện
  config/                     .env + giá trị mặc định (ghi đè bằng /fishing-config)
  database/                   connection (better-sqlite3 | node:sqlite), migrate, backup, repositories/
  systems/                    luật thuần (không I/O): rarity, rods, fish, minigame, weather, events, progression
  services/                   nghiệp vụ có giao dịch: fishing, rod, shop, market, pet, boss, event, admin, scheduler…
  ui/                         kit (Embed/Button/Select/Modal), emoji, fishingUI (phiên câu + hẹn giờ làm mới)
  interactions/               router (slash/nút/menu/modal), views/* (mỗi màn hình = render + act + modal)
  commands/<nhóm>/            định nghĩa slash command
data/*.json                   dữ liệu game (cá, cần, khu vực, thú, boss, nhiệm vụ…) – sửa rồi /fishing-admin reload-data
assets/**                     Pixel Art 128×128 + manifest.json
scripts/                      deploy-commands, upload-emojis, validate-assets, generate-*, test
tests/                        84 kiểm thử tự động + REPORT.md
```

**Chống nhân bản / race condition**
* Mọi thay đổi dữ liệu đi qua `db.tx()` (`BEGIN IMMEDIATE`, lồng bằng SAVEPOINT) trong một tiến trình đồng bộ → không có xen kẽ.
* Xu: `CHECK(balance>=0)` + sổ cái `transactions` (khoá idempotency `UNIQUE`) + `/fishing-admin integrity-check` đối soát số dư = tổng giao dịch.
* Vật phẩm: trừ bằng `UPDATE … WHERE qty>=?`; cá/cần dùng cờ `listed`/`locked`.
* Chợ: hàng được **ký quỹ** (rời kho khi đăng); mua = chiếm tin bằng `UPDATE … WHERE status='active'` nên chỉ 1 người thắng; phí chợ tính khi bán.
* Phiên câu: index duy nhất "1 phiên đang chạy/người"; mỗi nút mang `nonce` nên nút cũ/của người khác bị từ chối; trạng thái tính theo **giờ máy chủ** (hẹn giờ chỉ để làm mới giao diện) nên khởi động lại bot không mất/nhân thưởng.
* Giới hạn tốc độ (token bucket) + khoá bất đồng bộ theo người chơi cho mọi tương tác.

### Cơ sở dữ liệu
`users, user_stats, currencies, transactions, inventory, fish_catalog, fish_instances, rod_catalog, rod_instances, equipment, baits, locations, user_locations, user_skins, fishing_sessions, fishing_history, pets, pet_instances, missions, achievements, user_titles, codex, market_listings, events, event_scores, boss_instances, boss_contributions, boss_party_members, leaderboards, cooldowns, buffs, settings, admin_log, backup_log, schema_migrations` — tạo bằng `src/database/migrations/` (có checksum, tự backup trước khi nâng cấp).

---

## 5. Kiểm thử

```bash
npm test            # 84 kiểm thử, ghi tests/REPORT.md
node scripts/test.js "chợ"   # chạy lọc theo từ khoá
npm run validate    # tài nguyên ảnh
```
Xem **`docs/TEST-REPORT.md`** (kết quả + phạm vi + những gì CHƯA được kiểm chứng với Discord thật).

## 6. Triển khai / hosting
Xem **`docs/DEPLOY.md`** (VPS + systemd, PM2, Docker, Pterodactyl/Railway, bảo mật, cập nhật, khôi phục sự cố).

## 7. Tuỳ biến
* Cân bằng & nội dung: sửa `data/*.json` (hoặc `scripts/generate-data.js` rồi `npm run generate:data`) → `/fishing-admin reload-data`.
* Đổi ảnh: thay PNG 128×128 trong `assets/`, chạy `npm run validate`, rồi `npm run emojis`. Nguồn ảnh gốc: `assets-source/rods.png|items.png|ui.png` (cần, vật phẩm, UI → `python3 scripts/import-art.py`) và `assets-source/sheet2.png` (mồi, thú cưng, khu vực, hiệu ứng, khung phẩm cấp → `python3 scripts/import-sheet2.py`). `npm run generate:art` chỉ vẽ lại cá và tự bỏ qua phần đã nhập từ ảnh.
