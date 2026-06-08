import "dotenv/config";

export interface AppConfig {
  databaseUrl: string;
  port: number;
  dbPoolMax: number;
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got "${value}"`);
  }

  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    databaseUrl:
      env.DATABASE_URL ?? "postgres://audit:audit@localhost:5432/audit_log",
    port: numberFromEnv(env.PORT, 3000),
    dbPoolMax: numberFromEnv(env.DB_POOL_MAX, 10)
  };
}
