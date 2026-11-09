#!/usr/bin/env bash
# Verify each rendered MP4 and extract a poster thumbnail + sample frames.
O="${1:-$(dirname "$0")/out}"   # folder holding the rendered MP4s
cd "$O" || exit 1
mkdir -p posters samples
for f in Co-Cher-Briefing-*.mp4; do
  n=${f%.mp4}
  info=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration,size -of default=nw=1:nk=1 "$f" | tr '\n' ' ')
  echo "$f :: $info"
  # poster: opening/chapter card fully settled (~2.8s in)
  ffmpeg -loglevel error -y -ss 2.8 -i "$f" -frames:v 1 "posters/$n.png"
done
# samples from the full briefing for a quality check
F=Co-Cher-Briefing-00-Full.mp4
i=0; for t in 3.5 9 16.5 31.5 64.5 85 91.5 119.5 158 190; do
  ffmpeg -loglevel error -y -ss $t -i "$F" -frames:v 1 "samples/s$(printf %02d $i).png"; i=$((i+1)); done
ffmpeg -loglevel error -y -i samples/s00.png -i samples/s01.png -i samples/s02.png -i samples/s03.png -i samples/s04.png -i samples/s05.png \
  -filter_complex "[0]scale=640:360[a];[1]scale=640:360[b];[2]scale=640:360[c];[3]scale=640:360[d];[4]scale=640:360[e];[5]scale=640:360[f];[a][b][c][d][e][f]xstack=inputs=6:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0" samples/sheetA.png
ffmpeg -loglevel error -y -i samples/s06.png -i samples/s07.png -i samples/s08.png -i samples/s09.png \
  -filter_complex "[0]scale=960:540[a];[1]scale=960:540[b];[2]scale=960:540[c];[3]scale=960:540[d];[a][b][c][d]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0" samples/sheetB.png
ls -la "$O"/*.mp4 "$O"/posters
