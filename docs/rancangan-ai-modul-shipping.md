# Rancangan Diskusi — Modul Logistik (Truk Charter) + AI di QMS ERP

> **Status: DRAFT untuk diskusi, belum dieksekusi.**
> Dokumen ini dipakai sebagai bahan awal di chat baru. Tujuannya menyepakati cakupan, alur, dan prioritas
> sebelum ada kode yang diubah.
>
> **Batasan prototype:** sistem **hanya untuk demo** dengan **data dummy**, memakai AI gratisan (Gemini free tier
> lewat `src/lib/ai.ts`), peta/rute gratis, Vercel Hobby, dan Supabase free.

## 0. Keputusan yang sudah diambil

| Topik | Keputusan |
|---|---|
| Tujuan | **Demo** ke calon pembeli (perusahaan logistik). Semua data **dummy** |
| Arah bisnis | Sistem TMS (*Transport Management System*) untuk perusahaan **truk charter (FTL) dengan armada sendiri** |
| Perusahaan demo | **PT Arunika Trans Nusantara** (fiktif) — lihat 1.1 |
| Penempatan | **Digabung di QMS ERP**, sebagai modul `src/app/modules/logistics/` dengan menu grup "Logistik" |
| Tenant | Satu perusahaan demo saja, belum multi-tenant |
| Truk, rute, tarif | **Dummy**, lihat bagian 1 |
| Uang jalan | Didesain di bagian 4: selisih memakai **saldo uang jalan per sopir** (4.6), tol memakai **beberapa metode** (4.7) |
| Override blokir surat jalan | **Boleh, hanya untuk level tertentu**, dengan aturan di bagian 3.5 |
| Role & hak akses | 7 role logistik (bagian 1.7). **Super Admin tetap bisa mengakses semua** untuk testing |
| Sopir | **Pool sopir lintas jenis kendaraan.** Sopir tidak terikat ke satu truk; boleh membawa jenis apa saja yang sesuai SIM & kualifikasinya (1.3) |
| Kenek | **Dicatat sebagai orang** (nama, HP, identitas), dipilih per trip dari pool kenek (1.3a) |
| Batas jam kerja sopir | **Peringatan saja dulu**, tidak memblokir (1.3b) |
| Saldo uang jalan | Batas **Rp 200.000** dan tenggat **2 hari kerja**, dipakai sementara (4.6) |
| AI | Gemini free tier. Hitungan (tarif, uang jalan, ETA, blokir) memakai kode; AI untuk membaca, merangkum, dan menyusun draft |
| Dokumen armada | **Input dokumen kendaraan & sopir**: riwayat servis, STNK, pajak kendaraan (PKB tahunan), KIR, asuransi, SIM sopir (masa berlaku). Lihat **bagian 10.1** |
| Halaman sopir | **"Driver App" diganti "Fleet Tracking"**: dashboard orang kantor untuk memantau unit yang sedang jalan (bagian 10.2) |
| Komunikasi sopir | **Lewat chat bot Telegram + AI** (gratis, tanpa nomor HP bisnis); sopir tidak perlu login ke ERP. WhatsApp menyusul kalau dipakai sungguhan (bagian 10.3) |

### 0.1 Database & hosting untuk demo dengan data dummy: aman
Ya, **aman**. Data dummy untuk demo (±10 truk, ±12 sopir, puluhan order/trip) hanya beberapa MB, jauh di bawah batas Supabase gratis (±500 MB database, ±1 GB storage). Yang perlu dijaga:

1. **Foto dikompres** di HP (±200 KB per foto: P2H, POD, nota).
2. **Data lokasi GPS dirangkum/dihapus berkala.** Untuk demo, rute perjalanan bisa disimulasikan dari data dummy, jadi tidak harus menunggu truk sungguhan berjalan.
3. **Supabase gratis menjeda proyek** yang tidak dibuka sekitar seminggu. Buka aplikasinya sehari sebelum demo.
4. **Data dummy memakai awalan `DEMO-LOG-`**, supaya bisa diisi ulang atau dibersihkan tanpa menyentuh data Sales/QMS lain.
5. Lisensi Vercel Hobby (non-komersial) **tidak jadi masalah untuk demo**. Baru perlu Vercel Pro kalau kelak benar-benar dipakai operasional oleh klien.

---

## 1. Data dummy

### 1.1 Perusahaan demo
| Item | Isi (dummy) |
|---|---|
| Nama | **PT Arunika Trans Nusantara** (fiktif; ganti bila ternyata ada perusahaan nyata dengan nama sama) |
| Tagline | "Truck Charter · Jawa–Bali · Armada Sendiri" |
| Pool/kantor | Kawasan Industri Contoh, Cikarang, Bekasi (alamat contoh) |
| Logo | Logo dummy (ikon truk, warna oranye + biru tua) |
| Penandatangan | Direktur Operasional: **Rudi Hartono** · Fleet Manager: **Agus Saputra** · Kasir/Finance: **Maya Kartika** (semua fiktif) |

### 1.2 Jenis truk & armada (10 unit)
| Jenis | Kapasitas | Volume | Unit | Konsumsi BBM (km/L) |
|---|---|---|---|---|
| CDE Box (Colt Diesel Engkel) | 2,5 ton | 12 m³ | 2 | 8 |
| CDD Box (Colt Diesel Double) | 5 ton | 20 m³ | 3 | 6 |
| Fuso Wingbox | 8 ton | 32 m³ | 2 | 4,5 |
| Tronton Wingbox | 15 ton | 45 m³ | 2 | 3,5 |
| Trailer 40 ft | 25 ton | 67 m³ (kontainer) | 1 | 2,8 |

Skenario kondisi armada supaya demo blokir terlihat:
- 1 truk **STNK habis**,
- 1 truk **servis overdue**,
- 1 truk **P2H gagal (rem)**,
- 1 truk **dalam perbaikan**,
- sisanya layak.

### 1.3 Sopir: pool lintas jenis kendaraan (12 orang)
Sopir **tidak dipasangkan permanen ke satu truk**. Setiap sopir punya daftar **jenis kendaraan yang boleh dibawa**, lalu dispatcher (atau usulan AI) memilih sopir per trip.

**Aturan kualifikasi (dummy, disederhanakan):**
| Jenis kendaraan | SIM minimal | Syarat tambahan |
|---|---|---|
| CDE Box, CDD Box | B1 Umum | — |
| Fuso Wingbox | B1 Umum | Pengalaman truk sedang ≥ 1 tahun |
| Tronton Wingbox | B1 Umum | Training *defensive driving* + pengalaman ≥ 2 tahun |
| Trailer 40 ft | **B2 Umum** | Training defensive driving + sertifikat trailer/kontainer |

- Kualifikasi dihitung otomatis dari **golongan SIM + masa berlaku**, **training** (modul Training), dan **pengalaman**. Admin juga bisa menambah atau mencabut jenis tertentu secara manual.
- **Sopir langganan (opsional):** satu truk boleh punya sopir utama sebagai preferensi saat dispatch, tapi tidak wajib.

**Komposisi dummy:**
- 3 sopir hanya CDE/CDD,
- 4 sopir CDE–Fuso,
- 3 sopir sampai Tronton,
- 2 sopir semua jenis termasuk Trailer.

Skenario supaya fitur blokir terlihat saat demo:
- 1 sopir **SIM habis bulan ini**,
- 1 sopir **belum ikut training defensive driving** (tidak boleh membawa Tronton),
- 1 sopir **masih punya saldo uang jalan belum di-settle**,
- 1 sopir **sudah 7 hari berturut-turut jalan** (memicu peringatan jam kerja, lihat 1.3b).

