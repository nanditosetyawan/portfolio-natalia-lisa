# Tali-Temali Admin View Specification for OpenCode

## 0. Purpose

Dokumen ini adalah specification khusus untuk pengembangan **Admin View / Admin CMS Tali-Temali**.

Dokumen ini dibuat untuk menjadi konteks kerja OpenCode pada tahap implementasi Admin.

Fokus:

- Admin Dashboard
- Admin sidebar/navigation
- Edit / Visual Editor
- Control Panel
- Preview Canvas
- Draft workflow
- Save / Preview / Publish
- Undo / Redo
- Manage Media
- Maintenance
- Messages placeholder
- DEFAULT / CURRENT relationship
- Factory Reset / Reset All
- Admin security boundary
- Supabase persistence boundary
- desktop-only editor behavior untuk tahap saat ini

Dokumen ini **tidak menggantikan source project aktual**.

Jika terjadi konflik antara dokumen ini dengan:

1. explicit user instruction terbaru,
2. source project aktual,
3. approved implementation decision terbaru,

maka gunakan sumber yang lebih baru dan lebih authoritative.

---

# 1. Project identity

Project:

**Tali-Temali**

Path:

```text
D:\DITO\portfolio_natalia\portfolio-project
```

Technology baseline:

- Vue 3
- TypeScript
- Vite
- Tailwind CSS
- Vue Router
- Pinia
- lucide-vue-next

Backend yang direncanakan:

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- RLS
- Storage Policies

Hosting target:

- GitHub Pages
- Supabase Cloud

Guest View adalah output publik.

Admin adalah control system untuk mengelola:

```text
CONTENT
+
LAYOUT
+
STYLE
+
MEDIA
+
DRAFT
+
PUBLISH
```

Prinsip arsitektur:

```text
PROGRAMMER
    ↓
APPLICATION ENGINE

ADMIN
    ↓
CONTENT + LAYOUT + STYLE + MEDIA

SUPABASE
    ↓
DATA + MEDIA + CONFIGURATION

PUBLISH
    ↓
PUBLISHED STATE

GUEST
    ↓
PUBLISHED RESULT ONLY
```

Source PRD mendefinisikan Tali-Temali sebagai Personal Portfolio + Headless CMS + Visual Layout Editor + Visual Design Editor + Responsive Page Builder. Guest dan Admin adalah dua pengalaman aplikasi yang terpisah. Guest tidak boleh memuat mesin Admin. 


# 2. Status implementasi Admin

Status saat specification ini dibuat:

- Guest View baseline: sudah tersedia
- Default content: sudah diekstrak
- Default visual configuration: sudah diekstrak
- Admin route: belum dibuat
- Admin authentication: belum dibuat
- Supabase: belum diimplementasikan
- CURRENT persistence: belum diimplementasikan
- Admin Dashboard: belum diimplementasikan
- Visual Editor: belum diimplementasikan
- Media Manager: belum diimplementasikan
- Maintenance UI: belum diimplementasikan
- Messages UI: belum diimplementasikan
- Publish system: belum diimplementasikan
- Reset All: belum diimplementasikan

Jangan menganggap fitur Admin sudah ada hanya karena specification ini menjelaskannya.

---

# 3. Current approved Admin information architecture

Sidebar Admin yang disetujui:

```text
ADMIN
│
├── Dashboard
├── Edit
├── Manage Media
├── Maintenance
├── Messages
└── Logout
```

Tidak menambahkan menu lain pada tahap ini.

## 3.1 Dashboard

Dashboard adalah overview.

Bukan halaman editor utama.

Dashboard dapat menunjukkan:

- Draft status
- Published status
- perubahan yang belum dipublish
- last saved
- last published
- content overview
- quick actions
- preview access
- publish access

Dashboard tidak berisi:

- drag/resize canvas
- color editor
- typography editor
- media upload workspace
- full version history
- full maintenance workspace

---

# 4. Sidebar behavior

Sidebar harus menyediakan navigasi Admin.

Menu:

### Dashboard

Membuka overview Admin.

### Edit

Membuka Visual Editor.

### Manage Media

Membuka Media Manager.

### Maintenance

Membuka:

- Export
- Import
- Reset System

Tidak ada:

- Audit Log
- Analytics
- Scheduling

### Messages

Menu sudah disiapkan sebagai placeholder.

