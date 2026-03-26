import { defineConfig } from "drizzle-kit";
import path from "path";
import { getDatabaseConfig } from "./src/runtime";

const databaseConfig = getDatabaseConfig();

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseConfig.connectionString,
  },
  schemaFilter: ["auth", "core", "catalog", "goals", "discovery", "media", "public"],
});
