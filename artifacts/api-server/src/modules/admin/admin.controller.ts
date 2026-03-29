import { Controller, Get, Inject, Param, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { runtimeConfig } from "../../config/runtime";
import { AdminService } from "./admin.service";

type DatabaseGraphNode = Awaited<
  ReturnType<AdminService["getDatabaseView"]>
>["graph"]["nodes"][number];
type DatabaseGraphEdge = Awaited<
  ReturnType<AdminService["getDatabaseView"]>
>["graph"]["edges"][number];

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
    if (
      username !== runtimeConfig.admin.username ||
      password !== runtimeConfig.admin.password
    ) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Matcha Admin"');
      res.status(401).send("Unauthorized");
      return false;
    }

    return true;
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
      .nav { margin-bottom: 24px; display: flex; gap: 16px; font-size: 14px; }
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
      .meta { font-size: 13px; color: #65746a; margin-bottom: 16px; }
    </style>
  </head>
  <body>
    <main>
      <div class="nav">
        <a href="/api/admin/stats/overview">Overview</a>
        <a href="/api/admin/stats/users">Users</a>
        <a href="/api/admin/stats/database">Database</a>
      </div>
      ${body}
    </main>
    ${
      options?.autoRefreshMs
        ? `<script>window.setTimeout(function(){ window.location.reload(); }, ${options.autoRefreshMs});</script>`
        : ""
    }
  </body>
</html>`;
  }

  private renderDatabaseGraph(
    nodes: DatabaseGraphNode[],
    edges: DatabaseGraphEdge[]
  ) {
    const maxX = Math.max(...nodes.map((node) => node.x + node.width), 0) + 60;
    const maxY = Math.max(...nodes.map((node) => node.y + node.height), 0) + 60;
    const schemaBlocks = [
      { label: "auth", x: 20, width: 250 },
      { label: "core", x: 300, width: 250 },
      { label: "catalog", x: 580, width: 250 },
      { label: "discovery", x: 860, width: 250 },
      { label: "goals", x: 1140, width: 250 },
      { label: "media", x: 1420, width: 250 },
    ];
    const nodeByKey = new Map(nodes.map((node) => [node.key, node] as const));

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

        return `
          <g>
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
      <svg viewBox="0 0 ${maxX} ${maxY}" width="100%" height="920" role="img" aria-label="Database architecture graph">
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

  @Get("overview")
  async overview(@Req() req: Request, @Res() res: Response) {
    if (!this.authorize(req, res)) return;
    const overview = await this.adminService.getOverview();

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

    res.send(
      this.renderPage(
        "Admin Overview",
        `
          <h1>Matcha Admin</h1>
          <div class="actions">
            <button class="button primary" onclick="window.location.reload()">Refresh</button>
          </div>
          <div class="meta">Latest decision activity: ${escapeHtml(
            toIso(overview.counts.latest_decision_event_at)
          )} · Latest projection rebuild: ${escapeHtml(
            toIso(overview.counts.latest_projection_rebuild_at)
          )}</div>
          <div class="grid">
            <div class="card"><div class="label">Real users</div><div class="value">${escapeHtml(overview.counts.real_users)}</div></div>
            <div class="card"><div class="label">Dummy profiles</div><div class="value">${escapeHtml(overview.counts.dummy_profiles)}</div></div>
            <div class="card"><div class="label">Total likes</div><div class="value">${escapeHtml(overview.counts.total_likes)}</div></div>
            <div class="card"><div class="label">Total passes</div><div class="value">${escapeHtml(overview.counts.total_passes)}</div></div>
            <div class="card"><div class="label">Users below threshold</div><div class="value">${escapeHtml(overview.counts.users_below_threshold)}</div></div>
            <div class="card"><div class="label">Users above threshold</div><div class="value">${escapeHtml(overview.counts.users_above_threshold)}</div></div>
            <div class="card"><div class="label">Total decisions</div><div class="value">${escapeHtml(overview.counts.total_decisions)}</div></div>
            <div class="card"><div class="label">Active dummy batch</div><div class="value">${escapeHtml(overview.activeBatch?.dummy_batch_key || "—")}</div><div class="muted">Generation ${escapeHtml(overview.activeBatch?.generation_version ?? "—")}</div></div>
          </div>
          <div class="card" style="margin-bottom: 16px;">
            <h2>Threshold Distribution</h2>
            <table>
              <thead><tr><th>Bucket</th><th>Profiles</th></tr></thead>
              <tbody>${thresholdRows || '<tr><td colspan="2" class="muted">No rows</td></tr>'}</tbody>
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
        `,
        { autoRefreshMs: 15000 }
      )
    );
  }

  @Get("users")
  async users(
    @Req() req: Request,
    @Res() res: Response,
    @Query("q") q?: string,
    @Query("kind") kind?: string,
    @Query("threshold") threshold?: string,
    @Query("genderIdentity") genderIdentity?: string,
    @Query("syntheticGroup") syntheticGroup?: string,
    @Query("dummyBatchKey") dummyBatchKey?: string,
    @Query("generationVersion") generationVersion?: string
  ) {
    if (!this.authorize(req, res)) return;
    const normalizedGenerationVersion = Number(generationVersion);
    const filters = {
      q,
      kind: kind === "user" || kind === "dummy" ? kind : "all",
      threshold:
        threshold === "reached" || threshold === "pending" ? threshold : "all",
      genderIdentity: String(genderIdentity || "").trim(),
      syntheticGroup: String(syntheticGroup || "").trim(),
      dummyBatchKey: String(dummyBatchKey || "").trim(),
      generationVersion:
        Number.isFinite(normalizedGenerationVersion) && normalizedGenerationVersion > 0
          ? normalizedGenerationVersion
          : null,
    } as const;
    const [users, filterOptions] = await Promise.all([
      this.adminService.getUsers(filters),
      this.adminService.getUserFilterOptions(),
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
          <td>${escapeHtml(row.total_likes ?? 0)}</td>
          <td>${escapeHtml(row.total_passes ?? 0)}</td>
          <td>${row.threshold_reached ? "yes" : "no"}</td>
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
            <button class="button" onclick="window.location.reload()">Refresh</button>
          </div>
          <form method="get">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
              <input type="search" name="q" value="${escapeHtml(filters.q || "")}" placeholder="Search name, public id, batch" />
              <select name="kind" style="padding:10px 12px;border-radius:10px;border:1px solid #ccd5ce;">
                <option value="all"${filters.kind === "all" ? " selected" : ""}>All kinds</option>
                <option value="user"${filters.kind === "user" ? " selected" : ""}>Real users</option>
                <option value="dummy"${filters.kind === "dummy" ? " selected" : ""}>Dummy users</option>
              </select>
              <select name="threshold" style="padding:10px 12px;border-radius:10px;border:1px solid #ccd5ce;">
                <option value="all"${filters.threshold === "all" ? " selected" : ""}>All thresholds</option>
                <option value="reached"${filters.threshold === "reached" ? " selected" : ""}>Reached</option>
                <option value="pending"${filters.threshold === "pending" ? " selected" : ""}>Pending</option>
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
                <th>Likes</th>
                <th>Passes</th>
                <th>Threshold</th>
                <th>Dummy batch</th>
                <th>Generation</th>
                <th>Last decision</th>
                <th>Last rebuild</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="10" class="muted">No users found</td></tr>'}</tbody>
          </table>
        `
      )
    );
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
            <button class="button primary" onclick="window.location.reload()">Refresh</button>
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

    const view = await this.adminService.getDatabaseView();
    const graphSvg = this.renderDatabaseGraph(view.graph.nodes, view.graph.edges);
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

    const metricSections = view.metricGroups
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
            <button class="button primary" onclick="window.location.reload()">Refresh</button>
          </div>
          <div class="meta">Live DB-backed internal view of approved source/projection architecture.</div>
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
          <div style="display:grid;grid-template-columns:minmax(0,2fr) minmax(320px,1fr);gap:16px;align-items:start;">
            <div class="card">
              <h2>Schema Visualizer</h2>
              <div style="overflow:auto;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;">
                ${graphSvg}
              </div>
            </div>
            <div>
              ${metricSections}
            </div>
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
        `,
        { autoRefreshMs: 15000 }
      )
    );
  }
}
