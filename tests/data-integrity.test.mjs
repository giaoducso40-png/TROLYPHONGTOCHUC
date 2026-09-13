import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanText,
  contractStatus,
  normalizeDate,
  normalizeName,
  recordChecksum,
  stableStringify,
} from "../lib/server-data.ts";
import {
  contractMetrics,
  contractTypes,
  dataMap,
  degreeDistribution,
  monthlyWorkforce,
  sourceFiles,
} from "../lib/source-profile.ts";

test("normalizes Vietnamese names and dates without inventing invalid values", () => {
  assert.equal(cleanText("  Nguyễn   Văn  An  "), "Nguyễn Văn An");
  assert.equal(normalizeName("Đặng Thị Ánh"), "dang thi anh");
  assert.equal(normalizeDate("31/12/2026"), "2026-12-31");
  assert.equal(normalizeDate("2026-2-9"), "2026-02-09");
  assert.equal(normalizeDate("31/02/2026"), null);
  assert.equal(normalizeDate("2026"), null);
});

test("stable serialization and checksums are independent of object key order", async () => {
  const left = { name: "Nguyễn Minh An", code: "VC-DEMO-001", nested: { b: 2, a: 1 } };
  const right = { nested: { a: 1, b: 2 }, code: "VC-DEMO-001", name: "Nguyễn Minh An" };
  assert.equal(stableStringify(left), stableStringify(right));
  assert.equal(await recordChecksum(left), await recordChecksum(right));
  assert.notEqual(await recordChecksum(left), await recordChecksum({ ...right, code: "VC-DEMO-002" }));
});

test("contract status follows termination, indefinite and expiry rules", () => {
  const year = new Date().getUTCFullYear();
  assert.equal(contractStatus("Xác định thời hạn", null, "2026-09-01"), "đã thanh lý");
  assert.equal(contractStatus("Không xác định thời hạn", null, null), "đang hiệu lực");
  assert.equal(contractStatus("Xác định thời hạn", null, null), "chờ bổ sung");
  assert.equal(contractStatus("Xác định thời hạn", `${year - 2}-01-01`, null), "đã hết hạn");
  assert.equal(contractStatus("Xác định thời hạn", `${year + 2}-12-31`, null), "đang hiệu lực");
});

test("source aggregates reconcile exactly to the approved T08 profile", () => {
  for (const month of monthlyWorkforce) assert.equal(month.male + month.female, month.total, month.month);
  assert.equal(monthlyWorkforce.at(-1).total, 384);
  assert.equal(degreeDistribution.reduce((sum, item) => sum + item.value, 0), 384);
  assert.equal(contractTypes.reduce((sum, item) => sum + item.value, 0), 423);
  assert.equal(contractMetrics.total, 423);
  assert.equal(contractMetrics.active + contractMetrics.expired + contractMetrics.terminated, 423);
  assert.equal(contractMetrics.exactDuplicateRowsSkipped, 89);
});

test("source map preserves the corrected T7–T8 header depth and AQ boundary", () => {
  const staff = sourceFiles.find((item) => item.id === "staff-2026");
  const t8 = staff.sheets.find((sheet) => sheet.name === "T8");
  const current = staff.sheets.find((sheet) => sheet.name === "Thanh cap nhat");
  const overseas = staff.sheets.find((sheet) => sheet.name === "DS VC da & dang hoc tap o NN");
  assert.equal(t8.header, "5–7");
  assert.equal(t8.rows, 384);
  assert.match(t8.note, /AQ/);
  assert.equal(current.rows, 357);
  assert.match(current.note, /thiếu STT/);
  assert.equal(overseas.rows, 74);
  assert.ok(dataMap.some((item) => item.source.startsWith("AQ (T7–T8)") && item.target === "notes"));
  assert.ok(dataMap.some((item) => item.sourceName === "Nơi đào tạo" && item.target === "institution / country" && /chỉ tách quốc gia khi nguồn ghi rõ/.test(item.note)));
});

test("the standalone fixed-term workbook is explicitly treated as a duplicate source", () => {
  const standalone = sourceFiles.find((item) => item.id === "contract-fixed");
  assert.equal(standalone.status, "duplicate");
  assert.equal(standalone.sheets[0].rows, 89);
  assert.match(standalone.sheets[0].note, /không nhập lần hai/);
});

test("contract sheet totals preserve rows without STT and reconcile to 423", () => {
  const workbook = sourceFiles.find((item) => item.id === "contract-all");
  const bySheet = Object.fromEntries(workbook.sheets.map((sheet) => [sheet.name, sheet.rows]));
  assert.deepEqual(bySheet, {
    "HDLV XĐTH": 89,
    "HDLV KXDTH": 283,
    "HDLD NGHI HUU TD CAO": 9,
    "HOP DONG HOC VIEC": 4,
    "HDLD CM-NV": 5,
    "HD THINH GIANG": 33,
  });
  assert.equal(Object.values(bySheet).reduce((sum, value) => sum + value, 0), 423);
});
