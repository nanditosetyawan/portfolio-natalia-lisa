# Panduan & Rencana Teknis Migrasi Database 1:1 ke Akun Supabase Baru

Dokumen ini adalah panduan operasional **gaya Ponytail** (langkah seminimal mungkin yang lengkap, deterministik, bebas *bloat*) untuk merekonstruksi ulang seluruh skema database PostgreSQL dan Storage proyek ini secara **100% identik (1:1)** pada akun/proyek Supabase Cloud baru **tanpa fitur backup berbayar Supabase**, termasuk saat jumlah file migrasi terus bertambah (`0040`, `0041`, dst.).

> **Status Repo Saat Ini (2026-11-12):**
> - DB Cloud aktif saat ini dan [`supabase/migrations/`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations) sinkron di **`0001`–`0039`** (`39` file lokal; [`src/types/database.generated.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/types/database.generated.ts) cocok byte-for-byte `30.909` byte).
> - **Belum aman dijalankan langsung di proyek kosong baru hari ini** sebelum 3 penyesuaian pra-migrasi di [Bagian 3](#3-celah-replay-saat-ini--solusi-ponytail-wajib-sebelum-migrasi-pertama) diterapkan (disarankan dilakukan 1x saat semua item di [`list bug.md`](file:///d:/DITO/portfolio_natalia/portfolio-project/list%20bug.md) selesai).

---

## 1. Tujuan, Ruang Lingkup & Prinsip Ponytail

### 1.1 Apa yang Dibentuk Ulang 1:1
Menjalankan migrasi berurutan pada proyek Supabase baru membentuk ulang secara penuh:
1. Seluruh **22 tabel `public`** beserta kolom, tipe data, default, `PRIMARY KEY`, `UNIQUE`, `CHECK`, dan **13 `FOREIGN KEY`** (`ON DELETE CASCADE / RESTRICT / SET NULL`).
2. **Row Level Security (RLS)** aktif (`true`) pada semua `22` tabel dengan **98 policy** (`public`/`private`) serta **6 policy** pada `storage.objects`.
3. **21 fungsi** (`13` di skema `public`, `8` di skema `private`), **23 trigger** non-internal, **52 index** `public`, dan hak akses role (`anon`, `authenticated`, `service_role`).
4. Ekstensi (`pgcrypto`, `pg_cron`) beserta jadwal **1 cron job** (`messages-auto-delete`, setiap 15 menit).
5. **Storage bucket kosong `portfolio-media`** (`public = true`) yang langsung siap menerima upload gambar/video/PDF Admin serta URL publik Guest `/published/*`.

### 1.2 Apa yang Sengaja Kosong / Di Luar SQL
| Komponen | Perilaku di Proyek Baru | Cara Mengisi (Jika Diperlukan) |
|---|---|---|
| Akun Login (`auth.users`) & `admin_memberships` | Mulai **kosong** (sesuai kebutuhan) | Daftar/buat user baru lalu klaim admin perdana lewat `/#/admin/bootstrap` atau `/#/admin/login` (lihat [Tahap 4](#tahap-4--hubungkan-aplikasi--klaim-admin-pertama)). |
| File Fisik Storage (`portfolio-media/*`) | Bucket terbentuk **kosong** & siap upload | Upload media baru langsung dari `/#/admin/media` atau Editor. |
| Data Konten (`site_revisions`, dsb.) | Kosong → Guest memakai default aplikasi | Opsional: **Export JSON** di menu `/#/admin/maintenance` proyek lama, lalu **Validate & Restore** di proyek baru. |
| Pengaturan Auth Dashboard non-SQL | Default proyek Supabase baru | Atur manual di Dashboard Auth (mis. Email Confirmation, Site URL, atau *Leaked Password Protection*). |

### 1.3 Aturan Emas Ponytail (Anti-Duplikasi & Tahan Pertumbuhan)
- **Jangan pernah menggabungkan (*squash*) atau menulis ulang migrasi lama (`0001`–`0039`) yang sudah tercatat di Cloud aktif** — kecuali penambahan guard idempoten murni (`to_regprocedure` / `if not exists`) yang bersifat *no-op* di DB aktif.
- **Semua perubahan skema di masa depan wajib *append-only*** dengan nomor urut baru (`0040_...sql`, `0041_...sql`, dst.). Dengan pola ini:
  - Proyek yang **sudah berjalan** cukup mengeksekusi file baru saja (`0040+`).
  - Proyek **baru** mengeksekusi `0001` s/d nomor terakhir (`004N`) sekali jalan dan hasil akhirnya tetap 1:1.

---

## 2. Spesifikasi Target 1:1 (Baseline `0001`–`0039`)

Struktur berikut sudah diverifikasi langsung terhadap katalog PostgreSQL Cloud aktif (`list_tables`, `pg_constraint`, `pg_policies`, `pg_proc`, `storage.buckets`, `cron.job`).

### 2.1 Ringkasan Objek Database & Storage
| Kategori | Jumlah Target | Catatan Teknis |
|---|---|---|
| Tabel `public` (`rls_enabled = true`) | **22** | Semua tabel wajib `relrowsecurity = true` |
| Foreign Key (`contype = 'f'`) | **13** | Integritas relasi lintas tabel & `auth.users` |
| Total Constraint Tabel `public` | **62** | PK, FK, UNIQUE, CHECK (sudah `VALIDATE` di `0023`) |
| Index `public` | **52** | Termasuk PK, Unique, FK indexes (`0003`, `0006`, `0018`, dll.) |
| Trigger `public` (non-internal) | **23** | `touch_*`, limit Draft/Favorite, sanitasi & rate-limit Messages |
| RLS Policy (`public` + `private`) | **98** | Akses minimal `anon` vs admin `private.is_admin()` |
| RLS Policy (`storage.objects`) | **6** | `admin` R/I/U/D; `anon` & `authenticated` baca `published/*` |
| Fungsi `public` / `private` | **13** / **8** | `public.test_reset()` **0** (dihapus `0039`); `rls_auto_enable()` bawaan Cloud |
| Storage Bucket (`storage.buckets`) | **1** | `id = 'portfolio-media'`, `public = true`, limit `null` |
| Scheduled Cron (`cron.job`) | **1** | `messages-auto-delete` (`*/15 * * * *`) → `private.purge_expired_messages()` |

### 2.2 Peta 22 Tabel & Seluruh 13 Relasi (`FOREIGN KEY`)
1. **Akses Admin & Workspace Pengguna (`auth.users`)**
   - `admin_memberships` (`4` col) → FK `user_id` → `auth.users(id)` `ON DELETE CASCADE`
   - `design_system_workspaces` (`4` col, [`0038`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0038_design_system_workspaces.sql)) → FK `user_id` → `auth.users(id)` `ON DELETE CASCADE`
2. **Konten Situs & Navigasi**
   - `portfolio_profile` (`7` col)
   - `about_sections` (`8` col)
   - `about_paragraphs` (`7` col) → FK `about_section_id` → `about_sections(id)` `ON DELETE CASCADE`
   - `education_sections` (`5` col)
   - `college_entries` (`11` col: `0001` + `0007`)
   - `shs_entries` (`11` col: `0001` + `0007`)
   - `experiences` (`9` col)
   - `certificate_sections` (`7` col: `0001` + `0007`)
   - `certificates` (`8` col)
   - `contact_profiles` (`14` col: `0001` + `0037` sosial WhatsApp/LinkedIn/CV)
   - `navigation_items` (`10` col, `unique(item_key)`)
   - `navigation_config` (`5` col, [`0007`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0007_canonical_persistence_gaps.sql))
3. **Media, Frame & Visual Konfigurasi**
   - `media_assets` (`11` col)
   - `entity_media` (`8` col, `unique(owner_type, owner_id, role)`) → FK `media_asset_id` → `media_assets(id)` `ON DELETE RESTRICT`
   - `photo_frames` (`12` col: `0001` + `0007`, `unique(owner_type, owner_id, role)`) → FK `media_asset_id` → `media_assets(id)` `ON DELETE SET NULL`
   - `certificate_images` (`9` col, `unique(certificate_id, role, order_index)`) → FK `certificate_id` → `certificates(id)` `ON DELETE CASCADE`; FK `media_asset_id` → `media_assets(id)` `ON DELETE SET NULL`
   - `entity_visual_configs` (`5` col, PK `(entity_type, entity_id)`)
4. **Revisi Editor, Publish Atomik & Favorit**
   - `site_revisions` (`15` col: [`0014`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0014_site_revisions.sql), [`0016`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0016_draft_lock_version.sql), [`0019`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0019_atomic_publish_pipeline.sql), [`0027`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0027_allow_published_draft_deletion.sql))
     - FK `created_by` → `auth.users(id)`
     - FK `published_by` → `auth.users(id)` `ON DELETE RESTRICT`
     - FK `source_draft_revision_id` → `site_revisions(id)` `ON DELETE SET NULL` (`0027`)
     - FK `rollback_source_revision_id` → `site_revisions(id)` `ON DELETE RESTRICT`
   - `editor_favorites` (`4` col, `unique(user_id, revision_id)`, [`0015`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0015_draft_library_favorites.sql))
     - FK `user_id` → `auth.users(id)` `ON DELETE CASCADE`
     - FK `revision_id` → `site_revisions(id)` `ON DELETE CASCADE`
5. **Pusat Pesan Publik & Rate Limit**
   - `messages` (`12` col: [`0012`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0012_message_center.sql) + [`0013`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0013_message_read_state.sql); hardening [`0036`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0036_harden_message_rate_limit.sql))

### 2.3 Matriks Hak Akses Role (`anon` vs `authenticated` vs `service_role`)
- **`anon`**: hanya `SELECT` pada 17 tabel konten/media/navigasi (plus RPC `get_active_published_snapshot()`) dan `INSERT` terbatas pada `messages` (`is_saved = false and expires_at is not null` + trigger anti-spam 5/IP/24j, 30/global/1j, 500 backlog). Tidak punya akses `SELECT` ke `site_revisions`, `admin_memberships`, `editor_favorites`, `design_system_workspaces`, maupun `messages`.
- **`authenticated`**: hanya berjalan efektif bila lolos `(select private.is_admin())` (plus `user_id = (select auth.uid())` pada tabel milik user seperti `design_system_workspaces`, `editor_favorites`, draft `site_revisions`), serta `bootstrap_first_admin()` saat `admin_memberships` masih kosong.
- **`service_role`**: hak pemeliharaan penuh di `admin_memberships`, `site_revisions`, `editor_favorites`, dan `messages` tanpa melonggarkan role publik (`0021`, `0023`).
- **`storage.objects`**: 6 policy aktif (`portfolio_media_admin_read/insert/update/delete` khusus admin; `portfolio_media_published_anon_read` dan `portfolio_media_published_authenticated_read` terbatas prefix folder pertama `'published'`).

---

## 3. Celah Replay Saat Ini & Solusi Ponytail (Wajib Sebelum Migrasi Pertama)

Audit langsung terhadap 39 file [`supabase/migrations/`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations) menemukan **3 hal** yang membedakan "update incremental DB lama" dari "replay bersih di DB baru":

### Masalah #1 (Bloker Fatal): [`0031_revoke_obsolete_test_reset.sql`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0031_revoke_obsolete_test_reset.sql#L3)
- **Penyebab:** Baris `revoke all on function public.test_reset() from public, anon, authenticated;` gagal jika `public.test_reset()` tidak ada. Pada proyek ini, `test_reset()` dulunya dibuat manual di DB lama (bukan dari `0001`–`0030`) lalu dihapus permanen di [`0039`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0039_drop_obsolete_test_reset.sql).
- **Dampak di akun baru:** Eksekusi berhenti error tepat di `0031` (`ERROR: function public.test_reset() does not exist`); `0032`–`0039` batal berjalan.
- **Solusi Ponytail (guard idempoten, 0 efek di Cloud lama):**
  ```sql
  do $$
  begin
    if to_regprocedure('public.test_reset()') is not null then
      revoke all on function public.test_reset() from public, anon, authenticated;
    end if;
  end $$;

  notify pgrst, 'reload schema';
  ```

### Masalah #2 (Bucket Tidak Dibuat SQL): [`0011_portfolio_storage_policies.sql`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0011_portfolio_storage_policies.sql#L1-L4)
- **Penyebab:** `0011` dan [`0019`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0019_atomic_publish_pipeline.sql#L389-L415) hanya memasang 6 policy `storage.objects`, belum baris bucket-nya di `storage.buckets`.
- **Dampak di akun baru:** Upload & URL publik gagal (`Bucket not found`) meski seluruh policy sudah terpasang.
- **Verifikasi kelayakan:** ACL Cloud `storage.buckets` memberi hak `INSERT` ke role `postgres` (`postgres=a*r*w*d*D*x*t*m*/supabase_storage_admin`), dan dokumentasi resmi Supabase mendukung pembuatan bucket idempoten lewat SQL.
- **Solusi Ponytail (migrasi penutup paling akhir, mis. `004N_ensure_portfolio_media_bucket.sql`):**
  ```sql
  -- Buat bucket publik portfolio-media pada replay akun baru; no-op aman bila sudah ada.
  insert into storage.buckets (id, name, public)
  values ('portfolio-media', 'portfolio-media', true)
  on conflict (id) do nothing;
  ```

### Masalah #3 (Asumsi Template Cloud): [`0023_release_candidate_security_hardening.sql`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0023_release_candidate_security_hardening.sql#L16)
- **Penyebab:** Baris `revoke execute on function public.rls_auto_enable() ...;` mengasumsikan template proyek target punya fungsi/event trigger bawaan `ensure_rls`. Proyek Supabase Cloud baru standar memilikinya, tetapi target Postgres/template lain bisa belum memilikinya.
- **Solusi Ponytail (guard serupa `0031`):**
  ```sql
  do $$
  begin
    if to_regprocedure('public.rls_auto_enable()') is not null then
      revoke execute on function public.rls_auto_enable()
        from public, anon, authenticated, service_role;
    end if;
  end $$;
  ```

> **Kapan menerapkan 3 perubahan di atas?**
> Terapkan **sekali di akhir setelah seluruh sisa [`list bug.md`](file:///d:/DITO/portfolio_natalia/portfolio-project/list%20bug.md) selesai** (atau kapan pun sebelum migrasi ke akun baru). Guard `0031` & `0023` tidak perlu dijalankan ulang ke Cloud lama, sedangkan migrasi bucket (`004N`) cukup dicatat di Cloud lama agar riwayat Git ↔ Cloud tetap 1:1.

---

## 4. Aturan Saat Jumlah Migrasi Terus Bertambah (`0040`, `0041`, dst.)

Gunakan tabel keputusan ini agar proyek lama, proyek baru, dan Git tidak pernah bertabrakan:

| Kondisi | Aksi Wajib | Yang Dijalankan di DB |
|---|---|---|
| **DB baru BELUM dibuat**, lalu ada perbaikan DB baru (`#bug`) | Buat file berurutan baru (`0040_fix_x.sql`, `0041_fix_y.sql`, dst.). Pastikan pengaman `0031`/`0023` + bucket berada di urutan paling akhir sebelum eksekusi pindah. | DB lama: jalankan `0040+` saja. DB baru nanti: jalankan `0001`..akhir sekaligus. |
| **DB baru SUDAH dibuat** di versi `0040`, lalu muncul bug DB baru `0041_fix_z.sql` | Jangan ulang `0001`–`0040`! Tambahkan `0041_fix_z.sql` saja ke Git. | Jalankan **hanya `0041_fix_z.sql`** di DB yang sedang aktif (`supabase db push` otomatis tahu lewat `schema_migrations`, atau paste `0041` saja di SQL Editor). |
| **Perubahan menyentuh RPC / Tabel / Kolom** | Wajib sinkronkan tipe TypeScript aplikasi. | Regenerasi [`src/types/database.generated.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/types/database.generated.ts) dan jalankan `npx vue-tsc --noEmit`. |

### Checklist Wajib Setiap File Migrasi Baru (`0040+`)
1. Selalu idempoten: `create table if not exists`, `add column if not exists`, `drop policy if exists ... create policy`, `drop trigger if exists ... create trigger`, `create or replace function`, `on conflict do nothing`.
2. Selalu kunci keamanan fungsi: `set search_path = ''` + skema eksplisit (`public.`, `private.`, `pg_catalog.`), dan `revoke all ... from public, anon` sebelum `grant execute ... to authenticated` bila perlu.
3. Akhiri migrasi yang mengubah tabel/kolom/RPC dengan `notify pgrst, 'reload schema';`.
4. Jangan masukkan command client `psql` (`\i`, `\dt`, dll.) atau blok `BEGIN;`/`COMMIT;` eksplisit agar tetap kompatibel dengan `db push` maupun gabungan SQL Editor *(hasil scan 39 file saat ini: 0 konflik)*.

---

## 5. Alur Teknis Eksekusi Migrasi ke Akun Supabase Baru

### Tahap 0 — Pra-Syarat (Lakukan Sekali Sebelum Pindah)
1. Pastikan seluruh sisa item [`list bug.md`](file:///d:/DITO/portfolio_natalia/portfolio-project/list%20bug.md) sudah beres.
2. Pastikan 3 perbaikan pada [Bagian 3](#3-celah-replay-saat-ini--solusi-ponytail-wajib-sebelum-migrasi-pertama) (`0031` guard, `0023` guard, dan file migrasi bucket `portfolio-media`) sudah masuk ke [`supabase/migrations/`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations).
3. Pastikan `npx vue-tsc --noEmit` dan `npm run build` lulus pada repo lokal.

### Tahap 1 — Buat Proyek di Akun Supabase Baru
1. Buat proyek Supabase baru (region sesuai kebutuhan, mis. Singapore `ap-southeast-1`) dan catat **Database Password**.
2. Ambil dari Dashboard proyek baru (**Settings → API / Connect**):
   - `<NEW_PROJECT_REF>` (bagian subdomain `https://<NEW_PROJECT_REF>.supabase.co`)
   - `<NEW_PUBLISHABLE_KEY>` (*Publishable key*, **jangan** gunakan `service_role` / `secret` key di frontend)
   - **Session Pooler IPv4 URI** (dari tombol **Connect → Session pooler**, port `5432`, format `postgresql://postgres.<NEW_PROJECT_REF>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres`).
     > *Catatan teknis Windows:* Jaringan Windows lokal tanpa IPv6 akan gagal `DbConfigIpv6Error` jika memakai `supabase link` / koneksi langsung (`db.<ref>.supabase.co`). Gunakan **Session Pooler URI IPv4**.

### Tahap 2 — Terapkan Seluruh Migrasi SQL (`0001` s/d Terakhir)

#### Jalur A — Paling Rapi: Supabase CLI via IPv4 Pooler *(Direkomendasikan)*
CLI mengeksekusi setiap file berurutan dalam transaksi dan **otomatis mengisi** tabel tracking `supabase_migrations.schema_migrations`:
```powershell
# 1. Uji daftar migrasi sebelum eksekusi (dry-run / status awal)
npx supabase migration list --db-url "postgresql://postgres.<NEW_PROJECT_REF>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# 2. Push seluruh migrasi lokal 0001..004N ke database baru
npx supabase db push --db-url "postgresql://postgres.<NEW_PROJECT_REF>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# 3. Pastikan semua lokal == remote (100% terisi semua barisnya)
npx supabase migration list --db-url "postgresql://postgres.<NEW_PROJECT_REF>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

#### Jalur B — Cadangan Tanpa CLI: SQL Editor Dashboard
Gunakan hanya jika CLI terhambat jaringan/firewall:
1. Gabungkan isi semua file `supabase/migrations/*.sql` secara berurutan ke satu file sementara lokal (lalu hapus setelah selesai, jangan di-commit):
   ```powershell
   Get-ChildItem supabase\migrations\*.sql | Sort-Object Name | Get-Content -Raw -Encoding UTF8 | Set-Content .\tmp-full-schema.sql -Encoding UTF8
   ```
2. Buka **Dashboard Proyek Baru → SQL Editor → New query**, paste isi `tmp-full-schema.sql`, klik **Run** (pastikan hasil sukses tanpa error), lalu hapus `tmp-full-schema.sql`.
3. *(Opsional tapi disarankan bila kelak ingin memakai CLI)* Catat nomor migrasi ke `supabase_migrations.schema_migrations` lewat `npx supabase migration repair --status applied <version> --db-url "<POOLER_URI>"` atau `insert into supabase_migrations.schema_migrations (version, name) ... on conflict do nothing;`.

### Tahap 3 — Verifikasi Paritas 1:1 (Wajib Lulus Semua Angka)
Jalankan kueri read-only berikut di **SQL Editor proyek baru** dan bandingkan kolom hasil terhadap nilai target:

```sql
select
  (select count(*) from pg_tables where schemaname = 'public') as public_tables,                 -- harus 22 (atau +tabel baru 0040+)
  (select count(*) from pg_tables where schemaname = 'public' and rowsecurity = true) as rls_on, -- harus sama dengan public_tables
  (select count(*) from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and con.contype = 'f') as foreign_keys, -- harus 13 (baseline 0039)
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') as public_functions, -- 13 (atau 12 bila template tanpa rls_auto_enable)
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'test_reset') as test_reset_exists, -- WAJIB 0
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private') as private_functions, -- harus 8
  (select count(*) from pg_policies where schemaname in ('public', 'private')) as table_policies, -- harus 98 (baseline 0039)
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects') as storage_policies, -- WAJIB 6
  (select count(*) from storage.buckets where id = 'portfolio-media' and public = true) as public_bucket_ready, -- WAJIB 1
  (select count(*) from cron.job where jobname = 'messages-auto-delete' and active = true) as cron_active, -- WAJIB 1
  (select count(*) from public.admin_memberships) as admin_count; -- 0 sampai Tahap 4 selesai
```

Jika menggunakan proyek **Supabase Advisors** di Dashboard (**Database → Advisors**), pastikan tidak ada warning/error baru selain item bawaan yang sudah diketahui (`get_active_published_snapshot` & `bootstrap_first_admin` `SECURITY DEFINER`, serta toggle Dashboard *Leaked Password Protection*).

### Tahap 4 — Hubungkan Aplikasi & Klaim Admin Pertama
1. Perbarui `.env` lokal dan Environment Variables hosting produksi:
   ```text
   VITE_SUPABASE_URL=https://<NEW_PROJECT_REF>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<NEW_PUBLISHABLE_KEY>
   VITE_SITE_URL=https://<DOMAIN_PRODUKSI_ANDA>
   ```
   > Pastikan [`vite.config.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/vite.config.ts) tidak mengeluarkan warning `VITE_SITE_URL is not set` saat build deploy produksi.
2. Buat akun admin pertama:
   - **Cara 1 (Langsung dari aplikasi):** Buka `/#/admin/bootstrap` ([`AdminBootstrap.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminBootstrap.vue)), masukkan email & password min. 8 karakter, lalu submit. Aplikasi akan mendaftarkan user di Supabase Auth + memanggil RPC `bootstrap_first_admin()`.
   - **Cara 2 (Jika Email Confirmation di Auth proyek baru aktif):** Buat user di **Dashboard → Authentication → Users → Add user** (centang *Auto Confirm User*), lalu login lewat `/#/admin/login` ([`auth.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/stores/auth.ts#L75-L79) otomatis memanggil `bootstrap_first_admin()` pada login pertama selama `admin_memberships` masih kosong).
3. Uji fungsi Storage nyata setelah login: buka `/#/admin/media`, upload 1 gambar kecil uji coba, pastikan muncul di galeri dan bisa dihapus tanpa error.

### Tahap 5 — (Opsional) Migrasi Konten Situs Tanpa Backup Berbayar
Jika ingin membawa data konten/tema dari proyek lama tanpa membawa file media lama:
1. Di proyek lama: buka `/#/admin/maintenance` ([`AdminMaintenance.vue`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/pages/admin/AdminMaintenance.vue)) → klik **Export** → unduh **JSON backup**.
2. Di proyek baru (setelah ganti `.env` & login Admin): buka `/#/admin/maintenance` → **Validate & Restore** → unggah file JSON → klik **Restore Design System** / **Import Snapshot as New Draft** → buka Editor & **Publish** *(catatan: path media yang merujuk file lama di bucket proyek lama perlu di-upload ulang atau diganti ke media baru karena biner Storage tidak ikut JSON)*.

---

## 6. Troubleshooting Cepat Jika Terjadi Kendala Teknis

| Gejala / Error | Penyebab | Solusi Tercepat |
|---|---|---|
| `DbConfigIpv6Error: IPv6 is not supported` | CLI mencoba koneksi langsung ke `db.<ref>.supabase.com` pada jaringan IPv4 | Ganti memakai **Session Pooler URI** (`...pooler.supabase.com:5432/postgres`) di `--db-url`. |
| `ERROR: function public.test_reset() does not exist` saat `0031` | Guard `to_regprocedure` di [`0031`](file:///d:/DITO/portfolio_natalia/portfolio-project/supabase/migrations/0031_revoke_obsolete_test_reset.sql) belum diterapkan | Terapkan guard `to_regprocedure('public.test_reset()')` dari [Bagian 3](#3-celah-replay-saat-ini--solusi-ponytail-wajib-sebelum-migrasi-pertama). |
| `Bucket not found` saat upload atau akses gambar | `0011` tidak membuat baris bucket dan migrasi bucket (`004N`) belum dijalankan | Jalankan `insert into storage.buckets (id, name, public) values ('portfolio-media', 'portfolio-media', true) on conflict (id) do nothing;`. |
| `Email confirmation is required before bootstrap can continue` di `/admin/bootstrap` | Pengaturan *Confirm email* aktif di Supabase Auth proyek baru | Buat/konfirmasi user via **Dashboard → Authentication → Users**, lalu login biasa di `/#/admin/login`. |
| `extension "pg_cron" is not available` | Proyek target bukan Supabase Cloud / belum mengaktifkan `pg_cron` | Aktifkan `pg_cron` lewat **Dashboard → Database → Extensions** sebelum menjalankan `0012`. |
| Error `schema_migrations` bentrok versi atau tipe TS tidak cocok | Ada migrasi manual belum masuk ledger, atau DB lebih baru dari `database.generated.ts` | Pastikan `list_migrations` Cloud sama dengan folder lokal, lalu regenerasi [`src/types/database.generated.ts`](file:///d:/DITO/portfolio_natalia/portfolio-project/src/types/database.generated.ts). |
