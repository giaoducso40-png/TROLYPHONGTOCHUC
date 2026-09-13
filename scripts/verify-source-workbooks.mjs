import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  clean,
  contractNumberIndex,
  contractStartRow,
  isContractDataRow,
  isStaffDataRow,
  normalize,
  normalizeExcelDate,
  readWorkbook,
  sheetRows,
  staffName,
  stripAcademicPrefix,
} from "./workbook-utils.mjs";

const uploadDirectory = process.env.UED_SOURCE_DIR || path.resolve(process.cwd(), "source-data");
const paths = {
  staff: path.join(uploadDirectory, "Nam 2026 (cap nhat).xls"),
  fixed: path.join(uploadDirectory, "THONG KE HOP DONG XDTH(1).xlsx"),
  contracts: path.join(uploadDirectory, "THONG KE HOP DONG TOAN TRUONG(1).xlsx"),
};
const expectedChecksums = {
  staff: "12f824de4b237df66540afb11582b44b884ef6c994e4c048cab909cb6c2a36f4",
  fixed: "f3b5ac0da603f02c99e3bcd5475f1c39bd5e9f9b58eece59c7994f4b282ceba5",
  contracts: "a6b59279bfe1d051e5a01d513b8558b48ce9ca1b148704c26e739a87b7cade31",
};

