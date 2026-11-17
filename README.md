# pedagogies

Co-Cher: a planning, teaching and tracking companion for Singapore teachers.
This repository is public and is served by GitHub Pages at
`harmanjohll.github.io/pedagogies/`. **No student data is ever committed here.**

## What is where

| Folder or file | What it is | Live address | Status |
|---|---|---|---|
| `app/` | **Co-Cher 1** (Beatty only). The folder is called `app` for historical reasons; its address must not change | `/pedagogies/` (the root forwards to `app/cocher.html`) | Frozen at v8.9 |
| `cocher2/` | **Co-Cher 2**, for every school, and the shared engine (sign in, schools, data, every screen) | `/pedagogies/cocher2/` | Active |
| `cocher3/` | **Co-Cher 3 preview**: a new layout and look on Co-Cher 2's engine. Only its own files live here | `/pedagogies/cocher3/` | Preview, open to all |
| `cocher2/schools/` | School packs and published staff rosters (see its README) | | |
| `backend/` | The optional school backend (a Drive folder per school) | | |
| `live/` | Live session pages for students | | |
| `briefing-videos/tools/` | Scripts that record demo and briefing videos. Videos themselves stay out of the repo | | |
| `archive/` | Old Co-Cher 1 builds. Its subfolders `v2` to `v7` are **Co-Cher 1 versions**, not Co-Cher 2 or 3 | | Read only |
| `archive/spatialplanner/` | The early standalone Spatial Planner pages | | Read only |
| `spatialplanner*.html`, `backup.html`, `cocher.html` (root) | Forwarders only, so old bookmarks still open the archived pages | | Forwarders |

## Versions

Each line has its own number and its own file:

| Line | Version file | Format |
|---|---|---|
| Co-Cher 1 | `app/js/version.js` | v8.9 |
| Co-Cher 2 | `cocher2/js/version.js` (and `cocher2/sw.js`, kept equal) | v2.x |
| Co-Cher 3 | `cocher3/js/version.js` | 3.x.y |

`VERSIONS.md` has the history. `HANDOVER.md` is the working brief for whoever
continues the build: read it first.
