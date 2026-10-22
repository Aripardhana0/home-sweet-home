# GK — Gabin Karip
## Game Design Document (GDD), Product Brief & OMP Implementation Specification

**Status:** Draft spesifikasi implementasi v1.0  
**Genre:** Cozy cooperative household life simulation  
**Platform:** Browser desktop-first, responsive mobile bertahap  
**Players:** Tepat 2 pemain per room (Karip dan Gabin)  
**Visual:** 2.5D top-down/isometric-feel HD pixel art, referensi gaya visual Virtual Office AI  
**Target project:** `/mnt/e/CODING/GK` (lingkungan WSL/Linux; sesuaikan bila dijalankan di Windows)  
**Reference:** https://github.com/Aripardhana0/virtual-office-ai

> Dokumen ini adalah sumber kebenaran produk untuk OMP. Jangan langsung mengimplementasikan seluruh backlog: selesaikan vertical slice yang dapat dimainkan, baru perluas katalog aktivitas.

---

## 1. Visi Produk

GK adalah game kehidupan rumah tangga santai yang dimainkan dua orang secara bersamaan sebagai **Karip (suami)** dan **Gabin (istri berhijab)**. Keduanya menjalankan rutinitas sehari-hari, menjaga rumah, berbincang, berinteraksi dengan furnitur dan lingkungan, saling membantu, dan membangun hubungan yang hangat. Permainan bersifat kooperatif, tidak kompetitif, tanpa hukuman yang merusak pengalaman bila pemain berhalangan hadir. Semua tugas rumah dapat dikerjakan siapa pun; karakter tidak mengunci pekerjaan berdasarkan gender.

### Pilar desain
1. **Togetherness first:** interaksi pasangan lebih bermakna daripada grinding.
2. **Small but alive:** satu rumah kecil, padat interaksi, animasi jelas.
3. **Actually multiplayer:** dua browser terhubung dan sinkron, bukan simulasi lokal.
4. **Simple stack:** teknologi mudah dirawat, tanpa engine/framework berat.
5. **Privacy by default:** room tertutup, kode hanya dari admin, tidak terekspos publik.
6. **Progress without pressure:** rutinitas dapat dipilih, dilewati, atau disesuaikan.

### Bukan tujuan v1
Tidak ada AI percakapan berbayar, voice/video call, NPC generatif, ekonomi rumit, PvP, pay-to-win, game mobile native, 3D engine, atau simulasi kebutuhan yang menghukum.

## 2. Karakter

| Karakter | Identitas | Tampilan wajib | Kontrol |
|---|---|---|---|
| Karip | Suami | Sprite laki-laki pixel art, siluet terbaca, pakaian kasual | Pemain yang memilih slot Karip |
| Gabin | Istri | **Berhijab**, hijab rapi menutupi rambut pada semua frame animasi dan arah hadap, pakaian sopan dan konsisten | Pemain yang memilih slot Gabin |

Sprite idle, walk (atas/bawah/kiri/kanan), duduk, tidur, membawa benda, memasak, menyapu, menyiram, memeluk, dan emote. Gunakan sprite sheet yang konsisten, hindari pencampuran ukuran pixel yang membuat tampilan blur. Pilih palet yang membedakan kedua avatar dan tetap terbaca pada zoom rendah. Hindari visual hijab yang terlepas saat animasi. Nama dan role fixed untuk v1.

## 3. Flow Pengguna dan Otorisasi

### 3.1 Admin
1. Admin membuka halaman `/admin` yang dilindungi autentikasi.
2. Admin membuat room baru dengan kode unik (contoh `GK-7K2M9Q`), dapat menentukan nama rumah dan masa berlaku opsional.
3. Server menyimpan **hash kode** atau token verifier yang aman; kode asli hanya ditampilkan kepada admin pada saat pembuatan atau melalui mekanisme rotasi yang aman.
4. Admin membagikan kode melalui kanal pribadi kepada kedua pemain.
5. Admin dapat melihat room, jumlah slot terisi, status aktif, mengunci, merotasi kode, mencabut room, dan mereset progres dengan konfirmasi eksplisit.
6. Admin tidak otomatis menjadi salah satu pemain.

### 3.2 Pemain
1. Pemain membuka halaman web utama.
2. Masukkan **kode room dari admin**; tidak ada tombol create room untuk pemain biasa.
3. Server memvalidasi kode, status room, expiry, rate limit, dan kapasitas.
4. Pilih slot **Karip** atau **Gabin** yang belum terpakai.
5. Tetapkan identitas pemain dengan token sesi rahasia yang tersimpan aman; slot diklaim atomik di server.
6. Saat kedua pemain online, keduanya melihat rumah dan avatar yang sama secara real-time.
7. Jika pemain disconnect, slot tetap miliknya selama masa reconnect; jangan izinkan pengambilalihan slot tanpa token valid atau reset admin.
8. Reconnect memulihkan posisi, progress, task, chat terbaru, dan status karakter.

**Aturan penting:** kode room merupakan kunci masuk, tetapi **bukan bukti kepemilikan slot**. Pemain kedua tidak boleh bisa menyamar sebagai Karip/Gabin yang sudah diklaim hanya karena tahu kode room. Admin dapat melakukan release slot secara eksplisit. Semua pesan WebSocket harus memvalidasi identitas, room, action, dan payload di server.

