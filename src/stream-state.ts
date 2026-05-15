import { FFmpegProcess } from "./ffmpeg-manager";
import { buildFallbackArgs, buildRelayArgs } from "./fallback";
import { logger } from "./logger";

export type State = "IDLE" | "FALLBACK" | "LIVE";

export class StreamStateMachine {
  private state: State = "IDLE";
  private relayProcess: FFmpegProcess | null = null;
  private fallbackProcess: FFmpegProcess | null = null;

  getState(): State {
    return this.state;
  }

  startRelay(): void {
    this.relayProcess = new FFmpegProcess("relay", buildRelayArgs());

    this.relayProcess.on("exit", () => {
      if (this.state !== "IDLE") {
        logger.warn("Relay exited — restarting");
        this.startRelay();
      }
    });

    this.relayProcess.start();
    logger.info("Relay started — reading from UDP, pushing to nginx-rtmp");
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

    // Stop fallback — live FFmpeg will take over writing to UDP
    if (this.fallbackProcess?.running) {
      await this.fallbackProcess.forceStop();
      this.fallbackProcess = null;
    }

    this.state = "LIVE";
    logger.info("State: LIVE — streaming from SRT source");
  }

  async shutdown(): Promise<void> {
    this.state = "IDLE";
    const stops: Promise<void>[] = [];
    if (this.fallbackProcess?.running) stops.push(this.fallbackProcess.stop());
    if (this.relayProcess?.running) stops.push(this.relayProcess.stop());
    await Promise.all(stops);
  }
}
