#!/bin/bash
HOST=${1:-64.227.51.13}
PORT=${2:-9000}
PASS=${3:-mystreamkeyyay}

ffmpeg -f lavfi -i testsrc=size=1920x1080 -f lavfi -i sine \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -f mpegts \
  "srt://${HOST}:${PORT}?passphrase=${PASS}"