### 3.3 State room
`created → waiting_for_players → active → paused/idle → archived/revoked`. Room maksimal dua slot karakter unik. Jika satu pemain offline, pemain online masih bisa melakukan aktivitas solo; aktivitas bersama menunggu pasangan. Tidak ada room discovery publik.

## 4. Dunia dan Denah

**Kamera:** fixed top-down 2.5D, zoom dengan mouse wheel, pan drag, reset view; responsif dan tidak menyebabkan avatar hilang. **Pergerakan:** WASD/arrow keys atau click-to-move (pilih satu sebagai utama MVP), collision, waypoint pintu, depth sorting, batas map. Tidak bisa menembus dinding/furnitur.

| Area | Furnitur / objek | Kegiatan |
|---|---|---|
| Kamar tidur | Kasur double, lemari, nakas, lampu | Tidur, rapikan kasur, pilih pakaian, ngobrol |
| Kamar mandi | Shower, toilet, wastafel, cermin | Mandi, cuci tangan, sikat gigi, bersihkan kamar mandi |
| Ruang tamu | Sofa, meja, rak, dekorasi | Sambut tamu, duduk, berbincang |
| Ruang keluarga | Sofa, TV, karpet, rak buku | Nonton, membaca, quality time, bermain |
| Dapur | Kompor, kulkas, wastafel, meja olah | Masak, cuci piring, persiapan makanan |
| Ruang makan | Meja dan dua kursi | Sarapan/makan bersama, minum teh |
| Area laundry | Mesin cuci, jemuran, keranjang | Cuci, jemur, lipat pakaian |
| Taman/teras | Pot, tanaman, kursi, alat kebun | Siram, tanam, bersih-bersih, santai |
| Jalan/tetangga | Jalan setapak, pagar, rumah tetangga | Sapa NPC, kunjungan, aktivitas sosial |

**MVP map:** kamar tidur, kamar mandi, ruang keluarga/tamu gabungan, dapur/makan gabungan, taman kecil. **Expansion:** laundry terpisah, tetangga dan jalan yang bisa dieksplorasi. Tampilkan jam game, cuaca kosmetik opsional, label area, dan indikator objek interaktif.

## 5. Loop Permainan

1. Masuk room dan spawn di rumah yang sama.
2. Lihat jam game, status diri, status rumah, dan daftar tugas.
3. Pilih aktivitas; berjalan mendekati objek yang relevan.
4. Tekan `E` atau klik interaksi; karakter memainkan animasi dengan progress singkat.
5. Server memvalidasi jarak, cooldown, objek, kondisi task, dan role pemain.
6. Task selesai → perubahan state rumah/kebutuhan/progress tersimpan → update ke kedua browser.
7. Berinteraksi dengan pasangan lewat chat, emote, ajakan, dan task kolaboratif.
8. Akhiri hari saat kedua pemain memilih tidur atau memakai mekanisme skip day yang disepakati; pemain offline tidak memblokir progres tanpa batas.

**Waktu:** configurable; default 1 hari game ≈ 20 menit real time saat room aktif, dengan pause ketika kedua pemain offline. Jangan menjalankan timer terpisah per client. Tugas tidak otomatis gagal saat hari berakhir; task harian yang terlewat cukup dicatat sebagai belum selesai, tanpa penalti agresif.

## 6. Sistem Inti

### 6.1 Kebutuhan dan status
- **Energy (0–100):** berkurang perlahan saat aktivitas, pulih lewat tidur/istirahat.
- **Hunger (0–100):** 100 berarti kenyang; menurun seiring waktu; makan memulihkan.
- **Mood (0–100):** meningkat lewat aktivitas menyenangkan dan interaksi baik.
- **Home Comfort (0–100):** keadaan kebersihan, dekorasi, dan kerapian rumah.
- **Harmony (0–100):** ukuran kegiatan positif bersama; tidak dipakai untuk mengontrol atau memaksa pasangan.

Semua indikator punya batas min/max dan perubahan yang bisa diuji. Jangan buat soft-lock jika Energy habis: pemain tetap dapat bergerak dan beristirahat. Hindari manipulasi emosional, score-shaming, atau penalti untuk tidak membalas chat.

### 6.2 Task engine
Definisikan task **data-driven** di `tasks.json` atau modul terpisah, bukan ratusan blok `if` manual. Setiap task minimal memiliki `id`, `title`, `category`, `area`, `objectId`, `mode` (`solo|either|co-op`), `durationMs`, `cooldownMs`, `preconditions`, `effects`, `animation`, `frequency`, `reward`, `enabled`, dan `tier` (`mvp|expansion`).

Task punya state `available → in_progress → completed` atau `cancelled`. Co-op task memakai consent/accept dari kedua pemain dan proximity check. Task dengan dua langkah menggunakan prerequisites; cegah double-completion dan reward ganda. Task tidak boleh dapat diselesaikan dari client tanpa validasi server.

