import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const databasePath = process.argv[2];
if (!databasePath) throw new Error("Cách dùng: node scripts/apply-local-migrations.mjs <duong-dan-sqlite>");

const migrationDirectory = new URL("../drizzle/", import.meta.url);
const files = (await readdir(migrationDirectory))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const database = new DatabaseSync(path.resolve(databasePath));
database.exec("PRAGMA foreign_keys = ON;");
for (const file of files) {
  const sql = await readFile(new URL(file, migrationDirectory), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) database.exec(statement);
}
database.close();
console.log(JSON.stringify({ status: "passed", database: path.resolve(databasePath), migrations: files.length }));
