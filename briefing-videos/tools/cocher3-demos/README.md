# Co-Cher 3 instructional videos

Short captioned recordings of the real app: one teacher question per clip
(about twenty seconds), plus a one minute overview cut from them. No narration.

## Files
- `rec.cjs`: the kit, adapted from `../cocher2-demos/rec.cjs`. Co-Cher 3's
  address and look; a fixed school morning (`AT`), so the timetable has a
  lesson on; the school's staff roster replaced by `roster.cjs`.
- `roster.cjs`: a made up staff roster. Every name and timetable is invented.
- `videos.cjs`: one script per clip. `node videos.cjs 03 07` records only those.
- `overview.cjs`: cuts `00-what-is-co-cher.mp4` from the clips, by caption.

## Run
Serve `pedagogies/` and `genapp/` side by side on port 8765, then:
`node videos.cjs && node overview.cjs`. Output goes to `out/` (or `OUT_DIR`).
In a sandbox, set `CDN_DIR` (npm copies of the CDN libraries, see the Co-Cher 2
README) and `FONT_CSS` (a local copy of the web font stylesheet).

## Rules kept
- Made up people only: the seeded sample classes, the Student Finder demo
  timetable, `roster.cjs`. No real staff or student names.
- A clip opens on the teacher's question, shows three steps at most, and ends
  on the result. Captions say only what is on screen.
- Captions or voice, never both. These use captions.
- No hyphens or dashes in caption text.
- When a screen changes, rerun its clip. Keep MP4s out of this folder; the ones
  shown inside Co-Cher 3 go in `cocher3/demos/`.
