import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";

class LocalD1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new LocalD1Statement(this.database, this.sql, values);
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) ?? null;
  }

  async all() {
    return { success: true, results: this.database.prepare(this.sql).all(...this.values), meta: {} };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes ?? 0), last_row_id: Number(result.lastInsertRowid ?? 0) } };
  }
}

class LocalD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new LocalD1Statement(this.database, sql);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

class LocalR2Bucket {
  constructor() {
    this.objects = new Map();
  }

  async put(key, value, options = {}) {
    const buffer = value instanceof ArrayBuffer ? Buffer.from(value) : Buffer.from(value);
    this.objects.set(key, { buffer, options });
    return { key, size: buffer.length };
  }

  async get(key) {
    const stored = this.objects.get(key);
    return stored ? { body: stored.buffer, size: stored.buffer.length, httpMetadata: stored.options.httpMetadata, customMetadata: stored.options.customMetadata } : null;
  }

  async delete(key) {
    this.objects.delete(key);
  }
}

async function applyMigrations(database) {
  const directory = new URL("../drizzle/", import.meta.url);
  const files = (await readdir(directory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) database.exec(statement);
  }
  return files;
}

export async function createRuntimeHarness() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  const migrations = await applyMigrations(database);
  const DB = new LocalD1Database(database);
  const BUCKET = new LocalR2Bucket();
  globalThis.__UED_TEST_ENV__ = { DB, BUCKET };
  const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    root,
    resolve: { alias: { "@": root } },
    server: { middlewareMode: true },
    plugins: [{
      name: "ued-local-cloudflare-bindings",
      enforce: "pre",
      resolveId(id) { return id === "cloudflare:workers" ? "\0ued-cloudflare-workers" : null; },
      load(id) { return id === "\0ued-cloudflare-workers" ? "export const env = globalThis.__UED_TEST_ENV__;" : null; },
    }],
  });
  const workspace = await vite.ssrLoadModule("/app/api/workspace/route.ts");
  const files = await vite.ssrLoadModule("/app/api/files/route.ts");
  return {
    DB,
    BUCKET,
    database,
    migrations,
    workspace,
    files,
    async close() {
      await vite.close();
      database.close();
      delete globalThis.__UED_TEST_ENV__;
    },
  };
}

export function jsonRequest(body, idempotencyKey = crypto.randomUUID()) {
  return new Request("http://localhost/api/workspace", {
    method: "POST",
    headers: { "content-type": "application/json", "x-idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
}

export async function responseJson(response) {
  const data = await response.json().catch(() => null);
  return { response, data };
}
