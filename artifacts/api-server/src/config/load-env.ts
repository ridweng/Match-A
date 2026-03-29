import fs from "node:fs";
import path from "node:path";

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

export function loadApiEnvFiles(startDir = process.cwd()) {
  const repoRoot = path.resolve(startDir);
  const envName =
    process.env.APP_ENV?.trim() || process.env.NODE_ENV?.trim() || "development";
  const apiServerDir = path.join(repoRoot, "artifacts/api-server");
  const candidates = [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, `.env.${envName}`),
    path.join(apiServerDir, ".env"),
    path.join(apiServerDir, `.env.${envName}`),
  ];

  candidates.forEach(loadEnvFile);
}

export function loadApiEnv() {
  loadApiEnvFiles();
}
