import "reflect-metadata";
import type { Request, Response } from "express";
import type { OpenAPIObject } from "@nestjs/swagger";
import type { LogLevel } from "@nestjs/common";
import { loadApiEnv } from "./config/env";

function isAdminAuthorized(authHeader: string | undefined, username: string, password: string) {
  const header = String(authHeader || "");
  if (!header.startsWith("Basic ")) {
    return false;
  }
  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  const [providedUser, providedPassword] = decoded.split(":");
  return providedUser === username && providedPassword === password;
}

type RuntimeLogLevel = "error" | "warn" | "log" | "debug" | "verbose";

function resolveNestLoggerLevels(logLevel: RuntimeLogLevel): LogLevel[] {
  switch (logLevel) {
    case "error":
      return ["error"];
    case "warn":
      return ["error", "warn"];
    case "log":
      return ["error", "warn", "log"];
    case "debug":
      return ["error", "warn", "log", "debug"];
    case "verbose":
      return ["error", "warn", "log", "debug", "verbose"];
    default:
      return ["error", "warn"];
  }
}

function muteNoisyConsoleOutputForProduction(nodeEnv: string) {
  if (nodeEnv !== "production") {
    return;
  }

  console.log = () => undefined;
  console.debug = () => undefined;
}

function normalizeHostValue(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return null;
  }

  try {
    const normalizedUrl = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
    return new URL(normalizedUrl).host.split(":")[0] || null;
  } catch {
    return raw.split(":")[0] || null;
  }
}

function getRequestHost(req: Request) {
  const forwardedHostHeader =
    typeof req.headers["x-forwarded-host"] === "string"
      ? req.headers["x-forwarded-host"].split(",")[0]?.trim()
      : undefined;
  const hostHeader =
    typeof req.headers.host === "string" ? req.headers.host.trim() : undefined;
  return normalizeHostValue(forwardedHostHeader || hostHeader || req.hostname);
}

