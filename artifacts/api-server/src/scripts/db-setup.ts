import "reflect-metadata";
import { loadApiEnv } from "../config/env";
import { ensureInstalledDatabase } from "@workspace/db/install";
import { runWorkspaceCommand } from "./helpers";

async function main() {
  loadApiEnv();
  await ensureInstalledDatabase();
  runWorkspaceCommand(["--dir", "lib/db", "migrate"]);
  runWorkspaceCommand(["--dir", "artifacts/api-server", "seed"]);
  runWorkspaceCommand([
    "--dir",
    "artifacts/api-server",
    "db:rebuild:preferences",
  ]);
  runWorkspaceCommand([
    "--dir",
    "artifacts/api-server",
    "db:rebuild:goal-targets",
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
