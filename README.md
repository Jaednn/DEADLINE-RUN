# ⚔️ Deadline: Run - Tahap 2 (Adversarial Search & Turn-Based Battle)
 
## Anggota Kelompok
* Afzaal Zaidan Febryanto - [2508692]
* Ahmad Jadzil Riski - [2501839]
* Muhammad Daffa Safaraz - [2504357]

Selamat datang di pengembangan **Tahap 2** dari game **Deadline: Run**[cite: 1, 2]. Jika pada tahap sebelumnya game berfokus pada pencarian jalur (*Single-Agent*), tahap ini sepenuhnya berfokus pada pengambilan keputusan strategis (*Multi-Agent Adversarial Search*)[cite: 1, 3]. Mode *battle turn-based* akan terpicu secara otomatis ketika Anomali Tugas berhasil mendekat dan menangkap pemain di arena[cite: 1, 2].

Gunakan *readme* ini sebagai petunjuk kontrol dan penjelasan mekanik sebelum Anda mencoba melawan AI di dalam game atau membaca laporan teknis!

---

## 🧠 Materi Kecerdasan Buatan (AI)
Tahap 2 memodelkan pertarungan sebagai permainan dua pemain bergantian yang bersifat *zero-sum* (keuntungan musuh adalah kerugian pemain)[cite: 1, 3]. NPC dibekali kecerdasan buatan untuk merencanakan strategi terbaik menggunakan:
* **Minimax**: Algoritma dasar di mana AI mengevaluasi semua kemungkinan langkah dan mengasumsikan pemain (MC) akan merespons dengan serangan paling optimal atau paling merugikan AI[cite: 1, 3].
* **Alpha-Beta Pruning**: Versi optimasi dari Minimax yang secara cerdas memangkas (*pruning*) cabang pohon pencarian yang sudah pasti tidak akan dipilih, sehingga AI bisa berpikir lebih cepat dengan hasil yang persis sama[cite: 1, 3].
* **Expectimax**: Algoritma alternatif yang memodelkan pemain tidak selalu bermain sempurna, melainkan berbasis probabilitas (peluang) penggunaan *skill* atau aksi tertentu[cite: 1, 3].

---

## 🎮 Mekanik & Isi Game (Tahap 2)
Di mode battle, **Anomali Tugas (NPC)** adalah pemain *MAX* yang mendapatkan giliran pertama karena berhasil menangkap pemain, sementara **Mahasiswa (MC)** adalah pemain *MIN*[cite: 1, 2].

### 🗡️ Aksi Pemain (MC)
Pemain dibekali 1000 HP dan membutuhkan *Stamina* (SP) untuk melancarkan *skill*[cite: 1, 2].
* **Basic Attack**: Memberikan 100 *damage* dan memulihkan +1 SP[cite: 1, 2].
* **Skill E**: Memberikan 300 *damage* (membutuhkan 2 SP)[cite: 1, 2].
* **Ultimate Q**: Memberikan 500 *damage* (membutuhkan 3 SP)[cite: 1, 2].
* **Pakai Item**: Memakan 1 SP tetapi **tidak menghabiskan giliran** (aksi bebas). Efek bergantung pada item yang diambil di peta sebelum battle (Heal +300 HP, Buff 1.5x *damage*, atau +2 SP)[cite: 1, 2].

### 🛡️ Aksi Anomali Tugas (NPC)
NPC memiliki 1100 HP dan akan otomatis memilih aksi terbaik berdasarkan evaluasi AI[cite: 1, 2].
* **Attack**: Serangan biasa sebesar 100 *damage*[cite: 1, 2].
* **Skill**: Serangan besar 200 *damage* (*cooldown* 2 giliran)[cite: 1, 2].
* **Heal**: Memulihkan +100 HP (hanya bisa dipakai maksimal 2 kali per battle)[cite: 1, 2].
* **Defend**: Bertahan untuk mengurangi *damage* serangan pemain berikutnya sebesar 50%[cite: 1, 2].

---

## ⌨️ Kontrol Permainan
Berikut adalah pintasan (*hotkeys*) yang digunakan selama permainan berlangsung[cite: 2]:

* **Peta (Sebelum Battle)**: `W`, `A`, `S`, `D` atau Panah (Navigasi / Ambil Item)[cite: 2].
* **Basic Attack**: `1` atau `J`[cite: 2].
* **Skill E**: `2` atau `E`[cite: 2].
* **Ultimate Q**: `3` atau `Q`[cite: 2].
* **Pakai Item**: `4` atau `R`[cite: 2].
* **Buka Menu Utama**: `M`[cite: 2].
* **Buka Debug Overlay**: `O`[cite: 2].
* **Layar Penuh (Fullscreen)**: `F`[cite: 2].

---

## 🛠️ Fitur Debug Overlay & Analisis AI
Game ini menyediakan alat analisis visual langsung di antarmuka (UI) untuk memahami bagaimana otak AI bekerja merencanakan strategi. Fitur ini cocok dipantau sambil memvalidasi isi laporan eksperimen[cite: 1, 2]:

* **Panel Keputusan AI**: Menampilkan daftar langkah yang dipertimbangkan oleh NPC pada gilirannya, lengkap dengan *skor evaluasi minimax* untuk tiap aksi dan tanda centang untuk aksi yang akhirnya dipilih[cite: 1, 2].
* **Tanda Pemangkasan (≤)**: Menampilkan batas atas skor (berupa tanda `≤`) pada aksi-aksi yang berhasil dipangkas/diabaikan berkat optimasi *Alpha-Beta Pruning*[cite: 1, 2].
* **Statistik Node Live**: Melacak langsung berapa banyak *node* yang dikunjungi AI, jumlah daun (*leaves*) yang dievaluasi, jumlah *cutoff*, hingga total waktu komputasinya[cite: 1, 2].
* **Konfigurasi Kustomisasi (Live)**: Anda bisa mengubah pengaturan otak AI secara bebas di tengah game, meliputi pergantian algoritma, batas kedalaman pencarian (*depth* 1 hingga 8), 5 jenis fungsi evaluasi (dari selisih HP hingga mode agresif/defensif), serta urutan evaluasi anak (*move ordering*)[cite: 1, 2].
* **Alat "Bandingkan Algoritma"**: Sebuah tombol praktis untuk menyimulasikan Minimax, Alpha-Beta, dan Expectimax secara bersamaan pada kondisi (state) HP & SP yang persis sama untuk melihat perbedaan kecepatan dan keputusannya[cite: 1, 2].
* **Experiment Lab**: Terdapat modul terpisah berisi 6 skenario otomatis di mana AI diadu dengan berbagai jenis bot simulasi untuk menguji keampuhan fungsi evaluasinya. Hasil simulasi bisa diunduh langsung dalam bentuk `CSV`[cite: 1, 2].