### 6.3 Percakapan dan interaksi pasangan
- Chat teks realtime dengan speech bubble singkat dan panel history.
- Quick phrases: “Selamat pagi”, “Sudah makan?”, “Mau dibantu?”, “Terima kasih”, “Ayo istirahat”, “Bagaimana harimu?”, “Aku sayang kamu”.
- Emote: senyum, hati, lambaian, tertawa, mengantuk, tepuk tangan.
- Ajakan dua pihak: duduk bersama, makan bersama, menonton TV, peluk, foto bersama, jalan sore, ngobrol serius. Pemain yang diajak dapat menerima atau menolak tanpa penalti.
- Chat hanya tersedia bagi dua pemain dalam room dan disimpan dengan retensi terbatas yang dapat diatur; fitur hapus riwayat oleh admin/pemilik room jika diperlukan.

### 6.4 Progres dan reward
XP ringan atau bintang kebersamaan untuk unlock dekorasi, emote, atau variasi aktivitas. Tidak perlu mata uang rumit. Hadiah solo dan bersama seimbang agar aktivitas tidak terasa wajib. Progress harus bertahan restart server.

## 7. Katalog Task Lengkap

**Legenda:** `S` solo, `F` fleksibel (bisa Karip/Gabin), `C` co-op (butuh dua pemain), `D` harian, `W` mingguan, `O` opsional/event. Secara default tugas `S/F` dapat dikerjakan oleh siapa saja. Item katalog adalah *content backlog*: MVP implementasikan subset yang representatif terlebih dahulu. Semua task di bawah harus punya target objek, animasi minimal, durasi, dan efek yang didefinisikan di data task.

### A. Rutinitas pagi dan personal
| ID | Task | Area/objek | Mode | Frekuensi |
|---|---|---|---|---|
| PER-01 | Bangun tidur | Kasur | F | D |
| PER-02 | Merapikan kasur | Kasur | F | D |
| PER-03 | Membuka tirai | Jendela | F | D |
| PER-04 | Mematikan lampu kamar | Lampu | F | D |
| PER-05 | Sikat gigi pagi | Wastafel | F | D |
| PER-06 | Cuci muka | Wastafel | F | D |
| PER-07 | Mandi pagi | Shower | F | D |
| PER-08 | Berganti pakaian | Lemari | F | D |
| PER-09 | Menyisir/merapikan penampilan | Cermin | F | D |
| PER-10 | Minum air putih | Dispenser | F | D |
| PER-11 | Olahraga ringan | Karpet/taman | F | D |
| PER-12 | Peregangan bersama | Karpet | C | O |
| PER-13 | Istirahat sejenak | Sofa | F | D |
| PER-14 | Tidur siang | Kasur/sofa | F | O |
| PER-15 | Sikat gigi malam | Wastafel | F | D |
| PER-16 | Mandi sore | Shower | F | O |
| PER-17 | Siapkan pakaian esok | Lemari | F | D |
| PER-18 | Matikan lampu sebelum tidur | Lampu | F | D |
| PER-19 | Tidur malam | Kasur | F | D |
| PER-20 | Ucapkan selamat malam | Dekat pasangan | C | D |

### B. Memasak, makanan, dan dapur
| ID | Task | Area/objek | Mode | Frekuensi |
|---|---|---|---|---|
| KIT-01 | Cek isi kulkas | Kulkas | F | D |
| KIT-02 | Siapkan bahan sarapan | Meja dapur | F | D |
| KIT-03 | Memasak nasi | Rice cooker | F | D |
| KIT-04 | Menggoreng telur | Kompor | F | D |
| KIT-05 | Membuat roti panggang | Pemanggang | F | D |
| KIT-06 | Menyiapkan teh hangat | Ketel | F | D |
| KIT-07 | Menyiapkan kopi | Ketel | F | D |
| KIT-08 | Menyiapkan buah | Meja dapur | F | D |
| KIT-09 | Memasak sayur | Kompor | F | D |
| KIT-10 | Membuat sup | Kompor | F | O |
| KIT-11 | Memasak lauk | Kompor | F | D |
| KIT-12 | Membuat mie | Kompor | F | O |
| KIT-13 | Memasak bersama | Kompor/meja | C | O |
| KIT-14 | Menata meja makan | Meja makan | F | D |
| KIT-15 | Mengambil piring | Lemari piring | F | D |
| KIT-16 | Mengambil air minum | Dispenser | F | D |
| KIT-17 | Sarapan bersama | Meja makan | C | D |
| KIT-18 | Makan siang bersama | Meja makan | C | D |
| KIT-19 | Makan malam bersama | Meja makan | C | D |
| KIT-20 | Makan sendiri | Meja makan | F | D |
| KIT-21 | Mengantar makanan ke pasangan | Meja/pasangan | C | O |
| KIT-22 | Mencuci piring | Wastafel dapur | F | D |
| KIT-23 | Mengeringkan piring | Rak piring | F | D |
| KIT-24 | Menyimpan piring | Lemari piring | F | D |
| KIT-25 | Membersihkan meja dapur | Meja dapur | F | D |
| KIT-26 | Membersihkan kompor | Kompor | F | D |
| KIT-27 | Membuang sampah dapur | Tempat sampah | F | D |
| KIT-28 | Membersihkan kulkas | Kulkas | F | W |
| KIT-29 | Menyusun stok makanan | Kulkas/lemari | F | W |
| KIT-30 | Membuat camilan | Meja dapur | F | O |
| KIT-31 | Menyiapkan bekal | Meja dapur | F | O |
| KIT-32 | Piknik makanan di taman | Tikar taman | C | O |

