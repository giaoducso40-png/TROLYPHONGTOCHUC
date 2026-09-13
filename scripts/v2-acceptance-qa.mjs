import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { createRuntimeHarness, responseJson } from "./runtime-harness.mjs";

const harness = await createRuntimeHarness();
const passed = [];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
};
const remember = (number, label) => passed.push({ number, label });

function request(url, options = {}, email = "local-preview@ued.udn.vn") {
  const headers = new Headers(options.headers ?? {});
  if (email) headers.set("oai-authenticated-user-email", email);
  return new Request(url, { ...options, headers });
}

async function post(body, email = "local-preview@ued.udn.vn", key = crypto.randomUUID()) {
  return responseJson(await harness.workspace.POST(request("http://localhost/api/workspace", {
    method: "POST",
    headers: { "content-type": "application/json", "x-idempotency-key": key },
    body: JSON.stringify(body),
  }, email)));
}

async function get(resource, email = "local-preview@ued.udn.vn", params = "") {
  return responseJson(await harness.workspace.GET(request(`http://localhost/api/workspace?resource=${resource}&limit=1000${params}`, {}, email)));
}

try {
  const bootstrap = await get("dashboard");
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.data.actor.role, "Quản trị viên");
  remember(1, "Tài khoản đầu tiên trở thành Quản trị viên");

  const organizationA = await post({ action: "upsert_organization", record: { code: "QA-V2-A", name: "Đơn vị V2 A", shortName: "V2A", level: "Phòng", version: 0 }, reason: "Kiểm thử" });
  const organizationB = await post({ action: "upsert_organization", record: { code: "QA-V2-B", name: "Đơn vị V2 B", shortName: "V2B", level: "Khoa", version: 0 }, reason: "Kiểm thử" });
  assert.equal(organizationA.response.status, 201);
  assert.equal(organizationB.response.status, 201);
  const orgA = organizationA.data.organization.id;
  const orgB = organizationB.data.organization.id;
  remember(2, "Tạo đơn vị bằng mã ổn định");

  const person = await post({ action: "upsert_person", record: {
    id: "qa-v2-person-a", staffCode: "QA-V2-CB-001", lecturerCode: "QA-V2-GV-001", personType: "Giảng viên",
    fullName: "Người Dùng Kiểm Thử V2", birthDate: "1988-02-20", gender: "Nữ", organizationId: orgA,
    organizationName: "Đơn vị V2 A", position: "Giảng viên", professionalTitle: "Giảng viên chính",
    employmentStatus: "Đang công tác", startDate: "2015-09-01", workEmail: "v2-a@ued.example",
    identityNumber: "SYNTHETIC-001", taxCode: "SYNTHETIC-TAX", socialInsuranceNumber: "SYNTHETIC-SI",
    specialization: "Quản trị giáo dục", workArrangement: "Toàn thời gian", degree: "Tiến sĩ", major: "Quản lý giáo dục", version: 0,
  }, reason: "Kiểm thử hồ sơ mở rộng" });
  assert.equal(person.response.status, 201, JSON.stringify(person.data));
  const storedPerson = await harness.DB.prepare("SELECT lecturer_code AS lecturerCode, person_type AS personType, specialization, updated_by AS updatedBy FROM people WHERE id = 'qa-v2-person-a'").first();
  assert.deepEqual({ ...storedPerson }, { lecturerCode: "QA-V2-GV-001", personType: "Giảng viên", specialization: "Quản trị giáo dục", updatedBy: "local-preview@ued.udn.vn" });
  remember(3, "Hồ sơ nhân sự mở rộng giữ đúng mã, PII và chuyên môn");

  const duplicateLecturer = await post({ action: "upsert_person", record: { id: "qa-v2-person-duplicate", lecturerCode: "QA-V2-GV-001", fullName: "Người Trùng Mã", organizationId: orgA, version: 0 } });
  assert.equal(duplicateLecturer.response.status, 409);
  remember(4, "Chặn trùng mã giảng viên");

  const personB = await post({ action: "upsert_person", record: { id: "qa-v2-person-b", staffCode: "QA-V2-CB-002", fullName: "Người Dùng Kiểm Thử B", organizationId: orgB, organizationName: "Đơn vị V2 B", version: 0 } });
  assert.equal(personB.response.status, 201);
  const bulk = await post({ action: "bulk_update_people", ids: ["qa-v2-person-a"], changes: { employmentStatus: "Biệt phái", workArrangement: "Theo quyết định" }, reason: "Kiểm thử cập nhật hàng loạt" });
  assert.equal(bulk.data.updated, 1);
  assert.equal((await harness.DB.prepare("SELECT employment_status AS status FROM people WHERE id = 'qa-v2-person-a'").first()).status, "Biệt phái");
  remember(5, "Cập nhật hàng loạt có nhật ký");

  const contract = await post({ action: "upsert_contract", record: {
    id: "qa-v2-contract-a", personId: "qa-v2-person-a", contractNumber: "QA-V2-HĐ-001", contractType: "Xác định thời hạn",
    organizationId: orgA, organizationName: "Đơn vị V2 A", signedDate: "2026-01-01", effectiveDate: "2026-01-02",
    startDate: "2026-01-02", endDate: "2027-01-01", durationMonths: 12, salaryCoefficient: "3.66", version: 0,
  }, reason: "Kiểm thử hợp đồng" });
  assert.equal(contract.response.status, 201, JSON.stringify(contract.data));
  assert.equal((await harness.DB.prepare("SELECT salary_coefficient AS salaryCoefficient FROM contracts WHERE id = 'qa-v2-contract-a'").first()).salaryCoefficient, "3.66");
  remember(6, "Hợp đồng liên kết person_id và lưu hệ số lương");

  const invalidDates = await post({ action: "upsert_contract", record: { id: "qa-v2-contract-invalid", personId: "qa-v2-person-a", contractType: "Xác định thời hạn", organizationId: orgA, startDate: "2027-01-01", endDate: "2026-01-01", version: 0 } });
  assert.equal(invalidDates.response.status, 400);
  assert.equal((await harness.DB.prepare("SELECT COUNT(*) AS count FROM contracts WHERE id = 'qa-v2-contract-invalid'").first()).count, 0);
  remember(7, "Sai logic ngày bị chặn trước khi ghi");

  const contractUpdate = await post({ action: "upsert_contract", record: { ...contract.data.contract, notes: "Phiên bản hai", version: 1 } });
  assert.equal(contractUpdate.response.status, 200);
  const staleContract = await post({ action: "upsert_contract", record: { ...contract.data.contract, notes: "Giá trị cũ", version: 1 } });
  assert.equal(staleContract.response.status, 409);
  assert.ok(staleContract.data.conflictId);
  remember(8, "Xung đột phiên bản hợp đồng được giữ lại");

  const accounts = [
    ["nhap@ued.example", "Người nhập liệu", [orgA]],
    ["kiemtra@ued.example", "Người kiểm tra", [orgA, orgB]],
    ["xem@ued.example", "Người chỉ xem", [orgB]],
    ["admin2@ued.example", "Quản trị viên", []],
  ];
  for (const [email, role, organizationScope] of accounts) {
    const created = await post({ action: "upsert_account", record: { email, role, organizationScope, isActive: true } });
    assert.ok(created.response.ok, JSON.stringify(created.data));
  }
  const tooMany = await post({ action: "upsert_account", record: { email: "sixth@ued.example", role: "Người chỉ xem", isActive: true } });
  assert.equal(tooMany.response.status, 409);
  const accountList = await get("accounts");
  assert.equal(accountList.data.rows.filter((row) => row.isActive).length, 5);
  remember(9, "Tối đa 5 tài khoản Google đang hoạt động");

  const unlisted = await get("people", "khongduoccap@ued.example");
  assert.equal(unlisted.response.status, 403);
  remember(10, "Tài khoản chưa cấp quyền bị từ chối");

  const scopedPeople = await get("people", "nhap@ued.example");
  assert.equal(scopedPeople.response.status, 200);
  assert.deepEqual(scopedPeople.data.rows.map((row) => row.id), ["qa-v2-person-a"]);
  const scopedWrite = await post({ action: "upsert_person", record: { id: "qa-v2-person-b", staffCode: "QA-V2-CB-002", fullName: "Ghi Ngoài Phạm Vi", organizationId: orgB, version: 1 } }, "nhap@ued.example");
  assert.equal(scopedWrite.response.status, 403);
  remember(11, "Phạm vi đơn vị áp dụng cho cả đọc và ghi");

  const viewerWrite = await post({ action: "upsert_person", record: { id: "x", fullName: "Không được ghi", organizationId: orgB, version: 0 } }, "xem@ued.example");
  assert.equal(viewerWrite.response.status, 403);
  const checkerAccounts = await get("accounts", "kiemtra@ued.example");
  assert.equal(checkerAccounts.response.status, 403);
  remember(12, "Bốn vai trò được kiểm tra ở máy chủ");

  const position = await post({ action: "upsert_position", record: { code: "QA-CV-01", name: "Trưởng đơn vị", positionType: "Chức vụ", organizationId: orgA } });
  const academicYear = await post({ action: "upsert_academic_year", record: { code: "2026-2027", name: "Năm học 2026–2027", startDate: "2026-09-01", endDate: "2027-08-31", isCurrent: true } });
  const settings = await post({ action: "save_settings", settings: { alertThresholds: [7, 15, 30, 60, 90], undoMinutes: 30, automaticBackupDays: 7, reminderFrequency: "daily" } });
  assert.equal(position.response.status, 201);
  assert.equal(academicYear.response.status, 201);
  assert.deepEqual(settings.data.settings.alertThresholds, [7, 15, 30, 60, 90]);
  const catalogs = await get("catalogs", "xem@ued.example");
  assert.equal(catalogs.data.academicYears.length, 1);
  remember(13, "Danh mục, năm học và mốc cảnh báo dùng chung");

  const firstBytes = Buffer.from("%PDF-1.4\nUED V2 version 1\n%%EOF\n");
  const firstForm = new FormData();
  firstForm.set("file", new File([firstBytes], "hop-dong-v1.pdf", { type: "application/pdf" }));
  firstForm.set("ownerEntityType", "contract");
  firstForm.set("ownerEntityId", "qa-v2-contract-a");
  const firstFile = await responseJson(await harness.files.POST(request("http://localhost/api/files", { method: "POST", body: firstForm })));
  assert.equal(firstFile.data.file.fileVersion, 1);
  const secondBytes = Buffer.from("%PDF-1.4\nUED V2 version 2\n%%EOF\n");
  const secondForm = new FormData();
  secondForm.set("file", new File([secondBytes], "hop-dong-v2.pdf", { type: "application/pdf" }));
  secondForm.set("ownerEntityType", "contract");
  secondForm.set("ownerEntityId", "qa-v2-contract-a");
  secondForm.set("replacesFileId", firstFile.data.file.id);
  const secondFile = await responseJson(await harness.files.POST(request("http://localhost/api/files", { method: "POST", body: secondForm })));
  assert.equal(secondFile.data.file.fileVersion, 2);
  assert.equal(secondFile.data.file.replacesFileId, firstFile.data.file.id);
  remember(14, "Tệp minh chứng có chuỗi phiên bản thay thế");

  const deleted = await post({ action: "bulk_delete", entityType: "person", ids: ["qa-v2-person-b"], reason: "Kiểm thử hoàn tác" });
  assert.equal(deleted.data.deleted, true);
  const trash = await get("trash");
  assert.ok(trash.data.rows.some((row) => row.id === "qa-v2-person-b"));
  const undone = await post({ action: "undo_delete", entityType: "person", ids: ["qa-v2-person-b"] });
  assert.equal(undone.data.deleted, false);
  remember(15, "Xóa mềm, thùng rác và hoàn tác hoạt động");

  const backupResponse = await harness.workspace.GET(request("http://localhost/api/workspace?resource=backup"));
  assert.equal(backupResponse.status, 200);
  const backup = await backupResponse.json();
  assert.equal(backup.version, 3);
  assert.equal(backup.user_roles, undefined);
  assert.equal(backup.file_records, undefined);
  assert.equal(backup.r2_file_bytes, undefined);
  const checksum = backup.checksum;
  delete backup.checksum;
  assert.equal(checksum, sha(stableStringify(backup)));
  backup.checksum = checksum;
  remember(16, "Sao lưu v3 có checksum và loại trừ tài khoản/tệp nhạy cảm");

  const brokenBackup = structuredClone(backup);
  brokenBackup.people[0].full_name = "Bị thay đổi";
  const rejectedRestore = await post({ action: "restore_backup", backup: brokenBackup });
  assert.equal(rejectedRestore.response.status, 400);
  const validRestore = await post({ action: "restore_backup", backup, reason: "Kiểm thử khôi phục" });
  assert.equal(validRestore.response.status, 200, JSON.stringify(validRestore.data));
  assert.ok(validRestore.data.totalRows > 0);
  remember(17, "Khôi phục chỉ chạy sau khi kiểm tra checksum");

  const dashboard = await get("dashboard_v2", "kiemtra@ued.example");
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.data.peopleTotal, 2);
  assert.equal(dashboard.data.contracts.total, 1);
  assert.deepEqual(Object.keys(dashboard.data.expiring).sort(), ["d15", "d30", "d60", "d7", "d90"]);
  remember(18, "Dashboard tính động theo phạm vi và 5 mốc thời hạn");

  const thousand = Array.from({ length: 1_000 }, (_, index) => ({
    sourceRow: index + 2,
    personId: `QA-PERSON-BATCH-${String(index + 1).padStart(4, "0")}`,
    staffCode: `QA-BATCH-${String(index + 1).padStart(4, "0")}`,
    fullName: `Người Kiểm Thử Lô ${String(index + 1).padStart(4, "0")}`,
    organizationCode: "QA-V2-A",
    organization: "Đơn vị V2 A",
    employmentStatus: "Đang công tác",
  }));
  const imported = await post({
    action: "bulk_import", entityType: "people", mode: "merge", fileName: "QA_V2_1000.xlsx",
    fileChecksum: sha("QA_V2_1000"), fileSize: 256_000, sheetName: "CAN_BO", headerRow: 1, headerDepth: 1, mappings: [], records: thousand,
  });
  assert.equal(imported.response.status, 201, JSON.stringify(imported.data));
  assert.equal(imported.data.inserted, 1_000);
  assert.equal((await harness.DB.prepare("SELECT staff_code AS staffCode FROM people WHERE id = 'QA-PERSON-BATCH-0001'").first()).staffCode, "QA-BATCH-0001");
  remember(19, "Lô 1.000 dòng giữ personId ổn định và đối soát");

  const sameKey = "qa-v2-replay";
  const replayBody = { action: "bulk_update_people", ids: ["qa-v2-person-a"], changes: { workArrangement: "Đã đối soát" }, reason: "Kiểm thử idempotency" };
  const firstReplay = await post(replayBody, "local-preview@ued.udn.vn", sameKey);
  const secondReplay = await post(replayBody, "local-preview@ued.udn.vn", sameKey);
  assert.equal(firstReplay.response.status, 200);
  assert.equal(secondReplay.data.replayed, true);
  assert.equal((await harness.DB.prepare("SELECT version FROM people WHERE id = 'qa-v2-person-a'").first()).version, 3);
  remember(20, "Idempotency ngăn ghi lặp sau retry");

  console.log(JSON.stringify({
    status: "passed",
    scenarios: passed.length,
    checks: passed,
    migrations: harness.migrations.length,
    pii: "synthetic-only",
  }, null, 2));
} finally {
  await harness.close();
}