Untuk tahap sekarang:

**Jangan membuat fitur Messages.**

Tidak perlu:

- inbox
- contact table
- status
- reply
- archive
- unread counter

Semua itu ditunda.

### Logout

Mengakhiri session Admin.

---

# 5. Desktop-first rule

Tahap Admin View ini fokus pada **desktop**.

Jangan:

- merancang mobile editor
- mengimplementasikan mobile editor
- membuat responsive visual editor
- membuat viewport Tablet/Mobile
- memaksa canvas desktop menjadi mobile editor

Semua editor pada tahap ini menggunakan:

```text
DESKTOP
```

Namun architecture tidak boleh dibuat dengan cara yang nantinya mengunci kemungkinan responsive extension.

---

# 6. Edit page: core concept

Menu **Edit** adalah fitur paling penting.

Edit bukan form CRUD biasa.

Edit adalah:

**Visual Editor dengan canvas preview di kanan dan control panel di kiri.**

Struktur dasar:

```text
┌─────────────────────────────────────────────────────────────┐
│ Edit              Undo  Redo          Save   Preview Publish│
├───────────────────┬─────────────────────────────────────────┤
│                   │                                         │
│ CONTROL PANEL     │            PREVIEW CANVAS               │
│                   │                                         │
│                   │  actual current website state           │
│                   │                                         │
│                   │  scrollable                              │
│                   │  selectable                              │
│                   │  draggable                               │
│                   │  resizable                               │
│                   │  rotatable                               │
│                   │  layerable                               │
│                   │                                         │
└───────────────────┴─────────────────────────────────────────┘
```

---

# 7. Preview Canvas

Panel kanan adalah **preview website**.

Canvas bukan gambar screenshot statis.

Canvas harus merender kondisi website berdasarkan state yang sedang diedit.

Canvas:

- dapat discroll
- menampilkan section yang sedang aktif/current
- dapat memilih element
- dapat drag element
- dapat resize element
- dapat rotate element
- dapat mengatur z-index/layer
- dapat menunjukkan selected state
- dapat menampilkan contextual delete action
- harus menjaga batas editor/section

Tujuan canvas:

Admin dapat mengedit website dengan melihat object yang sebenarnya pada posisi visualnya.

---

# 8. Element selection

Admin memilih element langsung di canvas.

Contoh:

```text
Klik image
    ↓
selectedElement.type = image
    ↓
Control Panel → image controls aktif
```

Contoh:

```text
Klik text/font
    ↓
selectedElement.type = text
    ↓
Control Panel → font controls aktif
```

Selection adalah sumber kebenaran untuk menentukan kontrol yang aktif.

---

# 9. Control Panel behavior

Control Panel berada di kiri.

Konsep penting:

**Control Panel menampilkan seluruh kelompok kontrol yang tersedia secara struktur, tetapi hanya kontrol yang compatible dengan selected element yang dapat diedit.**

Contoh:

```text
CONTROL PANEL

Font
Size / Spacing
Color
Shadow
Hover
X
Y
Rotate
Width
Height
Layer / Z-index
Lock
Hide
Duplicate
Alignment
Snap
Grid
```

Jika selected element adalah image:

```text
IMAGE SELECTED

Image controls → aktif
Font controls → disabled
Text-only controls → disabled
Compatible layout controls → aktif
```

Jika selected element adalah text:

```text
TEXT SELECTED

Font controls → aktif
Typography controls → aktif
Image-only controls → disabled
Compatible layout controls → aktif
```

Jangan mengubah panel menjadi panel berbeda yang muncul/hilang total berdasarkan jenis element kecuali diperlukan oleh implementation.

State aktif/nonaktif harus jelas.

---

# 10. Control groups

Control Panel sebaiknya dibagi secara logis.

## 10.1 Content / element-specific controls

Tergantung jenis object.

Untuk text:

- content
- font family
- font size
- font weight
- line height
- letter spacing
- text color
- text alignment
- text transform

Untuk image:

- selected asset
- replace
- image-related options
- alt text jika dikelola pada element

Untuk SVG picture frame:

- element selection
- layout controls
- appearance controls jika tersedia
- delete

---

# 11. Layout controls

Layout controls yang disetujui:

- Drag & Drop
- Position X
- Position Y
- Width
- Height
- Rotation
- Layer / Z-index
- Lock
- Hide
- Duplicate
- Alignment
- Snap
- Grid

