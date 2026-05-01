import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { runtimeConfig } from "../../config/runtime";
import { AdminService } from "./admin.service";

type DatabaseGraphNode = Awaited<
  ReturnType<AdminService["getDatabaseView"]>
>["graph"]["nodes"][number];
type DatabaseGraphEdge = Awaited<
  ReturnType<AdminService["getDatabaseView"]>
>["graph"]["edges"][number];
type DatabaseTableDetail = Awaited<
  ReturnType<AdminService["getDatabaseView"]>
>["tableDetails"][number];
type AdminOverview = Awaited<ReturnType<AdminService["getOverview"]>>;

type DatabaseGraphSize = "current" | "wide";
type OverviewTimeframe = AdminOverview["selectedTimeframe"];

const OVERVIEW_TIMEFRAME_LABELS: Record<OverviewTimeframe, string> = {
  all: "All time",
  now: "Last 24h",
  "1w": "1 week",
  "1m": "1 month",
  "3m": "3 months",
  "6m": "6 months",
  "1y": "1 year",
  "3y": "3 years",
};

function escapeHtml(input: unknown) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toIso(input: string | Date | null | undefined) {
  if (!input) return "—";
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString();
}

function renderOption(
  value: string,
  label: string,
  selectedValue: string | number | null | undefined
) {
  return `<option value="${escapeHtml(value)}"${
    String(selectedValue ?? "") === value ? " selected" : ""
  }>${escapeHtml(label)}</option>`;
}

