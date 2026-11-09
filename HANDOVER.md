# Co-Cher: handover brief for the next chat

Written 8 November 2026, at the end of the chat that made the Co-Cher 1 user
guides and briefing videos. Read this first, then `VERSIONS.md` and
`cocher2/schools/README.md`.

---

## 0. Opening message to paste into the new chat

> We're starting the next version of **Co-Cher 2** (`cocher2/`, currently v1.16).
> First read `HANDOVER.md` at the repo root. If it isn't on `main` yet, run
> `git fetch origin claude/cocher-audit-versioning-h85j3x && git show FETCH_HEAD:HANDOVER.md`.
> Then do section 2.1 (the Paths sub-tab under CCE2021 → ECG) as an embed of the
> live Pathways app. Get sections 2.2 and 2.3 ready, but wait for my instructions
> and links before building them. Don't copy any student data into this repo.

---

## 1. Where things stand

### Two lines, deliberately kept apart

| Line | Folder | Live address | Who it's for | Status |
|---|---|---|---|---|
| **Co-Cher 1** | `app/` (`app/cocher.html`) | `harmanjohll.github.io/pedagogies/` (the root redirects here) | **Beatty only.** The version Beatty teachers use today. | **Frozen at v8.9.** Emergency fixes only. |
| **Co-Cher 2** | `cocher2/` (`cocher2/cocher2.html`) | `harmanjohll.github.io/pedagogies/cocher2/` | **Every school**: Beatty, Park View Primary, Opera Estate Primary, SAJC | **Active development, v1.16.** All new work goes here. |

- The schools' separate spaces ("bubbles") are inside **`cocher2/`**, not `app/`.
  Each school has a pack (`cocher2/schools/<id>.json`), an optional roster
  (`cocher2/schools/<id>/staff.json`) and its own storage on the device
  (`cocher2_app_data__<id>`). `cocher2/schools/registry.json` routes sign-ins
  by email domain and can close a school to everyone except its `allowEmails`
  list (Park View and Opera Estate are closed betas).
- Keep the two lines apart. Both run on the same web address, so the browser
  shares storage between them unless the names differ. Co-Cher 1 uses `cocher_*`
  keys, IndexedDB `cocher` and service-worker cache `cocher-`. Co-Cher 2 uses
  `cocher2_*`, IndexedDB `cocher2` and cache `cocher2-`, in its own folder (so
  its own service-worker scope). Never cross these. Teachers move their own work
  across with Settings → Data → Export, then Import.

### Shipping a Co-Cher 2 version

1. `cocher2/js/version.js`: bump `APP_VERSION` (next is **v1.17**).
2. `cocher2/sw.js`: set `VERSION` to the same value, so the offline cache refreshes.
3. `cocher2/js/components/whats-new.js`: add an entry for the new version at the top.
4. `VERSIONS.md`: add a row to the Co-Cher 2 table marked **Current (active)**, and mark the old row **Superseded**.

### Rules that hold everywhere

- **This repo is public.** Student names, class lists and registers must never
  be committed. Staff rosters go in only for a school that has agreed. See
  `cocher2/schools/README.md`.
- Signing in is a routing step, not real security: a static site has no server.
  Anything that truly needs access control needs `backend/` (one Drive folder
  per school, plus an Apps Script read proxy).

### Left over from the last chat

- Five **briefing videos** (`briefing-videos/`) and this file are on branch
  `claude/cocher-audit-versioning-h85j3x`, not yet merged to `main`.
- The videos and the user guides show **Co-Cher 1**. If Beatty moves to Co-Cher 2,
  they'll need remaking. The tools that made them were not saved to the repo.

---

## 2. This version's work

### 2.1 Paths: CCE2021 → ECG → "Paths" sub-tab (build now)

**Where.** `cocher2/js/views/cce.js`. ECG is one of six content-area tabs
(`CONTENT_AREAS`, id `'ECG'`; the current tab is `activeTab`, and the tab buttons
are `.cce-tab`). Inside the ECG tab only, add a two-way switch: the existing
content, and a new **Paths** view.

**What.** Embed the live Pathways app in an iframe at the root-relative address
**`/genapp/pathways/`**:

- Pathways lives on the same web address as Co-Cher, and GitHub Pages doesn't
  block framing, so a plain iframe works.
- Use the root-relative path, not a full `https://` link. Co-Cher's admin overlay
  sends `http…` links to a new tab, and a relative path also keeps it on the same address.
- Size the iframe to fill the panel, and add an "Open full screen" button that
  opens it in a new tab.
- If the iframe fails to load (offline, or local testing without genapp), show
  a plain message, never a blank box.
- One line of framing: Paths answers ECG's third question, "How do I get there?"

**Don't** copy Pathways' files or content into this repo. The user will ask for
content to be brought across later, as a separate request.

**Facts about Pathways (genapp repo, `pathways/`, "Paths v4").**

- It makes no network calls while running.
- Every page has its own address, so Co-Cher can link straight to one.
  Examples: `?s=year&y=sec2&tab=advice`, `?s=after`, `?s=myplan`.
- It stores its data under `paths.progress`, which doesn't clash with Co-Cher.
- The P6 page uses **Beatty's** 2025 PSLE posting ranges. Everything else uses
  national defaults.

