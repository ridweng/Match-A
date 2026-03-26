import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function parseBoolean(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      return;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

export function loadDbEnv() {
  const repoRoot = findRepoRoot(process.cwd());
  const candidates = [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, "artifacts/api-server/.env"),
    path.join(process.cwd(), ".env"),
  ];

  candidates.forEach(loadEnvFile);
}

export function findRepoRoot(startDir: string) {
  let current = path.resolve(startDir);
  while (true) {
    const packageJson = path.join(current, "package.json");
    const workspaceFile = path.join(current, "pnpm-workspace.yaml");
    if (fs.existsSync(packageJson) && fs.existsSync(workspaceFile)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildConnectionString(input: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}) {
  const credentials = input.password
    ? `${encodeURIComponent(input.user)}:${encodeURIComponent(input.password)}`
    : encodeURIComponent(input.user);
  return `postgresql://${credentials}@${input.host}:${input.port}/${encodeURIComponent(
    input.database
  )}`;
}

export function getDatabaseConfig() {
  loadDbEnv();

  const host = process.env.DB_HOST || process.env.PGHOST || "127.0.0.1";
  const port = numberFromEnv(process.env.DB_PORT || process.env.PGPORT, 5432);
  const user = process.env.DB_USER || process.env.PGUSER || os.userInfo().username;
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD || "";
  const database = process.env.DB_NAME || process.env.PGDATABASE || "matcha";
  const adminDatabase = process.env.DB_ADMIN_DB || "postgres";
  const install = parseBoolean(process.env.INSTALL, false);

  const connectionString =
    process.env.DATABASE_URL ||
    buildConnectionString({
      host,
      port,
      user,
      password,
      database,
    });

  const adminConnectionString =
    process.env.DATABASE_ADMIN_URL ||
    buildConnectionString({
      host,
      port,
      user,
      password,
      database: adminDatabase,
    });

  process.env.DATABASE_URL = connectionString;

  return {
    install,
    host,
    port,
    user,
    password,
    database,
    adminDatabase,
    connectionString,
    adminConnectionString,
  };
}
