import pg from "pg";
import { getDatabaseConfig } from "./runtime";

const { Client } = pg;

function escapeIdentifier(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function ensureDatabaseExists() {
  const config = getDatabaseConfig();
  const client = new Client({
    connectionString: config.adminConnectionString,
  });

  await client.connect();
  try {
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1",
      [config.database]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      return config;
    }

    await client.query(`CREATE DATABASE ${escapeIdentifier(config.database)}`);
    return config;
  } finally {
    await client.end();
  }
}

export async function ensureInstalledDatabase() {
  const config = getDatabaseConfig();
  if (!config.install) {
    return config;
  }

  await ensureDatabaseExists();

  return config;
}
