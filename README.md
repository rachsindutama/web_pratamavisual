# PRATAMAVISUAL — Portfolio & Client Portal System

> **Platform Web Fotografi & Videografi Terpadu** yang menggabungkan website portofolio interaktif, pemesanan sesi online (*Client Booking*), portal klien (*Client Portal*), dan sistem manajemen studio / CMS admin (*Admin Dashboard*). Dilengkapi dengan arsitektur penyimpanan hibrida (*Hybrid Storage Architecture*) untuk pengiriman file berukuran besar secara hemat biaya.

---

## Fitur Utama

### 1. Public Experience (Portofolio Publik)
- **Cinematic Visual Experience**: Tampilan modern dengan tema gelap elegan, tipografi tajam, transisi halus, dan animasi responsif.
- **Dynamic Site Branding**: Konten hero, kutipan (*quote*), tautan navigasi, branding, dan footer dikelola dinamis melalui database.
- **Kategori & Album Galeri**:
  - Penjelajahan karya berdasarkan kategori (Wedding, Prewedding, Engagement, dll).
  - Tampilan galeri foto berbasis *Masonry layout* dengan fitur *lightbox preview*, *zoom-pan-pinch*, dan tombol interaktif *like counter*.
- **Katalog Paket Harga & Ekspor Story Instagram**:
  - Penjelasan transparan paket harga, fitur inklusi, dan persentase diskon.
  - **Instagram Story Generator**: Fitur konversi paket ke format Story Instagram (9:16) sekali klik menggunakan *canvas rendering* (`html2canvas`/`html-to-image`) untuk promosi di media sosial.
- **Sistem Booking & Pemesanan Online**:
  - Formulir pemesanan interaktif dengan integrasi peta **Leaflet (OpenStreetMap)** untuk penentuan titik lokasi pemotretan yang akurat via koordinat GPS.
  - Perhitungan estimasi biaya otomatis dengan multi-pilihan paket.
  - Preview invoice digital dan registrasi akun klien secara instan saat booking berhasil dikirim.

---

### 2. Client Portal (Area Klien)
- **Manajemen Booking Klien**: Pelacakan status jadwal pemotretan, riwayat pembayaran cicilan/DP, serta invoice digital.
- **My Photos**: Galeri foto khusus klien dengan kemampuan pratinjau resolusi tinggi.
- **My Files (Hybrid File Storage)**: Pengunduhan file mentah (*RAW files*), arsip ZIP, dan video beresolusi penuh melalui koneksi server studio.
- **Ulasan & Testimoni**: Klien dapat mengirimkan ulasan dan rating langsung dari portal.
- **PWA & Push Notifications**: Mendukung instalasi aplikasi web ke layar utama smartphone/laptop dan penerimaan notifikasi status booking via Firebase Cloud Messaging (FCM).

---

### 3. Admin CMS & Studio Management
- **Dashboard Analitik**: Ringkasan performa studio, statistik kunjungan, dan status pemesanan aktif.
- **Manajemen Booking & Invoice**: Penjadwalan kalender, konfirmasi status (*Pending, Confirmed, Completed, Cancelled*), pencatatan termin pembayaran, dan pengunduhan bukti invoice.
- **Buku Kas & Pajak (Cashflow & Tax)**: Pencatatan arus kas pemasukan dan pengeluaran studio, serta kalkulasi estimasi pajak (PPh / PPN).
- **Manajemen Album & Kategori**: Upload foto, pembuatan album, dan penyusunan urutan foto dengan *drag-and-drop* (`@dnd-kit`).
- **Showcase Video**: Pengelolaan portofolio video (embed YouTube / Vimeo).
- **Pengaturan Paket Harga & Testimoni**: Edit harga paket, aktivasi diskon promo, dan kurasi ulasan yang tampil di website.
- **Kontrol File Server Studio**: Monitor koneksi PC studio/tunnel server untuk pengiriman file master tanpa biaya cloud berlebih.
- **Site Settings & SEO**: Konfigurasi nama brand, logo, favicon, SEO Meta Tags (Title, Description, OG Image), serta background halaman login.

---

### 4. Backend, Cloud Functions & SEO SSR
- **Serverless Cloud Functions**:
  - Otomatisasi pengiriman notifikasi Push (FCM) kepada Admin saat ada booking baru atau pesan masuk.
  - **Dynamic OpenGraph SEO SSR**: Menyuntikkan meta tag media sosial (`og:title`, `og:image`, `og:description`, dan JSON-LD schema) secara langsung pada bot/crawler (WhatsApp, Telegram, Facebook, Twitter) tanpa memerlukan framework SSR yang rumit.
