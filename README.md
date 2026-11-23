# 🧠 Deadline: Run - Tahap 4 (Multi-Agent Dynamic Coordination: Knowledge Base & Automated Planning)
Pengembangan **Tahap 4** dari game **Deadline: Run**. Jika pada tahap sebelumnya game berfokus pada navigasi peta (*Single-Agent A*\*), duel taktis giliran (*Adversarial Minimax*), dan orkestrasi pra-pertarungan statis (*CSP & Local Search*), tahap ini menghadirkan sistem **Multi-Agent Dynamic Coordination** yang memadukan penalaran logis berbasis pengetahuan (**Knowledge-Based Reasoning**) dan perencanaan tindakan klasik otomatis (**Automated Planning: PDDL**).

Modul ini mengorkestrasi ekosistem multi-NPC (Anomali Tugas, Revisi, Laporan, dan Dosen Killer) agar berinteraksi secara kooperatif dan otonom melalui siklus kognitif lengkap (**SENSE → TELL → ASK → GOAL → PLAN → EXECUTE → MONITOR/REPLAN**). Agen mampu menarik kesimpulan deduktif mengenai situasi kampus melalui pembuktian teorema logika (*Theorem Proving via Resolution Refutation*), merumuskan rangkaian aksi optimal untuk mencapai target simbolik (*Forward/Backward PDDL Planning*), serta beradaptasi secara reaktif terhadap dinamika permainan yang tidak pasti (*Reactive Execution & Dynamic Replanning*).

Gunakan *readme* ini sebagai petunjuk kontrol, pemahaman mekanik multi-agen baru, dan panduan eksplorasi fitur diagnostik AI sebelum mencoba permainan atau membaca laporan eksperimen teknis.

## Anggota Kelompok
- Afzaal Zaidan Febryanto - [2508692]
- Ahmad Jadzil Riski - [2501839]
- Muhammad Daffa Safaraz - [2504357]

---

## 🧠 Materi Kecerdasan Buatan (AI)
Tahap 4 mengintegrasikan tiga pilar fundamental kecerdasan buatan untuk mewujudkan agen kognitif yang rasional dan adaptif:

### 1. Knowledge Base & Representasi Logika (Logic & Knowledge Representation)
Pengetahuan agen dituliskan secara deklaratif dan terpisah dari kode imperatif program (`KB_DATA` vs `KBEngine`). Hal ini memungkinkan aturan diperbarui, direuse, dan diuji secara modular tanpa merusak alur komputasi game:
- **First-Order Logic (FOL) & Klausa Horn**: Pengetahuan direpresentasikan dalam bentuk predikat, variabel, dan konstanta (seperti `role(revisi, support)`, `friend(X, Y)`, `needs_help(X)`, `should_heal(X, Y)`, `must_retreat(X)`, dan `should_block(X, Z)`). Setiap aturan dikonversi ke dalam bentuk klausa Horn (disjungsi literal dengan paling banyak satu literal positif) yang menjamin inferensi beroperasi dalam batas komputasi polinomial.
- **Closed-World Assumption (CWA) & Negation as Failure (NAF)**: Dunia game mengasumsikan fakta yang tidak dapat dibuktikan dari KB dianggap bernilai salah (*false*). Negasi dimodelkan melalui *negation as failure* (`\+` / `NOT`), memfasilitasi penalaran *default* agen (misalnya `\+ busy(revisi)` bernilai benar selama tidak ada fakta `busy(revisi)`).
- **SLD-Resolution Refutation (Pembuktian Kontradiksi)**: Mesin inferensi menjawab kueri $\alpha$ dengan menambahkan negasi kueri $\neg \alpha$ ke dalam KB, lalu melakukan resolusi berpasangan:
  $$\frac{\ell \vee A, \quad \neg \ell \vee B}{A \vee B}$$
  hingga mencapai klausa kosong ($\square$). Keberhasilan menurunkan $\square$ membuktikan secara matematis bahwa $KB \models \alpha$.
