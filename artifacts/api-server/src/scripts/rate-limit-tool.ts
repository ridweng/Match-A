import { loadApiEnv } from "../config/env";
import {
  clearRateLimitKeys,
  collectRateLimitKeyDescriptors,
  inspectRateLimitKeys,
  type RateLimitCounterSnapshot,
} from "../security/rate-limit";

type Command = "inspect" | "reset";

function parseArgs(argv: string[]) {
  const [commandRaw, ...rest] = argv;
  const command = (commandRaw || "inspect") as Command;
  const options: Record<string, string> = {};

  for (const entry of rest) {
    if (!entry.startsWith("--")) {
      continue;
    }
    const [key, ...valueParts] = entry.slice(2).split("=");
    options[key] = valueParts.join("=") || "true";
  }

  return { command, options };
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  pnpm --filter @workspace/api-server rate-limit:inspect --route=sign-up --email=user@example.com --ip=203.0.113.10",
      "  pnpm --filter @workspace/api-server rate-limit:reset --route=sign-up --email=user@example.com --ip=203.0.113.10",
      "",
      "Options:",
      "  --route=<name>     Auth route name such as sign-up, sign-in, refresh",
      "  --email=<email>    Identifier-based limiter input",
      "  --ip=<ip>          Client IP for general and strict IP limiters",
    ].join("\n")
  );
}

function printSnapshots(
  title: string,
  snapshots: RateLimitCounterSnapshot[]
) {
  console.log(`\n${title}`);
  if (!snapshots.length) {
    console.log("  none");
    return;
  }
  for (const snapshot of snapshots) {
    console.log(
      `  - source=${snapshot.source} key=${snapshot.key} count=${snapshot.count} resetAt=${snapshot.resetAt || "n/a"} ttlMs=${snapshot.ttlMs ?? "n/a"}`
    );
  }
}

async function main() {
  loadApiEnv();
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!["inspect", "reset"].includes(command)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const descriptors = collectRateLimitKeyDescriptors({
    route: options.route,
    email: options.email,
    ip: options.ip,
  });

  if (!descriptors.length) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log("Targets:");
  for (const descriptor of descriptors) {
    console.log(
      `  - limiter=${descriptor.limiterName} type=${descriptor.keyType} dbKey=${descriptor.storageKey} redisKey=${descriptor.redisKey} raw=${descriptor.rawValueDescription}`
    );
  }

  const before = await inspectRateLimitKeys(descriptors);
  printSnapshots("Before", before);

  if (command === "inspect") {
    return;
  }

  const cleared = await clearRateLimitKeys(descriptors);
  printSnapshots("Cleared", cleared);

  const after = await inspectRateLimitKeys(descriptors);
  printSnapshots("After", after);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
