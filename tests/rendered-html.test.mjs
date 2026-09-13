import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("emits the production worker and localized UED metadata", async () => {
  const [worker, layout] = await Promise.all([
    readFile(new URL("../dist/server/index.js", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(worker.length > 100_000, "production worker bundle must not be empty");
  assert.match(layout, /UED Tổ chức/);
  assert.match(layout, /Phòng Tổ chức/);
  assert.match(layout, /lang="vi"/);
});

test("ships the verified official UED logo asset", async () => {
  const logoUrl = new URL("../public/ued-logo.png", import.meta.url);
  const [metadata, bytes] = await Promise.all([stat(logoUrl), readFile(logoUrl)]);
  assert.ok(metadata.size > 50_000, "logo asset is unexpectedly small");
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