Semua masih **Desktop only**.

## 11.1 Position

Position dan Size adalah dua hal berbeda.

Position:

```text
X
Y
```

Size:

```text
Width
Height
```

Rotation:

```text
Rotate
```

Layer:

```text
Z-index
```

Jangan membuat satu nilai gabungan yang menyulitkan kontrol independen.

---

# 12. Independent element rule

Setiap element adalah object independen secara default.

Memindahkan element A:

```text
A
X: 100
Y: 100
```

menjadi:

```text
A
X: 240
Y: 200
```

tidak boleh otomatis mengubah element B.

Hal yang tidak boleh terjadi:

- title ikut bergeser karena image dipindahkan
- image ikut mengecil karena title diubah
- decorative object mengikuti object lain tanpa specification
- font size satu element mengubah font size element lain

Group hanya boleh digunakan jika specification secara eksplisit menyatakan group tersebut.

---

# 13. Section independence

Section tetap independen.

Contoh:

```text
Portfolio
About
Education
College
SHS
Experience
Certificate
Contact
```

Perubahan konfigurasi pada satu section tidak otomatis mengubah section lain.

---

# 14. SVG picture frame rule

SVG picture frame pada Experience adalah **fixed SVG element** dari design.

Dalam Visual Editor, SVG frame diperlakukan seperti image/object untuk operasi layout.

Dapat:

- dipilih
- drag
- resize
- rotate
- layer
- lock
- hide
- duplicate jika implementation mengizinkan object duplication
- delete dari canvas

Tetapi:

**DELETE DI EDITOR TIDAK MENGHAPUS ASSET DARI MANAGE MEDIA.**

Jika SVG dihapus dari current layout:

```text
Edit Canvas
    ↓
Delete SVG element
    ↓
Element tidak tampil pada current layout
```

asset/library record tidak ikut dihapus.

---

# 15. Delete behavior

Ada dua delete system yang berbeda.

## 15.1 Delete element dari Edit

Ketika Admin memilih element di canvas:

```text
[element selected]

        [Delete]
```

Tombol Delete muncul secara contextual di sekitar element atau selected-object UI.

Delete tersebut:

- menghapus element dari current layout state
- tidak menghapus media asset
- tidak menghapus binary file dari Storage
- tidak menghapus asset dari Manage Media

Contoh:

```text
Manage Media
    ↓
Photo A masih ada

Edit Canvas
    ↓
Photo A element dihapus

Manage Media
    ↓
Photo A tetap tersedia
```

## 15.2 Delete media dari Manage Media

Delete media berarti menghapus asset media.

Alur:

```text
Manage Media
    ↓
select media
    ↓
Delete
    ↓
remove media asset
```

Delete media harus diperlakukan sebagai operasi asset, bukan layout.

---

# 16. Contextual delete rule

Delete tidak selalu ditampilkan.

Untuk canvas:

- tidak ada selected element → tidak ada Delete action
- selected element → Delete action tersedia

Untuk Manage Media:

- tidak ada selected media → Delete action tidak ditampilkan
- media dipilih → Delete action tersedia

Ini mengurangi accidental deletion.

---

# 17. Draft system

Draft tetap digunakan.

Flow:

```text
Admin
  ↓
Edit
  ↓
Change current editing state
  ↓
Save
  ↓
Draft
  ↓
Preview
  ↓
Publish
  ↓
Published state
  ↓
Guest
```

Autosave dapat digunakan untuk Draft sesuai architecture yang ditetapkan.

Autosave tidak boleh langsung mengubah Published state.

---

# 18. Save button

Button utama di Edit:

```text
Save
```

Save menyimpan perubahan sebagai Draft.

Save tidak secara otomatis berarti Publish.

---

# 19. Preview

Button:

```text
Preview
```

Preview digunakan untuk melihat hasil Draft/current editing state sebelum publish.

Preview tidak mengubah Guest production state.

---

# 20. Publish

Button:

```text
Publish
```

Publish mempromosikan Draft menjadi Published state.

Guest hanya menerima:

- published content
- published layout
- published style
- required published media/configuration

Guest tidak menerima draft.

---

# 21. Undo / Redo

Toolbar Edit:

```text
↶ Undo
↷ Redo
```

Undo / Redo bekerja pada Draft editing state.

