import path from "node:path";
import { spawnSync } from "node:child_process";
import { findRepoRoot } from "@workspace/db/runtime";

export function getRepoRoot() {
  return findRepoRoot(process.cwd());
}

export function runWorkspaceCommand(args: string[]) {
  const result = spawnSync("pnpm", args, {
    cwd: getRepoRoot(),
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED:${args.join(" ")}`);
  }
}

export function resolveRepoPath(...segments: string[]) {
  return path.join(getRepoRoot(), ...segments);
}
