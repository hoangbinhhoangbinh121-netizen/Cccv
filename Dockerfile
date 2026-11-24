FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
# better-sqlite3 có bản dựng sẵn; nếu thiếu, thêm công cụ biên dịch rồi npm ci lại
RUN npm install --omit=dev --no-audit --no-fund || (apt-get update && apt-get install -y --no-install-recommends python3 make g++ && npm install --omit=dev && apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*)
COPY . .
ENV NODE_ENV=production DB_PATH=/app/data/fishing.sqlite BACKUP_DIR=/app/backups
VOLUME ["/app/data", "/app/backups"]
USER node
CMD ["node", "src/index.js"]
