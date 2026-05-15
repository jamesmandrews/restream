import { config } from "./config";
import { logger } from "./logger";
import { validateFallback } from "./fallback";
import { SrtMonitor } from "./srt-monitor";
import { StreamStateMachine } from "./stream-state";

async function main(): Promise<void> {
  logger.info("Restream orchestrator starting");
  logger.info(`SRT port: ${config.srtPort} (passphrase protected)`);
  logger.info(`RTMP target: ${config.rtmpUrl}`);
  logger.info(`Local relay: ${config.localRtmpUrl}`);
  logger.info(`Fallback: ${config.fallbackType} @ ${config.fallbackPath}`);

  validateFallback();

  const stateMachine = new StreamStateMachine();
  const monitor = new SrtMonitor();

  // Start relay first (reads from UDP, pushes to nginx-rtmp)
  stateMachine.startRelay();

  // Small delay to let relay bind UDP port
  await new Promise((r) => setTimeout(r, 500));

  // Start fallback (writes to UDP)
  stateMachine.startFallback();

  monitor.on("stream-up", async () => {
    logger.info("Event: stream-up");
    await stateMachine.goLive();
  });

  monitor.on("stream-down", () => {
    logger.info("Event: stream-down");
    stateMachine.startFallback();
  });

  monitor.start();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    await monitor.stop();
    await stateMachine.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("Orchestrator running — waiting for SRT connection");
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
