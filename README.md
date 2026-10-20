# 🧩 Deadline: Run - Tahap 3 (Raid Planner: CSP & Local Search)
Pengembangan **Tahap 3** dari game **Deadline: Run**. Jika pada tahap sebelumnya game berfokus pada pencarian jalur (*Single-Agent A**) dan duel pertarungan giliran (*Adversarial Minimax*), tahap ini menghadirkan modul **Raid Planner** yang mengorkestrasi kecerdasan buatan sebelum musuh menyerang. Modul ini bertugas meracik komposisi skuad *Anomali Tugas* beserta alokasi item pendampingnya melalui kombinasi *Constraint Satisfaction Problem* (CSP) dan *Local Search* untuk mewujudkan penyesuaian tingkat kesulitan dinamis (*Dynamic Difficulty Adjustment*) agar pertarungan tetap menantang tanpa membuat pemain frustrasi.

Gunakan *readme* ini sebagai petunjuk kontrol, pemahaman mekanik baru, dan panduan eksplorasi fitur diagnostik AI sebelum mencoba permainan atau membaca laporan eksperimen teknis.

## Anggota Kelompok
- Afzaal Zaidan Febryanto - [2508692]
- Ahmad Jadzil Riski - [2501839]
- Muhammad Daffa Safaraz - [2504357]

---

## 🧠 Materi Kecerdasan Buatan (AI)
Tahap 3 memodelkan peracikan skuad penyerang sebagai masalah optimasi kombinatorial dua tingkat yang memadukan penyaringan aturan ketat dengan optimasi kepuasan bermain:

- **Constraint Satisfaction Problem (CSP)**: Solver *Backtracking* sistematis yang memodelkan 3 slot skuad menjadi 6 variabel keputusan (3 karakter dan 3 item) dengan total ruang status mentah sebesar 27.000 kombinasi. Algoritma ini diperkuat oleh:
  - **MRV (Minimum Remaining Values)**: Memprioritaskan variabel dengan sisa domain paling sedikit untuk mendeteksi kegagalan seawal mungkin.
  - **Degree Heuristic**: Menjadi pemutus seri (*tie-breaker*) dengan memilih variabel yang memiliki keterhubungan batasan paling banyak.
  - **LCV (Least Constraining Value)**: Mengurutkan nilai domain yang paling sedikit memangkas pilihan variabel tetangga.
  - **Inference (FC & MAC / AC-3)**: *Forward Checking* dan *Maintaining Arc Consistency* untuk memangkas domain yang inkonsisten selama proses pencarian.
  - **Pembuktian Ketiadaan Solusi**: Mampu membuktikan secara matematis ketika konfigurasi legal mustahil dibentuk akibat anggaran (*budget*) yang terlalu sempit (|S| = 0).
- **Local Search**: Menjelajahi ruang konfigurasi legal (S) hasil saringan CSP untuk meminimalkan fungsi objektif f(s) terhadap target rasio kemenangan (p*) dan target durasi giliran (T*) melalui simulasi cepat:
  - **Steepest-Ascent Hill Climbing**: Mengevaluasi seluruh tetangga legal dan berpindah ke konfigurasi dengan peningkatan terbaik.
  - **Hill Climbing + Sideways Moves**: Mengizinkan perpindahan mendatar hingga kuota tertentu untuk menyeberangi area datar (*plateau / shoulder*).
  - **Random-Restart Hill Climbing**: Melakukan reset status awal secara acak ketika pencarian tersangkut di puncak lokal (*local maximum*).
  - **Simulated Annealing (SA)**: Menerima langkah yang lebih buruk secara probabilistik berbasis suhu (T) dan laju pendinginan (alpha) agar terbebas dari jebakan lokal.
  - **Min-Conflicts**: Solver berbasis perbaikan lokal heuristik untuk menyelesaikan batasan CSP secara cepat.
- **Operator Move Gabungan (Compound Move)**: Mengubah karakter dan item pada satu slot secara serentak untuk mengatasi fenomena *ridge* akibat keterkuncian batasan kompatibilitas.

---

## 🎮 Mekanik & Isi Game (Tahap 3)
Sebelum menyerang pemain di arena, Anomali Tugas merencanakan taktiknya secara adaptif berdasarkan performa permainan mahasiswa.

### ⏱️ Jendela Perencanaan (Grace Period) & Target Adaptif
- Ketika musuh melakukan *respawn*, musuh akan berdiam selama masa *grace period* (2,5 detik) minimal 22 petak dari pemain.
- Raid Planner bekerja di jendela ini dengan batas waktu 2 detik untuk membaca statistik nyawa, kemenangan, dan sisa HP ronde sebelumnya, lalu menetapkan target kemenangan adaptif (p*) serta anggaran biaya skuad (*budget*).

### 🌊 Sistem Pertarungan Gelombang (Wave Battle)
- Pertarungan berlangsung beruntun melawan 1 hingga 3 anggota skuad NPC yang maju satu per satu dari slot 1 hingga slot terakhir.
- HP dan SP pemain (MC) dibawa terus (*carry-over*) antar-gelombang dalam satu sesi *raid* dengan bonus pemulihan parsial saat transisi musuh (+300 HP dan +2 SP).
- Setiap anggota skuad tetap mengambil keputusan aksi pertarungan menggunakan mesin pencarian *adversarial* Minimax, Alpha-Beta Pruning, atau Expectimax dari Tahap 2.

