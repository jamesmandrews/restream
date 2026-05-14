import dotenv from "dotenv";
dotenv.config();

export interface Config {
  srtPort: number;
  rtmpUrl: string;
  localRtmpUrl: string;
  fallbackType: "image" | "video";
  fallbackPath: string;
  probeIntervalMs: number;
  switchDelayMs: number;
}

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: Config = {
  srtPort: parseInt(requireEnv("SRT_PORT", "9000"), 10),
  rtmpUrl: requireEnv("RTMP_URL"),
  localRtmpUrl: requireEnv("LOCAL_RTMP_URL", "rtmp://nginx-rtmp/live/stream"),
  fallbackType: requireEnv("FALLBACK_TYPE", "image") as "image" | "video",
  fallbackPath: requireEnv("FALLBACK_PATH", "/app/fallback/brb.png"),
  probeIntervalMs: parseInt(requireEnv("PROBE_INTERVAL_MS", "3000"), 10),
  switchDelayMs: parseInt(requireEnv("SWITCH_DELAY_MS", "5000"), 10),
};
