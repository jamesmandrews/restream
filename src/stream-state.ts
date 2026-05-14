import { FFmpegProcess } from "./ffmpeg-manager";
import { buildFallbackArgs, buildLiveArgs } from "./fallback";
import { logger } from "./logger";

export type State = "IDLE" | "FALLBACK" | "LIVE" | "SWITCHING";

export class StreamStateMachine {
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

    // Stop live process if running
    if (this.liveProcess?.running) {
      await this.liveProcess.stop();
      this.liveProcess = null;
    }

    // Start fallback
    this.fallbackProcess = new FFmpegProcess("fallback", buildFallbackArgs());
    this.fallbackProcess.start();

    this.state = "FALLBACK";
    logger.info("State: FALLBACK — fallback content streaming");
  }

  async goLive(): Promise<void> {
    if (this.state === "LIVE") return;

    logger.info(`State: ${this.state} -> SWITCHING (to live)`);
    this.state = "SWITCHING";

    // Stop fallback process if running
    if (this.fallbackProcess?.running) {
      await this.fallbackProcess.stop();
      this.fallbackProcess = null;
    }

    // Start live pipeline
    this.liveProcess = new FFmpegProcess("live", buildLiveArgs());
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
