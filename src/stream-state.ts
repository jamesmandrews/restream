import { EventEmitter } from "events";
import { FFmpegProcess } from "./ffmpeg-manager";
import { buildFallbackArgs, buildLiveArgs } from "./fallback";
import { logger } from "./logger";

export type State = "IDLE" | "FALLBACK" | "LIVE" | "SWITCHING";

export class StreamStateMachine extends EventEmitter {
  private state: State = "IDLE";
  private liveProcess: FFmpegProcess | null = null;
  private fallbackProcess: FFmpegProcess | null = null;

  getState(): State {
    return this.state;
  }

  async startFallback(): Promise<void> {
    if (this.state === "FALLBACK") return;

    logger.info(`State: ${this.state} -> SWITCHING (to fallback)`);
    this.state = "SWITCHING";

    if (this.liveProcess?.running) {
      await this.liveProcess.stop();
      this.liveProcess = null;
    }

    this.fallbackProcess = new FFmpegProcess("fallback", buildFallbackArgs());
    this.fallbackProcess.start();

    this.state = "FALLBACK";
    logger.info("State: FALLBACK — fallback content streaming");
  }

  async goLive(): Promise<void> {
    if (this.state === "LIVE") return;

    logger.info(`State: ${this.state} -> SWITCHING (to live)`);
    this.state = "SWITCHING";

    if (this.fallbackProcess?.running) {
      await this.fallbackProcess.stop();
      this.fallbackProcess = null;
    }

    this.liveProcess = new FFmpegProcess("live", buildLiveArgs());

    this.liveProcess.on("exit", () => {
      if (this.state === "LIVE") {
        logger.info("Live FFmpeg exited — camera disconnected");
        this.emit("live-ended");
      }
    });

    this.liveProcess.start();

    this.state = "LIVE";
    logger.info("State: LIVE — streaming from SRT source");
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down all FFmpeg processes");
    const stops: Promise<void>[] = [];
    if (this.liveProcess?.running) stops.push(this.liveProcess.stop());
    if (this.fallbackProcess?.running) stops.push(this.fallbackProcess.stop());
    await Promise.all(stops);
    this.state = "IDLE";
  }
}