Bukan pada published data.

Perubahan yang dapat direkam dapat mencakup:

- position
- size
- rotation
- z-index
- visibility
- order
- style
- color
- background
- border
- radius
- shadow
- opacity
- brightness
- contrast
- saturation
- blur
- typography

Contoh:

```text
State 1
  ↓ drag
State 2
  ↓ resize
State 3
  ↓ rotate
State 4
```

Undo:

```text
State 4 → State 3 → State 2 → State 1
```

Redo mengembalikan state setelah undo.

History tidak ditampilkan kepada Guest.

---

# 22. Visual appearance controls

Control Panel untuk Visual Design Editor dapat mencakup:

## Color

- text color
- background
- border
- accent
- icon color jika berlaku

## Typography

- font family
- font size
- font weight
- line height
- letter spacing
- text alignment
- text transform

Font family harus terbatas pada font yang memang disediakan sistem.

Jangan menyediakan arbitrary external font URL.

## Border

- border
- border color
- radius

## Shadow

- shadow
- shadow intensity / configuration

## Effects

- opacity
- brightness
- contrast
- saturation
- blur
- backdrop blur bila berlaku
- transform
- effects

## Hover

- hover color
- hover background
- hover border
- hover transform
- hover shadow
- hover effects

Semua kontrol harus tunduk pada elemen yang sedang dipilih.

---

# 23. Style hierarchy

Style architecture mempertahankan inheritance.

Model konseptual:

```text
DEFAULT
    ↓
GLOBAL STYLE
    ↓
SECTION OVERRIDE
    ↓
ELEMENT OVERRIDE
    ↓
CURRENT STATE
```

Contoh:

```text
Default
background = #FFB399

Section
background = #FFD6A6

Element
background = #D62828
```

Current result adalah hasil inheritance/override chain.

---

# 24. DEFAULT vs CURRENT

Default adalah baseline.

Current adalah state hasil editing Admin.

Contoh:

```text
DEFAULT
Image position:
X = 100
Y = 100

ADMIN MOVE

CURRENT
Image position:
X = 240
Y = 180
```

Default tidak boleh berubah hanya karena Admin mengedit Current.

Admin bekerja pada Current/Draft.

---

# 25. Reset System

Keputusan terbaru untuk Admin UI:

**Maintenance hanya memiliki satu jenis reset UI:**

```text
RESET SYSTEM
```

Reset System berarti:

**RESET ALL / FACTORY RESET**

Tidak membuat menu:

- Reset element
- Reset section
- Reset viewport

di Maintenance.

Reset All mengembalikan seluruh desain/configuration ke default system.

---

# 26. Factory reset behavior

Flow:

```text
Maintenance
    ↓
Reset System
    ↓
Confirmation
    ↓
Backup current configuration
    ↓
Reset
    ↓
Default state
```

Reset System harus memiliki confirmation karena dapat menghapus banyak override sekaligus.

Setelah reset:

```text
CURRENT
    ↓
DEFAULT SYSTEM
```

Default tetap menjadi baseline.

---

# 27. Manage Media

Manage Media adalah media library.

UI utama:

```text
Manage Media

[ + Upload ]

[ media ] [ media ] [ media ]
[ media ] [ media ] [ media ]
```

Media Manager harus dapat menangani asset yang digunakan Guest dan Admin.

---

# 28. Media operations

Approved operations:

- Upload
- Preview
- Replace
- Delete
- Select
- Reorder
- Move
- Resize
- Rotate
- Hide
- Show
- Lock
- Reset

Metadata yang dapat disimpan:

- title
- description
- storage_path
- URL/reference
- mime_type
- size_bytes
- alt_text
- order_index
- publish state
- timestamps

---

# 29. Upload button

Manage Media harus memiliki:

```text
[ + Upload ]
```

Upload workflow:

```text
Admin
 ↓
Select file
 ↓
Validate
 ↓
Upload to Storage
 ↓
Receive storage_path
 ↓
Store metadata
 ↓
Refresh UI
```

Zod dapat digunakan untuk validasi metadata/media configuration.

---

# 30. Media delete vs element delete

Ini adalah aturan penting.

### Media delete

```text
Manage Media
→ Delete selected media
→ remove asset
```

### Element delete

```text
Edit Canvas
→ Delete selected element
→ remove element from layout
→ media asset remains
```

