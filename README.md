# Restream: SRT Ingest with Auto-Fallback

Accept an SRT stream from a camera or hardware encoder, relay it as RTMP to Twitch, YouTube, or any RTMP platform. When the camera feed drops, automatically switch to fallback content (BRB image or video loop) so the platform never shows "offline."

## How It Works

```
[Camera/Encoder] --SRT--> [Orchestrator]
                             |
                       monitors SRT
                       manages FFmpeg
                             |
                 +-----------+-----------+
                 |                       |
           [Stream UP]             [Stream DOWN]
                 |                       |
           FFmpeg: SRT->RTMP       FFmpeg: Fallback->RTMP
                 |                       |
                 +-----> nginx-rtmp <----+
                        (local relay)
                             |
                       push to Twitch/
                       YouTube/etc
```

**nginx-rtmp** maintains the persistent RTMP connection to the platform. During the ~1-2 second FFmpeg switch, `drop_idle_publisher 10s` keeps the session alive. The platform sees a continuous stream.

## Requirements

- Docker and Docker Compose
- A server with a public IP (for SRT ingest)
- An RTMP URL + stream key from your platform

## Quick Start

### 1. Clone and configure

```bash
git clone <your-repo-url> restream
cd restream
cp .env.example .env
```

Edit `.env` with your platform details:

```bash
# Required: your platform RTMP URL with stream key
RTMP_URL=rtmp://live.twitch.tv/app/live_xxxxxxxxxxxx

# Required: SRT passphrase (10-79 chars) — prevents unauthorized streaming
SRT_PASSPHRASE=my-secret-passphrase-here

# Optional: change SRT listen port (default 9000)
SRT_PORT=9000

# Optional: fallback type - "image" or "video"
FALLBACK_TYPE=image
```

### 2. Add fallback content

Drop your files in the `fallback/` directory:

- **BRB image**: Replace `fallback/brb.png` with your own 1920x1080 PNG
- **Video loop**: Place an h264+AAC video file in `fallback/` and update `.env`:
  ```bash
  FALLBACK_TYPE=video
  FALLBACK_FILE=my-brb-loop.mp4
  ```

A default BRB image is included.

### 3. Start the server

```bash
docker compose up --build -d
```

Check logs:

```bash
docker compose logs -f orchestrator
```

### 4. Configure your camera/encoder

Point your SRT-capable camera or hardware encoder to:

```
srt://YOUR_SERVER_IP:9000?mode=caller&passphrase=YOUR_SRT_PASSPHRASE
```

The server listens in SRT listener mode with passphrase encryption (AES-128). Most cameras and encoders (LiveU, Teradek, Marshall, Magewell, etc.) support SRT caller mode — set the destination to your server IP, port 9000, and the passphrase. Connections without the correct passphrase are rejected.

**Test with FFmpeg** (useful for verifying the server works before connecting a camera):

```bash
ffmpeg -f lavfi -i testsrc=size=1920x1080 -f lavfi -i sine \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -f mpegts \
  "srt://YOUR_SERVER_IP:9000?passphrase=YOUR_SRT_PASSPHRASE"
```

### 5. Firewall setup (Ubuntu)

```bash
sudo bash setup-firewall.sh
```

This opens SSH (22/tcp) and SRT (9000/udp), denies everything else inbound.

If you changed `SRT_PORT`, pass it:

```bash
sudo SRT_PORT=9001 bash setup-firewall.sh
```

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `SRT_PORT` | `9000` | UDP port for SRT ingest |
| `SRT_PASSPHRASE` | *(required)* | SRT encryption passphrase (10-79 chars) |
| `RTMP_URL` | *(required)* | Platform RTMP URL with stream key |
| `LOCAL_RTMP_URL` | `rtmp://nginx-rtmp/live/stream` | Internal relay URL (don't change) |
| `FALLBACK_TYPE` | `image` | `image` or `video` |
| `FALLBACK_FILE` | `brb.png` | Filename in `fallback/` directory |
| `PROBE_INTERVAL_MS` | `3000` | SRT health check interval (ms) |
| `SWITCH_DELAY_MS` | `5000` | Delay before switching to fallback (ms) |

## State Machine

```
IDLE --> FALLBACK --> LIVE --> SWITCHING --> FALLBACK
          ^                                    |
          +------------------------------------+
```

- **Startup**: Immediately begins streaming fallback content
- **Stream detected**: Switches to live SRT feed
- **Stream lost** (debounced): Switches back to fallback after `SWITCH_DELAY_MS`
- **SWITCHING** state prevents race conditions during transitions

## Fallback Content Guidelines

### Image
- PNG or JPEG, 1920x1080 recommended
- Gets encoded to h264 in real-time by FFmpeg
- Higher CPU usage than video loop

### Video
- Must be h264 video + AAC audio (RTMP requirement)
- Loops infinitely with `-stream_loop -1`
- Lower CPU usage since no encoding needed (`-c copy`)
- Convert if needed:
  ```bash
  ffmpeg -i input.mov -c:v libx264 -c:a aac -movflags +faststart fallback/brb-loop.mp4
  ```

## Troubleshooting

### Stream not connecting
- Verify SRT port is open: `sudo ufw status`
- Check the port is UDP, not TCP
- Test locally: `ffmpeg -f lavfi -i testsrc -c:v libx264 -f mpegts srt://localhost:9000`

### Platform shows offline during switch
- Increase `drop_idle_publisher` in `nginx/nginx.conf` (default 10s)
- Reduce `SWITCH_DELAY_MS` for faster fallback activation
- Check orchestrator logs for switch timing

### High CPU usage
- Use video fallback instead of image (avoids real-time encoding)
- Ensure live stream uses h264 so `-c copy` works (no transcoding)

### Logs
```bash
# All services
docker compose logs -f

# Orchestrator only
docker compose logs -f orchestrator

# nginx-rtmp only
docker compose logs -f nginx-rtmp
```

## Stopping

```bash
docker compose down
```

## Project Structure

```
restream/
├── docker-compose.yml        # Service definitions
├── Dockerfile                # Orchestrator (Node.js + FFmpeg)
├── Dockerfile.nginx          # nginx-rtmp relay
├── setup-firewall.sh         # Ubuntu UFW setup script
├── .env.example              # Configuration template
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Environment config
│   ├── logger.ts             # Winston logger
│   ├── srt-monitor.ts        # SRT health detection
│   ├── ffmpeg-manager.ts     # FFmpeg process lifecycle
│   ├── stream-state.ts       # State machine
│   └── fallback.ts           # Fallback content / FFmpeg args
├── nginx/
│   ├── nginx.conf            # nginx-rtmp configuration
│   └── entrypoint.sh         # Runtime config injection
└── fallback/
    └── brb.png               # Default BRB image
```