### 👥 Karakter Anomali Tugas Baru
| Kode | Karakter | Cost | HP | Attack | Skill (CD) | Karakteristik Khusus |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **T** | Tugas (*Baseline*) | 3 | 1100 | 100 | 200 (CD: 2) | Memiliki aksi Defend dan Heal 100 (maks 2x). |
| **K** | Kuis Dadakan | 2 | 700 | 120 | 160 (CD: 1) | Cepat dan agresif, tetapi rapuh. |
| **D** | Dosen Killer | 4 | 1500 | 80 | 150 (CD: 2) | Sangat tebal, fokus bertahan lama. |
| **R** | Revisi Tak Berujung | 3 | 900 | 90 | 120 (CD: 2) | Spesialis pemulihan, Heal 150 (maks 3x). |
| **B** | Deadline Besok (*Boss*) | 5 | 1300 | 130 | 260 (CD: 3) | Serangan mematikan; hanya terbuka saat pemain menang >= 2 kali. |

### 🎒 Item Pendamping Musuh
| Item | Cost | Efek Pertarungan | Aturan Kecocokan / Larangan |
| :--- | :---: | :--- | :--- |
| **Kopi** | 1 | Cooldown skill berkurang 1 giliran (CD - 1). | Dilarang dipasangkan ke Kuis Dadakan (**K**). |
| **Contekan Palsu** | 1 | Menahan 50% damage serangan pertama pemain. | Bebas digunakan semua karakter. |
| **Kalkulator** | 2 | Meningkatkan damage skill sebesar +25%. | Dilarang dipasangkan ke Revisi (**R**). |
| **Tumpukan Kertas** | 1 | Menambah jatah pemakaian Heal sebanyak +1. | Hanya boleh dipasangkan ke Tugas (**T**) dan Revisi (**R**). |

---

## ⌨️ Kontrol Permainan
Berikut adalah pintasan (*hotkeys*) yang digunakan selama permainan berlangsung:

- **Peta (Sebelum Battle)**: `W`, `A`, `S`, `D` atau Tombol Panah (Navigasi / Ambil Item).
- **Aksi Battle (MC)**:
  - Basic Attack: `1` atau `J`
  - Skill E: `2` atau `E`
  - Ultimate Q: `3` atau `Q`
  - Pakai Item: `4` atau `R`
- **Buka Menu Utama**: `M`
- **Buka Debug Overlay Tahap 2 (Minimax Battle)**: `O`
- **Buka Debug Overlay Tahap 3 (Raid Planner CSP & LS)**: `P`
- **Layar Penuh (Fullscreen)**: `F`

---

## 🛠️ Fitur Debug Overlay & Experiment Lab (Tahap 3)
Game menyediakan visualisasi diagnostik transparan untuk memeriksa bagaimana batasan disaring dan bagaimana optimasi pencarian lokal bekerja:

- **Panel Debug Raid Planner (`P` / `#pop3`)**:
  - **Squad & Objective Monitor**: Menampilkan komposisi skuad terpilih, total biaya (*cost*), kepatuhan *budget*, target p*, prediksi rasio kemenangan bot p_hat, durasi giliran rata-rata T_bar, dan nilai evaluasi f(s).
  - **Deteksi Failure Mode Live**: Menandai kondisi akhir pencarian secara transparan, seperti *Target Reached*, *Stuck at Local Maximum*, *Stuck at Plateau/Shoulder*, *Stuck at Ridge*, atau *Step Limit*.
  - **Metrik Komputasi CSP**: Melacak jumlah *assignment* yang dicoba, *backtrack*, *constraint checks*, durasi waktu (ms), serta total ukuran ruang legal |S|.
  - **Metrik Komputasi Local Search**: Mencatat jumlah langkah (*steps*), evaluasi fungsi objektif baru di luar *cache*, dan total *node Minimax* yang dibangkitkan selama simulasi.
  - **Inspeksi Tetangga & SA Trace**: Menyajikan tabel evaluasi 6 tetangga (*neighbour*) pada langkah terakhir serta log parameter probabilitas penerimaan langkah acak *Simulated Annealing* (T, delta E, probabilitas, bilangan acak u).
  - **Visualisasi Peta**: Menampilkan *overlay* lencana dan ikon formasi skuad tepat di atas kepala sprite NPC selama masa *grace period*.
  - **Kontrol Parameter Live**: Fleksibilitas mengubah metode pencarian, laju *cooling schedule*, jumlah sampel evaluasi (N), variasi heuristik CSP (MRV, Degree, LCV, FC, MAC), serta aktivasi *move gabungan*.
- **Experiment Lab Tahap 3 (`#lab3` / Tombol 🧪 Lab Tahap 3)**:
  - Lingkungan pengujian otomatis untuk memvalidasi hipotesis ilmiah dari 12 skenario eksperimen (E1 hingga E12).
  - Mencakup pengujian efisiensi heuristik CSP, pembuktian kekerasan anggaran, dampak pemecah simetri C5, skalabilitas slot, komparasi Backtracking vs Min-Conflicts, performa ragam Local Search terhadap *baseline exhaustive*, analisis derau simulasi, penanganan *ridge*, perbandingan arsitektur *Pipeline* vs *Penalti*, efektivitas adaptif DDA, hingga optimasi parameter pendinginan SA.
  - Menyediakan tombol penyalinan dan ekspor unduhan data hasil pengujian langsung dalam format `CSV` untuk kebutuhan analisis laporan teknis.