- **Transparansi & Pohon Derivasi (Derivation Tree)**: Setiap keputusan aksi agen memiliki justifikasi logis yang dapat diaudit secara transparan melalui pohon bukti resolusi (misal: `should_heal(revisi, tugas)` terbukti melalui rantai aturan R5 $\leftarrow$ R2 $\leftarrow$ R4).
- **Theorem Proving vs Model Checking**: Mengatasi kelemahan eksponensial tabel kebenaran (*Truth Table Model Checking*) yang meledak pada ruang simbolik besar (35 atom memerlukan evaluasi $2^{35} > 3,4 \times 10^{10}$ model), sedangkan *Resolution Refutation* menyelesaikannya secara instan dalam $< 10$ milidetik.

### 2. Automated Classical Planning (PDDL)
Ketika KB menetapkan tujuan simbolik (*goal*), agen mengonversi situasi dunia menjadi model perencanaan standar PDDL (*Planning Domain Definition Language*):
- **Domain vs Problem PDDL**: Memisahkan skema aksi universal (`move`, `pickup`, `open-gate`, `heal` lengkap dengan *precondition*, *add-list*, dan *delete-list*) dari status spesifik dunia (*objects*, *initial state*, dan *goal condition*).
- **Algoritma Pencarian Ruang Status (State-Space Search)**:
  - **Forward Progression Search**: Menjelajahi suksesor dari status awal menuju target menggunakan **BFS** (menjamin plan terpendek/optimal) atau **A\*** terarah.
  - **Backward Regression Search (Goal-Directed)**: Merambat mundur dari target ke status awal dengan menyeleksi aksi yang relevan (*relevant*, menambahkan fakta goal) dan konsisten (*consistent*, tidak menghapus fakta goal) melalui formulasi regresi $g' = (g \setminus \text{add}(a)) \cup \text{pre}(a)$ hingga $g' \subseteq s_{\text{init}}$.
- **Heuristik Relaksasi Graf Perencanaan (Delete-List Relaxation)**:
  - **$h_{\max}$ Heuristic**: Mengabaikan efek penghapusan (*ignore delete lists*) dan mengestimasi jarak pencapaian sub-goal berdasarkan biaya paralel maksimum pada *relaxed planning graph*.
  - **$h_{\text{FF}}$ (Fast-Forward Heuristic)**: Mengekstrak rencana santai (*relaxed plan*) dari graf perencanaan tanpa *delete-list* untuk menghitung jumlah aksi efektif sebagai pemandu heuristik yang sangat tajam dan efisien.
- **Abstraksi Graf Topologis (Zone Graph)**: Mengabstraksi peta grid $40 \times 40$ (1.600 tile) menjadi 9 zona fungsional diskrit (*Gerbang, Perpus, Lab, Lorong, Pos Dosen, Kantin, Jembatan, Asrama, Kos*) berbasis diagram Voronoi Manhattan dan penapisan konektivitas jalur $A^*$.

### 3. Keputusan & Eksekusi Reaktif di Bawah Ketidakpastian (Decisions & Execution under Uncertainty)
Menghadapi lingkungan eksplorasi dinamis di mana asumsi deterministik klasik dapat terganggu oleh pergerakan pemain atau agen lain:
- **Closed-Loop Execution Monitoring**: Agen tidak menjalankan rencana secara buta (*open-loop*). Pada setiap siklus pembaruan (`tick`), status lingkungan dipantau secara berkala untuk memvalidasi prakondisi aksi.
- **Dynamic Replanning & Failure Recovery**: Jika terjadi disrupsi lingkungan (misal: gerbang Lab terkunci, target berpindah zona, atau jalur terhalang), agen secara otonom memicu *Re-plan* dari status terkini atau membatalkan tujuan jika batas replan terlampaui.
- **Penanganan Edge-Case Plan Nol-Langkah (Zero-Step Planning)**: Saat kondisi aktual agen sudah memenuhi kondisi target ($s_{\text{init}} \models g$), planner menghasilkan plan 0 langkah (`[]`). Agen secara reaktif menandai target selesai dan langsung bertransisi ke status siaga (*standby / ambush*) tanpa memicu kegagalan sistem (*TypeError*).

---

## 🎮 Mekanik & Isi Game (Tahap 4)
Multi-agen berkoordinasi secara dinamis di peta eksplorasi sebelum pertarungan terjadi, menciptakan interaksi gameplay yang cerdas dan hidup.

