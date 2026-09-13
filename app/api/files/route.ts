import { cleanText, sha256Text } from "@/lib/server-data";
import { getBindings, requirePermission, resolveActor, responseFromThrown, type Actor } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function safeFileName(value: string) {
  return value.replace(/[\u0000-\u001f\u007f/\\]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 240) || "tep-khong-ten";
}

function actorScope(actor: Actor) {
  const raw = actor.organizationScope?.trim();
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch {
    // Hỗ trợ phạm vi được lưu bởi phiên bản trước.
  }
  return raw.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

async function assertOwnerAccess(DB: D1Database, actor: Actor, ownerEntityType: string, ownerEntityId: string) {
  if (!['person', 'contract'].includes(ownerEntityType)) {
    throw new Response(JSON.stringify({ error: "Tệp chỉ được gắn trực tiếp với hồ sơ nhân sự hoặc hợp đồng." }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
  }
  const table = ownerEntityType === "person" ? "people" : "contracts";
  const organizationColumn = ownerEntityType === "person" ? "organization_id" : "using_organization_id";
  const owner = await DB.prepare(`SELECT id, ${organizationColumn} AS organizationId FROM ${table} WHERE id = ? AND deleted_at IS NULL`).bind(ownerEntityId).first<{ id: string; organizationId: string | null }>();
  if (!owner) throw new Response(JSON.stringify({ error: "Không tìm thấy hồ sơ đích để gắn tệp." }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
  const scope = actorScope(actor);
  if (scope.length && (!owner.organizationId || !scope.includes(owner.organizationId))) {
    throw new Response(JSON.stringify({ error: "Hồ sơ tệp nằm ngoài phạm vi đơn vị được giao." }), { status: 403, headers: { "content-type": "application/json; charset=utf-8" } });
  }
  return owner;
}

async function checksumBuffer(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  try {
    const actor = await resolveActor(request);
    requirePermission(actor, "view");
    const { DB, BUCKET } = getBindings();
    const url = new URL(request.url);
    const id = cleanText(url.searchParams.get("id"), 100);
    const ownerType = cleanText(url.searchParams.get("ownerEntityType"), 50);
    const ownerId = cleanText(url.searchParams.get("ownerEntityId"), 100);

    if (id && url.searchParams.get("download") === "1") {
      if (!BUCKET) return Response.json({ error: "Kho tệp chưa được gắn với ứng dụng." }, { status: 503 });
      const metadata = await DB.prepare("SELECT storage_key AS storageKey, file_name AS fileName, content_type AS contentType, owner_entity_type AS ownerEntityType, owner_entity_id AS ownerEntityId FROM file_records WHERE id = ? AND deleted_at IS NULL")
        .bind(id).first<{ storageKey: string; fileName: string; contentType: string; ownerEntityType: string; ownerEntityId: string }>();
      if (!metadata) return Response.json({ error: "Không tìm thấy tệp hoặc tệp đã được xóa mềm." }, { status: 404 });
      await assertOwnerAccess(DB, actor, metadata.ownerEntityType, metadata.ownerEntityId);
      const object = await BUCKET.get(metadata.storageKey);
      if (!object) return Response.json({ error: "Tệp vật lý không còn trong kho; metadata vẫn được giữ để đối soát." }, { status: 404 });
      return new Response(object.body, {
        headers: {
          "content-type": metadata.contentType,
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(metadata.fileName)}`,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    if ((ownerType && !ownerId) || (!ownerType && ownerId)) return Response.json({ error: "Cần truyền đồng thời loại và mã hồ sơ." }, { status: 400 });
    if (ownerType && ownerId) await assertOwnerAccess(DB, actor, ownerType, ownerId);
    const scope = actorScope(actor);
    const scopeClause = scope.length ? `AND COALESCE(p.organization_id, c.using_organization_id) IN (${scope.map(() => "?").join(",")})` : "";
    const result = await DB.prepare(`SELECT f.id, f.owner_entity_type AS ownerEntityType, f.owner_entity_id AS ownerEntityId, f.file_name AS fileName, f.content_type AS contentType, f.size_bytes AS sizeBytes, f.checksum, f.file_version AS fileVersion, f.replaces_file_id AS replacesFileId, f.uploaded_by AS uploadedBy, f.created_at AS createdAt FROM file_records f LEFT JOIN people p ON f.owner_entity_type = 'person' AND p.id = f.owner_entity_id LEFT JOIN contracts c ON f.owner_entity_type = 'contract' AND c.id = f.owner_entity_id WHERE f.deleted_at IS NULL AND f.owner_entity_type IN ('person','contract') ${ownerType ? "AND f.owner_entity_type = ? AND f.owner_entity_id = ?" : ""} ${scopeClause} ORDER BY f.created_at DESC LIMIT 100`)
      .bind(...(ownerType ? [ownerType, ownerId] : []), ...scope).all();
    return Response.json({ rows: result.results ?? [] }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseFromThrown(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await resolveActor(request);
    requirePermission(actor, "write");
    const { DB, BUCKET } = getBindings();
    if (!BUCKET) return Response.json({ error: "Kho tệp chưa được gắn với ứng dụng." }, { status: 503 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Chưa chọn tệp để tải lên." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) return Response.json({ error: "Tệp phải có dung lượng từ 1 byte đến 15 MB." }, { status: 413 });
    const fileName = safeFileName(file.name);
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    const expectedType = MIME_BY_EXTENSION[extension];
    if (!expectedType) return Response.json({ error: "Định dạng chưa được phép. Chỉ nhận PDF, DOCX, XLS/XLSX, CSV và ảnh PNG/JPG/WEBP." }, { status: 415 });
    const suppliedType = cleanText(file.type, 150);
    const compatibleTypes: Record<string, string[]> = {
      xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/x-zip-compressed", "multipart/x-zip"],
      docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/x-zip-compressed", "multipart/x-zip"],
      jpg: ["image/jpeg", "image/jpg"],
      jpeg: ["image/jpeg", "image/jpg"],
    };
    if (suppliedType && suppliedType !== "application/octet-stream" && !(compatibleTypes[extension] ?? [expectedType]).includes(suppliedType)) {
      return Response.json({ error: "Loại nội dung của tệp không khớp phần mở rộng." }, { status: 415 });
    }

    const ownerEntityType = cleanText(form.get("ownerEntityType"), 50);
    const ownerEntityId = cleanText(form.get("ownerEntityId"), 100);
    if (!ownerEntityType || !ownerEntityId) return Response.json({ error: "Tệp phải được gắn với loại và mã hồ sơ." }, { status: 400 });
    await assertOwnerAccess(DB, actor, ownerEntityType, ownerEntityId);

    const replacesFileId = cleanText(form.get("replacesFileId"), 100) || null;
    let fileVersion = 1;
    if (replacesFileId) {
      const previous = await DB.prepare("SELECT owner_entity_type AS ownerEntityType, owner_entity_id AS ownerEntityId, file_version AS fileVersion FROM file_records WHERE id = ? AND deleted_at IS NULL").bind(replacesFileId).first<{ ownerEntityType: string; ownerEntityId: string; fileVersion: number }>();
      if (!previous || previous.ownerEntityType !== ownerEntityType || previous.ownerEntityId !== ownerEntityId) return Response.json({ error: "Tệp thay thế phải cùng hồ sơ và còn hiệu lực." }, { status: 400 });
      fileVersion = Number(previous.fileVersion ?? 1) + 1;
    }

    const buffer = await file.arrayBuffer();
    const checksum = await checksumBuffer(buffer);
    const id = crypto.randomUUID();
    const ownerHash = (await sha256Text(`${ownerEntityType}|${ownerEntityId}`)).slice(0, 18);
    const storageKey = `records/${ownerEntityType}/${ownerHash}/${id}/${fileName}`;
    await BUCKET.put(storageKey, buffer, {
      httpMetadata: { contentType: expectedType },
      customMetadata: { checksum, ownerEntityType, ownerEntityId, uploadedBy: actor.email },
    });
    try {
      await DB.batch([
        DB.prepare("INSERT INTO file_records (id, owner_entity_type, owner_entity_id, storage_key, file_name, content_type, size_bytes, checksum, file_version, replaces_file_id, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, ownerEntityType, ownerEntityId, storageKey, fileName, expectedType, file.size, checksum, fileVersion, replacesFileId, actor.email),
        DB.prepare("INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, after_json, changed_fields, reason, request_id) VALUES (?, ?, ?, 'upload_file', 'file', ?, ?, 'fileName,sizeBytes,checksum,owner', 'Tải tệp minh chứng', ?)")
          .bind(crypto.randomUUID(), actor.id, actor.email, id, JSON.stringify({ fileName, sizeBytes: file.size, checksum, ownerEntityType, ownerEntityId }), crypto.randomUUID()),
      ]);
    } catch (error) {
      await BUCKET.delete(storageKey);
      throw error;
    }
    return Response.json({ file: { id, fileName, contentType: expectedType, sizeBytes: file.size, checksum, fileVersion, replacesFileId, ownerEntityType, ownerEntityId } }, { status: 201 });
  } catch (error) {
    return responseFromThrown(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await resolveActor(request);
    requirePermission(actor, "write");
    const { DB } = getBindings();
    const id = cleanText(new URL(request.url).searchParams.get("id"), 100);
    if (!id) return Response.json({ error: "Thiếu mã tệp." }, { status: 400 });
    const before = await DB.prepare("SELECT id, file_name AS fileName, storage_key AS storageKey, owner_entity_type AS ownerEntityType, owner_entity_id AS ownerEntityId FROM file_records WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: string; fileName: string; storageKey: string; ownerEntityType: string; ownerEntityId: string }>();
    if (!before) return Response.json({ error: "Không tìm thấy tệp." }, { status: 404 });
    await assertOwnerAccess(DB, actor, before.ownerEntityType, before.ownerEntityId);
    await DB.batch([
      DB.prepare("UPDATE file_records SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id),
      DB.prepare("INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, before_json, reason, request_id) VALUES (?, ?, ?, 'soft_delete', 'file', ?, ?, 'Xóa mềm tệp; vật lý được giữ để khôi phục', ?)")
        .bind(crypto.randomUUID(), actor.id, actor.email, id, JSON.stringify(before), crypto.randomUUID()),
    ]);
    return Response.json({ id, deleted: true, recoverable: true });
  } catch (error) {
    return responseFromThrown(error);
  }
}
