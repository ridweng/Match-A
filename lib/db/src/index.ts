import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { getDatabaseConfig } from "./runtime";

const { Pool } = pg;
const databaseConfig = getDatabaseConfig();

export const pool = new Pool({ connectionString: databaseConfig.connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
