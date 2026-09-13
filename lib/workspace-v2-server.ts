import {
  cleanText,
  contractStatus,
  jsonForStorage,
  normalizeDate,
  normalizeName,
  recordChecksum,
  sha256Text,
  stableStringify,
} from "@/lib/server-data";
import {
  CANONICAL_ROLES,
  canonicalRole,
  getBindings,
  requirePermission,
  type Actor,
  type Permission,
} from "@/lib/server-auth";

type Row = Record<string, unknown>;

export const V2_GET_RESOURCES = new Set(["dashboard_v2", "accounts", "catalogs", "settings", "trash"]);
export const V2_WRITABLE_ACTIONS = new Set([
  "upsert_person",
  "upsert_organization",
  "upsert_contract",
  "bulk_update_people",
  "upsert_account",
  "save_settings",
  "upsert_position",
  "upsert_academic_year",
  "restore_backup",
  "bulk_delete",
  "bulk_restore",
  "undo_delete",
]);

export function permissionForV2Action(action: string): Permission {
  if (["upsert_account", "save_settings", "upsert_position", "upsert_academic_year"].includes(action)) return "admin";
  if (["restore_backup", "bulk_restore"].includes(action)) return "restore";
  return "write";
}

function json(data: unknown, init?: ResponseInit) {
  const response = Response.json(data, init);
  response.headers.set("cache-control", "no-store");
  return response;
}

function scopeIds(actor: Actor) {
  const raw = actor.organizationScope?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => cleanText(item, 100)).filter(Boolean);
  } catch {
    // Legacy values are comma/semicolon-separated.
  }
  return raw.split(/[,;|]/).map((item) => cleanText(item, 100)).filter(Boolean);
}

function scopeSql(actor: Actor, column: string) {
  const ids = scopeIds(actor);
  if (!ids.length) return { clause: "1 = 1", args: [] as string[] };
  return { clause: `${column} IN (${ids.map(() => "?").join(",")})`, args: ids };
}

