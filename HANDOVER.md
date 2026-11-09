# Co-Cher: handover brief for the next chat

Updated 9 November 2026, after v1.17 (Paths, Learning Log) and v1.18 (Student
Finder). Read this first, then `VERSIONS.md` and `cocher2/schools/README.md`.

---

## 0. Opening message to paste into the new chat

> We're continuing **Co-Cher 2** (`cocher2/`, currently v1.18). First read
> `HANDOVER.md` at the repo root. The next work is in section 2. Don't copy any
> student data into this repo.

---

## 1. Where things stand

### Two lines, deliberately kept apart

| Line | Folder | Live address | Who it's for | Status |
|---|---|---|---|---|
| **Co-Cher 1** | `app/` (`app/cocher.html`) | `harmanjohll.github.io/pedagogies/` (the root redirects here) | **Beatty only.** | **Frozen at v8.9.** Emergency fixes only. |
| **Co-Cher 2** | `cocher2/` (`cocher2/cocher2.html`) | `harmanjohll.github.io/pedagogies/cocher2/` | **Every school**: Beatty, Park View Primary, Opera Estate Primary, SAJC | **Active, v1.18.** All new work goes here. |

- Each school has a pack (`cocher2/schools/<id>.json`), an optional roster
  (`cocher2/schools/<id>/staff.json`) and its own storage on the device
  (`cocher2_app_data__<id>`). `cocher2/schools/registry.json` routes sign ins by
  email domain.
- Keep the two lines apart: `cocher_*` and `cocher2_*` keys, IndexedDB `cocher`
  and `cocher2`, caches `cocher-` and `cocher2-`. Never cross these.

### Shipping a Co-Cher 2 version

1. `cocher2/js/version.js`: bump `APP_VERSION` (next is **v1.19**).
2. `cocher2/sw.js`: set `VERSION` to the same value.
3. `cocher2/js/components/whats-new.js`: add an entry at the top.
4. `VERSIONS.md`: new row **Current (active)**, old row **Superseded**.

### Rules that hold everywhere

- **This repo is public.** Student names, class lists and registers must never
  be committed. Made up demo students only.
- Signing in is a routing step, not real security. Anything that truly needs
  access control needs `backend/`.

### What v1.17 and v1.18 added

| Feature | Where | Notes |
|---|---|---|
| Live embed component | `cocher2/js/components/app-embed.js` | Root relative `/genapp/...` address, Reload, Open full screen, a plain message if the frame cannot load (404, offline, 15 s timeout). |
| **Paths** (every school) | CCE2021 → ECG → "Paths" switch, `cocher2/js/views/cce.js` | Embeds `/genapp/pathways/index.html?s=path`. Pathways is now v6.0.0 in `genapp/pathways/` and stores plans under `paths6.state.v1`. |
| **Learning Log** (Beatty only) | Sidebar, Culture, below My Classes; `cocher2/js/views/learning-log.js` | Students `/genapp/e21cclog/index.html`, Teachers `/genapp/e21cclog/teacher.html`, Demo (start, student, teacher) under `/genapp/e21cclog/demo/`. Gate: `learningLogOpen()` (schoolId `bty`, or none for legacy users). Default view: Students, as the user asked. |
| **Student Finder** (every school) | Admin One-Stop section; `cocher2/js/utils/student-finder.js` (data), `cocher2/js/views/student-finder.js` (view) | Rebuilt from a colleague's app (`koominsg/BeattyStudentfinder2026`), with their agreement. See below. |

### Student Finder: how it holds data

- The file (CSV or Excel, one row per student per lesson) is read in the
  browser and kept in IndexedDB `cocher2`, store `media`, key
  `studentfinder__<schoolId>`. Not in localStorage, not in Settings exports.
- **Only whitelisted columns are kept** (`FIELDS` in `utils/student-finder.js`):
  student name, form class, subject, subject teacher, and optionally register
  number, level, stream, day, week, start, end, venue. Everything else, notably
  **remarks** (the original's samples include "SPED support"), is dropped as
  the file is read, and the teacher is told what was left out. To keep a
  column, add it to `FIELDS` on purpose.
- The original's "Bake data into app" button (which writes student data into
  the page for uploading to GitHub) was deliberately **not** carried across.
- Register numbers: the user has to check the real export; the code assumes
  they may be there and falls back to form class plus name.

### Commit class

- A teaching group (same subject, stream, level, teacher and lesson slots) or a
  form class becomes an ordinary My Classes class, so seating, E21CC tracking,
  lessons, assessment and export all use it with no extra wiring.