function toMetricGroupId(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAdminQuery(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && String(value).trim()) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function escapeHtmlAttribute(input: unknown) {
  return escapeHtml(input).replace(/`/g, "&#96;");
}

@ApiExcludeController()
@Controller("admin/stats")
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  private authorize(req: Request, res: Response) {
    if (!runtimeConfig.admin.enabled) {
      res.status(404).send("Not found");
      return false;
    }

    const header = String(req.headers.authorization || "");
    if (!header.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Matcha Admin"');
      res.status(401).send("Unauthorized");
      return false;
    }

    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const [username, password] = decoded.split(":");
    const provided = Buffer.from(`${username || ""}:${password || ""}`);
    const expected = Buffer.from(
      `${runtimeConfig.admin.username}:${runtimeConfig.admin.password}`
    );
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Matcha Admin"');
      res.status(401).send("Unauthorized");
      return false;
    }

    return true;
  }

  private normalizeUsersFilters(input: {
    q?: string;
    kind?: string;
    activation?: string;
    threshold?: string;
    genderIdentity?: string;
    syntheticGroup?: string;
    dummyBatchKey?: string;
    generationVersion?: string;
  }) {
    const normalizedGenerationVersion = Number(input.generationVersion);

    return {
      q: input.q,
      kind: input.kind === "user" || input.kind === "dummy" ? input.kind : "all",
      activation:
        input.activation === "activated" || input.activation === "not_activated"
          ? input.activation
          : input.threshold === "reached"
            ? "activated"
            : input.threshold === "pending"
              ? "not_activated"
              : "all",
      genderIdentity: String(input.genderIdentity || "").trim(),
      syntheticGroup: String(input.syntheticGroup || "").trim(),
      dummyBatchKey: String(input.dummyBatchKey || "").trim(),
      generationVersion:
        Number.isFinite(normalizedGenerationVersion) && normalizedGenerationVersion > 0
          ? normalizedGenerationVersion
          : null,
    } as const;
  }

  private sendAdminJson(res: Response, payload: unknown) {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      fetchedAt: new Date().toISOString(),
      data: payload,
    });
  }

  private requestWantsJson(req: Request) {
    const accept = String(req.headers.accept || "");
    const contentType = String(req.headers["content-type"] || "");
    return accept.includes("application/json") || contentType.includes("application/json");
  }

  private completeAdminAction(req: Request, res: Response, redirectPath: string, payload: unknown) {
    if (this.requestWantsJson(req)) {
      this.sendAdminJson(res, payload);
      return;
    }
    res.redirect(redirectPath);
  }

  private renderPage(title: string, body: string, options?: { autoRefreshMs?: number }) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f7f4; color: #1d241f; }
      main { max-width: 1200px; margin: 0 auto; padding: 24px; }
      a { color: #0e7a4a; text-decoration: none; }
      h1, h2 { margin: 0 0 12px; }
      .topbar { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
      .nav { display: flex; gap: 16px; font-size: 14px; flex-wrap: wrap; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 24px; }
      .card { background: #fff; border: 1px solid #dde3dc; border-radius: 16px; padding: 16px; box-shadow: 0 8px 24px rgba(18, 38, 23, 0.04); }
      .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #5d6c62; }
      .value { font-size: 28px; font-weight: 700; margin-top: 6px; }
      table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dde3dc; border-radius: 16px; overflow: hidden; }
      th, td { padding: 12px 14px; border-bottom: 1px solid #eef2ec; text-align: left; font-size: 14px; vertical-align: top; }
      th { background: #f0f4ef; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #556259; }
      .pill { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 12px; background: #edf4ee; color: #29543a; }
      .muted { color: #65746a; }
      form { margin-bottom: 16px; }
      input { padding: 10px 12px; border-radius: 10px; border: 1px solid #ccd5ce; width: 280px; max-width: 100%; }
      select, button { font: inherit; }
      .actions { display:flex; gap:12px; margin: 12px 0 16px; }
      .button { padding:10px 14px; border-radius:10px; border:1px solid #ccd5ce; background:#fff; color:#1d241f; cursor:pointer; }
      .button.primary { border-color:#0e7a4a; background:#0e7a4a; color:#fff; }
      .health-indicator { display:inline-flex; align-items:center; gap:10px; border-radius:999px; border:1px solid #d5ddd7; background:#ffffff; color:#405046; padding:10px 14px; font-size:13px; font-weight:700; letter-spacing:0.02em; pointer-events:none; user-select:none; }
      .health-indicator::before { content:""; width:10px; height:10px; border-radius:999px; background: currentColor; opacity:0.95; }
      .health-indicator[data-health-state="healthy"] { background:#edf9f1; border-color:#b6e0c2; color:#0e7a4a; }
      .health-indicator[data-health-state="unhealthy"] { background:#fff1f1; border-color:#efb7b7; color:#b42318; }
      .health-indicator[data-health-state="checking"] { background:#f3f5f4; border-color:#d8ddda; color:#647067; }
      .meta { font-size: 13px; color: #65746a; margin-bottom: 16px; }
      .card.flush { padding: 0; overflow: hidden; }
      .card.flush .card-header { padding: 16px 16px 12px; }
      .graph-shell { overflow: auto; border-top: 1px solid #e2e8f0; background: #ffffff; }
      .full-bleed-card { width: calc(100vw - 24px); margin-left: calc(50% - 50vw + 12px); margin-right: calc(50% - 50vw + 12px); }
      @media (max-width: 768px) {
        main { padding: 16px; }
        .full-bleed-card { width: calc(100vw - 12px); margin-left: calc(50% - 50vw + 6px); margin-right: calc(50% - 50vw + 6px); }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="topbar">
        <div class="nav">
          <a href="/api/admin/stats/overview">Overview</a>
          <a href="/api/admin/stats/users">Users</a>
          <a href="/api/admin/stats/database">Database</a>
          <a href="/api/admin/stats/study">Study</a>
          <a href="/api/admin/stats/api-docs">API Docs</a>
        </div>
        <div
          class="health-indicator"
          id="admin-health-indicator"
          data-health-state="checking"
          aria-live="polite"
        >Checking API</div>
      </div>
      ${body}
    </main>
    ${
      options?.autoRefreshMs
        ? `<script>window.setTimeout(function(){ window.location.reload(); }, ${options.autoRefreshMs});</script>`
        : ""
    }
    <script>
      (function () {
        const indicator = document.getElementById("admin-health-indicator");
        if (!indicator) return;
        const pollMs = 30000;

        function setIndicator(state, label) {
          indicator.dataset.healthState = state;
          indicator.textContent = label;
        }

        async function updateHealth() {
          setIndicator("checking", "Checking API");
          try {
            const response = await window.fetch("/api/healthz/ready", {
              cache: "no-store",
              headers: { Accept: "application/json" },
            });
            if (response.ok) {
              setIndicator("healthy", "API Healthy");
              return;
            }
            setIndicator("unhealthy", "API Unhealthy");
          } catch (_error) {
            setIndicator("unhealthy", "API Unhealthy");
          }
        }

        void updateHealth();
        window.setInterval(function () {
          void updateHealth();
        }, pollMs);
      })();
    </script>
  </body>
</html>`;
  }

  private renderDatabaseGraph(
    nodes: DatabaseGraphNode[],
    edges: DatabaseGraphEdge[],
    size: DatabaseGraphSize,
    tableDetails: DatabaseTableDetail[]
  ) {
    const maxX = Math.max(...nodes.map((node) => node.x + node.width), 0) + 60;
    const maxY = Math.max(...nodes.map((node) => node.y + node.height), 0) + 60;
    const svgWidth = size === "wide" ? maxX + 420 : maxX;
    const svgHeight = size === "wide" ? 980 : 920;
    const schemaBlocks = [
      { label: "auth", x: 20, width: 250 },
      { label: "core", x: 300, width: 250 },
      { label: "catalog", x: 580, width: 250 },
      { label: "discovery", x: 860, width: 250 },
      { label: "goals", x: 1140, width: 250 },
      { label: "media", x: 1420, width: 250 },
    ];
    const nodeByKey = new Map(nodes.map((node) => [node.key, node] as const));
    const detailByKey = new Map(tableDetails.map((detail) => [detail.key, detail] as const));

    const edgeSvg = edges
      .map((edge) => {
        const from = nodeByKey.get(edge.from);
        const to = nodeByKey.get(edge.to);
        if (!from || !to || !from.present || !to.present) {
          return "";
        }
        const x1 = from.x + from.width;
        const y1 = from.y + from.height / 2;
        const x2 = to.x;
        const y2 = to.y + to.height / 2;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const color = edge.edgeType === "fk" ? "#2563eb" : "#a855f7";
        const dash = edge.edgeType === "fk" ? "" : ' stroke-dasharray="8 6"';
        const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

        return `
          <path d="${path}" fill="none" stroke="${color}" stroke-width="2.2"${dash} marker-end="url(#arrow-${edge.edgeType})" />
          <rect x="${midX - 58}" y="${midY - 11}" width="116" height="22" rx="11" fill="#ffffff" stroke="${color}" stroke-width="1" />
          <text x="${midX}" y="${midY + 4}" text-anchor="middle" font-size="11" fill="${color}" font-weight="600">${escapeHtml(
            edge.label
          )}</text>
        `;
      })
      .join("");

    const nodeSvg = nodes
      .map((node) => {
        const roleStyles =
          node.role === "source"
            ? { fill: "#eefbf3", stroke: "#0e7a4a", dash: "" }
            : node.role === "projection"
              ? { fill: "#f5f1ff", stroke: "#7c3aed", dash: ' stroke-dasharray="7 4"' }
              : { fill: "#f7f8fa", stroke: "#64748b", dash: "" };
        const statusStroke = node.present ? roleStyles.stroke : "#b91c1c";
        const statusFill = node.present ? roleStyles.fill : "#fff7f7";
        const count = node.present ? String(node.rowCount ?? 0) : "missing";
        const freshness = node.freshness ? toIso(node.freshness) : "—";
        const detail = detailByKey.get(node.key);
        const detailPayload = encodeURIComponent(
          JSON.stringify({
            key: node.key,
            label: node.label,
            schema: node.schema,
            table: node.table,
            role: node.role,
            description: node.description,
            present: node.present,
            columns: detail?.columns || [],
          })
        );

        return `
          <g style="cursor:pointer;" tabindex="0" role="button" aria-label="Open ${escapeHtmlAttribute(
            node.label
          )} details" onclick="window.openDbTableDetail('${escapeHtmlAttribute(
            detailPayload
          )}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.openDbTableDetail('${escapeHtmlAttribute(
            detailPayload
          )}');}">
            <rect
              x="${node.x}"
              y="${node.y}"
              width="${node.width}"
              height="${node.height}"
              rx="16"
              fill="${statusFill}"
              stroke="${statusStroke}"
              stroke-width="2"
              ${roleStyles.dash}
            />
            <title>${escapeHtml(node.description)}\nRole: ${escapeHtml(
              node.role
            )}\nRows: ${escapeHtml(count)}\nFreshness: ${escapeHtml(freshness)}</title>
            <text x="${node.x + 14}" y="${node.y + 24}" font-size="13" font-weight="700" fill="#0f172a">${escapeHtml(
              node.label
            )}</text>
            <text x="${node.x + 14}" y="${node.y + 43}" font-size="11" fill="#475569">${escapeHtml(
              node.description
            )}</text>
            <rect x="${node.x + 14}" y="${node.y + 56}" width="58" height="18" rx="9" fill="#ffffff" stroke="${statusStroke}" stroke-width="1" />
            <text x="${node.x + 43}" y="${node.y + 68.5}" text-anchor="middle" font-size="10" fill="${statusStroke}" font-weight="700">${escapeHtml(
              node.role
            )}</text>
            <text x="${node.x + node.width - 14}" y="${node.y + 69}" text-anchor="end" font-size="11" fill="#334155">rows: ${escapeHtml(
              count
            )}</text>
          </g>
        `;
      })
      .join("");

    const schemaSvg = schemaBlocks
      .map(
        (schema) => `
          <g>
            <rect x="${schema.x}" y="18" width="${schema.width}" height="${maxY - 24}" rx="18" fill="#f8faf8" stroke="#d8e1da" stroke-width="1.5" />
            <text x="${schema.x + 14}" y="42" font-size="16" font-weight="700" fill="#334155">${escapeHtml(
              schema.label
            )}</text>
          </g>
        `
      )
      .join("");

    return `
          <svg viewBox="0 0 ${maxX} ${maxY}" width="${svgWidth}" height="${svgHeight}" style="display:block;min-width:${svgWidth}px;" role="img" aria-label="Database architecture graph">
        <defs>
          <marker id="arrow-fk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb"></path>
          </marker>
          <marker id="arrow-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7"></path>
          </marker>
        </defs>
        ${schemaSvg}
        ${edgeSvg}
        ${nodeSvg}
      </svg>
    `;
  }

  @Get("study")
  async study(
    @Req() req: Request,
    @Res() res: Response,
    @Query("testRunId") testRunId?: string,
    @Query("compareTestRunId") compareTestRunId?: string,
    @Query("refresh") refresh?: string
  ) {
    if (!this.authorize(req, res)) return;
    const study = await this.adminService.getStudyDashboard({
      testRunId: testRunId || null,
      compareTestRunId: compareTestRunId || null,
      bypassCache: refresh === "1" || refresh === "true",
    });
    const testRunOptions = [
      renderOption("", "Auto-select active/latest", study.selectedTestRunId || ""),
      ...study.testRuns.map((run: any) =>
        renderOption(run.id, `${run.name} (${run.status})`, study.selectedTestRunId)
      ),
    ].join("");
    const compareOptions = [
      renderOption("", "No comparison", study.compareTestRunId || ""),
      ...study.testRuns.map((run: any) =>
        renderOption(run.id, `${run.name} (${run.status})`, study.compareTestRunId)
      ),
    ].join("");
    const summaryCards = [
      ["Participants", study.summary.participants],
      ["Active users", study.summary.activeUsers],
      ["Sessions", study.summary.totalSessions],
      ["Total app time", `${Math.round(study.summary.totalActiveSeconds / 60)}m`],
      ["Avg session", `${Math.round(study.summary.averageSessionSeconds / 60)}m`],
      ["Decisions", study.summary.totalDiscoveryDecisions],
      ["Likes", study.summary.likes],
      ["Passes", study.summary.passes],
      ["Like ratio", `${Math.round(study.summary.likeRatio * 100)}%`],
      ["Reached 30 likes", study.summary.usersReaching30Likes],
      ["Engaged", study.summary.engagedUsers],
      ["Blocked/frustrated", study.summary.blockedFrustratedUsers],
    ].map(([label, value]) => `<div class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("");
    const scoreRows = study.scorecard.map((row: any) =>
      `<tr><td>${escapeHtml(row.label)}</td><td><span class="pill">${escapeHtml(row.status)}</span></td></tr>`
    ).join("");
    const funnelRows = Object.entries(study.funnel).map(([key, value]) =>
      `<tr><td>${escapeHtml(key.replace(/_/g, " "))}</td><td>${escapeHtml(value)}</td></tr>`
    ).join("");
    const screenRows = study.screenUsage.map((row: any) =>
      `<tr><td>${escapeHtml(row.screen_name)}</td><td>${escapeHtml(row.area_name || "—")}</td><td>${escapeHtml(row.segments)}</td><td>${escapeHtml(Math.round(Number(row.total_ms || 0) / 60000))}m</td><td>${escapeHtml(Math.round(Number(row.average_ms || 0) / 1000))}s</td></tr>`
    ).join("");
    const eventRows = (title: string, rows: any[]) => `
      <div class="card">
        <h2>${escapeHtml(title)}</h2>
        <table><thead><tr><th>Event</th><th>Count</th><th>Users</th></tr></thead><tbody>
          ${rows.map((row) => `<tr><td>${escapeHtml(row.event_name)}</td><td>${escapeHtml(row.count)}</td><td>${escapeHtml(row.users)}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">No events</td></tr>'}
        </tbody></table>
      </div>`;
    const userRows = study.users.map((user: any) => `
      <tr>
        <td><a href="/api/admin/stats/study/users/${escapeHtmlAttribute(user.userId)}${study.selectedTestRunId ? `?testRunId=${escapeHtmlAttribute(study.selectedTestRunId)}` : ""}">${escapeHtml(user.label)}</a><div class="muted">${escapeHtml(user.publicId || user.userId)}</div></td>
        <td><span class="pill">${escapeHtml(user.engagementStatus.replace(/_/g, " "))}</span></td>
        <td>${escapeHtml(user.onboardingStatus)}</td>
        <td>${escapeHtml(user.activationStatus)}</td>
        <td>${escapeHtml(toIso(user.lastActive))}</td>
        <td>${escapeHtml(user.sessionCount)}</td>
        <td>${escapeHtml(Math.round(user.totalActiveSeconds / 60))}m</td>
        <td>${escapeHtml(user.likes)}</td>
        <td>${escapeHtml(user.passes)}</td>
        <td>${escapeHtml(user.cardsViewed)}</td>
        <td>${escapeHtml(user.reliabilityErrors)}</td>
      </tr>
    `).join("");
    const comparisonData: any = study.comparison;
    const comparison = comparisonData ? `
      <div class="card" style="margin-bottom:16px;">
        <h2>Test Comparison</h2>
        <table><thead><tr><th>Metric</th><th>Selected</th><th>Compared</th></tr></thead><tbody>
          ${["participants","averageSessionSeconds","totalDiscoveryDecisions","likes","passes","usersReaching30Likes","engagedUsers","blockedFrustratedUsers"].map((key) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(comparisonData.current[key])}</td><td>${escapeHtml(comparisonData.previous[key])}</td></tr>`).join("")}
        </tbody></table>
      </div>
    ` : "";

    res.send(this.renderPage("Study Analytics", `
      <h1>Study Analytics</h1>
      <div class="meta">Analytics API: ${escapeHtml(study.analyticsEnabled ? "enabled" : "disabled")} · Admin study: ${escapeHtml(study.analyticsAdminEnabled ? "enabled" : "disabled")}</div>
      <div class="card" style="margin-bottom:16px;">
        <h2>Test Management</h2>
        <form method="get">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:end;">
            <label><div class="label">Selected test run</div><select name="testRunId" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccd5ce;">${testRunOptions}</select></label>
            <label><div class="label">Compare with</div><select name="compareTestRunId" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccd5ce;">${compareOptions}</select></label>
            <button class="button primary" type="submit">Apply</button>
          </div>
        </form>
        <form method="post" action="/api/admin/stats/study/test-runs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
          <input name="name" placeholder="Test run name" required />
          <input name="startsAt" type="datetime-local" required />
          <input name="endsAt" type="datetime-local" />
          <input name="notes" placeholder="Notes" />
          <label class="muted"><input type="checkbox" name="includeAllRealUsers" checked /> Include all real users</label>
          <button class="button primary" type="submit">Create test run</button>
        </form>
        ${study.selectedTestRunId ? `
          <div class="actions">
            <form method="post" action="/api/admin/stats/study/test-runs/${escapeHtmlAttribute(study.selectedTestRunId)}/activate"><button class="button primary">Activate</button></form>
            <form method="post" action="/api/admin/stats/study/test-runs/${escapeHtmlAttribute(study.selectedTestRunId)}/pause"><button class="button">Pause</button></form>
            <form method="post" action="/api/admin/stats/study/test-runs/${escapeHtmlAttribute(study.selectedTestRunId)}/complete"><button class="button">Complete</button></form>
          </div>` : ""}
      </div>
      <div class="grid">${summaryCards}</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(360px,1fr));">
        <div class="card"><h2>Product Success Scorecard</h2><table><tbody>${scoreRows}</tbody></table></div>
        <div class="card"><h2>Funnel</h2><table><tbody>${funnelRows}</tbody></table></div>
      </div>
      <div class="card" style="margin:16px 0;"><h2>Time and Screen Usage</h2><table><thead><tr><th>Screen</th><th>Area</th><th>Segments</th><th>Total</th><th>Average</th></tr></thead><tbody>${screenRows || '<tr><td colspan="5" class="muted">No screen time</td></tr>'}</tbody></table></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(360px,1fr));">${eventRows("Discovery Behaviour", study.discovery)}${eventRows("Goals Behaviour", study.goals)}${eventRows("Reliability / Friction", study.friction)}</div>
      <div class="card" style="margin:16px 0;"><h2>User Table</h2><table><thead><tr><th>User</th><th>Engagement</th><th>Onboarding</th><th>Activation</th><th>Last active</th><th>Sessions</th><th>Time</th><th>Likes</th><th>Passes</th><th>Cards</th><th>Errors</th></tr></thead><tbody>${userRows || '<tr><td colspan="11" class="muted">No users in selected study run</td></tr>'}</tbody></table></div>
      ${comparison}
    `));
  }

  @Get("study.json")
  async studyJson(
    @Req() req: Request,
    @Res() res: Response,
    @Query("testRunId") testRunId?: string,
    @Query("compareTestRunId") compareTestRunId?: string,
    @Query("refresh") refresh?: string
  ) {
    if (!this.authorize(req, res)) return;
    const study = await this.adminService.getStudyDashboard({
      testRunId: testRunId || null,
      compareTestRunId: compareTestRunId || null,
      bypassCache: refresh === "1" || refresh === "true",
    });
    this.sendAdminJson(res, study);
  }

  @Get("study/users/:userId")
  async studyUserTimeline(
    @Req() req: Request,
    @Res() res: Response,
    @Param("userId") userIdRaw: string,
    @Query("testRunId") testRunId?: string
  ) {
    if (!this.authorize(req, res)) return;
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId)) {
      res.status(400).send("Invalid user id");
      return;
    }
    const detail = await this.adminService.getStudyUserTimeline(userId, testRunId || null);
    const rows = detail.timeline.map((item: any) =>
      `<tr><td>${escapeHtml(toIso(item.at))}</td><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.detail || "")}</td></tr>`
    ).join("");
    res.send(this.renderPage("Study User Timeline", `
      <h1>User Timeline</h1>
      <div class="actions"><a class="button" href="/api/admin/stats/study${testRunId ? `?testRunId=${escapeHtmlAttribute(testRunId)}` : ""}">Back to Study</a></div>
      <div class="card"><h2>User ${escapeHtml(userId)}</h2><table><thead><tr><th>Time</th><th>Type</th><th>Activity</th><th>Detail</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">No timeline events</td></tr>'}</tbody></table></div>
    `));
  }

  @Get("study/users/:userId.json")
  async studyUserTimelineJson(
    @Req() req: Request,
    @Res() res: Response,
    @Param("userId") userIdRaw: string,
    @Query("testRunId") testRunId?: string
  ) {
    if (!this.authorize(req, res)) return;
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "INVALID_USER_ID" });
      return;
    }
    const detail = await this.adminService.getStudyUserTimeline(userId, testRunId || null);
    this.sendAdminJson(res, detail);
  }

  @Post("study/test-runs")
  async createStudyTestRun(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!this.authorize(req, res)) return;
    const startsAt = body?.startsAt ? new Date(body.startsAt).toISOString() : new Date().toISOString();
    const endsAt = body?.endsAt ? new Date(body.endsAt).toISOString() : null;
    const run = await this.adminService.createStudyTestRun({
      name: String(body?.name || "Untitled study").trim(),
      startsAt,
      endsAt,
      includeAllRealUsers: body?.includeAllRealUsers === "on" || body?.includeAllRealUsers === true,
      notes: String(body?.notes || "").trim() || null,
    });
    this.completeAdminAction(
      req,
      res,
      `/api/admin/stats/study?testRunId=${encodeURIComponent(run.id)}`,
      run
    );
  }

  @Post("study/test-runs/:id/activate")
  async activateStudyTestRun(@Req() req: Request, @Res() res: Response, @Param("id") id: string) {
    if (!this.authorize(req, res)) return;
    const run = await this.adminService.setStudyTestRunStatus(id, "active");
    this.completeAdminAction(
      req,
      res,
      `/api/admin/stats/study?testRunId=${encodeURIComponent(id)}`,
      run ?? { id, status: "active" }
    );
  }

  @Post("study/test-runs/:id/pause")
  async pauseStudyTestRun(@Req() req: Request, @Res() res: Response, @Param("id") id: string) {
    if (!this.authorize(req, res)) return;
    const run = await this.adminService.setStudyTestRunStatus(id, "paused");
    this.completeAdminAction(
      req,
      res,
      `/api/admin/stats/study?testRunId=${encodeURIComponent(id)}`,
      run ?? { id, status: "paused" }
    );
  }

  @Post("study/test-runs/:id/complete")
  async completeStudyTestRun(@Req() req: Request, @Res() res: Response, @Param("id") id: string) {
    if (!this.authorize(req, res)) return;
    const run = await this.adminService.setStudyTestRunStatus(id, "completed");
    this.completeAdminAction(
      req,
      res,
      `/api/admin/stats/study?testRunId=${encodeURIComponent(id)}`,
      run ?? { id, status: "completed" }
    );
  }

  @Post("study/test-runs/:id/update")
  async updateStudyTestRun(
    @Req() req: Request,
    @Res() res: Response,
    @Param("id") id: string,
    @Body() body: any
  ) {
    if (!this.authorize(req, res)) return;
    const run = await this.adminService.updateStudyTestRun(id, {
      name: body?.name ? String(body.name).trim() : undefined,
      description: body?.description ? String(body.description).trim() : null,
      startsAt: body?.startsAt ? new Date(body.startsAt).toISOString() : undefined,
      endsAt: body?.endsAt ? new Date(body.endsAt).toISOString() : null,
      includeAllRealUsers:
        body?.includeAllRealUsers === undefined
          ? undefined
          : body.includeAllRealUsers === "on" || body.includeAllRealUsers === true,
      includeDummyUsersAsActors:
        body?.includeDummyUsersAsActors === undefined
          ? undefined
          : body.includeDummyUsersAsActors === "on" || body.includeDummyUsersAsActors === true,
      notes: body?.notes ? String(body.notes).trim() : null,
    });
    this.completeAdminAction(
      req,
      res,
      `/api/admin/stats/study?testRunId=${encodeURIComponent(id)}`,
      run ?? { id }
    );
  }

  @Get("overview")
  async overview(
    @Req() req: Request,
    @Res() res: Response,
    @Query("timeframe") timeframe?: string,
    @Query("country") country?: string,
    @Query("refresh") refresh?: string
  ) {
    if (!this.authorize(req, res)) return;
    const bypassCache = refresh === "1" || refresh === "true";
    const overview = await this.adminService.getOverview(
      { timeframe, country },
      { bypassCache }
    );
    const timeframeButtons = (Object.entries(OVERVIEW_TIMEFRAME_LABELS) as [
      OverviewTimeframe,
      string,
    ][])
      .map(([value, label]) => {
        const href = `/api/admin/stats/overview${buildAdminQuery({
          timeframe: value,
          country: overview.selectedCountry,
        })}`;
        return `<a href="${escapeHtml(href)}" class="button${
          overview.selectedTimeframe === value ? " primary" : ""
        }">${escapeHtml(label)}</a>`;
      })
      .join("");
    const countryOptions = [
      renderOption("all", "All countries", overview.selectedCountry),
      ...overview.availableCountries.map((row) =>
        renderOption(row.country, `${row.country} (${row.profile_count})`, overview.selectedCountry)
      ),
    ].join("");

    const thresholdRows = overview.thresholds
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.bucket)}</td><td>${escapeHtml(row.count)}</td></tr>`
      )
      .join("");
    const batchRows = overview.batches
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.dummy_batch_key)}</td><td>${escapeHtml(
            row.generation_version
          )}</td><td>${escapeHtml(row.profile_count)}</td></tr>`
      )
      .join("");
    const genderRows = overview.genderDistribution
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.gender_identity || "—")}</td><td>${escapeHtml(
            row.dummy_batch_key
          )}</td><td>${escapeHtml(row.generation_version)}</td><td>${escapeHtml(
            row.profile_count
          )}</td></tr>`
      )
      .join("");
    const realUserGenderRows = overview.realUserGenderDistribution
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.gender_identity || "Unknown")}</td><td>${escapeHtml(
            row.profile_count
          )}</td></tr>`
      )
      .join("");
    const realUserCountryRows = overview.realUserCountryDistribution
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.country || "Unknown")}</td><td>${escapeHtml(
            row.profile_count
          )}</td></tr>`
      )
      .join("");
    const interactedUserRows = overview.interactedUsers
      .map(
        (row) => `<tr>
          <td>${escapeHtml(row.profile_id)}</td>
          <td>${escapeHtml(row.display_name)}</td>
          <td>${escapeHtml(row.country || "Unknown")}</td>
          <td>${escapeHtml(row.likes_count)}</td>
          <td>${escapeHtml(row.passes_count)}</td>
          <td>${escapeHtml(row.total_decisions)}</td>
          <td>${escapeHtml(toIso(row.last_interaction_at))}</td>
        </tr>`
      )
      .join("");
    const architectureCards = overview.architectureSections
      .map(
        (section) => `
          <div class="card" style="box-shadow:none;">
            <div class="label">${escapeHtml(section.title)}</div>
            <div class="muted" style="margin-top:8px;line-height:1.55;">${escapeHtml(
              section.body
            )}</div>
          </div>
        `
      )
      .join("");
    const architectureFlowRows = overview.architectureFlow
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    const funnelCards = [
      {
        label: "Signed up",
        value: overview.funnel.signedUp.count,
        fromPrevious: overview.funnel.signedUp.pctFromPrevious,
        fromSignedUp: overview.funnel.signedUp.pctFromSignedUp,
      },
      {
        label: "Onboarded",
        value: overview.funnel.onboarded.count,
        fromPrevious: overview.funnel.onboarded.pctFromPrevious,
        fromSignedUp: overview.funnel.onboarded.pctFromSignedUp,
      },
      {
        label: "Activated",
        value: overview.funnel.activated.count,
        fromPrevious: overview.funnel.activated.pctFromPrevious,
        fromSignedUp: overview.funnel.activated.pctFromSignedUp,
      },
      {
        label: "Reached threshold",
        value: overview.funnel.reachedThreshold.count,
        fromPrevious: overview.funnel.reachedThreshold.pctFromPrevious,
        fromSignedUp: overview.funnel.reachedThreshold.pctFromSignedUp,
      },
    ]
      .map(
        (stage) => `
          <div class="card">
            <div class="label">${escapeHtml(stage.label)}</div>
            <div class="value">${escapeHtml(stage.value)}</div>
            <div class="muted">From previous: ${escapeHtml(stage.fromPrevious)}</div>
            <div class="muted">From signed up: ${escapeHtml(stage.fromSignedUp)}</div>
          </div>
        `
      )
      .join("");

    res.send(
      this.renderPage(
        "Admin Overview",
        `
          <h1>Matcha Admin</h1>
          <div class="actions">
            <button class="button primary" onclick="const u=new URL(window.location.href);u.searchParams.set('refresh','1');window.location.href=u.toString()">Refresh</button>
            <a class="button" href="/api/admin/stats/overview${buildAdminQuery({
              timeframe: "1m",
              country: "all",
            })}">Reset filters</a>
          </div>
          <div class="card" style="margin-bottom:16px;">
            <h2>Overview Filters</h2>
            <form method="get" style="margin-bottom:0;">
              <input type="hidden" name="timeframe" value="${escapeHtml(overview.selectedTimeframe)}" />
              <div style="display:grid;grid-template-columns:minmax(220px,360px) auto;gap:12px;align-items:end;">
                <div>
                  <div class="label" style="margin-bottom:6px;">Country</div>
                  <select name="country" style="padding:10px 12px;border-radius:10px;border:1px solid #ccd5ce;width:100%;">
                    ${countryOptions}
                  </select>
                </div>
                <div class="actions" style="margin:0;">
                  <button type="submit" class="button primary">Apply country</button>
                </div>
              </div>
            </form>
            <div class="label" style="margin:16px 0 8px;">Timeframe</div>
            <div class="actions" style="flex-wrap:wrap;margin-bottom:0;">${timeframeButtons}</div>
          </div>
          <div class="meta">Current filters: ${escapeHtml(
            overview.selectedCountry === "all" ? "All countries" : overview.selectedCountry
          )} · ${escapeHtml(OVERVIEW_TIMEFRAME_LABELS[overview.selectedTimeframe])}</div>
          <div class="meta">Latest matching decision activity: ${escapeHtml(
            toIso(overview.counts.latest_decision_event_at)
          )} · Latest filtered projection rebuild: ${escapeHtml(
            toIso(overview.counts.latest_projection_rebuild_at)
          )}</div>
          <div class="grid">
            <div class="card"><div class="label">Real users</div><div class="value">${escapeHtml(overview.counts.real_users)}</div></div>
            <div class="card"><div class="label">Dummy profiles</div><div class="value">${escapeHtml(overview.counts.dummy_profiles)}</div></div>
            <div class="card"><div class="label">Active interacting users</div><div class="value">${escapeHtml(overview.counts.active_interacting_users)}</div><div class="muted">${escapeHtml(OVERVIEW_TIMEFRAME_LABELS[overview.selectedTimeframe])}</div></div>
            <div class="card"><div class="label">Total likes</div><div class="value">${escapeHtml(overview.counts.total_likes)}</div><div class="muted">${escapeHtml(OVERVIEW_TIMEFRAME_LABELS[overview.selectedTimeframe])}</div></div>
            <div class="card"><div class="label">Total passes</div><div class="value">${escapeHtml(overview.counts.total_passes)}</div><div class="muted">${escapeHtml(OVERVIEW_TIMEFRAME_LABELS[overview.selectedTimeframe])}</div></div>
            <div class="card"><div class="label">Users not activated</div><div class="value">${escapeHtml(overview.counts.users_not_activated)}</div></div>
            <div class="card"><div class="label">Users activated</div><div class="value">${escapeHtml(overview.counts.users_activated)}</div></div>
            <div class="card"><div class="label">Total decisions</div><div class="value">${escapeHtml(overview.counts.total_decisions)}</div><div class="muted">${escapeHtml(OVERVIEW_TIMEFRAME_LABELS[overview.selectedTimeframe])}</div></div>
            <div class="card"><div class="label">Active dummy batch</div><div class="value">${escapeHtml(overview.activeBatch?.dummy_batch_key || "—")}</div><div class="muted">Generation ${escapeHtml(overview.activeBatch?.generation_version ?? "—")} · global</div></div>
          </div>
          <div class="card" style="margin-bottom:16px;">
            <h2>Activation Funnel</h2>
            <div class="muted" style="margin-bottom:12px;">Signed up uses account creation time. Onboarded uses onboarding completion time. Activated currently uses onboarding completion time as a documented fallback until a canonical activation timestamp is stored. Reached threshold uses the threshold projection timestamp.</div>
            <div class="grid">${funnelCards}</div>
            <div class="muted">Activation timestamp source: ${escapeHtml(
              overview.funnel.activationTimestampSource
            )}</div>
          </div>
          <div class="card" style="margin-bottom: 16px;">
            <h2>Threshold Distribution</h2>
            <table>
              <thead><tr><th>Bucket</th><th>Profiles</th></tr></thead>
              <tbody>${thresholdRows || '<tr><td colspan="2" class="muted">No rows</td></tr>'}</tbody>
            </table>
          </div>
          <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
            <div class="card">
              <h2>Real User Gender Distribution</h2>
              <table>
                <thead><tr><th>Gender</th><th>Profiles</th></tr></thead>
                <tbody>${realUserGenderRows || '<tr><td colspan="2" class="muted">No real-user gender rows</td></tr>'}</tbody>
              </table>
            </div>
            <div class="card">
              <h2>Real User Country Distribution</h2>
              <table>
                <thead><tr><th>Country</th><th>Profiles</th></tr></thead>
                <tbody>${realUserCountryRows || '<tr><td colspan="2" class="muted">No real-user country rows</td></tr>'}</tbody>
              </table>
            </div>
          </div>
          <div class="card" style="margin-bottom: 16px;">
            <h2>Users Interacting With Discovery Queues</h2>
            <div class="muted" style="margin-bottom:12px;">Real-user actors with at least one like/pass event in ${escapeHtml(
              OVERVIEW_TIMEFRAME_LABELS[overview.selectedTimeframe]
            )}.</div>
            <table>
              <thead><tr><th>Profile ID</th><th>Display name</th><th>Country</th><th>Likes</th><th>Passes</th><th>Total decisions</th><th>Last interaction</th></tr></thead>
              <tbody>${interactedUserRows || '<tr><td colspan="7" class="muted">No interacting users in this timeframe</td></tr>'}</tbody>
            </table>
          </div>
          <div class="card">
            <h2>Dummy Batches</h2>
            <table>
              <thead><tr><th>Batch</th><th>Generation</th><th>Profiles</th></tr></thead>
              <tbody>${batchRows || '<tr><td colspan="3" class="muted">No dummy batches</td></tr>'}</tbody>
            </table>
          </div>
          <div class="card" style="margin-top: 16px;">
            <h2>Active Batch Gender Distribution</h2>
            <table>
              <thead><tr><th>Gender</th><th>Batch</th><th>Generation</th><th>Profiles</th></tr></thead>
              <tbody>${genderRows || '<tr><td colspan="4" class="muted">No active batch distribution</td></tr>'}</tbody>
            </table>
          </div>
          <div class="card" style="margin-top:16px;">
            <h2>Database Architecture</h2>
            <div class="muted" style="margin-bottom:12px;">Operational summary of how source tables and projections relate across the backend.</div>
            <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">${architectureCards}</div>
            <div class="card" style="box-shadow:none;margin-top:12px;">
              <div class="label">Source to projection flow</div>
              <ul style="margin:10px 0 0 18px;padding:0;color:#475569;line-height:1.6;">
                ${architectureFlowRows}
              </ul>
            </div>
          </div>
        `,
        { autoRefreshMs: 15000 }
      )
    );
  }

  @Get("overview.json")
  async overviewJson(
    @Req() req: Request,
    @Res() res: Response,
    @Query("timeframe") timeframe?: string,
    @Query("country") country?: string,
    @Query("refresh") refresh?: string
  ) {
    if (!this.authorize(req, res)) return;
    const bypassCache = refresh === "1" || refresh === "true";
    const overview = await this.adminService.getOverview(
      { timeframe, country },
      { bypassCache }
    );

    this.sendAdminJson(res, overview);
  }

  @Get("users")
  async users(
    @Req() req: Request,
    @Res() res: Response,
    @Query("q") q?: string,
    @Query("kind") kind?: string,
    @Query("activation") activation?: string,
    @Query("threshold") threshold?: string,
    @Query("genderIdentity") genderIdentity?: string,
    @Query("syntheticGroup") syntheticGroup?: string,
    @Query("dummyBatchKey") dummyBatchKey?: string,
    @Query("generationVersion") generationVersion?: string,
    @Query("refresh") refresh?: string
  ) {
    if (!this.authorize(req, res)) return;
    const filters = this.normalizeUsersFilters({
      q,
      kind,
      activation,
      threshold,
      genderIdentity,
      syntheticGroup,
      dummyBatchKey,
      generationVersion,
    });
    const bypassCache = refresh === "1" || refresh === "true";
    const [users, filterOptions] = await Promise.all([
      this.adminService.getUsers(filters, { bypassCache }),
      this.adminService.getUserFilterOptions({ bypassCache }),
    ]);

    const genderOptions = [
      renderOption("", "All genders", filters.genderIdentity),
      ...filterOptions.genderIdentities.map((value) =>
        renderOption(value, value, filters.genderIdentity)
      ),
    ].join("");
    const syntheticGroupOptions = [
      renderOption("", "All synthetic groups", filters.syntheticGroup),
      ...filterOptions.syntheticGroups.map((value) =>
        renderOption(value, value, filters.syntheticGroup)
      ),
    ].join("");
    const dummyBatchOptions = [
      renderOption("", "All dummy batches", filters.dummyBatchKey),
      ...filterOptions.dummyBatchKeys.map((value) =>
        renderOption(value, value, filters.dummyBatchKey)
      ),
    ].join("");
    const generationOptions = [
      renderOption("", "All generations", filters.generationVersion),
      ...filterOptions.generationVersions.map((value) =>
        renderOption(String(value), String(value), filters.generationVersion)
      ),
    ].join("");

    const rows = users
      .map((row) => {
        const href = row.user_id ? `/api/admin/stats/users/${row.user_id}` : `/api/admin/stats/users/profile-${row.profile_id}`;
        return `<tr>
          <td><a href="${escapeHtml(href)}">${escapeHtml(row.display_name || row.public_id)}</a><div class="muted">${escapeHtml(row.public_id)}</div></td>
          <td><span class="pill">${escapeHtml(row.kind)}</span></td>
          <td>${escapeHtml(row.gender_identity || "—")}<div class="muted">${escapeHtml(row.synthetic_group || "—")}</div></td>
          <td>${escapeHtml(row.country || "Unknown")}</td>
          <td>${escapeHtml(row.total_likes ?? 0)}</td>
          <td>${escapeHtml(row.total_passes ?? 0)}</td>
          <td>${row.is_activated ? "yes" : "no"}</td>
          <td>${row.threshold_plus_30 ? "yes" : "no"}</td>
          <td>${escapeHtml(row.dummy_batch_key || "—")}</td>
          <td>${escapeHtml(row.generation_version ?? "—")}</td>
          <td>${escapeHtml(toIso(row.last_decision_at))}</td>
          <td>${escapeHtml(toIso(row.last_recomputed_at))}</td>
        </tr>`;
      })
      .join("");

    res.send(
      this.renderPage(
        "Admin Users",
        `
          <h1>Users</h1>
          <div class="actions">
            <button class="button" onclick="const u=new URL(window.location.href);u.searchParams.set('refresh','1');window.location.href=u.toString()">Refresh</button>
          </div>
          <form method="get">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
              <input type="search" name="q" value="${escapeHtml(filters.q || "")}" placeholder="Search name, public id, batch" />
              <select name="kind" style="padding:10px 12px;border-radius:10px;border:1px solid #ccd5ce;">
                <option value="all"${filters.kind === "all" ? " selected" : ""}>All kinds</option>
                <option value="user"${filters.kind === "user" ? " selected" : ""}>Real users</option>
                <option value="dummy"${filters.kind === "dummy" ? " selected" : ""}>Dummy users</option>
              </select>
              <select name="activation" style="padding:10px 12px;border-radius:10px;border:1px solid #ccd5ce;">
                <option value="all"${filters.activation === "all" ? " selected" : ""}>All activation states</option>
                <option value="activated"${filters.activation === "activated" ? " selected" : ""}>Activated</option>
                <option value="not_activated"${filters.activation === "not_activated" ? " selected" : ""}>Not activated</option>
              </select>
              <select name="genderIdentity" style="padding:10px 12px;border-radius:10px;border:1px solid #ccd5ce;">
                ${genderOptions}
              </select>
              <select name="syntheticGroup" style="padding:10px 12px;border-radius:10px;border:1px solid #ccd5ce;">
                ${syntheticGroupOptions}
              </select>
              <select name="dummyBatchKey" style="padding:10px 12px;border-radius:10px;border:1px solid #ccd5ce;">
                ${dummyBatchOptions}
              </select>
              <select name="generationVersion" style="padding:10px 12px;border-radius:10px;border:1px solid #ccd5ce;">
                ${generationOptions}
              </select>
            </div>
            <div style="display:flex;gap:12px;margin-top:12px;">
              <button type="submit" style="padding:10px 14px;border-radius:10px;border:1px solid #0e7a4a;background:#0e7a4a;color:#fff;cursor:pointer;">Apply filters</button>
              <a href="/api/admin/stats/users" style="padding:10px 14px;border-radius:10px;border:1px solid #ccd5ce;background:#fff;color:#1d241f;">Clear</a>
            </div>
          </form>
          <table>
            <thead>
              <tr>
                <th>Profile</th>
                <th>Kind</th>
                <th>Gender</th>
                <th>Country</th>
                <th>Likes</th>
                <th>Passes</th>
                <th>Activated</th>
                <th>Threshold +30</th>
                <th>Dummy batch</th>
                <th>Generation</th>
                <th>Last decision</th>
                <th>Last rebuild</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="12" class="muted">No users found</td></tr>'}</tbody>
          </table>
        `
      )
    );
  }

  @Get("users.json")
  async usersJson(
    @Req() req: Request,
    @Res() res: Response,
    @Query("q") q?: string,
    @Query("kind") kind?: string,
    @Query("activation") activation?: string,
    @Query("threshold") threshold?: string,
    @Query("genderIdentity") genderIdentity?: string,
    @Query("syntheticGroup") syntheticGroup?: string,
    @Query("dummyBatchKey") dummyBatchKey?: string,
    @Query("generationVersion") generationVersion?: string,
    @Query("refresh") refresh?: string
  ) {
    if (!this.authorize(req, res)) return;
    const filters = this.normalizeUsersFilters({
      q,
      kind,
      activation,
      threshold,
      genderIdentity,
      syntheticGroup,
      dummyBatchKey,
      generationVersion,
    });
    const bypassCache = refresh === "1" || refresh === "true";
    const [users, filterOptions] = await Promise.all([
      this.adminService.getUsers(filters, { bypassCache }),
      this.adminService.getUserFilterOptions({ bypassCache }),
    ]);

    this.sendAdminJson(res, {
      filters,
      filterOptions,
      users,
    });
  }

  @Get("users/:identifier")
  async userDetail(
    @Req() req: Request,
    @Res() res: Response,
    @Param("identifier") identifier: string
  ) {
    if (!this.authorize(req, res)) return;
    const detail = await this.adminService.getUserDetail(identifier);
    if (!detail) {
      res.status(404).send("Not found");
      return;
    }

    const modeRows = detail.modes
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.category_code)}</td><td>${escapeHtml(
            row.current_value_key || "—"
          )}</td><td>${escapeHtml(row.current_count)}</td><td>${escapeHtml(
            row.total_likes_considered
          )}</td></tr>`
      )
      .join("");
    const targetRows = detail.targets
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.category_code)}</td><td>${escapeHtml(
            row.current_value_key || "—"
          )}</td><td>${escapeHtml(row.derived_mode_value_key || "—")}</td><td>${escapeHtml(
            row.target_value_key || "—"
          )}</td><td>${escapeHtml(row.derivation_status)}</td></tr>`
      )
      .join("");
    const progressRows = detail.progress
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.category_code)}</td><td>${escapeHtml(
            row.completion_percent
          )}%</td><td>${escapeHtml(row.progress_state)}</td><td>${escapeHtml(
            row.distance_raw
          )}</td></tr>`
      )
      .join("");
    const taskRows = detail.tasks
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.category_code)}</td><td>${escapeHtml(
            row.active_tasks
          )}</td><td>${escapeHtml(row.completed_tasks)}</td></tr>`
      )
      .join("");
    const decisionRows = detail.recentDecisions
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(
            row.interaction_type
          )}</td><td>${escapeHtml(row.target_profile_public_id)}</td><td>${escapeHtml(
            toIso(row.created_at)
          )}</td></tr>`
      )
      .join("");

    res.send(
      this.renderPage(
        `Admin User ${detail.profile.display_name}`,
        `
          <h1>${escapeHtml(detail.profile.display_name || detail.profile.public_id)}</h1>
          <div class="actions">
            <button class="button primary" onclick="const u=new URL(window.location.href);u.searchParams.set('refresh','1');window.location.href=u.toString()">Refresh</button>
            <a class="button" href="/api/admin/stats/users">Back to users</a>
          </div>
          <div class="meta">Last decision event: ${escapeHtml(
            toIso(detail.profile.last_decision_event_at)
          )} · Last projection rebuild: ${escapeHtml(
            toIso(detail.profile.last_recomputed_at)
          )} · Rebuild status: ${escapeHtml(detail.profile.rebuild_status || "—")}</div>
          <div class="grid">
            <div class="card"><div class="label">Kind</div><div class="value">${escapeHtml(detail.profile.kind)}</div></div>
            <div class="card"><div class="label">Likes / Passes</div><div class="value">${escapeHtml(detail.profile.total_likes ?? 0)} / ${escapeHtml(detail.profile.total_passes ?? 0)}</div></div>
            <div class="card"><div class="label">Threshold</div><div class="value">${detail.profile.threshold_reached ? "Reached" : `Pending (${escapeHtml(detail.profile.likes_until_unlock ?? "—")} left)`}</div><div class="muted">${escapeHtml(toIso(detail.profile.threshold_reached_at))}</div></div>
            <div class="card"><div class="label">Dummy batch</div><div class="value">${escapeHtml(detail.profile.dummy_batch_key || "—")}</div><div class="muted">Generation ${escapeHtml(detail.profile.generation_version ?? "—")}</div></div>
            <div class="card"><div class="label">Identity</div><div class="value">${escapeHtml(detail.profile.gender_identity || "—")}</div><div class="muted">${escapeHtml(detail.profile.synthetic_group || "—")} / ${escapeHtml(detail.profile.synthetic_variant || "—")}</div></div>
            <div class="card"><div class="label">Unlock emitted</div><div class="value">${escapeHtml(toIso(detail.profile.goals_unlock_event_emitted_at))}</div></div>
            <div class="card"><div class="label">Unlock seen</div><div class="value">${escapeHtml(toIso(detail.profile.goals_unlock_message_seen_at))}</div></div>
          </div>
          <div class="card" style="margin-bottom: 16px;">
            <div class="label">Projection meta</div>
            <p class="muted">Last rebuild: ${escapeHtml(toIso(detail.profile.last_recomputed_at))}<br/>Last source event: ${escapeHtml(detail.profile.last_source_event_id ?? "—")}<br/>Last decision interaction: ${escapeHtml(detail.profile.last_decision_interaction_id ?? "—")}<br/>Rebuild status: ${escapeHtml(detail.profile.rebuild_status || "—")}</p>
          </div>
          <div class="card" style="margin-bottom: 16px;">
            <h2>Recent decisions</h2>
            <table><thead><tr><th>ID</th><th>Type</th><th>Target</th><th>Created</th></tr></thead><tbody>${decisionRows || '<tr><td colspan="4" class="muted">No recent decisions</td></tr>'}</tbody></table>
          </div>
          <div class="card" style="margin-bottom: 16px;">
            <h2>Modes</h2>
            <table><thead><tr><th>Category</th><th>Mode</th><th>Count</th><th>Total likes</th></tr></thead><tbody>${modeRows || '<tr><td colspan="4" class="muted">No modes</td></tr>'}</tbody></table>
          </div>
          <div class="card" style="margin-bottom: 16px;">
            <h2>Targets</h2>
            <table><thead><tr><th>Category</th><th>Current</th><th>Mode</th><th>Target</th><th>Status</th></tr></thead><tbody>${targetRows || '<tr><td colspan="5" class="muted">No targets</td></tr>'}</tbody></table>
          </div>
          <div class="card" style="margin-bottom: 16px;">
            <h2>Progress</h2>
            <table><thead><tr><th>Category</th><th>Completion</th><th>State</th><th>Distance</th></tr></thead><tbody>${progressRows || '<tr><td colspan="4" class="muted">No progress rows</td></tr>'}</tbody></table>
          </div>
          <div class="card">
            <h2>Active task summary</h2>
            <table><thead><tr><th>Category</th><th>Active tasks</th><th>Completed active tasks</th></tr></thead><tbody>${taskRows || '<tr><td colspan="3" class="muted">No task rows</td></tr>'}</tbody></table>
          </div>
        `,
        { autoRefreshMs: 10000 }
      )
    );
  }

  @Get("database")
  async database(@Req() req: Request, @Res() res: Response) {
    if (!this.authorize(req, res)) return;

    const bypassCache = req.query.refresh === "1" || req.query.refresh === "true";
    const view = await this.adminService.getDatabaseView({ bypassCache });
    const graphSize =
      req.query.graphSize === "wide" || req.query.graphSize === "current"
        ? (req.query.graphSize as DatabaseGraphSize)
        : "current";
    const selectedMetrics =
      typeof req.query.metrics === "string" && req.query.metrics.trim()
        ? req.query.metrics.trim()
        : "all";
    const graphSvg = this.renderDatabaseGraph(
      view.graph.nodes,
      view.graph.edges,
      graphSize,
      view.tableDetails
    );
    const metricOptions = [
      { id: "all", label: "All panels" },
      ...view.metricGroups.map((group) => ({
        id: toMetricGroupId(group.title),
        label: group.title,
      })),
    ];
    const visibleMetricGroups =
      selectedMetrics === "all"
        ? view.metricGroups
        : view.metricGroups.filter((group) => toMetricGroupId(group.title) === selectedMetrics);
    const warningBanner =
      view.schemaStatus.missingRequiredRelations.length ||
      view.schemaStatus.missingRequiredColumns.length ||
      view.schemaStatus.warnings.length
        ? `
          <div class="card" style="margin-bottom:16px;border-color:#f59e0b;background:#fff8e8;">
            <h2 style="margin-bottom:8px;">Schema Mismatch Warning</h2>
            <div class="muted">
              This environment has schema drift or partial admin DB support. The page is rendered in degraded read-only mode.
            </div>
            ${
              view.schemaStatus.missingRequiredRelations.length
                ? `<p><strong>Missing relations:</strong> ${escapeHtml(
                    view.schemaStatus.missingRequiredRelations.join(", ")
                  )}</p>`
                : ""
            }
            ${
              view.schemaStatus.missingRequiredColumns.length
                ? `<p><strong>Missing columns:</strong> ${escapeHtml(
                    view.schemaStatus.missingRequiredColumns.join(", ")
                  )}</p>`
                : ""
            }
            ${
              view.schemaStatus.warnings.length
                ? `<ul style="margin:8px 0 0 18px;padding:0;">${view.schemaStatus.warnings
                    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
                    .join("")}</ul>`
                : ""
            }
          </div>
        `
        : "";

    const metricSections = visibleMetricGroups
      .map(
        (group) => `
          <div class="card" style="margin-bottom:16px;">
            <h2>${escapeHtml(group.title)}</h2>
            <div class="grid" style="margin-bottom:0;">
              ${group.metrics
                .map(
                  (metric) => `
                    <div class="card" style="box-shadow:none;">
                      <div class="label">${escapeHtml(metric.label)}</div>
                      <div class="value" style="font-size:22px;">${escapeHtml(metric.value)}</div>
                      ${
                        metric.detail
                          ? `<div class="muted" style="margin-top:6px;">${escapeHtml(
                              metric.detail
                            )}</div>`
                          : ""
                      }
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        `
      )
      .join("");

    const tableStatRows = view.tableStats
      .map(
        (stat) => `
          <tr>
            <td>${escapeHtml(`${stat.schema}.${stat.table}`)}</td>
            <td>${escapeHtml(stat.role)}</td>
            <td>${stat.present ? "yes" : "no"}</td>
            <td>${escapeHtml(stat.present ? stat.rowCount ?? 0 : "—")}</td>
            <td>${escapeHtml(stat.freshness ? toIso(stat.freshness) : "—")}</td>
          </tr>
        `
      )
      .join("");

    res.send(
      this.renderPage(
        "Admin Database",
        `
          <h1>Database</h1>
          <div class="actions">
            <button class="button primary" onclick="const u=new URL(window.location.href);u.searchParams.set('refresh','1');window.location.href=u.toString()">Refresh</button>
          </div>
          <div class="meta">Live DB-backed internal view of approved source/projection architecture. Each refresh reads current relation presence, current row counts, and current freshness directly from the database.</div>
          ${warningBanner}
          <div class="card" style="margin-bottom:16px;">
            <h2>Legend</h2>
            <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:#475569;">
              <span class="pill" style="border:1px solid #0e7a4a;background:#eefbf3;">Source table</span>
              <span class="pill" style="border:1px dashed #7c3aed;background:#f5f1ff;">Projection table</span>
              <span class="pill" style="border:1px solid #64748b;background:#f7f8fa;">Ops table</span>
              <span class="pill" style="border:1px solid #2563eb;background:#eff6ff;">FK edge = database-enforced relationship</span>
              <span class="pill" style="border:1px solid #a855f7;background:#faf5ff;">Flow edge = architectural projection/data flow</span>
            </div>
          </div>
          <div class="card flush ${graphSize === "wide" ? "full-bleed-card" : ""}">
            <div class="card-header" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;align-items:flex-start;">
              <div>
                <h2>Schema Visualizer</h2>
                <div class="muted">Approved source/projection graph with distinct FK and flow edges.</div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                <a class="button ${graphSize === "current" ? "primary" : ""}" href="/api/admin/stats/database${buildAdminQuery({
                  graphSize: "current",
                  metrics: selectedMetrics,
                })}">Current width</a>
                <a class="button ${graphSize === "wide" ? "primary" : ""}" href="/api/admin/stats/database${buildAdminQuery({
                  graphSize: "wide",
                  metrics: selectedMetrics,
                })}">Bigger width</a>
              </div>
            </div>
            <div class="graph-shell">
              ${graphSvg}
            </div>
          </div>
          <div class="card" style="margin-top:16px;">
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;">
              <div>
                <h2>Monitoring Panels</h2>
                <div class="muted">Toggle DB-backed monitoring sections without shrinking the graph.</div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${metricOptions
                  .map(
                    (option) => `
                      <a class="button ${selectedMetrics === option.id ? "primary" : ""}" href="/api/admin/stats/database${buildAdminQuery({
                        graphSize,
                        metrics: option.id,
                      })}">${escapeHtml(option.label)}</a>
                    `
                  )
                  .join("")}
              </div>
            </div>
            ${metricSections || '<div class="muted">No monitoring section matches the selected toggle.</div>'}
          </div>
          <div class="card" style="margin-top:16px;">
            <h2>Approved Table Stats</h2>
            <table>
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Role</th>
                  <th>Present</th>
                  <th>Exact rows</th>
                  <th>Latest freshness</th>
                </tr>
              </thead>
              <tbody>${tableStatRows}</tbody>
            </table>
          </div>
          <dialog id="db-table-detail-modal" style="width:min(860px,calc(100vw - 32px));border:none;border-radius:18px;padding:0;box-shadow:0 24px 64px rgba(15,23,42,0.24);">
            <div style="padding:18px 18px 14px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
              <div>
                <h2 id="db-table-detail-title" style="margin-bottom:6px;">Table details</h2>
                <div id="db-table-detail-subtitle" class="muted"></div>
              </div>
              <button class="button" onclick="window.closeDbTableDetail()">Close</button>
            </div>
            <div style="padding:18px;">
              <div id="db-table-detail-description" class="muted" style="margin-bottom:14px;"></div>
              <table>
                <thead>
                  <tr>
                    <th>Attribute</th>
                    <th>Data type</th>
                    <th>Nullable</th>
                    <th>Primary key</th>
                    <th>Foreign key</th>
                  </tr>
                </thead>
                <tbody id="db-table-detail-rows">
                  <tr><td colspan="5" class="muted">Select a table card to inspect its schema details.</td></tr>
                </tbody>
              </table>
            </div>
          </dialog>
          <script>
            window.openDbTableDetail = function(encodedPayload) {
              var dialog = document.getElementById('db-table-detail-modal');
              if (!dialog) return;
              var payload = JSON.parse(decodeURIComponent(encodedPayload));
              document.getElementById('db-table-detail-title').textContent = payload.label;
              document.getElementById('db-table-detail-subtitle').textContent =
                payload.schema + '.' + payload.table + ' · ' + payload.role;
              document.getElementById('db-table-detail-description').textContent =
                payload.description + (payload.present ? '' : ' This relation is missing in the current environment.');
              var rows = document.getElementById('db-table-detail-rows');
              if (!rows) return;
              if (!payload.present) {
                rows.innerHTML = '<tr><td colspan="5" class="muted">This approved relation is not present in the current environment.</td></tr>';
              } else if (!payload.columns || !payload.columns.length) {
                rows.innerHTML = '<tr><td colspan="5" class="muted">No column metadata available.</td></tr>';
              } else {
                rows.innerHTML = payload.columns.map(function(column) {
                  return '<tr>' +
                    '<td>' + String(column.name) + '</td>' +
                    '<td>' + String(column.dataType) + '</td>' +
                    '<td>' + (column.isNullable ? 'yes' : 'no') + '</td>' +
                    '<td>' + (column.isPrimaryKey ? 'yes' : 'no') + '</td>' +
                    '<td>' + (column.foreignKeyTarget || '—') + '</td>' +
                  '</tr>';
                }).join('');
              }
              dialog.showModal();
            };
            window.closeDbTableDetail = function() {
              var dialog = document.getElementById('db-table-detail-modal');
              if (dialog) dialog.close();
            };
            (function() {
              var dialog = document.getElementById('db-table-detail-modal');
              if (!dialog) return;
              dialog.addEventListener('click', function(event) {
                var rect = dialog.getBoundingClientRect();
                var inside = rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
                  rect.left <= event.clientX && event.clientX <= rect.left + rect.width;
                if (!inside) {
                  dialog.close();
                }
              });
            })();
          </script>
        `,
        { autoRefreshMs: 15000 }
      )
    );
  }

  @Get("database.json")
  async databaseJson(@Req() req: Request, @Res() res: Response) {
    if (!this.authorize(req, res)) return;

    const bypassCache = req.query.refresh === "1" || req.query.refresh === "true";
    const view = await this.adminService.getDatabaseView({ bypassCache });

    this.sendAdminJson(res, view);
  }

  @Get("api-docs")
  async apiDocs(@Req() req: Request, @Res() res: Response) {
    if (!this.authorize(req, res)) return;

    res.send(
      this.renderPage(
        "Admin API Docs",
        `
          <h1>API Docs</h1>
          <div class="meta">
            Internal Swagger UI and the public Scalar reference are both backed by the same generated OpenAPI document.
          </div>
          <div class="actions">
            <a class="button primary" href="/api/docs" target="_blank" rel="noreferrer">Open Swagger UI</a>
            <a class="button" href="/api/reference" target="_blank" rel="noreferrer">Open Scalar Reference</a>
            <a class="button" href="/api/openapi.json" target="_blank" rel="noreferrer">Open Raw OpenAPI</a>
          </div>
          <div class="card flush" style="min-height:78vh;">
            <div class="card-header">
              <h2>Embedded Swagger UI</h2>
              <div class="muted">If embedding is inconvenient in your browser, use the direct links above.</div>
            </div>
            <iframe
              src="/api/docs"
              title="Matcha Internal Swagger UI"
              style="width:100%; min-height:72vh; border:0; background:#fff;"
            ></iframe>
          </div>
        `
      )
    );
  }
}
