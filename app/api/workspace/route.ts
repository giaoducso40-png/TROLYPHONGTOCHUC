import { cleanText, contractStatus, jsonForStorage, normalizeDate, normalizeName, recordChecksum, sha256Text, stableStringify } from "@/lib/server-data";
import { getBindings, hasPermission, requirePermission, resolveActor, responseFromThrown, type Actor } from "@/lib/server-auth";
import { getV2Resource, mutateV2, permissionForV2Action, V2_WRITABLE_ACTIONS } from "@/lib/workspace-v2-server";

export const dynamic = "force-dynamic";

type DataRecord = Record<string, unknown> & { sourceRow?: number };
type ImportEntityType = "people" | "organizations" | "assignments" | "contracts" | "training" | "commitments" | "events" | "documents";

type ExistingPerson = {
  id: string;
  staffCode: string | null;
  lecturerCode: string | null;
  fullName: string;
  normalizedName: string;
  birthDate: string | null;
  organizationId: string | null;
  organizationNameSource: string | null;
  position: string | null;
  professionalTitle: string | null;
  employmentStatus: string;
  phone: string | null;
  workEmail: string | null;
  sourceIdentityKey: string | null;
  version: number;
};

type ExistingContract = {
  id: string;
  sourceIdentityKey: string;
  contractNumber: string | null;
  version: number;
};

type ImportIssue = {
  row: number;
  field: string;
  code: string;
  severity: "error" | "warning";
  message: string;
  fix: string;
  value?: string;
};

const writableActions = new Set(["upsert_person", "bulk_import", "resolve_alert", "assign_alert", "mark_alert_read", "soft_delete", "restore", "reconcile", "log_export", ...V2_WRITABLE_ACTIONS]);

function json(data: unknown, init?: ResponseInit) {
  const response = Response.json(data, init);
  response.headers.set("cache-control", "no-store");
  return response;
}

function safeLimit(value: string | null, fallback = 50, maximum = 250) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(maximum, parsed)) : fallback;
}

function safeOffset(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(0, parsed) : 0;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function actorOrganizationScope(actor: Actor) {
  const raw = actor.organizationScope?.trim();
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => cleanText(item, 100)).filter(Boolean);
  } catch {
    // Giá trị từ phiên bản cũ có thể phân tách bằng dấu phẩy/chấm phẩy.
  }
  return raw.split(/[,;|]/).map((item) => cleanText(item, 100)).filter(Boolean);
}

function actorScopeSql(actor: Actor, column: string) {
  const ids = actorOrganizationScope(actor);
  return ids.length
    ? { clause: `${column} IN (${ids.map(() => "?").join(",")})`, args: ids }
    : { clause: "1 = 1", args: [] as string[] };
}

async function runBatches(DB: D1Database, statements: D1PreparedStatement[], chunkSize = 60) {
  for (let index = 0; index < statements.length; index += chunkSize) {
    await DB.batch(statements.slice(index, index + chunkSize));
  }
}

async function organizationFor(
  DB: D1Database,
  nameValue: unknown,
  organizationsByName: Map<string, { id: string; name: string }>,
  newOrganizationStatements: Map<string, D1PreparedStatement>,
) {
  const name = cleanText(nameValue, 300);
  if (!name) return null;
  const normalized = normalizeName(name);
  const existing = organizationsByName.get(normalized);
  if (existing) return existing.id;
  const hash = await sha256Text(normalized);
  const id = `org-${hash.slice(0, 24)}`;
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18).toUpperCase() || "DON-VI";
  const code = `${slug}-${hash.slice(0, 6).toUpperCase()}`;
  organizationsByName.set(normalized, { id, name });
  newOrganizationStatements.set(
    id,
    DB.prepare("INSERT INTO organizations (id, code, name, status, version) VALUES (?, ?, ?, 'active', 1) ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP")
      .bind(id, code, name),
  );
  return id;
}

function actorAudit(
  DB: D1Database,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
  reason: string,
  requestId: string,
) {
  return DB.prepare(
    "INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, before_json, after_json, changed_fields, reason, request_id, device_session) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(),
    actor.id,
    actor.email,
    action,
    entityType,
    entityId,
    before == null ? null : jsonForStorage(before, 50_000),
    after == null ? null : jsonForStorage(after, 50_000),
    after && typeof after === "object" ? Object.keys(after as Record<string, unknown>).join(",") : null,
    cleanText(reason, 500) || null,
    requestId,
    cleanText(requestId, 120),
  );
}

function issueStatement(DB: D1Database, importId: string, sheetName: string, issue: ImportIssue) {
  return DB.prepare(
    "INSERT INTO import_errors (id, import_id, sheet_name, source_row, source_column, error_code, severity, source_value, message, suggested_fix) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(), importId, sheetName, issue.row, issue.field, issue.code, issue.severity,
    issue.value ? cleanText(issue.value, 1_000) : null, issue.message, issue.fix,
  );
}

function dateRangeFromText(value: unknown) {
  const matches = cleanText(value, 500).match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}/g) ?? [];
  return { start: normalizeDate(matches[0]), end: normalizeDate(matches[1]) };
}

function importPeriod(fileName: string, sheetName: string) {
  const year = Number(fileName.match(/20\d{2}/)?.[0] ?? new Date().getUTCFullYear());
  const month = Number(sheetName.match(/^T0?(\d{1,2})$/i)?.[1] ?? 0) || null;
  return { year, month };
}

async function reconciliation(DB: D1Database) {
  const [people, contracts, organizations, qualifications, training, commitments, documents, openConflicts, unlinkedContracts, brokenContracts, brokenTraining, brokenCommitments, brokenDocuments, duplicateCodes] = await Promise.all([
    DB.prepare("SELECT COUNT(*) AS count FROM people WHERE deleted_at IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM contracts WHERE deleted_at IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM organizations WHERE deleted_at IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM qualifications WHERE deleted_at IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM training_records WHERE deleted_at IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM training_commitments WHERE deleted_at IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM document_records WHERE deleted_at IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM sync_conflicts WHERE status = 'open'").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM contracts WHERE person_id IS NULL AND deleted_at IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM contracts c LEFT JOIN people p ON p.id = c.person_id WHERE c.person_id IS NOT NULL AND p.id IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM training_records t LEFT JOIN people p ON p.id = t.person_id WHERE p.id IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM training_commitments c LEFT JOIN people p ON p.id = c.person_id WHERE p.id IS NULL").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM document_records d WHERE d.deleted_at IS NULL AND ((d.owner_entity_type = 'person' AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id = d.owner_entity_id AND p.deleted_at IS NULL)) OR (d.owner_entity_type = 'contract' AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.id = d.owner_entity_id AND c.deleted_at IS NULL)) OR (d.owner_entity_type = 'organization' AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = d.owner_entity_id AND o.deleted_at IS NULL)) OR (d.owner_entity_type = 'employment_event' AND NOT EXISTS (SELECT 1 FROM employment_events e WHERE e.id = d.owner_entity_id AND e.deleted_at IS NULL)) OR (d.owner_entity_type = 'qualification' AND NOT EXISTS (SELECT 1 FROM qualifications q WHERE q.id = d.owner_entity_id AND q.deleted_at IS NULL)))").first<{ count: number }>(),
    DB.prepare("SELECT COUNT(*) AS count FROM (SELECT staff_code FROM people WHERE staff_code IS NOT NULL AND deleted_at IS NULL GROUP BY staff_code HAVING COUNT(*) > 1)").first<{ count: number }>(),
  ]);
  const counts = {
    people: Number(people?.count ?? 0),
    contracts: Number(contracts?.count ?? 0),
    organizations: Number(organizations?.count ?? 0),
    qualifications: Number(qualifications?.count ?? 0),
    training: Number(training?.count ?? 0),
    commitments: Number(commitments?.count ?? 0),
    documents: Number(documents?.count ?? 0),
    openConflicts: Number(openConflicts?.count ?? 0),
    unlinkedContracts: Number(unlinkedContracts?.count ?? 0),
    brokenContractLinks: Number(brokenContracts?.count ?? 0),
    brokenTrainingLinks: Number(brokenTraining?.count ?? 0),
    brokenCommitmentLinks: Number(brokenCommitments?.count ?? 0),
    brokenDocumentLinks: Number(brokenDocuments?.count ?? 0),
    duplicateStaffCodes: Number(duplicateCodes?.count ?? 0),
  };
  const checksumRows = await DB.prepare(
    "SELECT 'person' AS kind, id, version, COALESCE(checksum, '') AS checksum FROM people WHERE deleted_at IS NULL UNION ALL SELECT 'contract' AS kind, id, version, COALESCE(checksum, '') AS checksum FROM contracts WHERE deleted_at IS NULL UNION ALL SELECT 'training' AS kind, id, version, COALESCE(checksum, '') AS checksum FROM training_records WHERE deleted_at IS NULL UNION ALL SELECT 'commitment' AS kind, id, version, COALESCE(checksum, '') AS checksum FROM training_commitments WHERE deleted_at IS NULL UNION ALL SELECT 'document' AS kind, id, version, COALESCE(checksum, '') AS checksum FROM document_records WHERE deleted_at IS NULL ORDER BY kind, id",
  ).all<{ kind: string; id: string; version: number; checksum: string }>();
  const checksum = await sha256Text(stableStringify(checksumRows.results ?? []));
  return { counts, checksum, passed: counts.brokenContractLinks === 0 && counts.brokenTrainingLinks === 0 && counts.brokenCommitmentLinks === 0 && counts.brokenDocumentLinks === 0 && counts.duplicateStaffCodes === 0 };
}

type DerivedAlert = {
  dedupKey: string;
  severity: "urgent" | "warning" | "info";
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  organizationId?: string | null;
  dueDate?: string | null;
};

function daysUntil(date: string) {
  return Math.ceil((Date.parse(`${date}T00:00:00Z`) - Date.now()) / 86_400_000);
}

