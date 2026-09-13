import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";

import { createRuntimeHarness, jsonRequest, responseJson } from "./runtime-harness.mjs";
import {
  clean,
  contractNumberIndex,
  contractStartRow,
  isContractDataRow,
  isStaffDataRow,
  normalizeExcelDate,
  readWorkbook,
  sheetRows,
  staffName,
  stripAcademicPrefix,
} from "./workbook-utils.mjs";

const sourceDirectory = process.env.UED_SOURCE_DIR || path.resolve(process.cwd(), "source-data");
const source = {
  staff: { fileName: "Nam 2026 (cap nhat).xls", checksum: "12f824de4b237df66540afb11582b44b884ef6c994e4c048cab909cb6c2a36f4" },
  fixed: { fileName: "THONG KE HOP DONG XDTH(1).xlsx", checksum: "f3b5ac0da603f02c99e3bcd5475f1c39bd5e9f9b58eece59c7994f4b282ceba5" },
  contracts: { fileName: "THONG KE HOP DONG TOAN TRUONG(1).xlsx", checksum: "a6b59279bfe1d051e5a01d513b8558b48ce9ca1b148704c26e739a87b7cade31" },
};
for (const item of Object.values(source)) item.path = path.join(sourceDirectory, item.fileName);

const [staffWorkbook, fixedWorkbook, contractWorkbook] = await Promise.all([
  readWorkbook(source.staff.path), readWorkbook(source.fixed.path), readWorkbook(source.contracts.path),
]);
const harness = await createRuntimeHarness();

async function importPayload(payload) {
  const { response, data } = await responseJson(await harness.workspace.POST(jsonRequest({ action: "bulk_import", ...payload })));
  assert.ok(response.ok, JSON.stringify({ entityType: payload.entityType, sheetName: payload.sheetName, status: response.status, error: data?.error }));
  return data;
}

async function asDateOrRaw(value) {
  if (!clean(value)) return undefined;
  return (await normalizeExcelDate(value)) ?? clean(value);
}

const professionalLabels = ["GVCC", "GVC", "GV", "CV", "NĐ 111", "NLĐ"];
const degreeLabels = ["Tiến sĩ", "Thạc sĩ", "Đại học", "Khác"];
const politicalLabels = ["Đảng ủy", "Ban giám hiệu", "Công đoàn", "Đoàn thanh niên", "Hội đồng trường"];

async function staffRecord(row, sourceRow) {
  const birthRaw = row[3] || row[4];
  const academicIndex = [18, 19].find((index) => clean(row[index]));
  const degreeIndex = [20, 21, 22, 23].find((index) => clean(row[index]));
  const professionalTitle = [12, 13, 14, 15, 16, 17].filter((index) => clean(row[index])).map((index) => professionalLabels[index - 12]).join(" · ");
  const politicalRole = [7, 8, 9, 10, 11].filter((index) => clean(row[index])).map((index) => politicalLabels[index - 7]).join(" · ");
  return {
    sourceRow,
    fullName: staffName(row),
    birthDate: (await normalizeExcelDate(birthRaw)) ?? clean(birthRaw),
    gender: clean(row[3]) ? "Nam" : clean(row[4]) ? "Nữ" : undefined,
    organization: clean(row[5]),
    position: clean(row[6]),
    politicalRole: politicalRole || undefined,
    professionalTitle: professionalTitle || undefined,
    academicTitle: academicIndex === 18 ? "GS" : academicIndex === 19 ? "PGS" : undefined,
    academicTitleYear: academicIndex === undefined ? undefined : Number(clean(row[academicIndex])) || undefined,
    degree: degreeIndex === undefined ? undefined : degreeLabels[degreeIndex - 20],
    degreeYear: degreeIndex === undefined ? undefined : Number(clean(row[degreeIndex])) || undefined,
    major: clean(row[36]),
    disciplineGroup: clean(row[37]),
    institution: clean(row[38]),
    // The source column is explicitly “Nơi đào tạo”; no country is invented.
    country: undefined,
    foreignLanguage: clean(row[39]),
    informatics: clean(row[40]),
    phdStatus: clean(row[41]),
    notes: clean(row[42]),
    employmentStatus: "Đang công tác",
    rawData: { sourceFile: source.staff.fileName, sourceSheet: "T8", sourceRow },
  };
}

const contractTypeBySheet = {
  "HDLV XĐTH": "Xác định thời hạn",
  "HDLV KXDTH": "Không xác định thời hạn",
  "HDLD NGHI HUU TD CAO": "Giảng viên trình độ cao đã nghỉ hưu",
  "HOP DONG HOC VIEC": "Học việc",
  "HDLD CM-NV": "Chuyên môn – nghiệp vụ",
  "HD THINH GIANG": "Thỉnh giảng",
};