### C. Kebersihan dan perawatan rumah
| ID | Task | Area/objek | Mode | Frekuensi |
|---|---|---|---|---|
| HOM-01 | Menyapu ruang tamu | Lantai ruang tamu | F | D |
| HOM-02 | Mengepel ruang tamu | Lantai ruang tamu | F | D |
| HOM-03 | Menyapu kamar tidur | Lantai kamar | F | D |
| HOM-04 | Mengepel dapur | Lantai dapur | F | D |
| HOM-05 | Membersihkan debu meja | Meja | F | D |
| HOM-06 | Merapikan sofa | Sofa | F | D |
| HOM-07 | Menata bantal sofa | Sofa | F | D |
| HOM-08 | Merapikan rak buku | Rak buku | F | W |
| HOM-09 | Membersihkan TV | TV | F | W |
| HOM-10 | Membersihkan kaca jendela | Jendela | F | W |
| HOM-11 | Membuka ventilasi | Jendela | F | D |
| HOM-12 | Mengelap meja makan | Meja makan | F | D |
| HOM-13 | Mengganti sprei | Kasur | F | W |
| HOM-14 | Menata lemari pakaian | Lemari | F | W |
| HOM-15 | Membersihkan wastafel | Wastafel | F | D |
| HOM-16 | Membersihkan cermin | Cermin | F | W |
| HOM-17 | Membersihkan shower | Shower | F | W |
| HOM-18 | Membersihkan toilet | Toilet | F | W |
| HOM-19 | Mengganti handuk | Rak handuk | F | W |
| HOM-20 | Mengosongkan tempat sampah | Tempat sampah | F | D |
| HOM-21 | Mengganti kantong sampah | Tempat sampah | F | D |
| HOM-22 | Membersihkan teras | Teras | F | D |
| HOM-23 | Membersihkan keset | Pintu | F | W |
| HOM-24 | Menyusun sepatu | Rak sepatu | F | D |
| HOM-25 | Merapikan dekorasi | Rak dekorasi | F | O |
| HOM-26 | Membersihkan rumah bersama | Beberapa area | C | W |
| HOM-27 | Mengecek lampu rumah | Lampu | F | W |
| HOM-28 | Mengecek pintu dan jendela | Pintu/jendela | F | D |
| HOM-29 | Mematikan perangkat tidak dipakai | TV/lampu | F | D |
| HOM-30 | Menata ulang furnitur ringan | Furnitur | C | O |

### D. Laundry dan pakaian
| ID | Task | Area/objek | Mode | Frekuensi |
|---|---|---|---|---|
| LAU-01 | Mengumpulkan pakaian kotor | Keranjang | F | D |
| LAU-02 | Memilah pakaian | Keranjang | F | W |
| LAU-03 | Memasukkan pakaian ke mesin | Mesin cuci | F | W |
| LAU-04 | Menjalankan mesin cuci | Mesin cuci | F | W |
| LAU-05 | Mengeluarkan cucian | Mesin cuci | F | W |
| LAU-06 | Menjemur pakaian | Jemuran | F | W |
| LAU-07 | Mengangkat pakaian kering | Jemuran | F | W |
| LAU-08 | Melipat pakaian | Meja lipat | F | W |
| LAU-09 | Menyimpan pakaian | Lemari | F | W |
| LAU-10 | Menyetrika pakaian | Meja setrika | F | W |
| LAU-11 | Mencuci handuk | Mesin cuci | F | W |
| LAU-12 | Mengganti dan mencuci sprei | Kasur/mesin | F | W |
| LAU-13 | Melipat pakaian bersama | Meja lipat | C | O |
| LAU-14 | Membersihkan mesin cuci | Mesin cuci | F | W |
| LAU-15 | Merapikan area laundry | Area laundry | F | W |

### E. Taman, tanaman, dan luar rumah
| ID | Task | Area/objek | Mode | Frekuensi |
|---|---|---|---|---|
| GAR-01 | Menyiram bunga | Pot bunga | F | D |
| GAR-02 | Menyiram tanaman sayur | Kebun kecil | F | D |
| GAR-03 | Menanam bibit bunga | Petak tanah | F | O |
| GAR-04 | Menanam bibit sayur | Petak tanah | F | O |
| GAR-05 | Memupuk tanaman | Petak tanah | F | W |
| GAR-06 | Mencabut rumput liar | Taman | F | W |
| GAR-07 | Menyapu halaman | Halaman | F | D |
| GAR-08 | Mengumpulkan daun gugur | Halaman | F | W |
| GAR-09 | Memangkas tanaman | Semak | F | W |
| GAR-10 | Memanen sayuran | Kebun kecil | F | O |
| GAR-11 | Memetik bunga | Pot bunga | F | O |
| GAR-12 | Menata pot tanaman | Teras | F | O |
| GAR-13 | Mengisi penyiram tanaman | Keran | F | D |
| GAR-14 | Membersihkan kursi taman | Kursi taman | F | W |
| GAR-15 | Berkebun bersama | Kebun | C | O |
| GAR-16 | Duduk santai di taman | Kursi taman | C | O |
| GAR-17 | Minum teh di teras | Kursi teras | C | O |
| GAR-18 | Jalan sore bersama | Jalan lingkungan | C | O |
| GAR-19 | Menikmati matahari pagi | Teras | C | O |
| GAR-20 | Menghias taman | Taman | C | O |