Dispatch hanya menawarkan sopir yang **qualified untuk jenis truk order tersebut**. Kalau dipaksa memakai sopir lain, sistem memblokir (lihat 3.5, kondisi #3a).

### 1.3a Kenek (pool kenek, dicatat sebagai orang)
- **Data kenek:** nama, HP, nomor KTP (dummy), foto, status aktif, dan riwayat trip. Kenek **tidak perlu SIM**.
- **Wajib** untuk Tronton dan Trailer, **opsional** untuk jenis lain (mis. muatan banyak bongkar manual).
- **Dipilih per trip** saat dispatch, sama seperti sopir: tidak terikat ke satu truk, dan boleh punya "pasangan sopir langganan" sebagai preferensi.
- **Muncul di dokumen:** nama kenek tercetak di Surat Jalan, dan tercatat di ePOD.
- **Uang makan & menginap kenek** dihitung per orang di uang jalan (4.2). Uang tetap dicairkan lewat sopir sebagai penanggung jawab trip, tapi rinciannya per nama.
- Kenek **tidak punya login** di demo pertama. Opsional nanti: kenek ikut tanda tangan P2H/ePOD dari HP sopir.
- **Data dummy:** 6 kenek. Dispatch menolak menerbitkan Surat Jalan Tronton/Trailer tanpa kenek (kondisi #3b, **bisa di-override Operations Manager**).

### 1.3b Batas jam kerja sopir: **peringatan saja (belum blokir)**
Batas dihitung dari timeline trip (jam berangkat–tiba) dan riwayat hari kerja. Angka dummy:
| Aturan | Batas dummy | Tampilan |
|---|---|---|
| Jam mengemudi per hari | > 10 jam | ⚠️ kuning di papan dispatch + peringatan saat assign |
| Hari kerja berturut-turut | > 6 hari tanpa libur | ⚠️ kuning, saran "istirahatkan sopir" |
| Jeda istirahat antar trip | < 8 jam sejak trip terakhir selesai | ⚠️ kuning |
| Total jam kerja per minggu | > 60 jam | ⚠️ kuning + masuk briefing harian AI |

- Peringatan **tidak menghalangi** dispatch, tapi dispatcher harus mencentang "saya sudah membaca peringatan". Pengakuan ini tercatat di riwayat trip.
- Dashboard menampilkan **daftar sopir berisiko lelah** (bahan untuk audit keselamatan / ISO 39001).
- Nanti bisa dinaikkan menjadi blokir (dengan override) cukup lewat pengaturan, tanpa ubah alur.

### 1.4 Klien (shipper) dummy
| Klien | Industri | Pola order |
|---|---|---|
| PT Sinar Pangan Lestari | FMCG makanan | Rutin Cikarang → Semarang/Surabaya, multi-drop distributor |
| PT Baja Konstruksi Utama | Baja/konstruksi | Tronton/trailer, muatan berat |
| PT Kemas Plastindo | Kemasan plastik | CDD/Fuso, Jabodetabek & Bandung |
| CV Agro Tani Makmur | Pupuk/agri | Musiman, Cirebon & Yogyakarta |
| PT Elektronika Prima Indonesia | Elektronik | Barang bernilai tinggi, wajib asuransi muatan |

### 1.5 Rute (asal pool Cikarang)
| Kode | Rute | Jarak ± | Waktu tempuh ± | Tol (Gol. I/II/III–V) |
|---|---|---|---|---|
| JKT | Cikarang ↔ Jabodetabek | 60 km | 3 jam | Rp 40 rb / 60 rb / 80 rb |
| BDG | Cikarang ↔ Bandung | 130 km | 4 jam | Rp 90 rb / 135 rb / 180 rb |
| MRK | Cikarang ↔ Merak | 150 km | 4 jam | Rp 120 rb / 180 rb / 240 rb |
| CRB | Cikarang ↔ Cirebon | 190 km | 4,5 jam | Rp 150 rb / 225 rb / 300 rb |
| SMG | Cikarang ↔ Semarang | 430 km | 8 jam | Rp 380 rb / 570 rb / 760 rb |
| YOG | Cikarang ↔ Yogyakarta | 540 km | 10 jam | Rp 420 rb / 630 rb / 840 rb |
| SBY | Cikarang ↔ Surabaya | 780 km | 13 jam | Rp 650 rb / 975 rb / 1,3 jt |

Golongan tol: CDE/CDD = Gol. I, Fuso = Gol. II, Tronton/Trailer = Gol. III–V (disederhanakan).

### 1.6 Tarif charter dummy (sekali jalan, all-in BBM + tol + sopir, belum PPN)
| Rute | CDE Box | CDD Box | Fuso Wingbox | Tronton Wingbox | Trailer 40 ft |
|---|---|---|---|---|---|
| JKT | 1.200.000 | 1.800.000 | 2.800.000 | 3.800.000 | 4.500.000 |
| BDG | 2.500.000 | 3.500.000 | 5.000.000 | 7.000.000 | 8.500.000 |
| MRK | 2.800.000 | 3.800.000 | 5.500.000 | 7.500.000 | 9.000.000 |
| CRB | 3.200.000 | 4.500.000 | 6.500.000 | 8.500.000 | 10.000.000 |
| SMG | 5.500.000 | 7.500.000 | 11.000.000 | 15.000.000 | 18.000.000 |
| YOG | 6.500.000 | 8.500.000 | 12.500.000 | 16.500.000 | 20.000.000 |
| SBY | 9.000.000 | 12.000.000 | 17.000.000 | 22.000.000 | 27.000.000 |

**Biaya tambahan (dummy):**
| Komponen | Kecil (CDE/CDD) | Besar (Fuso/Tronton/Trailer) |
|---|---|---|
| Titik bongkar tambahan (multi-drop), per titik | Rp 300.000 | Rp 500.000 |
| Menginap/menunggu (> 12 jam), per hari | Rp 500.000 | Rp 1.000.000 |
| Jasa bongkar muat (TKBM), per trip | Rp 250.000 | Rp 750.000 |
| Pengawalan, per trip | — | Rp 1.500.000 |
| Asuransi muatan | 0,1% × nilai barang (min. Rp 100.000) | sama |
| Diskon kontrak korporat | 5–10% sesuai kontrak | sama |

- **Pajak:** dummy pakai **PPN 11%**. *Catatan: jenis jasa logistik tertentu memakai PPN besaran tertentu, jadi perlu dicek konsultan pajak sebelum dipakai sungguhan.*
- **Muatan balik:** diskon 20% dari tarif rute sebaliknya, karena truk sudah ada di kota tujuan.

### 1.7 Role & hak akses
**Super Admin tetap bisa semua menu dan semua aksi** (izin `all`, seperti sekarang). Role ini dipakai untuk testing; di demo dipakai juga untuk menunjukkan bahwa setiap level punya batasnya.

| Role | Untuk siapa | Bisa | Tidak bisa |
|---|---|---|---|
| **Admin Order / CS** | Penerima order dari klien | Buat & edit order (manual/teks/suara/scan), cek harga, kirim penawaran tarif, lihat tracking, kirim link tracking ke klien | Dispatch, uang jalan, override |
| **Dispatcher** | Pengatur armada harian | Assign truk + sopir, terbitkan Surat Jalan (kalau lolos cek), ajukan uang jalan, pantau trip & peta, ubah status trip | Override blokir, mencairkan uang |
| **Fleet Manager** | Kepala armada/bengkel | Kelola kendaraan, dokumen (STNK/KIR), P2H, maintenance, kualifikasi sopir; **override level Fleet** (kondisi #5–7) | Cairkan uang, ubah tarif |
| **Operations Manager** | Kepala operasional | Semua yang dibisa Dispatcher, ditambah **override level Ops** (#8–9), **approval uang jalan di atas standar sampai 15%**, approval selisih settlement, ubah tarif & rute | Override level Direktur |
| **Kasir / Finance** | Keuangan | Cairkan uang jalan, verifikasi nota & settlement, kelola kartu e-toll (top-up/saldo), terbitkan invoice ke klien, lihat laba/rugi | Dispatch, override |
| **Direktur Operasional** | Pimpinan | Lihat semua + **override level tertinggi** (#10), **approval uang jalan di atas 15%**, dashboard KPI & laba/rugi | — (sebagai approver, bukan pelaksana harian) |
| **Sopir** | Pengemudi | **Lewat chat bot Telegram** (bagian 10.3), bukan login ERP: tugas sendiri, P2H, konfirmasi terima uang jalan, update status, foto muatan/nota, ePOD, lihat saldo uang jalan sendiri | Melihat trip/uang sopir lain, mengubah tarif/order |

**Catatan teknis:**
- Role memakai mekanisme yang sudah ada (Settings → Roles + `rolesConfig`), dengan izin baru, misalnya `logistics`, `logistics_dispatch`, `logistics_fleet`, `logistics_override_fleet`, `logistics_override_ops`, `logistics_override_director`, `logistics_finance`, dan `logistics_driver`.
- **Kenapa override dipisah per level:** supaya satu orang bisa diberi lebih dari satu level. Contohnya, Operations Manager di perusahaan kecil yang merangkap Fleet Manager.
- **Akun demo:** satu per role (mis. `dispatcher@demo.log`, `sopir1@demo.log`), passwordnya dicatat di `CREDENTIALS.local.md`. Super Admin tetap memakai akun yang sama seperti sekarang.
- **Sopir login dari HP** lalu langsung diarahkan ke halaman sopir, bukan dashboard ERP.

---

## 2. Alur bisnis truk charter

```
Klien minta truk ──► Order Charter (asal, tujuan/multi-drop, tanggal muat, jenis truk, muatan, nilai barang)
        ▼
   Harga otomatis: tarif rute × jenis truk + biaya tambahan ──► (penawaran / kontrak tarif klien korporat)
        ▼
   Dispatch: pilih truk + sopir yang LAYAK ──► Surat Jalan + Uang Jalan (bagian 4)
        ▼
   Sopir: P2H ──► menuju lokasi muat ──► muat (foto, segel) ──► jalan (lokasi) ──► bongkar
        ▼
   ePOD (tanda tangan + foto + lokasi + jam) ──► Trip selesai ──► Settlement uang jalan
        ▼
   Invoice ke klien (per trip / rekap bulanan) ──► Laba/rugi per trip · utilisasi truk · klaim ──► NC
```

---

## 3. Fitur yang diminta & rancangannya

### 3.1 Auto-isi dari scan foto/gambar
| Dokumen yang di-scan | Hasil |
|---|---|
| Permintaan truk dari klien (PO, email, screenshot chat, tulisan tangan) | Draft Order Charter |
| Surat jalan/DO dari klien | Nomor referensi klien + daftar muatan |
| Surat jalan bertanda tangan saat bongkar | Trip → Selesai, nama penerima, catatan selisih/rusak |
| STNK / KIR / asuransi / SIM | Masa berlaku → dipakai untuk blokir (3.5) |
| Nota BBM / tol / parkir / timbangan | Realisasi uang jalan (bagian 4) + berat aktual |
| Foto muatan & segel | Jumlah koli/palet, nomor segel, penanda kemungkinan rusak |

AI **hanya mengisi draft**: field yang tidak terbaca ditandai, lalu user memeriksa sebelum menyimpan.

### 3.2 Tracking pengiriman
- **Timeline per trip:** Dijadwalkan → Menuju muat → Muat → Dalam perjalanan → Tiba → Bongkar → Selesai. Setiap tahap mencatat jam, lokasi, dan foto.
- **Lokasi dari HP sopir (web/PWA, gratis):** dikirim tiap 2–5 menit dan ditampilkan di peta Leaflet + OpenStreetMap.
- **Mode simulasi untuk demo:** tombol "jalankan simulasi" menggerakkan truk dummy di sepanjang rute, sehingga peta terlihat hidup saat presentasi.
- **Link tracking untuk klien:** halaman publik per order dengan token acak, tanpa login.
- **ETA** dihitung dari layanan rute gratis, beserta peringatan kalau truk diam terlalu lama atau ETA melewati janji.

### 3.3 Muatan per trip (pengganti "stok" untuk charter)
- Daftar muatan dicatat saat muat lalu **dicocokkan saat bongkar**, termasuk nomor segel. Kalau ada selisih atau kerusakan, **insiden/klaim** dibuat otomatis dan terhubung ke Complaint/NC.
- **Opsional (belum prioritas):** stok ban, sparepart, dan BBM internal lewat modul Maintenance.

### 3.4 Sistem distribusi (dispatch)
- **Papan dispatch:** order yang belum dapat truk dan daftar truk/sopir **yang layak** pada tanggal itu, diurutkan berdasarkan kecocokan (jenis, kapasitas, lokasi, jadwal).
- **Kalender armada:** truk sedang jalan, kosong, atau servis, beserta perkiraan kapan kembali.
- **Multi-drop** dengan urutan titik (rute gratis OSRM/OpenRouteService).
- **Usulan muatan balik:** order lain dari kota tujuan ke arah pool.

### 3.5 Kendaraan terintegrasi → blokir Surat Jalan + override berjenjang
**Surat Jalan tidak bisa diterbitkan dan trip tidak bisa "Berangkat" jika** salah satu kondisi berikut terjadi. Kolom terakhir menunjukkan apakah kondisi itu boleh di-override:

| # | Kondisi | Sumber | Bisa di-override? |
|---|---|---|---|
| 1 | Maintenance **Corrective** belum selesai pada sistem **rem/kemudi/ban/lampu utama** | Maintenance | ❌ **Tidak bisa** (keselamatan) |
| 2 | P2H gagal pada item **kritis** (rem, kemudi, ban, lampu utama, APAR) | P2H | ❌ **Tidak bisa** |
| 3 | **SIM sopir kedaluwarsa** | Master Sopir | ❌ **Tidak bisa** (pelanggaran hukum) |
| 3a | Sopir **tidak qualified untuk jenis truk** ini (golongan SIM tidak sesuai, mis. Trailer tanpa B2) | Kualifikasi sopir (1.3) | ❌ **Tidak bisa** |
| 3b | Tronton/Trailer **tanpa kenek** | Data trip (1.3a) | ✅ Operations Manager |
| — | *Jam kerja sopir melebihi batas* | Timeline trip (1.3b) | ⚠️ **Hanya peringatan**, bukan blokir |
| 4 | **Muatan > 110% kapasitas** truk | Order vs kendaraan | ❌ **Tidak bisa** |
| 5 | STNK/KIR **kedaluwarsa tetapi sedang proses perpanjangan** (ada bukti) | Dokumen kendaraan | ✅ Fleet Manager |
| 6 | **Servis berkala overdue ≤ 1.000 km / ≤ 14 hari** | Maintenance | ✅ Fleet Manager |
| 7 | P2H gagal pada item **non-kritis** (wiper, kebersihan kabin, klakson) | P2H | ✅ Fleet Manager |
| 8 | Muatan 100–110% kapasitas | Order vs kendaraan | ✅ Operations Manager |
| 9 | Sopir **belum training** wajib / masih punya **uang jalan belum di-settle** | Training / Uang jalan | ✅ Operations Manager |
| 10 | Servis overdue > 1.000 km / > 14 hari, atau Corrective selain sistem kritis | Maintenance | ✅ **Hanya Direktur Operasional** |

**Aturan override:**
- **Siapa:** role **Fleet Manager**, **Operations Manager**, dan **Direktur Operasional** (+ Super Admin), sesuai level di tabel. Dispatcher dan sopir tidak bisa.
- **Syarat:**
  - alasan wajib diisi,
  - untuk kondisi 5 wajib upload bukti (mis. tanda terima perpanjangan),
  - wajib memilih tindakan pengendalian (mis. "servis dijadwalkan sepulang trip").
- **Berlaku untuk 1 trip saja**, tidak permanen. Trip berikutnya diblokir lagi kalau kondisinya belum beres.
- **Jejak audit:** siapa, kapan, alasan, dan bukti tercatat di riwayat trip dan kendaraan. Notifikasi dikirim ke atasan, override muncul di **dashboard "Override Bulan Ini"**, dan bisa dijadikan temuan audit internal ISO.
- **Sesudah trip:** maintenance request dibuat otomatis untuk kondisi yang di-override.

**Status kendaraan:** **Siap** (hijau) / **Perhatian** (kuning, bisa jalan dengan override) / **Tidak Layak** (merah, tidak bisa jalan sama sekali), lengkap dengan daftar alasannya.

### 3.6 Fitur pendukung supaya layak dijual
- Master klien, lokasi muat/bongkar (+ koordinat), dan rute langganan.
- Penawaran & kontrak tarif klien korporat (memakai ulang modul Sales).
- **Uang jalan & settlement** (bagian 4), biaya trip, dan **laba/rugi per trip/truk/klien**.
- Invoice ke klien (per trip atau rekap bulanan), dengan lampiran ePOD (memakai ulang modul Invoice).
- ePOD, klaim & insiden (Complaint/NC/HSE), dan kinerja sopir.
- KPI: utilisasi truk, km kosong vs isi, OTIF, biaya/km, dan pendapatan per truk.
- **Profil perusahaan (kop & logo) yang bisa diatur**, supaya dokumen tampil atas nama PT Arunika Trans Nusantara. Saat ini kop masih di-hardcode untuk Labtech.

### 3.7 Otomasi AI
| Otomasi | Pemicu | Peran AI |
|---|---|---|
| Scan → draft order / POD / STNK / nota / segel | Upload foto | Vision: ekstrak field |
| Order dari teks/chat bebas atau **suara** | Tempel teks / 🎤 | Ubah ke order terstruktur |
| Usulan truk + sopir | Order baru | Kode menyaring yang layak; AI menjelaskan alasan |
| Usulan muatan balik | Trip selesai | Kode mencari order searah; AI merangkum |
| **Briefing dispatch harian** | Tiap pagi / tombol | Ringkasan order, truk tidak layak, risiko telat, dokumen hampir habis, settlement tertunda |
| Deteksi risiko keterlambatan | Truk diam / ETA lewat | Kode mendeteksi; AI menyusun pesan ke klien |
| **Cek nota uang jalan** | Upload nota | Vision: nominal, tanggal, jenis; cek duplikat & konsumsi BBM tidak wajar |
| P2H dengan suara | Sopir bicara | Voice-to-text (sudah ada) → checklist terisi |
| Draft penawaran tarif charter | Permintaan klien | Pola draft penawaran AI Sales; harga dari tabel tarif |
| Chat Assistant | Pertanyaan | Tool baru: `track_trip`, `fleet_status`, `quote_charter`, `driver_status`, `draft_order` |

---

## 4. Desain sistem Uang Jalan

### 4.1 Model yang dipakai: **Standar per rute + settlement hybrid**
Model ini umum di perusahaan truk karena seimbang antara kecepatan pencairan dan kontrol biaya:
- **Uang jalan standar** dihitung otomatis per **rute × jenis truk** dari tabel komponen (4.2), jadi dispatcher tidak mengetik nominal sendiri.
- Komponen dibagi dua:
  - **Lumpsum (tanpa nota):** uang makan dan menginap. Dianggap habis, tidak perlu pertanggungjawaban.
  - **Reimburse (wajib nota):** BBM, tol (kalau tidak memakai kartu e-toll perusahaan), parkir/retribusi, dan timbangan. Realisasi dihitung dari nota.
- **Settlement** dilakukan setelah trip selesai: realisasi dibandingkan uang muka, lalu selisihnya dikembalikan atau ditambahkan.

### 4.2 Komponen uang jalan (dummy)
| Komponen | Rumus / nilai dummy | Jenis |
|---|---|---|
| **BBM** | Jarak PP (pulang-pergi) ÷ konsumsi km/L jenis truk × harga solar industri dummy **Rp 12.500/L** | Reimburse (nota SPBU) |
| **Tol** | Tarif tol rute × golongan × 2 (PP) | **Tergantung metode tol trip** (4.7): hanya masuk uang jalan kalau sopir membayar tunai/kartu pribadi |
| **Makan** | Rp 75.000/hari × jumlah hari trip **per orang** (sopir + setiap kenek yang ditugaskan, per nama) | Lumpsum |
| **Menginap** | Rp 150.000/malam **per orang** untuk trip > 1 hari | Lumpsum |
| **Parkir/retribusi/timbangan** | Rp 50.000 (dalam kota) – Rp 150.000 (antarprovinsi) | Reimburse |
| **Biaya tak terduga** | 5% dari total (cadangan) | Reimburse, harus ada alasan |

**Contoh: Tronton Cikarang → Semarang (PP 860 km, 2 hari):**
| Komponen | Hitungan | Nilai |
|---|---|---|
| BBM | 860 ÷ 3,5 × 12.500 | Rp 3.071.000 |
| Tol | 760.000 × 2 | Rp 1.520.000 |
| Makan | 75.000 × 2 hari × 2 orang | Rp 300.000 |
| Menginap | 150.000 × 1 malam × 2 orang | Rp 300.000 |
| Parkir/retribusi | | Rp 150.000 |
| Tak terduga 5% | | Rp 267.000 |
| **Total uang jalan standar** | | **± Rp 5.608.000** |

Tarif charter rute ini Rp 15.000.000, sehingga **margin kotor sebelum biaya tetap** (gaji sopir, penyusutan, servis) ≈ Rp 9,4 juta. Angka ini langsung terlihat di laba/rugi per trip.

### 4.3 Alur uang jalan
```
1. Trip dijadwalkan ──► sistem menghitung Uang Jalan Standar (rincian per komponen)
2. Dispatcher mengajukan (boleh menambah komponen: multi-drop, inap tambahan)
      • Total ≤ standar       → otomatis disetujui
      • Total > standar ≤ 15% → approval Operations Manager
      • Total > 15%           → approval Direktur Operasional
3. Kasir/Finance mencairkan (tunai / transfer ke rekening sopir) ──► Bukti Kas Keluar ber-kop
4. Sopir konfirmasi terima di HP ──► (syarat tambahan sebelum trip boleh Berangkat)
5. Selama trip: sopir memfoto nota ──► scan AI mengisi nominal/jenis/tanggal
6. Trip selesai ──► sopir mengajukan settlement (maks. 2 hari kerja)
7. Kasir memverifikasi nota ──► hitung selisih ──► dicatat di SALDO UANG JALAN sopir (4.6)
8. Settlement selesai ──► biaya trip final ──► laba/rugi trip ──► uang jalan baru boleh diajukan
```

### 4.4 Kontrol & otomasi
- **Sopir dengan settlement tertunda > 2 hari kerja** tidak bisa menerima uang jalan baru (kondisi #9 di 3.5, bisa di-override Operations Manager).
- **Konsumsi BBM tidak wajar:** liter di nota dibandingkan km trip; kalau di luar ±20% dari standar truk, nota ditandai, dan AI menjelaskan kemungkinan penyebabnya (macet, rute memutar, kesalahan input).
- **Nota duplikat** (nomor, nominal, dan tanggal sama) terdeteksi otomatis.
- **Nota di luar rute/tanggal trip** ditandai.
- **Dokumen:** Bukti Kas Keluar Uang Jalan, Lembar Settlement, dan Rekap Uang Jalan per sopir/periode (memakai engine dokumen yang sudah ada).
- **Laporan:** biaya per km per truk, sopir dengan selisih terbanyak, dan uang jalan belum settle.

### 4.5 Data
| Tabel | Isi |
|---|---|
| `TripAllowanceRule` | komponen standar per rute × jenis truk (atau rumus BBM/tol/makan/inap) |
| `DriverAdvance` | uang muka per trip: rincian, status (Diajukan/Disetujui/Dicairkan/Diterima/Settlement/Selesai), approval |
| `TripExpense` | realisasi per nota: jenis, nominal, liter, tanggal, foto, hasil scan AI, penanda anomali, metode bayar |
| `AdvanceSettlement` | total realisasi, selisih, cara penyelesaian, verifikator |
| `DriverLedger` | buku saldo uang jalan per sopir (4.6): setiap mutasi + saldo berjalan |
| `TollCard`, `TollCardTopUp`, `TollTransaction` | kartu e-toll perusahaan (4.7): saldo, top-up, transaksi per trip |

### 4.6 Selisih uang jalan: rekomendasi **"Saldo Uang Jalan" per sopir**
Pilihan "dikembalikan tunai" atau "dipotong dari uang jalan berikutnya" sama-sama punya masalah:
- **Tunai** merepotkan sopir, yang jarang mampir ke kantor, dan rawan tercecer.
- **Potong langsung** tanpa catatan rawan sengketa.

**Rekomendasinya digabung lewat buku saldo per sopir**, seperti rekening kasbon:

```
Saldo sopir = (uang jalan diterima) − (realisasi yang sah) ± (penyesuaian)

Positif  → sopir MEMEGANG uang perusahaan (harus dipertanggungjawabkan / dikembalikan)
Negatif  → perusahaan BERUTANG ke sopir (kekurangan yang belum dibayar)
```

**Aturan yang diusulkan:**
| Situasi setelah settlement | Penanganan |
|---|---|
| **Lebih kecil (sopir sisa uang) ≤ Rp 200.000** | Otomatis jadi saldo dan **mengurangi pencairan uang jalan berikutnya**. Sopir tidak perlu ke kantor |
| **Lebih besar dari Rp 200.000** | Sopir **wajib setor/transfer kembali paling lambat 2 hari kerja**. Selama belum setor, sopir masuk kondisi blokir #9 (bisa di-override Ops) |
| **Kurang (sopir nombok) dan disetujui** | Dibayar ke sopir lewat transfer **bersama pencairan berikutnya**, atau langsung kalau ≥ Rp 200.000 |
| **Kurang tetapi ada pengeluaran tidak sah** (nota tidak valid, di luar rute) | Ditolak sebagian. Alasannya tercatat dan **sopir bisa melihatnya di HP** |
| **Tutup bulan** | Saldo yang masih dipegang sopir lewat 30 hari diminta dikembalikan. **Pemotongan gaji hanya dengan persetujuan tertulis sopir** (sesuai aturan ketenagakerjaan), dan sistem menyimpan bukti persetujuan tersebut |

**Kenapa direkomendasikan:**
- Sopir tidak perlu bolak-balik ke kantor untuk selisih kecil.
- Perusahaan tetap punya kontrol: selisih besar wajib dikembalikan cepat, dan saldo lama terpantau.
- **Transparan:** sopir melihat sendiri saldo dan mutasinya di HP, sehingga sengketa berkurang.
- Finance mendapat **laporan saldo per sopir** dan daftar "uang perusahaan yang dipegang sopir".

Batas Rp 200.000 dan 2 hari kerja adalah **nilai dummy** yang bisa diubah di pengaturan.

### 4.7 Metode pembayaran tol (bisa beberapa)
Metode tol dipilih **per truk sebagai default**, dan bisa diubah **per trip** saat dispatch.

| Metode | Cara kerja | Masuk uang jalan sopir? | Pencatatan biaya |
|---|---|---|---|
| **A. Kartu e-toll perusahaan (per truk)** — *direkomendasikan* | Setiap truk punya kartu (dummy: Mandiri e-Toll / BRIZZI / Flazz / TapCash). Finance mencatat **top-up** dan saldo kartu | ❌ Tidak | Sopir foto **struk/riwayat saldo** di gerbang atau saat tiba, lalu scan AI mencatat transaksinya. Bisa juga direkap dari **riwayat kartu** saat top-up berikutnya |
| **B. Tunai oleh sopir** | Uang tol masuk komponen uang jalan | ✅ Ya (reimburse) | Wajib struk tol per gerbang (scan AI) |
| **C. Kartu e-toll pribadi sopir** | Sopir memakai kartunya sendiri, lalu diganti | ✅ Ya (reimburse) | Foto riwayat transaksi kartu |
| **D. Ditagihkan ke klien (pass-through)** | Untuk klien yang kontraknya "tarif belum termasuk tol" | Tergantung A/B/C | Biaya tol ditambahkan ke **invoice klien** sesuai realisasi |
| E. *Kartu fleet / integrasi transaksi e-toll* | Rekap transaksi otomatis dari penerbit kartu | ❌ | **Nanti (berbayar, butuh kerja sama bank)**, termasuk persiapan MLFF (tol tanpa berhenti) |

**Kontrol tol:**
- **Saldo kartu menipis:** peringatan ke Finance sebelum trip panjang. Dispatch menampilkan "saldo kartu truk ini cukup untuk rute SMG?", dengan estimasi tarif tol × golongan × PP.
- **Tol aktual vs standar rute:** selisih lebih dari ±15% ditandai (mungkin rute memutar atau golongan tidak sesuai).
- **Rekonsiliasi kartu:** total transaksi per kartu dibandingkan selisih saldo antar top-up, sehingga terlihat transaksi yang belum tercatat.
- **Demo:** 7 truk memakai metode A, 2 truk metode B, 1 truk metode C, dan 1 klien kontrak memakai D.

---

## 5. Fitur prioritas untuk demo (detail)

Prioritas disusun dari **skenario demo** ke calon pembeli: apa yang harus bisa ditunjukkan dalam ±15 menit presentasi.

### 5.1 Skenario demo "Satu hari di PT Arunika Trans Nusantara"
1. **Order masuk lewat chat.** Admin menempel chat dari klien, atau bicara lewat 🎤: *"Sinar Pangan butuh tronton wingbox Cikarang ke Semarang besok pagi, 14 ton, 3 titik bongkar"*. AI menyusun order, dan **harga otomatis** muncul dari tabel tarif + biaya multi-drop.
2. **Dispatch.** Sistem menampilkan truk yang **layak** (hijau), **perlu perhatian** (kuning), dan **tidak layak** (merah, dengan alasannya). AI menjelaskan kenapa truk dan sopir tertentu diusulkan.
3. **Blokir surat jalan.** Dicoba memakai truk dengan STNK habis: **diblokir**. Login sebagai Fleet Manager, lalu **override** dengan alasan + bukti, dan semuanya tercatat. Truk dengan rem bermasalah **tidak bisa di-override sama sekali**.
4. **Uang jalan.** Rincian standar muncul otomatis (BBM, tol, makan, inap), lalu disetujui, dicairkan, dan Bukti Kas Keluar ber-kop tercetak.
5. **HP sopir.** Sopir mengisi P2H **dengan suara**, menerima uang jalan, foto muatan + segel, lalu menekan "Berangkat".
6. **Tracking.** Peta menunjukkan truk berjalan (mode simulasi), timeline status, dan ETA. Link tracking dibuka di HP lain sebagai klien.
7. **Bongkar.** ePOD dengan tanda tangan + foto. Ada selisih 2 karton, jadi **klaim otomatis** terbuat dan terhubung ke NC.
8. **Settlement.** Sopir memfoto nota BBM dan tol, AI membaca nominalnya, satu nota ditandai karena konsumsi BBM tidak wajar, lalu settlement selesai.
9. **Uang.** Invoice ke klien tercetak, dan **laba/rugi trip** terlihat (tarif − BBM − tol − uang jalan).
10. **Manajemen.** Dashboard utilisasi armada, OTIF, override bulan ini, dan briefing harian AI. Ditutup dengan bertanya ke AI Assistant: *"truk mana yang paling rugi bulan ini?"*

### 5.2 Daftar prioritas & kriteria selesai

**P1 — WAJIB untuk demo pertama**
| # | Fitur | Yang terlihat di demo | Kriteria selesai |
|---|---|---|---|
| P1.1 | Profil perusahaan + data dummy Arunika | Kop & logo Arunika di semua dokumen; 10 truk, 12 sopir, 5 klien, 7 rute, tarif | Dokumen menampilkan kop Arunika; data dummy bisa diisi ulang tanpa menyentuh data lain |
| P1.2 | Order charter + **harga otomatis** | Form order + kalkulator tarif (rute × truk + biaya tambahan) | Harga persis sesuai tabel; multi-drop/inap/asuransi terhitung |
| P1.3 | **Order dari teks/suara (AI)** | Tempel chat / 🎤 → order terisi | ≥ 4 dari 5 contoh kalimat terbaca benar; field yang ragu ditandai |
| P1.0 | **Role & akun demo** (1.7) | Login per role, menu & tombol menyesuaikan | 7 role berjalan; **Super Admin bisa semua**; sopir login langsung ke halaman sopir |
| P1.4 | Master kendaraan, **pool sopir lintas jenis**, **pool kenek** + **status kelayakan** + **peringatan jam kerja** + **input dokumen armada & sopir** (10.1) | Daftar truk hijau/kuning/merah; sopir dengan jenis kendaraan yang boleh dibawa; kenek per nama; peringatan sopir lelah; upload STNK/pajak/KIR/SIM/servis → masa berlaku terisi | Semua aturan di 3.5 bekerja (termasuk #3a & #3b); peringatan jam kerja muncul dan pengakuannya tercatat; dokumen yang habis/hampir habis langsung memengaruhi status kelayakan |
| P1.5 | **Dispatch + blokir Surat Jalan + override berjenjang** | Coba truk bermasalah → blokir → override sesuai level | Kondisi kritis tidak bisa di-override; override tercatat + muncul di dashboard |
| P1.6 | Dokumen **Surat Jalan** ber-kop | PDF/Word Surat Jalan | Memuat truk, sopir, muatan, segel, rute, dan tanda tangan |
| P1.7 | **Uang jalan** (standar → approval → cair → settlement) + **saldo sopir** + **metode tol** | Rincian otomatis, Bukti Kas Keluar, settlement, saldo sopir, kartu e-toll per truk | Hitungan sesuai rumus 4.2; approval 15% berjalan; aturan saldo 4.6 dan metode tol A–D (4.7) berjalan |
| P1.8 | **Bot Telegram sopir + AI** (10.3): P2H (+suara), status trip (tombol), foto muatan/nota, lokasi live, ePOD | Demo dari HP sopir lewat Telegram | Sopir bisa menjalankan 1 trip penuh hanya lewat chat; semua tercatat di trip |
| P1.9 | **Fleet Tracking (dashboard kantor) + peta + mode simulasi + link klien** (10.2) | Unit yang jalan terlihat di peta + status + ETA + peringatan | Lokasi dari Telegram/simulasi tampil; link klien tanpa login |

**P2 — SANGAT DISARANKAN (memperkuat demo)**
| # | Fitur | Catatan |
|---|---|---|
| P2.1 | Scan nota uang jalan (AI) + deteksi BBM tidak wajar & duplikat | Sangat "menjual" ke pemilik usaha truk |
| P2.2 | Laba/rugi per trip/truk/klien | Pertanyaan pertama biasanya "untung berapa per trip?" |
| P2.3 | Invoice ke klien per trip/rekap (memakai ulang modul Invoice) | Menutup siklus |
| P2.4 | Klaim/selisih muatan → NC | Menonjolkan nilai QMS |
| P2.5 | Briefing dispatch harian (AI) | Ringkas, cocok untuk penutup demo |
| P2.6 | Dashboard KPI: utilisasi, OTIF, override bulan ini, settlement tertunda | |

**P3 — NANTI (setelah demo pertama / kalau ada minat)**
- Usulan muatan balik (AI).
- Optimasi urutan multi-drop.
- Scan STNK/KIR/SIM.
- Kontrak tarif korporat.
- Kinerja sopir & insentif.
- Stok ban/sparepart/BBM.
- Tool Chat Assistant lengkap.
- Laporan mingguan AI.
- Pengaturan menu/role "edisi Logistik".
- Integrasi GPS tracker sungguhan.

### 5.3 Urutan pengerjaan yang diusulkan
| Tahap | Isi | Hasil yang bisa dicoba |
|---|---|---|
| **1** | P1.0 + P1.1 + P1.2 + P1.3 | Login per role; bikin order (manual/teks/suara) dengan harga otomatis |
| **2** | P1.4 + P1.5 + P1.6 | Dispatch, blokir, override, cetak Surat Jalan |
| **3** | P1.7 | Siklus uang jalan lengkap |
| **4** | P1.8 + P1.9 | Demo sopir lewat bot Telegram + dashboard Fleet Tracking |
| **5** | P2.1 – P2.6 | Demo lengkap 10 langkah di 5.1 |
| **6** | P3 sesuai masukan leads | — |

---

## 6. Batasan AI gratis & cara menyiasatinya
- **Kuota Gemini free tier terbatas** dan kadang overload (503), sehingga waktu respon 5–45 detik. Fallback antar-model sudah ada di `src/lib/ai.ts`.
  - Untuk demo: **jangan bergantung pada satu panggilan AI di momen kritis**. Siapkan contoh yang sudah pernah diuji, dan pastikan setiap fitur AI punya jalur manual.
- **Hemat permintaan:** AI tidak dipanggil untuk hitungan, hasil scan dan briefing disimpan (cache), dan kuota per user per hari dipertahankan.
- **Peta & rute gratis:** Leaflet + OSM (perlu atribusi). OSRM publik hanya untuk demo. Rute dummy bisa dihitung sekali lalu disimpan.
- **Geocoding** dengan Nominatim (1 request/detik). Koordinat lokasi dummy diisi langsung di data seed.

---

## 7. Data baru (ringkasan)
| Tabel | Isi utama |
|---|---|
| `CompanyProfile` | nama, logo, alamat, NPWP, penandatangan (menggantikan kop hardcode) |
| `LogisticsClient`, `Location` | klien, lokasi muat/bongkar + koordinat |
| `TruckType`, `Route`, `CharterRate`, `RateSurcharge` | jenis truk, rute, tarif, biaya tambahan |
| `CharterOrder` | klien, rute, titik, tanggal, jenis truk, muatan, nilai barang, harga, status, token tracking |
| `Trip`, `TripStop`, `TripEvent` | truk, sopir, urutan titik, timeline |
| `Vehicle`, `VehicleDocument` | nopol, jenis, kapasitas, link Asset (Maintenance), STNK/KIR/asuransi |
| `Driver` | SIM, masa berlaku, login HP, link Training |
| `PreTripCheck` | P2H: checklist (kritis/non-kritis), hasil, foto |
| `DispatchOverride` | trip, kondisi, level, oleh siapa, alasan, bukti, tindakan pengendalian |
| `TripAllowanceRule`, `DriverAdvance`, `TripExpense`, `AdvanceSettlement` | uang jalan (bagian 4) |
| `DriverLedger` | saldo uang jalan per sopir (4.6) |
| `DriverQualification` | jenis kendaraan yang boleh dibawa sopir + dasar (SIM, training, pengalaman, manual) |
| `Helper` (kenek) + `TripCrew` | data kenek; susunan kru per trip (sopir + kenek, per nama) |
| `DutyLog` | jam kerja sopir dari timeline trip + pengakuan peringatan oleh dispatcher |
| `TollCard`, `TollCardTopUp`, `TollTransaction` | kartu e-toll per truk, top-up, transaksi (4.7) |
| `LocationPing` | posisi truk (asli atau simulasi) |
| `ProofOfDelivery`, `CargoIncident` | ePOD, selisih/klaim → NC |

Semua tabel baru. Modul Shipping lama dan data lain tidak tersentuh.

---

## 8. Pertanyaan yang tersisa (boleh dijawab "pakai default")
Sudah diputuskan: role (1.7), pool sopir lintas jenis kendaraan (1.3), kenek sebagai orang (1.3a), jam kerja sebagai peringatan (1.3b), saldo Rp 200.000 / 2 hari kerja (4.6), dan metode tol (4.7).

**Tanggal demo:** belum ada, target **secepatnya**. Pendekatannya:

### 8.1 Strategi cepat
1. **Kerjakan P1 dulu (Tahap 1–4 di 5.3).** P2 menyusul setelah demo pertama bisa ditunjukkan.
2. **Setiap tahap harus bisa langsung didemokan** begitu selesai (deploy ke qms-erp.vercel.app), supaya bisa presentasi kapan saja dengan fitur yang sudah ada.
3. **Penyederhanaan yang disengaja untuk kecepatan:**
   | Bagian | Versi cepat | Versi lengkap (nanti) |
   |---|---|---|
   | Sopir | **Bot Telegram** (chat + tombol + AI), gratis | WhatsApp Business API (berbayar) bila klien minta |
   | Tracking | **Mode simulasi** + **lokasi live Telegram** dari HP sopir | GPS tracker / aplikasi native |
   | Rute & ETA | Jarak/waktu **dari tabel rute dummy** (1.5) | OSRM/OpenRouteService + peta rute nyata |
   | Peta | Leaflet + titik kota dummy + garis rute sederhana | Rute jalan sebenarnya |
   | Kartu e-toll | Saldo & top-up dicatat manual | Rekonsiliasi lengkap |
   | Settlement | Nota diinput manual + scan AI opsional | Deteksi anomali lengkap (P2.1) |
   | Dokumen | Surat Jalan + Bukti Kas Keluar (memakai engine dokumen Sales) | Manifest, rekap, dll. |
4. **AI hanya di titik "wow":** order dari teks/suara (P1.3) dan P2H dengan suara. Fitur AI lain menyusul.
5. **Data dummy dibuat sekali di awal (P1.1),** supaya setiap tahap langsung terlihat "hidup".

### 8.2 Target per tahap
| Tahap | Isi | Bisa didemokan |
|---|---|---|
| 1 | Role & akun demo, data dummy Arunika, order charter + harga otomatis, order dari teks/suara | "Order masuk lewat chat → harga keluar otomatis" |
| 2 | Kendaraan, **input dokumen armada & sopir (10.1)**, pool sopir & kenek, status kelayakan, peringatan jam kerja, dispatch, blokir + override, Surat Jalan | "Truk bermasalah tidak bisa jalan, kecuali di-override level tertentu" |
| 3 | Uang jalan: standar → approval → cair → settlement → saldo sopir, metode tol | "Uang jalan otomatis & terkontrol" |
| 4 | **Bot Telegram sopir** (P2H suara, status, foto, lokasi live, ePOD) + **Fleet Tracking** kantor + peta simulasi + link tracking klien | **Skenario demo lengkap P1** |

Setelah Tahap 4, skenario demo di 5.1 langkah 1–7 sudah bisa ditunjukkan. Langkah 8–10 (scan nota, laba/rugi, dashboard) masuk P2.

---

## 9. Catatan untuk chat baru
- Proyek: `D:\kerjaan\PT IMAJI\Muse\20. Aplikasi ERP\qms-erp` (Next.js 16 + Prisma + Supabase Postgres, deploy otomatis ke Vercel saat push ke `master`).
- **Database lokal = database online.** Perubahan schema harus bersifat menambah, dan data uji milik user tidak boleh dihapus. Data dummy logistik memakai awalan `DEMO-LOG-` dan diisi lewat script terpisah yang tidak menghapus data lain.
- Modul baru di `src/app/modules/logistics/`. Modul `shipping` lama tetap untuk sisi manufaktur.
- Pola yang bisa dipakai ulang:
  - Engine dokumen PDF/Word: `src/app/modules/sales/documents/` (DocModel + `pdf.tsx` + `docx.ts`; kop perlu dibuat bisa diatur lewat `CompanyProfile`)
  - Scan AI: `src/app/actions/ai-scan.ts` + `src/components/ScanDocumentButton.tsx`
  - Input suara: `src/components/VoiceButton.tsx`
  - Draft AI: `src/app/modules/sales/ai/`
  - Approval + batas hari kerja: pola kontrak di modul Sales (`addBusinessDays`)
  - Tools Assistant: `src/app/ai-agent/tools.ts` + `modules.ts`
  - Library AI: `src/lib/ai.ts` (fallback model, `reasoningEffort`, `deadline`)
- AI tetap **Gemini free tier**. Kunci API hanya ada di environment Vercel, jadi uji AI asli dilakukan di situs online. Untuk uji lokal, pakai server AI tiruan.

---

## 10. Tambahan rancangan (4 Nov 2026)

### 10.1 Input dokumen armada & sopir
Semua dokumen bisa **di-upload (foto/PDF)**. **Scan AI mengisi nomor dan tanggal berlaku** (pola `ai-scan.ts`), lalu user memeriksa. Masa berlaku yang tersimpan langsung dipakai oleh status kelayakan dan blokir Surat Jalan (3.5).

| Dokumen | Untuk | Isi yang dicatat | Pengingat (dummy) | Dampak bila habis |
|---|---|---|---|---|
| **STNK** (5 tahunan) | Truk | No. STNK, nopol, nama pemilik, berlaku s/d, foto | 60 & 30 hari sebelum | Blokir #5 (override Fleet jika ada bukti proses perpanjangan) |
| **Pajak kendaraan / PKB** (tahunan) | Truk | Tanggal jatuh tempo pajak, nominal, tanggal bayar, bukti bayar (foto pengesahan STNK) | 30 & 7 hari sebelum | Diperlakukan sama dengan STNK tidak sah → blokir #5 |
| **KIR** (6 bulanan) | Truk | No. uji, berlaku s/d, foto buku/kartu KIR | 30 & 7 hari sebelum | Blokir #5 |
| **Asuransi kendaraan** | Truk | Polis, perusahaan asuransi, berlaku s/d | 30 hari sebelum | Peringatan saja |
| **Riwayat servis** | Truk | Tanggal, km, bengkel, jenis (berkala/perbaikan), item/sparepart, biaya, foto nota. Servis berkala **menghitung ulang jadwal servis berikutnya** (tanggal & km) | Saat ≤ 14 hari / ≤ 1.000 km | Servis overdue → blokir #6 / #10 |
| **SIM sopir** | Sopir | Golongan (B1/B2 Umum), nomor, berlaku s/d, foto | 60 & 30 hari sebelum | Blokir #3 (tidak bisa override); golongan memengaruhi kualifikasi jenis truk (1.3) |
| Sertifikat training sopir | Sopir | Defensive driving, sertifikat trailer, berlaku s/d | 30 hari sebelum | Kualifikasi Tronton/Trailer gugur (blokir #3a / #9) |

- **Tampilan:**
  - Tab **Documents** di detail truk dan detail sopir, berisi riwayat versi (dokumen lama tidak dihapus).
  - Halaman **"Expiring documents"**: semua dokumen yang habis dalam 60 hari, diurutkan dari yang paling dekat.
  - Pengingat masuk ke notifikasi ERP dan **dikirim ke sopir lewat bot Telegram** untuk SIM-nya sendiri.
- **Hak akses:**
  - Fleet Manager mengelola semua dokumen.
  - Kasir/Finance mencatat pembayaran pajak.
  - Dispatcher hanya melihat.
  - Sopir bisa **mengirim foto SIM/STNK baru lewat Telegram**. Hasilnya masuk sebagai draft, lalu disetujui Fleet Manager.
- **Data:**
  - `VehicleDocument` (truk, jenis, nomor, berlaku dari/s.d., nominal, file, hasil scan AI, status, diverifikasi oleh).
  - `DriverDocument` (sama, untuk sopir).
  - `VehicleServiceRecord` (tanggal, km, bengkel, jenis, item, biaya, nota, jadwal berikutnya).
  - Kolom masa berlaku di `Vehicle`/`Driver` yang sudah ada diisi otomatis dari dokumen terbaru yang terverifikasi.
- **Data dummy:** dokumen untuk ke-10 truk dan 12 sopir, dengan foto contoh (dummy, berwatermark "CONTOH"), mengikuti skenario 1.2 & 1.3 (STNK habis, servis overdue, SIM habis bulan ini). Ditambah **1 truk dengan pajak tahunan telat 5 hari**.

### 10.2 "Driver App" → **Fleet Tracking** (dashboard orang kantor)
Menu **Driver App** di grup Logistik diganti **Fleet Tracking**: layar pantau untuk Dispatcher, Operations Manager, Direktur, dan CS (hanya lihat), seperti "ruang kontrol" armada.

| Bagian | Isi |
|---|---|
| **Peta** (Leaflet + OSM) | Posisi semua unit yang sedang deploy. Warna = status (menuju muat, muat, dalam perjalanan, bongkar, kembali). Klik unit → nopol, sopir + kenek, order, klien, tujuan, ETA |
| **Daftar unit deploy** | Nopol · sopir · rute · status terakhir + jam · lokasi terakhir + "x menit lalu" · ETA vs janji ke klien · sisa titik bongkar |
| **Peringatan** (kode, bukan AI) | Lokasi tidak update > 30 menit · truk diam > 45 menit di luar lokasi muat/bongkar · ETA melewati janji · sopir belum P2H padahal jadwal berangkat sudah lewat · jam kerja sopir (1.3b) |
| **Unit tidak jalan** | Siap di pool / servis / tidak layak (dari 3.5 & 10.1), plus perkiraan kembali |
| **Chat sopir** | Riwayat pesan bot ↔ sopir per trip (status, foto, nota); tombol **"Kirim pesan ke sopir"** yang dikirim lewat bot |
| **Ringkasan AI** (tombol) | "Ringkas kondisi armada sekarang" → AI merangkum unit yang berisiko telat dan menyusun draft pesan ke klien |
| **Mode simulasi** | Tombol "jalankan simulasi" menggerakkan truk dummy di rute (untuk demo tanpa sopir sungguhan) |

- Auto-refresh tiap ±30 detik (polling biasa, tanpa layanan berbayar).
- **Link tracking klien** (3.2) tetap ada: halaman publik per order, isinya versi ringkas dari layar ini.
- Role **Sopir** tidak perlu login ke ERP lagi. Akun `sopir1@demo.log` dan halaman `/driver` dihapus atau dialihkan setelah bot Telegram jalan.

### 10.3 Komunikasi sopir lewat **bot Telegram + AI** (gratis)
**Kenapa Telegram untuk demo:**
- **Bot API Telegram gratis tanpa batas biaya.**
- Tidak perlu nomor HP bisnis, verifikasi perusahaan, atau template pesan.
- Bot dibuat dalam 2 menit lewat **@BotFather**.
- Sopir cukup punya aplikasi Telegram (daftar dengan nomor HP pribadinya sendiri, seperti biasa).

**Pembandingnya, WhatsApp** (Cloud API Meta):
- Perlu akun Meta Business terverifikasi, nomor khusus, dan template pesan yang disetujui.
- **Pesan dikenai biaya per pesan.**
- Lebih cocok nanti kalau klien memakainya sungguhan, karena sopir di Indonesia lebih terbiasa WA.
- Rancangan bot dibuat **tidak terikat ke Telegram**: logikanya dipisah dari "kanal", supaya bisa pindah ke WA tanpa ulang.

**Cara kerja teknis:**
```
Sopir (Telegram)  ──pesan/foto/suara/lokasi──►  Telegram  ──webhook──►  /api/telegram/webhook (Vercel)
                                                                              │ cek secret token
                                                                              ▼
                                                   cari sopir dari chat_id → trip aktif → proses:
                                                   • tombol status → langsung dicatat (tanpa AI)
                                                   • teks/suara bebas → AI (Gemini) pahami maksud
                                                   • foto → AI vision (P2H / nota / POD / segel)
                                                   • lokasi live → LocationPing (Fleet Tracking)
                                                              │
                                                   balas ke sopir lewat sendMessage
```

**1. Menghubungkan sopir:**
- Fleet Manager menekan **"Hubungkan Telegram"** di data sopir. Sistem membuat link sekali pakai, misalnya `t.me/ArunikaTransBot?start=<kode>`, lalu QR/link itu dikirim ke sopir.
- Sopir membuka link → bot mencatat `chat_id` sopir tersebut → "Halo Pak Slamet, akun Anda sudah terhubung".
- Kenek boleh dihubungkan juga (opsional) untuk ikut ePOD.

**2. Yang bisa dilakukan sopir di chat:**

| Kebutuhan | Di Telegram | Peran AI |
|---|---|---|
| Lihat tugas | Pesan pagi otomatis: "Trip besok: SMG, Tronton B 9408 FXD, muat 06:00 di Gudang SPL" + tombol **Terima** | — |
| P2H | Bot mengirim checklist. Sopir menjawab **voice note** ("rem aman, ban kiri depan kurang angin, wiper rusak") **atau** foto + tombol OK/Tidak OK | Suara → teks → checklist terisi; item kritis gagal → trip langsung diblokir (3.5) dan Fleet Manager diberi notifikasi |
| Status trip | **Tombol** (inline keyboard): Berangkat · Tiba muat · Selesai muat · Berangkat kirim · Tiba bongkar · Selesai bongkar | Tanpa AI (hemat kuota, pasti cepat) |
| Lokasi | Sopir menekan **"Bagikan lokasi live"** (fitur bawaan Telegram, sampai 8 jam), lalu bot menerima update posisi berkala | — → tampil di Fleet Tracking |
| Foto muatan & segel | Kirim foto | Vision: jumlah koli/palet, nomor segel |
| Uang jalan | Bot: "Uang jalan Rp 5.608.000 sudah ditransfer" + tombol **Sudah terima**; sopir kirim foto nota | Vision: nominal/jenis/tanggal nota (4.4) |
| ePOD | Foto surat jalan bertanda tangan + nama penerima; atau bot mengirim **link mini-app** untuk tanda tangan di layar HP (Telegram Mini App, gratis) | Vision: nama penerima, catatan selisih → klaim (3.3) |
| Tanya bebas | "Saldo uang jalan saya berapa?", "Alamat bongkar kedua di mana?", "Ban bocor di tol km 120" | AI menjawab dari data trip **milik sopir itu saja**; laporan masalah diteruskan ke Dispatcher |
| Pesan dari kantor | Dispatcher mengetik di Fleet Tracking → sampai di Telegram sopir | — |

**3. Batasan & cara menyiasatinya:**
- **Voice note Telegram berformat OGG/Opus.** `ai.ts` saat ini mengirim audio WAV/MP3, jadi perlu **dicek dulu** apakah Gemini (endpoint OpenAI-compatible) menerima OGG.
  - Kalau tidak menerima, ada dua jalan: panggil Gemini native API khusus untuk audio, atau minta sopir memakai tombol & teks.
- **Kuota Gemini gratis:** tombol status dan lokasi tidak memakai AI. AI hanya untuk suara, foto, dan pertanyaan bebas.
  - Batasi juga jumlah pesan AI per sopir per hari.
- **Batas waktu Vercel Hobby (±60 detik):** webhook langsung membalas "OK" ke Telegram, lalu diproses di latar belakang (`after()` di Next.js). Sopir melihat "⏳ sedang diproses…" kemudian hasilnya.
- **Keamanan:**
  - Token bot hanya ada di env Vercel (`TELEGRAM_BOT_TOKEN`).
  - Webhook diverifikasi dengan `secret_token`.
  - Chat dari nomor yang belum terhubung ditolak.
  - Sopir hanya bisa melihat data dirinya sendiri.
- **Untuk demo:**
  - Satu bot (mis. **@ArunikaTransDemoBot**).
  - HP presenter berperan sebagai sopir "Slamet Riyadi", sementara layar laptop menampilkan Fleet Tracking.
  - Truk lain digerakkan oleh mode simulasi.

**4. Data:**
- `ChatChannelLink` (sopir/kenek ↔ kanal "telegram" + chat_id, kode undangan, terhubung pada).
- `ChatMessage` (trip, sopir, arah masuk/keluar, jenis teks/suara/foto/lokasi/tombol, isi, file, hasil AI, waktu).
- `LocationPing` (sudah direncanakan di bagian 7) diisi dari lokasi live Telegram atau dari simulasi.

**5. Langkah setup (sekali, ±10 menit):**
1. Di Telegram: chat **@BotFather** → `/newbot` → beri nama → simpan token.
2. Simpan token ke env Vercel `TELEGRAM_BOT_TOKEN` dan buat `TELEGRAM_WEBHOOK_SECRET`.
3. Daftarkan webhook sekali: `https://api.telegram.org/bot<token>/setWebhook?url=https://qms-erp.vercel.app/api/telegram/webhook&secret_token=<secret>`. Bisa juga lewat tombol di Settings ERP.
4. Hubungkan sopir demo lewat link undangan (langkah 1 di atas).
