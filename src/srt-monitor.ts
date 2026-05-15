import { EventEmitter } from "events";
import { FFmpegProcess } from "./ffmpeg-manager";
import { buildLiveArgs } from "./fallback";
import { logger } from "./logger";

export class SrtMonitor extends EventEmitter {
  private liveProcess: FFmpegProcess | null = null;
  private stopped = false;

  start(): void {
    this.stopped = false;
    this.startListener();
    logger.info("SRT monitor started — live FFmpeg listening for connections");
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.liveProcess?.running) {
      await this.liveProcess.stop();
      this.liveProcess = null;
    }
  }

  private startListener(): void {
    if (this.stopped) return;

    this.liveProcess = new FFmpegProcess("live", buildLiveArgs());
    let detected = false;

    this.liveProcess.on("stderr", (line: string) => {
      if (!detected && line.includes("Input #0")) {
        detected = true;
        logger.info("SRT stream detected — camera connected");
        this.emit("stream-up");
      }
    });

    this.liveProcess.on("exit", () => {
      if (detected) {
        logger.info("Live FFmpeg exited — camera disconnected");
        this.emit("stream-down");
      }
      if (!this.stopped) {
        setTimeout(() => this.startListener(), 1000);
      }
    });

    this.liveProcess.start();
  }
}
