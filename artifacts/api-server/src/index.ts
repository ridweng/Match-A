import "reflect-metadata";
import type { Request, Response } from "express";
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
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get("/", (_req: Request, res: Response) => {
    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Matcha API</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7f4; color: #17211b; }
      main { max-width: 760px; margin: 0 auto; padding: 40px 24px; }
      .card { background: #fff; border: 1px solid #dde5dd; border-radius: 18px; padding: 24px; box-shadow: 0 16px 40px rgba(16, 24, 18, 0.06); }
      h1 { margin: 0 0 10px; font-size: 34px; }
      p { margin: 0 0 18px; line-height: 1.6; color: #4c5b52; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
      a { text-decoration: none; }
      .button { display: inline-block; padding: 12px 16px; border-radius: 12px; border: 1px solid #0e7a4a; background: #0e7a4a; color: #fff; font-weight: 600; }
      .button.secondary { background: #fff; color: #183323; border-color: #cfd8d1; }
      code { background: #eff4ef; border-radius: 8px; padding: 2px 6px; }
      ul { padding-left: 18px; color: #4c5b52; }
      li { margin: 8px 0; }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>Matcha API</h1>
        <p>The server is running. Public API routes live under <code>/api</code>.</p>
        <div class="actions">
          <a class="button" href="/api/healthz">Health</a>
          <a class="button secondary" href="/api/admin/stats/overview">Admin Dashboard</a>
        </div>
        <ul>
          <li>API health: <code>/api/healthz</code></li>
          <li>Readiness: <code>/api/healthz/ready</code></li>
          <li>Admin dashboard: <code>/api/admin/stats/overview</code></li>
        </ul>
      </div>
    </main>
  </body>
</html>`);
  });
  expressApp.get("/dashboard", (_req: Request, res: Response) => {
    res.redirect("/api/admin/stats/overview");
  });
  expressApp.get("/api", (_req: Request, res: Response) => {
    res.json({
      name: "Matcha API",
      status: "ok",
      routes: {
        health: "/api/healthz",
        readiness: "/api/healthz/ready",
        adminDashboard: "/api/admin/stats/overview",
      },
    });
  });
  expressApp.get(
    "/api/admin/stats",
    (_req: Request, res: Response) => {
      res.redirect("/api/admin/stats/overview");
    }
  );
  app.setGlobalPrefix("api");
  await app.listen(runtimeConfig.port);
  console.log(`[api-server] listening on ${runtimeConfig.port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