- The class carries `sf: { key, kind, teacher, formClasses, committedAt }`;
  each student may carry `index`, `formClass`, `sfKey`
  (`newStudentRecord` in `state.js`).
- Committing again updates the same class. Students are matched by `sfKey`,
  then form class plus register number, then name. Existing records (E21CC
  levels, observations) are kept; nobody is removed or doubled.
- A class with the same name and no link (a seeded sample class, or one made by
  hand) is adopted rather than duplicated.
- **Demo data:** "Try with demo data" builds a made up timetable from the same
  made up names the seeder uses (`NAMES` in `seed-data.js`), so committing a
  demo group links to the seeded sample class. The signed in teacher is set as
  the teacher of the sample subjects plus one mixed group.

---

## 2. Next work

1. **Videos and guides (the user asked to be reminded).** New briefing videos
   and user guides for Co-Cher 2, including Paths, the Learning Log, Student
   Finder and Commit class. The renderer is in `briefing-videos/tools/` (see its
   README). The old MP4s show Co-Cher 1 and live only on branch
   `claude/cocher-audit-versioning-h85j3x`; keep MP4s out of `main` (Drive or a
   GitHub Release instead).
2. **The end state: personalised tracking.** A teacher follows each student's
   competency growth and progress towards the pathway they hope for. Embedding
   alone cannot do this: an embedded app shows the teacher's own browser data,
   and students' logs and plans live on students' devices. Plan:
   - Each app exports a small summary for one student: the Log gives
     competency levels with evidence; Pathways gives goal and progress
     (Pathways already makes share links that carry year, levels and goal).
   - Co-Cher imports it and attaches it to the student in My Classes, matched
     by `sfKey` (Student Finder owns the teacher and student links).
   - Needs changes in genapp. Spec it with the user first.
3. **Primary schools set their own P6 data in Paths.** The user wants each
   primary school to set its own posting ranges (Paths' P6 page shows Beatty's).
   This is a Pathways change in genapp, for example a `?school=` parameter
   reading a school file. Agree the design with the user.
4. **`?embed=1` for Pathways** (the user agreed, for later): hide Paths' own top
   bar when embedded, as the E21CC Log already does. A genapp change.
5. **The E21CC Log reads Student Finder's links** instead of its own pasted
   staff list (agreed direction: one owner for teacher and student links).
6. The user will hand over more about the Log's teacher, student and demo views.

---

## 3. External apps that keep changing: the approach

Pathways and the E21CC Log stay in the **genapp** repo, where the user keeps
improving them. Co-Cher shows them; it doesn't copy them.

| Option | How it stays up to date | Use it when |
|---|---|---|
| **Live embed (chosen)** | Co-Cher shows `/genapp/<app>/` in an iframe. Every push to genapp appears in Co-Cher within minutes, with nothing to sync. | The app is still changing, and it doesn't need Co-Cher's data. |
| Pinned embed | Point at a frozen folder (genapp keeps old versions), and move the pointer on purpose. | A version must not change during a term. |
| Copy and sync script | A script copies files across, like `sync-labsim.sh`. Every change needs a rerun, and the copies drift. | Avoid it. |
| Native port | Rebuild inside Co-Cher's code. | The app is stable **and** needs Co-Cher's classes, students or timetables. Student Finder was ported for this reason. |

Working rules:

1. **Promote rather than push straight to the live folder.** `genapp/pathways/`
   is "always the latest", so anything pushed there shows up inside Co-Cher too.
   genapp now builds new Pathways work in its own development folder and
   promotes it; keep it that way.
2. **Keep a small agreement between the apps:** `?embed=1`, optional context in
   the address (`?school=bty`), and each app reads only its own storage keys.
3. **One web address means one shared storage space.** Every page on
   `harmanjohll.github.io` shares the browser's storage. Keep the key prefixes
   distinct: `cocher_`, `cocher2_`, `e21cclog`, `paths6.`. Co-Cher never reads
   or writes another app's keys.

**Testing locally.** Serve a folder that holds both repos side by side
(`pedagogies/` and `genapp/`), then open `/pedagogies/cocher2/`. Served from
`pedagogies/` alone, the embeds show their "could not open here" message,
which is the expected fallback.

---

## 4. Decisions still open (for the user)

1. Whether the real timetable export has register numbers (assumed yes).
2. The summary format between Co-Cher, the Log and Pathways (section 2.2).
3. How primary schools supply their own P6 data to Paths (section 2.3).
4. The old `claude/cocher-audit-versioning-h85j3x` branch: its handover and
   renderer are now on this line; only the Co-Cher 1 MP4s remain there.
