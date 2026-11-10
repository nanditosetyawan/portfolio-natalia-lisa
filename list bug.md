utorial Setup di cron-job.org (±2 menit)
Daftar / Login: buka https://cron-job.org
 → daftar gratis → verifikasi email → masuk ke dashboard (console.cron-job.org).
Buat Job Baru: buka menu Cronjobs → klik Create cronjob.
Isi tab utama (Common):
Title: isi bebas, misal Supabase Keep Alive
URL: tempel alamat ini: https://anyhuqqnjliepllrkebo.supabase.co/rest/v1/portfolio_profile?select=id&limit=1
Execution schedule: paling praktis pilih Every day (atau pakai Custom di kolom Days of month lalu centang beberapa tanggal tiap 3 hari seperti 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31).
Isi Header Kunci di tab Advanced:
Buka tab/bagian Advanced.
Request method: pastikan GET.
Di bagian Headers, tambah 1 baris:
Key / Name: apikey
Value: copy isi baris 2 file .env (VITE_SUPABASE_PUBLISHABLE_KEY yang berawalan sb_publishable_... — jangan pernah pakai service_role).
Tes Dulu Sebelum Simpan:
Klik TEST RUN → pastikan statusnya 200 OK (kalau 401, cek lagi header apikey), lalu klik CREATE / simpan.











**Yang dikerjakan repo ini:** Aplikasi web portofolio pribadi (*Vue 3 + TypeScript + Vite*) dengan halaman publik dan panel Admin (Editor visual berbasis Draft/Published, galeri sertifikat, pustaka media, serta kotak pesan pengunjung) di atas backend Supabase. Audit ini mengasumsikan **1 admin tunggal** dan **trafik publik rendah–menengah** pada *Supabase Free Tier + static hosting*.

*(Audit bersifat read-only — tidak ada kode sumber maupun database yang diubah; build `vue-tsc --noEmit` & `vite build` lulus dengan 0 error.)*

---

### Must fix

