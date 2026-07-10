# Co-Cher Version Lineage

The canonical URL always serves the **latest** version:
`https://harmanjohll.github.io/pedagogies/` → redirects to `app/cocher.html`.

| Version | Location | Live URL | Storage namespace | Status |
|---------|----------|----------|-------------------|--------|
| v1 | `archive/cocher-v1.html` (single-file: Lesson Planner chat + Spatial Designer tabs) | `/pedagogies/archive/cocher-v1.html` (old `/pedagogies/cocher.html` bookmarks redirect here) | `cocher_api_key`, `cocher_model`, `darkMode`, `spatialPlannerCustomPresets` | Archived |
| v2 | `archive/v2/` (frozen snapshot of the modular app as of Jul 2026) | `/pedagogies/archive/v2/cocher.html` | `cocher_v2_*` (renamed at freeze time so the archive can never touch live data) | Archived |
| v3 | `app/` (active development) | `/pedagogies/` (via `index.html`) | `cocher_*` (incl. `cocher_app_data`) | **Current** |

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

## Archiving a future version (e.g. freezing v3 before v4)

1. `cp -r app archive/v3` (drop `labsim.zip`).
2. In `archive/v3/` only: `sed -i "s/'cocher_/'cocher_v3_/g"` across `*.js`/`*.html`
   (storage keys only — do NOT rename the `_cocher_lesson` share-format marker).
3. Add the archived banner to `archive/v3/cocher.html` (copy from `archive/v2/cocher.html`).
4. Update the table above and the version badge in `app/js/version.js`.
