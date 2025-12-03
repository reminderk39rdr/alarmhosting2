# alarmhosting2

Alarm Hosting Dashboard untuk mengelola domain, hosting, SSL, dan pengingat via bot Telegram. Stack utama:

- **Frontend**: Vite + React, fallback ke seed lokal saat API offline.
- **Backend**: Express + Drizzle ORM (Postgres) dengan fallback JSON store untuk mode offline.
- **Database**: Postgres 16 (via Docker) menyimpan users/resources/reminders/log alert.
- **Integrasi**: Bot Telegram asli (`sendMessage`), email/slack test endpoint untuk proof-of-delivery.

## Jalankan dengan Docker Compose (disarankan)

```
docker compose up -d --build
```

Layanan yang aktif:

- `db` → Postgres 16, tersimpan di volume `db-data` (tidak diekspos ke publik).
- `backend` → API Express pada `http://localhost:4000`.
- `frontend` → Build Vite statis via Nginx pada `http://localhost:8080` yang sudah diarahkan ke API.

Backend otomatis menjalankan migrasi Drizzle + seeding begitu kontainer naik. Tidak perlu lagi menjalankan `db:push` manual, kecuali Anda baru menambahkan migrasi baru dan ingin memaksanya.

(Opsional) set token Telegram Anda sebelum compose dijalankan:

```
export TELEGRAM_BOT_TOKEN=123456:abcdef
export TELEGRAM_CHAT_ID=-100123456789
docker compose up -d --build
```

## Environment Backend

File contoh tersedia di `server/.env.example`.

| Variable | Fungsi |
| --- | --- |
| `PORT` | Port API (default 4000). |
| `DATABASE_URL` | Koneksi Postgres, contoh `postgres://alarmhosting:alarmhosting@localhost:5432/alarmhosting`. |
| `ALLOWED_ORIGIN` | Origin frontend yang diizinkan (CORS). |
| `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` | Opsional, jika diisi maka bot Telegram sungguhan dipakai. Jika kosong, request akan disimulasikan & tetap tercatat di log. |
| `SEED_DATA_PATH` | Jalur seed JSON untuk bootstrap (default `server/data/seed.json`). |

Tanpa `DATABASE_URL`, backend akan otomatis fallback ke file `server/data/state.json` sehingga endpoint masih bisa dicoba secara lokal.

## Database & Migrasi

Drizzle digunakan untuk skema & migrasi. File SQL tersimpan pada `server/drizzle`.

Perintah penting:

```
cd server
npm run db:generate   # membuat file migrasi baru dari schema
npm run db:push       # apply migrasi + seeding ke DATABASE_URL aktif
```

Saat `db:push`, tabel `users`, `resources`, dan `reminders` otomatis terisi dari `data/seed.json` bila masih kosong. Alert log dan aksi Telegram sekarang masuk ke tabel `alert_logs`.

## Autentikasi & Role

- `POST /auth/login` menyetel cookie `session_id`. Jika Postgres aktif, sesi disimpan di tabel `sessions`; tanpa DB, backend otomatis fallback ke memory store.
- `POST /auth/logout` menghapus sesi aktif.
- `GET /auth/me` menampilkan user yang sedang login.
- Endpoint `GET /alerts/history` sekarang wajib login sebagai admin; user non-admin mendapat HTTP 403 agar log hanya diakses role ops lead.

## Pengembangan Manual (tanpa Docker)

Frontend:

```
cd frontend
cp .env.example .env      # set VITE_API_BASE_URL jika backend aktif
npm install
npm run dev
```

Backend:

```
cd server
cp .env.example .env
npm install
npm run dev               # http://localhost:4000
```

Pastikan Postgres jalan dan `DATABASE_URL` benar jika ingin memakai DB sungguhan. Jika tidak, backend tetap berjalan dengan penyimpanan JSON lokal.

## Endpoint API

- `GET /dashboard/overview`
- `POST /resources`
- `POST /actions/telegram`
- `POST /integrations/email/test`
- `POST /integrations/slack/test`
- `GET /auth/me`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /calendar`
- `GET /reports/upcoming`
- `GET /alerts/history`
- `GET /health`

Semua endpoint frontend dipanggil dengan `credentials: include`. Pastikan session cookie diterima oleh origin yang sama dengan `ALLOWED_ORIGIN`.
