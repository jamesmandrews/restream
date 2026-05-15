import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";
import { logger } from "./logger";

export class FFmpegProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private _running = false;

  constructor(
    private readonly name: string,
    private readonly args: string[]
  ) {
    super();
  }

  get running(): boolean {
    return this._running;
  }

  start(): void {
    if (this._running) {
      logger.warn(`${this.name}: already running, skipping start`);
      return;
    }

    logger.info(`${this.name}: starting ffmpeg ${this.args.join(" ")}`);
    this.process = spawn("ffmpeg", this.args, { stdio: ["ignore", "pipe", "pipe"] });
    this._running = true;

    this.process.stderr?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) {
        logger.debug(`${this.name}: ${line}`);
        this.emit("stderr", line);
      }
    });

    this.process.on("close", (code) => {
      this._running = false;
      logger.info(`${this.name}: exited with code ${code}`);
      this.emit("exit", code);
    });

    this.process.on("error", (err) => {
      this._running = false;
      logger.error(`${this.name}: process error: ${err.message}`);
    });
  }

  forceStop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.process || !this._running) {
        resolve();
        return;
      }
      logger.info(`${this.name}: force stopping`);
      this.process.once("close", () => {
        this._running = false;
        this.process = null;
        resolve();
      });
      this.process.kill("SIGKILL");
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.process || !this._running) {
        resolve();
        return;
      }

      logger.info(`${this.name}: stopping`);

      const timeout = setTimeout(() => {
        logger.warn(`${this.name}: SIGTERM timeout, sending SIGKILL`);
        this.process?.kill("SIGKILL");
      }, 5000);

      this.process.once("close", () => {
        clearTimeout(timeout);
        this._running = false;
        this.process = null;
        resolve();
      });

      this.process.kill("SIGTERM");
    });
  }
}
