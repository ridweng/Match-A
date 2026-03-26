import "reflect-metadata";
import { loadApiEnv } from "./config/env";

async function bootstrap() {
  loadApiEnv();
  const [
    { ensureInstalledDatabase },
    { NestFactory },
    { AppModule },
    { runtimeConfig },
    { HealthService },
  ] =
    await Promise.all([
      import("@workspace/db/install"),
      import("@nestjs/core"),
      import("./app.module"),
      import("./config/runtime"),
      import("./modules/health/health.service"),
    ]);

  await ensureInstalledDatabase();

  const healthService = new HealthService();
  await healthService.assertReadiness();

  const app = await NestFactory.create(AppModule, {
    cors: true,
  });
  app.setGlobalPrefix("api");
  await app.listen(runtimeConfig.port);
  console.log(`[api-server] listening on ${runtimeConfig.port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