Jangan pernah menganggap:

```text
Delete element
=
Delete media
```

Keduanya berbeda.

---

# 31. Media replacement

Replace asset sebaiknya mempertahankan identity element/layout reference jika architecture mendukung identity-preserving replacement.

Tujuan:

```text
Old image
   ↓ replace
New image
```

tetap mempertahankan:

- position
- size
- rotation
- layer
- layout reference

selama element identity tidak berubah.

---

# 32. Guest vs Admin boundary

Guest harus ringan.

Guest tidak memuat:

- Admin Dashboard
- Visual Editor
- Design Editor
- Draft Manager
- Undo
- Redo
- History
- Admin forms
- Admin-only media manager
- Maintenance tools

Guest hanya membutuhkan:

- published content
- published layout
- published style
- required media
- required configuration

Admin bundle harus dipisahkan dari Guest dengan route-level/code splitting sesuai architecture.

---

# 33. Authentication

Admin harus authenticated.

Guest tidak boleh memiliki kemampuan edit.

Security architecture:

```text
Admin
 ↓
Supabase Auth
 ↓
Protected Admin Route
 ↓
Supabase RLS
 ↓
Persistent data
```

Frontend route guard hanya UX protection.

Authorization sebenarnya harus tetap berada di Supabase/RLS.

Service role key tidak boleh pernah diletakkan pada frontend.

---

# 34. Data boundary

Database harus merepresentasikan persistent editable data.

Jangan menyimpan:

- runtime animation state
- active selection
- temporary hover state
- scroll state
- raf state

sebagai database content.

Runtime state tetap berada di frontend.

---

# 35. Content, Layout, Style separation

System harus mempertahankan pemisahan:

```text
CONTENT
LAYOUT
STYLE
MEDIA
```

Konsep:

```text
CONTENT
→ text, data, records

LAYOUT
→ position, size, rotation, layer

STYLE
→ color, typography, border, shadow, effects

MEDIA
→ binary + metadata/reference
```

Admin dapat mengedit semuanya melalui UI, tetapi data model tidak boleh dibuat sebagai satu mega-table "everything".

---

# 36. Project sections / editable areas

Current Guest section structure:

```text
Main / Portfolio
About
Education
College
SHS
Activity / Experience
Certificates
Contact
```

Edit canvas harus memperlakukan section sebagai independent workspace.

---

# 37. Main / Portfolio editing

Potential editable elements mengikuti actual Guest specification/default visual configuration.

Elemen dapat mencakup:

- PORTFOLIO text
- profile/person image
- decorative elements
- relevant background/configuration

Jangan menambahkan element yang tidak ada pada source/design.

---

# 38. About / Education / College / SHS editing

Admin content/editor dapat bekerja terhadap element yang memang tersedia.

Content domains dapat mencakup:

- Education
- College
- SHS
- institution
- period/date
- description
- image/frame

Visual configuration tetap independent per element.

---

# 39. Experience / Activity editing

Saat ini terdapat empat experience items.

Konsep content:

```text
Experience 1
Experience 2
Experience 3
Experience 4
```

Masing-masing dapat memiliki:

- title
- date/calendar metadata
- description
- image

Visual layout/style tetap independent.

---

# 40. Certificate editing

Certificate dapat memiliki:

- title
- date/year
- description
- preview/image
- card
- action bila memang ada

Certificate asset dan layout harus dipisahkan.

---

# 41. Contact

Guest memiliki contact section.

Untuk Admin View tahap ini:

- Contact content tetap dapat mengikuti content architecture
- Contact management/messages feature ditunda
- Messages sidebar tetap ada sebagai placeholder

Do not build Messages now.

---

# 42. Current Admin workflow

Workflow utama:

```text
LOGIN
  ↓
DASHBOARD
  ↓
EDIT
  ↓
SELECT SECTION / ELEMENT
  ↓
MODIFY
  ↓
UNDO / REDO if needed
  ↓
SAVE
  ↓
PREVIEW
  ↓
PUBLISH
  ↓
GUEST
```

Media workflow:

```text
MANAGE MEDIA
  ↓
UPLOAD
  ↓
SELECT / PREVIEW / REPLACE
  ↓
USE IN EDITOR
```

Maintenance workflow:

```text
MAINTENANCE
  ├── EXPORT
  ├── IMPORT
  └── RESET SYSTEM
```

