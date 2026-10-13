import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { pool } from "./pool";
export const db = drizzle(pool, { schema });

export { pool } from "./pool";
export * from "./schema";
