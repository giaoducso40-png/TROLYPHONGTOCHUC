export function cleanText(value: unknown, maxLength = 5_000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeName(value: unknown) {
  return cleanText(value, 300)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function normalizeDate(value: unknown): string | null {
  const text = cleanText(value, 40);
  if (!text) return null;
  let year: number;
  let month: number;
  let day: number;
  const vi = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  if (vi) [day, month, year] = [Number(vi[1]), Number(vi[2]), Number(vi[3])];
  else if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function sha256Text(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function recordChecksum(value: unknown) {
  return sha256Text(stableStringify(value));
}

export function contractStatus(type: string, endDate: string | null, terminatedDate: string | null) {
  if (terminatedDate) return "đã thanh lý";
  if (!endDate) return normalizeName(type).includes("khong xac dinh") ? "đang hiệu lực" : "chờ bổ sung";
  const today = new Date();
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const days = Math.round((end - current) / 86_400_000);
  if (days < 0) return "đã hết hạn";
  if (days <= 90) return "sắp hết hạn";
  return "đang hiệu lực";
}

export function jsonForStorage(value: unknown, maxLength = 200_000) {
  const output = stableStringify(value);
  return output.length <= maxLength ? output : output.slice(0, maxLength);
}