async function checksum(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

for (const [key, filePath] of Object.entries(paths)) assert.equal(await checksum(filePath), expectedChecksums[key], `Sai checksum nguồn ${key}`);

const [staffWorkbook, fixedWorkbook, contractWorkbook] = await Promise.all([
  readWorkbook(paths.staff), readWorkbook(paths.fixed), readWorkbook(paths.contracts),
]);
assert.equal(staffWorkbook.SheetNames.length, 13);
assert.deepEqual(Array.from(fixedWorkbook.SheetNames), ["HDLV XĐTH"]);
assert.equal(contractWorkbook.SheetNames.length, 6);

const expectedMonthly = { T01: 380, T02: 380, T3: 381, T4: 382, T5: 381, T6: 383, T7: 382, T8: 384 };
for (const [sheetName, expected] of Object.entries(expectedMonthly)) {
  const rows = (await sheetRows(staffWorkbook, sheetName)).slice(sheetName === "T8" ? 7 : 5).filter(isStaffDataRow);
  assert.equal(rows.length, expected, `Sai tổng nhân sự ${sheetName}`);
}

const t8Rows = (await sheetRows(staffWorkbook, "T8")).slice(7).filter(isStaffDataRow);
assert.equal(t8Rows.filter((row) => clean(row[3])).length, 169, "Sai số nam T8");
assert.equal(t8Rows.filter((row) => clean(row[4])).length, 215, "Sai số nữ T8");
const degreeCounts = [20, 21, 22, 23].map((column) => t8Rows.filter((row) => clean(row[column])).length);
assert.deepEqual(degreeCounts, [204, 109, 55, 16], "Sai phân bố trình độ T8");
assert.equal(t8Rows.filter((row) => clean(row[18])).length, 1, "Sai số GS");
assert.equal(t8Rows.filter((row) => clean(row[19])).length, 40, "Sai số PGS");
assert.equal(new Set(t8Rows.map((row) => normalize(row[5])).filter(Boolean)).size, 17, "Sai số đơn vị T8");
let invalidBirthDates = 0;
for (const row of t8Rows) {
  const raw = row[3] || row[4];
  if (clean(raw) && !(await normalizeExcelDate(raw))) invalidBirthDates += 1;
}
assert.equal(invalidBirthDates, 5, "Sai số ngày sinh nguồn không hợp lệ");

const auxiliaryCounts = {
  "Thanh cap nhat": (await sheetRows(staffWorkbook, "Thanh cap nhat")).slice(7).filter(isStaffDataRow).length,
  "DS VC da & dang hoc tap o NN": (await sheetRows(staffWorkbook, "DS VC da & dang hoc tap o NN")).slice(5).filter(isStaffDataRow).length,
  "Den bu chi phi dao tao": (await sheetRows(staffWorkbook, "Den bu chi phi dao tao")).slice(6).filter(isStaffDataRow).length,
  "Tot nghiep o NN": (await sheetRows(staffWorkbook, "Tot nghiep o NN")).filter(isStaffDataRow).length,
};
assert.deepEqual(auxiliaryCounts, {
  "Thanh cap nhat": 357,
  "DS VC da & dang hoc tap o NN": 74,
  "Den bu chi phi dao tao": 7,
  "Tot nghiep o NN": 42,
});

const expectedContracts = {
  "HDLV XĐTH": 89,
  "HDLV KXDTH": 283,
  "HDLD NGHI HUU TD CAO": 9,
  "HOP DONG HOC VIEC": 4,
  "HDLD CM-NV": 5,
  "HD THINH GIANG": 33,
};
const contractRowsBySheet = new Map();
let contractTotal = 0;
let missingContractNumbers = 0;
for (const [sheetName, expected] of Object.entries(expectedContracts)) {
  const rows = (await sheetRows(contractWorkbook, sheetName)).slice(contractStartRow(sheetName)).filter(isContractDataRow);
  contractRowsBySheet.set(sheetName, rows);
  assert.equal(rows.length, expected, `Sai số hợp đồng ${sheetName}`);
  contractTotal += rows.length;
  missingContractNumbers += rows.filter((row) => !clean(row[contractNumberIndex(sheetName)])).length;
}
assert.equal(contractTotal, 423);
assert.equal(missingContractNumbers, 9);
assert.equal(contractRowsBySheet.get("HDLV KXDTH").filter((row) => !clean(row[0])).length, 1, "Phải giữ dòng KXĐTH thiếu STT");

const standaloneRows = (await sheetRows(fixedWorkbook, "HDLV XĐTH")).slice(1).filter(isContractDataRow);
const embeddedRows = contractRowsBySheet.get("HDLV XĐTH");
assert.equal(standaloneRows.length, 89);
assert.equal(standaloneRows.filter((row, index) => JSON.stringify(row) === JSON.stringify(embeddedRows[index])).length, 89, "Nguồn XĐTH riêng phải trùng tuyệt đối");

const people = [];
for (const row of t8Rows) people.push({ name: normalize(staffName(row)), birthDate: await normalizeExcelDate(row[3] || row[4]) });
const nameBirthCounts = new Map();
const names = new Set();
for (const person of people) {
  const key = `${person.name}|${person.birthDate ?? ""}`;
  nameBirthCounts.set(key, (nameBirthCounts.get(key) ?? 0) + 1);
  names.add(person.name);
}
const levenshtein = (left, right) => {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[right.length];
};
let exactLinks = 0;
let exactNameReview = 0;
const unresolvedNames = [];
for (const [sheetName, rows] of contractRowsBySheet) {
  for (const row of rows) {
    const rawName = sheetName === "HDLD NGHI HUU TD CAO" ? stripAcademicPrefix(row[1]) : clean(row[1]);
    const name = normalize(rawName);
    const birthDate = await normalizeExcelDate(row[2]);
    if (birthDate && nameBirthCounts.get(`${name}|${birthDate}`) === 1) exactLinks += 1;
    else if (names.has(name)) exactNameReview += 1;
    else unresolvedNames.push(name);
  }
}
// One source spelling differs by one character and is routed to manual review,
// never auto-linked. The queue therefore has 15 review candidates in total.
const nearNameReview = unresolvedNames.some((name) => people.some((person) => levenshtein(name, person.name) === 1)) ? 1 : 0;
const manualReview = exactNameReview + nearNameReview;
const unmatched = contractTotal - exactLinks - manualReview;
assert.deepEqual({ exactLinks, manualReview, unmatched }, { exactLinks: 363, manualReview: 15, unmatched: 45 });

console.log(JSON.stringify({
  status: "passed",
  sourceFiles: 3,
  staffSheets: 13,
  workforceT8: t8Rows.length,
  organizationsT8: 17,
  contracts: contractTotal,
  contractSheets: expectedContracts,
  auxiliaryCounts,
  invalidBirthDatesRetained: invalidBirthDates,
  missingContractNumbers,
  standaloneExactDuplicates: 89,
  links: { exact: exactLinks, manualReview, unmatched },
  piiPrinted: false,
}, null, 2));
