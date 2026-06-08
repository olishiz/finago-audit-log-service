import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { loadConfig } from "./config.js";
import { pool } from "./db.js";
import {
  InvalidCursorError,
  ingestEventSchema,
  queryEventsSchema
} from "./events.js";
import { AuditEventRepository } from "./repository.js";

export function createApp(): FastifyInstance {
  const app = Fastify({
    logger: true
  });
  const repository = new AuditEventRepository();

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({
        error: "validation_error",
        details: error.flatten()
      });
      return;
    }

    if (error instanceof InvalidCursorError) {
      reply.code(400).send({ error: "invalid_cursor" });
      return;
    }

    app.log.error(error);
    reply.code(500).send({ error: "internal_error" });
  });

  app.get("/health", async () => {
    const result = await pool.query("SELECT 1 AS ok");
    return {
      status: result.rows[0]?.ok === 1 ? "ok" : "degraded"
    };
  });

  app.post("/events", async (request, reply) => {
    const event = ingestEventSchema.parse(request.body);
    const result = await repository.ingest(event);
    reply.code(result.created ? 201 : 200).send(result);
  });

  app.get("/events", async (request) => {
    const query = queryEventsSchema.parse(request.query);
    return repository.list(query);
  });

  return app;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = createApp();

  const shutdown = async (): Promise<void> => {
    await app.close();
    await pool.end();
  };

  process.on("SIGINT", () => {
    shutdown().then(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    shutdown().then(() => process.exit(0));
  });

  await app.listen({ port: config.port, host: "0.0.0.0" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