- **Keamanan Berlapis**: Aturan keamanan ketat pada Firestore Rules dan Storage Rules berbasis otentikasi peran (*Role-Based Access Control* / RBAC).

---

## Arsitektur Sistem

```
                      +-----------------------------------+
                      |         KLIEN / PENGUNJUNG        |
                      +-----------------+-----------------+
                                        |
               +------------------------+------------------------+
               |                                                 |
      [ Web App (React + Vite) ]                       [ PWA / Mobile ]
               |                                                 |
               +------------------------+------------------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
     [ Firebase Hosting & Auth ]                [ Cloud Firestore ]
     - Static Bundle / PWA Assets               - Database Portofolio,
     - User Auth & RBAC (Admin/Client)            Booking, Cashflow, Settings
                   |                                         |
                   +--------------------+--------------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
     [ Cloud Functions (Node 20) ]              [ Cloud Storage ]
     - Push Notifications (FCM)                 - Optimized Web Assets
     - Dynamic SEO SSR (OpenGraph)              - Album Cover Images
                   |
                   | (Akses File Klien Berukuran Besar / RAW)
                   v
     +-------------------------------------------------------+
     |   HYBRID LOCAL FILE SERVER (Studio PC / VPS)          |
     |   - Node.js + Express + Multer                        |
     |   - Cloudflare Tunnel / Ngrok                         |
     |   - Melayani streaming & download ZIP bebas kuota     |
     +-------------------------------------------------------+
```

---

## Tech Stack