---

# 43. Explicitly excluded from current Admin UI

The following must not be implemented unless user explicitly re-approves:

- Analytics
- Scheduling
- Contact management
- Messages functionality
- Audit Log
- Activity Log
- Admin Action Log
- mobile editor
- tablet editor
- viewport reset UI
- section reset UI
- element reset UI
- enterprise multi-role system
- multi-tenant architecture
- approval workflow

Messages remains as sidebar placeholder only.

---

# 44. Maintenance scope clarification

Current Maintenance menu:

```text
Maintenance
│
├── Export
├── Import
└── Reset System
```

Nothing else.

Do not turn Maintenance into a generic admin toolbox.

Undo/Redo belong to Edit.

Save/Preview/Publish belong to Edit workflow.

Messages belongs to sidebar.

---

# 45. Save / Draft / Publish semantics

Important distinction:

```text
Save
=
save current work as Draft
```

```text
Preview
=
render current Draft/editing state
```

```text
Publish
=
promote Draft to Published
```

Guest reads Published only.

---

# 46. Error and validation behavior

Admin UI should provide validation feedback for:

- invalid upload
- invalid metadata
- invalid layout value
- invalid style value
- invalid content
- publish validation
- reset confirmation
- import validation

Use meaningful UI feedback.

Do not silently fail.

Zod is the designated validation library for relevant frontend schema validation.

---

# 47. Visual identity of Admin

Admin does not have to replicate Guest View exactly.

Admin should be:

- utilitarian
- clear
- readable
- efficient
- desktop-first
- consistent with project visual identity

Guest is the portfolio presentation.

Admin is the editing tool.

Avoid decorative UI that reduces editing efficiency.

---

# 48. Current approved Admin wireframe concept

## Dashboard

```text
┌─────────────────────────────────────────────────────┐
│ Dashboard                                     ☰     │
│                                                     │
│ Portfolio status                                    │
│ Draft / Published                                   │
│                                                     │
│ Draft changes        Last saved     Last published  │
│                                                     │
│ Quick actions                                        │
│ [Edit] [Manage Media] [Preview] [Publish]           │
│                                                     │
│ Content overview                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The exact visual card layout is not yet final.

## Edit

```text
┌─────────────────────────────────────────────────────────────┐
│ Edit         ↶ ↷                    Save  Preview  Publish  │
├────────────────────┬────────────────────────────────────────┤
│ Control Panel      │                                        │
│                    │             Scrollable                 │
│ Font               │             Website Preview            │
│ Size / Spacing     │                                        │
│ Color              │        [ selectable element ]          │
│ Shadow             │                                        │
│ Hover              │                                        │
│ X                  │                                        │
│ Y                  │                                        │
│ Width              │                                        │
│ Height             │                                        │
│ Layer / Z-index    │                                        │
│ Lock               │                                        │
│ Hide               │                                        │
│ Duplicate          │                                        │
│ Alignment          │                                        │
│ Snap               │                                        │
│ Grid               │                                        │
│ Rotate             │                                        │
└────────────────────┴────────────────────────────────────────┘
```

## Manage Media

```text
┌─────────────────────────────────────────────────────┐
│ Manage Media                               ☰        │
│                                                     │
│ [ + Upload ]                                         │
│                                                     │
│ [media] [media] [media]                             │
│ [media] [media] [media]                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Delete appears only when media is selected.

## Maintenance

```text
┌─────────────────────────────────────────────────────┐
│ Maintenance                                ☰        │
│                                                     │
│ [ Export ]                                          │
│ [ Import ]                                          │
│ [ Reset System ]                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Reset System opens confirmation.

## Messages

```text
Messages