### 👥 Ekosistem Karakter Multi-NPC
| NPC | Peran Kognitif | Kecepatan Gerak | Perilaku & Interaksi Utama |
| :--- | :---: | :---: | :--- |
| **Anomali Tugas** | *Attacker / Target* | 1 langkah / 250 ms | Musuh utama pemburu pemain. Jika terluka parah (HP $\le 770$), Tugas berhenti mengejar dan menunggu pertolongan Revisi (`wait_heal`). Jika bertemu Dosen, Tugas panik dan lari ke Kos (*retreat*). |
| **Revisi** | *Support / Healer / Interceptor* | 1 langkah / 240 ms | Pendukung setia Anomali. Mengawal Tugas (*escort*), mengambil kunci di Perpus, membuka gerbang Lab, mengambil kopi, dan memulihkan HP Tugas (+300 HP). Jika menerima laporan intel, Revisi bergegas ke chokepoint untuk menyergap dan menahan MC. |
| **Laporan** | *Scout / Intelligence* | 1 langkah / 190 ms | Mata-mata kampus yang berpatroli cepat di Perpus. Membuntuti MC (*shadowing*) pada jarak 4–8 tile saat terdeteksi dan memancarkan sinyal radio intelejen ("MELAPOR") langsung ke Tugas dan Revisi. |
| **Dosen Killer** | *Neutral Threat / Regulator* | 1 langkah / 320 ms | Tokoh berwibawa kampus yang berpatroli perlahan. Menjadi ancaman alami bagi anomali; kehadiran Dosen (sezona atau radius $\le 8$ tile) memaksa Tugas dan Revisi mundur (*retreat*) menjauh ke Kos selama 8 detik. |

### 📜 Aturan Logika Kunci (Knowledge Base Rules)
Basis pengetahuan menyimpan aturan formal penalaran deduktif agen:
- **R1 & R2 (Simetri Aliansi)**: `ally_base(X, Y) ⇒ friend(X, Y)` dan `ally_base(Y, X) ⇒ friend(X, Y)`.
- **R3 (Transmisi Informasi Intelijen)**: `sees(laporan, mc) ∧ at(mc, Z) ∧ friend(laporan, revisi) ⇒ knows_mc_at(revisi, Z)`.
- **R4 & R5 (Evaluasi & Aksi Pertolongan Heal)**:
  - `anomali(X) ∧ hp_low(X) ⇒ needs_help(X)`.
  - `role(X, support) ∧ friend(X, Y) ∧ needs_help(Y) ∧ ¬busy(X) ⇒ should_heal(X, Y)`.
- **R6 & R8 (Protokol Menghindar dari Dosen / Retreat)**:
  - `anomali(X) ∧ at(X, Z) ∧ at(dosen, Z) ⇒ must_retreat(X)`.
  - `anomali(X) ∧ near(X, dosen) ⇒ must_retreat(X)`.
- **R7 (Penyergapan Titik Sempit / Chokepoint Blocking)**:
  - `role(X, support) ∧ knows_mc_at(X, From) ∧ road(From, Choke) ∧ chokepoint(Choke) ∧ ¬busy(X) ⇒ should_block(X, Choke)`.

### ⚡ Efek Pra-Battle & Pertarungan
- **Heal & HP Carry-Over**: Pemulihan HP Tugas oleh Revisi (+300 HP) langsung terbawa ke sesi pertarungan giliran (Tahap 2). Jika pemain kalah dalam pertarungan, sisa HP Tugas dipertahankan untuk putaran berikutnya; jika pemain menang, Tugas di-respawn dengan HP penuh (1100).
- **Chokepoint Interception & Movement Freeze**: Jika pemain berada dalam jangkauan cegat Revisi di chokepoint (Lorong atau Jembatan), pemain tertahan (*frozen*) selama 1.200 ms, memberi kesempatan bagi Tugas untuk mengejar.
- **Alert Signal (Pembatalan Grace Period)**: Jika Laporan mendeteksi pemain saat Tugas baru saja melakukan *respawn* dalam masa *grace period*, sinyal *ALERT* seketika membatalkan masa tunggu sehingga Tugas langsung memburu pemain.

---

## ⌨️ Kontrol Permainan
Berikut adalah pintasan (*hotkeys*) yang digunakan selama permainan berlangsung:

- **Eksplorasi Peta**: `W`, `A`, `S`, `D` atau Tombol Panah (Navigasi).
- **Aksi Pertarungan (MC)**:
  - Basic Attack: `1` atau `J`
  - Skill E: `2` atau `E`
  - Ultimate Q: `3` atau `Q`
  - Pakai Item: `4` atau `R`
