import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { createRuntimeHarness, jsonRequest, responseJson } from "./runtime-harness.mjs";

const harness = await createRuntimeHarness();
const checks = [];
const remember = (name) => checks.push(name);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const isoAfter = (days) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

async function post(body, key = crypto.randomUUID()) {
  return responseJson(await harness.workspace.POST(jsonRequest(body, key)));
}

async function get(resource) {
  return responseJson(await harness.workspace.GET(new Request(`http://localhost/api/workspace?resource=${resource}&limit=250`)));
}

async function importRows(entityType, records, suffix, mode = "merge") {
  const result = await post({
    action: "bulk_import",
    entityType,
    mode,
    fileName: `QA_${entityType}_${suffix}.xlsx`,
    fileChecksum: sha(`${entityType}|${suffix}`),
    fileSize: 2_048,
    sheetName: `QA_${entityType}_${suffix}`,
    headerRow: 1,
    headerDepth: 1,
    mappings: [],
    records,
  });
  assert.ok(result.response.ok, `${entityType}/${suffix}: ${JSON.stringify(result.data)}`);
  return result.data;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

try {
  const badAction = await post({ action: "unknown_action" });
  assert.equal(badAction.response.status, 400);
  remember("unsupported action rejected");

  const organization = await importRows("organizations", [{ sourceRow: 2, organizationCode: "QA-ORG", organizationName: "Đơn vị Kiểm thử", shortName: "QA", organizationLevel: "Phòng", organizationStatus: "Hoạt động", effectiveDate: isoAfter(-365) }], "org");
  assert.equal(organization.inserted, 1);

  const firstPeoplePayload = [{ sourceRow: 2, staffCode: "QA-CB-001", fullName: "Cán Bộ Kiểm Thử Một", birthDate: "1988-02-20", gender: "Nam", organizationCode: "QA-ORG", organization: "Đơn vị Kiểm thử", position: "Chuyên viên", degree: "Thạc sĩ", degreeYear: 2018, major: "Quản trị", institution: "Cơ sở đào tạo mẫu", country: "Việt Nam", employmentStatus: "Đang công tác" }];
  const firstPeople = await importRows("people", firstPeoplePayload, "people-v1");
  assert.equal(firstPeople.inserted, 1);
  assert.equal(firstPeople.reconciliation.counts.people, 1);
  assert.equal(firstPeople.reconciliation.counts.qualifications, 1);

  const repeatedPeople = await importRows("people", firstPeoplePayload, "people-v2");
  assert.equal(repeatedPeople.updated, 1);
  assert.equal(repeatedPeople.reconciliation.counts.people, 1);
  assert.equal(repeatedPeople.reconciliation.counts.qualifications, 1);
  remember("stable person and qualification merge");

  const duplicateImport = await post({ action: "bulk_import", entityType: "people", mode: "merge", fileName: "QA_people_duplicate.xlsx", fileChecksum: sha("people|people-v2"), sheetName: "QA_people_people-v2", records: firstPeoplePayload });
  assert.equal(duplicateImport.response.status, 200);
  assert.equal(duplicateImport.data.duplicateImport, true);
  remember("duplicate source import blocked");

  const secondPerson = await importRows("people", [{ sourceRow: 2, staffCode: "QA-CB-002", fullName: "Cán Bộ Kiểm Thử Hai", birthDate: "1990-05-10", organizationCode: "QA-ORG", organization: "Đơn vị Kiểm thử", employmentStatus: "Đang công tác" }], "people-second");
  assert.equal(secondPerson.inserted, 1);
  const conflictingKeys = await importRows("people", [{ sourceRow: 2, staffCode: "QA-CB-001", fullName: "Cán Bộ Kiểm Thử Hai", birthDate: "1990-05-10", organizationCode: "QA-ORG", organization: "Đơn vị Kiểm thử" }], "people-conflicting");
  assert.equal(conflictingKeys.skipped, 1);
  assert.equal(conflictingKeys.errorCount, 1);
  assert.equal(conflictingKeys.reconciliation.counts.people, 2);
  remember("conflicting person keys stopped without overwrite");

  const assignmentRecord = { sourceRow: 2, staffCode: "QA-CB-001", assignmentType: "Bổ nhiệm", assignmentTitle: "Tổ trưởng kiểm thử", organizationCode: "QA-ORG", assignmentStatus: "Đang hiệu lực", startDate: isoAfter(-100), endDate: isoAfter(30), decisionNumber: "QA-QĐ-001" };
  const assignmentFirst = await importRows("assignments", [assignmentRecord], "assignment-v1");
  const assignmentAgain = await importRows("assignments", [assignmentRecord], "assignment-v2");
  assert.equal(assignmentFirst.inserted, 1);
  assert.equal(assignmentAgain.updated, 1);
  assert.equal((await harness.DB.prepare("SELECT COUNT(*) AS count FROM person_assignments").first()).count, 1);
  remember("stable assignment business key");

  const invalidOrganization = await importRows("assignments", [{ ...assignmentRecord, sourceRow: 3, organizationCode: "QA-KHONG-TON-TAI", assignmentTitle: "Phân công lỗi", decisionNumber: "QA-QĐ-ERR" }], "assignment-invalid-org");
  assert.equal(invalidOrganization.skipped, 1);
  assert.equal(invalidOrganization.errorCount, 1);
  remember("unknown organization link rejected");

  const contractRecords = [
    { sourceRow: 2, staffCode: "QA-CB-001", fullName: "Cán Bộ Kiểm Thử Một", birthDate: "1988-02-20", organizationCode: "QA-ORG", organization: "Đơn vị Kiểm thử", contractNumber: "QA-HĐ-001", contractType: "Xác định thời hạn", effectiveDate: isoAfter(-300), endDate: isoAfter(30), signedDate: isoAfter(-305) },
    { sourceRow: 3, staffCode: "QA-CB-002", fullName: "Cán Bộ Kiểm Thử Hai", birthDate: "1990-05-10", organizationCode: "QA-ORG", organization: "Đơn vị Kiểm thử", contractNumber: "QA-HĐ-002", contractType: "Không xác định thời hạn", effectiveDate: isoAfter(-250), signedDate: isoAfter(-255) },
    { sourceRow: 4, staffCode: "QA-CB-001", fullName: "Cán Bộ Kiểm Thử Một", birthDate: "1988-02-20", organizationCode: "QA-ORG", organization: "Đơn vị Kiểm thử", contractType: "Xác định thời hạn", effectiveDate: isoAfter(-120), signedDate: isoAfter(-125) },
  ];
  const contracts = await importRows("contracts", contractRecords, "contracts");
  assert.equal(contracts.inserted, 3);
  const contractIds = (await harness.DB.prepare("SELECT id FROM contracts ORDER BY id").all()).results.map((row) => row.id);
  assert.equal(contractIds.length, 3);
  assert.equal(new Set(contractIds).size, 3);
  assert.ok(contractIds.every(Boolean));
  remember("non-empty unique generated contract ids");

  const training = await importRows("training", [{ sourceRow: 2, staffCode: "QA-CB-001", trainingType: "Đào tạo", programName: "Chương trình kiểm thử", institution: "Cơ sở đào tạo mẫu", country: "Việt Nam", trainingStatus: "Đang học", startDate: isoAfter(-60), endDate: isoAfter(45), decisionNumber: "QA-ĐT-001" }], "training");
  assert.equal(training.inserted, 1);
  const trainingId = (await harness.DB.prepare("SELECT id FROM training_records LIMIT 1").first()).id;

  const commitment = await importRows("commitments", [{ sourceRow: 2, staffCode: "QA-CB-001", relatedTrainingId: trainingId, decisionNumber: "QA-CK-001", amount: "1000000", startDate: isoAfter(-20), dueDate: isoAfter(20), commitmentStatus: "Đang thực hiện" }], "commitment");
  assert.equal(commitment.inserted, 1);

  const event = await importRows("events", [{ sourceRow: 2, staffCode: "QA-CB-001", eventType: "Điều chuyển", fromOrganizationCode: "QA-ORG", toOrganizationCode: "QA-ORG", effectiveDate: isoAfter(-10), decisionNumber: "QA-BĐ-001", reason: "Kiểm thử hồi quy" }], "event");
  assert.equal(event.inserted, 1);

  const personId = (await harness.DB.prepare("SELECT id FROM people WHERE staff_code = 'QA-CB-001'").first()).id;
  const document = await importRows("documents", [{ sourceRow: 2, fileRecordId: "QA-DOC-001", ownerEntityType: "person", ownerEntityId: personId, fileType: "Quyết định", fileName: "quyet-dinh-kiem-thu.pdf", documentNumber: "QA-VB-001", documentDate: isoAfter(-5), version: 1 }], "document");
  assert.equal(document.inserted, 1);
  remember("all eight import entity types accepted");

  const alertFirst = await get("alerts");
  assert.equal(alertFirst.response.status, 200);
  const alertCount = alertFirst.data.rows.length;
  assert.ok(alertCount >= 5, "derived alerts for all dated workflows were not created");
  const alertSecond = await get("alerts");
  assert.equal(alertSecond.data.rows.length, alertCount);
  const duplicateAlertKeys = await harness.DB.prepare("SELECT dedup_key, COUNT(*) AS count FROM alerts GROUP BY dedup_key HAVING COUNT(*) > 1").all();
  assert.equal(duplicateAlertKeys.results.length, 0);
  const prefixes = new Set((await harness.DB.prepare("SELECT substr(dedup_key, 1, instr(dedup_key, ':') - 1) AS prefix FROM alerts").all()).results.map((row) => row.prefix));
  for (const prefix of ["contract-due", "contract-missing-number", "contract-missing-end", "training-due", "commitment-due", "assignment-due"]) assert.ok(prefixes.has(prefix), `Thiếu cảnh báo ${prefix}`);
  remember("derived alerts cover workflows and remain deduplicated");

  const alertId = alertFirst.data.rows.find((row) => row.status !== "resolved").id;
  const assigned = await post({ action: "assign_alert", id: alertId });
  assert.equal(assigned.response.status, 200);
  assert.equal(assigned.data.alert.assigneeUserId, "local-preview@ued.udn.vn");
  const resolved = await post({ action: "resolve_alert", id: alertId, reason: "Kiểm thử" });
  assert.equal(resolved.data.alert.status, "resolved");
  remember("alert assignment and resolution audited");

  const fileBytes = Buffer.from("%PDF-1.4\nUED QA synthetic file\n%%EOF\n", "utf8");
  const form = new FormData();
  form.set("file", new File([fileBytes], "minh-chung-qa.pdf", { type: "application/pdf" }));
  form.set("ownerEntityType", "person");
  form.set("ownerEntityId", personId);
  const upload = await responseJson(await harness.files.POST(new Request("http://localhost/api/files", { method: "POST", body: form })));
  assert.equal(upload.response.status, 201);
  assert.equal(upload.data.file.checksum, sha(fileBytes));
  const download = await harness.files.GET(new Request(`http://localhost/api/files?id=${upload.data.file.id}&download=1`));
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), fileBytes);
  remember("R2-style upload, checksum and byte-exact download");

  const idempotencyKey = "qa-idempotency-key";
  const idempotentBody = { action: "upsert_person", record: { id: "QA-PERSON-IDEMPOTENT", staffCode: "QA-CB-003", fullName: "Cán Bộ Kiểm Thử Ba", birthDate: "1992-03-12", organization: "Đơn vị Kiểm thử", version: 0 }, reason: "Kiểm thử chống lặp" };
  const firstIdempotent = await post(idempotentBody, idempotencyKey);
  const secondIdempotent = await post(idempotentBody, idempotencyKey);
  assert.equal(firstIdempotent.response.status, 201);
  assert.equal(secondIdempotent.data.replayed, true);
  assert.equal((await harness.DB.prepare("SELECT COUNT(*) AS count FROM people WHERE staff_code = 'QA-CB-003'").first()).count, 1);
  remember("idempotency replay does not duplicate records");

  const versionedCreate = await post({ action: "upsert_person", record: { id: "QA-PERSON-VERSIONED", staffCode: "QA-CB-004", fullName: "Cán Bộ Kiểm Thử Bốn", birthDate: "1991-04-14", organization: "Đơn vị Kiểm thử", version: 0 } });
  assert.equal(versionedCreate.response.status, 201);
  const versionedUpdate = await post({ action: "upsert_person", record: { id: "QA-PERSON-VERSIONED", staffCode: "QA-CB-004", fullName: "Cán Bộ Kiểm Thử Bốn", birthDate: "1991-04-14", organization: "Đơn vị Kiểm thử", position: "Chuyên viên chính", version: 1 } });
  assert.equal(versionedUpdate.response.status, 200);
  const staleUpdate = await post({ action: "upsert_person", record: { id: "QA-PERSON-VERSIONED", staffCode: "QA-CB-004", fullName: "Cán Bộ Kiểm Thử Bốn", birthDate: "1991-04-14", organization: "Đơn vị Kiểm thử", position: "Giá trị cũ", version: 1 } });
  assert.equal(staleUpdate.response.status, 409);
  assert.ok(staleUpdate.data.conflictId);
  remember("optimistic version conflict preserved");

  const reconcile = await post({ action: "reconcile" });
  assert.equal(reconcile.response.status, 200);
  assert.equal(reconcile.data.passed, true);
  assert.equal(reconcile.data.counts.brokenContractLinks, 0);
  assert.equal(reconcile.data.counts.brokenTrainingLinks, 0);
  assert.equal(reconcile.data.counts.brokenCommitmentLinks, 0);
  assert.equal(reconcile.data.counts.brokenDocumentLinks, 0);
  assert.equal(reconcile.data.counts.duplicateStaffCodes, 0);
  remember("reconciliation counts, links and checksum passed");

  const backupResponse = await harness.workspace.GET(new Request("http://localhost/api/workspace?resource=backup"));
  assert.equal(backupResponse.status, 200);
  const backup = await backupResponse.json();
  const suppliedChecksum = backup.checksum;
  delete backup.checksum;
  assert.equal(suppliedChecksum, sha(stableStringify(backup)));
  remember("backup checksum independently verified");

  const dashboard = await get("dashboard");
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.data.counts.contracts, 3);
  assert.equal(dashboard.data.missingContractNumber, 1);
  assert.equal(dashboard.data.counts.openConflicts, 1);

  console.log(JSON.stringify({
    status: "passed",
    migrations: harness.migrations.length,
    checks: checks.length,
    checkNames: checks,
    finalCounts: dashboard.data.counts,
    derivedAlerts: alertCount,
    backupChecksumVerified: true,
    pii: "synthetic-only",
  }, null, 2));
} finally {
  await harness.close();
}