async function contractRecord(sheetName, row, sourceRow) {
  const base = {
    sourceRow,
    fullName: sheetName === "HDLD NGHI HUU TD CAO" ? stripAcademicPrefix(row[1]) : clean(row[1]),
    birthDate: await asDateOrRaw(row[2]),
    organization: clean(sheetName === "HD THINH GIANG" ? row[7] : row[3]),
    contractNumber: clean(row[contractNumberIndex(sheetName)]),
    contractType: sheetName === "HDLV KXDTH" ? clean(row[4]) || contractTypeBySheet[sheetName] : contractTypeBySheet[sheetName],
    notes: clean(sheetName === "HDLV XĐTH" ? row[10] : sheetName === "HDLV KXDTH" ? row[8] : sheetName === "HD THINH GIANG" ? row[9] : row[8]),
    rawData: { sourceFile: source.contracts.fileName, sourceSheet: sheetName, sourceRow },
  };
  if (sheetName === "HDLV XĐTH") return { ...base, periodText: clean(row[4]), signedDate: await asDateOrRaw(row[5]), effectiveDate: await asDateOrRaw(row[6]), durationMonths: Number(row[7]) || undefined, endDate: await asDateOrRaw(row[8]) };
  if (sheetName === "HDLV KXDTH") return { ...base, signedDate: await asDateOrRaw(row[5]), effectiveDate: await asDateOrRaw(row[6]) };
  if (sheetName === "HD THINH GIANG") return { ...base, degree: clean(row[3]), major: clean(row[4]), roleOrSpecialty: [clean(row[3]), clean(row[4])].filter(Boolean).join(" · "), signingOrganization: clean(row[5]), periodText: clean(row[6]) };
  const rawName = clean(row[1]);
  const prefix = sheetName === "HDLD NGHI HUU TD CAO" ? rawName.slice(0, Math.max(0, rawName.length - stripAcademicPrefix(rawName).length)).trim() : "";
  return { ...base, durationMonths: Number(row[4]) || undefined, periodText: clean(row[5]), signedDate: await asDateOrRaw(row[6]), roleOrSpecialty: prefix || undefined };
}

