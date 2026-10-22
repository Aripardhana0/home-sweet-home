# GK (Gabin Karip)

Simulasi kehidupan rumah tangga santai (cozy cooperative simulation) untuk dua orang pemain bersamaan sebagai **Karip** (suami) dan **Gabin** (istri berhijab).

## Fitur Utama
1. **Multiplayer 2 Pemain Riil:** Sinkronisasi posisi, aktivitas, obrolan, dan status secara real-time via WebSocket.
2. **Karakter & Representasi:** Karip dengan pakaian kasual santai, dan Gabin yang konsisten berhijab rapi pada seluruh arah hadap dan animasi.
3. **5 Zona Rumah 2.5D:** Kamar tidur, kamar mandi, dapur & ruang makan, ruang keluarga & tamu, serta teras & taman.
4. **Sistem Aktivitas & Co-op:** Mendukung aktivitas mandiri (solo/fleksibel) serta aktivitas bersama (co-op) dengan mekanisme ajakan dan persetujuan (consent handshake).
5. **Panel Admin:** Pembuatan room dengan kode acak aman (`GK-XXXXXX`), pemantauan slot, putar kode, dan pemulihan status.
6. **Persistence:** Progres rumah dan slot pemain tersimpan aman dan dipulihkan setelah server restart.

## Menjalankan dengan Docker (WSL / Linux)

Pastikan Docker service berjalan, lalu jalankan:

```bash
# Build dan jalankan container
docker compose up -d --build

# Periksa status container dan healthcheck
docker compose ps

# Periksa log
docker compose logs -f
```

Aplikasi dapat diakses melalui browser:
- Halaman Utama Game: `http://localhost:8080/`
- Panel Administrator: `http://localhost:8080/admin`
- Endpoint Healthcheck: `http://localhost:8080/healthz`

Default password administrator: `gabin-karip-admin-2026` (dapat dikonfigurasi melalui berkas `.env`).

## Menjalankan Langsung Tanpa Docker

```bash
# Instal dependensi
npm install

# Jalankan pengujian otomatis
npm test

# Jalankan server game
npm start
```

## Kontrol Permainan
- **Gerak:** Tombol `W`, `A`, `S`, `D` atau tombol panah arah keyboard.
- **Interaksi:** Dekati furnitur atau pasangan, lalu tekan `E` untuk membuka daftar aktivitas atau membatalkan aktivitas yang sedang berjalan.
- **Kamera:** Klik kiri dan geser (drag) mouse untuk menggeser pandangan; scroll roda mouse untuk memperbesar/memperkecil (zoom); klik tombol `Reset Kamera` untuk kembali ke posisi awal.
- **Obrolan:** Pilih tombol pintas (quick phrases), kirim emote, atau ketik pesan pada kolom obrolan di bagian bawah.