PLACEHOLDER ONLY
```

Do not implement message management.

---

# 49. Edit interaction rules in detail

## 49.1 Select element

```text
Click element
↓
selected
↓
show outline
↓
show contextual actions
↓
activate compatible controls in left panel
```

## 49.2 Drag

```text
Select
↓
drag
↓
update X/Y
↓
element moves independently
```

## 49.3 Resize

```text
Select
↓
resize handles
↓
update width/height
```

Resize must not automatically move unrelated elements.

## 49.4 Rotate

```text
Select
↓
rotate
↓
update rotation
```

Rotation is independent.

## 49.5 Layer

```text
Select
↓
change z-index
↓
stacking order updated
```

## 49.6 Lock

Locked elements should not be accidentally dragged/resized/changed.

## 49.7 Hide

Hide changes visibility in current editing state without deleting the object.

## 49.8 Duplicate

Duplicate creates another element based on the selected element according to the layout engine rules.

---

# 50. Grid / Snap / Alignment

These are editor aids.

Grid:

- visual editing guide
- does not become Guest UI unless part of the actual design

Snap:

- helps place elements accurately

Alignment:

- aligns selected elements based on editor rules

They must not silently create unwanted grouping.

---

# 51. Current state vs rendered preview

The canvas must render the state the Admin is currently editing.

Conceptually:

```text
DEFAULT
    ↓
CURRENT / DRAFT
    ↓
EDITOR CANVAS
```

After publish:

```text
DRAFT
    ↓
PUBLISH
    ↓
PUBLISHED
    ↓
GUEST
```

The canvas is not merely a static screenshot.

---

# 52. Published-state isolation

Guest must not receive:

- draft position
- draft style
- draft unpublished content
- draft assets
- Admin-only editor state

Guest receives the published result only.

This is both a security and performance requirement.

---

# 53. Code architecture constraints

Do not put Admin-only code in Guest bundle unnecessarily.

Prefer route-level code splitting.

Concept:

```text
/
→ Guest bundle

/admin
→ Admin bundle

/admin/editor
→ Visual editor bundle

