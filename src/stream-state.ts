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
    this.fallbackProcess.start();
    this.state = "FALLBACK";
    logger.info("State: FALLBACK — fallback content streaming");
  }

  async stopFallback(): Promise<void> {
    if (this.fallbackProcess?.running) {
      await this.fallbackProcess.forceStop();
      this.fallbackProcess = null;
    }
    this.state = "LIVE";
    logger.info("State: LIVE — streaming from SRT source");
  }

  async shutdown(): Promise<void> {
    if (this.fallbackProcess?.running) {
      await this.fallbackProcess.stop();
    }
    this.state = "IDLE";
  }
}
