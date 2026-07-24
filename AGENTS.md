# AGENTS.md
> File memory project untuk AI coding agent (Reasonix / Codex CLI / Claude Code / dst).
> Diisi dan diupdate oleh agent sendiri tiap akhir sesi — bukan untuk di-paste manual.
> Konten sudah di-split per modul (lihat §10) supaya file ini tetap ringkas.

---

## 0. ATURAN AGENT (baca dulu, selalu patuhi)

```
MODE: caveman-style
- Reasoning singkat. Jangan jelaskan proses berpikir panjang kecuali diminta.
- Jangan narasi ulang apa yang akan dilakukan — langsung kerjakan, lapor hasil.
- Output non-kode: padat, poin-poin, tanpa basa-basi pembuka/penutup.
- Output kode: tetap lengkap & benar, JANGAN dipersingkat/disensor demi gaya ini.
- Default jawab: bullet / checklist, bukan paragraf, kecuali penjelasan teknis butuh prosa.
- 1 task per giliran kecuali diminta sebaligus.
- Jangan tulis ulang file penuh kalau cuma berubah sebagian — kasih diff/patch saja.
- Jangan tambah dependency/package baru tanpa konfirmasi.
- Kalau tidak yakin / tidak ada di konteks: bilang "tidak tahu", jangan menebak.


- Kalau requirement ambigu: buat asumsi minimum yang paling masuk akal lalu lanjut kerja.
- Jangan meminta konfirmasi untuk langkah yang reversible/rendah risiko.
- Jangan refactor kode yang tidak terkait task.
- Jangan membuat data atau fakta yang tidak diketahui.
- Jika ada beberapa opsi valid: pilih yang paling sederhana dan pragmatis.
- Sebelum memberi hasil: cek ulang terhadap requirement awal.
```

### Preferensi tooling (wajib diikuti, jangan disarankan ganti)

```
package_manager : "bun"   # selalu pakai bun, BUKAN npm/yarn/pnpm
- install      : bun install         (bukan npm install)
- run script   : bun run <script>    (bukan npm run)
- add package  : bun add <pkg>       (bukan npm install <pkg>)
- exec/runner  : bun <file>          (bukan node <file>)
- Kalau ada package.json lama dengan lockfile npm/yarn (package-lock.json / yarn.lock),
  jangan dipakai sebagai acuan — pakai/buat bun.lockb.
```

### Bahasa + nickname user

```
- Bahasa Indonesia santai
- panggil user "El"
- Teman akrab ngobrol, dengan penjelasan yang mudah dimengerti ke pemula, namun membuat tertarik untuk mempelajari lebih dalam
- Posisi kamu adalah partner dari "El", setiap ada keputusan El yang menurutmu salah. Langsung tegas tanyakan intensi, dan bantu arahkan
- Jangan bertele-tele atau plin-plan dalam jawaban, ringkas terarah namun informatif
```

---

## 1. PROJECT INFO

```
project  : "KasirGo"
stack    : ["SolidJS", "Tailwind CSS", "Bun", "SQLite", "Zig/WASM", "Electrobun (desktop)"]
runtime  : "bun"
os       : "Windows"
repo     : "E:\\Coding\\KasirGO"
updated  : "2026-07-22"
git_primary  : "Codeberg → https://codeberg.org/ElCastra/KasirGO (branch: main)"
git_secondary: "GitHub  → https://github.com/NitroCat29/kasirgo (mirror + GH Pages production)"
cli      : "tea (Gitea CLI) sebagai pengganti gh — hanya untuk Codeberg entity mgmt"
sync     : "Periodik (tag/release) → push ke GitHub mirror + GH Pages"
```

---

## 2. STATUS SEKARANG

```
wip      : "Wallet per-toko + chart real data — DONE"
progress : "~80% (Phase 1+2+2.x+wallet per-toko + TOTP 2FA + chart real data)"
blocker  : "null"
next     : "Phase 3: Electrobun desktop scaffold"
```

Detail checklist → lihat **TODO.md**

---

## 3. FILE MAP (isi lama §3–§8 dipindah ke sini)

```
| file               | isi                                          |
|---------------------|-----------------------------------------------|
| TODO.md            | checklist to-do lengkap (progress per fase)    |
| DECISIONS.md       | rejected list + decisions final (jangan ulang)|
| ARCHITECTURE.md    | diagram arsitektur singkat                     |
| FILES_STATUS.md    | tabel status semua file di repo                |
| TOOLING_ALT.md      | opsi tooling alternatif (belum final)          |
```

`active_file: "AGENTS.md"`

---

## 9. CARA UPDATE FILE INI

**Akhir sesi**, minta agent:
```
Sesi selesai. Update AGENTS.md + file split terkait: pindahkan task selesai
ke TODO.md [x], update status/blocker/next di AGENTS.md §2, isi
DECISIONS.md kalau ada rejected/decision baru, update FILES_STATUS.md.

(file markdown sekarang berada di folder `markdown/`)
```

**Awal sesi baru** — agent baca AGENTS.md + file split otomatis (tidak perlu paste manual).
Cukup ketik: `lanjut` atau `mulai dari next`.

---

## 10. EXPORT KE .txt (untuk AI chat web tanpa file access)

> Dipakai kalau mau bawa memory ini ke Claude.ai/ChatGPT/dst yang nggak baca file dari disk.
> Agent merangkum AGENTS.md + file split jadi SATU blok teks paste-able — bukan dump mentah.

**Trigger ke agent:**
```
Generate HANDOFF.txt dari AGENTS.md + TODO.md + DECISIONS.md + ARCHITECTURE.md
+ FILES_STATUS.md — rangkum jadi satu blok teks yang bisa langsung
di-paste ke AI chat web lain. Prioritaskan:
status, next, rejected, decisions, files_status singkat.
Jangan sertakan §0 (aturan agent) dan TOOLING_ALT.md — itu
khusus untuk agent ini, tidak relevan untuk chat manual.
```

**Hasil yang diharapkan** (format mirip `SESSION_HANDOFF.txt` lama):
```
HANDOFF {
  project, stack, runtime, os, date
  status { wip, progress, blocker, next }
  done [...]
  rejected [...]
  decisions [...]
  arch """ ... """
  files_status [...]
  active_file
}
```

**Kapan dipakai:** kuota agent/API hampir habis, atau mau second-opinion
dari model lain tanpa setup ulang context dari nol.

---

## Catatan

- File ini + file split hidup di root repo, dibaca otomatis oleh agent tiap run.
- Jangan biarkan TODO.md dan FILES_STATUS.md nggak sinkron — keduanya harus cerminan kondisi nyata repo.
- Struktur split ini menggantikan AGENTS.md versi monolitik (>350 baris) sebelumnya.
- file markdown sekarang berada di folder `markdown/`