export async function enforceOrganizationScope(DB: D1Database, actor: Actor, organizationId: string | null) {
  const ids = scopeIds(actor);
  if (!ids.length) return;
  if (!organizationId || !ids.includes(organizationId)) {
    throw new Response(JSON.stringify({ error: "Bản ghi nằm ngoài phạm vi đơn vị được giao." }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const exists = await DB.prepare("SELECT id FROM organizations WHERE id = ? AND deleted_at IS NULL").bind(organizationId).first();
  if (!exists) throw new Response(JSON.stringify({ error: "Đơn vị trong phạm vi không còn hoạt động." }), { status: 409 });
}

function audit(
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
    "INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, before_json, after_json, changed_fields, reason, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(),
    actor.id,
    actor.email,
    action,
    entityType,
    entityId,
    before == null ? null : jsonForStorage(before, 50_000),
    after == null ? null : jsonForStorage(after, 50_000),
    after && typeof after === "object" ? Object.keys(after as Row).join(",") : null,
    cleanText(reason, 500) || null,
    requestId,
  );
}

async function runBatches(DB: D1Database, statements: D1PreparedStatement[], chunkSize = 50) {
  for (let index = 0; index < statements.length; index += chunkSize) {
    await DB.batch(statements.slice(index, index + chunkSize));
  }
}

function limitFrom(request: Request, fallback = 250) {
  const value = Number(new URL(request.url).searchParams.get("limit"));
  return Number.isInteger(value) ? Math.max(1, Math.min(1_000, value)) : fallback;
}

async function dashboardV2(request: Request, actor: Actor) {
  const { DB } = getBindings();
  const url = new URL(request.url);
  const unit = cleanText(url.searchParams.get("organizationId"), 100);
  const contractType = cleanText(url.searchParams.get("contractType"), 200);
  const contractState = cleanText(url.searchParams.get("status"), 100);
  const scope = scopeSql(actor, "p.organization_id");
  const peopleWhere = `${scope.clause}${unit ? " AND p.organization_id = ?" : ""}`;
  const peopleArgs = [...scope.args, ...(unit ? [unit] : [])];
  const contractScope = scopeSql(actor, "c.using_organization_id");
  const contractWhere = `${contractScope.clause}${unit ? " AND c.using_organization_id = ?" : ""}${contractType ? " AND c.contract_type = ?" : ""}${contractState ? " AND c.status = ?" : ""}`;
  const contractArgs = [...contractScope.args, ...(unit ? [unit] : []), ...(contractType ? [contractType] : []), ...(contractState ? [contractState] : [])];

  const [peopleCount, byStatus, byGender, byDegree, byUnit, contractSummary, expiring, lastPeople, lastContracts] = await Promise.all([
    DB.prepare(`SELECT COUNT(*) AS count FROM people p WHERE p.deleted_at IS NULL AND ${peopleWhere}`).bind(...peopleArgs).first<{ count: number }>(),
    DB.prepare(`SELECT COALESCE(NULLIF(trim(p.employment_status), ''), 'Chưa xác định') AS label, COUNT(*) AS value FROM people p WHERE p.deleted_at IS NULL AND ${peopleWhere} GROUP BY label ORDER BY value DESC`).bind(...peopleArgs).all(),
    DB.prepare(`SELECT COALESCE(NULLIF(trim(p.gender), ''), 'Chưa xác định') AS label, COUNT(*) AS value FROM people p WHERE p.deleted_at IS NULL AND ${peopleWhere} GROUP BY label ORDER BY value DESC`).bind(...peopleArgs).all(),
    DB.prepare(`SELECT COALESCE(NULLIF(trim(q.degree_level), ''), 'Chưa cập nhật') AS label, COUNT(DISTINCT p.id) AS value FROM people p LEFT JOIN qualifications q ON q.person_id = p.id AND q.deleted_at IS NULL WHERE p.deleted_at IS NULL AND ${peopleWhere} GROUP BY label ORDER BY value DESC`).bind(...peopleArgs).all(),
    DB.prepare(`SELECT COALESCE(o.name, p.organization_name_source, 'Chưa xác định') AS label, COUNT(*) AS value FROM people p LEFT JOIN organizations o ON o.id = p.organization_id WHERE p.deleted_at IS NULL AND ${peopleWhere} GROUP BY label ORDER BY value DESC LIMIT 30`).bind(...peopleArgs).all(),
    DB.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN c.terminated_date IS NULL AND (c.end_date IS NULL OR c.end_date >= date('now')) THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN c.terminated_date IS NULL AND c.end_date < date('now') THEN 1 ELSE 0 END) AS expired, SUM(CASE WHEN c.terminated_date IS NOT NULL THEN 1 ELSE 0 END) AS terminated, SUM(CASE WHEN c.contract_number IS NULL OR trim(c.contract_number) = '' THEN 1 ELSE 0 END) AS missingNumber FROM contracts c WHERE c.deleted_at IS NULL AND ${contractWhere}`).bind(...contractArgs).first(),
    DB.prepare(`SELECT SUM(CASE WHEN c.end_date BETWEEN date('now') AND date('now', '+7 day') THEN 1 ELSE 0 END) AS d7, SUM(CASE WHEN c.end_date BETWEEN date('now') AND date('now', '+15 day') THEN 1 ELSE 0 END) AS d15, SUM(CASE WHEN c.end_date BETWEEN date('now') AND date('now', '+30 day') THEN 1 ELSE 0 END) AS d30, SUM(CASE WHEN c.end_date BETWEEN date('now') AND date('now', '+60 day') THEN 1 ELSE 0 END) AS d60, SUM(CASE WHEN c.end_date BETWEEN date('now') AND date('now', '+90 day') THEN 1 ELSE 0 END) AS d90 FROM contracts c WHERE c.deleted_at IS NULL AND c.terminated_date IS NULL AND ${contractWhere}`).bind(...contractArgs).first(),
    DB.prepare(`SELECT MAX(p.updated_at) AS value FROM people p WHERE p.deleted_at IS NULL AND ${peopleWhere}`).bind(...peopleArgs).first<{ value: string | null }>(),
    DB.prepare(`SELECT MAX(c.updated_at) AS value FROM contracts c WHERE c.deleted_at IS NULL AND ${contractWhere}`).bind(...contractArgs).first<{ value: string | null }>(),
  ]);

  return json({
    filters: { organizationId: unit || null, contractType: contractType || null, status: contractState || null },
    peopleTotal: Number(peopleCount?.count ?? 0),
    peopleByStatus: byStatus.results ?? [],
    peopleByGender: byGender.results ?? [],
    peopleByDegree: byDegree.results ?? [],
    peopleByUnit: byUnit.results ?? [],
    contracts: Object.fromEntries(Object.entries(contractSummary ?? {}).map(([key, value]) => [key, Number(value ?? 0)])),
    expiring: Object.fromEntries(Object.entries(expiring ?? {}).map(([key, value]) => [key, Number(value ?? 0)])),
    lastUpdatedAt: [lastPeople?.value, lastContracts?.value].filter(Boolean).sort().at(-1) ?? null,
  });
}

export async function getV2Resource(request: Request, actor: Actor): Promise<Response | null> {
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") ?? "";
  if (!V2_GET_RESOURCES.has(resource)) return null;
  const { DB } = getBindings();
  requirePermission(actor, "view");

  if (resource === "dashboard_v2") return dashboardV2(request, actor);

  if (resource === "accounts") {
    requirePermission(actor, "admin");
    const rows = await DB.prepare("SELECT id, user_id AS userId, email, role, organization_scope AS organizationScope, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt FROM user_roles ORDER BY is_active DESC, lower(COALESCE(email, user_id)) LIMIT 20").all<Row>();
    return json({ rows: (rows.results ?? []).map((row) => ({ ...row, role: canonicalRole(String(row.role ?? "")) })), maximumActiveAccounts: 5 });
  }

  if (resource === "catalogs") {
    const scope = scopeSql(actor, "organization_id");
    const [organizations, positionsRows, academicYearRows] = await Promise.all([
      DB.prepare(`SELECT id, code, name, short_name AS shortName, level, parent_id AS parentId, status FROM organizations WHERE deleted_at IS NULL AND ${scopeSql(actor, "id").clause} ORDER BY name COLLATE NOCASE`).bind(...scopeSql(actor, "id").args).all(),
      DB.prepare(`SELECT id, code, name, position_type AS positionType, organization_id AS organizationId, description, status FROM positions WHERE deleted_at IS NULL AND (${scope.clause} OR organization_id IS NULL) ORDER BY name COLLATE NOCASE`).bind(...scope.args).all(),
      DB.prepare("SELECT id, code, name, start_date AS startDate, end_date AS endDate, is_current AS isCurrent FROM academic_years ORDER BY start_date DESC").all(),
    ]);
    return json({ organizations: organizations.results ?? [], positions: positionsRows.results ?? [], academicYears: academicYearRows.results ?? [], roles: CANONICAL_ROLES });
  }

  if (resource === "settings") {
    requirePermission(actor, "admin");
    const rows = await DB.prepare("SELECT key, value_json AS valueJson, updated_by AS updatedBy, updated_at AS updatedAt FROM system_settings ORDER BY key").all<{ key: string; valueJson: string; updatedBy: string; updatedAt: string }>();
    return json({ rows: (rows.results ?? []).map((row) => ({ ...row, value: JSON.parse(row.valueJson) })) });
  }

  requirePermission(actor, "restore");
  const limit = limitFrom(request);
  const personScope = scopeSql(actor, "organization_id");
  const contractScope = scopeSql(actor, "using_organization_id");
  const [peopleRows, contractRows, organizationRows, documentRows] = await Promise.all([
    DB.prepare(`SELECT id, 'person' AS entityType, full_name AS label, organization_id AS organizationId, deleted_at AS deletedAt FROM people WHERE deleted_at IS NOT NULL AND ${personScope.clause} ORDER BY deleted_at DESC LIMIT ?`).bind(...personScope.args, limit).all(),
    DB.prepare(`SELECT id, 'contract' AS entityType, COALESCE(contract_number, source_person_name) AS label, using_organization_id AS organizationId, deleted_at AS deletedAt FROM contracts WHERE deleted_at IS NOT NULL AND ${contractScope.clause} ORDER BY deleted_at DESC LIMIT ?`).bind(...contractScope.args, limit).all(),
    DB.prepare(`SELECT id, 'organization' AS entityType, name AS label, id AS organizationId, deleted_at AS deletedAt FROM organizations WHERE deleted_at IS NOT NULL AND ${scopeSql(actor, "id").clause} ORDER BY deleted_at DESC LIMIT ?`).bind(...scopeSql(actor, "id").args, limit).all(),
    DB.prepare("SELECT id, 'document_record' AS entityType, file_name AS label, NULL AS organizationId, deleted_at AS deletedAt FROM document_records WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ?").bind(limit).all(),
  ]);
  return json({ rows: [...(peopleRows.results ?? []), ...(contractRows.results ?? []), ...(organizationRows.results ?? []), ...(documentRows.results ?? [])].sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))).slice(0, limit) });
}

async function upsertOrganization(DB: D1Database, actor: Actor, body: Row, requestId: string) {
  const record = (body.record ?? {}) as Row;
  const code = cleanText(record.code ?? record.organizationCode, 100).toUpperCase();
  const name = cleanText(record.name ?? record.organizationName, 300);
  if (!code || !name) return json({ error: "Mã đơn vị và tên chính thức là bắt buộc." }, { status: 400 });
  const requestedId = cleanText(record.id, 100);
  const current = await DB.prepare("SELECT * FROM organizations WHERE id = ? OR code = ? LIMIT 1").bind(requestedId || "__new__", code).first<Row>();
  const id = String(current?.id ?? (requestedId || `org-${(await sha256Text(code)).slice(0, 24)}`));
  if (!current && scopeIds(actor).length) return json({ error: "Tài khoản giới hạn theo đơn vị không được tạo đơn vị mới." }, { status: 403 });
  if (current) await enforceOrganizationScope(DB, actor, id);
  const version = Number(record.version ?? current?.version ?? 0);
  if (current && Number(current.version) !== version) return json({ error: "Đơn vị đã được cập nhật ở nơi khác. Hãy tải lại trước khi lưu." }, { status: 409 });
  const parentId = cleanText(record.parentId, 100) || null;
  if (parentId === id) return json({ error: "Đơn vị không thể là đơn vị cha của chính nó." }, { status: 400 });
  if (parentId) {
    const parent = await DB.prepare("SELECT id FROM organizations WHERE id = ? AND deleted_at IS NULL").bind(parentId).first();
    if (!parent) return json({ error: "Không tìm thấy đơn vị cha đã chọn." }, { status: 400 });
  }
  const canonical = {
    id,
    code,
    name,
    shortName: cleanText(record.shortName, 100) || null,
    level: cleanText(record.level, 100) || "Đơn vị",
    parentId,
    managerPersonId: cleanText(record.managerPersonId, 100) || null,
    status: cleanText(record.status, 60) || "active",
  };
  const checksum = await recordChecksum(canonical);
  const statements: D1PreparedStatement[] = [];
  if (current) {
    statements.push(DB.prepare("UPDATE organizations SET code = ?, name = ?, short_name = ?, level = ?, parent_id = ?, manager_person_id = ?, status = ?, checksum = ?, version = version + 1, sync_state = 'synced', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(code, name, canonical.shortName, canonical.level, parentId, canonical.managerPersonId, canonical.status, checksum, id));
  } else {
    statements.push(DB.prepare("INSERT INTO organizations (id, code, name, short_name, level, parent_id, manager_person_id, status, checksum, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced')")
      .bind(id, code, name, canonical.shortName, canonical.level, parentId, canonical.managerPersonId, canonical.status, checksum));
  }
  statements.push(audit(DB, actor, current ? "update" : "create", "organization", id, current, canonical, cleanText(body.reason, 500), requestId));
  await DB.batch(statements);
  return json({ organization: canonical, version: Number(current?.version ?? 0) + 1, checksum }, { status: current ? 200 : 201 });
}

async function upsertPersonV2(DB: D1Database, actor: Actor, body: Row, requestId: string) {
  const record = (body.record ?? {}) as Row;
  const fullName = cleanText(record.fullName, 300);
  if (!fullName) return json({ error: "Họ và tên là trường bắt buộc." }, { status: 400 });
  const staffCode = cleanText(record.staffCode, 100) || null;
  const lecturerCode = cleanText(record.lecturerCode, 100) || null;
  const requestedId = cleanText(record.id, 120);
  const current = await DB.prepare("SELECT * FROM people WHERE id = ? OR (? IS NOT NULL AND staff_code = ?) OR (? IS NOT NULL AND lecturer_code = ?) LIMIT 1")
    .bind(requestedId || "__new__", staffCode, staffCode, lecturerCode, lecturerCode).first<Row>();
  const id = String(current?.id ?? (requestedId || crypto.randomUUID()));
  const birthDate = normalizeDate(record.birthDate);
  const startDate = normalizeDate(record.startDate);
  if (cleanText(record.birthDate, 80) && !birthDate) return json({ error: "Ngày sinh không hợp lệ. Dùng DD/MM/YYYY hoặc YYYY-MM-DD." }, { status: 400 });
  if (cleanText(record.startDate, 80) && !startDate) return json({ error: "Ngày bắt đầu công tác không hợp lệ." }, { status: 400 });
  const baseVersion = Number(record.version ?? current?.version ?? 0);
  if (current && Number(current.version) !== baseVersion) {
    const conflictId = crypto.randomUUID();
    await DB.prepare("INSERT INTO sync_conflicts (id, entity_type, entity_id, base_version, server_version, local_json, server_json, status) VALUES (?, 'person', ?, ?, ?, ?, ?, 'open')")
      .bind(conflictId, id, baseVersion, Number(current.version), jsonForStorage(record), jsonForStorage(current)).run();
    return json({ error: "Hồ sơ đã được sửa ở nơi khác. Xung đột đã được giữ lại để xử lý.", conflictId, server: current }, { status: 409 });
  }
  let organizationId = cleanText(record.organizationId, 120) || null;
  const organizationName = cleanText(record.organizationName ?? record.organization ?? record.unit, 300) || null;
  if (!organizationId && cleanText(record.organizationCode, 100)) {
    const organization = await DB.prepare("SELECT id, name FROM organizations WHERE code = ? AND deleted_at IS NULL").bind(cleanText(record.organizationCode, 100)).first<{ id: string; name: string }>();
    organizationId = organization?.id ?? null;
  }
  if (!organizationId && organizationName) {
    const organization = await DB.prepare("SELECT id FROM organizations WHERE lower(name) = lower(?) AND deleted_at IS NULL LIMIT 1").bind(organizationName).first<{ id: string }>();
    organizationId = organization?.id ?? null;
  }
  await enforceOrganizationScope(DB, actor, organizationId);
  for (const [column, value, label] of [["staff_code", staffCode, "Mã cán bộ"], ["lecturer_code", lecturerCode, "Mã giảng viên"], ["work_email", cleanText(record.workEmail, 300).toLowerCase() || null, "Email công vụ"]] as const) {
    if (!value) continue;
    const duplicate = await DB.prepare(`SELECT id FROM people WHERE lower(${column}) = lower(?) AND id <> ? AND deleted_at IS NULL LIMIT 1`).bind(value, id).first();
    if (duplicate) return json({ error: `${label} đã được dùng bởi hồ sơ khác.` }, { status: 409 });
  }
  const canonical = {
    id,
    staffCode,
    lecturerCode,
    personType: cleanText(record.personType, 100) || "Viên chức",
    fullName,
    normalizedName: normalizeName(fullName),
    birthDate,
    gender: cleanText(record.gender, 30) || null,
    organizationId,
    organizationNameSource: organizationName,
    department: cleanText(record.department, 300) || null,
    position: cleanText(record.position, 300) || null,
    professionalTitle: cleanText(record.professionalTitle, 300) || null,
    employmentStatus: cleanText(record.employmentStatus ?? record.status, 100) || "Đang công tác",
    startDate,
    phone: cleanText(record.phone, 60) || null,
    workEmail: cleanText(record.workEmail, 300).toLowerCase() || null,
    personalEmail: cleanText(record.personalEmail, 300).toLowerCase() || null,
    identityNumber: cleanText(record.identityNumber, 100) || null,
    taxCode: cleanText(record.taxCode, 100) || null,
    socialInsuranceNumber: cleanText(record.socialInsuranceNumber, 100) || null,
    homeTown: cleanText(record.homeTown, 500) || null,
    address: cleanText(record.address, 1_000) || null,
    specialization: cleanText(record.specialization, 500) || null,
    workArrangement: cleanText(record.workArrangement, 300) || null,
    notes: cleanText(record.notes, 5_000) || null,
  };
  const checksum = await recordChecksum(canonical);
  const values = [staffCode, lecturerCode, canonical.personType, fullName, canonical.normalizedName, birthDate, canonical.gender, organizationId, organizationName, canonical.department, canonical.position, canonical.professionalTitle, canonical.employmentStatus, startDate, canonical.phone, canonical.workEmail, canonical.personalEmail, canonical.identityNumber, canonical.taxCode, canonical.socialInsuranceNumber, canonical.homeTown, canonical.address, canonical.specialization, canonical.workArrangement, canonical.notes, checksum, actor.email];
  const statements: D1PreparedStatement[] = [];
  if (current) {
    statements.push(DB.prepare("UPDATE people SET staff_code=?, lecturer_code=?, person_type=?, full_name=?, normalized_name=?, birth_date=?, gender=?, organization_id=?, organization_name_source=?, department=?, position=?, professional_title=?, employment_status=?, start_date=?, phone=?, work_email=?, personal_email=?, identity_number=?, tax_code=?, social_insurance_number=?, home_town=?, address=?, specialization=?, work_arrangement=?, notes=?, checksum=?, updated_by=?, version=version+1, sync_state='synced', deleted_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(...values, id));
  } else {
    statements.push(DB.prepare("INSERT INTO people (id, staff_code, lecturer_code, person_type, full_name, normalized_name, birth_date, gender, organization_id, organization_name_source, department, position, professional_title, employment_status, start_date, phone, work_email, personal_email, identity_number, tax_code, social_insurance_number, home_town, address, specialization, work_arrangement, notes, checksum, updated_by, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced')").bind(id, ...values));
  }
  if ([record.degree, record.academicTitle, record.major, record.institution].some((value) => cleanText(value))) {
    const qualificationId = `qual-manual-${(await sha256Text(id)).slice(0, 24)}`;
    const qualification = { academicTitle: cleanText(record.academicTitle, 100) || null, degree: cleanText(record.degree, 100) || null, degreeYear: Number(record.degreeYear) || null, major: cleanText(record.major, 500) || null, disciplineGroup: cleanText(record.disciplineGroup, 200) || null, institution: cleanText(record.institution, 500) || null, country: cleanText(record.country, 300) || null, foreignLanguage: cleanText(record.foreignLanguage, 500) || null, informatics: cleanText(record.informatics, 500) || null, phdStatus: cleanText(record.phdStatus, 2_000) || null };
    statements.push(DB.prepare("INSERT INTO qualifications (id, person_id, academic_title, degree_level, degree_year, major, discipline_group, institution, country, foreign_language, informatics, phd_status, checksum, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced') ON CONFLICT(id) DO UPDATE SET academic_title=excluded.academic_title, degree_level=excluded.degree_level, degree_year=excluded.degree_year, major=excluded.major, discipline_group=excluded.discipline_group, institution=excluded.institution, country=excluded.country, foreign_language=excluded.foreign_language, informatics=excluded.informatics, phd_status=excluded.phd_status, checksum=excluded.checksum, version=qualifications.version+1, sync_state='synced', updated_at=CURRENT_TIMESTAMP")
      .bind(qualificationId, id, qualification.academicTitle, qualification.degree, qualification.degreeYear, qualification.major, qualification.disciplineGroup, qualification.institution, qualification.country, qualification.foreignLanguage, qualification.informatics, qualification.phdStatus, await recordChecksum(qualification)));
  }
  statements.push(audit(DB, actor, current ? "update" : "create", "person", id, current, canonical, cleanText(body.reason, 500), requestId));
  await runBatches(DB, statements);
  return json({ person: canonical, version: Number(current?.version ?? 0) + 1, checksum }, { status: current ? 200 : 201 });
}

async function upsertContract(DB: D1Database, actor: Actor, body: Row, requestId: string) {
  const record = (body.record ?? {}) as Row;
  const id = cleanText(record.id ?? record.contractId, 120) || crypto.randomUUID();
  const current = await DB.prepare("SELECT * FROM contracts WHERE id = ? LIMIT 1").bind(id).first<Row>();
  const personId = cleanText(record.personId, 120) || null;
  type ContractPerson = { id: string; fullName: string; birthDate: string | null; organizationId: string | null };
  let person: ContractPerson | null = null;
  if (personId) {
    person = await DB.prepare("SELECT id, full_name AS fullName, birth_date AS birthDate, organization_id AS organizationId FROM people WHERE id = ? AND deleted_at IS NULL").bind(personId).first<ContractPerson>();
    if (!person) return json({ error: "Không tìm thấy hồ sơ nhân sự được liên kết." }, { status: 400 });
  }
  const organizationId = cleanText(record.organizationId ?? record.usingOrganizationId, 120) || person?.organizationId || null;
  await enforceOrganizationScope(DB, actor, organizationId);
  const fullName = cleanText(record.fullName, 300) || person?.fullName || cleanText(current?.source_person_name, 300);
  if (!fullName) return json({ error: "Hợp đồng phải có người liên quan hoặc họ tên nguồn." }, { status: 400 });
  const contractType = cleanText(record.contractType, 200) || "Loại khác";
  const signedDate = normalizeDate(record.signedDate);
  const effectiveDate = normalizeDate(record.effectiveDate);
  const startDate = normalizeDate(record.startDate);
  const endDate = normalizeDate(record.endDate);
  const terminatedDate = normalizeDate(record.terminatedDate);
  for (const [field, raw, normalized] of [["Ngày ký", record.signedDate, signedDate], ["Ngày hiệu lực", record.effectiveDate, effectiveDate], ["Ngày bắt đầu", record.startDate, startDate], ["Ngày hết hạn", record.endDate, endDate], ["Ngày thanh lý", record.terminatedDate, terminatedDate]] as const) {
    if (cleanText(raw, 80) && !normalized) return json({ error: `${field} không hợp lệ. Dùng DD/MM/YYYY hoặc YYYY-MM-DD.` }, { status: 400 });
  }
  const logicalStart = startDate ?? effectiveDate;
  if (endDate && logicalStart && endDate < logicalStart) return json({ error: "Ngày hết hạn không được trước ngày bắt đầu/hiệu lực." }, { status: 400 });
  const indefinite = normalizeName(contractType).includes("khong xac dinh") || normalizeName(contractType).includes("kxdth");
  if (!indefinite && !endDate && !terminatedDate) return json({ error: "Hợp đồng có thời hạn phải có ngày hết hạn hoặc ngày thanh lý." }, { status: 400 });
  const baseVersion = Number(record.version ?? current?.version ?? 0);
  if (current && Number(current.version) !== baseVersion) {
    const conflictId = crypto.randomUUID();
    await DB.prepare("INSERT INTO sync_conflicts (id, entity_type, entity_id, base_version, server_version, local_json, server_json, status) VALUES (?, 'contract', ?, ?, ?, ?, ?, 'open')")
      .bind(conflictId, id, baseVersion, Number(current.version), jsonForStorage(record), jsonForStorage(current)).run();
    return json({ error: "Hợp đồng đã được sửa ở nơi khác. Xung đột đã được giữ lại để xử lý.", conflictId, server: current }, { status: 409 });
  }
  const contractNumber = cleanText(record.contractNumber, 200) || null;
  if (contractNumber) {
    const duplicate = await DB.prepare("SELECT id FROM contracts WHERE lower(contract_number) = lower(?) AND id <> ? AND deleted_at IS NULL LIMIT 1").bind(contractNumber, id).first();
    if (duplicate) return json({ error: "Số hợp đồng đã tồn tại ở một bản ghi khác." }, { status: 409 });
  }
  const identity = String(current?.source_identity_key ?? await sha256Text(`manual|${id}|${contractNumber ?? ""}|${contractType}|${fullName}`));
  const canonical = {
    id,
    personId,
    contractNumber,
    contractType,
    fullName,
    birthDate: normalizeDate(record.birthDate) ?? person?.birthDate ?? null,
    signer: cleanText(record.signer, 300) || null,
    signingOrganization: cleanText(record.signingOrganization, 500) || null,
    organizationId,
    organizationName: cleanText(record.organizationName ?? record.organization, 500) || null,
    roleOrSpecialty: cleanText(record.roleOrSpecialty, 500) || null,
    salaryCoefficient: cleanText(record.salaryCoefficient, 100) || null,
    signedDate,
    effectiveDate,
    startDate,
    endDate,
    durationMonths: Number(record.durationMonths) || null,
    periodText: cleanText(record.periodText, 1_000) || null,
    status: cleanText(record.status, 100) || contractStatus(contractType, endDate, terminatedDate),
    terminatedDate,
    terminationReason: cleanText(record.terminationReason, 2_000) || null,
    notes: cleanText(record.notes, 5_000) || null,
    sourceIdentityKey: identity,
  };
  const checksum = await recordChecksum(canonical);
  const values = [personId, contractNumber, contractType, fullName, canonical.birthDate, canonical.signer, canonical.signingOrganization, organizationId, canonical.organizationName, canonical.roleOrSpecialty, canonical.salaryCoefficient, signedDate, effectiveDate, startDate, endDate, canonical.durationMonths, canonical.periodText, canonical.status, terminatedDate, canonical.terminationReason, canonical.notes, identity, checksum, actor.email];
  const statements: D1PreparedStatement[] = [];
  if (current) {
    statements.push(DB.prepare("UPDATE contracts SET person_id=?, contract_number=?, contract_type=?, source_person_name=?, source_birth_date=?, signer=?, signing_organization=?, using_organization_id=?, using_organization_source=?, role_or_specialty=?, salary_coefficient=?, signed_date=?, effective_date=?, start_date=?, end_date=?, duration_months=?, period_text=?, status=?, terminated_date=?, termination_reason=?, notes=?, source_identity_key=?, checksum=?, updated_by=?, version=version+1, sync_state='synced', deleted_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(...values, id));
  } else {
    statements.push(DB.prepare("INSERT INTO contracts (id, person_id, contract_number, contract_type, source_person_name, source_birth_date, signer, signing_organization, using_organization_id, using_organization_source, role_or_specialty, salary_coefficient, signed_date, effective_date, start_date, end_date, duration_months, period_text, status, terminated_date, termination_reason, notes, source_identity_key, checksum, updated_by, version, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced')").bind(id, ...values));
  }
  statements.push(audit(DB, actor, current ? "update" : "create", "contract", id, current, canonical, cleanText(body.reason, 500), requestId));
  await DB.batch(statements);
  return json({ contract: canonical, version: Number(current?.version ?? 0) + 1, checksum }, { status: current ? 200 : 201 });
}

async function bulkUpdatePeople(DB: D1Database, actor: Actor, body: Row, requestId: string) {
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map((item) => cleanText(item, 120)).filter(Boolean))] : [];
  if (!ids.length || ids.length > 1_000) return json({ error: "Chọn từ 1 đến 1.000 hồ sơ cho mỗi lần cập nhật." }, { status: 400 });
  const changes = (body.changes ?? {}) as Row;
  const allowed: Record<string, { column: string; normalize: (value: unknown) => string | null }> = {
    personType: { column: "person_type", normalize: (value) => cleanText(value, 100) || null },
    employmentStatus: { column: "employment_status", normalize: (value) => cleanText(value, 100) || null },
    workArrangement: { column: "work_arrangement", normalize: (value) => cleanText(value, 300) || null },
    notes: { column: "notes", normalize: (value) => cleanText(value, 5_000) || null },
    organizationId: { column: "organization_id", normalize: (value) => cleanText(value, 120) || null },
  };
  const entries = Object.entries(changes).filter(([key]) => allowed[key]);
  if (!entries.length) return json({ error: "Chưa chọn trường hợp lệ để cập nhật hàng loạt." }, { status: 400 });
  const scope = scopeSql(actor, "organization_id");
  const existing = await DB.prepare(`SELECT id, organization_id AS organizationId FROM people WHERE id IN (${ids.map(() => "?").join(",")}) AND deleted_at IS NULL AND ${scope.clause}`).bind(...ids, ...scope.args).all<{ id: string; organizationId: string | null }>();
  if ((existing.results ?? []).length !== ids.length) return json({ error: "Một số hồ sơ không tồn tại hoặc nằm ngoài phạm vi được giao; chưa có dữ liệu nào bị đổi." }, { status: 403 });
  const targetOrganization = entries.find(([key]) => key === "organizationId");
  if (targetOrganization) await enforceOrganizationScope(DB, actor, allowed.organizationId.normalize(targetOrganization[1]));
  const setSql = entries.map(([key]) => `${allowed[key].column} = ?`).join(", ");
  const values = entries.map(([key, value]) => allowed[key].normalize(value));
  const statements = ids.map((id) => DB.prepare(`UPDATE people SET ${setSql}, updated_by = ?, version = version + 1, sync_state = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(...values, actor.email, id));
  statements.push(audit(DB, actor, "bulk_update", "person", null, { ids }, { changes, count: ids.length }, cleanText(body.reason, 500) || "Cập nhật hàng loạt có xác nhận", requestId));
  await runBatches(DB, statements);
  return json({ updated: ids.length, ids });
}

async function upsertAccount(DB: D1Database, actor: Actor, body: Row, requestId: string) {
  const record = (body.record ?? {}) as Row;
  const email = cleanText(record.email, 300).toLowerCase();
  const role = canonicalRole(cleanText(record.role, 100));
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Email tài khoản không hợp lệ." }, { status: 400 });
  if (!CANONICAL_ROLES.includes(role as (typeof CANONICAL_ROLES)[number])) return json({ error: "Vai trò không thuộc 4 vai trò chuẩn của hệ thống." }, { status: 400 });
  const isActive = record.isActive === false || record.isActive === 0 ? 0 : 1;
  const organizationScope = Array.isArray(record.organizationScope)
    ? JSON.stringify(record.organizationScope.map((item) => cleanText(item, 100)).filter(Boolean))
    : cleanText(record.organizationScope, 2_000) || null;
  const current = await DB.prepare("SELECT * FROM user_roles WHERE lower(email) = ? ORDER BY is_active DESC, created_at LIMIT 1").bind(email).first<Row>();
  if (isActive && (!current || !Number(current.is_active))) {
    const count = await DB.prepare("SELECT COUNT(DISTINCT lower(email)) AS count FROM user_roles WHERE is_active = 1 AND email IS NOT NULL").first<{ count: number }>();
    if (Number(count?.count ?? 0) >= 5) return json({ error: "Hệ thống chỉ cho phép tối đa 5 tài khoản Google đang hoạt động." }, { status: 409 });
  }
  if (current && canonicalRole(String(current.role ?? "")) === "Quản trị viên" && (!isActive || role !== "Quản trị viên")) {
    const administrators = await DB.prepare("SELECT COUNT(DISTINCT lower(email)) AS count FROM user_roles WHERE is_active = 1 AND role IN ('Quản trị viên','Quản trị hệ thống')").first<{ count: number }>();
    if (Number(administrators?.count ?? 0) <= 1) return json({ error: "Phải giữ ít nhất một Quản trị viên đang hoạt động." }, { status: 409 });
  }
  const id = String(current?.id ?? crypto.randomUUID());
  const userId = `user:${email}`;
  if (current) {
    await DB.batch([
      DB.prepare("UPDATE user_roles SET user_id = ?, email = ?, role = ?, organization_scope = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(userId, email, role, organizationScope, isActive, id),
      audit(DB, actor, "account_update", "user_role", id, current, { email, role, organizationScope, isActive: Boolean(isActive) }, cleanText(body.reason, 500), requestId),
    ]);
  } else {
    await DB.batch([
      DB.prepare("INSERT INTO user_roles (id, user_id, email, role, organization_scope, is_active) VALUES (?, ?, ?, ?, ?, ?)").bind(id, userId, email, role, organizationScope, isActive),
      audit(DB, actor, "account_create", "user_role", id, null, { email, role, organizationScope, isActive: Boolean(isActive) }, cleanText(body.reason, 500), requestId),
    ]);
  }
  return json({ account: { id, email, role, organizationScope, isActive: Boolean(isActive) } }, { status: current ? 200 : 201 });
}

async function saveSettings(DB: D1Database, actor: Actor, body: Row, requestId: string) {
  const input = (body.settings ?? {}) as Row;
  const rawThresholds = Array.isArray(input.alertThresholds) ? input.alertThresholds.map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= 365) : [7, 15, 30, 60, 90];
  const settings = {
    alertThresholds: [...new Set(rawThresholds)].sort((a, b) => a - b),
    undoMinutes: Math.max(1, Math.min(1440, Number(input.undoMinutes) || 30)),
    automaticBackupDays: Math.max(1, Math.min(365, Number(input.automaticBackupDays) || 7)),
    reminderFrequency: ["daily", "weekly"].includes(String(input.reminderFrequency)) ? String(input.reminderFrequency) : "daily",
    recipientGroup: cleanText(input.recipientGroup, 100) || "Theo đơn vị phụ trách",
  };
  const before = await DB.prepare("SELECT value_json AS valueJson FROM system_settings WHERE key = 'app'").first<{ valueJson: string }>();
  await DB.batch([
    DB.prepare("INSERT INTO system_settings (key, value_json, updated_by) VALUES ('app', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP").bind(jsonForStorage(settings), actor.email),
    audit(DB, actor, "settings_update", "system_settings", "app", before ? JSON.parse(before.valueJson) : null, settings, cleanText(body.reason, 500), requestId),
  ]);
  return json({ settings });
}

async function upsertPosition(DB: D1Database, actor: Actor, body: Row, requestId: string) {
  const record = (body.record ?? {}) as Row;
  const code = cleanText(record.code, 100).toUpperCase();
  const name = cleanText(record.name, 300);
  if (!code || !name) return json({ error: "Mã và tên chức vụ/chức danh là bắt buộc." }, { status: 400 });
  const current = await DB.prepare("SELECT * FROM positions WHERE id = ? OR code = ? LIMIT 1").bind(cleanText(record.id, 120) || "__new__", code).first<Row>();
  const id = String(current?.id ?? (cleanText(record.id, 120) || `position-${(await sha256Text(code)).slice(0, 20)}`));
  const organizationId = cleanText(record.organizationId, 120) || null;
  await enforceOrganizationScope(DB, actor, organizationId);
  const canonical = { id, code, name, positionType: cleanText(record.positionType, 100) || "Chức vụ", organizationId, description: cleanText(record.description, 1_000) || null, status: cleanText(record.status, 50) || "active" };
  await DB.batch([
    DB.prepare("INSERT INTO positions (id, code, name, position_type, organization_id, description, status) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET code=excluded.code, name=excluded.name, position_type=excluded.position_type, organization_id=excluded.organization_id, description=excluded.description, status=excluded.status, deleted_at=NULL, updated_at=CURRENT_TIMESTAMP").bind(id, code, name, canonical.positionType, organizationId, canonical.description, canonical.status),
    audit(DB, actor, current ? "update" : "create", "position", id, current, canonical, cleanText(body.reason, 500), requestId),
  ]);
  return json({ position: canonical }, { status: current ? 200 : 201 });
}

async function upsertAcademicYear(DB: D1Database, actor: Actor, body: Row, requestId: string) {
  const record = (body.record ?? {}) as Row;
  const code = cleanText(record.code, 50);
  const name = cleanText(record.name, 100) || code;
  const startDate = normalizeDate(record.startDate);
  const endDate = normalizeDate(record.endDate);
  if (!code || !startDate || !endDate || endDate < startDate) return json({ error: "Năm học cần mã, ngày bắt đầu và ngày kết thúc hợp lệ." }, { status: 400 });
  const current = await DB.prepare("SELECT * FROM academic_years WHERE id = ? OR code = ? LIMIT 1").bind(cleanText(record.id, 120) || "__new__", code).first<Row>();
  const id = String(current?.id ?? (cleanText(record.id, 120) || `year-${(await sha256Text(code)).slice(0, 20)}`));
  const isCurrent = record.isCurrent ? 1 : 0;
  const statements: D1PreparedStatement[] = [];
  if (isCurrent) statements.push(DB.prepare("UPDATE academic_years SET is_current = 0 WHERE id <> ?").bind(id));
  statements.push(DB.prepare("INSERT INTO academic_years (id, code, name, start_date, end_date, is_current) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET code=excluded.code, name=excluded.name, start_date=excluded.start_date, end_date=excluded.end_date, is_current=excluded.is_current, updated_at=CURRENT_TIMESTAMP").bind(id, code, name, startDate, endDate, isCurrent));
  statements.push(audit(DB, actor, current ? "update" : "create", "academic_year", id, current, { id, code, name, startDate, endDate, isCurrent: Boolean(isCurrent) }, cleanText(body.reason, 500), requestId));
  await DB.batch(statements);
  return json({ academicYear: { id, code, name, startDate, endDate, isCurrent: Boolean(isCurrent) } }, { status: current ? 200 : 201 });
}

const RESTORE_TABLES = [
  "organizations", "people", "qualifications", "training_records", "training_commitments", "person_assignments",
  "employment_events", "organization_history", "contracts", "document_records", "alerts", "source_imports",
  "import_errors", "mapping_templates", "snapshots", "sync_conflicts", "positions", "academic_years", "system_settings",
] as const;

async function restoreBackup(DB: D1Database, actor: Actor, body: Row, requestId: string) {
  const backup = body.backup as Row | undefined;
  if (!backup || backup.format !== "ued-organization-backup" || Number(backup.version) !== 3) return json({ error: "Bản sao lưu không đúng định dạng UED phiên bản 3." }, { status: 400 });
  const suppliedChecksum = cleanText(backup.checksum, 128).toLowerCase();
  const withoutChecksum = { ...backup };
  delete withoutChecksum.checksum;
  const calculated = await sha256Text(stableStringify(withoutChecksum));
  if (suppliedChecksum !== calculated) return json({ error: "Checksum bản sao lưu không khớp; chưa ghi bất kỳ dữ liệu nào." }, { status: 400 });
  const totalRows = RESTORE_TABLES.reduce((sum, table) => sum + (Array.isArray(backup[table]) ? (backup[table] as unknown[]).length : 0), 0);
  if (totalRows > 50_000) return json({ error: "Bản sao lưu vượt quá giới hạn 50.000 bản ghi cho một lần khôi phục." }, { status: 413 });
  const statements: D1PreparedStatement[] = [];
  const restored: Record<string, number> = {};
  for (const table of RESTORE_TABLES) {
    const rows = Array.isArray(backup[table]) ? backup[table] as Row[] : [];
    if (!rows.length) { restored[table] = 0; continue; }
    const info = await DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string; pk: number }>();
    const allowed = new Set((info.results ?? []).map((column) => column.name));
    const primary = (info.results ?? []).find((column) => Number(column.pk) === 1)?.name ?? "id";
    for (const row of rows) {
      const columns = Object.keys(row).filter((key) => allowed.has(key));
      if (!columns.includes(primary)) return json({ error: `Bản sao lưu thiếu khóa ${primary} tại bảng ${table}.` }, { status: 400 });
      const updateColumns = columns.filter((column) => column !== primary);
      const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT(${primary}) ${updateColumns.length ? `DO UPDATE SET ${updateColumns.map((column) => `${column}=excluded.${column}`).join(",")}` : "DO NOTHING"}`;
      statements.push(DB.prepare(sql).bind(...columns.map((column) => row[column] ?? null)));
    }
    restored[table] = rows.length;
  }
  const snapshotId = `snapshot-before-restore-${Date.now()}`;
  statements.unshift(DB.prepare("INSERT INTO snapshots (id, period_year, period_month, scope, record_counts_json, checksum, created_by) VALUES (?, ?, NULL, 'pre-restore', ?, ?, ?)")
    .bind(snapshotId, new Date().getUTCFullYear(), jsonForStorage({ restoringRows: totalRows }), calculated, actor.email));
  statements.push(audit(DB, actor, "restore_backup", "system", snapshotId, null, { restored, totalRows, checksum: calculated }, cleanText(body.reason, 500) || "Khôi phục có kiểm tra", requestId));
  await runBatches(DB, statements);
  return json({ restored, totalRows, checksum: calculated, snapshotId });
}

const LIFECYCLE_TABLES: Record<string, { table: string; organizationColumn?: string }> = {
  person: { table: "people", organizationColumn: "organization_id" },
  organization: { table: "organizations", organizationColumn: "id" },
  contract: { table: "contracts", organizationColumn: "using_organization_id" },
  assignment: { table: "person_assignments", organizationColumn: "organization_id" },
  training: { table: "training_records" },
  commitment: { table: "training_commitments" },
  employment_event: { table: "employment_events" },
  document_record: { table: "document_records" },
  position: { table: "positions", organizationColumn: "organization_id" },
};

async function bulkLifecycle(DB: D1Database, actor: Actor, action: string, body: Row, requestId: string) {
  const entityType = cleanText(body.entityType, 50);
  const target = LIFECYCLE_TABLES[entityType];
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map((item) => cleanText(item, 120)).filter(Boolean))] : [];
  if (!target || !ids.length || ids.length > 1_000) return json({ error: "Thiếu loại bản ghi hoặc danh sách 1–1.000 mã hợp lệ." }, { status: 400 });
  const scope = target.organizationColumn ? scopeSql(actor, target.organizationColumn) : { clause: scopeIds(actor).length ? "0 = 1" : "1 = 1", args: [] as string[] };
  const rows = await DB.prepare(`SELECT * FROM ${target.table} WHERE id IN (${ids.map(() => "?").join(",")}) AND ${scope.clause}`).bind(...ids, ...scope.args).all<Row>();
  if ((rows.results ?? []).length !== ids.length) return json({ error: "Một số bản ghi không tồn tại hoặc nằm ngoài phạm vi; chưa thay đổi dữ liệu." }, { status: 403 });
  const deleting = action === "bulk_delete";
  const undoing = action === "undo_delete";
  if (undoing && (rows.results ?? []).some((row) => !row.deleted_at || Date.now() - Date.parse(String(row.deleted_at).replace(" ", "T") + "Z") > 30 * 60_000)) {
    return json({ error: "Chỉ có thể hoàn tác bản ghi đã xóa trong 30 phút gần nhất." }, { status: 409 });
  }
  const statements = ids.map((id) => DB.prepare(`UPDATE ${target.table} SET deleted_at = ${deleting ? "CURRENT_TIMESTAMP" : "NULL"}${"version" in ((rows.results ?? [])[0] ?? {}) ? ", version = version + 1" : ""}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id));
  statements.push(audit(DB, actor, deleting ? "bulk_soft_delete" : undoing ? "undo_delete" : "bulk_restore", entityType, null, { ids }, { count: ids.length, deleted: deleting }, cleanText(body.reason, 500), requestId));
  await runBatches(DB, statements);
  return json({ ids, count: ids.length, deleted: deleting, undoWindowMinutes: 30 });
}

export async function mutateV2(DB: D1Database, actor: Actor, action: string, body: Row, requestId: string): Promise<Response | null> {
  if (!V2_WRITABLE_ACTIONS.has(action)) return null;
  requirePermission(actor, permissionForV2Action(action));
  if (action === "upsert_person") return upsertPersonV2(DB, actor, body, requestId);
  if (action === "upsert_organization") return upsertOrganization(DB, actor, body, requestId);
  if (action === "upsert_contract") return upsertContract(DB, actor, body, requestId);
  if (action === "bulk_update_people") return bulkUpdatePeople(DB, actor, body, requestId);
  if (action === "upsert_account") return upsertAccount(DB, actor, body, requestId);
  if (action === "save_settings") return saveSettings(DB, actor, body, requestId);
  if (action === "upsert_position") return upsertPosition(DB, actor, body, requestId);
  if (action === "upsert_academic_year") return upsertAcademicYear(DB, actor, body, requestId);
  if (action === "restore_backup") return restoreBackup(DB, actor, body, requestId);
  return bulkLifecycle(DB, actor, action, body, requestId);
}