async function bootstrap() {
  loadApiEnv();
  const [
    { ensureInstalledDatabase },
    { NestFactory },
    { AppModule },
    { runtimeConfig },
    { createOpenApiDocument, renderScalarReferenceHtml, setupSwaggerUi },
  ] =
    await Promise.all([
      import("@workspace/db/install"),
      import("@nestjs/core"),
      import("./app.module"),
      import("./config/runtime"),
      import("./docs/openapi/setup"),
    ]);

  await ensureInstalledDatabase();
  muteNoisyConsoleOutputForProduction(runtimeConfig.nodeEnv);

  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: resolveNestLoggerLevels(runtimeConfig.logLevel),
  });
  app.setGlobalPrefix("api");
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("trust proxy", 1);
  const openApiDocument: OpenAPIObject = createOpenApiDocument(app);
  const apiHost = normalizeHostValue(runtimeConfig.baseUrl);
  const adminHost = normalizeHostValue(runtimeConfig.admin.baseUrl || runtimeConfig.adminBaseUrl);
  const adminHostRestricted = Boolean(adminHost && adminHost !== apiHost);
  const requireAdminHost = (req: Request, res: Response, next: () => void) => {
    if (!adminHostRestricted) {
      next();
      return;
    }

    if (getRequestHost(req) !== adminHost) {
      res.status(404).send("Not found");
      return;
    }

    next();
  };

  expressApp.use(
    ["/dashboard", "/api/admin", "/api/docs", "/api/reference", "/api/openapi.json"],
    requireAdminHost
  );

  expressApp.use("/api/docs", (req: Request, res: Response, next: () => void) => {
    if (!runtimeConfig.admin.enabled) {
      res.status(404).send("Not found");
      return;
    }
    if (
      !isAdminAuthorized(
        typeof req.headers.authorization === "string"
          ? req.headers.authorization
          : undefined,
        runtimeConfig.admin.username,
        runtimeConfig.admin.password
      )
    ) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Matcha Admin"');
      res.status(401).send("Unauthorized");
      return;
    }
    next();
  });

  setupSwaggerUi(app, openApiDocument);

  expressApp.get("/", (req: Request, res: Response) => {
    if (adminHostRestricted && getRequestHost(req) !== adminHost) {
      return res.redirect("/api");
    }

    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Matcha Admin</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:
        radial-gradient(circle at top, rgba(14,122,74,0.12), transparent 38%),
        linear-gradient(180deg, #eff6f0 0%, #f8faf8 100%); color: #17211b; min-height: 100vh; }
      main { max-width: 760px; margin: 0 auto; padding: 40px 24px; min-height: 100vh; display: flex; align-items: center; }
      .card { background: rgba(255,255,255,0.96); border: 1px solid #dde5dd; border-radius: 24px; padding: 32px; box-shadow: 0 24px 60px rgba(16, 24, 18, 0.08); width: 100%; }
      .eyebrow { display: inline-flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 999px; background: #eff7f1; color: #1c5a39; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .dot { width: 10px; height: 10px; border-radius: 999px; background: #d97706; box-shadow: 0 0 0 0 rgba(217,119,6,0.35); animation: pulse 1.8s infinite; }
      h1 { margin: 18px 0 10px; font-size: 36px; line-height: 1.1; }
      p { margin: 0 0 16px; line-height: 1.65; color: #4c5b52; }
      .status { margin-top: 20px; padding: 16px 18px; border-radius: 16px; background: #f6f8f6; border: 1px solid #dde5dd; color: #33463a; font-size: 15px; }
      .status strong { color: #17211b; display: block; margin-bottom: 6px; }
      .meta { margin-top: 14px; font-size: 13px; color: #69786f; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
      button { font: inherit; }
      .button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 16px; border-radius: 12px; border: 1px solid #0e7a4a; background: #0e7a4a; color: #fff; font-weight: 700; cursor: pointer; }
      .button:disabled { cursor: wait; opacity: 0.78; }
      code { background: #eff4ef; border-radius: 8px; padding: 2px 6px; }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(217,119,6,0.35); }
        70% { box-shadow: 0 0 0 12px rgba(217,119,6,0); }
        100% { box-shadow: 0 0 0 0 rgba(217,119,6,0); }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <div class="eyebrow"><span class="dot"></span>Waiting For API Readiness</div>
        <h1>Matcha admin will open automatically when the API is ready.</h1>
        <p>This page checks <code>/api/healthz/ready</code> every 30 seconds. As soon as readiness returns success, it redirects to the protected admin dashboard and your browser will handle the password prompt there.</p>
        <div class="status" id="readiness-status" aria-live="polite">
          <strong>Checking readiness...</strong>
          The admin dashboard stays locked here until the backend reports that it is ready.
        </div>
        <div class="meta" id="readiness-meta">Next automatic check in 30 seconds.</div>
        <div class="actions">
          <button class="button" id="check-now-button" type="button">Check Now</button>
        </div>
      </div>
    </main>
    <script>
      const statusEl = document.getElementById("readiness-status");
      const metaEl = document.getElementById("readiness-meta");
      const checkNowButton = document.getElementById("check-now-button");
      const redirectTarget = "/api/admin/stats/overview";
      const pollMs = 30000;
      let nextTimer = null;

      function setStatus(title, detail) {
        statusEl.innerHTML = "<strong>" + title + "</strong>" + detail;
      }

      function scheduleNextCheck() {
        if (nextTimer) {
          window.clearTimeout(nextTimer);
        }
        metaEl.textContent = "Next automatic check in 30 seconds.";
        nextTimer = window.setTimeout(function () {
          void checkReadiness("automatic");
        }, pollMs);
      }

      async function checkReadiness(source) {
        checkNowButton.disabled = true;
        metaEl.textContent = source === "manual"
          ? "Running manual readiness check..."
          : "Running automatic readiness check...";
        setStatus("Checking readiness...", "Waiting for the backend to report that it is ready.");
        try {
          const response = await window.fetch("/api/healthz/ready", {
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
          if (response.ok) {
            setStatus("API ready.", "Redirecting to the protected admin dashboard.");
            metaEl.textContent = "Readiness confirmed just now.";
            window.location.replace(redirectTarget);
            return;
          }

          const checkedAt = new Date().toLocaleTimeString();
          setStatus(
            "API not ready yet.",
            "The backend is still starting up or waiting on database setup."
          );
          metaEl.textContent = "Last checked at " + checkedAt + ".";
        } catch (_error) {
          const checkedAt = new Date().toLocaleTimeString();
          setStatus(
            "Readiness check failed.",
            "The API could not be reached. The page will keep waiting and try again."
          );
          metaEl.textContent = "Last checked at " + checkedAt + ".";
        } finally {
          checkNowButton.disabled = false;
          scheduleNextCheck();
        }
      }

      checkNowButton.addEventListener("click", function () {
        void checkReadiness("manual");
      });

      void checkReadiness("automatic");
    </script>
  </body>
</html>`);
  });
  expressApp.get("/dashboard", (_req: Request, res: Response) => {
    res.redirect("/api/admin/stats/overview");
  });
  expressApp.get("/api/openapi.json", (_req: Request, res: Response) => {
    res.json(openApiDocument);
  });
  expressApp.get("/api/reference", (_req: Request, res: Response) => {
    res.type("html").send(renderScalarReferenceHtml("/api/openapi.json"));
  });
  expressApp.get("/api", (_req: Request, res: Response) => {
    res.json({
      name: "Matcha API",
      status: "ok",
      routes: {
        health: "/api/healthz",
        readiness: "/api/healthz/ready",
        adminDashboard: "/api/admin/stats/overview",
        openApi: "/api/openapi.json",
        apiReference: "/api/reference",
        internalSwaggerUi: "/api/docs",
      },
    });
  });
  expressApp.get(
    "/api/admin/stats",
    (_req: Request, res: Response) => {
      res.redirect("/api/admin/stats/overview");
    }
  );
  await app.listen(runtimeConfig.port);
  console.info(`[api-server] listening on ${runtimeConfig.port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
