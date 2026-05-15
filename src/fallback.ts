import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { config } from "./config";
import { logger } from "./logger";

const UDP_OUT = "udp://127.0.0.1:5000?pkt_size=1316";

export function validateFallback(): void {
  if (!existsSync(config.fallbackPath)) {
    throw new Error(`Fallback file not found: ${config.fallbackPath}`);
  }

  if (config.fallbackType === "video") {
    try {
      const result = execFileSync("ffprobe", [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name",
        "-of", "csv=p=0",
        config.fallbackPath,
      ], { encoding: "utf-8" }).trim();

      if (result !== "h264") {
        logger.warn(`Fallback video codec is "${result}", h264 recommended for RTMP`);
      }
    } catch {
      logger.warn("Could not probe fallback video codec — ensure it is h264+aac");
    }
  }

  logger.info(`Fallback validated: type=${config.fallbackType} path=${config.fallbackPath}`);
}

export function buildRelayArgs(): string[] {
  return [
    "-f", "mpegts",
    "-i", "udp://127.0.0.1:5000?overrun_nonfatal=1&fifo_size=50000000",
    "-c", "copy",
    "-f", "flv",
    config.localRtmpUrl,
  ];
}

export function buildFallbackArgs(): string[] {
  if (config.fallbackType === "video") {
    return [
      "-stream_loop", "-1",
      "-re",
      "-i", config.fallbackPath,
      "-c", "copy",
      "-f", "mpegts",
      UDP_OUT,
    ];
  }

  return [
    "-loop", "1",
    "-i", config.fallbackPath,
    "-f", "lavfi",
    "-i", "anullsrc=r=44100:cl=stereo",
    "-c:v", "libx264",
    "-tune", "stillimage",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-g", "60",
    "-c:a", "aac",
    "-b:a", "128k",
    "-t", "31536000",
    "-f", "mpegts",
    UDP_OUT,
  ];
}

export function buildLiveArgs(): string[] {
  return [
    "-i", `srt://0.0.0.0:${config.srtPort}?mode=listener&passphrase=${config.srtPassphrase}`,
    "-c", "copy",
    "-f", "mpegts",
    UDP_OUT,
  ];
}