/admin/media
→ Media manager bundle
```

Do not make Guest load the full visual editor.

---

# 54. Supabase future architecture

Admin persistence is expected to use Supabase.

Conceptual domains:

```text
CONTENT
LAYOUT
STYLE
MEDIA
PUBLISH STATE
```

Storage:

- binary media → Supabase Storage
- metadata/reference → PostgreSQL

Security:

- Supabase Auth
- RLS
- Storage Policies

Do not expose service role key to frontend.

---

# 55. Media storage principle

Binary image/file data must not be stored directly inside relational content rows.

Database stores references/metadata.

Conceptual media metadata:

```text
asset_id
title
description
storage_path
url/reference
mime_type
size_bytes
alt_text
order_index
publish_state
created_at
updated_at
```

Exact final schema is not defined in this document.

Do not invent a final database schema during UI implementation without an approved data model.

---

# 56. Content data principle

Content is persistent data.

Examples:

- profile name
- title
- bio
- descriptions
- experience
- certificate
- contact content
- navigation labels if later approved as editable

Do not hardcode new editable content into Admin implementation if the source project intends persistence.

---

# 57. Runtime state principle

Do not persist temporary runtime state as CMS content.

Examples:

- selectedElementId
- sidebarOpen
- current mouse drag
- active hover
- temporary modal state
- scroll position
- animation frame state
- temporary editor selection
- active UI tab

These are runtime state.

---

# 58. Admin security boundary

Admin writes require authentication and authorization.

Guest:

```text
Public read
```

Admin:

```text
Authenticated write
```

Database RLS is the actual authorization layer.

Frontend route guards are not sufficient.

---

# 59. Acceptance criteria

Admin implementation is acceptable only when the following are true:

## Navigation

- Dashboard works
- Edit works
- Manage Media works
- Maintenance works
- Messages route/menu exists as placeholder
- Logout works

## Dashboard

- Shows useful overview
- Does not become the editor

## Edit

- Canvas is visible
- Canvas is scrollable
- Element selection works
- Selected element is visually marked
- Control Panel reacts to selected element
- Compatible controls are enabled
- Incompatible controls are disabled
- Drag works
- Resize works
- Rotate works
- Z-index works
- Lock works
- Hide works
- Duplicate works
- Alignment works
- Snap works
- Grid works
- Delete works contextually
- Delete does not delete media asset

## Draft

- Save creates/updates Draft
- Autosave, if implemented, only affects Draft
- Undo works
- Redo works
- Preview shows current Draft
- Publish promotes Draft

## Media

- Upload works
- Preview works
- Replace works
- Selected-media delete works
- Element deletion does not delete media asset

## Maintenance

- Export exists
- Import exists
- Reset System exists
- Reset System performs Reset All only
- Confirmation exists before Reset All
- Current configuration is backed up before reset if implementation requires persistent recovery
- Default state can be restored

## Security

- Admin route is protected
- Guest cannot edit
- RLS is enforced
- service role is never exposed

## Performance

- Guest does not load Admin editor bundle
- Admin editor can be lazy loaded
- Guest query is published-only

---

# 60. Important implementation rules for OpenCode

Before coding:

1. Inspect actual source project.
2. Inspect current routes.
3. Inspect current Guest architecture.
4. Inspect current default data and visual config files.
5. Inspect actual dependencies.
6. Do not invent missing structure.
7. Do not modify Guest visual design unless explicitly required.
8. Do not create Supabase schema without approved data-model decision.
9. Do not create Auth assumptions without checking project state.
10. Do not change existing section behavior just to simplify Admin.
11. Keep section and element configuration independent.
12. Keep Media deletion separate from Layout element deletion.
13. Keep Draft separate from Published.
14. Keep Default immutable from Admin editing.
15. Keep current Admin editor desktop-only.
16. Do not implement Mobile/Tablet editor in this phase.
17. Do not implement Analytics.
18. Do not implement Scheduling.
19. Do not implement Messages functionality.
20. Do not implement Audit Log.

---

# 61. Latest explicit user decisions

These decisions supersede earlier proposals where they conflict.

### Sidebar

Approved:

```text
Dashboard
Edit
Manage Media
Maintenance
Messages
Logout
```

### Maintenance

Approved content:

```text
Export
Import
Reset System
```

### Reset

Approved:

```text
Reset System = Reset All / Factory Reset
```

Not approved as Maintenance UI:

```text
Reset Element
Reset Section
Reset Viewport
```

### Edit

Approved:

- Left = Control Panel
- Right = Preview Canvas
- Preview Canvas is scrollable
- Preview Canvas contains current website state
- Elements can be selected directly on canvas
- Selected element determines which controls are active
- Panel may show controls generally, but unsupported controls are disabled
- Drag and drop
- Rotate
- Resize
- Z-index
- Width
- Height
- Lock
- Hide
- Duplicate
- Alignment
- Snap
- Grid
- Desktop only

### Delete

Approved:

- Delete selected canvas element from Preview
- Delete button appears contextually around selected element
- Deleting element does not delete media
- SVG picture frame behaves like image/object in editor
- SVG frame may be deleted from canvas
- SVG deletion does not delete Media Manager asset

### Manage Media

Approved:

```text
[ + Upload ]
```

Delete button only appears when media item is selected.

### Messages

Approved:

- Sidebar entry exists
- Functionality postponed
- Do not implement content now

### Excluded

- Analytics
- Scheduling
- Contact management
- Mobile editor
- Tablet editor
- Audit Log
- Activity Log
- Admin Action Log

---

# 62. Do not confuse these systems

## Edit

```text
Element-level visual/layout editing
```

## Manage Media

```text
Asset/library management
```

## Maintenance

```text
Export
Import
Factory Reset
```

## Messages

```text
Future placeholder
```

## Dashboard

```text
Overview
```

---

# 63. Core mental model

The Admin system should always be understood as:

```text
                  ADMIN
                    │
        ┌───────────┼───────────┐
        │           │           │
     CONTENT      LAYOUT      STYLE
        │           │           │
        └───────────┼───────────┘
                    │
                  DRAFT
                    │
          ┌─────────┴─────────┐
          │                   │
       UNDO/REDO            PREVIEW
          │                   │
          └─────────┬─────────┘
                    │
                  PUBLISH
                    │
             PUBLISHED STATE
                    │
                  GUEST
```

Media sits beside content/layout/style:

```text
MEDIA
  ↓
STORAGE + METADATA
  ↓
SELECTED BY CONTENT / ELEMENT
```

And factory reset sits in Maintenance:

```text
CURRENT
   ↓
RESET SYSTEM
   ↓
DEFAULT SYSTEM
```

---

# 64. Final principle

Tali-Temali Admin bukan website kedua yang berdiri sendiri.

Admin adalah control plane untuk Guest View.

Guest View tetap menjadi output utama.

Admin mengatur:

```text
CONTENT
LAYOUT
STYLE
MEDIA
DRAFT
PUBLISH
```

Guest hanya menerima:

```text
PUBLISHED RESULT
```

Default adalah baseline.

Current/Draft adalah state yang sedang dikerjakan Admin.

Runtime state tetap berada di frontend.

Database hanya menyimpan persistent editable state.

