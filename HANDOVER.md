# Co-Cher: next-chat brief

## Paste into the new chat
> Read `HANDOVER.md`. If it's not on `main`: `git fetch origin claude/cocher-audit-versioning-h85j3x && git show FETCH_HEAD:HANDOVER.md`.
> Do task 1 now. Prepare tasks 2–3; wait for my instructions before building them.

## Ground rules
- Work only in `cocher2/` (Co-Cher 2, v1.16, all schools).
- Don't touch `app/` (Co-Cher 1, Beatty only, frozen at v8.9).
- Keep the two apart: `cocher_*` keys belong to Co-Cher 1, `cocher2_*` to Co-Cher 2.
- Public repo: never commit student names, classes or registers.
- Ship as v1.17:
  - bump `cocher2/js/version.js` (`APP_VERSION`)
  - bump `cocher2/sw.js` (`VERSION`)
  - add an entry to `cocher2/js/components/whats-new.js`
  - add a `VERSIONS.md` row
- School packs: `cocher2/schools/` (see its README).

## Task 1: Paths (build now)
- File: `cocher2/js/views/cce.js`. The ECG tab is `CONTENT_AREAS` id `'ECG'`.
- Inside the ECG tab, add a sub-tab: existing content | **Paths**.
- Paths = an iframe of `/genapp/pathways/`:
  - root-relative path, not `https://`
  - fills the panel
  - "Open full screen" button
  - a message, not a blank box, if it fails to load
- Don't copy Pathways' files or content. That comes later, on request.
- Deep links work: e.g. `?s=year&y=sec2&tab=advice`.
- Local test: clone `harmanjohll/genapp` next to `pedagogies/`, then serve the parent folder.

## Task 2: Student Finder (wait for link + instructions)
- File: `cocher2/js/views/admin.js`.
- Add it as a section next to Find a Teacher. The page has sections, not tabs.
- Purpose: tag teachers ↔ students.
- Student data loads on the teacher's device or via `backend/`. Never commit it.
- Key all data by school id.
- Check the overlap first: the E21CC Log already lets students pick their teachers.

## Task 3: E21CC Learning Log (wait for confirmation)
- Recommended place: sidebar → Culture → "Learning Log", below My Classes (`cocher2/js/components/sidebar.js`).
- Embed `/genapp/e21cclog/teacher.html`. It already supports being embedded.
- Show it to Beatty only for now (`schoolId === 'bty'`).
- Never read or write `e21cclog*` keys from Co-Cher.

## External apps (Pathways, E21CC Log)
- They stay in the genapp repo. Co-Cher embeds them; it never copies them.
- Updates appear in Co-Cher automatically.
- Build changes in a genapp test folder; promote them when ready.
- Rebuild inside Co-Cher only when an app is stable and needs Co-Cher's data.
- All `harmanjohll.github.io` pages share one browser storage space. Keep key prefixes distinct.

## Decisions pending (from the user)
- Student Finder: source link; upload on device or via `backend/`; school consent.
- Who owns teacher↔student links: Student Finder (recommended) or the E21CC Log.
- E21CC Log placement: Culture (recommended) or Assessment → AaL.
- Paths: all schools or Beatty only? (The P6 page uses Beatty's PSLE ranges.)
- Merge the `briefing-videos/` branch into `main`?