### F. Hubungan, komunikasi, dan quality time
| ID | Task | Area/objek | Mode | Frekuensi |
|---|---|---|---|---|
| REL-01 | Mengucapkan selamat pagi | Pasangan | C | D |
| REL-02 | Menanyakan kabar | Pasangan | C | D |
| REL-03 | Menanyakan kegiatan hari ini | Pasangan | C | D |
| REL-04 | Mengucapkan terima kasih | Pasangan | C | O |
| REL-05 | Memberi pujian | Pasangan | C | O |
| REL-06 | Mengirim emote hati | Pasangan | C | O |
| REL-07 | Berpelukan | Pasangan | C | O |
| REL-08 | Duduk berdampingan | Sofa | C | O |
| REL-09 | Menonton TV bersama | TV/sofa | C | O |
| REL-10 | Mengobrol di sofa | Sofa | C | D |
| REL-11 | Cerita tentang hari ini | Sofa | C | D |
| REL-12 | Mendengarkan cerita pasangan | Sofa | C | D |
| REL-13 | Mengajak pasangan istirahat | Pasangan | C | O |
| REL-14 | Membantu tugas pasangan | Objek tugas | C | O |
| REL-15 | Memberi hadiah kecil | Pasangan | C | O |
| REL-16 | Membuat kejutan sederhana | Meja/pasangan | C | O |
| REL-17 | Mengajak makan bersama | Pasangan/meja | C | D |
| REL-18 | Mengajak minum teh | Pasangan/teras | C | O |
| REL-19 | Bermain board game | Meja | C | O |
| REL-20 | Membaca bersama | Rak buku/sofa | C | O |
| REL-21 | Mendengarkan musik bersama | Pemutar musik | C | O |
| REL-22 | Berdansa ringan | Ruang keluarga | C | O |
| REL-23 | Foto bersama | Spot foto | C | O |
| REL-24 | Merencanakan akhir pekan | Meja | C | W |
| REL-25 | Membicarakan pembagian tugas | Meja/sofa | C | W |
| REL-26 | Saling meminta maaf | Pasangan | C | O |
| REL-27 | Saling memaafkan | Pasangan | C | O |
| REL-28 | Merayakan pencapaian kecil | Pasangan | C | O |
| REL-29 | Menulis pesan manis | Papan pesan | F | O |
| REL-30 | Membaca pesan pasangan | Papan pesan | F | O |
| REL-31 | Membuat rencana makan bersama | Dapur | C | W |
| REL-32 | Mengobrol di taman | Bangku taman | C | O |
| REL-33 | Mengucapkan selamat malam | Pasangan | C | D |
| REL-34 | Beristirahat bersama | Sofa | C | O |
| REL-35 | Menonton film malam | TV/sofa | C | O |
| REL-36 | Memasak menu favorit pasangan | Kompor | F | O |
| REL-37 | Menyambut pasangan pulang | Pintu | C | O |
| REL-38 | Memberi semangat | Pasangan | C | O |
| REL-39 | Berbagi cerita lucu | Pasangan | C | O |
| REL-40 | Membuat daftar impian rumah | Meja | C | O |

**Prinsip consent:** aktivitas afeksi fisik dan percakapan pribadi memerlukan persetujuan eksplisit dua pemain. Tidak ada hukuman bila ajakan ditolak; jangan memaksa teks percakapan tertentu.

### G. Hiburan, hobi, dan aktivitas santai
| ID | Task | Area/objek | Mode | Frekuensi |
|---|---|---|---|---|
| FUN-01 | Membaca buku | Rak buku | F | O |
| FUN-02 | Membaca majalah | Sofa | F | O |
| FUN-03 | Menonton acara favorit | TV | F | O |
| FUN-04 | Bermain game konsol | TV | F | O |
| FUN-05 | Bermain game bersama | TV | C | O |
| FUN-06 | Mendengarkan musik | Pemutar musik | F | O |
| FUN-07 | Menulis jurnal | Meja | F | O |
| FUN-08 | Menggambar | Meja | F | O |
| FUN-09 | Merangkai bunga | Meja | F | O |
| FUN-10 | Menata foto keluarga | Rak foto | F | O |
| FUN-11 | Latihan memasak resep baru | Dapur | F | O |
| FUN-12 | Yoga ringan | Karpet | F | O |
| FUN-13 | Meditasi singkat | Karpet | F | O |
| FUN-14 | Bermain tebak-tebakan | Sofa | C | O |
| FUN-15 | Menonton matahari terbenam | Teras | C | O |
| FUN-16 | Menghias rumah musiman | Rak dekorasi | C | O |
| FUN-17 | Membuat kerajinan | Meja | F | O |
| FUN-18 | Mengisi album kenangan | Album | C | O |
| FUN-19 | Mengatur playlist | Pemutar musik | F | O |
| FUN-20 | Santai tanpa tugas | Sofa/taman | F | O |

