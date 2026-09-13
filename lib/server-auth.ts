import { env } from "cloudflare:workers";

export type AppBindings = {
  DB: D1Database;
  BUCKET?: R2Bucket;
};

export type Actor = {
  id: string;
  email: string;
  role: string;
  organizationScope: string | null;
};

export type Permission = "view" | "view_sensitive" | "write" | "import" | "export" | "approve" | "restore" | "admin";

export const CANONICAL_ROLES = ["Quản trị viên", "Người nhập liệu", "Người kiểm tra", "Người chỉ xem"] as const;

const LEGACY_ROLE_MAP: Record<string, (typeof CANONICAL_ROLES)[number]> = {
  "Quản trị hệ thống": "Quản trị viên",
  "Trưởng phòng": "Người kiểm tra",
  "Cán bộ Phòng Tổ chức": "Người nhập liệu",
  "Người xem/báo cáo": "Người chỉ xem",
  "Kiểm toán": "Người chỉ xem",
};

const ROLE_PERMISSIONS: Record<string, ReadonlySet<Permission>> = {
  "Quản trị viên": new Set(["view", "view_sensitive", "write", "import", "export", "approve", "restore", "admin"]),
  "Người nhập liệu": new Set(["view", "view_sensitive", "write", "import", "export"]),
  "Người kiểm tra": new Set(["view", "view_sensitive", "export", "approve"]),
  "Người chỉ xem": new Set(["view", "export"]),
};

export function canonicalRole(role: string) {
  if (CANONICAL_ROLES.includes(role as (typeof CANONICAL_ROLES)[number])) return role;
  return LEGACY_ROLE_MAP[role] ?? role;
}

export function getBindings() {
  const bindings = env as unknown as AppBindings;
  if (!bindings.DB) throw new Error("CSDL trung tâm chưa được gắn với ứng dụng.");
  return bindings;
}

function localPreviewEmail(request: Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "terminal.local"
    ? "local-preview@ued.udn.vn"
    : null;
}

export async function resolveActor(request: Request): Promise<Actor> {
  const { DB } = getBindings();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? localPreviewEmail(request);
  if (!email) throw new Response(JSON.stringify({ error: "Bạn cần đăng nhập bằng tài khoản đã được cấp quyền." }), { status: 401, headers: { "content-type": "application/json; charset=utf-8" } });

  const id = `user:${email}`;
  const roleRow = await DB.prepare(
    "SELECT role, organization_scope AS organizationScope FROM user_roles WHERE (user_id = ? OR lower(email) = ?) AND is_active = 1 ORDER BY CASE role WHEN 'Quản trị viên' THEN 1 WHEN 'Quản trị hệ thống' THEN 1 WHEN 'Người kiểm tra' THEN 2 WHEN 'Trưởng phòng' THEN 2 ELSE 3 END LIMIT 1",
  ).bind(id, email).first<{ role: string; organizationScope: string | null }>();

  if (roleRow) return { id, email, role: canonicalRole(roleRow.role), organizationScope: roleRow.organizationScope };

  const countRow = await DB.prepare("SELECT COUNT(*) AS count FROM user_roles WHERE is_active = 1").first<{ count: number }>();
  if (Number(countRow?.count ?? 0) === 0) {
    await DB.prepare(
      "INSERT INTO user_roles (id, user_id, email, role, organization_scope, is_active) VALUES (?, ?, ?, 'Quản trị viên', NULL, 1)",
    ).bind(crypto.randomUUID(), id, email).run();
    return { id, email, role: "Quản trị viên", organizationScope: null };
  }

  throw new Response(JSON.stringify({ error: "Tài khoản chưa được Quản trị viên cấp quyền truy cập." }), {
    status: 403,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function hasPermission(actor: Actor, permission: Permission) {
  return ROLE_PERMISSIONS[actor.role]?.has(permission) ?? false;
}

export function requirePermission(actor: Actor, permission: Permission) {
  if (hasPermission(actor, permission)) return;
  throw new Response(JSON.stringify({ error: `Vai trò “${actor.role}” không có quyền thực hiện thao tác này.` }), {
    status: 403,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function responseFromThrown(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Lỗi máy chủ không xác định.";
  const migrationHint = /no such table/i.test(message)
    ? " CSDL chưa được khởi tạo; hãy áp dụng migration trước khi sử dụng."
    : "";
  return Response.json({ error: `${message}${migrationHint}` }, { status: 500 });
}