- **Navigasi Menu**: `M` (Buka Menu), `F` (Layar Penuh / Fullscreen).
- **Debug Overlay Tahap 2 (Minimax Battle)**: `O`
- **Debug Overlay Tahap 3 (Raid Planner CSP & LS)**: `P`
- **Debug Overlay Tahap 4 - Knowledge Base (KB)**: `K` (atau tombol `#openKB`)
- **Debug Overlay Tahap 4 - Automated Planner (PDDL)**: `L` (atau tombol `#openPL`)
- **Debug Overlay Tahap 4 - Interaksi Multi-NPC**: `I` (atau tombol `#openIN`)

---

## 🛠️ Fitur Debug Overlay & Diagnostic Panels (Tahap 4)
Game menyediakan instrumen diagnostik transparan untuk memeriksa kerja mesin logika, perencana PDDL, dan loop koordinasi agen secara *real-time*:

- **Tab Interaksi NPC (`I` / `#popIN`)**:
  - **Status Agent Live**: Tabel matriks posisi zona, status aksi agen (patroli, membuntuti, mendampingi, menyergap, retreat, wait_heal), dan kepemilikan inventaris (kunci, kopi).
  - **Log Interaksi & Rantai Pembuktian KB**: Menampilkan rekaman event kronologis dengan pewarnaan semantik (`TELL`, `ASK`, `GOAL`, `PLAN`, `REPLAN`, `ACT`, `EFFECT`, `SYS`) lengkap dengan aturan KB yang membuktikannya secara deduktif.
  - **Kontrol & Injeksi Parameter Live**: Fleksibilitas memilih algoritma planner (*A\* h_max*, *A\* h_FF*, *BFS*, *Backward*), mengubah ambang HP rendah, durasi retreat, serta tombol simulasi cepat (`HP Tugas → 400`, `Panggil Dosen ke Tugas`, `Bersihkan Log`).
  - **Penghitung Metrik Kinerja**: Melacak total rencana (*plans*), perencanaan ulang (*replans*), kegagalan rencana, simpul graf yang di-expand, total penyembuhan (*heals*), mundurnya musuh (*retreats*), pencegatan pemain (*blocks*), dan sinyal waspada (*alerts*).
- **Tab Knowledge Base (`K` / `#popKB`)**:
  - **KB Inspector**: Menampilkan aturan First-Order Logic (R1–R8), basis fakta statis peta, serta fakta dinamis yang sedang aktif di dunia game.
  - **Interactive Query Console**: Menguji kueri Prolog arbitrer (misal `should_heal(revisi, tugas).`, `must_retreat(tugas).`, `should_block(revisi, Z).`) secara interaktif dengan visualisasi pohon derivasi resolusi SLD langkah demi langkah.
  - **Model Checking Lab**: Membandingkan efisiensi pembuktian teorema resolusi terhadap pembuktian tabel kebenaran (*truth-table model checking*) yang mengalami ledakan kombinatorial.
- **Tab Automated Planner (`L` / `#popPL`)**:
  - **PDDL Domain & Problem Viewer**: Menampilkan kode representasi domain dan deskripsi problem PDDL yang digenerate secara otomatis sesuai status dunia.
  - **Plan Step Visualizer**: Menampilkan rantai sekuens aksi optimal (`move`, `pickup`, `open-gate`, `heal`), waktu komputasi (ms), serta jumlah node yang dibangkitkan.
  - **Simulasi Rencana Interaktif**: Fitur simulasi mandiri untuk memvalidasi pembentukan rencana aksi dari berbagai konfigurasi zona awal dan target tujuan.
- **Visualisasi Canvas In-Game**:
  - Garis putus-putus kuning disertai label **"MELAPOR"** menghubungkan Laporan ke Tugas saat pemain terpantau.
  - Garis navigasi berwarna menampilkan jalur lintasan rencana gerak Revisi ke lokasi target.
  - Label indikator di atas kepala NPC: `"↩ MUNDUR"`, `"✚ MENUNGGU HEAL"`, dan `"! TERTAHAN"`.
  - Ikon status gerbang Lab kampus (`🔒` terkunci / `🔓` terbuka).
  - Tampilan overlay batas sirkular zona saat panel debug dibuka.