### H. Sosial dan tetangga (expansion)
| ID | Task | Area/objek | Mode | Frekuensi |
|---|---|---|---|---|
| SOC-01 | Menyapa tetangga | NPC tetangga | F | D |
| SOC-02 | Berkenalan dengan tetangga | NPC tetangga | F | O |
| SOC-03 | Berkunjung ke rumah tetangga | Pintu tetangga | F | O |
| SOC-04 | Mengantar makanan ke tetangga | NPC tetangga | F | O |
| SOC-05 | Menerima paket | Pintu rumah | F | O |
| SOC-06 | Menyambut tamu | Ruang tamu | F | O |
| SOC-07 | Menyajikan minuman tamu | Meja tamu | F | O |
| SOC-08 | Membantu tetangga menyiram tanaman | Taman tetangga | F | O |
| SOC-09 | Membersihkan area bersama | Jalan lingkungan | C | W |
| SOC-10 | Berjalan keliling kompleks | Jalan | C | O |
| SOC-11 | Menghadiri kumpul warga | Area komunitas | C | O |
| SOC-12 | Bertukar bibit tanaman | NPC tetangga | F | O |
| SOC-13 | Menitipkan pesan ke tetangga | NPC tetangga | F | O |
| SOC-14 | Mengucapkan terima kasih ke tetangga | NPC tetangga | F | O |
| SOC-15 | Mengantar barang pinjaman | NPC tetangga | F | O |

### I. Perencanaan rumah dan event (expansion)
| ID | Task | Area/objek | Mode | Frekuensi |
|---|---|---|---|---|
| PLN-01 | Menyusun daftar belanja | Papan catatan | F | W |
| PLN-02 | Memeriksa persediaan dapur | Kulkas | F | W |
| PLN-03 | Merencanakan menu mingguan | Meja | C | W |
| PLN-04 | Menyusun jadwal bersih-bersih | Papan tugas | C | W |
| PLN-05 | Memilih dekorasi baru | Katalog dekor | C | O |
| PLN-06 | Memindahkan dekorasi | Furnitur | F | O |
| PLN-07 | Mengatur pencahayaan rumah | Lampu | F | O |
| PLN-08 | Membuat sudut baca | Rak/sofa | C | O |
| PLN-09 | Menyiapkan makan spesial | Dapur | C | O |
| PLN-10 | Merayakan hari jadi | Meja makan | C | O |
| PLN-11 | Membuat kejutan ulang tahun | Ruang keluarga | C | O |
| PLN-12 | Membuat album kenangan | Meja | C | O |
| PLN-13 | Menata rumah untuk tamu | Ruang tamu | C | O |
| PLN-14 | Mengecek kebutuhan rumah | Papan tugas | F | W |
| PLN-15 | Evaluasi aktivitas minggu ini | Papan tugas | C | W |

**Total katalog: 20 + 32 + 30 + 15 + 20 + 40 + 20 + 15 + 15 = 207 task.** Beberapa task saling berkaitan; implementasikan dependency agar alurnya masuk akal (mis. mencuci → menjemur → melipat → menyimpan).

## 8. Interaksi Objek dan Animasi

Setiap objek interaktif punya `objectId`, posisi, hitbox, `interactionRadius`, daftar task, dan visual state. Contoh: kompor `idle/cooking/done`, wastafel `clean/dirty`, kasur `messy/made/occupied`, pot `dry/watered/growing`, TV `off/on`. Jika animasi khusus belum tersedia, gunakan animasi generik (hadap objek, gerakan tangan sederhana, progress bar, particle) tetapi **jangan tandai task selesai sebelum server mengonfirmasi**. Tambahkan sound effect ringan dan mute toggle; jangan auto-play audio sebelum interaksi pengguna.

## 9. UX / UI

### Landing
Logo GK, kolom kode room, tombol **Masuk Rumah**, validasi kode, informasi error tanpa membocorkan keberadaan room. Tidak ada registrasi publik wajib pada MVP.

### Pemilihan karakter
Dua kartu sprite: Karip dan Gabin berhijab. Tampilkan slot `available/occupied/offline reserved`. Jika slot milik pengguna lama, tawarkan **Lanjutkan** melalui sesi yang valid.

### In-game HUD
Top bar: nama room (jangan tampilkan kode lengkap terus-menerus), hari/jam game, online status Karip/Gabin, Harmony dan Home Comfort. Panel kiri: task aktif, task harian. Panel kanan: chat dan emote. Bottom action bar: interaksi, inventaris sederhana, aktivitas bersama, pengaturan. UI tidak menutup game canvas secara berlebihan. Tooltip objek dan shortcut keyboard.

### Admin UI
Login, create/revoke/rotate room, room list, status, release slot, backup/export data, reset progres dengan konfirmasi. Admin API terpisah dari gameplay API.

## 10. Arsitektur Teknis

