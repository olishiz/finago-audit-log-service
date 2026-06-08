import { Pool, types, type PoolClient } from "pg";
import { loadConfig } from "./config.js";

const config = loadConfig();

types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax
});

export interface Queryable {
  query: PoolClient["query"];
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  client: PoolClient,
  fn: () => Promise<T>
): Promise<T> {
  await client.query("BEGIN");

  try {
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
