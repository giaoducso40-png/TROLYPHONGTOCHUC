import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public/templates");
const officialLogoHash = "f5c6059fcbd09af008a174e27f05fb3bfffcd1200fea2335395152e8e8981a87";
const expected = [
  { file: "UED_MAU_01_CAN_BO_GIANG_VIEN_V2.xlsx", sheets: ["CAN_BO_GIANG_VIEN"], fields: ["personId", "staffCode", "lecturerCode", "identityNumber"] },
  { file: "UED_MAU_02_DON_VI_CHUC_VU_V2.xlsx", sheets: ["DON_VI", "CHUC_VU"], fields: ["organizationCode", "assignmentId", "personId"] },
  { file: "UED_MAU_03_HOP_DONG_V2.xlsx", sheets: ["HOP_DONG"], fields: ["contractId", "personId", "salaryCoefficient", "endDate"] },
  { file: "UED_MAU_04_DAO_TAO_CAM_KET_V2.xlsx", sheets: ["DAO_TAO_NCS", "CAM_KET_HOAN_TRA"], fields: ["trainingId", "commitmentId", "personId"] },
  { file: "UED_MAU_05_BIEN_DONG_HO_SO_V2.xlsx", sheets: ["BIEN_DONG", "HO_SO_QUYET_DINH"], fields: ["eventId", "fileRecordId", "ownerEntityId"] },
];

function entries(file) {
  return execFileSync("unzip", ["-Z1", file], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
}

function readEntry(file, entry, encoding = null) {
  return execFileSync("unzip", ["-p", file, entry], encoding ? { encoding } : undefined);
}

const results = [];
for (const item of expected) {
  const file = path.join(root, item.file);
  assert.ok(fs.existsSync(file), `Thiếu mẫu ${item.file}`);
  const names = entries(file);
  const xmlNames = names.filter((name) => name.startsWith("xl/") && name.endsWith(".xml"));
  const xml = xmlNames.map((name) => readEntry(file, name, "utf8")).join("\n");
  const workbookXml = readEntry(file, "xl/workbook.xml", "utf8");

  for (const sheet of [...item.sheets, "HUONG_DAN", "TU_DIEN_TRUONG", "DANH_MUC"]) {
    assert.ok(workbookXml.includes(`name="${sheet}"`), `${item.file}: thiếu sheet ${sheet}`);
  }
  for (const field of item.fields) assert.ok(xml.includes(field), `${item.file}: thiếu mã trường ${field}`);
  assert.ok(xml.includes("UED-TC-2.0.0"), `${item.file}: thiếu phiên bản`);
  assert.ok(!xml.includes("<mergeCell"), `${item.file}: có ô gộp`);
  assert.ok(!xml.includes("hs1.xlsx"), `${item.file}: lẫn nguồn học sinh`);
  assert.ok(names.filter((name) => /^xl\/tables\/table\d+\.xml$/.test(name)).length >= item.sheets.length, `${item.file}: thiếu bảng lọc ở sheet dữ liệu`);
  assert.ok(names.filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).some((name) => readEntry(file, name, "utf8").includes("dataValidations")), `${item.file}: thiếu danh mục kiểm tra nhập`);

  const media = names.filter((name) => name.startsWith("xl/media/"));
  const hashes = media.map((name) => createHash("sha256").update(readEntry(file, name)).digest("hex"));
  assert.ok(hashes.includes(officialLogoHash), `${item.file}: logo nhúng không khớp logo UED chính thức`);

  results.push({ file: item.file, bytes: fs.statSync(file).size, dataSheets: item.sheets.length, logoHash: officialLogoHash, mergedCells: 0 });
}

console.log(JSON.stringify({ status: "passed", templates: results.length, version: "UED-TC-2.0.0", results }, null, 2));
