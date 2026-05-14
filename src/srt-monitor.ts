import { execFile } from "child_process";
import { EventEmitter } from "events";
import { config } from "./config";
import { logger } from "./logger";

export interface SrtMonitorEvents {
  "stream-up": () => void;
  "stream-down": () => void;
}

export class SrtMonitor extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private wasUp = false;
  private downSince: number | null = null;

  start(): void {
    logger.info(`SRT monitor started: probing every ${config.probeIntervalMs}ms`);
    this.interval = setInterval(() => this.probe(), config.probeIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private probe(): void {
    const srtUrl = `srt://127.0.0.1:${config.srtPort}?mode=caller&timeout=2000000`;

    execFile(
      "ffprobe",
      [
        "-v", "error",
        "-i", srtUrl,
        "-show_entries", "stream=codec_type",
        "-of", "csv=p=0",
      ],
      { timeout: 5000 },
      (error, stdout) => {
        const hasStream = !error && stdout.trim().length > 0;

        if (hasStream) {
          this.downSince = null;
          if (!this.wasUp) {
            logger.info("SRT stream detected — UP");
            this.wasUp = true;
            this.emit("stream-up");
          }
        } else {
          if (this.wasUp) {
            if (!this.downSince) {
              this.downSince = Date.now();
              logger.info("SRT stream lost — waiting for debounce");
            }

            const elapsed = Date.now() - this.downSince;
            if (elapsed >= config.switchDelayMs) {
              logger.info(`SRT stream confirmed down after ${elapsed}ms`);
              this.wasUp = false;
              this.downSince = null;
              this.emit("stream-down");
            }
          }
        }
      }
    );
  }
}