**Testing locally.** `python3 -m http.server` run from this repo won't serve
`/genapp/`. Clone `harmanjohll/genapp` next to `pedagogies/`, serve the parent
folder, and open `/pedagogies/cocher2/`.

**Optional, in the genapp repo, and only if the user agrees:** add an
`?embed=1` mode to Pathways that hides its own top bar. The E21CC Log already
has one.

### 2.2 Student Finder in Admin One-Stop (wait for instructions)

The user will send a link to the source, and instructions for **tagging
teachers to students and students to teachers**. Until then, plan only.

- **Where.** `cocher2/js/views/admin.js`. Admin One-Stop is **one page of
  sections**, not tabs: Quick Tools, Find a Teacher, MOE Circulars, and events.
  Recommendation: add **Student Finder** as a section next to Find a Teacher,
  following its pattern: load or paste a file, empty states that say what's
  missing, and nothing invented. Switch the page to tabs only if it gets crowded.
- **Data (critical).** Assume the source contains student names and classes.
  It must **not** be committed. Load it on the teacher's own device, the way a
  class list is uploaded, or serve it through `backend/` with the school's
  agreement. Key everything by school id.
- **Overlap to settle first.** E21CC Log v4 already links students to teachers:
  each student picks a teacher for every subject and CCA, plus a form teacher,
  from a staff list pasted from the timetable. Student Finder must not become
  a second list that drifts from that one (see section 4).

### 2.3 E21CC Learning Log: where it goes (decide, then embed)

- **Recommendation.** A sidebar item **"Learning Log"** under **Culture**,
  directly below My Classes (`cocher2/js/components/sidebar.js`). It embeds the
  teacher console at **`/genapp/e21cclog/teacher.html`**. Later, add a "Log entries"
  shortcut on each class page.
- **Why there.** Co-Cher already tracks E21CC for each student in My Classes.
  The Log's entries are the students' own evidence for exactly those
  competencies, and the console is organised around the same students and teachers.
  The alternative is Assessment → AaL (the Log is student self-reflection), but
  teachers will look for "my students' entries" near their classes.
- **Only Beatty for now.** The Log's school offering is Beatty's
  (`e21cclog/school/beatty.json`, NEXUS@BTY), so show it only when
  `schoolId === 'bty'`, the same way Relief Timetable uses `only: 'bty'`.
- **Data stays where it is.** Student logs live on the students' devices and
  reach teachers through Teams links (OneDrive is planned for Phase 2). The
  console keeps its own PIN-protected store (`e21cclog.teacher`). Because
  everything is on one web address, the console holds the same data whether
  opened on its own or inside Co-Cher. Co-Cher must never read or write
  `e21cclog*` keys itself.
- The console already detects when it's embedded (the `EMBED` flag in
  `e21cclog/assets/app.js`).

---

## 3. External apps that keep changing: the approach

Pathways and the E21CC Log stay in the **genapp** repo, where the user keeps
improving them. Co-Cher shows them; it doesn't copy them.

| Option | How it stays up to date | Use it when |
|---|---|---|
| **Live embed (chosen)** | Co-Cher shows `/genapp/<app>/` in an iframe. Every push to genapp appears in Co-Cher within minutes, with nothing to sync. | The app is still changing, and it doesn't need Co-Cher's data. |
| Pinned embed | Point at a frozen folder (genapp already keeps old versions), and move the pointer on purpose. | A version must not change during a term. |
| Copy and sync script | A script copies files across, like `sync-labsim.sh`. Every change needs a re-run, and the copies drift. | Avoid it. |
| Native port | Rebuild inside Co-Cher's code, after which changes are ported by hand. | The app is stable **and** needs Co-Cher's classes, students or timetables. The E21CC Log may get there; Pathways probably never needs to. |

Working rules:

1. **Promote rather than push straight to the live folder.** `genapp/pathways/`
   is "always the latest", so anything pushed there shows up inside Co-Cher too.
   Build in a test folder (as `e21cclog/next/` was used) and promote it once it's good.
2. **Keep a small agreement between the apps.** An `?embed=1` mode. Optionally,
   context passed in the address (for example `?school=bty`). Each app reads
   only its own storage keys.
3. **One web address means one shared storage space.** Every page on
   `harmanjohll.github.io` shares the browser's storage and its size limit, and
   can read the others' data, including Co-Cher's saved AI key. That's fine
   while every page there is the user's own. Keep it that way, and keep the
   key prefixes distinct: `cocher_`, `cocher2_`, `e21cclog`, `paths.`.

---

## 4. Decisions still open (for the user)

1. **Student Finder source.** The link, and whether the data is uploaded on each
   device or served through `backend/`. Has the school agreed?
2. **One owner for teacher–student links.** Recommended: Student Finder in
   Co-Cher owns the links, and the E21CC Log reads from it later, instead of
   each keeping its own list.
3. **Where the E21CC Log goes.** Culture, below My Classes (recommended), or
   Assessment → AaL.
4. **Who sees Paths.** All schools, or Beatty only? The P6 page shows Beatty's
   PSLE ranges.
5. **The briefing-videos branch.** Merge it to `main` (via a pull request) or leave it.
