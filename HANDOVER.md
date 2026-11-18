# Co-Cher: handover brief for the next chat

Updated 9 November 2026, after v2.1 (Paths, Learning Log, Student Finder).
v2.1 follows v1.16; there was no v1.17 or v1.18 release. Read this first, then `VERSIONS.md` and `cocher2/schools/README.md`.

---

## 0. Opening message to paste into the new chat

> We're continuing **Co-Cher 3** (`cocher3/`, currently 3.9.0). It is the main
> line. Co-Cher 1 (`app/`) and Co-Cher 2 (`cocher2/`) are frozen: do not edit
> them. First read `HANDOVER.md` at the repo root. Don't copy any student data
> into this repo.

---

## 1. Where things stand

### Three lines, each in its own folder

| Line | Folder | Live address | Status |
|---|---|---|---|
| **Co-Cher 3** | `cocher3/` | `harmanjohll.github.io/pedagogies/` (the root opens it) and `/pedagogies/cocher3/` | **The main line, 3.9.0.** Every school. All new work goes here. |
| **Co-Cher 2** | `cocher2/` (`cocher2.html`) | `/pedagogies/cocher2/` | **Frozen at v2.7** (17 Nov 2026). Still works; the fallback. |
| **Co-Cher 1** | `app/` (`cocher.html`) | `/pedagogies/app/cocher.html` | **Frozen at v8.9.** Beatty only. |

- **Frozen means do not edit.** Co-Cher 3 took its own copy of the engine on
  17 Nov 2026 (every file identical at that moment except `js/version.js`), so
  nothing in `cocher3/` loads from `cocher2/` any more.
- **Saved work is shared between Co-Cher 2 and 3, on purpose.** Both use the
  keys `cocher2_*` (per school `cocher2_app_data__<id>`) and the database
  `cocher2`. A teacher sees the same classes and lessons in either, so Co-Cher 2
  is a real fallback. **So only ADD to saved data in Co-Cher 3.** Renaming or
  reshaping a field breaks Co-Cher 2 for that teacher. If a breaking change is
  ever needed, first give Co-Cher 3 its own keys and copy the data across.
- Co-Cher 1 keeps its own data (`cocher_*`, database `cocher`). Teachers bring
  it over with Settings, Data, Export there, then Import in Co-Cher 3.
- **The root address** (`index.html`) opens Co-Cher 3. One exception:
  `/pedagogies/#/join/ROOM` still lands in Co-Cher 1, whose projector shows
  that short link for its Live lessons.
- Each school has a pack (`cocher3/schools/<id>.json`), an optional roster
  (`cocher3/schools/<id>/staff.json`) and `cocher3/schools/registry.json`
  routes sign ins by email domain. A new school fills in
  `cocher3/schools/ONBOARDING.md`. The copies under `cocher2/schools/` are
  frozen with Co-Cher 2: a new school or a new timetable goes in `cocher3/`
  only, and Co-Cher 2 will not see it.

### Shipping a Co-Cher 3 version

1. `cocher3/js/v3/version.js`: raise `VERSION`; add to `NOTES` if teachers should hear.
2. `cocher3/sw.js`: raise `CACHE` (clears the old offline copies).
3. `VERSIONS.md`: new row at the top of the Co-Cher 3 table.
4. Test in a browser: every school signs in (see `VERSIONS.md` 3.6.0 for the list), phone width, offline.

### Rules that hold everywhere

- **This repo is public.** Student names, class lists and registers must never
  be committed. Made up demo students only. Staff rosters only for a school
  that has agreed.
- Signing in is a routing step, not real security. Anything that truly needs
  access control needs `backend/`.
- **Nothing is deleted.** Old pages move to `archive/` and leave a forwarder.

### Co-Cher 3: how it is built

- **Layout of `cocher3/`:**
  - `index.html`, `sw.js`, `manifest.webmanifest`
  - `js/` the engine (sign in, schools, data, every view), copied from Co-Cher 2
  - `js/v3/` Co-Cher 3's own: `boot.js`, `shell.js`, `places.js`, `screens.js`,
    `agenda.js`, `goals.js`, `together.js`, `prefs.js`, `demos.js`, `version.js`
  - `css/` the engine's three stylesheets, then `cocher3.css` (the look)
  - `schools/`, `btyrelief/`, `simulations/` school files and simulations
  - `demos/` the 13 videos
- **Boot:** `js/v3/boot.js` imports `shell.js` (registers `window.__cocherShell`)
  then `js/app.js`. app.js calls `shell.mount`, `themed`, `routes`, `whatsNew`.
  The engine is now Co-Cher 3's to change freely; the old sidebar, tour and
  What's New in it are unused and can be removed in a later clean up.
- **Version:** `js/v3/version.js` is the one number. `js/version.js` hands it
  to the engine's Settings page.
- **Offline:** `sw.js` asks the network first, always, and falls back to its
  kept copy only when the network fails or takes over 4 seconds. Videos are not
  kept. An earlier cache first worker served stale files; do not go back to that.
- **Phone (760px and under):** the dock shows `PRIME` places (shell.js) and a
  More sheet; other places carry `.v3-rest`.
