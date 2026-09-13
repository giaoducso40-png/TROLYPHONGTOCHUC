import { readFile } from "node:fs/promises";
import vm from "node:vm";

let xlsxPromise;

export async function getXlsx() {
  xlsxPromise ??= (async () => {
    const source = await readFile(new URL("../public/vendor/xlsx.full.min.js", import.meta.url), "utf8");
    const sandbox = { console, Uint8Array, ArrayBuffer, Buffer, Date, Math, JSON, setTimeout, clearTimeout };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    vm.runInNewContext(source, sandbox, { filename: "xlsx.full.min.js" });
    if (!sandbox.XLSX) throw new Error("Không nạp được bộ đọc Excel cục bộ.");
    return sandbox.XLSX;
  })();
  return xlsxPromise;
}

export async function readWorkbook(filePath) {
  const XLSX = await getXlsx();
  return XLSX.read(await readFile(filePath), { type: "buffer", raw: true, cellDates: false });
}

export async function sheetRows(workbook, sheetName) {
  const XLSX = await getXlsx();
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
}

export function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalize(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export async function normalizeExcelDate(value) {
  if (value === null || value === undefined || value === "") return null;
  let year;
  let month;
  let day;
  if (typeof value === "number") {
    const XLSX = await getXlsx();
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    ({ y: year, m: month, d: day } = parsed);
  } else if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
    day = value.getUTCDate();
  } else {
    const text = clean(value);
    const vi = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
    if (vi) [day, month, year] = [Number(vi[1]), Number(vi[2]), Number(vi[3])];
    else if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    else return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function staffName(row) {
  return clean(`${clean(row[1])} ${clean(row[2])}`);
}

export function isStaffDataRow(row) {
  const name = staffName(row);
  const normalized = normalize(name);
  return Boolean(name) && !normalized.startsWith("danh sach tren co") && !normalized.startsWith("tong cong") && normalized !== "ho va ten" && normalized !== "ho ten";
}

export function stripAcademicPrefix(value) {
  const text = clean(value);
  const prefix = text.match(/^\s*((?:(?:PGS|GS|TS|THS|TH\.S)\.?\s*)+)/i)?.[1] ?? "";
  return prefix ? text.slice(prefix.length).replace(/^[\s,.-]+/, "").trim() : text;
}

export function contractStartRow(sheetName) {
  return ["HDLV XĐTH", "HDLV KXDTH"].includes(sheetName) ? 1 : 3;
}

export function isContractDataRow(row) {
  const name = clean(row[1]);
  const normalized = normalize(name);
  return Boolean(name) && normalized !== "ho ten" && normalized !== "ho va ten" && !normalized.startsWith("tong cong") && !normalized.startsWith("danh sach");
}

export function contractNumberIndex(sheetName) {
  if (sheetName === "HDLV XĐTH") return 9;
  if (sheetName === "HDLV KXDTH") return 7;
  if (sheetName === "HD THINH GIANG") return 8;
  return 7;
}
