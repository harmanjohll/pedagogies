# Co-Cher Version Lineage

The canonical URL always serves the **latest** version:
`https://harmanjohll.github.io/pedagogies/` → redirects to `app/cocher.html`.

| Version | Location | Live URL | Storage namespace | Status |
|---------|----------|----------|-------------------|--------|
| v1 | `archive/cocher-v1.html` (single-file: Lesson Planner chat + Spatial Designer tabs) | `/pedagogies/archive/cocher-v1.html` (old `/pedagogies/cocher.html` bookmarks redirect here) | `cocher_api_key`, `cocher_model`, `darkMode`, `spatialPlannerCustomPresets` | Archived |
| v2 | `archive/v2/` (frozen snapshot of the modular app as of Jul 2026) | `/pedagogies/archive/v2/cocher.html` | `cocher_v2_*` (renamed at freeze time so the archive can never touch live data) | Archived |
| v3 | `archive/v3/` (frozen snapshot as of Jul 2026 — v3.1 feature set) | `/pedagogies/archive/v3/cocher.html` | `cocher_v3_*` (renamed at freeze time) | Archived |
| v4 | `archive/v4/` (frozen snapshot as of Jul 2026 — "Staffroom Desk" design + learner portraits, growth engine, department packs, as originally shipped) | `/pedagogies/archive/v4/cocher.html` | `cocher_v4_*` (renamed at freeze time) | Archived |
| v4.1 | `archive/v4.1/` (frozen snapshot as of Jul 2026 — domain-accuracy audit sweep: assessment/spatial/simulation fixes, admin workflow bug fix, Sec 1/2 CCE lessons, CCA exemplars, demo events, as originally shipped) | `/pedagogies/archive/v4.1/cocher.html` | `cocher_v4_1_*` (renamed at freeze time) | Archived |
| v5.1 | `archive/v5.1/` (frozen snapshot as of Jul 2026 — inviting/engaging generation: living lesson journey, workflow modes, visual teacher identity, configurable tracking schemas, bulk student upload, remarks, My References; incl. Sem 2 timetable refresh, as originally shipped) | `/pedagogies/archive/v5.1/cocher.html` | `cocher_v5_1_*` (renamed at freeze time) | Archived |
| v6 | `archive/v6/` (frozen snapshot as of Jul 2026 — "Showtime": run-of-show staging, first-class scenes, students on the canvas, Class Screen projector view, simulation one-stop, as originally shipped) | `/pedagogies/archive/v6/cocher.html` | `cocher_v6_*` (renamed at freeze time) | Archived |
| v6.1 | `archive/v6.1/` (frozen snapshot as of Jul 2026 — "Wieldable": cockpit + journey bar, named seats, TLDR+expand plans, pedagogy frameworks, sim depth, as originally shipped) | `/pedagogies/archive/v6.1/cocher.html` | `cocher_v6_1_*` (renamed at freeze time) | Archived |
| v6.2 | `app/` (active development — "Effortless": one-click auto-staging, materials generation (HTML decks + TTS audio), CCE through the planner, flow-audit repairs, Present-mode fit fixes) | `/pedagogies/` (via `index.html`) | `cocher_*` (incl. `cocher_app_data`) | **Current** |

## Notes

- All versions share one browser origin (GitHub Pages), so localStorage/sessionStorage keys
  are shared between them. That is why the v2 archive's keys were renamed to `cocher_v2_*`
  at freeze time — opening the archive will never read or corrupt current data. The archive
  therefore starts "empty" (fresh login/API key) by design.
- The v2 archive still reports usage events to the same analytics Google Sheet as the live app.
- `backup.html` in the repo root is a backup of the **Spatial Pedagogy Planner v6.0**, not Co-Cher.
  The `spatialplanner*.html` files follow the same convention as this table: the unversioned
  file is the latest, versioned files are archives.
- Sign-in in all versions is a client-side roster check (timetable CSV), not real authentication.

## Archiving a future version (e.g. freezing v5.1 before the next release)

1. `cp -r app archive/vN` (drop `labsim.zip`). If the current working tree already contains work
   for the NEXT version, freeze from the shipped commit instead so the archive reflects what was
   actually released: `git archive <shipped-vN-commit> app | tar -x -C archive/vN`.
2. In `archive/vN/` only: `sed -i "s/'cocher_/'cocher_vN_/g"` across `*.js`/`*.html`
   (storage keys only — do NOT rename the `_cocher_lesson` share-format marker; note the dot in a
   version like `v4.1` becomes an underscore in the namespace: `cocher_v4_1_`).
3. Add the archived banner to `archive/vN/cocher.html` (copy from the previous archive's banner).
4. Update the table above, and in `app/js/version.js` bump `APP_VERSION` and prepend the newly
   archived version to `PREVIOUS_VERSIONS`.
