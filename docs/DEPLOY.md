# Hướng dẫn triển khai (Hosting)

> **Quan trọng:** chỉ chạy **MỘT** tiến trình bot cho mỗi file database. Bot dùng SQLite đồng bộ trong một tiến trình để bảo đảm không nhân bản vật phẩm/xu; chạy hai bản cùng DB sẽ phá vỡ bảo đảm đó. Không bật sharding/cluster.

Cấu hình tối thiểu: 1 vCPU, 512 MB RAM, ~1 GB ổ đĩa (DB nhỏ; backup đã nén và tự xoá bản cũ). Đo thử: ~900 mẻ câu/giây trên một lõi.

## A. VPS Linux + systemd (khuyến nghị)

```bash
sudo apt update && sudo apt install -y curl unzip
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo useradd -r -m -d /opt/thien-tong-fishing fishing
sudo unzip THIEN-TONG-FISHING.zip -d /opt && sudo mv /opt/THIEN-TONG-FISHING/* /opt/thien-tong-fishing/ 
cd /opt/thien-tong-fishing && sudo cp .env.example .env && sudo nano .env      # điền token, CLIENT_ID, OWNER_IDS…
sudo chown -R fishing:fishing /opt/thien-tong-fishing && sudo chmod 600 .env
sudo -u fishing npm install --omit=dev
sudo -u fishing npm run validate && sudo -u fishing npm run deploy && sudo -u fishing npm run emojis
sudo cp deploy/thien-tong-fishing.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now thien-tong-fishing
journalctl -u thien-tong-fishing -f        # xem log
```
Khi `systemctl stop/restart`, bot nhận SIGTERM → huỷ phiên câu dang dở (hoàn mồi), **backup lần cuối**, đóng DB rồi thoát.

## B. PM2
```bash
npm i -g pm2 && npm install --omit=dev
pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
```

## C. Docker
```bash
cp .env.example .env && nano .env
docker compose build && docker compose run --rm fishing node scripts/deploy-commands.js
docker compose up -d && docker compose logs -f
```
`data/` và `backups/` được mount ra máy chủ — **luôn giữ hai thư mục này** khi nâng cấp.

## D. Panel dạng Pterodactyl / Railway / Render / Fly
* Lệnh khởi động: `npm install --omit=dev && node src/index.js` (egg Node.js ≥ 20).
* Biến môi trường đặt trong panel (không commit `.env`).
* **Phải gắn ổ đĩa bền (persistent volume)** cho `data/` và `backups/` (Railway/Render/Fly: Volume/Disk). Không có ổ bền = mất dữ liệu mỗi lần deploy.
* Chạy `npm run deploy` một lần (từ máy bạn hoặc console của panel) để đăng ký slash command.

## E. Sau khi chạy
1. Mời bot bằng link OAuth2 có scope `bot applications.commands`, quyền: *Send Messages, Embed Links, Attach Files, Use External Emojis*.
2. Đặt `OWNER_IDS` rồi thử `/backupdb` (quản trị) → phải thấy bản sao lưu; thử `/fishing-admin integrity-check`.
3. Đặt `ANNOUNCE_CHANNEL_ID` nếu muốn thông báo boss/sự kiện.
4. (Tuỳ chọn) `npm run emojis` để icon pixel hiện trong chữ.

## F. Bảo mật
* `.env` quyền `600`, không commit; nếu lộ token → Reset Token ngay.
* Chỉ bạn bè tin cậy mới nên có quyền *Administrator*/`ADMIN_ROLE_ID`. Lệnh khôi phục/xoá dữ liệu chỉ cho `OWNER_IDS`.
* Mọi thao tác quản trị đều ghi `admin_log`.
* Bản sao lưu chứa dữ liệu người chơi (tên hiển thị, ID Discord) — đừng đăng công khai.
* **Backup ngoài máy chủ:** `/fishing-backup tai-ve` hoặc đồng bộ thư mục `backups/` lên nơi khác (rclone/rsync/cron). Backup cùng ổ với DB không cứu được khi hỏng ổ.

## G. Cập nhật phiên bản
```bash
# 1) /backupdb (hoặc để bot tự backup khi tắt)
# 2) dừng bot → ghi đè mã nguồn (giữ nguyên data/, backups/, .env) → npm install --omit=dev
# 3) khởi động: bot tự backup (loại premigrate) rồi chạy migration mới; npm run deploy nếu có lệnh mới
```

