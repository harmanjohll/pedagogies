# Briefing video tools

Turns real app screenshots into 1080p MP4 briefing videos. Used for the Co-Cher 1 set in `../`.

## Files
- `video.html`: the renderer. It draws any moment of the video from a timeline: frame, highlight ring, callouts, cursor, title cards.
- `scenes.json`: example scene list (Co-Cher 1). Per scene: `ch` (chapter-list label), `img`, `box` [x,y,w,h], `notes` [{x,y,text,place}], `click` [x,y], `title`, `desc`, `dur` (ms).
- `build-tl.cjs`: builds the timeline JSONs from `scenes.json`. Chapter names, promises, outro checklists and closing card are set in its `CH` array.
- `render.cjs`: renders a timeline to MP4 (Playwright + ffmpeg).
- `verify.sh`: checks each MP4; saves posters and sample frames.

## Use
1. Capture screenshots at 2880×1800 (1440×900 viewport, scale 2). Seed the app's storage first. Co-Cher 2 uses `cocher2_*` keys and a separate store per school.
2. Scale them to 1440×900 into `<dir>/img/<chapter>-<key>.png`.
3. Write `<dir>/scenes.json`. Coordinates are in 2880×1800 image pixels.
4. Edit `CH` and `HERO` in `build-tl.cjs`, then run `node build-tl.cjs <dir>`.
5. Copy `video.html` into `<dir>`.
6. Check stills: `node render.cjs <dir> tl-01-x.json --stills 3000,9000`. Stills go to `<dir>/out/`.
7. Render: `node render.cjs <dir> tl-01-x.json <dir>/out/name.mp4`.
8. Run `./verify.sh <dir>/out`.

## Change for Co-Cher 2
- `video.html` hard-codes the header "Co-Cher — Lesson Design Assistant", "Staff briefing" / "Feature guide", and the footer `harmanjohll.github.io/pedagogies`. Change the footer to `/pedagogies/cocher2/`.
- For shorter, single-feature videos: fewer scenes per chapter. Shorten or drop the chapter card and outro durations in `D` in `build-tl.cjs`.

## Not included
- The Co-Cher 1 screenshots and the capture scripts. Capture fresh from Co-Cher 2.
