# PHASE 029D — Editor Snapshot Model

## Scope

Phase ini hanya mengimplementasikan model typed untuk snapshot editor dan integrasinya ke repository boundary Phase 029C.

Tidak diimplementasikan:

- Storage;
- publish execution atau activation;
- Guest runtime wiring;
- media promotion;
- UI redesign;
- migration atau perubahan database.

## Model

`EditorSnapshot` berada di `src/types/editorSnapshot.ts` dan memiliki:

- compatibility metadata (`schemaVersion`, minimum reader, maximum writer);
- revision metadata (`baseRevisionNumber`, `draftRevisionNumber`);
- typed entity references;
- typed domain content;
- typography settings;
- layout settings;
- media references dan entity assignments;
- background settings;
- button settings;
- animation settings;
- legacy visual dan behavior data yang tetap dipisahkan sampai section cutover.

Concern visual tidak digabung menjadi satu style object. Setiap concern memiliki map berdasarkan entity ID sehingga perubahan typography tidak otomatis mengubah layout, media, background, button, atau animation.

## Compatibility

Model saat ini menggunakan schema version `1` dan reader version `1`.

`validateEditorSnapshot()` menolak:

- input non-object;
- schema version yang tidak didukung;
- snapshot yang membutuhkan reader lebih baru;
- snapshot dari writer yang tidak kompatibel;
- entity/content/style maps yang hilang atau bertipe salah;
- media references/assignments yang bukan array;
- visual atau behavior data yang hilang.

Version bump berikutnya harus menambahkan migrator eksplisit sebelum schema diterima oleh reader.

## Serialization

`serializeEditorSnapshot()`:

1. memvalidasi snapshot;
2. menghasilkan JSON;
3. menolak snapshot invalid.

`deserializeEditorSnapshot()`:

1. parse JSON;
2. memvalidasi compatibility dan struktur;
3. mengembalikan clone typed;
4. menolak JSON atau snapshot yang invalid.

## Repository integration

`src/repositories/editorRevisionRepository.ts` sekarang memakai `EditorSnapshot` untuk:

- `RevisionRecord.snapshot`;
- `EditorDraftRepository` save/load result;
- `GuestPublishedRepository` read contract;
- `EditorPublishRepository` validation result.

Repository melakukan snapshot validation pada in-memory adapter dan Supabase adapter. Supabase draft serialization menyimpan object JSON hasil serializer; tidak ada operasi Storage atau publish.

## Validation

Validation executed:

- `npx vue-tsc --noEmit` — PASS;
- `npm run build` — PASS, 1,930 modules transformed;
- `git diff --check` — PASS.

Runtime test source `tests/editor-repository-runtime.mjs` juga diperluas untuk memverifikasi serialize/deserialize `EditorSnapshot`. Browser/CDP execution tetap memerlukan runtime aplikasi aktif dan tidak dijalankan sebagai bagian Phase ini.

## Files

Created:

- `src/types/editorSnapshot.ts`;
- `src/editor/editorSnapshot.ts`;
- `PHASE-029D-SNAPSHOT-MODEL.md`.

Modified:

- `src/repositories/editorRevisionRepository.ts`;
- `tests/editor-repository-runtime.mjs`;
- `PROJECT-IMPLEMENTATION-LOG.md`.