function dueAlertTitle(label: string, days: number) {
  if (days < 0) return `${label} đã quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return `${label} đến hạn hôm nay`;
  const threshold = [7, 15, 30, 60, 90].find((value) => days <= value) ?? 90;
  return `${label} đến hạn trong ${threshold} ngày`;
}

async function refreshDerivedAlerts(DB: D1Database) {
  const [contracts, training, commitments, assignments] = await Promise.all([
    DB.prepare("SELECT id, contract_number AS contractNumber, contract_type AS contractType, source_person_name AS fullName, effective_date AS effectiveDate, start_date AS startDate, end_date AS endDate, duration_months AS durationMonths, terminated_date AS terminatedDate, using_organization_id AS organizationId FROM contracts WHERE deleted_at IS NULL")
      .all<{ id: string; contractNumber: string | null; contractType: string; fullName: string; effectiveDate: string | null; startDate: string | null; endDate: string | null; durationMonths: number | null; terminatedDate: string | null; organizationId: string | null }>(),
    DB.prepare("SELECT t.id, t.training_type AS trainingType, t.end_date AS endDate, t.status, p.full_name AS fullName FROM training_records t JOIN people p ON p.id = t.person_id WHERE t.deleted_at IS NULL")
      .all<{ id: string; trainingType: string; endDate: string | null; status: string; fullName: string }>(),
    DB.prepare("SELECT c.id, c.decision_number AS decisionNumber, c.due_date AS dueDate, c.status, p.full_name AS fullName FROM training_commitments c JOIN people p ON p.id = c.person_id WHERE c.deleted_at IS NULL")
      .all<{ id: string; decisionNumber: string | null; dueDate: string | null; status: string; fullName: string }>(),
    DB.prepare("SELECT a.id, a.title, a.assignment_type AS assignmentType, a.end_date AS endDate, a.status, a.organization_id AS organizationId, p.full_name AS fullName FROM person_assignments a JOIN people p ON p.id = a.person_id WHERE a.deleted_at IS NULL")
      .all<{ id: string; title: string | null; assignmentType: string; endDate: string | null; status: string; organizationId: string | null; fullName: string }>(),
  ]);

  const alerts = new Map<string, DerivedAlert>();
  const add = (alert: DerivedAlert) => alerts.set(alert.dedupKey, alert);
  const inactiveStatus = (status: string) => {
    const normalized = normalizeName(status).replace(/[^a-z0-9]+/g, " ").trim();
    return ["da hoan thanh", "mien khong ap dung", "da ket thuc", "da thanh ly", "huy"].includes(normalized);
  };

  for (const item of contracts.results ?? []) {
    const number = item.contractNumber?.trim() || "Chưa có số hợp đồng";
    if (!item.contractNumber?.trim()) {
      add({ dedupKey: `contract-missing-number:${item.id}`, severity: "warning", entityType: "contract", entityId: item.id, title: "Hợp đồng thiếu số", message: `${number} · ${item.fullName}`, organizationId: item.organizationId });
    }
    const normalizedType = normalizeName(item.contractType);
    const indefinite = normalizedType.includes("kxdth") || normalizedType.includes("khong xac dinh");
    const fixedTerm = !indefinite && (normalizedType.includes("xdth") || normalizedType.includes("xac dinh thoi han"));
    if (fixedTerm && !item.endDate && !item.terminatedDate) {
      add({ dedupKey: `contract-missing-end:${item.id}`, severity: "urgent", entityType: "contract", entityId: item.id, title: "Hợp đồng xác định thời hạn thiếu ngày kết thúc", message: `${number} · ${item.fullName}`, organizationId: item.organizationId });
    }
    const referenceStart = item.effectiveDate ?? item.startDate;
    if (item.endDate && referenceStart && item.endDate < referenceStart) {
      add({ dedupKey: `contract-invalid-range:${item.id}:${item.endDate}`, severity: "urgent", entityType: "contract", entityId: item.id, title: "Mốc ngày hợp đồng không hợp lệ", message: `${number} · Ngày kết thúc trước ngày bắt đầu/hiệu lực`, organizationId: item.organizationId, dueDate: item.endDate });
    }
    if (item.endDate && referenceStart && item.durationMonths && item.durationMonths > 0) {
      const actualDays = Math.round((Date.parse(`${item.endDate}T00:00:00Z`) - Date.parse(`${referenceStart}T00:00:00Z`)) / 86_400_000);
      const expectedDays = item.durationMonths * 30.4375;
      if (Math.abs(actualDays - expectedDays) > 45) {
        add({ dedupKey: `contract-duration-mismatch:${item.id}:${item.endDate}`, severity: "warning", entityType: "contract", entityId: item.id, title: "Thời lượng hợp đồng cần đối chiếu", message: `${number} · Số tháng không khớp khoảng ngày`, organizationId: item.organizationId, dueDate: item.endDate });
      }
    }
    if (item.endDate && !item.terminatedDate) {
      const days = daysUntil(item.endDate);
      if (days <= 90) add({ dedupKey: `contract-due:${item.id}:${item.endDate}`, severity: days <= 15 ? "urgent" : "warning", entityType: "contract", entityId: item.id, title: dueAlertTitle("Hợp đồng", days), message: `${number} · ${item.fullName}`, organizationId: item.organizationId, dueDate: item.endDate });
    }
  }

  for (const item of training.results ?? []) {
    if (!item.endDate || inactiveStatus(item.status)) continue;
    const days = daysUntil(item.endDate);
    if (days <= 90) add({ dedupKey: `training-due:${item.id}:${item.endDate}`, severity: days <= 15 ? "urgent" : "warning", entityType: "training", entityId: item.id, title: dueAlertTitle("Mốc đào tạo", days), message: `${item.trainingType} · ${item.fullName}`, dueDate: item.endDate });
  }

  for (const item of commitments.results ?? []) {
    if (!item.dueDate || inactiveStatus(item.status)) continue;
    const days = daysUntil(item.dueDate);
    if (days <= 90) add({ dedupKey: `commitment-due:${item.id}:${item.dueDate}`, severity: days <= 15 ? "urgent" : "warning", entityType: "commitment", entityId: item.id, title: dueAlertTitle("Cam kết đào tạo", days), message: `${item.decisionNumber ?? "Chưa có số quyết định"} · ${item.fullName}`, dueDate: item.dueDate });
  }

  for (const item of assignments.results ?? []) {
    if (!item.endDate || inactiveStatus(item.status)) continue;
    const days = daysUntil(item.endDate);
    if (days <= 90) add({ dedupKey: `assignment-due:${item.id}:${item.endDate}`, severity: days <= 15 ? "urgent" : "warning", entityType: "assignment", entityId: item.id, title: dueAlertTitle("Nhiệm kỳ/phân công", days), message: `${item.title || item.assignmentType} · ${item.fullName}`, organizationId: item.organizationId, dueDate: item.endDate });
  }

  const prefixes = ["contract-due:", "contract-expiry:", "contract-missing-number:", "contract-missing-end:", "contract-invalid-range:", "contract-duration-mismatch:", "training-due:", "commitment-due:", "assignment-due:"];
  const existing = await DB.prepare(`SELECT id, dedup_key AS dedupKey, status FROM alerts WHERE ${prefixes.map(() => "dedup_key LIKE ?").join(" OR ")}`)
    .bind(...prefixes.map((prefix) => `${prefix}%`)).all<{ id: string; dedupKey: string; status: string }>();
  const statements: D1PreparedStatement[] = [];
  for (const item of existing.results ?? []) {
    if (!alerts.has(item.dedupKey) && item.status !== "resolved") {
      statements.push(DB.prepare("UPDATE alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(item.id));
    }
  }
  for (const alert of alerts.values()) {
    statements.push(DB.prepare("INSERT INTO alerts (id, dedup_key, severity, entity_type, entity_id, title, message, organization_id, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unread') ON CONFLICT(dedup_key) DO UPDATE SET severity = excluded.severity, entity_type = excluded.entity_type, entity_id = excluded.entity_id, title = excluded.title, message = excluded.message, organization_id = excluded.organization_id, due_date = excluded.due_date, updated_at = CURRENT_TIMESTAMP")
      .bind(crypto.randomUUID(), alert.dedupKey, alert.severity, alert.entityType, alert.entityId, alert.title, alert.message, alert.organizationId ?? null, alert.dueDate ?? null));
  }
  await runBatches(DB, statements);
}

async function getResource(request: Request, actor: Actor) {
  const { DB } = getBindings();
  requirePermission(actor, "view");
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") ?? "dashboard";
  const limit = safeLimit(url.searchParams.get("limit"));
  const offset = safeOffset(url.searchParams.get("offset"));
  const query = cleanText(url.searchParams.get("q"), 200);

  const v2Resource = await getV2Resource(request, actor);
  if (v2Resource) return v2Resource;

  if (resource === "dashboard" || resource === "alerts") await refreshDerivedAlerts(DB);

  if (resource === "dashboard") {
    const [reconcile, activeContracts, expiring, expired, missingContractNumber, importCount] = await Promise.all([
      reconciliation(DB),
      DB.prepare("SELECT COUNT(*) AS count FROM contracts WHERE deleted_at IS NULL AND terminated_date IS NULL AND (end_date IS NULL OR end_date >= date('now'))").first<{ count: number }>(),
      DB.prepare("SELECT COUNT(*) AS count FROM contracts WHERE deleted_at IS NULL AND terminated_date IS NULL AND end_date BETWEEN date('now') AND date('now', '+90 day')").first<{ count: number }>(),
      DB.prepare("SELECT COUNT(*) AS count FROM contracts WHERE deleted_at IS NULL AND terminated_date IS NULL AND end_date < date('now')").first<{ count: number }>(),
      DB.prepare("SELECT COUNT(*) AS count FROM contracts WHERE deleted_at IS NULL AND (contract_number IS NULL OR trim(contract_number) = '')").first<{ count: number }>(),
      DB.prepare("SELECT COUNT(*) AS count FROM source_imports WHERE status = 'completed'").first<{ count: number }>(),
    ]);
    return json({
      actor: { email: actor.email, role: actor.role, organizationScope: actor.organizationScope },
      ...reconcile,
      activeContracts: Number(activeContracts?.count ?? 0),
      expiring90: Number(expiring?.count ?? 0),
      expiredContracts: Number(expired?.count ?? 0),
      missingContractNumber: Number(missingContractNumber?.count ?? 0),
      completedImports: Number(importCount?.count ?? 0),
    });
  }

  if (resource === "people") {
    const search = `%${escapeLike(query)}%`;
    const sensitive = hasPermission(actor, "view_sensitive");
    const scope = actorScopeSql(actor, "p.organization_id");
    const rows = await DB.prepare(
      `SELECT p.id, p.staff_code AS staffCode, p.lecturer_code AS lecturerCode, p.person_type AS personType,
        p.full_name AS fullName, p.birth_date AS birthDate, p.gender, p.organization_id AS organizationId,
        p.organization_name_source AS organization, p.department, p.position, p.professional_title AS professionalTitle,
        p.employment_status AS employmentStatus, ${sensitive ? "p.phone" : "NULL AS phone"},
        ${sensitive ? "p.work_email AS workEmail, p.personal_email AS personalEmail, p.identity_number AS identityNumber, p.tax_code AS taxCode, p.social_insurance_number AS socialInsuranceNumber, p.home_town AS homeTown, p.address, p.specialization, p.work_arrangement AS workArrangement" : "NULL AS workEmail, NULL AS personalEmail, NULL AS identityNumber, NULL AS taxCode, NULL AS socialInsuranceNumber, NULL AS homeTown, NULL AS address, NULL AS specialization, NULL AS workArrangement"},
        p.notes, p.version, p.sync_state AS syncState, p.updated_by AS updatedBy, p.updated_at AS updatedAt,
        (SELECT q.degree_level FROM qualifications q WHERE q.person_id = p.id AND q.deleted_at IS NULL ORDER BY q.updated_at DESC LIMIT 1) AS degree
       FROM people p
       WHERE p.deleted_at IS NULL AND ${scope.clause} AND (? = '' OR p.full_name LIKE ? ESCAPE '\\' OR COALESCE(p.staff_code, '') LIKE ? ESCAPE '\\' OR COALESCE(p.lecturer_code, '') LIKE ? ESCAPE '\\' OR COALESCE(p.organization_name_source, '') LIKE ? ESCAPE '\\' OR COALESCE(p.work_email, '') LIKE ? ESCAPE '\\')
       ORDER BY p.full_name COLLATE NOCASE, p.id LIMIT ? OFFSET ?`,
    ).bind(...scope.args, query, search, search, search, search, search, limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "contracts") {
    const search = `%${escapeLike(query)}%`;
    const scope = actorScopeSql(actor, "c.using_organization_id");
    const rows = await DB.prepare(
      `SELECT c.id, c.contract_number AS contractNumber, c.contract_type AS contractType, c.source_person_name AS fullName,
        c.source_birth_date AS birthDate, c.signer, c.signing_organization AS signingOrganization,
        c.using_organization_id AS organizationId, c.using_organization_source AS organization,
        c.role_or_specialty AS roleOrSpecialty, c.salary_coefficient AS salaryCoefficient, c.signed_date AS signedDate,
        c.effective_date AS effectiveDate, c.start_date AS startDate, c.end_date AS endDate, c.duration_months AS durationMonths,
        c.period_text AS periodText, c.status, c.terminated_date AS terminatedDate, c.termination_reason AS terminationReason, c.notes,
        c.person_id AS personId, c.version, c.sync_state AS syncState, c.updated_by AS updatedBy, c.updated_at AS updatedAt
       FROM contracts c WHERE c.deleted_at IS NULL AND ${scope.clause} AND (? = '' OR c.source_person_name LIKE ? ESCAPE '\\' OR COALESCE(c.contract_number, '') LIKE ? ESCAPE '\\' OR COALESCE(c.using_organization_source, '') LIKE ? ESCAPE '\\')
       ORDER BY CASE WHEN c.end_date IS NULL THEN 1 ELSE 0 END, c.end_date, c.id LIMIT ? OFFSET ?`,
    ).bind(...scope.args, query, search, search, search, limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "organizations") {
    const scope = actorScopeSql(actor, "id");
    const rows = await DB.prepare(`SELECT id, code, name, short_name AS shortName, level, parent_id AS parentId, status, version, updated_at AS updatedAt FROM organizations WHERE deleted_at IS NULL AND ${scope.clause} ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`)
      .bind(...scope.args, limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "assignments") {
    const scope = actorScopeSql(actor, "p.organization_id");
    const rows = await DB.prepare(`SELECT a.id, p.staff_code AS staffCode, p.full_name AS fullName, o.code AS organizationCode, o.name AS organization, a.assignment_type AS assignmentType, a.title, a.start_date AS startDate, a.end_date AS endDate, a.status, a.decision_number AS decisionNumber, a.notes, a.version, a.updated_at AS updatedAt FROM person_assignments a JOIN people p ON p.id = a.person_id LEFT JOIN organizations o ON o.id = a.organization_id WHERE a.deleted_at IS NULL AND ${scope.clause} ORDER BY COALESCE(a.end_date, '9999-12-31'), p.full_name COLLATE NOCASE LIMIT ? OFFSET ?`)
      .bind(...scope.args, limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "training") {
    const scope = actorScopeSql(actor, "p.organization_id");
    const rows = await DB.prepare(`SELECT t.id, p.staff_code AS staffCode, p.full_name AS fullName, t.training_type AS trainingType, t.program_name AS programName, t.degree_level AS degree, t.major, t.institution, t.country, t.country_scope AS countryScope, t.status, t.start_date AS startDate, t.end_date AS endDate, t.decision_number AS decisionNumber, t.version, t.updated_at AS updatedAt FROM training_records t JOIN people p ON p.id = t.person_id WHERE t.deleted_at IS NULL AND ${scope.clause} ORDER BY COALESCE(t.end_date, '9999-12-31'), p.full_name COLLATE NOCASE LIMIT ? OFFSET ?`)
      .bind(...scope.args, limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "commitments") {
    const scope = actorScopeSql(actor, "p.organization_id");
    const rows = await DB.prepare(`SELECT c.id, p.staff_code AS staffCode, p.full_name AS fullName, c.training_record_id AS relatedTrainingId, c.decision_number AS decisionNumber, c.amount, c.start_date AS startDate, c.due_date AS dueDate, c.status, c.completed_date AS completedDate, c.version, c.updated_at AS updatedAt FROM training_commitments c JOIN people p ON p.id = c.person_id WHERE c.deleted_at IS NULL AND ${scope.clause} ORDER BY COALESCE(c.due_date, '9999-12-31'), p.full_name COLLATE NOCASE LIMIT ? OFFSET ?`)
      .bind(...scope.args, limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "events") {
    const scope = actorScopeSql(actor, "p.organization_id");
    const rows = await DB.prepare(`SELECT e.id, p.staff_code AS staffCode, p.full_name AS fullName, e.event_type AS eventType, source.code AS fromOrganizationCode, target.code AS toOrganizationCode, e.effective_date AS effectiveDate, e.decision_number AS decisionNumber, e.reason, e.created_by AS createdBy, e.updated_at AS updatedAt FROM employment_events e JOIN people p ON p.id = e.person_id LEFT JOIN organizations source ON source.id = e.from_organization_id LEFT JOIN organizations target ON target.id = e.to_organization_id WHERE e.deleted_at IS NULL AND ${scope.clause} ORDER BY e.effective_date DESC, e.id DESC LIMIT ? OFFSET ?`)
      .bind(...scope.args, limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "documents") {
    const rows = await DB.prepare("SELECT id, owner_entity_type AS ownerEntityType, owner_entity_id AS ownerEntityId, file_type AS fileType, file_name AS fileName, document_number AS documentNumber, document_date AS documentDate, document_version AS documentVersion, notes, version, sync_state AS syncState, updated_at AS updatedAt FROM document_records WHERE deleted_at IS NULL ORDER BY COALESCE(document_date, created_at) DESC, id DESC LIMIT ? OFFSET ?")
      .bind(limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "imports") {
    const rows = await DB.prepare("SELECT id, file_name AS fileName, substr(file_checksum, 1, 12) AS checksumPrefix, sheet_name AS sheetName, header_row AS headerRow, mode, status, total_rows AS totalRows, inserted_rows AS insertedRows, updated_rows AS updatedRows, duplicate_rows AS duplicateRows, skipped_rows AS skippedRows, error_rows AS errorRows, imported_by AS importedBy, completed_at AS completedAt, created_at AS createdAt FROM source_imports ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .bind(limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "alerts") {
    const rows = await DB.prepare("SELECT id, severity, entity_type AS entityType, entity_id AS entityId, title, message, due_date AS dueDate, assignee_user_id AS assigneeUserId, status, snoozed_until AS snoozedUntil, resolved_at AS resolvedAt, created_at AS createdAt FROM alerts ORDER BY CASE WHEN status = 'resolved' THEN 1 ELSE 0 END, CASE severity WHEN 'urgent' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, COALESCE(due_date, '9999-12-31'), created_at DESC LIMIT ? OFFSET ?")
      .bind(limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "audit") {
    const rows = await DB.prepare("SELECT id, actor_email AS actorEmail, action, entity_type AS entityType, entity_id AS entityId, changed_fields AS changedFields, reason, request_id AS requestId, created_at AS createdAt FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?")
      .bind(limit, offset).all();
    return json({ rows: rows.results ?? [], limit, offset });
  }

  if (resource === "reconcile") return json(await reconciliation(DB));

  if (resource === "backup") {
    requirePermission(actor, "restore");
    const tables = ["organizations", "people", "qualifications", "training_records", "training_commitments", "person_assignments", "employment_events", "organization_history", "contracts", "document_records", "alerts", "source_imports", "import_errors", "mapping_templates", "snapshots", "sync_conflicts", "positions", "academic_years", "system_settings"];
    const backup: Record<string, unknown> = { format: "ued-organization-backup", version: 3, createdAt: new Date().toISOString(), createdBy: actor.email, excludes: ["user_roles", "file_records", "audit_logs", "idempotency_keys", "r2_file_bytes"] };
    for (const table of tables) backup[table] = (await DB.prepare(`SELECT * FROM ${table}`).all()).results ?? [];
    const bodyWithoutChecksum = stableStringify(backup);
    const checksum = await sha256Text(bodyWithoutChecksum);
    const body = JSON.stringify({ ...backup, checksum }, null, 2);
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="UED-sao-luu-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  }

  return json({ error: `Tài nguyên “${resource}” không tồn tại.` }, { status: 404 });
}

async function upsertPerson(DB: D1Database, actor: Actor, body: Record<string, unknown>, requestId: string) {
  requirePermission(actor, "write");
  const record = (body.record ?? {}) as DataRecord;
  const fullName = cleanText(record.fullName, 300);
  if (!fullName) return json({ error: "Họ và tên là trường bắt buộc." }, { status: 400 });
  const staffCode = cleanText(record.staffCode, 100) || null;
  const birthDate = normalizeDate(record.birthDate);
  if (record.birthDate && !birthDate) return json({ error: "Ngày sinh không hợp lệ. Dùng định dạng DD/MM/YYYY hoặc YYYY-MM-DD." }, { status: 400 });
  const startDate = normalizeDate(record.startDate);
  if (record.startDate && !startDate) return json({ error: "Ngày bắt đầu công tác không hợp lệ." }, { status: 400 });
  const id = cleanText(record.id, 100) || crypto.randomUUID();
  const current = await DB.prepare("SELECT id, staff_code AS staffCode, full_name AS fullName, birth_date AS birthDate, organization_name_source AS organization, position, professional_title AS professionalTitle, employment_status AS employmentStatus, version FROM people WHERE id = ? OR (? IS NOT NULL AND staff_code = ?) LIMIT 1")
    .bind(id, staffCode, staffCode).first<Record<string, unknown>>();
  const baseVersion = Number(record.version ?? current?.version ?? 0);
  if (current && Number(current.version) !== baseVersion) {
    const conflictId = crypto.randomUUID();
    await DB.prepare("INSERT INTO sync_conflicts (id, entity_type, entity_id, base_version, server_version, local_json, server_json, status) VALUES (?, 'person', ?, ?, ?, ?, ?, 'open')")
      .bind(conflictId, String(current.id), baseVersion, Number(current.version), jsonForStorage(record), jsonForStorage(current)).run();
    return json({ error: "Hồ sơ đã được sửa ở nơi khác. Xung đột đã được giữ lại để xử lý.", conflictId, server: current }, { status: 409 });
  }

  const organizations = await DB.prepare("SELECT id, name FROM organizations WHERE deleted_at IS NULL").all<{ id: string; name: string }>();
  const orgMap = new Map((organizations.results ?? []).map((item) => [normalizeName(item.name), item]));
  const orgStatements = new Map<string, D1PreparedStatement>();
  const organizationName = cleanText(record.unit ?? record.organization, 300);
  const organizationId = await organizationFor(DB, organizationName, orgMap, orgStatements);
  const canonical = {
    id: current?.id ?? id,
    staffCode,
    fullName,
    normalizedName: normalizeName(fullName),
    birthDate,
    gender: cleanText(record.gender, 30) || null,
    organizationId,
    organizationNameSource: organizationName || null,
    department: cleanText(record.department, 300) || null,
    position: cleanText(record.position, 300) || null,
    professionalTitle: cleanText(record.professionalTitle, 300) || null,
    employmentStatus: cleanText(record.status ?? record.employmentStatus, 100) || "đang công tác",
    startDate,
    phone: cleanText(record.phone, 60) || null,
    workEmail: cleanText(record.workEmail, 300).toLowerCase() || null,
    personalEmail: cleanText(record.personalEmail, 300).toLowerCase() || null,
    address: cleanText(record.address, 1_000) || null,
    notes: cleanText(record.notes, 5_000) || null,
  };
  const checksum = await recordChecksum(canonical);
  const statements = [...orgStatements.values()];
  if (canonical.workEmail) {
    const emailOwner = await DB.prepare("SELECT id FROM people WHERE work_email = ? AND deleted_at IS NULL LIMIT 1").bind(canonical.workEmail).first<{ id: string }>();
    if (emailOwner && emailOwner.id !== String(current?.id ?? id)) return json({ error: "Email công vụ đã được dùng bởi một hồ sơ khác." }, { status: 409 });
  }
  if (current) {
    statements.push(DB.prepare("UPDATE people SET staff_code = ?, full_name = ?, normalized_name = ?, birth_date = ?, gender = ?, organization_id = ?, organization_name_source = ?, department = ?, position = ?, professional_title = ?, employment_status = ?, start_date = ?, phone = ?, work_email = ?, personal_email = ?, address = ?, notes = ?, checksum = ?, version = version + 1, sync_state = 'synced', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(staffCode, fullName, canonical.normalizedName, birthDate, canonical.gender, organizationId, canonical.organizationNameSource, canonical.department, canonical.position, canonical.professionalTitle, canonical.employmentStatus, canonical.startDate, canonical.phone, canonical.workEmail, canonical.personalEmail, canonical.address, canonical.notes, checksum, current.id));
  } else {
    statements.push(DB.prepare("INSERT INTO people (id, staff_code, full_name, normalized_name, birth_date, gender, organization_id, organization_name_source, department, position, professional_title, employment_status, start_date, phone, work_email, personal_email, address, notes, checksum, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced')")
      .bind(id, staffCode, fullName, canonical.normalizedName, birthDate, canonical.gender, organizationId, canonical.organizationNameSource, canonical.department, canonical.position, canonical.professionalTitle, canonical.employmentStatus, canonical.startDate, canonical.phone, canonical.workEmail, canonical.personalEmail, canonical.address, canonical.notes, checksum));
  }
  if (cleanText(record.degree, 100) || cleanText(record.academicTitle, 100) || cleanText(record.major, 500)) {
    const qualificationId = `qual-manual-${(await sha256Text(String(canonical.id))).slice(0, 24)}`;
    const qualification = {
      id: qualificationId,
      personId: canonical.id,
      academicTitle: cleanText(record.academicTitle, 100) || null,
      degreeLevel: cleanText(record.degree, 100) || null,
      degreeYear: Number(record.degreeYear) || null,
      major: cleanText(record.major, 500) || null,
      disciplineGroup: cleanText(record.disciplineGroup, 200) || null,
      institution: cleanText(record.institution, 500) || null,
      country: cleanText(record.country, 300) || null,
      foreignLanguage: cleanText(record.foreignLanguage, 500) || null,
      informatics: cleanText(record.informatics, 500) || null,
      phdStatus: cleanText(record.phdStatus, 2_000) || null,
    };
    statements.push(DB.prepare("INSERT INTO qualifications (id, person_id, academic_title, degree_level, degree_year, major, discipline_group, institution, country, foreign_language, informatics, phd_status, checksum, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced') ON CONFLICT(id) DO UPDATE SET academic_title = excluded.academic_title, degree_level = excluded.degree_level, degree_year = excluded.degree_year, major = excluded.major, discipline_group = excluded.discipline_group, institution = excluded.institution, country = excluded.country, foreign_language = excluded.foreign_language, informatics = excluded.informatics, phd_status = excluded.phd_status, checksum = excluded.checksum, sync_state = 'synced', version = qualifications.version + 1, updated_at = CURRENT_TIMESTAMP")
      .bind(qualificationId, canonical.id, qualification.academicTitle, qualification.degreeLevel, qualification.degreeYear, qualification.major, qualification.disciplineGroup, qualification.institution, qualification.country, qualification.foreignLanguage, qualification.informatics, qualification.phdStatus, await recordChecksum(qualification)));
  }
  statements.push(actorAudit(DB, actor, current ? "update" : "create", "person", String(canonical.id), current, canonical, cleanText(body.reason, 500), requestId));
  await runBatches(DB, statements);
  return json({ person: canonical, version: Number(current?.version ?? 0) + 1, checksum }, { status: current ? 200 : 201 });
}

async function bulkImport(DB: D1Database, actor: Actor, body: Record<string, unknown>, requestId: string) {
  requirePermission(actor, "import");
  const requestedEntityType = cleanText(body.entityType, 50) as ImportEntityType;
  const supportedEntityTypes = new Set<ImportEntityType>(["people", "organizations", "assignments", "contracts", "training", "commitments", "events", "documents"]);
  const entityType = supportedEntityTypes.has(requestedEntityType) ? requestedEntityType : null;
  const mode = ["new", "update", "merge"].includes(String(body.mode)) ? String(body.mode) : null;
  const fileName = cleanText(body.fileName, 500);
  const fileChecksum = cleanText(body.fileChecksum, 128).toLowerCase();
  const sheetName = cleanText(body.sheetName, 300);
  const records = Array.isArray(body.records) ? (body.records as DataRecord[]) : [];
  if (!entityType || !mode || !fileName || !sheetName || !/^[a-f0-9]{64}$/.test(fileChecksum)) return json({ error: "Thiếu hoặc sai thông tin đợt nhập." }, { status: 400 });
  if (!records.length || records.length > 1_000) return json({ error: "Mỗi lô phải có từ 1 đến 1.000 dòng." }, { status: 400 });

  const prior = await DB.prepare("SELECT id, total_rows AS totalRows, inserted_rows AS insertedRows, updated_rows AS updatedRows, duplicate_rows AS duplicateRows, skipped_rows AS skippedRows, error_rows AS errorRows FROM source_imports WHERE file_checksum = ? AND sheet_name = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1")
    .bind(fileChecksum, sheetName).first<Record<string, unknown>>();
  if (prior && mode !== "update") return json({ duplicateImport: true, import: prior, message: "Tệp và sheet này đã được nhập hoàn tất; hệ thống không ghi lần hai." });

  const importId = crypto.randomUUID();
  await DB.prepare("INSERT INTO source_imports (id, file_name, file_checksum, file_size, sheet_name, header_row, mapping_version, mode, status, total_rows, imported_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'importing', ?, ?)")
    .bind(importId, fileName, fileChecksum, Number(body.fileSize) || null, sheetName, Number(body.headerRow ?? 1), cleanText(body.mappingVersion, 100) || "ued-map-v1", mode, records.length, actor.email).run();

  const issues: ImportIssue[] = [];
  const dataStatements: D1PreparedStatement[] = [];
  const organizationStatements = new Map<string, D1PreparedStatement>();
  const organizations = await DB.prepare("SELECT id, code, name FROM organizations WHERE deleted_at IS NULL").all<{ id: string; code: string; name: string }>();
  const organizationsByName = new Map((organizations.results ?? []).map((item) => [normalizeName(item.name), item]));
  const organizationsByCode = new Map((organizations.results ?? []).map((item) => [normalizeName(item.code), item]));
  const peopleQuery = await DB.prepare("SELECT id, staff_code AS staffCode, lecturer_code AS lecturerCode, full_name AS fullName, normalized_name AS normalizedName, birth_date AS birthDate, organization_id AS organizationId, organization_name_source AS organizationNameSource, position, professional_title AS professionalTitle, employment_status AS employmentStatus, phone, work_email AS workEmail, source_identity_key AS sourceIdentityKey, version FROM people WHERE deleted_at IS NULL").all<ExistingPerson>();
  const people = peopleQuery.results ?? [];
  const byPersonId = new Map(people.map((item) => [item.id, item]));
  const byStaffCode = new Map(people.filter((item) => item.staffCode).map((item) => [normalizeName(item.staffCode), item]));
  const byLecturerCode = new Map(people.filter((item) => item.lecturerCode).map((item) => [normalizeName(item.lecturerCode), item]));
  const byNameBirth = new Map<string, ExistingPerson[]>();
  const byName = new Map<string, ExistingPerson[]>();
  const byWorkEmail = new Map(people.filter((item) => item.workEmail).map((item) => [normalizeName(item.workEmail), item]));
  const byPhone = new Map<string, ExistingPerson[]>();
  people.forEach((person) => {
    const key = `${person.normalizedName}|${person.birthDate ?? ""}`;
    byNameBirth.set(key, [...(byNameBirth.get(key) ?? []), person]);
    byName.set(person.normalizedName, [...(byName.get(person.normalizedName) ?? []), person]);
    if (person.phone) byPhone.set(normalizeName(person.phone), [...(byPhone.get(normalizeName(person.phone)) ?? []), person]);
  });
  const contractQuery = await DB.prepare("SELECT id, source_identity_key AS sourceIdentityKey, contract_number AS contractNumber, version FROM contracts WHERE deleted_at IS NULL").all<ExistingContract>();
  const contractsByIdentity = new Map((contractQuery.results ?? []).map((item) => [item.sourceIdentityKey, item]));
  const contractsById = new Map((contractQuery.results ?? []).map((item) => [item.id, item]));
  const [assignmentRows, qualificationRows, trainingRows, commitmentRows, eventRows, documentRows] = await Promise.all([
    DB.prepare("SELECT id FROM person_assignments WHERE deleted_at IS NULL").all<{ id: string }>(),
    DB.prepare("SELECT id FROM qualifications WHERE deleted_at IS NULL").all<{ id: string }>(),
    DB.prepare("SELECT id FROM training_records WHERE deleted_at IS NULL").all<{ id: string }>(),
    DB.prepare("SELECT id FROM training_commitments WHERE deleted_at IS NULL").all<{ id: string }>(),
    DB.prepare("SELECT id FROM employment_events WHERE deleted_at IS NULL").all<{ id: string }>(),
    DB.prepare("SELECT id FROM document_records WHERE deleted_at IS NULL").all<{ id: string }>(),
  ]);
  const existingIds = {
    assignments: new Set((assignmentRows.results ?? []).map((item) => item.id)),
    qualifications: new Set((qualificationRows.results ?? []).map((item) => item.id)),
    training: new Set((trainingRows.results ?? []).map((item) => item.id)),
    commitments: new Set((commitmentRows.results ?? []).map((item) => item.id)),
    events: new Set((eventRows.results ?? []).map((item) => item.id)),
    documents: new Set((documentRows.results ?? []).map((item) => item.id)),
  };
  const seenBatchIdentity = new Set<string>();
  const seenGeneratedContractIds = new Set<string>();
  let inserted = 0;
  let updated = 0;
  let duplicates = 0;
  let skipped = 0;

  const resolveRelatedPerson = (input: DataRecord) => {
    const personId = cleanText(input.personId, 120);
    if (personId) return byPersonId.get(personId) ?? null;
    const staffCode = cleanText(input.staffCode, 100);
    if (staffCode) return byStaffCode.get(normalizeName(staffCode)) ?? null;
    const fullName = cleanText(input.fullName, 300);
    const birthDate = normalizeDate(input.birthDate);
    if (!fullName || !birthDate) return null;
    const candidates = byNameBirth.get(`${normalizeName(fullName)}|${birthDate}`) ?? [];
    return candidates.length === 1 ? candidates[0] : null;
  };

  const checkGenericMode = (exists: boolean, row: number, field: string, id: string) => {
    if (exists && mode === "new") {
      duplicates += 1;
      issues.push({ row, field, code: "DUPLICATE_STABLE_ID", severity: "warning", value: id, message: "Mã định danh đã tồn tại; chế độ nhập mới không ghi đè.", fix: "Dùng chế độ cập nhật/gộp sau khi xác minh đúng mã." });
      return false;
    }
    if (!exists && mode === "update") {
      skipped += 1;
      issues.push({ row, field, code: "UPDATE_TARGET_NOT_FOUND", severity: "error", value: id, message: "Không tìm thấy bản ghi đích theo mã định danh.", fix: "Kiểm tra mã hoặc chuyển sang chế độ gộp." });
      return false;
    }
    return true;
  };

  const checkedDate = (input: DataRecord, field: string, row: number, required = false) => {
    const raw = cleanText(input[field], 60);
    if (!raw) {
      if (required) issues.push({ row, field, code: "REQUIRED_DATE", severity: "error", message: "Thiếu ngày bắt buộc.", fix: "Bổ sung theo định dạng YYYY-MM-DD hoặc bỏ qua dòng." });
      return { value: null, invalid: required };
    }
    const value = normalizeDate(raw);
    if (!value) issues.push({ row, field, code: "INVALID_DATE", severity: "error", value: raw, message: "Ngày không hợp lệ.", fix: "Dùng DD/MM/YYYY hoặc YYYY-MM-DD; không tự suy đoán ngày." });
    return { value, invalid: !value };
  };

  const generatedId = async (prefix: string, requested: unknown, row: number) => {
    const provided = cleanText(requested, 120);
    if (provided) return provided;
    const hash = await sha256Text(`${prefix}|${fileChecksum}|${sheetName}|${row}`);
    return `${prefix}-${hash.slice(0, 28)}`;
  };

  const resolveOrganization = async (input: DataRecord, row: number) => {
    const code = cleanText(input.organizationCode, 100);
    const sourceName = cleanText(input.organization ?? input.organizationName, 300);
    if (code) {
      const existing = organizationsByCode.get(normalizeName(code));
      if (existing) return { id: existing.id, sourceName: sourceName || existing.name, invalid: false };
      if (!sourceName) {
        issues.push({ row, field: "organizationCode", code: "UNKNOWN_ORGANIZATION_CODE", severity: "error", value: code, message: "Mã đơn vị chưa tồn tại và dòng không có tên đơn vị để tạo có kiểm tra.", fix: "Nhập sheet đơn vị trước hoặc bổ sung tên đơn vị nguồn." });
        return { id: null, sourceName: "", invalid: true };
      }
      const id = await generatedId("org", code, row);
      organizationStatements.set(id, DB.prepare("INSERT INTO organizations (id, code, name, status, source_file, source_sheet, source_row, version, sync_state) VALUES (?, ?, ?, 'Hoạt động', ?, ?, ?, 1, 'synced') ON CONFLICT(code) DO UPDATE SET name = excluded.name, source_file = excluded.source_file, source_sheet = excluded.source_sheet, source_row = excluded.source_row, version = organizations.version + 1, sync_state = 'synced', updated_at = CURRENT_TIMESTAMP")
        .bind(id, code, sourceName, fileName, sheetName, row));
      const created = { id, code, name: sourceName };
      organizationsByCode.set(normalizeName(code), created);
      organizationsByName.set(normalizeName(sourceName), created);
      return { id, sourceName, invalid: false };
    }
    const id = await organizationFor(DB, sourceName, organizationsByName, organizationStatements);
    return { id, sourceName, invalid: false };
  };

  for (const [recordIndex, input] of records.entries()) {
    const sourceRow = Number(input.sourceRow ?? recordIndex + 1);

    if (entityType === "organizations") {
      const code = cleanText(input.organizationCode, 100);
      const name = cleanText(input.organizationName ?? input.organization, 300);
      if (!code || !name) {
        issues.push({ row: sourceRow, field: !code ? "organizationCode" : "organizationName", code: "REQUIRED_ORGANIZATION", severity: "error", message: "Thiếu mã hoặc tên chính thức của đơn vị.", fix: "Bổ sung cả mã đơn vị và tên chính thức." });
        skipped += 1;
        continue;
      }
      const existing = organizationsByCode.get(normalizeName(code));
      if (!checkGenericMode(Boolean(existing), sourceRow, "organizationCode", code)) continue;
      const parentCode = cleanText(input.parentOrganizationCode, 100);
      const parentId = parentCode ? organizationsByCode.get(normalizeName(parentCode))?.id ?? null : null;
      if (parentCode && !parentId) issues.push({ row: sourceRow, field: "parentOrganizationCode", code: "UNKNOWN_PARENT_ORGANIZATION", severity: "warning", value: parentCode, message: "Chưa tìm thấy đơn vị cha trong danh mục hiện tại.", fix: "Nhập đơn vị cha trước hoặc xác minh lại mã." });
      const managerCode = cleanText(input.managerStaffCode, 100);
      const managerPersonId = managerCode ? byStaffCode.get(normalizeName(managerCode))?.id ?? null : null;
      if (managerCode && !managerPersonId) issues.push({ row: sourceRow, field: "managerStaffCode", code: "UNKNOWN_MANAGER", severity: "warning", value: managerCode, message: "Chưa tìm thấy mã người phụ trách.", fix: "Nhập hồ sơ cán bộ trước hoặc xác minh mã." });
      const effective = checkedDate(input, "effectiveDate", sourceRow, false);
      if (effective.invalid) { skipped += 1; continue; }
      const id = existing?.id ?? await generatedId("org", code, sourceRow);
      const status = cleanText(input.organizationStatus, 100) || "Hoạt động";
      const canonical = { id, code, name, shortName: cleanText(input.shortName, 100) || null, level: cleanText(input.organizationLevel, 100) || "Đơn vị", parentId, managerPersonId, status };
      const checksum = await recordChecksum(canonical);
      if (existing) {
        dataStatements.push(DB.prepare("UPDATE organizations SET code = ?, name = ?, short_name = ?, level = ?, parent_id = ?, manager_person_id = ?, status = ?, source_file = ?, source_sheet = ?, source_row = ?, raw_data = ?, checksum = ?, version = version + 1, sync_state = 'synced', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(code, name, canonical.shortName, canonical.level, parentId, managerPersonId, status, fileName, sheetName, sourceRow, jsonForStorage(input.rawData ?? input), checksum, id));
        updated += 1;
      } else {
        dataStatements.push(DB.prepare("INSERT INTO organizations (id, code, name, short_name, level, parent_id, manager_person_id, status, source_file, source_sheet, source_row, raw_data, checksum, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced')")
          .bind(id, code, name, canonical.shortName, canonical.level, parentId, managerPersonId, status, fileName, sheetName, sourceRow, jsonForStorage(input.rawData ?? input), checksum));
        inserted += 1;
      }
      if (effective.value) {
        const historyId = `org-history-${(await sha256Text(`${id}|${effective.value}|${cleanText(input.decisionNumber, 200)}`)).slice(0, 24)}`;
        dataStatements.push(DB.prepare("INSERT INTO organization_history (id, organization_id, change_type, old_value_json, new_value_json, effective_date, decision_number, notes, created_by) VALUES (?, ?, 'import', ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET new_value_json = excluded.new_value_json, decision_number = excluded.decision_number, notes = excluded.notes, updated_at = CURRENT_TIMESTAMP")
          .bind(historyId, id, existing ? jsonForStorage(existing) : null, jsonForStorage(canonical), effective.value, cleanText(input.decisionNumber, 200) || null, cleanText(input.notes, 5_000) || null, actor.email));
      }
      organizationsByCode.set(normalizeName(code), { id, code, name });
      organizationsByName.set(normalizeName(name), { id, code, name });
      dataStatements.push(actorAudit(DB, actor, existing ? "import_update" : "import_create", "organization", id, existing, canonical, `Nhập ${fileName} / ${sheetName}`, requestId));
      continue;
    }

    if (entityType === "assignments") {
      const person = resolveRelatedPerson(input);
      const title = cleanText(input.assignmentTitle ?? input.position, 300);
      const assignmentType = cleanText(input.assignmentType, 100);
      if (!person || !title || !assignmentType) {
        issues.push({ row: sourceRow, field: !person ? "staffCode" : !assignmentType ? "assignmentType" : "assignmentTitle", code: "REQUIRED_ASSIGNMENT_LINK", severity: "error", message: "Thiếu liên kết cán bộ, loại phân công hoặc tên chức vụ/chức danh.", fix: "Bổ sung mã cán bộ hợp lệ và các trường bắt buộc." });
        skipped += 1;
        continue;
      }
      const start = checkedDate(input, "startDate", sourceRow);
      const end = checkedDate(input, "endDate", sourceRow);
      if (start.invalid || end.invalid || (start.value && end.value && end.value < start.value)) {
        if (start.value && end.value && end.value < start.value) issues.push({ row: sourceRow, field: "endDate", code: "DATE_ORDER", severity: "error", message: "Ngày kết thúc đứng trước ngày bắt đầu.", fix: "Đối chiếu lại quyết định." });
        skipped += 1;
        continue;
      }
      const organizationCode = cleanText(input.organizationCode, 100);
      const organizationId = organizationCode ? organizationsByCode.get(normalizeName(organizationCode))?.id ?? null : null;
      if (organizationCode && !organizationId) {
        issues.push({ row: sourceRow, field: "organizationCode", code: "UNKNOWN_ORGANIZATION_CODE", severity: "error", value: organizationCode, message: "Không tìm thấy mã đơn vị của phân công.", fix: "Nhập danh mục đơn vị trước hoặc sửa mã." });
        skipped += 1;
        continue;
      }
      const status = cleanText(input.assignmentStatus, 100) || "Đang hiệu lực";
      const decisionNumber = cleanText(input.decisionNumber, 200) || null;
      const requestedId = cleanText(input.assignmentId, 120);
      const id = requestedId || `assignment-${(await sha256Text(`assignment|${person.id}|${organizationId ?? ""}|${normalizeName(assignmentType)}|${normalizeName(title)}|${start.value ?? ""}|${normalizeName(decisionNumber)}`)).slice(0, 28)}`;
      const exists = existingIds.assignments.has(id);
      if (!checkGenericMode(exists, sourceRow, "assignmentId", id)) continue;
      const canonical = { id, personId: person.id, organizationId, assignmentType, title, startDate: start.value, endDate: end.value, status, decisionNumber, notes: cleanText(input.notes, 5_000) || null };
      const checksum = await recordChecksum(canonical);
      dataStatements.push(DB.prepare("INSERT INTO person_assignments (id, person_id, organization_id, assignment_type, title, start_date, end_date, status, decision_number, notes, source_file, source_sheet, source_row, raw_data, checksum, version, sync_state, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced', NULL) ON CONFLICT(id) DO UPDATE SET person_id = excluded.person_id, organization_id = excluded.organization_id, assignment_type = excluded.assignment_type, title = excluded.title, start_date = excluded.start_date, end_date = excluded.end_date, status = excluded.status, decision_number = excluded.decision_number, notes = excluded.notes, source_file = excluded.source_file, source_sheet = excluded.source_sheet, source_row = excluded.source_row, raw_data = excluded.raw_data, checksum = excluded.checksum, version = person_assignments.version + 1, sync_state = 'synced', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP")
        .bind(id, person.id, organizationId, assignmentType, title, start.value, end.value, status, canonical.decisionNumber, canonical.notes, fileName, sheetName, sourceRow, jsonForStorage(input.rawData ?? input), checksum));
      if (exists) updated += 1; else { inserted += 1; existingIds.assignments.add(id); }
      dataStatements.push(actorAudit(DB, actor, exists ? "import_update" : "import_create", "assignment", id, null, canonical, `Nhập ${fileName} / ${sheetName}`, requestId));
      continue;
    }

    if (entityType === "training") {
      const person = resolveRelatedPerson(input);
      if (!person) {
        issues.push({ row: sourceRow, field: "staffCode", code: "UNMATCHED_PERSON_LINK", severity: "error", message: "Không liên kết được quá trình đào tạo với hồ sơ cán bộ.", fix: "Bổ sung mã cán bộ hoặc đúng họ tên + ngày sinh duy nhất." });
        skipped += 1;
        continue;
      }
      const start = checkedDate(input, "startDate", sourceRow);
      const end = checkedDate(input, "endDate", sourceRow);
      if (start.invalid || end.invalid || (start.value && end.value && end.value < start.value)) {
        if (start.value && end.value && end.value < start.value) issues.push({ row: sourceRow, field: "endDate", code: "DATE_ORDER", severity: "error", message: "Ngày kết thúc đứng trước ngày bắt đầu.", fix: "Đối chiếu lại quá trình đào tạo." });
        skipped += 1;
        continue;
      }
      const inferredType = normalizeName(sheetName).includes("nuoc ngoai") || normalizeName(sheetName).includes("hoc tap nn") ? "Học tập ở nước ngoài" : normalizeName(sheetName).includes("tot nghiep") ? "Tốt nghiệp ở nước ngoài" : "Đào tạo";
      const trainingType = cleanText(input.trainingType, 100) || inferredType;
      const requestedId = cleanText(input.trainingId ?? input.overseasStudyId, 120);
      const id = requestedId || `training-${(await sha256Text(`training|${person.id}|${normalizeName(trainingType)}|${normalizeName(input.programName)}|${normalizeName(input.degree)}|${normalizeName(input.major)}|${normalizeName(input.institution)}|${start.value ?? ""}|${normalizeName(input.decisionNumber)}`)).slice(0, 28)}`;
      const exists = existingIds.training.has(id);
      if (!checkGenericMode(exists, sourceRow, "trainingId", id)) continue;
      const canonical = {
        id, personId: person.id, trainingType, programName: cleanText(input.programName, 500) || null,
        degreeLevel: cleanText(input.degree, 100) || null, major: cleanText(input.major, 500) || null,
        disciplineGroup: cleanText(input.disciplineGroup, 200) || null, institution: cleanText(input.institution, 500) || null,
        country: cleanText(input.country, 300) || null, countryScope: cleanText(input.countryScope, 100) || null,
        fundingSource: cleanText(input.fundingSource, 500) || null, status: cleanText(input.trainingStatus ?? input.phdStatus, 100) || "Chờ xác minh",
        startDate: start.value, endDate: end.value, decisionNumber: cleanText(input.decisionNumber, 200) || null,
        foreignLanguage: cleanText(input.foreignLanguage, 500) || null, notes: cleanText(input.notes, 5_000) || null,
      };
      const checksum = await recordChecksum(canonical);
      dataStatements.push(DB.prepare("INSERT INTO training_records (id, person_id, training_type, program_name, degree_level, major, discipline_group, institution, country, country_scope, funding_source, status, start_date, end_date, decision_number, foreign_language, notes, source_file, source_sheet, source_row, raw_data, checksum, version, sync_state, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced', NULL) ON CONFLICT(id) DO UPDATE SET person_id = excluded.person_id, training_type = excluded.training_type, program_name = excluded.program_name, degree_level = excluded.degree_level, major = excluded.major, discipline_group = excluded.discipline_group, institution = excluded.institution, country = excluded.country, country_scope = excluded.country_scope, funding_source = excluded.funding_source, status = excluded.status, start_date = excluded.start_date, end_date = excluded.end_date, decision_number = excluded.decision_number, foreign_language = excluded.foreign_language, notes = excluded.notes, source_file = excluded.source_file, source_sheet = excluded.source_sheet, source_row = excluded.source_row, raw_data = excluded.raw_data, checksum = excluded.checksum, version = training_records.version + 1, sync_state = 'synced', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP")
        .bind(id, person.id, trainingType, canonical.programName, canonical.degreeLevel, canonical.major, canonical.disciplineGroup, canonical.institution, canonical.country, canonical.countryScope, canonical.fundingSource, canonical.status, start.value, end.value, canonical.decisionNumber, canonical.foreignLanguage, canonical.notes, fileName, sheetName, sourceRow, jsonForStorage(input.rawData ?? input), checksum));
      if (exists) updated += 1; else { inserted += 1; existingIds.training.add(id); }
      dataStatements.push(actorAudit(DB, actor, exists ? "import_update" : "import_create", "training", id, null, canonical, `Nhập ${fileName} / ${sheetName}`, requestId));
      continue;
    }

    if (entityType === "commitments") {
      const person = resolveRelatedPerson(input);
      if (!person) {
        issues.push({ row: sourceRow, field: "staffCode", code: "UNMATCHED_PERSON_LINK", severity: "error", message: "Không liên kết được cam kết với hồ sơ cán bộ.", fix: "Bổ sung mã cán bộ hoặc đúng họ tên + ngày sinh duy nhất." });
        skipped += 1;
        continue;
      }
      const start = checkedDate(input, "startDate", sourceRow);
      const due = checkedDate(input, "dueDate", sourceRow);
      const completed = checkedDate(input, "completedDate", sourceRow);
      if (start.invalid || due.invalid || completed.invalid || (start.value && due.value && due.value < start.value)) {
        if (start.value && due.value && due.value < start.value) issues.push({ row: sourceRow, field: "dueDate", code: "DATE_ORDER", severity: "error", message: "Hạn thực hiện đứng trước ngày bắt đầu cam kết.", fix: "Đối chiếu lại quyết định/cam kết." });
        skipped += 1;
        continue;
      }
      const amountRaw = cleanText(input.amount, 60).replace(/[,.\s]/g, "");
      const amount = amountRaw ? Number(amountRaw) : null;
      if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) {
        issues.push({ row: sourceRow, field: "amount", code: "INVALID_AMOUNT", severity: "error", value: cleanText(input.amount, 100), message: "Số tiền không hợp lệ.", fix: "Nhập số nguyên không âm, không kèm ký hiệu tiền tệ." });
        skipped += 1;
        continue;
      }
      const trainingRecordId = cleanText(input.relatedTrainingId, 120) || null;
      if (trainingRecordId && !existingIds.training.has(trainingRecordId)) issues.push({ row: sourceRow, field: "relatedTrainingId", code: "UNKNOWN_TRAINING_LINK", severity: "warning", value: trainingRecordId, message: "Chưa tìm thấy quá trình đào tạo liên quan.", fix: "Nhập quá trình đào tạo trước hoặc xác minh mã." });
      const decisionNumber = cleanText(input.decisionNumber, 200) || null;
      const requestedId = cleanText(input.commitmentId, 120);
      const id = requestedId || `commitment-${(await sha256Text(`commitment|${person.id}|${trainingRecordId ?? ""}|${normalizeName(decisionNumber)}|${start.value ?? ""}|${due.value ?? ""}`)).slice(0, 28)}`;
      const exists = existingIds.commitments.has(id);
      if (!checkGenericMode(exists, sourceRow, "commitmentId", id)) continue;
      const canonical = { id, personId: person.id, trainingRecordId, decisionNumber, amount, startDate: start.value, dueDate: due.value, status: cleanText(input.commitmentStatus, 100) || "Chờ xác minh", completedDate: completed.value, notes: cleanText(input.notes, 5_000) || null };
      const checksum = await recordChecksum(canonical);
      dataStatements.push(DB.prepare("INSERT INTO training_commitments (id, person_id, training_record_id, decision_number, amount, start_date, due_date, status, completed_date, notes, source_file, source_sheet, source_row, raw_data, checksum, version, sync_state, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced', NULL) ON CONFLICT(id) DO UPDATE SET person_id = excluded.person_id, training_record_id = excluded.training_record_id, decision_number = excluded.decision_number, amount = excluded.amount, start_date = excluded.start_date, due_date = excluded.due_date, status = excluded.status, completed_date = excluded.completed_date, notes = excluded.notes, source_file = excluded.source_file, source_sheet = excluded.source_sheet, source_row = excluded.source_row, raw_data = excluded.raw_data, checksum = excluded.checksum, version = training_commitments.version + 1, sync_state = 'synced', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP")
        .bind(id, person.id, trainingRecordId, canonical.decisionNumber, amount, start.value, due.value, canonical.status, completed.value, canonical.notes, fileName, sheetName, sourceRow, jsonForStorage(input.rawData ?? input), checksum));
      if (exists) updated += 1; else { inserted += 1; existingIds.commitments.add(id); }
      dataStatements.push(actorAudit(DB, actor, exists ? "import_update" : "import_create", "commitment", id, null, canonical, `Nhập ${fileName} / ${sheetName}`, requestId));
      continue;
    }

    if (entityType === "events") {
      const person = resolveRelatedPerson(input);
      const eventType = cleanText(input.eventType, 100);
      const effective = checkedDate(input, "effectiveDate", sourceRow, true);
      if (!person || !eventType || effective.invalid) {
        if (!person) issues.push({ row: sourceRow, field: "staffCode", code: "UNMATCHED_PERSON_LINK", severity: "error", message: "Không liên kết được biến động với hồ sơ cán bộ.", fix: "Bổ sung mã cán bộ hợp lệ." });
        if (!eventType) issues.push({ row: sourceRow, field: "eventType", code: "REQUIRED_EVENT_TYPE", severity: "error", message: "Thiếu loại biến động.", fix: "Chọn loại biến động từ danh mục." });
        skipped += 1;
        continue;
      }
      const fromCode = cleanText(input.fromOrganizationCode, 100);
      const toCode = cleanText(input.toOrganizationCode, 100);
      const fromOrganizationId = fromCode ? organizationsByCode.get(normalizeName(fromCode))?.id ?? null : null;
      const toOrganizationId = toCode ? organizationsByCode.get(normalizeName(toCode))?.id ?? null : null;
      if ((fromCode && !fromOrganizationId) || (toCode && !toOrganizationId)) {
        const value = !fromOrganizationId && fromCode ? fromCode : toCode;
        issues.push({ row: sourceRow, field: !fromOrganizationId && fromCode ? "fromOrganizationCode" : "toOrganizationCode", code: "UNKNOWN_ORGANIZATION_CODE", severity: "error", value, message: "Không tìm thấy mã đơn vị trong biến động.", fix: "Nhập danh mục đơn vị trước hoặc sửa mã." });
        skipped += 1;
        continue;
      }
      const decisionNumber = cleanText(input.decisionNumber, 200) || null;
      const requestedId = cleanText(input.eventId, 120);
      const id = requestedId || `event-${(await sha256Text(`event|${person.id}|${normalizeName(eventType)}|${fromOrganizationId ?? ""}|${toOrganizationId ?? ""}|${effective.value ?? ""}|${normalizeName(decisionNumber)}`)).slice(0, 28)}`;
      const exists = existingIds.events.has(id);
      if (!checkGenericMode(exists, sourceRow, "eventId", id)) continue;
      const canonical = { id, personId: person.id, eventType, fromOrganizationId, toOrganizationId, oldValueJson: input.oldValueJson ? jsonForStorage(input.oldValueJson, 20_000) : null, newValueJson: input.newValueJson ? jsonForStorage(input.newValueJson, 20_000) : null, effectiveDate: effective.value, decisionNumber, reason: cleanText(input.reason, 2_000) || null };
      const checksum = await recordChecksum(canonical);
      dataStatements.push(DB.prepare("INSERT INTO employment_events (id, person_id, event_type, from_organization_id, to_organization_id, old_value_json, new_value_json, effective_date, decision_number, reason, created_by, source_file, source_sheet, source_row, raw_data, checksum, version, sync_state, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced', NULL) ON CONFLICT(id) DO UPDATE SET person_id = excluded.person_id, event_type = excluded.event_type, from_organization_id = excluded.from_organization_id, to_organization_id = excluded.to_organization_id, old_value_json = excluded.old_value_json, new_value_json = excluded.new_value_json, effective_date = excluded.effective_date, decision_number = excluded.decision_number, reason = excluded.reason, source_file = excluded.source_file, source_sheet = excluded.source_sheet, source_row = excluded.source_row, raw_data = excluded.raw_data, checksum = excluded.checksum, version = employment_events.version + 1, sync_state = 'synced', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP")
        .bind(id, person.id, eventType, fromOrganizationId, toOrganizationId, canonical.oldValueJson, canonical.newValueJson, effective.value, canonical.decisionNumber, canonical.reason, actor.email, fileName, sheetName, sourceRow, jsonForStorage(input.rawData ?? input), checksum));
      if (exists) updated += 1; else { inserted += 1; existingIds.events.add(id); }
      dataStatements.push(actorAudit(DB, actor, exists ? "import_update" : "import_create", "employment_event", id, null, canonical, `Nhập ${fileName} / ${sheetName}`, requestId));
      continue;
    }

    if (entityType === "documents") {
      const ownerEntityType = cleanText(input.ownerEntityType, 80);
      const ownerEntityId = cleanText(input.ownerEntityId, 120);
      const fileType = cleanText(input.fileType, 100);
      const indexedFileName = cleanText(input.fileName, 500);
      if (!ownerEntityType || !ownerEntityId || !fileType || !indexedFileName) {
        issues.push({ row: sourceRow, field: "document", code: "REQUIRED_DOCUMENT_METADATA", severity: "error", message: "Thiếu loại/mã hồ sơ liên kết, loại tài liệu hoặc tên tệp.", fix: "Bổ sung đủ các trường bắt buộc; tệp nhị phân tải riêng ở mục Tệp và minh chứng." });
        skipped += 1;
        continue;
      }
      const supportedOwnerTypes = new Set(["person", "contract", "organization", "employment_event", "qualification"]);
      const ownerExists = ownerEntityType === "person" ? people.some((item) => item.id === ownerEntityId)
        : ownerEntityType === "contract" ? contractsById.has(ownerEntityId)
          : ownerEntityType === "organization" ? [...organizationsByCode.values()].some((item) => item.id === ownerEntityId)
            : ownerEntityType === "employment_event" ? existingIds.events.has(ownerEntityId)
              : ownerEntityType === "qualification" ? existingIds.qualifications.has(ownerEntityId)
                : false;
      if (!supportedOwnerTypes.has(ownerEntityType) || !ownerExists) {
        issues.push({ row: sourceRow, field: "ownerEntityId", code: "UNKNOWN_DOCUMENT_OWNER", severity: "error", value: `${ownerEntityType}:${ownerEntityId}`, message: "Hồ sơ liên kết không tồn tại hoặc sai loại.", fix: "Nhập hồ sơ đích trước và dùng đúng mã nội bộ." });
        skipped += 1;
        continue;
      }
      const documentDate = checkedDate(input, "documentDate", sourceRow);
      if (documentDate.invalid) { skipped += 1; continue; }
      const documentVersion = Number(input.version ?? 1);
      if (!Number.isInteger(documentVersion) || documentVersion < 1) {
        issues.push({ row: sourceRow, field: "version", code: "INVALID_DOCUMENT_VERSION", severity: "error", message: "Phiên bản tài liệu phải là số nguyên từ 1.", fix: "Nhập 1 cho bản đầu tiên." });
        skipped += 1;
        continue;
      }
      const requestedId = cleanText(input.fileRecordId, 120);
      const id = requestedId || `document-${(await sha256Text(`document|${normalizeName(ownerEntityType)}|${normalizeName(ownerEntityId)}|${normalizeName(fileType)}|${normalizeName(indexedFileName)}|${normalizeName(input.documentNumber)}|${documentDate.value ?? ""}|${documentVersion}`)).slice(0, 28)}`;
      const exists = existingIds.documents.has(id);
      if (!checkGenericMode(exists, sourceRow, "fileRecordId", id)) continue;
      const canonical = { id, ownerEntityType, ownerEntityId, fileType, fileName: indexedFileName, documentNumber: cleanText(input.documentNumber, 200) || null, documentDate: documentDate.value, documentVersion, notes: cleanText(input.notes, 5_000) || null };
      const checksum = await recordChecksum(canonical);
      dataStatements.push(DB.prepare("INSERT INTO document_records (id, owner_entity_type, owner_entity_id, file_type, file_name, document_number, document_date, document_version, notes, source_file, source_sheet, source_row, raw_data, checksum, version, sync_state, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced', NULL) ON CONFLICT(id) DO UPDATE SET owner_entity_type = excluded.owner_entity_type, owner_entity_id = excluded.owner_entity_id, file_type = excluded.file_type, file_name = excluded.file_name, document_number = excluded.document_number, document_date = excluded.document_date, document_version = excluded.document_version, notes = excluded.notes, source_file = excluded.source_file, source_sheet = excluded.source_sheet, source_row = excluded.source_row, raw_data = excluded.raw_data, checksum = excluded.checksum, version = document_records.version + 1, sync_state = 'synced', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP")
        .bind(id, ownerEntityType, ownerEntityId, fileType, indexedFileName, canonical.documentNumber, documentDate.value, documentVersion, canonical.notes, fileName, sheetName, sourceRow, jsonForStorage(input.rawData ?? input), checksum));
      if (exists) updated += 1; else { inserted += 1; existingIds.documents.add(id); }
      dataStatements.push(actorAudit(DB, actor, exists ? "import_update" : "import_create", "document_record", id, null, canonical, `Nhập ${fileName} / ${sheetName}`, requestId));
      continue;
    }

    const fullName = cleanText(input.fullName, 300);
    if (!fullName) {
      issues.push({ row: sourceRow, field: "fullName", code: "REQUIRED_NAME", severity: "error", message: "Thiếu họ và tên.", fix: "Bổ sung họ tên hoặc bỏ qua dòng." });
      skipped += 1;
      continue;
    }
    const normalizedFullName = normalizeName(fullName);
    const rawBirthDate = cleanText(input.birthDate, 50);
    const birthDate = normalizeDate(rawBirthDate);
    if (rawBirthDate && !birthDate) {
      issues.push({ row: sourceRow, field: "birthDate", code: "INVALID_DATE", severity: "warning", value: rawBirthDate, message: "Ngày sinh nguồn không hợp lệ; hồ sơ vẫn được giữ và ngày sinh chuẩn để trống.", fix: "Đối chiếu hồ sơ gốc rồi bổ sung theo DD/MM/YYYY; hệ thống không tự đoán ngày." });
    }

    if (entityType === "people") {
      const requestedPersonId = cleanText(input.personId, 120) || null;
      const staffCode = cleanText(input.staffCode, 100) || null;
      const lecturerCode = cleanText(input.lecturerCode, 100) || null;
      const workEmail = cleanText(input.workEmail, 300).toLowerCase() || null;
      const personalEmail = cleanText(input.personalEmail, 300).toLowerCase() || null;
      const phone = cleanText(input.phone, 60) || null;
      const employmentStartDate = normalizeDate(input.startDate);
      if (cleanText(input.startDate) && !employmentStartDate) {
        issues.push({ row: sourceRow, field: "startDate", code: "INVALID_DATE", severity: "error", value: cleanText(input.startDate, 100), message: "Ngày bắt đầu công tác không hợp lệ.", fix: "Dùng DD/MM/YYYY hoặc YYYY-MM-DD." });
        skipped += 1;
        continue;
      }
      const matchKey = `${normalizedFullName}|${birthDate ?? ""}`;
      const candidates = birthDate ? byNameBirth.get(matchKey) ?? [] : [];
      const personIdMatch = requestedPersonId ? byPersonId.get(requestedPersonId) : undefined;
      const staffMatch = staffCode ? byStaffCode.get(normalizeName(staffCode)) : undefined;
      const lecturerMatch = lecturerCode ? byLecturerCode.get(normalizeName(lecturerCode)) : undefined;
      if (personIdMatch && staffMatch && personIdMatch.id !== staffMatch.id) {
        issues.push({ row: sourceRow, field: "personId", code: "CONFLICTING_PERSON_KEYS", severity: "error", value: requestedPersonId ?? undefined, message: "personId và mã cán bộ đang trỏ tới hai hồ sơ khác nhau.", fix: "Dừng nhập và đối chiếu hồ sơ gốc trước khi gộp." });
        skipped += 1;
        continue;
      }
      if (personIdMatch && lecturerMatch && personIdMatch.id !== lecturerMatch.id) {
        issues.push({ row: sourceRow, field: "personId", code: "CONFLICTING_PERSON_KEYS", severity: "error", value: requestedPersonId ?? undefined, message: "personId và mã giảng viên đang trỏ tới hai hồ sơ khác nhau.", fix: "Dừng nhập và đối chiếu hồ sơ gốc trước khi gộp." });
        skipped += 1;
        continue;
      }
      if (staffMatch && lecturerMatch && staffMatch.id !== lecturerMatch.id) {
        issues.push({ row: sourceRow, field: "lecturerCode", code: "CONFLICTING_PERSON_CODES", severity: "error", value: lecturerCode ?? undefined, message: "Mã cán bộ và mã giảng viên đang trỏ tới hai hồ sơ khác nhau.", fix: "Đối chiếu mã định danh trước khi gộp." });
        skipped += 1;
        continue;
      }
      if (candidates.length > 1 && !staffMatch) {
        issues.push({ row: sourceRow, field: "person_id", code: "AMBIGUOUS_PERSON", severity: "error", message: "Có nhiều hồ sơ cùng họ tên và ngày sinh; không thể tự gộp.", fix: "Bổ sung mã cán bộ và chọn đúng hồ sơ." });
        skipped += 1;
        continue;
      }
      const nameBirthMatch = candidates.length === 1 ? candidates[0] : undefined;
      if (staffMatch && nameBirthMatch && staffMatch.id !== nameBirthMatch.id) {
        issues.push({ row: sourceRow, field: "staffCode", code: "CONFLICTING_PERSON_KEYS", severity: "error", value: staffCode ?? undefined, message: "Mã cán bộ và họ tên + ngày sinh đang trỏ tới hai hồ sơ khác nhau.", fix: "Dừng gộp và đối chiếu hồ sơ gốc; hệ thống không tự ghi đè." });
        skipped += 1;
        continue;
      }
      if (!staffMatch && staffCode && nameBirthMatch?.staffCode && normalizeName(nameBirthMatch.staffCode) !== normalizeName(staffCode)) {
        issues.push({ row: sourceRow, field: "staffCode", code: "CONFLICTING_PERSON_KEYS", severity: "error", value: staffCode, message: "Họ tên + ngày sinh đã tồn tại nhưng mang mã cán bộ khác.", fix: "Xác minh mã cán bộ trước khi cập nhật; hệ thống không tự thay mã." });
        skipped += 1;
        continue;
      }
      const existing = personIdMatch ?? staffMatch ?? lecturerMatch ?? nameBirthMatch;
      const emailOwner = workEmail ? byWorkEmail.get(normalizeName(workEmail)) : undefined;
      if (emailOwner && emailOwner.id !== existing?.id) {
        issues.push({ row: sourceRow, field: "workEmail", code: "DUPLICATE_WORK_EMAIL", severity: "error", value: workEmail ?? undefined, message: "Email công vụ đã thuộc hồ sơ khác.", fix: "Xác minh người sở hữu email trước khi nhập." });
        skipped += 1;
        continue;
      }
      const phoneOwners = phone ? byPhone.get(normalizeName(phone)) ?? [] : [];
      if (phoneOwners.some((owner) => owner.id !== existing?.id)) issues.push({ row: sourceRow, field: "phone", code: "DUPLICATE_PHONE", severity: "warning", value: phone ?? undefined, message: "Số điện thoại đang xuất hiện ở hồ sơ khác.", fix: "Xác minh số dùng chung hay dữ liệu nhập trùng." });
      if (mode === "new" && existing) {
        duplicates += 1;
        issues.push({ row: sourceRow, field: staffMatch ? "staffCode" : "nameBirth", code: "POSSIBLE_DUPLICATE", severity: "warning", message: "Hồ sơ đã tồn tại; không ghi đè ở chế độ nhập mới.", fix: "Dùng chế độ gộp/cập nhật sau khi xác minh." });
        continue;
      }
      if (mode === "update" && !existing) {
        skipped += 1;
        issues.push({ row: sourceRow, field: "person_id", code: "UPDATE_TARGET_NOT_FOUND", severity: "error", message: "Không tìm thấy hồ sơ đích để cập nhật.", fix: "Bổ sung mã cán bộ hoặc chuyển sang chế độ gộp." });
        continue;
      }

      const organization = await resolveOrganization(input, sourceRow);
      if (organization.invalid) { skipped += 1; continue; }
      const organizationName = organization.sourceName;
      const organizationId = organization.id;
      const allowedScopes = actorOrganizationScope(actor);
      if (allowedScopes.length && (!organizationId || !allowedScopes.includes(organizationId))) {
        issues.push({ row: sourceRow, field: "organizationCode", code: "OUT_OF_SCOPE", severity: "error", message: "Dòng nằm ngoài phạm vi đơn vị được giao.", fix: "Chuyển dòng cho tài khoản có đúng phạm vi đơn vị." });
        skipped += 1;
        continue;
      }
      const sourceIdentityKey = await sha256Text(`person-source|${fileChecksum}|${sheetName}|${sourceRow}`);
      const id = existing?.id ?? requestedPersonId ?? crypto.randomUUID();
      const canonical = {
        id,
        staffCode,
        lecturerCode,
        personType: cleanText(input.personType, 100) || "Viên chức",
        fullName,
        normalizedName: normalizedFullName,
        birthDate,
        gender: cleanText(input.gender, 30) || null,
        organizationId,
        organizationNameSource: organizationName || null,
        department: cleanText(input.department, 300) || null,
        position: cleanText(input.position, 300) || null,
        professionalTitle: cleanText(input.professionalTitle, 300) || null,
        employmentStatus: cleanText(input.employmentStatus, 100) || "đang công tác",
        startDate: employmentStartDate,
        phone,
        workEmail,
        personalEmail,
        identityNumber: cleanText(input.identityNumber, 100) || null,
        taxCode: cleanText(input.taxCode, 100) || null,
        socialInsuranceNumber: cleanText(input.socialInsuranceNumber, 100) || null,
        homeTown: cleanText(input.homeTown, 500) || null,
        address: cleanText(input.address, 1_000) || null,
        specialization: cleanText(input.specialization, 500) || null,
        workArrangement: cleanText(input.workArrangement, 300) || null,
        notes: cleanText(input.notes, 5_000) || null,
        sourceIdentityKey,
      };
      const checksum = await recordChecksum(canonical);
      if (existing) {
        dataStatements.push(DB.prepare("UPDATE people SET staff_code = COALESCE(?, staff_code), lecturer_code = COALESCE(?, lecturer_code), person_type = ?, full_name = ?, normalized_name = ?, birth_date = COALESCE(?, birth_date), gender = COALESCE(?, gender), organization_id = COALESCE(?, organization_id), organization_name_source = COALESCE(?, organization_name_source), department = COALESCE(?, department), position = COALESCE(?, position), professional_title = COALESCE(?, professional_title), employment_status = ?, start_date = COALESCE(?, start_date), phone = COALESCE(?, phone), work_email = COALESCE(?, work_email), personal_email = COALESCE(?, personal_email), identity_number = COALESCE(?, identity_number), tax_code = COALESCE(?, tax_code), social_insurance_number = COALESCE(?, social_insurance_number), home_town = COALESCE(?, home_town), address = COALESCE(?, address), specialization = COALESCE(?, specialization), work_arrangement = COALESCE(?, work_arrangement), notes = COALESCE(?, notes), source_file = ?, source_sheet = ?, source_row = ?, source_identity_key = COALESCE(source_identity_key, ?), raw_data = ?, checksum = ?, updated_by = ?, version = version + 1, sync_state = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(staffCode, lecturerCode, canonical.personType, fullName, normalizedFullName, birthDate, canonical.gender, organizationId, canonical.organizationNameSource, canonical.department, canonical.position, canonical.professionalTitle, canonical.employmentStatus, canonical.startDate, canonical.phone, canonical.workEmail, canonical.personalEmail, canonical.identityNumber, canonical.taxCode, canonical.socialInsuranceNumber, canonical.homeTown, canonical.address, canonical.specialization, canonical.workArrangement, canonical.notes, fileName, sheetName, sourceRow, sourceIdentityKey, jsonForStorage(input.rawData ?? input), checksum, actor.email, existing.id));
        updated += 1;
      } else {
        dataStatements.push(DB.prepare("INSERT INTO people (id, staff_code, lecturer_code, person_type, full_name, normalized_name, birth_date, gender, organization_id, organization_name_source, department, position, professional_title, employment_status, start_date, phone, work_email, personal_email, identity_number, tax_code, social_insurance_number, home_town, address, specialization, work_arrangement, notes, source_file, source_sheet, source_row, source_identity_key, raw_data, checksum, updated_by, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced')")
          .bind(id, staffCode, lecturerCode, canonical.personType, fullName, normalizedFullName, birthDate, canonical.gender, organizationId, canonical.organizationNameSource, canonical.department, canonical.position, canonical.professionalTitle, canonical.employmentStatus, canonical.startDate, canonical.phone, canonical.workEmail, canonical.personalEmail, canonical.identityNumber, canonical.taxCode, canonical.socialInsuranceNumber, canonical.homeTown, canonical.address, canonical.specialization, canonical.workArrangement, canonical.notes, fileName, sheetName, sourceRow, sourceIdentityKey, jsonForStorage(input.rawData ?? input), checksum, actor.email));
        inserted += 1;
      }

      const qualificationFields = ["academicTitle", "degree", "degreeYear", "major", "disciplineGroup", "institution", "country", "foreignLanguage", "informatics", "phdStatus", "educationHistory"];
      if (qualificationFields.some((field) => cleanText(input[field]) || (Array.isArray(input[field]) && (input[field] as unknown[]).length))) {
        const qualificationId = `qual-${(await sha256Text(`qualification|${id}|${normalizeName(input.academicTitle)}|${normalizeName(input.degree)}|${Number(input.degreeYear) || ""}|${normalizeName(input.major)}|${normalizeName(input.institution)}`)).slice(0, 28)}`;
        const qualification = { id: qualificationId, personId: id, academicTitle: cleanText(input.academicTitle, 100) || null, degreeLevel: cleanText(input.degree, 100) || null, degreeYear: Number(input.degreeYear) || null, major: cleanText(input.major, 500) || null, disciplineGroup: cleanText(input.disciplineGroup, 200) || null, institution: cleanText(input.institution, 500) || null, country: cleanText(input.country, 300) || null, foreignLanguage: cleanText(input.foreignLanguage, 500) || null, informatics: cleanText(input.informatics, 500) || null, phdStatus: cleanText(input.phdStatus, 2_000) || null, educationHistoryJson: input.educationHistory ? jsonForStorage(input.educationHistory, 20_000) : null };
        const qualificationChecksum = await recordChecksum(qualification);
        dataStatements.push(DB.prepare("INSERT INTO qualifications (id, person_id, academic_title, degree_level, degree_year, major, discipline_group, institution, country, foreign_language, informatics, phd_status, education_history_json, source_file, source_sheet, source_row, raw_data, checksum, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced') ON CONFLICT(id) DO UPDATE SET academic_title = excluded.academic_title, degree_level = excluded.degree_level, degree_year = excluded.degree_year, major = excluded.major, discipline_group = excluded.discipline_group, institution = excluded.institution, country = excluded.country, foreign_language = excluded.foreign_language, informatics = excluded.informatics, phd_status = excluded.phd_status, education_history_json = excluded.education_history_json, source_file = excluded.source_file, source_sheet = excluded.source_sheet, source_row = excluded.source_row, raw_data = excluded.raw_data, checksum = excluded.checksum, sync_state = 'synced', version = qualifications.version + 1, updated_at = CURRENT_TIMESTAMP")
          .bind(qualificationId, id, qualification.academicTitle, qualification.degreeLevel, qualification.degreeYear, qualification.major, qualification.disciplineGroup, qualification.institution, qualification.country, qualification.foreignLanguage, qualification.informatics, qualification.phdStatus, qualification.educationHistoryJson, fileName, sheetName, sourceRow, jsonForStorage(input.rawData ?? input), qualificationChecksum));
      }

      const politicalRoles = cleanText(input.politicalRole, 1_000).split("·").map((item) => item.trim()).filter(Boolean);
      for (const title of politicalRoles) {
        const assignmentId = `assign-${(await sha256Text(`political-assignment|${id}|${organizationId ?? ""}|${normalizeName(title)}`)).slice(0, 26)}`;
        const assignmentChecksum = await recordChecksum({ id: assignmentId, personId: id, organizationId, assignmentType: "đảng-đoàn thể-hđt", title, status: "active" });
        dataStatements.push(DB.prepare("INSERT INTO person_assignments (id, person_id, organization_id, assignment_type, title, status, source_file, source_sheet, source_row, raw_data, checksum, version, sync_state) VALUES (?, ?, ?, 'đảng-đoàn thể-hđt', ?, 'active', ?, ?, ?, ?, ?, 1, 'synced') ON CONFLICT(id) DO UPDATE SET organization_id = excluded.organization_id, title = excluded.title, status = 'active', source_file = excluded.source_file, source_sheet = excluded.source_sheet, source_row = excluded.source_row, raw_data = excluded.raw_data, checksum = excluded.checksum, sync_state = 'synced', version = person_assignments.version + 1, updated_at = CURRENT_TIMESTAMP")
          .bind(assignmentId, id, organizationId, title, fileName, sheetName, sourceRow, jsonForStorage(input.rawData ?? input), assignmentChecksum));
      }
      dataStatements.push(actorAudit(DB, actor, existing ? "import_update" : "import_create", "person", id, existing, canonical, `Nhập ${fileName} / ${sheetName}`, requestId));
      const mapped: ExistingPerson = { ...canonical, staffCode, lecturerCode, sourceIdentityKey, version: (existing?.version ?? 0) + 1 };
      byPersonId.set(id, mapped);
      if (staffCode) byStaffCode.set(normalizeName(staffCode), mapped);
      if (lecturerCode) byLecturerCode.set(normalizeName(lecturerCode), mapped);
      if (workEmail) byWorkEmail.set(normalizeName(workEmail), mapped);
      if (phone) byPhone.set(normalizeName(phone), [...(byPhone.get(normalizeName(phone)) ?? []), mapped]);
      byNameBirth.set(matchKey, [mapped]);
      byName.set(normalizedFullName, [...(byName.get(normalizedFullName) ?? []), mapped]);
      continue;
    }

    const contractType = cleanText(input.contractType, 200) || "Loại khác";
    const contractNumber = cleanText(input.contractNumber, 200) || null;
    if (!contractNumber) issues.push({ row: sourceRow, field: "contractNumber", code: "MISSING_CONTRACT_NUMBER", severity: "warning", message: "Thiếu số hợp đồng; hệ thống không tự sinh.", fix: "Giữ trạng thái chờ bổ sung và xác minh văn bản gốc." });
    const period = dateRangeFromText(input.periodText);
    const dates = {
      signedDate: normalizeDate(input.signedDate),
      effectiveDate: normalizeDate(input.effectiveDate),
      startDate: normalizeDate(input.startDate) ?? period.start,
      endDate: normalizeDate(input.endDate) ?? period.end,
      terminatedDate: normalizeDate(input.terminatedDate),
    };
    let invalidDate = false;
    for (const field of ["signedDate", "effectiveDate", "startDate", "endDate", "terminatedDate"] as const) {
      if (cleanText(input[field]) && !normalizeDate(input[field])) {
        issues.push({ row: sourceRow, field, code: "INVALID_DATE", severity: "warning", value: cleanText(input[field], 100), message: "Giá trị ngày không tách được an toàn; dữ liệu gốc vẫn được giữ.", fix: "Xác minh và sửa theo DD/MM/YYYY." });
      }
    }
    const startForLogic = dates.startDate ?? dates.effectiveDate;
    if (dates.endDate && startForLogic && dates.endDate < startForLogic) {
      issues.push({ row: sourceRow, field: "endDate", code: "DATE_ORDER", severity: "error", message: "Ngày hết hạn đứng trước ngày bắt đầu/hiệu lực.", fix: "Đối chiếu lại hợp đồng trước khi nhập." });
      invalidDate = true;
    }
    if (invalidDate) { skipped += 1; continue; }
    const requestedContractId = cleanText(input.contractId, 120);
    const identityMaterial = requestedContractId
      ? `contract-id|${normalizeName(requestedContractId)}`
      : `${normalizedFullName}|${birthDate ?? ""}|${normalizeName(contractType)}|${normalizeName(contractNumber)}|${dates.effectiveDate ?? dates.startDate ?? cleanText(input.periodText, 300)}`;
    const identity = await sha256Text(identityMaterial);
    if (seenBatchIdentity.has(identity)) {
      duplicates += 1;
      issues.push({ row: sourceRow, field: "sourceIdentityKey", code: "DUPLICATE_IN_BATCH", severity: "warning", message: "Dòng hợp đồng trùng trong cùng lô.", fix: "Giữ một dòng sau khi đối chiếu." });
      continue;
    }
    seenBatchIdentity.add(identity);
    const idMatch = requestedContractId ? contractsById.get(requestedContractId) : undefined;
    const identityMatch = contractsByIdentity.get(identity);
    if (idMatch && identityMatch && idMatch.id !== identityMatch.id) {
      issues.push({ row: sourceRow, field: "contractId", code: "CONFLICTING_CONTRACT_KEYS", severity: "error", value: requestedContractId, message: "Mã hợp đồng và khóa đối chiếu đang trỏ tới hai bản ghi khác nhau.", fix: "Dừng nhập và đối chiếu lịch sử hợp đồng trước khi gộp." });
      skipped += 1;
      continue;
    }
    const existing = idMatch ?? identityMatch;
    if (existing && mode === "new") { duplicates += 1; continue; }
    if (!existing && mode === "update") {
      skipped += 1;
      issues.push({ row: sourceRow, field: "contract_id", code: "UPDATE_TARGET_NOT_FOUND", severity: "error", message: "Không tìm thấy hợp đồng đích theo khóa ghép đã xác nhận.", fix: "Chuyển sang chế độ gộp hoặc kiểm tra loại/số/ngày hiệu lực." });
      continue;
    }
    const requestedPersonId = cleanText(input.personId, 120);
    const explicitPerson = requestedPersonId ? byPersonId.get(requestedPersonId) : undefined;
    const staffCode = cleanText(input.staffCode, 100);
    const staffPerson = staffCode ? byStaffCode.get(normalizeName(staffCode)) : undefined;
    if (explicitPerson && staffPerson && explicitPerson.id !== staffPerson.id) {
      issues.push({ row: sourceRow, field: "personId", code: "CONFLICTING_PERSON_LINK", severity: "error", value: requestedPersonId, message: "personId và mã cán bộ của hợp đồng trỏ tới hai hồ sơ khác nhau.", fix: "Dừng nhập và đối chiếu mã liên kết trước khi ghi." });
      skipped += 1;
      continue;
    }
    const peopleCandidates = birthDate ? (byNameBirth.get(`${normalizedFullName}|${birthDate}`) ?? []) : [];
    const personId = requestedPersonId ? explicitPerson?.id ?? null : staffPerson?.id ?? (peopleCandidates.length === 1 ? peopleCandidates[0].id : null);
    if (!personId) {
      const nameCandidates = byName.get(normalizedFullName) ?? [];
      issues.push({ row: sourceRow, field: staffCode ? "staffCode" : "person_id", code: peopleCandidates.length > 1 || nameCandidates.length > 1 ? "AMBIGUOUS_PERSON_LINK" : "UNMATCHED_PERSON_LINK", severity: "warning", value: staffCode || undefined, message: "Chưa liên kết tự động với hồ sơ nhân sự.", fix: "Chỉ liên kết sau khi xác minh mã cán bộ hoặc đúng họ tên + ngày sinh duy nhất." });
    }
    const organization = await resolveOrganization(input, sourceRow);
    if (organization.invalid) { skipped += 1; continue; }
    const organizationName = organization.sourceName;
    const organizationId = organization.id;
    const allowedScopes = actorOrganizationScope(actor);
    if (allowedScopes.length && (!organizationId || !allowedScopes.includes(organizationId))) {
      issues.push({ row: sourceRow, field: "organizationCode", code: "OUT_OF_SCOPE", severity: "error", message: "Hợp đồng nằm ngoài phạm vi đơn vị được giao.", fix: "Chuyển dòng cho tài khoản có đúng phạm vi đơn vị." });
      skipped += 1;
      continue;
    }
    const canonical = {
      id: existing?.id ?? (requestedContractId || `contract-${identity}`), personId, contractNumber, contractType, fullName, birthDate,
      signer: cleanText(input.signer, 300) || null,
      signingOrganization: cleanText(input.signingOrganization, 500) || null,
      organizationId, organizationNameSource: organizationName || null,
      roleOrSpecialty: cleanText(input.roleOrSpecialty, 500) || null,
      salaryCoefficient: cleanText(input.salaryCoefficient, 100) || null,
      ...dates, durationMonths: Number(input.durationMonths) || null,
      periodText: cleanText(input.periodText, 1_000) || null,
      status: contractStatus(contractType, dates.endDate, dates.terminatedDate),
      terminationReason: cleanText(input.terminationReason, 2_000) || null,
      notes: cleanText(input.notes, 5_000) || null,
      sourceIdentityKey: identity,
    };
    if (!existing && seenGeneratedContractIds.has(canonical.id)) {
      issues.push({ row: sourceRow, field: "contractId", code: "GENERATED_ID_COLLISION", severity: "error", message: "Khóa hợp đồng sinh tự động bị trùng trong cùng lô; dòng chưa được ghi.", fix: "Đối chiếu khóa nghiệp vụ và nhập lại sau khi xử lý trùng." });
      skipped += 1;
      continue;
    }
    if (!existing) seenGeneratedContractIds.add(canonical.id);
    const checksum = await recordChecksum(canonical);
    if (existing) {
      dataStatements.push(DB.prepare("UPDATE contracts SET person_id = COALESCE(?, person_id), contract_number = ?, contract_type = ?, source_person_name = ?, source_birth_date = ?, signer = COALESCE(?, signer), signing_organization = COALESCE(?, signing_organization), using_organization_id = COALESCE(?, using_organization_id), using_organization_source = COALESCE(?, using_organization_source), role_or_specialty = COALESCE(?, role_or_specialty), salary_coefficient = COALESCE(?, salary_coefficient), signed_date = COALESCE(?, signed_date), effective_date = COALESCE(?, effective_date), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), duration_months = COALESCE(?, duration_months), period_text = COALESCE(?, period_text), status = ?, terminated_date = COALESCE(?, terminated_date), termination_reason = COALESCE(?, termination_reason), notes = COALESCE(?, notes), source_file = ?, source_sheet = ?, source_row = ?, source_identity_key = ?, raw_data = ?, checksum = ?, updated_by = ?, version = version + 1, sync_state = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(personId, contractNumber, contractType, fullName, birthDate, canonical.signer, canonical.signingOrganization, organizationId, canonical.organizationNameSource, canonical.roleOrSpecialty, canonical.salaryCoefficient, dates.signedDate, dates.effectiveDate, dates.startDate, dates.endDate, canonical.durationMonths, canonical.periodText, canonical.status, dates.terminatedDate, canonical.terminationReason, canonical.notes, fileName, sheetName, sourceRow, identity, jsonForStorage(input.rawData ?? input), checksum, actor.email, existing.id));
      updated += 1;
    } else {
      dataStatements.push(DB.prepare("INSERT INTO contracts (id, person_id, contract_number, contract_type, source_person_name, source_birth_date, signer, signing_organization, using_organization_id, using_organization_source, role_or_specialty, salary_coefficient, signed_date, effective_date, start_date, end_date, duration_months, period_text, status, terminated_date, termination_reason, notes, source_file, source_sheet, source_row, source_identity_key, raw_data, checksum, updated_by, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced')")
        .bind(canonical.id, personId, contractNumber, contractType, fullName, birthDate, canonical.signer, canonical.signingOrganization, organizationId, canonical.organizationNameSource, canonical.roleOrSpecialty, canonical.salaryCoefficient, dates.signedDate, dates.effectiveDate, dates.startDate, dates.endDate, canonical.durationMonths, canonical.periodText, canonical.status, dates.terminatedDate, canonical.terminationReason, canonical.notes, fileName, sheetName, sourceRow, identity, jsonForStorage(input.rawData ?? input), checksum, actor.email));
      contractsByIdentity.set(identity, { id: canonical.id, sourceIdentityKey: identity, contractNumber, version: 1 });
      contractsById.set(canonical.id, { id: canonical.id, sourceIdentityKey: identity, contractNumber, version: 1 });
      inserted += 1;
    }
    dataStatements.push(actorAudit(DB, actor, existing ? "import_update" : "import_create", "contract", canonical.id, existing, canonical, `Nhập ${fileName} / ${sheetName}`, requestId));
  }

  try {
    await runBatches(DB, [...organizationStatements.values(), ...dataStatements]);
    const issueStatements = issues.map((issue) => issueStatement(DB, importId, sheetName, issue));
    await runBatches(DB, issueStatements);
    const mappingName = `${fileName} / ${sheetName}`;
    const mappingId = `mapping-${(await sha256Text(normalizeName(mappingName))).slice(0, 24)}`;
    await DB.prepare("INSERT INTO mapping_templates (id, name, file_pattern, sheet_pattern, entity_type, version, header_row, header_depth, mapping_json, is_active) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 1) ON CONFLICT(name, version) DO UPDATE SET header_row = excluded.header_row, header_depth = excluded.header_depth, mapping_json = excluded.mapping_json, is_active = 1, updated_at = CURRENT_TIMESTAMP")
      .bind(mappingId, mappingName, normalizeName(fileName).replace(/\s*\(\d+\)\s*$/, ""), sheetName, entityType, Number(body.headerRow ?? 1), Number(body.headerDepth ?? 1), jsonForStorage(body.mappings ?? [], 50_000)).run();
    const errorCount = issues.filter((issue) => issue.severity === "error").length;
    await DB.prepare("UPDATE source_imports SET status = 'completed', inserted_rows = ?, updated_rows = ?, duplicate_rows = ?, skipped_rows = ?, error_rows = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(inserted, updated, duplicates, skipped, errorCount, importId).run();
    await DB.prepare("INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, after_json, changed_fields, reason, request_id) VALUES (?, ?, ?, 'bulk_import', 'source_import', ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), actor.id, actor.email, importId, jsonForStorage({ entityType, fileName, sheetName, mode, inserted, updated, duplicates, skipped, issues: issues.length }), "inserted,updated,duplicates,skipped,issues", `Nhập dữ liệu có xác nhận`, requestId).run();

    await refreshDerivedAlerts(DB);

    const reconcile = await reconciliation(DB);
    const period = importPeriod(fileName, sheetName);
    const snapshotId = `snapshot-${period.year}-${period.month ?? "year"}-all`;
    await DB.prepare("INSERT INTO snapshots (id, period_year, period_month, scope, record_counts_json, checksum, created_by) VALUES (?, ?, ?, 'all', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET record_counts_json = excluded.record_counts_json, checksum = excluded.checksum, created_by = excluded.created_by, created_at = CURRENT_TIMESTAMP")
      .bind(snapshotId, period.year, period.month, jsonForStorage(reconcile.counts), reconcile.checksum, actor.email).run();
    return json({ importId, entityType, total: records.length, inserted, updated, duplicates, skipped, issues: issues.length, errorCount, reconciliation: reconcile }, { status: 201 });
  } catch (error) {
    await DB.prepare("UPDATE source_imports SET status = 'failed', error_rows = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(Math.max(1, issues.filter((issue) => issue.severity === "error").length), importId).run().catch(() => undefined);
    throw error;
  }
}

async function mutate(request: Request, actor: Actor) {
  const { DB } = getBindings();
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8 * 1024 * 1024) return json({ error: "Lô dữ liệu vượt quá 8 MB; hãy chia nhỏ theo sheet hoặc tối đa 1.000 dòng." }, { status: 413 });
  const body = await request.json() as Record<string, unknown>;
  const action = cleanText(body.action, 100);
  if (!writableActions.has(action)) return json({ error: `Thao tác “${action || "trống"}” không được hỗ trợ.` }, { status: 400 });
  const permission = V2_WRITABLE_ACTIONS.has(action)
    ? permissionForV2Action(action)
    : action === "bulk_import" ? "import" : action === "reconcile" ? "view" : action === "restore" ? "restore" : action === "log_export" ? "export" : "write";
  requirePermission(actor, permission);
  const idempotencyKey = cleanText(request.headers.get("x-idempotency-key"), 200) || crypto.randomUUID();
  const previous = await DB.prepare("SELECT actor_user_id AS actorUserId, result_json AS resultJson FROM idempotency_keys WHERE key = ? LIMIT 1")
    .bind(idempotencyKey).first<{ actorUserId: string; resultJson: string | null }>();
  if (previous && previous.actorUserId !== actor.id) return json({ error: "Khóa chống lặp đã được dùng bởi một người dùng khác." }, { status: 409 });
  if (previous?.resultJson) return json({ ...JSON.parse(previous.resultJson), replayed: true });
  const requestId = crypto.randomUUID();

  let response: Response;
  if (V2_WRITABLE_ACTIONS.has(action)) response = (await mutateV2(DB, actor, action, body, requestId)) ?? json({ error: "Thao tác mở rộng không được xử lý." }, { status: 400 });
  else if (action === "bulk_import") response = await bulkImport(DB, actor, body, requestId);
  else if (action === "reconcile") {
    const result = await reconciliation(DB);
    await actorAudit(DB, actor, "reconcile", "system", null, null, result, "Đối soát thủ công", requestId).run();
    response = json(result);
  } else if (action === "resolve_alert") {
    const id = cleanText(body.id, 100);
    const result = await DB.prepare("UPDATE alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id, status, resolved_at AS resolvedAt")
      .bind(cleanText(body.notes, 2_000) || null, id).first();
    if (!result) response = json({ error: "Không tìm thấy cảnh báo." }, { status: 404 });
    else {
      await actorAudit(DB, actor, "resolve", "alert", id, null, result, cleanText(body.reason, 500), requestId).run();
      response = json({ alert: result });
    }
  } else if (action === "assign_alert") {
    const id = cleanText(body.id, 100);
    const assignee = cleanText(body.assigneeUserId, 300) || actor.email;
    const result = await DB.prepare("UPDATE alerts SET assignee_user_id = ?, status = CASE WHEN status = 'unread' THEN 'read' ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id, assignee_user_id AS assigneeUserId, status")
      .bind(assignee, id).first();
    if (!result) response = json({ error: "Không tìm thấy cảnh báo." }, { status: 404 });
    else {
      await actorAudit(DB, actor, "assign", "alert", id, null, result, "Giao xử lý cảnh báo", requestId).run();
      response = json({ alert: result });
    }
  } else if (action === "mark_alert_read") {
    const id = cleanText(body.id, 100);
    const result = await DB.prepare("UPDATE alerts SET status = CASE WHEN status = 'unread' THEN 'read' ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id, status")
      .bind(id).first();
    if (!result) response = json({ error: "Không tìm thấy cảnh báo." }, { status: 404 });
    else response = json({ alert: result });
  } else if (action === "log_export") {
    const details = { reportType: cleanText(body.reportType, 100), format: cleanText(body.format, 20), rowCount: Number(body.rowCount ?? 0), filters: body.filters ?? null };
    await actorAudit(DB, actor, "export", "report", null, null, details, "Xuất báo cáo", requestId).run();
    response = json({ logged: true });
  } else {
    const entityTables: Record<string, string> = {
      person: "people",
      organization: "organizations",
      assignment: "person_assignments",
      contract: "contracts",
      training: "training_records",
      commitment: "training_commitments",
      employment_event: "employment_events",
      document_record: "document_records",
    };
    const entityType = cleanText(body.entityType, 50);
    const table = entityTables[entityType] ?? null;
    const id = cleanText(body.id, 100);
    if (!table || !id) response = json({ error: "Thiếu loại hoặc mã bản ghi." }, { status: 400 });
    else {
      const before = await DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
      if (!before) response = json({ error: "Không tìm thấy bản ghi." }, { status: 404 });
      else {
        const deleting = action === "soft_delete";
        if (!deleting) requirePermission(actor, "restore");
        await DB.prepare(`UPDATE ${table} SET deleted_at = ${deleting ? "CURRENT_TIMESTAMP" : "NULL"}, version = version + 1, sync_state = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
        await actorAudit(DB, actor, deleting ? "soft_delete" : "restore", entityType, id, before, { deletedAt: deleting ? new Date().toISOString() : null }, cleanText(body.reason, 500), requestId).run();
        response = json({ id, deleted: deleting });
      }
    }
  }

  if (response.ok) {
    const clone = response.clone();
    const result = await clone.json().catch(() => ({ ok: true }));
    await DB.prepare("INSERT OR IGNORE INTO idempotency_keys (key, actor_user_id, operation, result_json) VALUES (?, ?, ?, ?)")
      .bind(idempotencyKey, actor.id, action, jsonForStorage(result, 100_000)).run();
  }
  return response;
}

export async function GET(request: Request) {
  try {
    const actor = await resolveActor(request);
    return await getResource(request, actor);
  } catch (error) {
    return responseFromThrown(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await resolveActor(request);
    return await mutate(request, actor);
  } catch (error) {
    return responseFromThrown(error);
  }
}
