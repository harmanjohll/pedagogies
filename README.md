# pedagogies

Co-Cher: a planning, teaching and tracking companion for Singapore teachers.
This repository is public and is served by GitHub Pages at
`harmanjohll.github.io/pedagogies/`. **No student data is ever committed here.**

## What is where

| Folder or file | What it is | Live address | Status |
|---|---|---|---|
| `cocher3/` | **Co-Cher 3, the main line.** Every school. Its own engine, school files, look and videos | `/pedagogies/` (the root opens it) and `/pedagogies/cocher3/` | **Active** |
| `cocher3/schools/` | School packs, published staff rosters, and the onboarding form for a new school (see its README) | | |
| `cocher2/` | **Co-Cher 2.** Still works, as the fallback, on the same saved work | `/pedagogies/cocher2/` | Frozen at v2.7 |
| `app/` | **Co-Cher 1** (Beatty only). The folder is called `app` for historical reasons; its address must not change | `/pedagogies/app/cocher.html` | Frozen at v8.9 |
| `backend/` | The optional school backend (a Drive folder per school) | | |
| `live/` | Live session pages for students | | |
| `briefing-videos/tools/` | Scripts that record the videos. The ones shown inside Co-Cher 3 are kept in `cocher3/demos/` | | |
| `archive/` | Old Co-Cher 1 builds. Its subfolders `v2` to `v7` are **Co-Cher 1 versions**, not Co-Cher 2 or 3 | | Read only |
| `archive/spatialplanner/` | The early standalone Spatial Planner pages | | Read only |
| `spatialplanner*.html`, `backup.html`, `cocher.html` (root) | Forwarders only, so old bookmarks still open the archived pages | | Forwarders |
| `sync-labsim.sh` | Pulls simulations into Co-Cher 1's folder. Kept for the record; Co-Cher 1 is frozen | | Legacy |

## Versions

Each line has its own number and its own file:

| Line | Version file | Format |
|---|---|---|
| Co-Cher 3 | `cocher3/js/v3/version.js` | 3.x.y, moving |
| Co-Cher 2 | `cocher2/js/version.js` | v2.7, frozen |
| Co-Cher 1 | `app/js/version.js` | v8.9, frozen |

`VERSIONS.md` has the history. `HANDOVER.md` is the working brief for whoever
continues the build: read it first.