try {
  const t8AllRows = await sheetRows(staffWorkbook, "T8");
  const peopleRecords = [];
  for (const [index, row] of t8AllRows.entries()) if (index >= 7 && isStaffDataRow(row)) peopleRecords.push(await staffRecord(row, index + 1));
  assert.equal(peopleRecords.length, 384);
  const staffSize = (await stat(source.staff.path)).size;
  const peopleImport = await importPayload({ entityType: "people", mode: "merge", fileName: source.staff.fileName, fileChecksum: source.staff.checksum, fileSize: staffSize, sheetName: "T8", headerRow: 5, headerDepth: 3, mappings: [], records: peopleRecords });
  assert.equal(peopleImport.inserted, 384);
  assert.equal(peopleImport.updated, 0);
  assert.equal(peopleImport.errorCount, 0);
  assert.equal(peopleImport.reconciliation.counts.people, 384);
  assert.equal(peopleImport.reconciliation.counts.organizations, 17);
  assert.equal(peopleImport.reconciliation.counts.qualifications, 384);
  const invalidBirthWarnings = await harness.DB.prepare("SELECT COUNT(*) AS count FROM import_errors WHERE import_id = ? AND error_code = 'INVALID_DATE' AND source_column = 'birthDate' AND severity = 'warning'").bind(peopleImport.importId).first();
  assert.equal(invalidBirthWarnings.count, 5);
  assert.equal((await harness.DB.prepare("SELECT COUNT(*) AS count FROM people WHERE birth_date IS NULL").first()).count, 5);
  assert.equal((await harness.DB.prepare("SELECT COUNT(*) AS count FROM qualifications WHERE country IS NOT NULL AND trim(country) <> ''").first()).count, 0);
  assert.ok((await harness.DB.prepare("SELECT COUNT(*) AS count FROM qualifications WHERE institution IS NOT NULL AND trim(institution) <> ''").first()).count > 0);
  assert.equal((await harness.DB.prepare("SELECT COUNT(*) AS count FROM qualifications WHERE academic_title = 'GS'").first()).count, 1);
  assert.equal((await harness.DB.prepare("SELECT COUNT(*) AS count FROM qualifications WHERE academic_title = 'PGS'").first()).count, 40);

  const expectedBySheet = { "HDLV XĐTH": 89, "HDLV KXDTH": 283, "HDLD NGHI HUU TD CAO": 9, "HOP DONG HOC VIEC": 4, "HDLD CM-NV": 5, "HD THINH GIANG": 33 };
  const contractSize = (await stat(source.contracts.path)).size;
  const contractResults = {};
  for (const [sheetName, expected] of Object.entries(expectedBySheet)) {
    const allRows = await sheetRows(contractWorkbook, sheetName);
    const records = [];
    for (const [index, row] of allRows.entries()) if (index >= contractStartRow(sheetName) && isContractDataRow(row)) records.push(await contractRecord(sheetName, row, index + 1));
    assert.equal(records.length, expected);
    const result = await importPayload({ entityType: "contracts", mode: "merge", fileName: source.contracts.fileName, fileChecksum: source.contracts.checksum, fileSize: contractSize, sheetName, headerRow: sheetName === "HDLV XĐTH" || sheetName === "HDLV KXDTH" ? 1 : 3, headerDepth: 1, mappings: [], records });
    assert.equal(result.inserted, expected, `Sai số ghi ${sheetName}`);
    contractResults[sheetName] = { inserted: result.inserted, updated: result.updated, skipped: result.skipped };
  }

  const contractAggregate = await harness.DB.prepare("SELECT COUNT(*) AS total, COUNT(DISTINCT id) AS uniqueIds, SUM(CASE WHEN id IS NULL OR trim(id) = '' THEN 1 ELSE 0 END) AS emptyIds, SUM(CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END) AS linked, SUM(CASE WHEN contract_number IS NULL OR trim(contract_number) = '' THEN 1 ELSE 0 END) AS missingNumbers FROM contracts WHERE deleted_at IS NULL").first();
  assert.equal(contractAggregate.total, 423);
  assert.equal(contractAggregate.uniqueIds, 423);
  assert.equal(contractAggregate.emptyIds, 0);
  assert.equal(contractAggregate.linked, 363);
  assert.equal(contractAggregate.missingNumbers, 9);
  assert.equal((await harness.DB.prepare("SELECT COUNT(*) AS count FROM contracts WHERE source_sheet = 'HDLV KXDTH'").first()).count, 283);

  const fixedRowsAll = await sheetRows(fixedWorkbook, "HDLV XĐTH");
  const fixedRecords = [];
  for (const [index, row] of fixedRowsAll.entries()) if (index >= 1 && isContractDataRow(row)) fixedRecords.push(await contractRecord("HDLV XĐTH", row, index + 1));
  assert.equal(fixedRecords.length, 89);
  const fixedResult = await importPayload({ entityType: "contracts", mode: "merge", fileName: source.fixed.fileName, fileChecksum: source.fixed.checksum, fileSize: (await stat(source.fixed.path)).size, sheetName: "HDLV XĐTH", headerRow: 1, headerDepth: 1, mappings: [], records: fixedRecords });
  assert.equal(fixedResult.inserted, 0);
  assert.equal(fixedResult.updated, 89);
  assert.equal((await harness.DB.prepare("SELECT COUNT(*) AS count FROM contracts").first()).count, 423);

  const duplicateFixed = await importPayload({ entityType: "contracts", mode: "merge", fileName: source.fixed.fileName, fileChecksum: source.fixed.checksum, fileSize: (await stat(source.fixed.path)).size, sheetName: "HDLV XĐTH", headerRow: 1, headerDepth: 1, mappings: [], records: fixedRecords });
  assert.equal(duplicateFixed.duplicateImport, true);

  const reconcileResponse = await responseJson(await harness.workspace.POST(jsonRequest({ action: "reconcile" })));
  assert.equal(reconcileResponse.response.status, 200);
  assert.equal(reconcileResponse.data.passed, true);
  assert.equal(reconcileResponse.data.counts.people, 384);
  assert.equal(reconcileResponse.data.counts.contracts, 423);
  assert.equal(reconcileResponse.data.counts.unlinkedContracts, 60);
  assert.equal(reconcileResponse.data.counts.brokenContractLinks, 0);
  assert.equal(reconcileResponse.data.counts.duplicateStaffCodes, 0);

  console.log(JSON.stringify({
    status: "passed",
    environment: "ephemeral-local-only",
    realDataPublished: false,
    workforce: { people: 384, organizationsAtT8Import: 17, invalidBirthDatesRetained: 5, qualifications: 384, academicTitles: { GS: 1, PGS: 40 } },
    contracts: { total: 423, uniqueIds: 423, linkedExactly: 363, manualReviewOrUnmatched: 60, missingNumbers: 9, bySheet: expectedBySheet },
    standaloneFixedTerm: { inserted: fixedResult.inserted, updated: fixedResult.updated, duplicateReplayBlocked: true },
    reconciliation: { passed: true, brokenLinks: 0, duplicateStaffCodes: 0 },
    sourceFilesExcluded: ["hs1.xlsx"],
    piiPrinted: false,
  }, null, 2));
} finally {
  await harness.close();
}
