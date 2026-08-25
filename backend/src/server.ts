import { app } from "./app.js";
import { env, safeDatabaseIdentity } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./database/prisma.js";
import { startAgentScheduler } from "./modules/agents/agent-schedule.service.js";
import { startEmailDeliveryDispatcher } from "./modules/automation-bridge/email-delivery.service.js";

async function start() {
  logger.info(safeDatabaseIdentity(), "Database target");
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, "Backend listening"));
  const stopScheduler = startAgentScheduler();
  const stopEmailDispatcher = startEmailDeliveryDispatcher();

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    stopScheduler();
    stopEmailDispatcher();
    server.close((error) => {
      void prisma.$disconnect().then(() => {
      if (error) { logger.error({ err: error }, "Shutdown failed"); process.exit(1); }
      process.exit(0);
      });
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, "Backend startup failed");
  process.exit(1);
});