**Ikuti kesederhanaan repo referensi:** HTML/CSS/Vanilla JS, Canvas 2D, Node.js HTTP, WebSocket `ws`, Docker. Jangan copy fitur OMP agent atau dependensi runtime OMP dari repo Virtual Office AI; repo itu hanya referensi visual, pola rendering, kamera, collision, dan server WebSocket. Pastikan aset dan kode yang dipakai memiliki hak penggunaan yang sesuai.

### Struktur proyek yang disarankan
```text
/mnt/e/CODING/GK/
├── README.md
├── GAME-BRIEF.md
├── package.json
├── package-lock.json
├── server.js
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── public/
│   ├── index.html
│   ├── admin.html
│   ├── css/style.css
│   ├── js/main.js
│   ├── js/render.js
│   ├── js/input.js
│   ├── js/network.js
│   ├── js/ui.js
│   └── assets/{characters,tiles,furniture,effects,audio}/
├── src/
│   ├── auth.js
│   ├── rooms.js
│   ├── game-state.js
│   ├── tasks.js
│   ├── movement.js
│   ├── persistence.js
│   └── protocol.js
├── data/
│   ├── tasks.json
│   └── rooms/          # runtime only, ignored by git
└── tests/
```

### Model otoritas
Server authoritative untuk room membership, player identity, movement bounds, task completion, rewards, timer, inventory, dan persistent state. Client mengirim **intent**, bukan perubahan state final. Server menyiarkan snapshot/delta dengan sequence number. Rate-limit input dan chat. Gunakan ping/pong heartbeat dan reconnect exponential backoff.

### WebSocket event contoh
Client → server: `join_room`, `select_character`, `move_intent`, `interact`, `task_start`, `task_cancel`, `chat_send`, `emote`, `invite_action`, `invite_accept`, `invite_decline`, `request_snapshot`.

Server → client: `join_result`, `room_snapshot`, `player_joined`, `player_left`, `player_moved`, `object_changed`, `task_started`, `task_completed`, `task_rejected`, `chat_message`, `invite_received`, `invite_resolved`, `day_changed`, `error`.

Envelope: `{type, requestId, roomId, payload}`. Jangan percaya `roomId`, `playerId`, role, posisi, atau reward yang diklaim client. Semua input divalidasi dan dibatasi ukuran. Gunakan version field untuk kompatibilitas protokol.

### Persistence
MVP: file JSON per room dengan write-temp + fsync/atomic rename bila tersedia, serialisasi write per room, snapshot berkala dan pada perubahan penting, restore setelah restart, backup sebelum migrasi/reset. Jika concurrent writes atau jumlah room meningkat, migrasi ke SQLite lebih aman daripada menambah kompleksitas file-lock manual. Jangan menyimpan secret plaintext atau kode room di repo. Data folder dipasang sebagai Docker volume.

### Keamanan
- Admin login memakai secret kuat dari environment (`ADMIN_PASSWORD_HASH` atau kredensial hash), bukan password hardcoded. Cookie session HttpOnly, Secure saat HTTPS, SameSite, TTL dan CSRF protection untuk endpoint admin.
- Generate kode room via CSPRNG, panjang memadai, unique; simpan hash/HMAC verifier, rate-limit brute force per IP dan kode, tanpa room enumeration.
- Token sesi pemain acak dan berumur terbatas; hash token di storage bila perlu, rotasi/revoke, verifikasi slot ownership.
- Validasi Origin/Host untuk WebSocket dan HTTP, TLS via reverse proxy, jangan expose port backend langsung ke internet.
- Batasi panjang chat, escape output HTML, cegah XSS, path traversal, request flooding, dan spam task.
- Admin dapat revoke room dan membersihkan data; dokumentasikan retention policy dan backup.
- Hindari mengirim room code, admin credential, dan session token ke log.

### Deployment
Default bind `127.0.0.1` untuk local development. Docker Compose satu service app + named volume; healthcheck `/healthz`, graceful shutdown, restart policy, log JSON sederhana, backup terjadwal untuk state. Jika dimainkan lintas internet, letakkan di balik reverse proxy HTTPS/WSS dengan auth dan rate limiting. **Jangan gunakan beberapa replica server tanpa shared state/pub-sub dan session coordination.**

## 11. Prioritas Implementasi

### Phase 0 — Foundation
Scaffold, lint/format ringan, static HTTP server, WebSocket, healthcheck, config/env, Docker, unit test. Buat `README` runbook.

### Phase 1 — Playable vertical slice (wajib)
Admin create room; dua browser join kode yang sama; pilih dua slot eksklusif; sprite Karip dan Gabin **berhijab**; rumah 5 zona; gerak 4 arah dan collision; camera pan/zoom; chat; reconnect; save/restore; minimal **20 task nyata** lintas kategori; 3 task co-op dengan acceptance; HUD, jam game, progress, dan state objek.

**20 task pertama yang disarankan:** PER-01, PER-02, PER-05, PER-07, PER-19, KIT-01, KIT-04, KIT-14, KIT-17, KIT-22, HOM-01, HOM-06, HOM-12, HOM-20, GAR-01, GAR-07, REL-02, REL-07, REL-09, REL-33. Minimal 3 dari daftar ini memakai mekanisme co-op yang benar.

### Phase 2 — Household depth
Tambahkan 60–80 task, dependency task, laundry, pertumbuhan tanaman, animasi khusus, kebutuhan karakter, harmony, audio, task board, dan dekorasi sederhana.

