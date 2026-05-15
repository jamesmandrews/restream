import { execFile, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { config } from "./config";
import { logger } from "./logger";

export class SrtMonitor extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private probing = false;
  private paused = false;
  private currentProbe: ChildProcess | null = null;

  start(): void {
    this.paused = false;
    logger.info(`SRT monitor started: listening on port ${config.srtPort} every ${config.probeIntervalMs}ms`);
    this.interval = setInterval(() => this.probe(), config.probeIntervalMs);
    this.probe();
  }

  stop(): void {
    this.paused = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.killProbe();
  }

  pause(): void {
    this.paused = true;
    this.killProbe();
  }

  resume(): void {
    this.paused = false;
    logger.info("SRT monitor resumed");
  }

  private killProbe(): void {
    if (this.currentProbe) {
      this.currentProbe.kill("SIGKILL");
      this.currentProbe = null;
      this.probing = false;
    }
  }

  private probe(): void {
    if (this.probing || this.paused) return;
    this.probing = true;

    const timeoutUs = (config.probeIntervalMs - 500) * 1000;
    const srtUrl = `srt://0.0.0.0:${config.srtPort}?mode=listener&timeout=${timeoutUs}&passphrase=${config.srtPassphrase}`;

    this.currentProbe = execFile(
      "ffprobe",
      [
        "-v", "error",
        "-i", srtUrl,
        "-show_entries", "stream=codec_type",
        "-of", "csv=p=0",
      ],
      { timeout: config.probeIntervalMs + 2000 },
      (error, stdout) => {
        this.probing = false;
        this.currentProbe = null;

        if (this.paused) return;

        const hasStream = !error && stdout.trim().length > 0;
        if (hasStream) {
          logger.info("SRT stream detected — camera connected");
          this.emit("stream-up");
        }
      }
    );
  }
}
