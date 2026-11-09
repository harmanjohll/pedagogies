# Co-Cher 2 demo snippets

Live recordings of the real app, 1920x1080 at 30 fps, with an on-screen cursor,
captions and title cards. No narration. Used for the v2.1 demo set: thirteen
snippets of 20 to 30 seconds and a one minute overview cut from them.

## Files
- `rec.cjs`: the kit. Signs in a made up teacher, skips first-run screens,
  records with the Chrome screencast, and draws the overlay (cursor, ripple,
  highlight ring, lower-third caption, title and end cards). Writes
  `<name>.mp4` and `<name>.json` (caption timings).
- `snippets.cjs`: one script per snippet. `node snippets.cjs 03 07` records
  only those; no arguments records all.
- `overview.cjs`: cuts the overview from the snippets using the caption
  timings in `PICKS`, with crossfades and intro and outro cards.

## Setup
1. Serve a folder holding `pedagogies/` and `genapp/` side by side on port 8765,
   so `/pedagogies/cocher2/` and `/genapp/` both resolve (Paths and the Log are
   embedded from genapp).
2. If the browser cannot reach cdn.jsdelivr.net (as in a sandbox), install the
   same libraries from npm into `cdn/` here:
   `npm i --prefix cdn chart.js@4.4.6 katex@0.16.11 jszip@3.10.1 pdfjs-dist@4.0.379 xlsx@0.18.5`.
   `rec.cjs` serves them in place of the CDN. Nothing in the app changes.
3. `node snippets.cjs`, then `node overview.cjs`. Output goes to `out/`
   (or `OUT_DIR`). Keep MP4s out of the repo.

## Rules kept
- Made up people only (the seeded sample classes, the Student Finder demo
  timetable, the SAJC demo account). No real staff or student names.
- Captions describe only what is on screen. No live AI output: the session had
  no API key, so AI features are shown through the app's seeded exemplars.
- No hyphens or dashes in caption text.