### Phase 3 — Full catalog & neighborhood
Aktifkan seluruh 207 task sesuai prasyarat objek, area tetangga dan NPC deterministik, event musiman sederhana, polish, mobile control, performance optimization.

## 12. Acceptance Criteria yang Dapat Diuji

1. Admin login dan create room; pemain biasa tidak dapat create room.
2. Kode tidak valid, expired, atau revoked ditolak secara aman.
3. Dua browser/perangkat berbeda join room yang sama dengan kode admin.
4. Slot Karip dan Gabin unik; dua pemain tidak bisa mengklaim slot yang sama dalam race condition.
5. Gabin terlihat **berhijab** saat idle, berjalan ke empat arah, duduk, dan menjalankan task.
6. Pergerakan kedua avatar terlihat di kedua client dengan latency yang wajar di jaringan lokal; tidak menembus dinding.
7. Chat dan emote terkirim hanya ke room yang benar; teks user tidak dieksekusi sebagai HTML.
8. Task tidak bisa diselesaikan tanpa berada dekat objek, tanpa prasyarat, atau dengan memalsukan reward.
9. Task co-op hanya dimulai/diselesaikan setelah kedua pemain menyetujui dan memenuhi syarat.
10. Setelah restart server, room, slot, task selesai, dan keadaan rumah dipulihkan.
11. Disconnect/reconnect tidak menggandakan karakter atau memberi akses ke slot pemain lain.
12. State dua client konsisten setelah reconnect melalui full snapshot.
13. Admin dapat revoke room, release slot, dan reset data dengan konfirmasi.
14. UI tetap bisa dimainkan pada ukuran desktop umum; zoom/pan tidak mengganggu input interaksi.
15. `npm test` lulus, `npm start` berjalan, Docker Compose dapat start dan healthcheck sehat.
16. Data disimpan di volume persisten, tidak hilang saat container dibuat ulang.
17. Tidak ada credential hardcoded atau kode room tercetak di log.
18. Task catalog terstruktur, tervalidasi, ID unik, objek dan animasi terdaftar.

## 13. Test Plan

**Unit:** code generator, token/session, task transitions, cooldown, prerequisite, reward idempotency, time advancement, collision, state serialization.  
**Integration:** create room → join A → join B → move → chat → co-op → save → restart → reconnect.  
**Security:** brute-force rate limit, duplicate slot race, wrong-room event, spoof playerId, oversized payload, malformed JSON, XSS chat, admin unauthorized, invalid Origin.  
**Manual visual:** hijab Gabin semua arah, alignment sprite dengan furnitur, pintu dan collision, camera zoom/pan, animasi task, HUD readability, dua tab sinkron.

## 14. Panduan Kerja OMP

1. Inspeksi repo referensi untuk memahami pola render, camera, pixel art, dan WebSocket; **jangan** mengubah repo asli.
2. Buat project baru **hanya** di `/mnt/e/CODING/GK` dan copy dokumen ini menjadi `GAME-BRIEF.md`.
3. Buat rencana milestone dan checklist acceptance sebelum coding.
4. Implementasikan phase 0 dan 1 end-to-end dahulu; jangan buat tombol palsu atau UI dekoratif yang mengaku berfungsi.
5. Pilih satu jalur rendering Canvas, satu sumber state di server, dan task data-driven.
6. Gunakan aset pixel art yang legal; bila membuat aset sendiri, pastikan konsistensi style dan sprite Gabin berhijab.
7. Jalankan test dan simulasi dua browser/client; dokumentasikan hasilnya.
8. Jangan klaim fitur Phase 2/3 selesai bila belum benar-benar diuji.
9. Buat dokumentasi `.env.example`, perintah menjalankan, admin bootstrap, cara create kode room, troubleshooting, backup/restore.
10. Tulis changelog ringkas dan daftar pekerjaan yang tersisa di akhir setiap fase.

## 15. Keputusan Produk yang Masih Bisa Diubah

- Satu kode room untuk satu pasangan (default) vs kode reusable untuk beberapa sesi berbeda (**default: satu pasangan**).
- Admin tunggal berbasis password vs multi-admin (**default: satu admin**).
- Jam game 20 menit/hari, pause jika semua offline (**default**).
- Kontrol WASD + E, click-to-move menyusul (**default**).
- Chat history retention 30 hari vs tidak disimpan (**default: 30 hari dengan opsi hapus**).
- Bahasa antarmuka Bahasa Indonesia (**default**).
- Mobile layout sebagai fase lanjutan; desktop prioritas.

---

## 16. Definition of Done

**MVP dinyatakan selesai hanya jika dua orang sungguhan dapat membuka game dari browser terpisah, memasukkan kode yang dibuat admin, mengambil role Karip/Gabin berhijab, bergerak bersama dalam rumah 2.5D, menyelesaikan aktivitas solo dan bersama, chat, disconnect/reconnect, dan melanjutkan progress setelah restart server.** Dokumentasi, pengujian, dan keamanan minimum wajib tersedia. Katalog 207 task adalah arah konten penuh, bukan klaim bahwa seluruhnya harus selesai pada sprint pertama.