| Kategori | Teknologi | Deskripsi |
| :--- | :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) | Library UI komponen modern |
| **Build Tool** | [Vite 8](https://vitejs.dev/) | Bundler super cepat dengan HMR |
| **Routing** | [React Router 7](https://reactrouter.com/) | Manajemen rute SPA dan otentikasi proteksi |
| **Styling** | Vanilla CSS Modern | Desain kustom elegan, CSS Variables, fleksibilitas maksimal tanpa utility bloat |
| **Peta & Geocoding** | [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/) | Penentuan lokasi pemotretan interaktif |
| **Ikonografi & Animasi**| [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/) | Ikon vektor dan mikro-animasi antarmuka |
| **Visual Grafis & Ekspor**| [html2canvas](https://html2canvas.hertzen.com/), [html-to-image](https://github.com/bubkoo/html-to-image) | Ekspor story Instagram dan cetak nota |
| **BaaS / Cloud** | [Google Firebase](https://firebase.google.com/) | Auth, Cloud Firestore, Cloud Storage, Hosting, Cloud Functions |
| **File Server (Hybrid)** | Node.js, Express, Multer | Server pengiriman file foto/video ukuran besar |
| **Notifikasi Push** | Firebase Cloud Messaging (FCM) | Notifikasi instan web & mobile via Service Worker |

---

## Struktur Direktori

```
web_pratamavisual/
├── public/                       # Aset publik statis
│   ├── favicon.svg               # Favicon bawaan
│   ├── firebase-messaging-sw.js  # Service worker untuk background push notifications
│   ├── manifest.json             # PWA manifest
│   ├── robots.txt                # Konfigurasi perayap search engine
│   └── sitemap.xml               # Peta situs SEO
│
├── src/                          # Source code aplikasi React
│   ├── components/
│   │   ├── admin/                # Komponen layout & modul khusus Admin CMS
│   │   ├── layout/               # Navbar, Footer, Layout publik & klien
│   │   └── ui/                   # Komponen UI (BookingForm, Lightbox, Cards, Modal)
│   ├── contexts/
│   │   └── AuthContext.jsx       # Global State otentikasi & session pengguna
│   ├── hooks/                    # Custom React hooks (FCM, Firestore, Storage, PWA, dll)
│   ├── lib/                      # Inisialisasi Firebase SDK & helper utilitas
│   ├── pages/
│   │   ├── admin/                # Halaman Dashboard, Cashflow, Bookings, Settings, dll
│   │   ├── client/               # Halaman MyBookings, MyPhotos, MyFiles, Testimonials
│   │   ├── AlbumDetail.jsx       # Detail album galeri foto
│   │   ├── Booking.jsx           # Halaman formulir reservasi klien
│   │   ├── Categories.jsx        # Beranda & daftar kategori
│   │   ├── CategoryDetail.jsx    # Daftar album dalam kategori
│   │   └── Pricing.jsx           # Daftar paket harga & ekspor IG Story
│   ├── styles/                   # Stylesheet Vanilla CSS modular
│   ├── App.jsx                   # Konfigurasi routing utama
│   └── main.jsx                  # Entry point React
│
├── functions/                    # Firebase Cloud Functions (Node.js 20)
│   ├── index.js                  # Handler FCM notifications & Dynamic SEO SSR
│   ├── index.html                # Template HTML dasar untuk injeksi OpenGraph
│   └── package.json              # Dependensi Cloud Functions
│
├── file-server/                  # Server Express Lokal untuk Penyimpanan File Besar
│   ├── SharedFiles/              # Direktori penyimpanan file klien lokal
│   ├── server.js                 # API Express dengan autentikasi Firebase Admin
│   ├── package.json              # Dependensi file server
│   └── .env.example              # Contoh variabel environment file server
│
├── firestore.rules               # Aturan keamanan database Firestore
├── firestore.indexes.json        # Definisi indeks komposit database Firestore
├── storage.rules                 # Aturan keamanan Firebase Storage
├── firebase.json                 # Konfigurasi deployment Firebase (Hosting & Functions)
├── vite.config.js                # Konfigurasi bundler Vite & PWA
└── package.json                  # Dependensi utama proyek
```

---

## Panduan Memulai (Local Development)

### 1. Prasyarat Sistem
- **Node.js**: versi 20 atau yang lebih baru ([Unduh Node.js](https://nodejs.org/))
- **NPM** atau package manager kompatibel
- Akun dan project di **Firebase Console**

---

### 2. Kloning Repository & Instalasi Dependensi

```bash
# Kloning repository
git clone https://github.com/rachsindutama/web_pratamavisual.git
cd web_pratamavisual

# Install dependensi frontend utama
npm install

# (Opsional) Install dependensi cloud functions
cd functions && npm install && cd ..

# (Opsional) Install dependensi file server lokal
cd file-server && npm install && cd ..
```

---

### 3. Konfigurasi Environment Variables (`.env`)

Buat file `.env` pada direktori root proyek:

```env
# Firebase Web Client Configuration
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...

# Admin & Server Integrations
VITE_DEFAULT_ADMIN_ID=...
VITE_FILE_SERVER_URL=http://localhost:4567
```

---

### 4. Menjalankan Aplikasi Secara Lokal

#### Menjalankan Web Portofolio (Frontend):
```bash
npm run dev
```
Buka browser pada alamat [http://localhost:5173](http://localhost:5173).

#### Menjalankan File Server Lokal (Penyimpanan File Mentah/Client Files):
```bash
cd file-server
# Pastikan sudah meletakkan service-account.json di dalam folder file-server/
npm start
```
File server akan berjalan pada `http://localhost:4567`.

---

## Build & Deployment

### 1. Build Bundle Frontend untuk Produksi
```bash
npm run build
```
Perintah ini akan membuat folder `dist/` dan secara otomatis memperbarui template SSR di `functions/index.html`.

### 2. Deploy ke Firebase Hosting & Cloud Functions
Pastikan Anda telah login ke Firebase CLI (`npm install -g firebase-tools` lalu `firebase login`):

```bash
# Deploy seluruh komponen (Hosting, Functions, Rules)
firebase deploy

# Atau deploy per komponen spesifik:
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

---

## Praktik Keamanan & Proteksi Data

1. **Proteksi Kredensial**:
   - Seluruh kunci privat (seperti file `service-account.json`) dan token konfigurasi lingkungan (`.env`) secara ketat diatur dalam `.gitignore` dan tidak boleh di-push ke repository publik.
2. **Role-Based Access Control (RBAC)**:
   - Akses halaman admin `/admin/*` diverifikasi ganda melalui `ProtectedRoute.jsx` di sisi klien serta validasi token Firestore di sisi server.
3. **Anti Download Proteksi**:
   - Proteksi klik kanan diaktifkan untuk meminimalisir pembajakan aset visual foto resolusi tinggi secara sembarangan.

---

## Lisensi & Hak Cipta

© 2026 **PRATAMAVISUAL**. Seluruh hak cipta dilindungi undang-undang.  
Didesain dan dikembangkan secara eksklusif untuk portofolio dan sistem operasional PT Pratamavisual Media Kreatif.