1. **Token login Admin kedaluwarsa diam-diam setelah 1 jam** ([`supabaseAuth.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/lib/supabaseAuth.ts#L29-L77), [`supabaseRestRequest`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/lib/supabaseRest.ts#L4-L47), [`useAuthStore.initialize`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/stores/auth.ts#L17-L29))
   - **Apa ini:** Mekanisme yang menyimpan *access token* (tiket izin sementara dari Supabase Auth berumur ~1 jam) lalu mengirimkannya di setiap request API.
   - **Masalah:** Jika Admin membuka tab Editor lebih dari 1 jam, SDK `supabaseClient` memperbarui sesi baru secara otomatis di memori SDK, tetapi tidak ada pendengar `onAuthStateChange` yang menyinkronkan variabel lokal `accessToken` di [`supabaseRest.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/lib/supabaseRest.ts#L4) — akibatnya tombol **Save Draft**, **Publish**, atau **Messages** langsung gagal 401/RLS meski terlihat masih login.
   - **Fix:** Pasang satu pendengar `supabaseClient.auth.onAuthStateChange` yang memanggil `setSupabaseAccessToken(session?.access_token ?? null)` sekaligus memperbarui `useAuthStore().session`.
   - **Risiko jika dilewati:** Admin bisa kehilangan sesi kerja saat menyunting lama dan gagal menyimpan/menerbitkan perubahan tanpa peringatan sebelum refresh halaman.

2. **Pendaftaran Admin Pertama (`bootstrap`) selalu melempar pesan error** ([`useAuthStore.bootstrap`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/stores/auth.ts#L71-L88), [`AdminBootstrap.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminBootstrap.vue#L38-L50))
   - **Apa ini:** Alur satu kali untuk membuat akun Admin pertama saat situs belum punya pengelola.
   - **Masalah:** Ketika pengguna baru mendaftar lewat `/admin/bootstrap`, fungsi `bootstrap()` memanggil RPC `bootstrap_first_admin()` (berhasil mendaftarkan admin di database), tetapi langsung mengecek `if (!this.isAdmin)` tanpa pernah memanggil `await this.refreshAuthorization()` — jadi nilai `isAdmin` masih `false` dan langsung melempar error palsu.
   - **Fix:** Tambahkan satu baris `await this.refreshAuthorization()` setelah `await this.bootstrapFirstAdmin()` di [`bootstrap`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/stores/auth.ts#L77-L78), persis seperti di fungsi [`login`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/stores/auth.ts#L59).
   - **Risiko jika dilewati:** Setup Admin pertama pada instalasi baru terlihat selalu gagal meski akunnya sudah tercipta di Supabase.

3. **Admin terkunci bila deploy hanya mengisi `VITE_SUPABASE_ANON_KEY`** ([`hasSupabaseAuthConfig`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/lib/supabaseAuth.ts#L6-L86) vs [`supabaseRest.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/lib/supabaseRest.ts#L2), [`supabaseClient.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/lib/supabaseClient.ts#L4))
   - **Apa ini:** Pengecekan apakah environment Supabase Auth sudah dikonfigurasi.
   - **Masalah:** Halaman publik dan `supabaseClient` membaca `VITE_SUPABASE_PUBLISHABLE_KEY ?? VITE_SUPABASE_ANON_KEY`, sedangkan `supabaseAuth.ts` hanya membaca `VITE_SUPABASE_PUBLISHABLE_KEY` — jika server build hanya memakai variabel `VITE_SUPABASE_ANON_KEY`, halaman publik hidup tetapi `useAuthStore.initialize()` langsung berhenti dini sehingga Admin tidak bisa masuk.
   - **Fix:** Samakan baris 6 [`supabaseAuth.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/lib/supabaseAuth.ts#L6) menjadi memakai fallback `?? import.meta.env.VITE_SUPABASE_ANON_KEY`, atau tarik dari satu konstanta yang sama di [`supabaseClient.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/lib/supabaseClient.ts#L4).
   - **Risiko jika dilewati:** Deploy dengan nama variabel key Supabase lama (*anon key*) memblokir akses seluruh panel Admin.

4. **Hapus atau ganti gambar sertifikat memutus foto situs `Published` & bikin urutan foto detail tabrakan** ([`submitCertificate`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminCertificates.vue#L550-L601), [`confirmDeleteCertificate`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminCertificates.vue#L685-L718))
   - **Apa ini:** Penyimpanan dan penghapusan gambar thumbnail/detail pada halaman **Manage Certifikat**.
   - **Masalah:** Saat sertifikat dihapus atau thumbnail-nya diganti, kode langsung menghapus baris `media_assets` + file Storage `published/certificates/...` dan hanya membersihkan referensi di revisi `status = 'draft'` (`L704-L717`), membiarkan snapshot `Published` tetap menunjuk URL yang baru dihapus (gambar jadi 404/pecah di situs publik). Selain itu di baris 584 (`startIndex = existingDetails.value.length`), jika dari 2 foto detail Admin menghapus foto ke-1 lalu menambah foto baru, `order_index` sama-sama menjadi `1`.
   - **Fix:** Jangan hapus asset Storage yang masih direferensikan snapshot `published` aktif (atau perbarui hanya setelah `Published` diperbarui), dan hitung `startIndex` detail baru dari `Math.max(-1, ...existingDetails.value.map(d => d.order_index)) + 1`.
   - **Risiko jika dilewati:** Pengunjung situs utama melihat gambar sertifikat rusak segera setelah Admin menghapus/mengganti foto sebelum mem-publish ulang.

5. **Balapan data sertifikat saat membuka `/` & tombol Refresh menembus snapshot `Published`** ([`CertificateSection.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/sections/certificate/CertificateSection.vue#L111-L115), [`HomePage.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/guest/HomePage.vue#L26-L50), [`publishedRuntime.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/runtime/publishedRuntime.ts#L84), [`useCertificatesStore`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/stores/certificates.ts#L157-L176))
   - **Apa ini:** Sumber data daftar sertifikat pada halaman utama pengunjung (`/`).
   - **Masalah:** Saat `/` dibuka, `CertificateSection.onMounted` langsung memanggil `loadInitial()` yang mengambil tabel `certificates` mentah, sambil paralel `HomePage` mengunduh snapshot `Published` lalu menimpanya lewat `hydrateEditorCards()`. Saat tombol **Refresh** di bawah seksi sertifikat diklik (`L477`), `refreshCertificates()` memanggil tabel `certificates` mentah lagi — menampilkan sertifikat yang baru ditambah Admin meski belum di-Publish.
   - **Fix:** Untuk mode Guest (`!editorPreview`), tunggu/pakai data dari `publishedRuntime` jika ada revisi `published` aktif (termasuk saat klik tombol Refresh: tampilkan semua kartu dari snapshot `Published`, bukan menimpa dengan tabel mentah).
   - **Risiko jika dilewati:** Tampilan kartu sertifikat di situs publik berkedip berubah saat dimuat dan membocorkan data yang belum di-Publish ketika pengunjung menekan Refresh.

6. **Nomor revisi `Rollback` bisa bertabrakan dengan Draf & upload `Publish` memakai nomor revisi keliru** ([`rollback_published_revision`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0019_atomic_publish_pipeline.sql#L360), [`publish_editor_draft`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0028_decouple_draft_save_from_published_base.sql#L67-L69), [`publishDraft`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/repositories/editorRevisionRepository.ts#L598-L600))
   - **Apa ini:** Penomoran berurutan untuk Draf, Publish, dan Rollback pada tabel `site_revisions`.
   - **Masalah:** Terverifikasi langsung di fungsi DB Cloud (`pg_proc`): `rollback_published_revision` masih menghitung nomor revisi baru memakai `current_published + 1`, sedangkan `save_editor_draft` dan `publish_editor_draft` memakai `max(revision_number) + 1` global — akibatnya setelah Publish `#1` dan simpan Draf `#2`, aksi **Rollback** mencoba memasukkan nomor `2` dan gagal bentrok dengan Draf `#2`. Di frontend, `publishDraft` (`L598`) juga memberi nama path Storage memakai `(expectedPublishedRevision ?? 0) + 1` alih-alih nomor revisi DB aktual.
   - **Fix:** Buat migrasi SQL mengganti `current_published + 1` menjadi `coalesce(max(revision_number), 0) + 1` pada `rollback_published_revision`, dan di [`publishDraft`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/repositories/editorRevisionRepository.ts#L598) hindari menyandarkan nama path Storage pada prediksi nomor revisi (mis. pakai prefix `published/<attemptId>/...` atau sinkron dari DB).
   - **Risiko jika dilewati:** Fitur Rollback rusak gagal simpan setiap kali ada Draf yang nomor revisinya lebih tinggi dari versi Published aktif.

7. **Tombol Reset System memusnahkan seluruh riwayat Publish & Riwayat Publish dibatasi 5 item** ([`reset_site_to_default_internal`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0032_delete_published_revisions_on_reset.sql#L17-L28), [`getHistory`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/repositories/editorRevisionRepository.ts#L639-L642))
   - **Apa ini:** Penyimpanan riwayat versi situs yang pernah tayang (`Publish History`) dan fitur kembali ke versi lama (*Rollback*).
   - **Masalah:** Saat **Reset System** dijalankan, migrasi `0032` menghapus permanen seluruh baris `archived`/`published` di `site_revisions` sehingga riwayat sebelum reset langsung hilang 0 baris (tidak bisa rollback). Selain itu tanpa reset pun, [`getHistory`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/repositories/editorRevisionRepository.ts#L640) memasang `limit=5` dan hanya mengambil `status=eq.published` — revisi ke-6 dan seterusnya terpotong tidak bisa dipilih rollback.
   - **Fix:** Jika niatnya mempertahankan jejak rollback lintas reset, cukup tandai `'archived'` tanpa `DELETE` (lalu ubah query riwayat agar juga menampilkan atau menyaring yang relevan, dan naikkan/tambahkan paginasi di `getHistory()` dari `limit=5` ke batas wajar mis. `limit=30`).
   - **Risiko jika dilewati:** Salah klik Reset System atau sudah Publish lebih dari 5 kali menutup jalan kembali ke versi desain lama secara permanen.

8. **File media lama menumpuk di Storage tanpa pembersih (~26,7 MB sampah aktif di Cloud)** ([`prepareSupabasePublishedSnapshot`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/repositories/editorRevisionRepository.ts#L261-L270), [`0032_delete_published_revisions_on_reset.sql`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0032_delete_published_revisions_on_reset.sql#L26-L27))
   - **Apa ini:** Manajemen file fisik di bucket `portfolio-media` Supabase Storage ketika Draf dibuang, Publish diulang, atau Reset System dijalankan.
   - **Masalah:** Setiap Publish menggandakan asset Draf ke `published/<rev>/<assetId>-<attemptId>.ext`, sedangkan Discard Draft dan Reset System hanya menghapus baris database tanpa pernah menghapus objek di Storage. Hasil cek langsung di Cloud membuktikan ada **33 file (~26,7 MB: 28 di `published/`, 5 di `draft/`)** tertinggal yatim saat tabel database kosong (`0` baris).
   - **Fix:** Tambahkan pembersihan Storage (*garbage collection*) untuk path yang tidak lagi dirujuk `site_revisions`, `media_assets`, atau `certificate_images` (mis. lewat tombol/aksi bersihkan di Maintenance atau pasca Discard/Reset).
   - **Risiko jika dilewati:** Kuota gratis Supabase Storage (1 GB) akan habis pelan-pelan oleh duplikat gambar lama yang tidak pernah dipakai lagi.

9. **Mode offline menggantikan halaman yang sudah ter-cache dengan `/offline.html`** ([`sw.js`](file:///d:/DITO/portfolio_natalia/portfolio-project/public/sw.js#L24-L29))
   - **Apa ini:** Service Worker (skrip perantara jaringan di browser agar situs bisa dibuka saat koneksi terputus).
   - **Masalah:** Saat pengunjung membuka kembali `/` dalam keadaan offline, handler `fetch` di baris 28 mengecek `caches.match('/offline.html')` **sebelum** `caches.match(request)` — padahal halaman `/` baru saja di-cache di baris 26, sehingga `/offline.html` yang muncul lebih dulu menimpa halaman portofolio asli.
   - **Fix:** Balik urutannya pada [`sw.js`](file:///d:/DITO/portfolio_natalia/portfolio-project/public/sw.js#L28) menjadi `(await caches.match(request)) || (await caches.match('/')) || (await caches.match('/offline.html'))`.
   - **Risiko jika dilewati:** Pengunjung yang sudah pernah membuka portofolio tetap disuguhi layar "Anda sedang offline" ketika sinyal putus sementara.

10. **Pembatas spam pesan kontak mudah dibypass via header HTTP & cek password bocor Auth masih mati** ([`prepare_message_insert`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0012_message_center.sql#L34-L55))
    - **Apa ini:** Proteksi batas 5 pesan/24 jam pada formulir kontak publik serta keamanan akun login Supabase Auth.
    - **Masalah:** Trigger DB mengambil IP pengirim dari elemen pertama header `x-forwarded-for` yang dikirim klien — bot bisa memalsukan header `X-Forwarded-For` berbeda di setiap request untuk mengirim pesan tanpa batas dan memenuhi tabel `messages` (DoS kuota Free Tier). Di sisi lain, pengecekan Security Advisor Supabase menunjukkan fitur *Leaked Password Protection* (cegah password yang sudah bocor di database kebocoran publik) masih berstatus nonaktif.
    - **Fix:** Gunakan elemen terakhir `x-forwarded-for` sebelum proxy tepercaya (atau `headers ->> 'cf-connecting-ip'` / batas global tambahan bila tanpa proxy terverifikasi), dan aktifkan toggle **Leaked Password Protection** di Supabase Auth Dashboard.
    - **Risiko jika dilewati:** Spam beruntun bisa memenuhi penyimpanan database gratis, dan akun Admin bisa dibuat memakai kata sandi yang sudah bocor.

11. **Tombol WhatsApp, LinkedIn, dan CV di Detail Kontak masih mengarah ke link mati `#`** ([`ContactDetail.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/guest/ContactDetail.vue#L32-L42), [`ContactDetail.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/guest/ContactDetail.vue#L14), [`ContactDetail.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/guest/ContactDetail.vue#L119), [`ContactDetail.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/guest/ContactDetail.vue#L137-L138))
    - **Apa ini:** Halaman detail kontak (`/contact-detail`) tempat pengunjung menghubungi pemilik portofolio.
    - **Masalah:** Tiga tombol sosial media memiliki URL tujuan palsu (`https://wa.me/#`, `https://linkedin.com/in/#`, `#` dengan `target="_blank"`), sehingga saat diklik pengunjung dibawa ke halaman kosong/error situs eksternal; selain itu dua slot foto (`adminInputImage`, `messageInputImage`) selalu `''` dan dua `setTimeout` di `L163` & `L182` tidak dibatalkan saat keluar halaman.
    - **Fix:** Sambungkan URL sosial & foto `/contact-detail` ke data `site` / Editor (atau sembunyikan tombol bila URL belum diisi), hapus `ref` foto mati jika tidak dipakai, dan bersihkan timer di `onBeforeUnmount`.
    - **Risiko jika dilewati:** Pengunjung yang serius ingin menghubungi pemilik portofolio via WhatsApp/LinkedIn/CV mengira situs rusak dan pergi.

---

### Should fix

12. **Font kalender SHS membaca key properti salah & CSS `.about-container` menimpa setting Editor** ([`SHSSection.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/sections/education/shs/SHSSection.vue#L183), [`shs.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/data/default/visual/shs.ts#L33-L238), [`AboutSection.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/sections/about/AboutSection.vue#L352-L356))
    - **Apa ini:** Pengikatan gaya visual (CSS & font) ke konfigurasi yang bisa diubah di Editor.
    - **Masalah:** Teks tahun sekolah SHS membaca `vConfig.calendar.family` sedangkan bagian lain & standar snapshot memakai `fontFamily`; dan di `AboutSection.vue`, nilai dinamis `gap: v-bind(...)` dan `min-height: v-bind(...)` pada baris 352–353 langsung ditimpa deklarasi statis baris 355–356 di aturan CSS yang sama.
    - **Fix:** Seragamkan properti menjadi `fontFamily` di `shs.ts` + `SHSSection.vue` (atau fallback `vConfig.calendar.fontFamily ?? vConfig.calendar.family`), dan hapus dua baris statis penimpa di `AboutSection.vue:L355-356`.
    - **Risiko jika dilewati:** Perubahan font tahun SHS maupun jarak/tinggi seksi About dari Editor tidak berdampak sama sekali di tampilan Guest.

13. **Pencarian Messages menarik ulang seluruh tabel di tiap ketikan & Certificate list mengunduh seluruh `media_assets`** ([`AdminMessages.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminMessages.vue#L200-L210), [`messageRepository.list`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/repositories/messageRepository.ts#L39-L42), [`certificateRepository.list`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/repositories/certificateRepository.ts#L165-L172))
    - **Apa ini:** Query pembacaan daftar pesan di Admin dan daftar aset gambar saat memuat sertifikat.
    - **Masalah:** Mengetik kata di kotak cari Messages memanggil `SELECT * FROM messages` tanpa `limit` pada setiap jeda 180 ms lalu memfilternya di browser; sementara `certificateRepository.list()` mengunduh semua baris `media_assets` di database walau yang dipakai hanya asset sertifikat.
    - **Fix:** Pindahkan filter `search` ke `computed()` lokal di memori `AdminMessages.vue` (atau tambahkan filter + `limit` di REST query), dan batasi query `media_assets` hanya pada `id=in.(...)` yang muncul di `certificate_images` (atau join PostgREST `certificate_images(*,media_assets(*))`).
    - **Risiko jika dilewati:** Menimbulkan lalu lintas database & bandwidth berulang saat kotak pesan membesar atau banyak media tersimpan di Library.

14. **Asset Library menolak upload PDF & AdminCertificates mengunci ekstensi `.webp` serta memakai `alert()`** ([`AdminAssetLibrary.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminAssetLibrary.vue#L276), [`getMediaUrl`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminCertificates.vue#L375-L378), [`removeAsset`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminCertificates.vue#L506-L509), [`saveNewOrder`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminCertificates.vue#L783))
    - **Apa ini:** Kontrol upload file, resolusi URL asset sertifikat, dan notifikasi error urutan.
    - **Masalah:** Dialog upload di Asset Library memakai `accept="image/*"` padahal halaman yang sama sudah punya pratinjau `application/pdf` (baris 339); di `AdminCertificates.vue`, URL & penghapusan selalu memaksa akhiran `${assetId}.webp` tanpa membaca `storage_path` dari tabel `media_assets`, dan gagal simpan urutan masih memunculkan `alert()` bawaan browser yang memblokir layar.
    - **Fix:** Ubah `accept` Asset Library sesuai jenis file yang didukung (`image/*,application/pdf`), baca `storage_path` asli dari join `media_assets`, dan ganti `alert()` baris 783 memakai `productFeedback.error(...)`.
    - **Risiko jika dilewati:** Admin tidak bisa mengunggah PDF lewat tombol Upload Asset Library, dan aset non-WEBP di tabel sertifikat akan gagal tampil atau gagal terhapus.

15. **Import Maintenance tidak mengimpor data & Design System hilang saat ganti browser** ([`AdminMaintenance.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminMaintenance.vue#L36-L48), [`validateBackupValue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/production/backup.ts#L194-L202), [`DesignSystemPanel.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/components/DesignSystemPanel.vue#L264-L268), [`useDesignSystemStore.deleteComponentPreset`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/stores/designSystem.ts#L333))
    - **Apa ini:** Pemulihan backup (*Import*) di Maintenance dan penyimpanan tema/token/template *Design System*.
    - **Masalah:** Tombol **Import** hanya memvalidasi struktur JSON/ZIP tanpa pernah menulis data ke database atau tema lokal — pengguna bisa salah paham mengira restore berhasil. Selain itu seluruh tema, token, dan preset Design System hanya tersimpan di `localStorage` browser lokal, serta **Component presets** di tab Templates (`L266`) belum punya tombol hapus meski aksinya sudah ada (`deleteComponentPreset`).
    - **Fix:** Beri label tombol lebih jujur (`Validate Backup` / `Cek File Backup`) bila memang belum ada restore, atau tambahkan aksi restore; simpan workspace Design System ke `localStorage` + ekspor bersama draft/DB jika ingin lintas perangkat, dan pasang tombol hapus preset memanggil `deleteComponentPreset`.
    - **Risiko jika dilewati:** Pada pemulihan darurat Admin mengira backup sudah ter-restore, atau tema/preset yang disusun di laptop A hilang saat login dari laptop B.

16. **Build produksi diam-diam menghasilkan URL `http://localhost` saat `VITE_SITE_URL` kosong & query `?object=` Editor tidak bereaksi** ([`normalizeSiteUrl`](file:///d:/DITO/portfolio_natalia/portfolio-project/vite.config.ts#L5-L8), [`AdminEdit.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminEdit.vue#L1094-L1143))
    - **Apa ini:** Pembuatan `robots.txt` dan `sitemap.xml` saat build Vite, serta navigasi URL langsung ke objek di Editor.
    - **Masalah:** Jika `VITE_SITE_URL` lupa diisi saat `npm run build`, plugin build diam-diam menulis `http://localhost` ke meta tag HTML, `robots.txt`, dan `sitemap.xml` tanpa warning. Di Editor, `watch` pada baris 1138 hanya memantau `route.query.draft` sehingga berpindah URL antar objek (`?object=<id>` saja) saat Editor sudah terbuka tidak mengarahkan fokus ke objek tujuan.
    - **Fix:** Cetak peringatan `console.warn` (atau gagalkan build saat CI/production) jika `VITE_SITE_URL` kosong di mode produksi, dan tambahkan watcher kecil pada `route.query.object` yang memanggil `selectRegisteredObject` + `focusPreviewObject`.
    - **Risiko jika dilewati:** Situs production terindeks mesin pencari dengan canonical dan sitemap mengarah ke localhost.

17. **Fungsi reset uji `public.test_reset()` masih ada di DB & `AdminLayout.vue` punya wrapper tak terpakai** ([`0031_revoke_obsolete_test_reset.sql`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0031_revoke_obsolete_test_reset.sql#L1-L3), [`pages/admin/AdminLayout.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminLayout.vue#L1-L9), [`components/AdminLayout.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/components/AdminLayout.vue#L51-L53), [`L270-L273`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/components/AdminLayout.vue#L270-L273))
    - **Apa ini:** Sisa fungsi SQL eksperimental di database live serta komponen layout router `/admin`.
    - **Masalah:** `public.test_reset()` masih eksis di DB Cloud (`test_reset_exists: 1`) walau hak eksekusinya dicabut (`REVOKE`); di frontend, `router/index.ts` memuat [`pages/admin/AdminLayout.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminLayout.vue#L1-L9) yang membungkus `<RouterView />` ke dalam [`components/AdminLayout.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/components/AdminLayout.vue#L51-L53) padahal komponen itu langsung merender `<router-view />` sendiri tanpa `<slot />` (slot dibuang). Di file yang sama, `.tbar-btn:disabled` (`L270-273`) memakai `cursor: wait` sehingga tombol Undo/Redo/Publish yang nonaktif tampak seperti macet loading.
    - **Fix:** Jalankan `DROP FUNCTION IF EXISTS public.test_reset();` melalui SQL Editor Supabase; hapus `src/pages/admin/AdminLayout.vue` dan arahkan `router/index.ts` langsung ke `components/AdminLayout.vue` (plus ganti `cursor: wait` menjadi `not-allowed`).
    - **Risiko jika dilewati:** Fungsi destruktif tersisa di skema `public`, dan struktur layout Admin membingungkan saat menelusuri route.

18. **Duplikasi besar di 3 galeri media, duplikasi blok CSS sertifikat, & 3 file mati di `src/`** ([`AdminMediaImages.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminMediaImages.vue#L1-L721), [`AdminMediaDocuments.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminMediaDocuments.vue#L1-L542), [`AdminMediaVideos.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminMediaVideos.vue#L1-L537), [`CertificateSection.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/sections/certificate/CertificateSection.vue#L615-L721), [`TALI-TEMALI_ADMIN_OPENCODE.md`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/TALI-TEMALI_ADMIN_OPENCODE.md), [`global-overrides.css`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/styles/global-overrides.css), [`experienceFrameImages.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/stores/experienceFrameImages.ts))
    - **Apa ini:** Komponen galeri media, blok style sertifikat, serta 3 file di dalam folder `src/` yang tidak pernah di-import dari mana pun.
    - **Masalah:** `AdminMediaImages.vue` (721 baris), `AdminMediaDocuments.vue` (542 baris), dan `AdminMediaVideos.vue` (537 baris) menyalin-tempel header, modal Hapus/Rename, logika `formatBytes`/`confirmDelete`/`confirmEdit`, dan ~143 baris CSS identik (total ~1.800 baris untuk 1 alur galeri). Di `CertificateSection.vue`, baris 665–718 menduplikasi bulat-bulat blok `.title-sparkles` sampai `.line-gap` dari baris 615–664 (54 baris ganda). Ditambah 3 file yang tidak direferensikan di seluruh repo: `TALI-TEMALI_ADMIN_OPENCODE.md` (2.229 baris di dalam folder komponen), `global-overrides.css` (20 baris), dan `experienceFrameImages.ts` (4 baris).
    - **Fix:** Hapus 3 file tak terpakai (atau pindahkan file `.md` ke luar `src/` bila masih diperlukan sebagai arsip), hapus 54 baris CSS duplikat di `CertificateSection.vue`, dan gabungkan 3 galeri media menjadi satu komponen generik berbasis prop jenis media (`image` / `video` / `pdf`).
    - **Risiko jika dilewati:** Perbaikan bug modal atau aksesibilitas galeri harus dikerjakan 3 kali berulang dan berpotensi tidak sinkron.

---

### Nice to have

19. **Smooth scroll paksa mengabaikan *Reduce Motion* OS & request jam Dashboard tanpa timeout** ([`GuestNavbar.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/components/GuestNavbar.vue#L259-L361), [`AdminDashboard.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminDashboard.vue#L241-L269))
    - **Apa ini:** Pengguliran halaman Guest (Lenis) dan sinkronisasi jam WIB di halaman Dashboard Admin.
    - **Masalah:** Saat OS mengaktifkan setelan kurangi animasi (`prefers-reduced-motion: reduce`), navbar Guest tetap mengaktifkan smooth scroll 1,2–1,3 detik dan menyisakan timer `flickTimer`/`setTimeout(..., 1500)` yang tidak dibersihkan di `onUnmounted`; di Dashboard, panggilan `fetch('https://timeapi.io/...')` berjalan tanpa `AbortController` timeout atau cek apakah komponen sudah di-unmount.
    - **Fix:** Nonaktifkan `smoothWheel` dan pakai durasi `0` saat `prefers-reduced-motion: reduce` aktif, bersihkan semua timer di `onUnmounted`, dan tambahkan timeout 5 detik dengan `AbortController` di `syncTime()`.
    - **Risiko jika dilewati:** Pengguna sensitif gerak mengalami pusing saat menggulir, dan tab Dashboard lambat melepas request bila `timeapi.io` terhambat.

20. **Belum ada tes otomatis untuk sinkronisasi hapus gambar sertifikat-vs-Published, refresh JWT 1 jam, & bersih Storage** ([`tests/`](file:///d:/DITO/portfolio_natalia/portfolio-project/tests/))
    - **Apa ini:** Cakupan uji otomatis Playwright runtime yang memvalidasi jalur paling berisiko saat Admin bekerja dengan situs live.
    - **Masalah:** Meski ada 27 skrip runtime di `tests/`, belum ada tes yang memaksa kegagalan pada temuan #1, #4, #6, #8, dan #9 (misal: ganti gambar sertifikat saat revisi `Published` aktif lalu cek Guest `/`, atau uji offline fallback Service Worker saat cache halaman utama sudah ada).
    - **Fix:** Tambahkan masing-masing 1 asersi regresi ringkas saat memperbaiki item-item kritis tersebut.
    - **Risiko jika dilewati:** Regresi yang memutus gambar live Guest atau mengunci Admin setelah 1 jam baru ketahuan setelah deploy.

---

**Verdict:** Perbaiki terlebih dahulu kelompok kritis **#1–#6** dan **#8–#9** (token 1 jam, bootstrap, auth env key, gambar sertifikat vs `Published`, tabrakan nomor `Rollback`, sampah Storage 26,7 MB, dan Service Worker offline) sebelum melakukan publish besar atau promosi publik.
**Lean:** `-2.316 baris` file mati & CSS duplikat terverifikasi (terdiri atas 2.229 baris catatan `.md` liar di `src/pages/admin/`, 87 baris kode/CSS mati & ganda; ditambah **~350+ baris duplikat** bila 3 halaman `AdminMedia*.vue` digabung), `-0 dependensi` npm (keenam package di `package.json` dipakai aktif).
**Not checked:** Suite Playwright runtime (`tests/*.mjs`), audit skor Lighthouse Mobile/Desktop, serta pengecekan baris per baris untuk halaman/komponen di luar fokus audit (`PortfolioSection.vue`, `CollegeSection.vue`, `ContactSection.vue`, `AdminDrafts.vue`, `AdminFavorites.vue`, `AdminLogin.vue`, `AdminMedia.vue`).

---
*Ponytail note — yang dilewati & risiko:* Uji browser Playwright (`tests/*.mjs`) dan Lighthouse tidak dijalankan pada sesi read-only ini, sehingga hanya dijamin kompilasi tipe (`vue-tsc`) dan build Vite plus query DB/Storage langsung; beri tahu nomor temuan mana yang ingin dikerjakan lebih dulu (misal `perbaiki 1, 2, 3, 6`) agar kita eksekusi satu per satu tanpa menyentuh area lain.