## H. Sự cố thường gặp
| Triệu chứng | Cách xử lý |
|---|---|
| Lệnh không hiện | Chạy `npm run deploy`; kiểm tra `GUILD_ID`; lệnh global có thể trễ tới 1 giờ. |
| "Chưa cấu hình OWNER_IDS" khi `/restore_db` | Thêm ID Discord của bạn vào `OWNER_IDS`, khởi động lại. |
| Icon hiện ▫️/emoji Unicode | Chưa chạy `npm run emojis` (hoặc `/fishing-admin upload-emojis`). Ảnh đính kèm vẫn hiển thị. |
| `better-sqlite3` lỗi biên dịch | Cài `build-essential python3`, hoặc dùng Node ≥ 22.5 (tự dùng `node:sqlite`). |
| Người chơi kẹt "đang có phiên câu" | `/fishing-admin unstick nguoi:@user`. |
| Nghi ngờ lệch số liệu | `/fishing-admin integrity-check`. |
| Mất dữ liệu / hỏng DB | `/restore_db` (bản mới nhất) hoặc chép tay tệp giải nén từ `backups/` vào `data/fishing.sqlite` khi bot đang tắt. |

## Termux (Android) + GitHub

**Máy tính / nơi đang giữ code – đưa lên GitHub (một lần):**
```bash
cd THIEN-TONG-FISHING
git init -b main
git add .
git commit -m "Thiên Tông Fishing Bot v1.0"
git remote add origin https://github.com/<TÊN_BẠN>/<TÊN_REPO>.git
git push -u origin main        # mật khẩu = Personal Access Token (Settings → Developer settings → Tokens, quyền repo)
```
Các lần sau: `git add . && git commit -m "mô tả" && git push`. `.env`, `node_modules`, DB và backup đã nằm trong `.gitignore` nên không bị đẩy lên – **không bao giờ commit `.env`** (chứa token bot).

**Termux – kéo code về và chạy:**
```bash
pkg update && pkg upgrade -y
pkg install -y nodejs git          # cần Node >= 22.5 (kiểm tra: node -v)
git clone https://github.com/<TÊN_BẠN>/<TÊN_REPO>.git
cd <TÊN_REPO>
npm install                        # better-sqlite3 là tuỳ chọn; không build được trên Termux thì bot tự dùng node:sqlite
cp .env.example .env && nano .env  # điền DISCORD_TOKEN, CLIENT_ID, GUILD_ID, OWNER_IDS
npm run deploy && npm run emojis
termux-wake-lock                   # giữ máy không ngủ
npm start
```
Chạy nền: `pkg install tmux` rồi `tmux new -s bot`, chạy `npm start`, thoát bằng Ctrl+B rồi D (vào lại: `tmux attach -t bot`).

**Cập nhật bot trên Termux sau khi đã push bản mới:**
```bash
cd <TÊN_REPO> && git pull && npm install && npm run deploy && npm start
```
Nếu repo là **private**: dùng `git clone https://<TÊN_BẠN>:<TOKEN>@github.com/<TÊN_BẠN>/<TÊN_REPO>.git`, hoặc cài `pkg install gh` rồi `gh auth login`.
Dữ liệu người chơi (`data/`, `backups/`) chỉ nằm trên Termux và không bị `git pull` ghi đè; hãy dùng `/backupdb` định kỳ.

## Host không có terminal (VibeHost, Pterodactyl…)

1. Tab **GitHub**: liên kết repo và kéo (pull) code về `/home/container`. Hoặc tải ZIP lên tab **Files** rồi giải nén.
2. Tab **Startup**: đặt **Main file / JS file** = `src/index.js` (mặc định host chạy `index.js` ở thư mục gốc nên báo `Cannot find module '/home/container/index.js'`).
3. Bấm **Start** một lần: bot tự tạo file `.env` mẫu rồi dừng. Tab **Files**: mở file `.env` (xem `.env.example`) với `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `OWNER_IDS`. Nếu tab Startup có sẵn ô biến môi trường thì điền thẳng ở đó cũng được (biến host được ưu tiên hơn `.env`).
4. Bấm **Start**. Host tự `npm install`. Lần chạy đầu bot **tự đăng ký lệnh slash và tự tải emoji** (`AUTO_SETUP=1`, tắt bằng `AUTO_SETUP=0`); xem tiến trình ở Console. Không cần chạy `npm run deploy` / `npm run emojis`.
5. Dữ liệu nằm trong `data/` và `backups/` của host – tải về định kỳ qua tab Files/SFTP hoặc dùng `/backupdb`.