- **Files:** `places.js` (the ONE list of places and screens, plus teacher
  links), `screens.js` (My School, Now, Week, Term, hubs, Paths, the tile
  flights, quote, milestone note), `agenda.js` (own entries; Store `agenda`),
  `goals.js` (term goals; Store `goals`), `together.js` (Common free time,
  Student handover, Send to a colleague), `prefs.js` (key `cocher3_prefs`,
  mirrored by the inline script in `index.html`), `demos.js` + `demos/`
  (videos; `only: 'bty'` hides one from other schools).
- **Videos** are recorded by `briefing-videos/tools/cocher3-demos/` on made up
  people. When a screen changes, rerecord its clip and replace it in `demos/`.
- **Sharing between teachers:** read `cocher3/SHARING.md` before touching it.
  Plan A (a file passed on by Teams) is built. Plan B (a shared OneDrive or
  SharePoint folder, Beatty first, accounts `name@btyss.moe.edu.sg`) is NOT
  built: it waits on the principal and on IT approval of an app registration.
  Do not start it unasked.
- **Titles are in title case** ("How Co-Cher Works", "Assessment of Learning"): small words (a, an, the, and, or, of, for, as, in, on, to, by) stay lower unless first. Sentences, questions and buttons stay in sentence case.
- **Keep the greeting.** My School opens with "Good morning, Cher!" and the
  teacher's name. A design pass removed it once; do not strip personal touches
  without asking.
- **Decided with the user:** My School is the landing page and shows no menu;
  tiles fly down to form the menu and back up; the flight plays even when the
  device asks for reduced motion (Motion switch turns it off); default look
  Fjord, Mincho, dock; the mark is the open circle, top left, leading home.
- **Not yet done:** older screens are restyled, not redesigned; Make My School
  yours; a first run guide (the old tour is off; the videos stand in); videos
  for Plan, Room, Assess, Resources and for phone; sample events carry fixed
  dates; Term 1 2027 timetables for every school; shared storage (OneDrive) is
  parked by the user.

### What v2.2 added

- **Observe in Present** (button or O): `components/observe-panel.js`. Saves
  observations `{ competency, verdict: showed|towards, note, lessonId,
  segment, classId, source: 'present' }` on the student (`utils/evidence.js`).
- **Student profile**: `components/student-profile.js`, opened from the
  roster name (`views/classes.js`), search (students are results now,
  `components/unified-search.js`) and the lesson page. The same child across
  classes is matched by `sfKey`, else by name within the same form class
  (record `formClass`, or the class code that starts the class name).
- **Pathway on the profile**: a pasted Paths share link is decoded (year,
  subject levels, goal) and stored as `pathsLink` on the student; "Open in
  Paths" opens `/genapp/pathways/?s=shared&d=...&for=teacher`.
- **Lesson page**: "Evidence from this lesson", with "Add to reflection".
- **Beatty roster**: `schools/bty/staff.json`, built by
  `schools/tools/bty-build.py` from `btyrelief/BTYTT_2026Sem2_v1.csv`. A
  Beatty teacher whose email is in the CSV gets My Timetable at sign in.
  Rebuild it each semester from the new CSV.
- **The sign in domain decides what loads.** Every school in
  `schools/registry.json` is `closed`: reachable only from its own domain
  (plus `allowEmails` where listed). Other domains get no school. Use
  `currentSchoolId()` (`components/login.js`) for any school check: an
  account with no `schoolId` field predates schools and is Beatty's; `null`
  means no school and must never fall back to Beatty.

### What v2.1 added

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

1. **Videos.** Demo snippets are done (v2.1): a one minute overview and 13
   snippets of 20 to 30 seconds, delivered to the user as files, not in the
   repo. Scripts: `briefing-videos/tools/cocher2-demos/`. **Instructional
   videos and user guides come later**, made the same way. Keep MP4s out of
   `main`.
2. **Integration, without the data question.** A review on 9 November found
   Co-Cher organised around classes and lessons, not the student. The user has
   **parked the data part for later**: one record per student (keyed by
   `sfKey`), one competency framework (6 areas, 3 domains and the Log's 9 MOE
   competencies do not line up), per student results, and above all whether
   teachers share a view of a student (that needs `backend/` or OneDrive). Do
   not start those without the user. Moves that do not depend on it:
   - Capture evidence in lessons: tap a student on Present's seat map to log
     an observation tagged with the lesson and its focus; tag students in the
     reflection form (today its E21CC box is class level free text).
   - One timetable: the dashboard reads My Timetable (an SAJC demo teacher sees
     "No timetable found" on the dashboard while My Timetable holds the week).
   - One identity: Student Finder's "Who are you?" reuses the timetable claim
     and sign in, instead of asking again.
   - A first student profile page from what exists (Student Finder subjects
     and teachers, E21CC across the teacher's classes, observations).
   - The end state stays: each app sends a small per student summary (Log:
     competency levels with evidence; Paths: its share link already carries
     year, levels and goal) into the student's profile. Needs genapp changes.
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
