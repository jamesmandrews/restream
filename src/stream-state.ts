import { FFmpegProcess } from "./ffmpeg-manager";
import { buildFallbackArgs } from "./fallback";
import { logger } from "./logger";

export type State = "IDLE" | "FALLBACK" | "LIVE";

export class StreamStateMachine {
  private state: State = "IDLE";
  private fallbackProcess: FFmpegProcess | null = null;

  getState(): State {
    return this.state;
  }

  startFallback(): void {
    if (this.state === "FALLBACK") return;
    logger.info(`State: ${this.state} -> FALLBACK`);
    this.fallbackProcess = new FFmpegProcess("fallback", buildFallbackArgs());

    this.fallbackProcess.on("exit", () => {
      if (this.state === "FALLBACK") {
        logger.warn("Fallback exited unexpectedly — restarting");
        this.fallbackProcess = null;
        this.state = "IDLE";
        this.startFallback();
      }
    });

    this.fallbackProcess.start();
    this.state = "FALLBACK";
    logger.info("State: FALLBACK — fallback content streaming");
  }

  async goLive(): Promise<void> {
    if (this.state === "LIVE") return;
    logger.info(`State: ${this.state} -> LIVE`);
    this.state = "LIVE";

    // Don't kill fallback — Twitch will drop it when live FFmpeg
    // connects with the same stream key. Clean up after a delay.
    if (this.fallbackProcess?.running) {
      const proc = this.fallbackProcess;
      this.fallbackProcess = null;
      setTimeout(async () => {
        if (proc.running) {
          logger.info("Cleaning up old fallback process");
          await proc.stop();
        }
      }, 5000);
    }

    logger.info("State: LIVE — streaming from SRT source");
  }

  async shutdown(): Promise<void> {
    if (this.fallbackProcess?.running) {
      await this.fallbackProcess.stop();
    }
    this.state = "IDLE";
  }
}
