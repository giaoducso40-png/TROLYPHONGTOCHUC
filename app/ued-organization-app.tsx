"use client";

import * as React from "react";
import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  ArchiveRestore,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Cloud,
  CloudOff,
  Columns3,
  Database,
  Download,
  FileArchive,
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  Files,
  FileText,
  Filter,
  GraduationCap,
  History,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserCog,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { flushOutbox, getOutbox, sendOrQueue } from "@/lib/offline-sync";
import {
  V2AdminView,
  V2ContractsView,
  V2DocumentsView,
  V2OrganizationsView,
  V2PeopleView,
  V2ReportsView,
  V2SyncView,
} from "@/app/v2-workspace-views";
import {
  SOURCE_AS_OF,
  contractMap,
  contractTypes,
  dataMap,
  degreeDistribution,
  demoAlerts,
  monthlyWorkforce,
  qualityFindings,
  sourceFiles,
  syntheticContracts,
  syntheticPeople,
} from "@/lib/source-profile";

declare global {
  interface Window {
    XLSX?: XlsxRuntime;
    docx?: DocxRuntime;
    pdfMake?: PdfMakeRuntime;
  }
}

type XlsxWorkbookLike = { SheetNames: string[]; Sheets: Record<string, unknown> };
type XlsxRuntime = {
  read: (data: ArrayBuffer, options: Record<string, unknown>) => XlsxWorkbookLike;
  SSF?: { parse_date_code: (value: number) => { d: number; m: number; y: number } | null };
  utils: {
    sheet_to_json: (sheet: unknown, options: Record<string, unknown>) => unknown[][];
    json_to_sheet: (rows: unknown[]) => unknown;
    book_new: () => unknown;
    book_append_sheet: (workbook: unknown, sheet: unknown, name: string) => void;
  };
  writeFile: (workbook: unknown, fileName: string) => void;
};
type ValueConstructor = new (value: unknown) => unknown;
type DocxRuntime = {
  Document: ValueConstructor;
  Paragraph: ValueConstructor;
  ImageRun: ValueConstructor;
  TextRun: ValueConstructor;
  Table: ValueConstructor;
  TableRow: ValueConstructor;
  TableCell: ValueConstructor;
  AlignmentType: { CENTER: string };
  WidthType: { PERCENTAGE: string };
  Packer: { toBlob: (document: unknown) => Promise<Blob> };
};
type PdfMakeRuntime = {
  createPdf: (definition: unknown, tableLayouts?: unknown, fonts?: unknown, vfs?: unknown) => { download: (fileName: string) => void };
};

type ViewKey =
  | "dashboard"
  | "people"
  | "organizations"
  | "contracts"
  | "changes"
  | "education"
  | "documents"
  | "imports"
  | "reports"
  | "quality"
  | "alerts"
  | "audit"
  | "admin"
  | "sync";

type CurrentUser = { name: string; email: string; role: string };
type ImportEntityType = "people" | "organizations" | "assignments" | "contracts" | "training" | "commitments" | "events" | "documents";
type PersonRow = {
  id: string;
  staffCode: string;
  fullName: string;
  birthDate: string;
  gender: string;
  unit: string;
  position: string;
  degree: string;
  status: string;
  sync: string;
  version?: number;
};
type ContractRow = {
  id: string;
  number: string;
  person: string;
  type: string;
  unit: string;
  start: string;
  end: string;
  status: string;
  days: number | null;
};

type WorkspaceData = {
  actor?: { email: string; role: string; organizationScope: string | null };
  people: PersonRow[];
  peopleRaw: Array<Record<string, unknown>>;
  contracts: ContractRow[];
  contractsRaw: Array<Record<string, unknown>>;
  organizations: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
  training: Array<Record<string, unknown>>;
  commitments: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
  alerts: Array<{ id: string; severity: string; title: string; subject: string; due: string; days: number | null; assignee: string; status: string }>;
  audit: Array<{ id: string; time: string; action: string; entity: string; actor: string; result: string }>;
  imports: Array<Record<string, unknown>>;
  accounts: Array<Record<string, unknown>>;
  catalogs: { positions: Array<Record<string, unknown>>; academicYears: Array<Record<string, unknown>>; roles: string[] };
  settings: Array<Record<string, unknown>>;
  trash: Array<Record<string, unknown>>;
  dashboardV2: Record<string, unknown> | null;
  dashboard: null | {
    counts: {
      people: number;
      contracts: number;
      organizations: number;
      qualifications: number;
      training: number;
      commitments: number;
      documents: number;
      openConflicts: number;
      unlinkedContracts: number;
      brokenContractLinks: number;
      brokenTrainingLinks: number;
      brokenCommitmentLinks: number;
      brokenDocumentLinks: number;
      duplicateStaffCodes: number;
    };
    activeContracts: number;
    expiring90: number;
    expiredContracts: number;
    missingContractNumber: number;
    completedImports: number;
    passed: boolean;
    checksum: string;
  };
  connected: boolean;
};

type WorkbookState = {
  file: File;
  checksum: string;
  workbook: XlsxWorkbookLike;
  sheets: string[];
  activeSheet: string;
  rows: unknown[][];
  headerRow: number;
  headerDepth: number;
  entityType: ImportEntityType;
  mappings: string[];
};

const navGroups: Array<{ label: string; items: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }> }> = [
  {
    label: "Điều hành",
    items: [
      { key: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
      { key: "alerts", label: "Thông báo – Cảnh báo", icon: Bell, badge: "12" },
    ],
  },
  {
    label: "Nghiệp vụ",
    items: [
      { key: "people", label: "Hồ sơ nhân sự", icon: Users },
      { key: "organizations", label: "Đơn vị tổ chức", icon: Building2 },
      { key: "contracts", label: "Hợp đồng", icon: FileText },
      { key: "changes", label: "Biến động", icon: ChartNoAxesCombined },
      { key: "education", label: "Trình độ – Đào tạo", icon: GraduationCap },
      { key: "documents", label: "Tệp và minh chứng", icon: Files },
    ],
  },
  {
    label: "Dữ liệu – Báo cáo",
    items: [
      { key: "imports", label: "Trung tâm nhập dữ liệu", icon: Upload },
      { key: "reports", label: "Báo cáo", icon: FileSpreadsheet },
      { key: "quality", label: "Chất lượng dữ liệu", icon: ClipboardCheck, badge: "5" },
      { key: "audit", label: "Nhật ký hoạt động", icon: History },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { key: "admin", label: "Danh mục – Phân quyền", icon: UserCog },
      { key: "sync", label: "Sao lưu – Đồng bộ", icon: Database },
    ],
  },
];

const viewMeta: Record<ViewKey, { title: string; description: string }> = {
  dashboard: { title: "Tổng quan điều hành", description: "Số liệu truy ngược được theo kỳ, đơn vị và nguồn dữ liệu." },
  people: { title: "Hồ sơ nhân sự", description: "Quản lý hồ sơ cán bộ, viên chức và người lao động theo mã định danh ổn định." },
  organizations: { title: "Đơn vị tổ chức", description: "Danh mục khoa, phòng, trung tâm và lịch sử thay đổi cơ cấu." },
  contracts: { title: "Hợp đồng", description: "Theo dõi toàn bộ vòng đời hợp đồng và cảnh báo thời hạn." },
  changes: { title: "Biến động theo kỳ", description: "So sánh tháng, năm và truy xuất hồ sơ tăng, giảm, chuyển đơn vị." },
  education: { title: "Trình độ – Đào tạo", description: "Học hàm, học vị, nghiên cứu sinh và quá trình đào tạo trong/ngoài nước." },
  documents: { title: "Tệp hồ sơ và minh chứng", description: "Lưu tệp theo hồ sơ, phân quyền và kiểm soát phiên bản." },
  imports: { title: "Trung tâm nhập dữ liệu", description: "Nhận diện → ánh xạ → xem trước → kiểm tra → xác nhận ghi." },
  reports: { title: "Báo cáo", description: "Lập báo cáo theo bộ lọc và xuất XLSX, CSV, DOCX, PDF hoặc bản in." },
  quality: { title: "Kiểm tra chất lượng dữ liệu", description: "Phát hiện thiếu, trùng, sai liên kết và sai logic trước khi duyệt." },
  alerts: { title: "Thông báo – Cảnh báo", description: "Theo dõi thời hạn, lỗi dữ liệu và giao việc xử lý." },
  audit: { title: "Nhật ký hoạt động", description: "Ghi người thực hiện, thời gian, giá trị trước/sau và lý do." },
  admin: { title: "Danh mục – Tài khoản – Phân quyền", description: "Phân quyền theo vai trò, đơn vị và nhóm hồ sơ." },
  sync: { title: "Sao lưu – Đồng bộ", description: "Đối soát số lượng, khóa, phiên bản và checksum sau mỗi đợt." },
};

const unitData = [
  { name: "Lý – Hóa", total: 46 },
  { name: "Sử – Địa – Chính trị", total: 44 },
  { name: "Ngữ văn – Truyền thông", total: 42 },
  { name: "Toán – Tin", total: 39 },
  { name: "GD Tiểu học – Mầm non", total: 39 },
  { name: "Sinh – NN – MT", total: 25 },
  { name: "TL – GD – CTXH", total: 25 },
  { name: "Phòng Hành chính", total: 23 },
];

const roleMatrix = [
  { role: "Quản trị hệ thống", view: true, edit: true, import: true, export: true, approve: true, restore: true },
  { role: "Trưởng phòng", view: true, edit: false, import: false, export: true, approve: true, restore: false },
  { role: "Cán bộ Phòng Tổ chức", view: true, edit: true, import: true, export: true, approve: false, restore: false },
  { role: "Người nhập liệu", view: true, edit: true, import: true, export: false, approve: false, restore: false },
  { role: "Người xem/báo cáo", view: true, edit: false, import: false, export: true, approve: false, restore: false },
  { role: "Kiểm toán", view: true, edit: false, import: false, export: false, approve: false, restore: false },
];

const canonicalFields = [
  { value: "ignore", label: "Bỏ qua cột" },
  { value: "personId", label: "Mã hồ sơ nhân sự" },
  { value: "staffCode", label: "Mã cán bộ/viên chức" },
  { value: "lecturerCode", label: "Mã giảng viên" },
  { value: "personType", label: "Loại nhân sự" },
  { value: "organizationCode", label: "Mã đơn vị" },
  { value: "organizationName", label: "Tên chính thức đơn vị" },
  { value: "shortName", label: "Tên viết tắt đơn vị" },
  { value: "organizationLevel", label: "Cấp đơn vị" },
  { value: "parentOrganizationCode", label: "Mã đơn vị cha" },
  { value: "managerStaffCode", label: "Mã người phụ trách" },
  { value: "organizationStatus", label: "Trạng thái đơn vị" },
  { value: "fullName", label: "Họ và tên" },
  { value: "birthDate", label: "Ngày sinh" },
  { value: "gender", label: "Giới tính" },
  { value: "organization", label: "Đơn vị" },
  { value: "position", label: "Chức vụ/chuyên môn" },
  { value: "assignmentId", label: "Mã phân công" },
  { value: "assignmentType", label: "Loại phân công" },
  { value: "assignmentTitle", label: "Tên chức vụ/chức danh" },
  { value: "assignmentStatus", label: "Trạng thái phân công" },
  { value: "politicalRole", label: "Đảng/đoàn thể/HĐT" },
  { value: "professionalTitle", label: "Chức danh nghề nghiệp" },
  { value: "academicTitle", label: "Học hàm" },
  { value: "academicTitleYear", label: "Năm công nhận học hàm" },
  { value: "degree", label: "Học vị/trình độ" },
  { value: "degreeYear", label: "Năm tốt nghiệp" },
  { value: "major", label: "Ngành/chuyên ngành" },
  { value: "disciplineGroup", label: "Khối ngành" },
  { value: "country", label: "Quốc gia đào tạo" },
  { value: "foreignLanguage", label: "Ngoại ngữ" },
  { value: "informatics", label: "Tin học" },
  { value: "phdStatus", label: "Tình trạng NCS" },
  { value: "workEmail", label: "Email công vụ" },
  { value: "phone", label: "Điện thoại" },
  { value: "personalEmail", label: "Email cá nhân" },
  { value: "identityNumber", label: "CCCD/định danh" },
  { value: "taxCode", label: "Mã số thuế" },
  { value: "socialInsuranceNumber", label: "Mã bảo hiểm xã hội" },
  { value: "homeTown", label: "Quê quán" },
  { value: "address", label: "Địa chỉ liên hệ" },
  { value: "specialization", label: "Chuyên môn" },
  { value: "workArrangement", label: "Bố trí làm việc" },
  { value: "department", label: "Khoa/phòng/bộ môn" },
  { value: "employmentStatus", label: "Tình trạng công tác" },
  { value: "contractNumber", label: "Số hợp đồng" },
  { value: "contractId", label: "Mã hợp đồng" },
  { value: "contractType", label: "Loại hợp đồng" },
  { value: "signingOrganization", label: "Đơn vị công tác/đơn vị ký" },
  { value: "signer", label: "Người ký" },
  { value: "roleOrSpecialty", label: "Chức danh/chuyên môn" },
  { value: "salaryCoefficient", label: "Hệ số lương" },
  { value: "signedDate", label: "Ngày ký" },
  { value: "effectiveDate", label: "Ngày hiệu lực" },
  { value: "startDate", label: "Ngày bắt đầu" },
  { value: "endDate", label: "Ngày hết hạn" },
  { value: "durationMonths", label: "Số tháng" },
  { value: "periodText", label: "Thời gian hợp đồng" },
  { value: "contractStatus", label: "Trạng thái hợp đồng" },
  { value: "terminatedDate", label: "Ngày thanh lý" },
  { value: "terminationReason", label: "Lý do thanh lý" },
  { value: "trainingId", label: "Mã quá trình đào tạo" },
  { value: "overseasStudyId", label: "Mã đợt học tập" },
  { value: "trainingType", label: "Loại đào tạo" },
  { value: "programName", label: "Tên chương trình" },
  { value: "institution", label: "Cơ sở đào tạo/tiếp nhận" },
  { value: "countryScope", label: "Phạm vi trong/ngoài nước" },
  { value: "fundingSource", label: "Nguồn kinh phí" },
  { value: "trainingStatus", label: "Tình trạng đào tạo" },
  { value: "commitmentId", label: "Mã cam kết" },
  { value: "relatedTrainingId", label: "Mã quá trình đào tạo liên quan" },
  { value: "amount", label: "Số tiền" },
  { value: "dueDate", label: "Hạn thực hiện" },
  { value: "commitmentStatus", label: "Tình trạng cam kết" },
  { value: "completedDate", label: "Ngày hoàn thành" },
  { value: "eventId", label: "Mã biến động" },
  { value: "eventType", label: "Loại biến động" },
  { value: "fromOrganizationCode", label: "Mã đơn vị cũ" },
  { value: "toOrganizationCode", label: "Mã đơn vị mới" },
  { value: "decisionNumber", label: "Số quyết định/văn bản" },
  { value: "oldValueJson", label: "Giá trị cũ (JSON)" },
  { value: "newValueJson", label: "Giá trị mới (JSON)" },
  { value: "reason", label: "Lý do" },
  { value: "fileRecordId", label: "Mã tệp/hồ sơ" },
  { value: "ownerEntityType", label: "Loại hồ sơ liên kết" },
  { value: "ownerEntityId", label: "Mã hồ sơ liên kết" },
  { value: "fileType", label: "Loại tài liệu" },
  { value: "fileName", label: "Tên tệp" },
  { value: "documentNumber", label: "Số văn bản" },
  { value: "documentDate", label: "Ngày văn bản" },
  { value: "version", label: "Phiên bản" },
  { value: "notes", label: "Ghi chú" },
];

const importEntityOptions: Array<{ value: ImportEntityType; label: string }> = [
  { value: "people", label: "Hồ sơ nhân sự" },
  { value: "organizations", label: "Đơn vị tổ chức" },
  { value: "assignments", label: "Chức vụ/phân công" },
  { value: "contracts", label: "Hợp đồng" },
  { value: "training", label: "Đào tạo/nghiên cứu sinh" },
  { value: "commitments", label: "Cam kết/hoàn trả kinh phí" },
  { value: "events", label: "Biến động/quyết định" },
  { value: "documents", label: "Danh mục hồ sơ liên quan" },
];

const officialTemplates = [
  { name: "Mẫu 01 – Cán bộ, giảng viên", href: "/templates/UED_MAU_01_CAN_BO_GIANG_VIEN_V2.xlsx" },
  { name: "Mẫu 02 – Đơn vị, chức vụ", href: "/templates/UED_MAU_02_DON_VI_CHUC_VU_V2.xlsx" },
  { name: "Mẫu 03 – Hợp đồng", href: "/templates/UED_MAU_03_HOP_DONG_V2.xlsx" },
  { name: "Mẫu 04 – Đào tạo, cam kết", href: "/templates/UED_MAU_04_DAO_TAO_CAM_KET_V2.xlsx" },
  { name: "Mẫu 05 – Biến động, hồ sơ", href: "/templates/UED_MAU_05_BIEN_DONG_HO_SO_V2.xlsx" },
] as const;

const importPreviewFields: Record<ImportEntityType, Array<{ key: string; label: string }>> = {
  people: [{ key: "staffCode", label: "Mã cán bộ" }, { key: "fullName", label: "Họ và tên" }, { key: "birthDate", label: "Ngày sinh" }, { key: "organization", label: "Đơn vị" }],
  organizations: [{ key: "organizationCode", label: "Mã đơn vị" }, { key: "organizationName", label: "Tên đơn vị" }, { key: "organizationLevel", label: "Cấp" }, { key: "organizationStatus", label: "Trạng thái" }],
  assignments: [{ key: "staffCode", label: "Mã cán bộ" }, { key: "fullName", label: "Họ và tên" }, { key: "assignmentTitle", label: "Chức vụ/chức danh" }, { key: "endDate", label: "Ngày kết thúc" }],
  contracts: [{ key: "fullName", label: "Họ và tên" }, { key: "contractNumber", label: "Số HĐ" }, { key: "contractType", label: "Loại HĐ" }, { key: "endDate", label: "Ngày hết hạn" }],
  training: [{ key: "fullName", label: "Họ và tên" }, { key: "trainingType", label: "Loại đào tạo" }, { key: "institution", label: "Cơ sở đào tạo" }, { key: "trainingStatus", label: "Trạng thái" }],
  commitments: [{ key: "fullName", label: "Họ và tên" }, { key: "decisionNumber", label: "Số quyết định" }, { key: "dueDate", label: "Hạn thực hiện" }, { key: "commitmentStatus", label: "Trạng thái" }],
  events: [{ key: "fullName", label: "Họ và tên" }, { key: "eventType", label: "Loại biến động" }, { key: "effectiveDate", label: "Ngày hiệu lực" }, { key: "decisionNumber", label: "Số quyết định" }],
  documents: [{ key: "fileRecordId", label: "Mã hồ sơ" }, { key: "fileName", label: "Tên tệp" }, { key: "ownerEntityType", label: "Loại liên kết" }, { key: "ownerEntityId", label: "Mã liên kết" }],
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function formatCell(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toLocaleDateString("vi-VN");
  if (typeof value === "number" && value > 20_000 && value < 80_000 && typeof window !== "undefined" && window.XLSX?.SSF?.parse_date_code) {
    const parsed = window.XLSX.SSF.parse_date_code(value);
    if (parsed) return `${String(parsed.d).padStart(2, "0")}/${String(parsed.m).padStart(2, "0")}/${parsed.y}`;
  }
  return normalizeText(value);
}

function excelColumnName(index: number) {
  let value = index + 1;
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

function detectHeaderDepth(fileName: string, sheet: string) {
  const file = normalizeForMatch(fileName);
  const normalizedSheet = normalizeForMatch(sheet);
  if (file.includes("nam 2026") && /^(t0?[1-6])$/.test(normalizedSheet)) return 2;
  if (file.includes("nam 2026") && /^(t0?[78])$/.test(normalizedSheet)) return 3;
  if (normalizedSheet === "thanh cap nhat") return 3;
  if (normalizedSheet === "ds vc da & dang hoc tap o nn" || normalizedSheet === "den bu chi phi dao tao") return 2;
  if (normalizedSheet === "tot nghiep o nn") return 0;
  return 1;
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function detectHeaderRow(rows: unknown[][]) {
  const keywords = ["họ tên", "họ và tên", "số tt", "stt", "ngày sinh", "đơn vị", "số hđ", "mã cán bộ"];
  let best = { index: 0, score: -1 };
  rows.slice(0, 25).forEach((row, index) => {
    const normalized = row.map(normalizeForMatch);
    const keywordHits = normalized.filter((cell) => keywords.some((keyword) => cell.includes(normalizeForMatch(keyword)))).length;
    const populated = normalized.filter(Boolean).length;
    const score = keywordHits * 8 + Math.min(populated, 20);
    if (score > best.score) best = { index, score };
  });
  return best.index + 1;
}

function inferEntity(fileName: string, sheet: string): ImportEntityType {
  const sheetKey = normalizeForMatch(sheet).replace(/[_-]+/g, " ");
  const key = normalizeForMatch(`${fileName} ${sheet}`).replace(/[_-]+/g, " ");
  if (sheetKey === "don vi" || sheetKey.includes("don vi to chuc")) return "organizations";
  if (sheetKey === "chuc vu" || sheetKey.includes("phan cong")) return "assignments";
  if (sheetKey.includes("cam ket") || sheetKey.includes("hoan tra")) return "commitments";
  if (sheetKey.includes("bien dong")) return "events";
  if (sheetKey.includes("ho so") || sheetKey.includes("quyet dinh")) return "documents";
  if (sheetKey.includes("dao tao") || sheetKey.includes("ncs")) return "training";
  if (sheetKey.includes("hop dong")) return "contracts";
  if (key.includes("don vi v1")) return "organizations";
  if (key.includes("chuc vu v1")) return "assignments";
  if (key.includes("hoan tra kp") || key.includes("den bu chi phi")) return "commitments";
  if (key.includes("bien dong v1")) return "events";
  if (key.includes("ho so v1")) return "documents";
  if (key.includes("dao tao ncs") || key.includes("hoc tap nn") || key.includes("hoc tap o nn") || key.includes("tot nghiep o nn")) return "training";
  if (key.includes("hop dong") || key.includes("hdlv") || key.includes("hdld") || key.includes("thinh giang") || key.includes("hd ")) return "contracts";
  return "people";
}

function suggestMapping(header: string, index: number, state: Pick<WorkbookState, "file" | "activeSheet" | "entityType">) {
  const h = normalizeForMatch(header);
  const directCode = header.split("|")[0]?.trim();
  if (canonicalFields.some((field) => field.value === directCode)) return directCode;
  const source = normalizeForMatch(`${state.file.name} ${state.activeSheet}`);
  const staffMonthly = source.includes("nam 2026") && /^t0?\d$/i.test(state.activeSheet);
  if (staffMonthly) {
    const modern = /^(t0?[78])$/i.test(state.activeSheet);
    const fixed: Record<number, string> = modern
      ? { 1: "fullName", 2: "fullName", 3: "birthDate", 4: "birthDate", 5: "organization", 6: "position", 36: "major", 37: "disciplineGroup", 38: "institution", 39: "foreignLanguage", 40: "informatics", 41: "phdStatus", 42: "notes" }
      : /^t0?6$/i.test(state.activeSheet)
        ? { 1: "fullName", 2: "fullName", 3: "birthDate", 4: "birthDate", 5: "organization", 6: "position", 24: "major", 25: "disciplineGroup", 26: "institution", 27: "foreignLanguage", 28: "informatics", 29: "phdStatus", 30: "notes" }
        : { 1: "fullName", 2: "fullName", 3: "birthDate", 4: "birthDate", 5: "organization", 6: "position", 24: "major", 25: "institution", 26: "foreignLanguage", 27: "informatics", 28: "phdStatus", 29: "notes" };
    if (fixed[index]) return fixed[index];
    if (index >= 7 && index <= 11) return "politicalRole";
    if (index >= 12 && index <= 17) return "professionalTitle";
    if (index >= 18 && index <= 19) return "academicTitle";
    if (index >= 20 && index <= 23) return "degree";
  }
  if (normalizeForMatch(state.activeSheet) === "tot nghiep o nn") {
    return ({ 1: "fullName", 2: "fullName", 3: "birthDate", 4: "birthDate", 5: "organization", 6: "position" } as Record<number, string>)[index] ?? "ignore";
  }
  if (state.activeSheet === "HD THINH GIANG") {
    if (index === 3) return "degree";
    if (index === 4) return "major";
    if (index === 5) return "signingOrganization";
    if (index === 7) return "organization";
  }
  if (h.includes("ma can bo") || h.includes("ma vien chuc")) return "staffCode";
  if (/ho.*ten|ho va ten/.test(h)) return "fullName";
  if (h.includes("ngay sinh") || h.includes("nam sinh")) return "birthDate";
  if (h.includes("gioi tinh")) return "gender";
  if (h.includes("don vi") || h.includes("khoa giang day")) return "organization";
  if (h.includes("chuc vu")) return "position";
  if (h.includes("chuyen mon") && state.entityType === "contracts") return "roleOrSpecialty";
  if (h.includes("chuc danh")) return "professionalTitle";
  if (h.includes("hoc ham")) return "academicTitle";
  if (h.includes("trinh do") || h.includes("hoc vi")) return "degree";
  if (h.includes("chuyen nganh") || h.includes("nganh dao tao")) return "major";
  if (h.includes("noi dao tao") || h.includes("co so dao tao")) return "institution";
  if (h.includes("quoc gia") || h === "nuoc") return "country";
  if (h.includes("ngoai ngu")) return "foreignLanguage";
  if (h.includes("tin hoc")) return "informatics";
  if (h.includes("ncs")) return "phdStatus";
  if (h.includes("so hd") || h.includes("so hop dong")) return "contractNumber";
  if (h.includes("loai hop dong")) return "contractType";
  if (h.includes("ngay ky")) return "signedDate";
  if (h.includes("hieu luc")) return "effectiveDate";
  if (h.includes("het han")) return "endDate";
  if (h.includes("so thang")) return "durationMonths";
  if (h.includes("thoi gian hop dong")) return "periodText";
  if (h.includes("ghi chu")) return "notes";
  return "ignore";
}

function makeHeaders(rows: unknown[][], headerRow: number, depth: number) {
  if (depth === 0) {
    const count = Math.max(0, ...rows.slice(0, 25).map((row) => row.reduce((last, value, index) => normalizeText(value) ? index + 1 : last, 0) as number));
    return Array.from({ length: count }, (_, index) => `Cột ${excelColumnName(index)} (không có tiêu đề nguồn)`);
  }
  const layers = Array.from({ length: depth }, (_, layer) => rows[headerRow - 1 + layer] ?? []);
  const count = Math.max(0, ...layers.map((layer) => layer.length));
  const carry = Array.from({ length: depth }, () => "");
  return Array.from({ length: count }, (_, index) => {
    const labels = layers.map((layer, layerIndex) => {
      const value = normalizeText(layer[index]);
      if (value) carry[layerIndex] = value;
      return value || carry[layerIndex];
    });
    return labels.filter((label, labelIndex) => label && labels.indexOf(label) === labelIndex).join(" / ") || `Cột ${index + 1}`;
  });
}

function canonicalRows(state: WorkbookState) {
  const dataStart = state.headerRow - 1 + state.headerDepth;
  const headers = makeHeaders(state.rows, state.headerRow, state.headerDepth);
  const sourceKey = normalizeForMatch(`${state.file.name} ${state.activeSheet}`);
  const staffMonthly = sourceKey.includes("nam 2026") && /^t0?\d$/i.test(state.activeSheet);
  const knownUedSource = sourceKey.includes("nam 2026") || sourceKey.includes("thong ke hop dong");
  const output: Array<Record<string, unknown>> = [];
  for (let sourceIndex = dataStart; sourceIndex < state.rows.length; sourceIndex += 1) {
    const row = state.rows[sourceIndex] ?? [];
    if (!row.some((value) => normalizeText(value))) continue;
    if (state.activeSheet === "HD THINH GIANG" && Number(row[0]) >= 2000 && !normalizeText(row[1])) continue;
    if (knownUedSource) {
      const sourceName = normalizeText(row[1]);
      const normalizedSourceName = normalizeForMatch(sourceName);
      if (!sourceName || normalizedSourceName.startsWith("danh sach tren co") || normalizedSourceName.startsWith("tong cong")) continue;
    }
    const record: Record<string, unknown> = { sourceRow: sourceIndex + 1 };
    state.mappings.forEach((target, columnIndex) => {
      if (!target || target === "ignore") return;
      const value = row[columnIndex];
      if (value === null || value === undefined || value === "") return;
      const formatted = ["birthDate", "signedDate", "effectiveDate", "startDate", "endDate", "terminatedDate", "dueDate", "completedDate", "documentDate"].includes(target) ? formatCell(value) : normalizeText(value);
      if (!formatted) return;

      if (staffMonthly && target === "professionalTitle" && columnIndex >= 12 && columnIndex <= 17) {
        const label = ["GVCC", "GVC", "GV", "CV", "NĐ 111", "NLĐ"][columnIndex - 12];
        record.professionalTitle = record.professionalTitle ? `${record.professionalTitle} · ${label}` : label;
        return;
      }
      if (staffMonthly && target === "academicTitle" && columnIndex >= 18 && columnIndex <= 19) {
        record.academicTitle = columnIndex === 18 ? "GS" : "PGS";
        if (/^\d{4}$/.test(formatted)) record.academicTitleYear = Number(formatted);
        return;
      }
      if (staffMonthly && target === "degree" && columnIndex >= 20 && columnIndex <= 23) {
        record.degree = ["Tiến sĩ", "Thạc sĩ", "Đại học", "Khác"][columnIndex - 20];
        if (/^\d{4}$/.test(formatted)) record.degreeYear = Number(formatted);
        return;
      }
      if (record[target]) {
        if (target === "birthDate") return;
        const separator = target === "fullName" ? " " : " · ";
        if (!String(record[target]).includes(formatted)) record[target] = `${record[target]}${separator}${formatted}`.trim();
      } else {
        record[target] = formatted;
      }
      if (target === "birthDate" && sourceKey.includes("nam 2026")) {
        if (columnIndex === 3) record.gender = "Nam";
        if (columnIndex === 4) record.gender = "Nữ";
      }
    });
    if (staffMonthly && /^(t0?[78])$/i.test(state.activeSheet)) {
      const levels = [
        { level: "Tiến sĩ", start: 24 },
        { level: "Thạc sĩ", start: 28 },
        { level: "Đại học", start: 32 },
      ];
      record.educationHistory = levels.flatMap(({ level, start }) => {
        const values = row.slice(start, start + 4).map(formatCell);
        return values.some(Boolean) ? [{ level, year: values[0], major: values[1], country: values[2], foreignLanguage: values[3] }] : [];
      });
    }
    if (state.entityType === "contracts") {
      const sheetMap: Record<string, string> = {
        "HDLV XĐTH": "Xác định thời hạn",
        "HDLV KXDTH": "Không xác định thời hạn",
        "HDLD NGHI HUU TD CAO": "Giảng viên trình độ cao đã nghỉ hưu",
        "HOP DONG HOC VIEC": "Học việc",
        "HDLD CM-NV": "Chuyên môn – nghiệp vụ",
        "HD THINH GIANG": "Thỉnh giảng",
      };
      record.contractType = record.contractType || sheetMap[state.activeSheet] || "Loại khác";
      if (!record.roleOrSpecialty && (record.degree || record.major)) record.roleOrSpecialty = [record.degree, record.major].filter(Boolean).join(" · ");
      if (state.activeSheet === "HDLD NGHI HUU TD CAO" && record.fullName) {
        const rawName = String(record.fullName);
        const prefix = rawName.match(/^\s*((?:(?:PGS|GS|TS|THS|TH\.S)\.?\s*)+)/i)?.[1] ?? "";
        if (prefix) {
          record.rawPersonName = rawName;
          record.fullName = rawName.slice(prefix.length).replace(/^[\s,.-]+/, "").trim();
          if (/PGS/i.test(prefix)) record.academicTitle = "PGS";
          else if (/GS/i.test(prefix)) record.academicTitle = "GS";
          if (/TS/i.test(prefix)) record.degree = "Tiến sĩ";
          else if (/THS|TH\.S/i.test(prefix)) record.degree = "Thạc sĩ";
          record.roleOrSpecialty = [record.academicTitle, record.degree, record.major].filter(Boolean).join(" · ");
        }
      }
    }
    record.sourceFile = state.file.name;
    record.sourceSheet = state.activeSheet;
    let lastMeaningful = -1;
    row.forEach((value, index) => {
      if (normalizeText(value)) lastMeaningful = index;
    });
    record.rawData = {
      headers: headers.slice(0, lastMeaningful + 1),
      cells: row.slice(0, lastMeaningful + 1).map(formatCell),
    };
    output.push(record);
  }
  return output;
}

function validateRows(rows: Array<Record<string, unknown>>, entityType: ImportEntityType) {
  const issues: Array<{ row: number; field: string; severity: "Lỗi" | "Cảnh báo"; message: string; fix: string }> = [];
  const seen = new Map<string, number>();
  const seenStaffCodes = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  const seenPhones = new Map<string, number>();
  const toDate = (value: unknown) => {
    const text = normalizeText(value);
    if (!text) return null;
    const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (match) {
      const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
      return date.getUTCFullYear() === Number(match[3]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[1]) ? date : null;
    }
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!iso) return null;
    const date = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(date.valueOf()) ? null : date;
  };
  rows.forEach((record) => {
    const row = Number(record.sourceRow);
    if (entityType !== "people" && entityType !== "contracts") {
      const requiredByType: Record<Exclude<ImportEntityType, "people" | "contracts">, Array<[string, string]>> = {
        organizations: [["organizationCode", "Mã đơn vị"], ["organizationName", "Tên chính thức"], ["organizationLevel", "Cấp đơn vị"], ["organizationStatus", "Trạng thái"], ["effectiveDate", "Ngày hiệu lực"]],
        assignments: [["assignmentType", "Loại phân công"], ["assignmentTitle", "Tên chức vụ/chức danh"], ["assignmentStatus", "Trạng thái"]],
        training: [["trainingStatus", "Tình trạng đào tạo"]],
        commitments: [["commitmentStatus", "Tình trạng cam kết"]],
        events: [["eventType", "Loại biến động"], ["effectiveDate", "Ngày hiệu lực"]],
        documents: [["fileRecordId", "Mã tệp"], ["ownerEntityType", "Loại hồ sơ liên kết"], ["ownerEntityId", "Mã hồ sơ liên kết"], ["fileType", "Loại tài liệu"], ["fileName", "Tên tệp"], ["version", "Phiên bản"]],
      };
      for (const [field, label] of requiredByType[entityType]) {
        if (!normalizeText(record[field])) issues.push({ row, field: label, severity: "Lỗi", message: `Thiếu trường bắt buộc “${label}”.`, fix: "Bổ sung giá trị hoặc bỏ qua dòng." });
      }
      if (["assignments", "training", "commitments", "events"].includes(entityType)) {
        const hasPersonLink = Boolean(normalizeText(record.personId)) || Boolean(normalizeText(record.staffCode)) || Boolean(normalizeText(record.fullName) && normalizeText(record.birthDate));
        if (!hasPersonLink) issues.push({ row, field: "Liên kết cán bộ", severity: "Lỗi", message: "Thiếu personId, mã cán bộ hoặc cặp họ tên + ngày sinh để đối chiếu.", fix: "Ưu tiên bổ sung personId hoặc mã cán bộ ổn định." });
      }
      const dateFields = ["birthDate", "effectiveDate", "startDate", "endDate", "dueDate", "completedDate", "documentDate"];
      for (const field of dateFields) {
        if (normalizeText(record[field]) && !toDate(record[field])) issues.push({ row, field, severity: "Lỗi", message: `Ngày “${normalizeText(record[field])}” không hợp lệ.`, fix: "Dùng định dạng YYYY-MM-DD hoặc DD/MM/YYYY." });
      }
      const start = toDate(record.startDate);
      const end = toDate(record.endDate);
      const due = toDate(record.dueDate);
      if (start && end && end < start) issues.push({ row, field: "Ngày kết thúc", severity: "Lỗi", message: "Ngày kết thúc đứng trước ngày bắt đầu.", fix: "Đối chiếu lại mốc thời gian." });
      if (start && due && due < start) issues.push({ row, field: "Hạn thực hiện", severity: "Lỗi", message: "Hạn thực hiện đứng trước ngày bắt đầu.", fix: "Đối chiếu lại cam kết." });
      if (entityType === "documents" && (!Number.isInteger(Number(record.version)) || Number(record.version) < 1)) issues.push({ row, field: "Phiên bản", severity: "Lỗi", message: "Phiên bản tài liệu phải là số nguyên từ 1.", fix: "Nhập 1 cho bản đầu tiên." });
      const idFields: Partial<Record<ImportEntityType, string>> = { organizations: "organizationCode", assignments: "assignmentId", training: "trainingId", commitments: "commitmentId", events: "eventId", documents: "fileRecordId" };
      const idField = idFields[entityType];
      const stableValue = idField ? normalizeForMatch(record[idField]) : "";
      if (stableValue) {
        const key = `${entityType}|${stableValue}`;
        if (seen.has(key)) issues.push({ row, field: idField ?? "Mã", severity: "Cảnh báo", message: `Trùng mã với dòng ${seen.get(key)}.`, fix: "Giữ một dòng hoặc dùng chế độ cập nhật/gộp." });
        else seen.set(key, row);
      }
      return;
    }
    if (!normalizeText(record.fullName)) issues.push({ row, field: "Họ và tên", severity: "Lỗi", message: "Thiếu họ và tên.", fix: "Nhập họ và tên hoặc bỏ qua dòng." });
    if (!normalizeText(record.birthDate)) issues.push({ row, field: "Ngày sinh", severity: "Cảnh báo", message: "Chưa có ngày sinh để đối chiếu hồ sơ.", fix: "Bổ sung ngày sinh hoặc đánh dấu chờ xác minh." });
    else if (!toDate(record.birthDate)) issues.push({ row, field: "Ngày sinh", severity: "Cảnh báo", message: `Ngày sinh nguồn “${normalizeText(record.birthDate)}” không hợp lệ; hồ sơ vẫn được giữ.`, fix: "Đối chiếu hồ sơ gốc; hệ thống không tự đoán ngày." });
    if (!normalizeText(record.organization)) issues.push({ row, field: "Đơn vị", severity: "Cảnh báo", message: "Chưa xác định đơn vị sử dụng.", fix: "Chọn đơn vị từ danh mục." });
    if (entityType === "contracts" && !normalizeText(record.contractNumber)) issues.push({ row, field: "Số hợp đồng", severity: "Cảnh báo", message: "Thiếu số hợp đồng; hệ thống không tự sinh.", fix: "Bổ sung hoặc nhập ở trạng thái chờ bổ sung." });
    const key = entityType === "people"
      ? `${normalizeForMatch(record.fullName)}|${normalizeText(record.birthDate)}`
      : `${normalizeForMatch(record.fullName)}|${normalizeText(record.birthDate)}|${normalizeForMatch(record.contractType)}|${normalizeForMatch(record.contractNumber)}|${normalizeText(record.effectiveDate || record.startDate || record.periodText)}`;
    if (seen.has(key) && key.replaceAll("|", "")) {
      issues.push({ row, field: "Khóa đối chiếu", severity: "Cảnh báo", message: `Có khả năng trùng với dòng ${seen.get(key)}.`, fix: "So sánh hai dòng trước khi gộp." });
    } else seen.set(key, row);

    for (const [field, label, map] of [
      ["staffCode", "Mã cán bộ", seenStaffCodes],
      ["workEmail", "Email công vụ", seenEmails],
      ["phone", "Điện thoại", seenPhones],
    ] as const) {
      const value = normalizeForMatch(record[field]);
      if (!value) continue;
      if (map.has(value)) issues.push({ row, field: label, severity: "Cảnh báo", message: `Trùng với dòng ${map.get(value)}.`, fix: "Kiểm tra và gộp theo mã định danh ổn định." });
      else map.set(value, row);
    }

    if (entityType === "contracts") {
      const dateFields = ["signedDate", "effectiveDate", "startDate", "endDate"] as const;
      const dates = Object.fromEntries(dateFields.map((field) => [field, toDate(record[field])])) as Record<(typeof dateFields)[number], Date | null>;
      dateFields.forEach((field) => {
        if (normalizeText(record[field]) && !dates[field]) issues.push({ row, field, severity: "Lỗi", message: `Ngày “${normalizeText(record[field])}” không hợp lệ.`, fix: "Dùng định dạng DD/MM/YYYY và không tự suy đoán ngày." });
      });
      const start = dates.startDate ?? dates.effectiveDate;
      if (dates.endDate && start && dates.endDate < start) issues.push({ row, field: "Ngày hết hạn", severity: "Lỗi", message: "Ngày hết hạn đứng trước ngày bắt đầu/hiệu lực.", fix: "Đối chiếu lại văn bản hợp đồng." });
      if (dates.effectiveDate && dates.signedDate && dates.effectiveDate < dates.signedDate) issues.push({ row, field: "Ngày hiệu lực", severity: "Cảnh báo", message: "Ngày hiệu lực đứng trước ngày ký.", fix: "Xác minh đây có phải hiệu lực hồi tố hay lỗi nhập." });
      if (normalizeForMatch(record.contractType).includes("khong xac dinh") && record.endDate) issues.push({ row, field: "Ngày hết hạn", severity: "Cảnh báo", message: "Hợp đồng không xác định thời hạn nhưng có ngày hết hạn.", fix: "Xác minh loại hợp đồng hoặc ngày hết hạn." });
    }
  });
  return issues;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts.at(-2)?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "UED";
}

function displayDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "—";
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}

function daysFromToday(value: unknown) {
  const text = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Math.ceil((Date.parse(`${text}T00:00:00Z`) - Date.now()) / 86_400_000);
}

async function fetchRows(resource: string) {
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; offset < 2_000; offset += 250) {
    const response = await fetch(`/api/workspace?resource=${resource}&limit=250&offset=${offset}`, { cache: "no-store" });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? `Không đọc được ${resource}`);
    const page = (await response.json()).rows ?? [];
    rows.push(...page);
    if (page.length < 250) break;
  }
  return rows;
}

async function fetchOptionalResource(resource: string) {
  const response = await fetch(`/api/workspace?resource=${resource}&limit=1000`, { cache: "no-store" });
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? `Không đọc được ${resource}`);
  return response.json();
}

async function loadWorkspaceData(): Promise<WorkspaceData> {
  const [dashboardResponse, dashboardV2, peopleRows, contractRows, organizationRows, assignmentRows, trainingRows, commitmentRows, eventRows, documentRows, filesResponse, alertRows, auditRows, importRows, catalogs, accounts, settings, trash] = await Promise.all([
    fetch("/api/workspace?resource=dashboard", { cache: "no-store" }),
    fetchOptionalResource("dashboard_v2"),
    fetchRows("people"),
    fetchRows("contracts"),
    fetchRows("organizations"),
    fetchRows("assignments"),
    fetchRows("training"),
    fetchRows("commitments"),
    fetchRows("events"),
    fetchRows("documents"),
    fetch("/api/files", { cache: "no-store" }),
    fetchRows("alerts"),
    fetchRows("audit"),
    fetchRows("imports"),
    fetchOptionalResource("catalogs"),
    fetchOptionalResource("accounts"),
    fetchOptionalResource("settings"),
    fetchOptionalResource("trash"),
  ]);
  if (!dashboardResponse.ok) throw new Error((await dashboardResponse.json().catch(() => null))?.error ?? "Không đọc được tổng quan");
  if (!filesResponse.ok) throw new Error((await filesResponse.json().catch(() => null))?.error ?? "Không đọc được kho tệp");
  const dashboard = await dashboardResponse.json();
  const files = (await filesResponse.json()).rows ?? [];
  return {
    connected: true,
    actor: dashboard.actor,
    dashboard,
    dashboardV2,
    imports: importRows,
    accounts: accounts?.rows ?? [],
    catalogs: { positions: catalogs?.positions ?? [], academicYears: catalogs?.academicYears ?? [], roles: catalogs?.roles ?? [] },
    settings: settings?.rows ?? [],
    trash: trash?.rows ?? [],
    organizations: organizationRows,
    assignments: assignmentRows,
    training: trainingRows,
    commitments: commitmentRows,
    events: eventRows,
    documents: documentRows,
    files,
    peopleRaw: peopleRows,
    contractsRaw: contractRows,
    people: peopleRows.map((row) => ({
      id: String(row.id), staffCode: normalizeText(row.staffCode) || "Chưa cấp", fullName: normalizeText(row.fullName),
      birthDate: normalizeText(row.birthDate), gender: normalizeText(row.gender) || "Chưa xác định",
      unit: normalizeText(row.organization) || "Chưa xác định", position: normalizeText(row.position) || "Chưa cập nhật",
      degree: normalizeText(row.degree) || "Chưa cập nhật", status: normalizeText(row.employmentStatus) || "Đang công tác",
      sync: normalizeText(row.syncState) === "pending" ? "Chờ gửi" : "Đã đồng bộ", version: Number(row.version ?? 1),
    })),
    contracts: contractRows.map((row) => ({
      id: String(row.id), number: normalizeText(row.contractNumber) || "Chưa có số HĐ", person: normalizeText(row.fullName),
      type: normalizeText(row.contractType), unit: normalizeText(row.organization) || "Chưa xác định",
      start: displayDate(row.startDate || row.effectiveDate), end: displayDate(row.endDate),
      status: normalizeText(row.status), days: daysFromToday(row.endDate),
    })),
    alerts: alertRows.map((row) => ({
      id: String(row.id), severity: normalizeText(row.severity), title: normalizeText(row.title), subject: normalizeText(row.message),
      due: displayDate(row.dueDate), days: daysFromToday(row.dueDate), assignee: normalizeText(row.assigneeUserId) || "Chưa giao",
      status: row.status === "resolved" ? "Đã xử lý" : row.status === "read" ? "Đã đọc" : "Chưa xử lý",
    })),
    audit: auditRows.map((row) => ({
      id: String(row.id), time: displayDate(String(row.createdAt ?? "").slice(0, 10)) + ` ${String(row.createdAt ?? "").slice(11, 16)}`,
      action: normalizeText(row.action), entity: `${normalizeText(row.entityType)}${row.entityId ? ` · ${row.entityId}` : ""}`,
      actor: normalizeText(row.actorEmail) || "Hệ thống", result: "Thành công",
    })),
  };
}

export function UedOrganizationApp({ currentUser }: { currentUser: CurrentUser }) {
  const [activeView, setActiveView] = React.useState<ViewKey>("dashboard");
  const [globalSearch, setGlobalSearch] = React.useState("");
  // Keep the server and the first client render identical; read the live network
  // state only after hydration has completed.
  const [online, setOnline] = React.useState(true);
  const [outboxCount, setOutboxCount] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState("Chưa đồng bộ phiên này");
  const [workspace, setWorkspace] = React.useState<WorkspaceData>({ people: [], peopleRaw: [], contracts: [], contractsRaw: [], organizations: [], assignments: [], training: [], commitments: [], events: [], documents: [], files: [], alerts: [], audit: [], imports: [], accounts: [], catalogs: { positions: [], academicYears: [], roles: [] }, settings: [], trash: [], dashboard: null, dashboardV2: null, connected: false });
  const [workspaceLoading, setWorkspaceLoading] = React.useState(true);

  const refreshWorkspace = React.useCallback(async () => {
    try {
      setWorkspace(await loadWorkspaceData());
    } catch {
      setWorkspace((current) => ({ ...current, connected: false }));
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  const refreshOutbox = React.useCallback(async () => {
    try {
      setOutboxCount((await getOutbox()).length);
    } catch {
      setOutboxCount(0);
    }
  }, []);

  const syncNow = React.useCallback(async () => {
    setSyncing(true);
    try {
      const result = await flushOutbox((remaining) => setOutboxCount(remaining));
      setLastSync(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
      if (result.failed) toast.warning(`Còn ${result.remaining} thay đổi cần gửi lại.`);
      else toast.success(result.sent ? `Đã đồng bộ ${result.sent} thay đổi.` : "Dữ liệu đã đồng bộ.");
      await refreshWorkspace();
    } finally {
      setSyncing(false);
      await refreshOutbox();
    }
  }, [refreshOutbox, refreshWorkspace]);

  React.useEffect(() => {
    const initialize = window.setTimeout(() => {
      setOnline(navigator.onLine);
      void refreshOutbox();
      void refreshWorkspace();
    }, 0);
    const onOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshOutbox, refreshWorkspace, syncNow]);

  const navigate = (view: ViewKey) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dataChanged = React.useCallback(async () => {
    await Promise.all([refreshOutbox(), refreshWorkspace()]);
  }, [refreshOutbox, refreshWorkspace]);
  const effectiveUser = { ...currentUser, role: workspace.actor?.role ?? currentUser.role };
  const businessRecordCount = workspace.dashboard ? Object.entries(workspace.dashboard.counts)
    .filter(([key]) => ["people", "contracts", "organizations", "training", "commitments", "documents"].includes(key))
    .reduce((sum, [, value]) => sum + Number(value), 0) : 0;
  const hasBusinessData = workspace.connected && businessRecordCount > 0;
  const openAlertCount = workspace.alerts.filter((item) => item.status !== "Đã xử lý").length;
  const qualityIssueCount = workspace.dashboard ? workspace.dashboard.missingContractNumber
    + workspace.dashboard.counts.unlinkedContracts
    + workspace.dashboard.counts.brokenContractLinks
    + workspace.dashboard.counts.brokenTrainingLinks
    + workspace.dashboard.counts.brokenCommitmentLinks
    + workspace.dashboard.counts.brokenDocumentLinks
    + workspace.dashboard.counts.duplicateStaffCodes
    + workspace.dashboard.counts.openConflicts : 0;

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-r-0 bg-sidebar text-sidebar-foreground" data-print-hidden="true">
        <SidebarHeader className="border-b border-white/10 p-3">
          <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-white/8 p-2.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
              <Image src="/ued-logo.png" alt="Logo chính thức Trường Đại học Sư phạm – Đại học Đà Nẵng" width={44} height={44} className="size-full object-contain" priority unoptimized />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-cyan-100">Trường Đại học Sư phạm</p>
              <p className="truncate text-[15px] font-bold text-white">Quản lý Tổ chức UED</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-3">
          {navGroups.map((group) => (
            <SidebarGroup key={group.label} className="py-1.5">
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cyan-100/65">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const badge = item.key === "alerts" ? (hasBusinessData && openAlertCount ? String(openAlertCount) : undefined)
                      : item.key === "quality" ? (hasBusinessData && qualityIssueCount ? String(qualityIssueCount) : undefined)
                        : item.badge;
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          isActive={activeView === item.key}
                          tooltip={item.label}
                          onClick={() => navigate(item.key)}
                          className="h-10 rounded-xl text-[14px] text-blue-50 hover:bg-white/10 hover:text-white data-[active=true]:bg-white data-[active=true]:font-semibold data-[active=true]:text-[#075487] data-[active=true]:shadow-sm"
                        >
                          <Icon className="size-[18px]" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                        {badge ? <SidebarMenuBadge className="bg-cyan-200/15 text-cyan-50 group-data-[collapsible=icon]:hidden">{badge}</SidebarMenuBadge> : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 overflow-hidden rounded-xl p-1.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-[#075487]">{initials(effectiveUser.name)}</div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold text-white">{effectiveUser.name}</p>
              <p className="truncate text-xs text-blue-100/75">{effectiveUser.role}</p>
            </div>
            <ChevronRight className="size-4 text-blue-100/60 group-data-[collapsible=icon]:hidden" />
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[#f4f8fb]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-6" data-print-hidden="true">
          <SidebarTrigger className="size-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" />
          <Separator orientation="vertical" className="h-6" />
          <div className="relative hidden min-w-0 max-w-xl flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 text-[15px] shadow-none focus-visible:bg-white" placeholder="Tìm tên, mã cán bộ, số hợp đồng, đơn vị…" />
            <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-white px-1.5 py-0.5 text-[11px] text-slate-400 lg:block">Ctrl K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => void syncNow()} className={cn("flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition", online ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100")} aria-label="Kiểm tra trạng thái đồng bộ">
              {syncing ? <Loader2 className="size-4 animate-spin" /> : online ? <Cloud className="size-4" /> : <CloudOff className="size-4" />}
              <span className="hidden sm:inline">{outboxCount ? `${outboxCount} chờ gửi` : online ? "Đã đồng bộ" : "Ngoại tuyến"}</span>
            </button>
            <Button variant="outline" size="icon" className="relative size-10 rounded-xl border-slate-200" onClick={() => navigate("alerts")} aria-label="Mở thông báo">
              <Bell className="size-[18px]" />
              {openAlertCount ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" /> : null}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 rounded-xl px-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#0a6ea9] text-xs font-bold text-white">{initials(effectiveUser.name)}</span>
                  <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <p className="font-semibold">{effectiveUser.name}</p>
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">{effectiveUser.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("admin")}><UserCog className="mr-2 size-4" />Tài khoản và quyền</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("sync")}><Database className="mr-2 size-4" />Sao lưu dữ liệu</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 px-4 py-5 md:px-6 md:py-6 xl:px-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0a6ea9]">
                  <span>Phòng Tổ chức</span><span className="text-slate-300">/</span><span>{viewMeta[activeView].title}</span>
                </div>
                <h1 className="text-[1.6rem] font-bold tracking-tight text-slate-900 md:text-[1.9rem]">{viewMeta[activeView].title}</h1>
                <p className="mt-1 max-w-3xl text-[14px] leading-6 text-slate-500 md:text-[15px]">{viewMeta[activeView].description}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>Nguồn được kiểm tra đến {SOURCE_AS_OF}</span>
              </div>
            </div>

            {activeView === "dashboard" && <DashboardView navigate={navigate} workspace={workspace} loading={workspaceLoading} />}
            {activeView === "people" && <V2PeopleView search={globalSearch} rows={workspace.peopleRaw} organizations={workspace.organizations} role={workspace.actor?.role ?? effectiveUser.role} connected={workspace.connected} loading={workspaceLoading} onDataChanged={dataChanged} />}
            {activeView === "organizations" && <V2OrganizationsView rows={workspace.organizations} people={workspace.peopleRaw} role={workspace.actor?.role ?? effectiveUser.role} onDataChanged={dataChanged} />}
            {activeView === "contracts" && <V2ContractsView search={globalSearch} rows={workspace.contractsRaw} people={workspace.peopleRaw} organizations={workspace.organizations} role={workspace.actor?.role ?? effectiveUser.role} onDataChanged={dataChanged} />}
            {activeView === "changes" && <ChangesView workspace={workspace} />}
            {activeView === "education" && <EducationView workspace={workspace} />}
            {activeView === "documents" && <V2DocumentsView rows={workspace.files} people={workspace.peopleRaw} contracts={workspace.contractsRaw} role={workspace.actor?.role ?? effectiveUser.role} onDataChanged={dataChanged} />}
            {activeView === "imports" && <ImportCenter onDataChanged={dataChanged} importHistory={workspace.imports} />}
            {activeView === "reports" && <V2ReportsView people={workspace.peopleRaw} contracts={workspace.contractsRaw} organizations={workspace.organizations} role={workspace.actor?.role ?? effectiveUser.role} />}
            {activeView === "quality" && <QualityView navigate={navigate} workspace={workspace} />}
            {activeView === "alerts" && <AlertsView sourceAlerts={workspace.alerts} connected={workspace.connected} onDataChanged={dataChanged} navigate={navigate} />}
            {activeView === "audit" && <AuditView currentUser={effectiveUser} sourceEvents={workspace.audit} />}
            {activeView === "admin" && <V2AdminView accounts={workspace.accounts} organizations={workspace.organizations} positions={workspace.catalogs.positions} academicYears={workspace.catalogs.academicYears} settings={workspace.settings} trash={workspace.trash} role={workspace.actor?.role ?? effectiveUser.role} onDataChanged={dataChanged} />}
            {activeView === "sync" && <V2SyncView online={online} syncing={syncing} outboxCount={outboxCount} lastSync={lastSync} syncNow={syncNow} dashboard={workspace.dashboard} role={workspace.actor?.role ?? effectiveUser.role} onDataChanged={dataChanged} />}
          </div>
        </main>
      </SidebarInset>
      <Toaster richColors position="top-right" closeButton />
    </SidebarProvider>
  );
}

function DashboardView({ navigate, workspace, loading }: { navigate: (view: ViewKey) => void; workspace: WorkspaceData; loading: boolean }) {
  type DashboardV2Payload = {
    peopleTotal?: number;
    contracts?: { total?: number; active?: number; expired?: number; terminated?: number; missingNumber?: number };
    expiring?: { d7?: number; d15?: number; d30?: number; d60?: number; d90?: number };
    peopleByDegree?: Array<{ label: string; value: number }>;
    peopleByUnit?: Array<{ label: string; value: number }>;
    lastUpdatedAt?: string | null;
  };
  const [organizationId, setOrganizationId] = React.useState("all");
  const [contractType, setContractType] = React.useState("all");
  const [dashboardOverride, setDashboardOverride] = React.useState<DashboardV2Payload | null>(null);
  const dashboardV2 = dashboardOverride ?? (workspace.dashboardV2 ?? {}) as DashboardV2Payload;
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshDashboard = React.useCallback(async (nextOrganization = organizationId, nextContractType = contractType) => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ resource: "dashboard_v2" });
      if (nextOrganization !== "all") params.set("organizationId", nextOrganization);
      if (nextContractType !== "all") params.set("contractType", nextContractType);
      const response = await fetch(`/api/workspace?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể cập nhật tổng quan.");
      setDashboardOverride(result);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể cập nhật tổng quan."); }
    finally { setRefreshing(false); }
  }, [organizationId, contractType]);
  const live = Boolean(workspace.connected && workspace.dashboard && [workspace.dashboard.counts.people, workspace.dashboard.counts.contracts, workspace.dashboard.counts.organizations, workspace.dashboard.counts.training, workspace.dashboard.counts.commitments, workspace.dashboard.counts.documents].some((value) => value > 0));
  const dashboard = workspace.dashboard;
  const shownAlerts = live ? workspace.alerts : demoAlerts;
  const stats = [
    { label: live ? "Nhân sự trong phạm vi" : "Nhân sự nguồn tháng 8", value: String(live ? dashboardV2.peopleTotal ?? dashboard?.counts.people ?? 0 : 384), detail: live ? `Cập nhật ${displayDate(dashboardV2.lastUpdatedAt)}` : "+2 so với T7", icon: Users, color: "blue", target: "people" as ViewKey },
    { label: "Hợp đồng đang hiệu lực", value: String(live ? dashboardV2.contracts?.active ?? dashboard?.activeContracts ?? 0 : 407), detail: live ? "Tính theo bộ lọc và phạm vi quyền" : "96,2% hồ sơ nguồn", icon: FileCheck2, color: "teal", target: "contracts" as ViewKey },
    { label: "Sắp hết hạn trong 90 ngày", value: String(live ? dashboardV2.expiring?.d90 ?? dashboard?.expiring90 ?? 0 : 3), detail: live ? `${dashboardV2.expiring?.d30 ?? 0} trong 30 ngày · ${dashboardV2.expiring?.d60 ?? 0} trong 60 ngày` : "2 trong vòng 60 ngày", icon: CalendarClock, color: "amber", target: "alerts" as ViewKey },
    { label: "Vấn đề cần xác minh", value: String(live ? (dashboardV2.contracts?.missingNumber ?? dashboard?.missingContractNumber ?? 0) + (dashboard?.counts.unlinkedContracts ?? 0) + (dashboard?.counts.openConflicts ?? 0) + (dashboard?.counts.duplicateStaffCodes ?? 0) : 5), detail: live ? `${dashboard?.counts.openConflicts ?? 0} xung đột · ${dashboard?.counts.unlinkedContracts ?? 0} HĐ chưa liên kết` : "2 nhóm mức độ cao", icon: ClipboardCheck, color: "rose", target: "quality" as ViewKey },
  ];
  const liveDegreeDistribution = live && dashboardV2.peopleByDegree?.length
    ? dashboardV2.peopleByDegree.map((item, index) => ({ name: item.label, value: Number(item.value), color: ["#0065a8", "#13a89e", "#f2b544", "#7c5ce7", "#94a3b8"][index % 5] }))
    : degreeDistribution;
  const liveDegreeTotal = liveDegreeDistribution.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#0065a8] p-2.5 text-white"><BookOpenCheck className="size-5" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{live ? "Dữ liệu nghiệp vụ đang đọc từ CSDL trung tâm" : "Bản đồ dữ liệu nguồn đã được lập"}</p><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><Check className="size-3" /> {loading ? "Đang đối soát" : live ? "Đã đồng bộ" : "Đã kiểm tra cấu trúc"}</Badge></div>
            <p className="mt-1 text-sm leading-5 text-slate-600">{live ? `Checksum đối soát: ${dashboard?.checksum?.slice(0, 12) ?? "—"}… · ${dashboard?.passed ? "Toàn vẹn liên kết đạt" : "Có vấn đề cần xử lý"}.` : "13 sheet đội ngũ, 6 sheet hợp đồng; 89 dòng XĐTH trùng tuyệt đối được chặn nhập lần hai."}</p>
          </div>
        </div>
        <Button variant="outline" className="shrink-0 rounded-xl border-sky-200 bg-white text-[#075487]" onClick={() => navigate("imports")}>Xem bản đồ nguồn <ChevronRight className="size-4" /></Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm">
        <Filter className="ml-1 size-4 text-slate-400" />
        <Select defaultValue="current"><SelectTrigger className="h-9 w-[150px] rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="current">Dữ liệu hiện tại</SelectItem><SelectItem value="2026">Nguồn năm 2026</SelectItem></SelectContent></Select>
        <Select defaultValue="all"><SelectTrigger className="h-9 w-[150px] rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả tháng</SelectItem>{monthlyWorkforce.map((item) => <SelectItem key={item.month} value={item.month.toLowerCase()}>{item.month.replace("T0", "Tháng ").replace("T", "Tháng ")}</SelectItem>)}</SelectContent></Select>
        <Select value={organizationId} onValueChange={(value) => { setOrganizationId(value); void refreshDashboard(value, contractType); }}><SelectTrigger className="h-9 min-w-[210px] rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toàn phạm vi</SelectItem>{workspace.organizations.map((item) => <SelectItem key={String(item.id)} value={String(item.id)}>{String(item.name)}</SelectItem>)}</SelectContent></Select>
        <Select value={contractType} onValueChange={(value) => { setContractType(value); void refreshDashboard(organizationId, value); }}><SelectTrigger className="h-9 min-w-[190px] rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả loại hợp đồng</SelectItem>{contractTypes.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select>
        <Button variant="ghost" disabled={refreshing} onClick={() => void refreshDashboard()} className="ml-auto h-9 rounded-xl text-slate-500">{refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Làm mới</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return <button key={stat.label} onClick={() => navigate(stat.target)} className="group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-medium text-slate-500">{stat.label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p><p className="mt-2 text-xs text-slate-500">{stat.detail}</p></div>
              <span className={cn("rounded-2xl p-3", stat.color === "blue" && "bg-sky-100 text-sky-700", stat.color === "teal" && "bg-teal-100 text-teal-700", stat.color === "amber" && "bg-amber-100 text-amber-700", stat.color === "rose" && "bg-rose-100 text-rose-700")}><Icon className="size-5" /></span>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#0a6ea9] opacity-0 transition group-hover:opacity-100">Mở danh sách <ChevronRight className="size-3" /></span>
          </button>;
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div><CardTitle className="text-base">Biến động đội ngũ năm 2026</CardTitle><CardDescription>Số hồ sơ theo ảnh chụp từng tháng; bấm để truy xuất danh sách.</CardDescription></div>
            <Button variant="ghost" size="sm" className="rounded-lg text-[#0a6ea9]" onClick={() => navigate("changes")}>Chi tiết</Button>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ total: { label: "Tổng nhân sự", color: "#0065a8" }, female: { label: "Nữ", color: "#13a89e" } }} className="h-[285px] w-full">
              <AreaChart data={monthlyWorkforce} margin={{ left: 4, right: 12, top: 18, bottom: 0 }}>
                <defs><linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0065a8" stopOpacity={0.24}/><stop offset="95%" stopColor="#0065a8" stopOpacity={0.02}/></linearGradient></defs>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis domain={[370, 390]} tickLine={false} axisLine={false} width={34} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Area dataKey="total" type="monotone" fill="url(#fillTotal)" stroke="#0065a8" strokeWidth={2.5} activeDot={{ r: 5 }} />
                <Line dataKey="female" type="monotone" stroke="#13a89e" strokeWidth={2} dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Phân bố trình độ</CardTitle><CardDescription>{live ? `${liveDegreeTotal} hồ sơ theo bộ lọc hiện tại.` : "384 hồ sơ ở kỳ T8/2026."}</CardDescription></CardHeader>
          <CardContent className="grid items-center gap-1 sm:grid-cols-[1.1fr_1fr] xl:grid-cols-1 2xl:grid-cols-[1.1fr_1fr]">
            <ChartContainer config={{ value: { label: "Số người" } }} className="mx-auto h-[205px] w-full max-w-[260px]">
              <PieChart><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Pie data={liveDegreeDistribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>{liveDegreeDistribution.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 text-2xl font-bold">{live ? liveDegreeTotal : 384}</text><text x="50%" y="59%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[11px]">hồ sơ</text></PieChart>
            </ChartContainer>
            <div className="space-y-2.5">{liveDegreeDistribution.map((item) => <button key={item.name} onClick={() => navigate("education")} className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-sm hover:bg-slate-50"><span className="flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold text-slate-900">{item.value}</span></button>)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3"><div><CardTitle className="text-base">Cảnh báo cần xử lý</CardTitle><CardDescription>Cảnh báo không tạo trùng khi quét lại.</CardDescription></div><Button variant="ghost" size="sm" onClick={() => navigate("alerts")} className="rounded-lg text-[#0a6ea9]">Xem tất cả</Button></CardHeader>
          <CardContent className="space-y-2">{shownAlerts.length ? shownAlerts.slice(0, 3).map((alert) => <button key={alert.id} onClick={() => navigate("alerts")} className="flex w-full items-center gap-3 rounded-xl border border-transparent p-3 text-left transition hover:border-slate-200 hover:bg-slate-50"><span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", alert.severity === "urgent" ? "bg-rose-100 text-rose-600" : alert.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700")}>{alert.severity === "urgent" ? <CalendarClock className="size-4" /> : <AlertTriangle className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{alert.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{alert.subject}</span></span><Badge variant="outline" className="shrink-0 font-normal">{alert.status}</Badge></button>) : <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="size-5 shrink-0"/><span>Không có cảnh báo chưa xử lý trong dữ liệu trung tâm.</span></div>}</CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Tình trạng dữ liệu nguồn</CardTitle><CardDescription>Đối soát trước khi ghi dữ liệu chính thức.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <StatusProgress label="Đã lập bản đồ" value="3/3 tệp" progress={100} color="bg-emerald-500" />
            <StatusProgress label={live ? "Đối soát toàn vẹn" : "Khóa liên kết chính xác"} value={live ? (dashboard?.passed ? "Đạt" : "Cần xử lý") : "363/423 HĐ"} progress={live ? (dashboard?.passed ? 100 : 70) : 86} color="bg-[#0065a8]" />
            <StatusProgress label={live ? "Đợt nhập hoàn tất" : "Hồ sơ có mã cán bộ"} value={live ? String(dashboard?.completedImports ?? 0) : "0/384"} progress={live ? 100 : 0} color="bg-amber-500" />
            <Button className="w-full rounded-xl bg-[#0065a8]" onClick={() => navigate("quality")}><ListChecks className="size-4" />Mở danh sách cần xác minh</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusProgress({ label, value, progress, color }: { label: string; value: string; progress: number; color: string }) {
  return <div><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{label}</span><span className="font-semibold text-slate-800">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", color)} style={{ width: `${progress}%` }} /></div></div>;
}

function PeopleView({ search, sourceRows, connected, loading, onDataChanged }: { search: string; sourceRows: PersonRow[]; connected: boolean; loading: boolean; onDataChanged: () => Promise<void> }) {
  const live = connected && sourceRows.length > 0;
  const [pendingRows, setPendingRows] = React.useState<PersonRow[]>([]);
  const [localSearch, setLocalSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<PersonRow | null>(null);
  const sourceIds = new Set(sourceRows.map((row) => row.id));
  const baseRows = sourceRows.length ? sourceRows : [...syntheticPeople];
  const rows = [...pendingRows.filter((row) => !sourceIds.has(row.id)), ...baseRows];
  const query = normalizeForMatch(`${search} ${localSearch}`);
  const filtered = rows.filter((row) => !query || normalizeForMatch(Object.values(row).join(" ")).includes(query));
  const [form, setForm] = React.useState({ staffCode: "", fullName: "", birthDate: "", gender: "", unit: "", position: "", degree: "" });

  async function savePerson() {
    if (!form.fullName.trim()) return toast.error("Vui lòng nhập họ và tên.");
    const newRow = { id: crypto.randomUUID(), ...form, status: "Đang công tác", sync: "Chờ gửi" } as PersonRow;
    setPendingRows((current) => [newRow, ...current]);
    setDialogOpen(false);
    setForm({ staffCode: "", fullName: "", birthDate: "", gender: "", unit: "", position: "", degree: "" });
    try {
      const result = await sendOrQueue("upsert_person", { record: newRow, reason: "Tạo hồ sơ từ giao diện" });
      await onDataChanged();
      if (result.queued) toast.warning("Mất kết nối: hồ sơ đã được giữ trong hàng đợi an toàn.");
      else toast.success("Đã lưu hồ sơ và ghi nhật ký.");
    } catch (error) {
      setPendingRows((current) => current.filter((row) => row.id !== newRow.id));
      toast.error(error instanceof Error ? error.message : "Không thể lưu hồ sơ.");
    }
  }

  return <div className="space-y-4">
    <DemoDataNotice live={live} connected={connected} loading={loading} />
    <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 shadow-sm lg:flex-row lg:items-center">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><Input value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} placeholder="Tìm trong hồ sơ nhân sự…" className="h-10 rounded-xl border-slate-200 pl-9" /></div>
      <Select defaultValue="all"><SelectTrigger className="h-10 min-w-[190px] rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả đơn vị</SelectItem>{unitData.map((item) => <SelectItem key={item.name} value={normalizeForMatch(item.name)}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select defaultValue="working"><SelectTrigger className="h-10 min-w-[165px] rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="working">Đang công tác</SelectItem><SelectItem value="study">Đi học</SelectItem><SelectItem value="retired">Nghỉ hưu</SelectItem></SelectContent></Select>
      <Button variant="outline" className="h-10 rounded-xl"><Columns3 className="size-4" />Chọn cột</Button>
      <Button className="h-10 rounded-xl bg-[#0065a8]" onClick={() => setDialogOpen(true)}><Plus className="size-4" />Thêm hồ sơ</Button>
    </div>
    {selected.length ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm"><span className="font-semibold text-sky-800">Đã chọn {selected.length} hồ sơ</span><Button variant="outline" size="sm" className="ml-auto rounded-lg bg-white">Sửa hàng loạt</Button><Button variant="outline" size="sm" className="rounded-lg bg-white text-rose-600"><Trash2 className="size-4" />Xóa mềm</Button></div> : null}
    <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50"><TableRow><TableHead className="w-11"><Checkbox checked={selected.length === filtered.length && filtered.length > 0} onCheckedChange={(checked) => setSelected(checked ? filtered.map((row) => row.id) : [])} aria-label="Chọn tất cả" /></TableHead><TableHead className="min-w-[145px]">Mã cán bộ</TableHead><TableHead className="min-w-[210px]">Họ và tên</TableHead><TableHead className="min-w-[130px]">Ngày sinh</TableHead><TableHead className="min-w-[230px]">Đơn vị</TableHead><TableHead className="min-w-[160px]">Chức vụ</TableHead><TableHead className="min-w-[120px]">Trình độ</TableHead><TableHead>Trạng thái</TableHead><TableHead>Đồng bộ</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>{filtered.map((row) => <TableRow key={row.id} className="group"><TableCell><Checkbox checked={selected.includes(row.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...current, row.id] : current.filter((id) => id !== row.id))} aria-label={`Chọn ${row.fullName}`} /></TableCell><TableCell className="font-mono text-xs font-medium text-slate-600">{row.staffCode}</TableCell><TableCell><button onClick={() => setDetail(row)} className="font-semibold text-[#075487] hover:underline">{row.fullName}</button><p className="mt-0.5 text-xs text-slate-400">{row.gender}</p></TableCell><TableCell>{displayDate(row.birthDate)}</TableCell><TableCell className="text-slate-600">{row.unit}</TableCell><TableCell>{row.position}</TableCell><TableCell><Badge variant="secondary" className="font-normal">{row.degree}</Badge></TableCell><TableCell><span className={cn("inline-flex items-center gap-1.5 text-sm", normalizeForMatch(row.status) === "di hoc" ? "text-violet-700" : "text-emerald-700")}><span className="size-2 rounded-full bg-current" />{row.status}</span></TableCell><TableCell><Badge variant="outline" className={cn("font-normal", row.sync === "Chờ gửi" && "border-amber-200 bg-amber-50 text-amber-700")}>{row.sync}</Badge></TableCell><TableCell><Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button></TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2 border-t bg-slate-50/60 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Hiển thị {filtered.length} {live ? "hồ sơ từ CSDL trung tâm" : "hồ sơ minh họa"} · Nguồn đã kiểm tra: 384 hồ sơ T8/2026</span><div className="flex gap-1"><Button variant="outline" size="sm" disabled className="rounded-lg">Trước</Button><Button variant="outline" size="sm" className="rounded-lg bg-white">1</Button><Button variant="outline" size="sm" disabled className="rounded-lg">Sau</Button></div></div>
    </Card>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Thêm hồ sơ nhân sự</DialogTitle><DialogDescription>Mã cán bộ là khóa nghiệp vụ. Nếu chưa có, hồ sơ được lưu ở trạng thái chờ bổ sung và vẫn có person_id nội bộ.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="Mã cán bộ"><Input value={form.staffCode} onChange={(e) => setForm({ ...form, staffCode: e.target.value })} placeholder="Ví dụ: VC0123" /></Field><Field label="Họ và tên *"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field><Field label="Ngày sinh"><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></Field><Field label="Giới tính"><Select value={form.gender} onValueChange={(value) => setForm({ ...form, gender: value })}><SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger><SelectContent><SelectItem value="Nam">Nam</SelectItem><SelectItem value="Nữ">Nữ</SelectItem><SelectItem value="Khác">Khác</SelectItem><SelectItem value="Chưa xác định">Chưa xác định</SelectItem></SelectContent></Select></Field><Field label="Đơn vị"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field><Field label="Chức vụ/chức danh"><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field><Field label="Trình độ"><Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button><Button onClick={() => void savePerson()} className="bg-[#0065a8]"><Save className="size-4" />Lưu hồ sơ</Button></DialogFooter></DialogContent></Dialog>
    <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}><SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl"><SheetHeader className="border-b bg-gradient-to-br from-[#074e7a] to-[#0a75a9] p-6 text-left text-white"><div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">{detail ? initials(detail.fullName) : ""}</div><SheetTitle className="text-xl text-white">{detail?.fullName}</SheetTitle><SheetDescription className="text-blue-100">{detail?.staffCode} · {live ? "Hồ sơ CSDL trung tâm" : "Hồ sơ minh họa"}</SheetDescription></SheetHeader>{detail ? <div className="space-y-6 p-6"><DetailBlock title="Thông tin công tác" items={[['Đơn vị', detail.unit], ['Chức vụ', detail.position], ['Trạng thái', detail.status], ['Đồng bộ', detail.sync]]} /><DetailBlock title="Thông tin cá nhân" items={[['Ngày sinh', displayDate(detail.birthDate)], ['Giới tính', detail.gender], ['Trình độ', detail.degree]]} /><div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800"><p className="font-semibold">Khóa liên kết an toàn</p><p className="mt-1 leading-5">Hồ sơ dùng person_id nội bộ. Họ tên chỉ dùng tìm kiếm; không dùng làm khóa.</p></div></div> : null}</SheetContent></Sheet>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-sm font-medium text-slate-700"><span>{label}</span>{children}</label>;
}

function DetailBlock({ title, items }: { title: string; items: string[][] }) {
  return <section><h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{title}</h3><dl className="divide-y rounded-xl border bg-white">{items.map(([label, value]) => <div key={label} className="grid grid-cols-[130px_1fr] gap-3 px-4 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-800">{value || "Chưa có"}</dd></div>)}</dl></section>;
}

function DemoDataNotice({ live = false, connected = false, loading = false }: { live?: boolean; connected?: boolean; loading?: boolean }) {
  if (live) return <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><Database className="mt-0.5 size-4 shrink-0"/><p><strong>Đang hiển thị dữ liệu từ CSDL trung tâm.</strong> Mọi sửa đổi dùng cùng person_id/contract_id, có phiên bản, checksum và nhật ký.</p></div>;
  return <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">{loading?<Loader2 className="mt-0.5 size-4 shrink-0 animate-spin"/>:<Sparkles className="mt-0.5 size-4 shrink-0"/>}<p><strong>{loading ? "Đang kiểm tra CSDL trung tâm." : "Dữ liệu trên bảng là minh họa, không chứa thông tin cá nhân thật."}</strong> {connected ? "CSDL hiện chưa có hồ sơ chính thức; hãy xác nhận nhập tại Trung tâm nhập dữ liệu." : "Ba tệp nguồn đã được phân tích cấu trúc; dữ liệu cá nhân chỉ được ghi sau khi bạn xác nhận."}</p></div>;
}

function OrganizationsView({ workspace }: { workspace: WorkspaceData }) {
  const live = workspace.connected && workspace.organizations.length > 0;
  const peopleCount = live ? workspace.dashboard?.counts.people ?? 0 : 384;
  const organizationCount = live ? workspace.dashboard?.counts.organizations ?? 0 : 17;
  const activeOrganizations = workspace.organizations.filter((row) => !["inactive", "khong hoat dong", "da giai the"].includes(normalizeForMatch(row.status)));
  const organizationRows = live ? activeOrganizations : [];
  const liveChart = organizationRows.map((row) => ({
    name: normalizeText(row.shortName) || normalizeText(row.name),
    total: workspace.people.filter((person) => normalizeForMatch(person.unit) === normalizeForMatch(row.name)).length,
  })).filter((row) => row.total > 0).sort((a, b) => b.total - a.total).slice(0, 12);
  const chartRows = liveChart.length ? liveChart : unitData;
  const levelCount = (patterns: string[]) => organizationRows.filter((row) => patterns.some((pattern) => normalizeForMatch(row.level).includes(pattern))).length;
  return <div className="space-y-4">
    <DemoDataNotice live={live} connected={workspace.connected}/>
    <div className="grid gap-4 sm:grid-cols-3"><MiniStat label="Đơn vị hiện hành" value={String(organizationCount)} icon={Building2} /><MiniStat label={live ? "Khoa/bộ môn" : "Khối khoa nguồn"} value={String(live ? levelCount(["khoa", "bo mon"]) : 8)} icon={GraduationCap} /><MiniStat label={live ? "Phòng/trung tâm" : "Khối phòng/trung tâm nguồn"} value={String(live ? levelCount(["phong", "trung tam"]) : 9)} icon={Columns3} /></div>
    <Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Phân bố nhân sự theo đơn vị</CardTitle><CardDescription>{liveChart.length ? "Tính trực tiếp từ hồ sơ đã liên kết với danh mục đơn vị." : "Dữ liệu phân tích kỳ T8/2026; tên nguồn được chuẩn hóa qua danh mục nhưng vẫn lưu bản gốc."}</CardDescription></CardHeader><CardContent><ChartContainer config={{ total: { label: "Nhân sự", color: "#0065a8" } }} className="h-[360px] w-full"><BarChart data={chartRows} layout="vertical" margin={{ left: 10, right: 45 }}><CartesianGrid horizontal={false} strokeDasharray="4 4"/><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={152} axisLine={false} tickLine={false} tick={{ fontSize: 12 }}/><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="total" fill="#0b78b6" radius={[0, 6, 6, 0]}><LabelList dataKey="total" position="right" className="fill-slate-700 text-xs font-semibold" /></Bar></BarChart></ChartContainer></CardContent></Card>
    <Card className="rounded-2xl shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">Cây đơn vị</CardTitle><CardDescription>Hỗ trợ đơn vị cha, lịch sử đổi tên và sáp nhập.</CardDescription></div><Button className="rounded-xl bg-[#0065a8]"><Plus className="size-4"/>Thêm đơn vị</Button></CardHeader><CardContent className="space-y-2">{live ? organizationRows.slice(0, 40).map((row) => <OrganizationNode key={String(row.id)} name={normalizeText(row.name)} code={normalizeText(row.code)} count={workspace.people.filter((person) => normalizeForMatch(person.unit) === normalizeForMatch(row.name)).length} level={row.parentId ? 1 : 0}/>) : <><OrganizationNode name="Trường Đại học Sư phạm – ĐHĐN" code="UED" count={peopleCount} level={0}/>{['Khối Ban Giám hiệu và Đảng ủy','Khối khoa chuyên môn','Khối phòng chức năng','Khối trung tâm trực thuộc'].map((name,index) => <OrganizationNode key={name} name={name} code={`DV-${index+1}`} count={[5,276,84,19][index]} level={1}/>)}</>}</CardContent></Card>
    {workspace.assignments.length ? <Card className="overflow-hidden rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Chức vụ và phân công hiện hành</CardTitle><CardDescription>Chức vụ được tách khỏi hồ sơ cá nhân để giữ đầy đủ lịch sử bổ nhiệm, kiêm nhiệm và miễn nhiệm.</CardDescription></CardHeader><div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Họ và tên</TableHead><TableHead>Loại phân công</TableHead><TableHead>Chức vụ/chức danh</TableHead><TableHead>Đơn vị</TableHead><TableHead>Thời gian</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader><TableBody>{workspace.assignments.slice(0, 100).map((row) => <TableRow key={String(row.id)}><TableCell><p className="font-semibold">{normalizeText(row.fullName)}</p><p className="font-mono text-xs text-slate-400">{normalizeText(row.staffCode) || "Chưa cấp mã"}</p></TableCell><TableCell>{normalizeText(row.assignmentType)}</TableCell><TableCell>{normalizeText(row.title)}</TableCell><TableCell>{normalizeText(row.organization) || "—"}</TableCell><TableCell className="whitespace-nowrap">{displayDate(row.startDate)} – {displayDate(row.endDate)}</TableCell><TableCell><Badge variant="outline">{normalizeText(row.status)}</Badge></TableCell></TableRow>)}</TableBody></Table></div></Card> : null}
  </div>;
}

function OrganizationNode({ name, code, count, level }: { name: string; code: string; count: number; level: number }) {
  return <button className={cn("flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left hover:border-sky-200 hover:bg-sky-50/40", level && "ml-5 w-[calc(100%-1.25rem)]")}><span className="flex size-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Building2 className="size-4"/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{name}</span><span className="text-xs text-slate-400">{code}</span></span><Badge variant="secondary">{count} người</Badge><ChevronRight className="size-4 text-slate-400"/></button>;
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return <Card className="rounded-2xl shadow-sm"><CardContent className="flex items-center gap-4 p-5"><span className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Icon className="size-5"/></span><div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900">{value}</p></div></CardContent></Card>;
}

function ContractsView({ search, sourceRows, connected }: { search: string; sourceRows: ContractRow[]; connected: boolean }) {
  const [status, setStatus] = React.useState("all");
  const [localSearch, setLocalSearch] = React.useState("");
  const live = connected && sourceRows.length > 0;
  const allRows: ContractRow[] = sourceRows.length ? sourceRows : [...syntheticContracts];
  const query = normalizeForMatch(`${search} ${localSearch}`);
  const rows = allRows.filter((row) =>
    (!query || normalizeForMatch(Object.values(row).join(" ")).includes(query)) &&
    (status === "all" || normalizeForMatch(row.status) === status),
  );
  const isStatus = (row: ContractRow, value: string) => normalizeForMatch(row.status) === normalizeForMatch(value);
  const counts = live
    ? {
        total: allRows.length,
        active: allRows.filter((row) => isStatus(row, "đang hiệu lực") || isStatus(row, "sắp hết hạn")).length,
        expired: allRows.filter((row) => isStatus(row, "đã hết hạn")).length,
        terminated: allRows.filter((row) => isStatus(row, "đã thanh lý")).length,
      }
    : { total: 423, active: 407, expired: 15, terminated: 1 };

  return (
    <div className="space-y-4">
      <DemoDataNotice live={live} connected={connected} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label={live ? "Tổng hợp đồng trong CSDL" : "Tổng bản ghi nguồn"} value={String(counts.total)} icon={Files} />
        <MiniStat label="Đang hiệu lực" value={String(counts.active)} icon={FileCheck2} />
        <MiniStat label="Đã hết hạn" value={String(counts.expired)} icon={FileClock} />
        <MiniStat label="Đã thanh lý" value={String(counts.terminated)} icon={ArchiveRestore} />
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} className="h-10 rounded-xl pl-9" placeholder="Tìm số hợp đồng, họ tên, đơn vị…" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 min-w-[190px] rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="dang hieu luc">Đang hiệu lực</SelectItem>
            <SelectItem value="sap het han">Sắp hết hạn</SelectItem>
            <SelectItem value="da het han">Đã hết hạn</SelectItem>
            <SelectItem value="da thanh ly">Đã thanh lý</SelectItem>
            <SelectItem value="cho bo sung">Chờ bổ sung</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-10 rounded-xl"><Download className="size-4" />Xuất danh sách</Button>
        <Button className="h-10 rounded-xl bg-[#0065a8]"><Plus className="size-4" />Thêm hợp đồng</Button>
      </div>
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50"><TableRow><TableHead className="min-w-[165px]">Số hợp đồng</TableHead><TableHead className="min-w-[200px]">Người ký hợp đồng</TableHead><TableHead className="min-w-[210px]">Loại hợp đồng</TableHead><TableHead className="min-w-[210px]">Đơn vị sử dụng</TableHead><TableHead>Bắt đầu</TableHead><TableHead>Hết hạn</TableHead><TableHead>Trạng thái</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
            <TableBody>
              {rows.map((row) => {
                const normalizedStatus = normalizeForMatch(row.status);
                return <TableRow key={row.id}><TableCell className="font-mono text-xs font-semibold text-[#075487]">{row.number}</TableCell><TableCell className="font-semibold">{row.person}</TableCell><TableCell>{row.type}</TableCell><TableCell className="text-slate-600">{row.unit}</TableCell><TableCell>{row.start}</TableCell><TableCell>{row.end}</TableCell><TableCell><Badge className={cn("font-normal", normalizedStatus === "dang hieu luc" && "bg-emerald-100 text-emerald-700", normalizedStatus === "sap het han" && "bg-amber-100 text-amber-800", normalizedStatus === "da het han" && "bg-rose-100 text-rose-700", normalizedStatus === "da thanh ly" && "bg-slate-200 text-slate-700", normalizedStatus === "cho bo sung" && "bg-violet-100 text-violet-700")}>{row.status}</Badge>{row.days !== null && row.days >= 0 && row.days <= 90 ? <p className="mt-1 text-xs text-amber-700">Còn {row.days} ngày</p> : null}</TableCell><TableCell><Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button></TableCell></TableRow>;
              })}
            </TableBody>
          </Table>
        </div>
        <div className="border-t bg-slate-50/60 px-4 py-3 text-sm text-slate-500">Hiển thị {rows.length} {live ? "hợp đồng từ CSDL trung tâm" : "dòng minh họa"} · Nguồn đã lập bản đồ: 423 hợp đồng, không cộng lặp 89 dòng XĐTH.</div>
      </Card>
    </div>
  );
}

function ChangesView({ workspace }: { workspace: WorkspaceData }) {
  const changeRows = monthlyWorkforce.map((item, index) => ({ ...item, change: index ? item.total - monthlyWorkforce[index - 1].total : 0 }));
  const live = workspace.connected && workspace.events.length > 0;
  const eventCount = (terms: string[]) => workspace.events.filter((row) => terms.some((term) => normalizeForMatch(row.eventType).includes(term))).length;
  return <div className="space-y-4"><DemoDataNotice live={live} connected={workspace.connected}/><div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end"><PeriodCard label="Kỳ gốc" month="T01/2026" total={380}/><div className="flex justify-center pb-5"><span className="rounded-full border bg-white p-2 text-slate-400"><ChevronRight className="size-5"/></span></div><PeriodCard label="Kỳ so sánh" month="T08/2026" total={384}/></div><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Dòng biến động theo tháng</CardTitle><CardDescription>Số liệu ảnh chụp nguồn cho thấy tăng ròng 4 hồ sơ từ T01 đến T08/2026.</CardDescription></CardHeader><CardContent><ChartContainer config={{ total: { label: "Tổng nhân sự", color: "#0065a8" } }} className="h-[320px] w-full"><LineChart data={changeRows} margin={{ left: 4, right: 20, top: 25 }}><CartesianGrid vertical={false} strokeDasharray="4 4"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis domain={[376,386]} axisLine={false} tickLine={false}/><ChartTooltip content={<ChartTooltipContent/>}/><Line type="monotone" dataKey="total" stroke="#0065a8" strokeWidth={3} dot={{ fill: "#fff", strokeWidth: 3, r: 5 }}><LabelList dataKey="total" position="top" className="fill-slate-700 text-xs font-semibold"/></Line></LineChart></ChartContainer></CardContent></Card><div className="grid gap-4 lg:grid-cols-3"><ChangeCard title={live ? "Tuyển/tiếp nhận" : "Tăng mới"} value={live ? String(eventCount(["tuyen", "tiep nhan", "tang"])) : "+7"} detail={live ? "Bản ghi biến động trong CSDL" : "Theo đối chiếu khóa hồ sơ giữa các kỳ"} color="emerald"/><ChangeCard title="Giảm" value={live ? String(eventCount(["nghi", "cham dut", "giam"])) : "−3"} detail={live ? "Nghỉ việc, nghỉ hưu hoặc chuyển ra" : "Nghỉ việc/nghỉ hưu/chuyển ra"} color="rose"/><ChangeCard title={live ? "Tổng biến động" : "Biến động ròng"} value={live ? String(workspace.events.length) : "+4"} detail={live ? "Có quyết định và ngày hiệu lực" : "380 → 384 hồ sơ"} color="blue"/></div>{live ? <Card className="overflow-hidden rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Biến động đã ghi nhận</CardTitle><CardDescription>Liên kết bằng person_id và mã đơn vị, không dùng họ tên làm khóa.</CardDescription></CardHeader><div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Ngày hiệu lực</TableHead><TableHead>Họ và tên</TableHead><TableHead>Loại biến động</TableHead><TableHead>Đơn vị cũ</TableHead><TableHead>Đơn vị mới</TableHead><TableHead>Số quyết định</TableHead></TableRow></TableHeader><TableBody>{workspace.events.slice(0, 100).map((row) => <TableRow key={String(row.id)}><TableCell>{displayDate(row.effectiveDate)}</TableCell><TableCell className="font-semibold">{normalizeText(row.fullName)}</TableCell><TableCell>{normalizeText(row.eventType)}</TableCell><TableCell>{normalizeText(row.fromOrganizationCode) || "—"}</TableCell><TableCell>{normalizeText(row.toOrganizationCode) || "—"}</TableCell><TableCell>{normalizeText(row.decisionNumber) || "—"}</TableCell></TableRow>)}</TableBody></Table></div></Card> : null}</div>;
}

function PeriodCard({ label, month, total }: { label: string; month: string; total: number }) { return <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><div className="mt-2 flex items-end justify-between"><div><p className="text-xl font-bold">{month}</p><p className="mt-1 text-sm text-slate-500">Ảnh chụp dữ liệu đã khóa</p></div><p className="text-3xl font-bold text-[#0065a8]">{total}</p></div></CardContent></Card>; }
function ChangeCard({ title, value, detail, color }: { title: string; value: string; detail: string; color: string }) { return <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between"><p className="font-semibold text-slate-700">{title}</p><Badge variant="outline" className={cn(color === "emerald" && "border-emerald-200 text-emerald-700", color === "rose" && "border-rose-200 text-rose-700", color === "blue" && "border-sky-200 text-sky-700")}>{value}</Badge></div><p className="mt-4 text-sm text-slate-500">{detail}</p></CardContent></Card>; }

function EducationView({ workspace }: { workspace: WorkspaceData }) {
  const live = workspace.connected && (workspace.training.length > 0 || workspace.commitments.length > 0);
  const unfinished = workspace.training.filter((row) => !["da hoan thanh", "hoan thanh", "tot nghiep"].includes(normalizeForMatch(row.status))).length;
  const abroad = workspace.training.filter((row) => normalizeForMatch(`${row.countryScope} ${row.country}`).includes("ngoai") || (normalizeText(row.country) && normalizeForMatch(row.country) !== "viet nam")).length;
  const dueCommitments = workspace.commitments.filter((row) => !["da hoan thanh", "mien/khong ap dung"].includes(normalizeForMatch(row.status))).length;
  const liveMetrics = [
    { name: "Hồ sơ đào tạo", value: workspace.training.length, color: "#0065a8" },
    { name: "Đang theo dõi", value: unfinished, color: "#7c5ce7" },
    { name: "Đào tạo ngoài nước", value: abroad, color: "#13a89e" },
    { name: "Cam kết/hoàn trả mở", value: dueCommitments, color: "#f2b544" },
  ];
  const metrics = live ? liveMetrics : degreeDistribution;
  const metricTotal = live ? Math.max(1, workspace.training.length + workspace.commitments.length) : 384;
  return <div className="space-y-4">
    <DemoDataNotice live={live} connected={workspace.connected}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((item) => <Card key={item.name} className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="size-3 rounded-full" style={{backgroundColor:item.color}}/><span className="text-xs text-slate-400">{live ? "CSDL trung tâm" : "T8/2026"}</span></div><p className="mt-5 text-3xl font-bold">{item.value}</p><p className="mt-1 text-sm text-slate-500">{item.name}</p><p className="mt-3 text-xs font-medium text-slate-400">{live ? "Cập nhật theo dữ liệu đã duyệt" : `${Math.round(item.value/metricTotal*100)}% toàn trường`}</p></CardContent></Card>)}</div>
    {live ? <><Card className="overflow-hidden rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Quá trình đào tạo</CardTitle><CardDescription>Nghiên cứu sinh, học tập trong/ngoài nước và kết quả tốt nghiệp cùng dùng person_id.</CardDescription></CardHeader><div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Họ và tên</TableHead><TableHead>Loại đào tạo</TableHead><TableHead>Chương trình/chuyên ngành</TableHead><TableHead>Cơ sở · quốc gia</TableHead><TableHead>Thời gian</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader><TableBody>{workspace.training.slice(0, 100).map((row) => <TableRow key={String(row.id)}><TableCell><p className="font-semibold">{normalizeText(row.fullName)}</p><p className="font-mono text-xs text-slate-400">{normalizeText(row.staffCode) || "Chưa cấp mã"}</p></TableCell><TableCell>{normalizeText(row.trainingType)}</TableCell><TableCell>{normalizeText(row.programName) || normalizeText(row.major) || "—"}</TableCell><TableCell>{[normalizeText(row.institution), normalizeText(row.country)].filter(Boolean).join(" · ") || "—"}</TableCell><TableCell className="whitespace-nowrap">{displayDate(row.startDate)} – {displayDate(row.endDate)}</TableCell><TableCell><Badge variant="outline">{normalizeText(row.status)}</Badge></TableCell></TableRow>)}</TableBody></Table></div></Card><Card className="overflow-hidden rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Cam kết và hoàn trả kinh phí</CardTitle><CardDescription>Cảnh báo hạn được sinh từ ngày đến hạn, không phụ thuộc thao tác mở màn hình.</CardDescription></CardHeader>{workspace.commitments.length ? <div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Họ và tên</TableHead><TableHead>Số quyết định</TableHead><TableHead>Số tiền</TableHead><TableHead>Hạn thực hiện</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader><TableBody>{workspace.commitments.slice(0, 100).map((row) => <TableRow key={String(row.id)}><TableCell className="font-semibold">{normalizeText(row.fullName)}</TableCell><TableCell>{normalizeText(row.decisionNumber) || "—"}</TableCell><TableCell>{Number(row.amount ?? 0).toLocaleString("vi-VN")} ₫</TableCell><TableCell>{displayDate(row.dueDate)}</TableCell><TableCell><Badge variant="outline">{normalizeText(row.status)}</Badge></TableCell></TableRow>)}</TableBody></Table></div> : <CardContent><div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Chưa có cam kết nào được ghi chính thức.</div></CardContent>}</Card></> : <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]"><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Học hàm</CardTitle><CardDescription>Quản lý độc lập với học vị.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 p-5"><p className="text-sm font-medium text-amber-800">Giáo sư</p><p className="mt-1 text-4xl font-bold text-amber-900">1</p></div><div className="rounded-2xl bg-gradient-to-br from-sky-50 to-cyan-100 p-5"><p className="text-sm font-medium text-sky-800">Phó giáo sư</p><p className="mt-1 text-4xl font-bold text-sky-900">40</p></div></CardContent></Card><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Hồ sơ đào tạo cần theo dõi</CardTitle><CardDescription>Số liệu minh họa từ các sheet nguồn, chưa ghi vào CSDL.</CardDescription></CardHeader><CardContent className="space-y-2">{[{label:'Đã và đang học tập ở nước ngoài',value:74,icon:GraduationCap},{label:'Theo dõi đền bù chi phí đào tạo',value:7,icon:AlertTriangle},{label:'Danh sách tốt nghiệp ở nước ngoài',value:42,icon:BookOpenCheck}].map((item)=><div key={item.label} className="flex w-full items-center gap-3 rounded-xl border p-4"><span className="rounded-xl bg-sky-100 p-2.5 text-sky-700"><item.icon className="size-4"/></span><span className="flex-1 text-sm font-medium">{item.label}</span><span className="text-xl font-bold text-slate-900">{item.value}</span></div>)}</CardContent></Card></div>}
  </div>;
}

function DocumentsView({ workspace, onDataChanged }: { workspace: WorkspaceData; onDataChanged: () => Promise<void> }) {
  const [uploading, setUploading] = React.useState(false);
  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    if (file.size > 15 * 1024 * 1024) return toast.error("Tệp vượt quá 15 MB.");
    setUploading(true);
    try {
      const form = new FormData(); form.append("file", file); form.append("ownerEntityType", "general"); form.append("ownerEntityId", "unassigned");
      const response = await fetch("/api/files", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Không thể tải tệp");
      await onDataChanged();
      toast.success("Đã lưu tệp và thông tin phiên bản.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể lưu tệp; dữ liệu hiện có không bị thay đổi."); }
    finally { setUploading(false); }
  }
  const recentRows: Array<Record<string, unknown> & { rowKey: string; kind: string; downloadable: boolean }> = [
    ...workspace.files.map((row) => ({ ...row, rowKey: `file-${row.id}`, kind: "Tệp đã tải", downloadable: true })),
    ...workspace.documents.map((row) => ({ ...row, rowKey: `document-${row.id}`, kind: "Metadata nhập", downloadable: false, createdAt: row.documentDate, contentType: row.fileType, sizeBytes: null })),
  ];
  recentRows.sort((a, b) => String(b.createdAt ?? b.updatedAt ?? "").localeCompare(String(a.createdAt ?? a.updatedAt ?? "")));
  return <div className="space-y-4"><Card className="rounded-2xl border-dashed border-sky-300 bg-gradient-to-br from-white to-sky-50 shadow-sm"><CardContent className="flex flex-col items-center px-6 py-12 text-center"><span className="rounded-2xl bg-sky-100 p-4 text-sky-700">{uploading?<Loader2 className="size-7 animate-spin"/>:<Upload className="size-7"/>}</span><h3 className="mt-4 text-lg font-bold">Kéo thả tệp hồ sơ hoặc chọn từ máy</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">PDF, DOCX, XLSX, ảnh; tối đa 15 MB/tệp. Tệp được gắn với hồ sơ bằng mã định danh, không dùng tên tệp làm khóa.</p><label className="mt-5"><input type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(e)=>void uploadFiles(e.target.files)} disabled={uploading}/><span className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0065a8] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#075487]"><Upload className="size-4"/>Chọn tệp</span></label></CardContent></Card><Card className="overflow-hidden rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Tệp và danh mục hồ sơ gần đây</CardTitle><CardDescription>Không hiển thị tệp nhạy cảm khi người dùng chưa có quyền; bản xóa mềm vẫn có thể khôi phục.</CardDescription></CardHeader>{recentRows.length ? <div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Tên tệp/tài liệu</TableHead><TableHead>Loại</TableHead><TableHead>Hồ sơ liên kết</TableHead><TableHead>Ngày</TableHead><TableHead>Dung lượng</TableHead><TableHead className="w-28"/></TableRow></TableHeader><TableBody>{recentRows.slice(0, 100).map((row) => <TableRow key={String(row.rowKey)}><TableCell><p className="font-semibold">{normalizeText(row.fileName)}</p><p className="text-xs text-slate-400">{normalizeText(row.documentNumber) || normalizeText(row.kind)}</p></TableCell><TableCell>{normalizeText(row.contentType) || "—"}</TableCell><TableCell className="font-mono text-xs">{normalizeText(row.ownerEntityType)} · {normalizeText(row.ownerEntityId)}</TableCell><TableCell>{displayDate(String(row.createdAt ?? row.updatedAt ?? "").slice(0, 10))}</TableCell><TableCell>{row.sizeBytes == null ? "—" : `${(Number(row.sizeBytes) / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} KB`}</TableCell><TableCell>{row.downloadable ? <Button asChild variant="outline" size="sm"><a href={`/api/files?id=${encodeURIComponent(String(row.id))}&download=1`}><Download className="size-4"/>Tải</a></Button> : <Badge variant="outline">v{Number(row.documentVersion ?? row.version ?? 1)}</Badge>}</TableCell></TableRow>)}</TableBody></Table></div> : <CardContent><div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500"><FileArchive className="mx-auto mb-3 size-7 text-slate-300"/>Chưa có tệp nào được lưu chính thức.</div></CardContent>}</Card></div>;
}

function ImportCenter({ onDataChanged, importHistory }: { onDataChanged: () => Promise<void>; importHistory: Array<Record<string, unknown>> }) {
  const [workbookState, setWorkbookState] = React.useState<WorkbookState | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [mode, setMode] = React.useState("validate");
  const [expandedFile, setExpandedFile] = React.useState<string>("staff-2026");
  const [fileQueue, setFileQueue] = React.useState<File[]>([]);

  async function selectFiles(list: FileList | null) {
    const selected = Array.from(list ?? []);
    if (!selected.length) return;
    setFileQueue(selected.slice(1));
    await parseFile(selected[0]);
  }

  async function parseFile(file: File) {
    if (!window.XLSX) return toast.error("Bộ đọc Excel chưa sẵn sàng. Vui lòng tải lại trang.");
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true, raw: true });
      const sheets = workbook.SheetNames as string[];
      const nonDataSheets = new Set(["huong dan", "tu dien truong", "danh muc"]);
      const activeSheet = sheets.find((sheet) => !nonDataSheets.has(normalizeForMatch(sheet).replace(/[_-]+/g, " "))) ?? sheets[0];
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[activeSheet], { header: 1, defval: "", raw: true }) as unknown[][];
      const headerDepth = detectHeaderDepth(file.name, activeSheet);
      const headerRow = headerDepth === 0 ? 1 : detectHeaderRow(rows);
      const entityType = inferEntity(file.name, activeSheet);
      const partial = { file, activeSheet, entityType };
      const headers = makeHeaders(rows, headerRow, headerDepth);
      const mappings = headers.map((header, index) => suggestMapping(header, index, partial));
      setWorkbookState({ file, checksum: await sha256(file), workbook, sheets, activeSheet, rows, headerRow, headerDepth, entityType, mappings });
      setStep(2);
      toast.success(`Đã đọc ${sheets.length} sheet. Hãy kiểm tra dòng tiêu đề trước khi tiếp tục.`);
    } catch (error) {
      toast.error(`Không đọc được tệp: ${error instanceof Error ? error.message : "định dạng không hợp lệ"}`);
    } finally { setLoading(false); }
  }

  function changeSheet(sheet: string) {
    if (!workbookState || !window.XLSX) return;
    const rows = window.XLSX.utils.sheet_to_json(workbookState.workbook.Sheets[sheet], { header: 1, defval: "", raw: true }) as unknown[][];
    const headerDepth = detectHeaderDepth(workbookState.file.name, sheet);
    const headerRow = headerDepth === 0 ? 1 : detectHeaderRow(rows);
    const entityType = inferEntity(workbookState.file.name, sheet);
    const headers = makeHeaders(rows, headerRow, headerDepth);
    const partial = { file: workbookState.file, activeSheet: sheet, entityType };
    setWorkbookState({ ...workbookState, activeSheet: sheet, rows, headerRow, headerDepth, entityType, mappings: headers.map((header, index) => suggestMapping(header, index, partial)) });
  }

  const headers = workbookState ? makeHeaders(workbookState.rows, workbookState.headerRow, workbookState.headerDepth) : [];
  const records = workbookState ? canonicalRows(workbookState) : [];
  const issues = workbookState ? validateRows(records, workbookState.entityType) : [];
  const errors = issues.filter((issue) => issue.severity === "Lỗi").length;
  const warnings = issues.length - errors;
  const previewColumns = workbookState ? importPreviewFields[workbookState.entityType] : importPreviewFields.people;

  async function commitImport() {
    if (!workbookState) return;
    if (mode === "validate") { toast.success(`Đã kiểm tra ${records.length} dòng: ${errors} lỗi, ${warnings} cảnh báo. Chưa ghi dữ liệu.`); return; }
    if (errors) return toast.error(`Còn ${errors} lỗi bắt buộc. Hãy sửa hoặc bỏ qua dòng lỗi trước khi ghi.`);
    const payload = { entityType: workbookState.entityType, mode, fileName: workbookState.file.name, fileChecksum: workbookState.checksum, fileSize: workbookState.file.size, sheetName: workbookState.activeSheet, headerRow: workbookState.headerRow, headerDepth: workbookState.headerDepth, mappings: workbookState.mappings, records };
    try {
      const result = await sendOrQueue("bulk_import", payload);
      await onDataChanged();
      if (result.queued) toast.warning("Mạng gián đoạn: đợt nhập đã được giữ trong hàng đợi và sẽ tự gửi lại.");
      else if ((result.data as { duplicateImport?: boolean })?.duplicateImport) toast.info("Tệp/sheet đã nhập trước đó; hệ thống không ghi trùng.");
      else {
        const summary = result.data as { inserted?: number; updated?: number; duplicates?: number; skipped?: number };
        toast.success(`Hoàn tất: thêm ${summary.inserted ?? 0}, cập nhật ${summary.updated ?? 0}, trùng ${summary.duplicates ?? 0}, bỏ qua ${summary.skipped ?? 0}.`);
      }
      if (!result.queued && fileQueue.length) {
        const [nextFile, ...rest] = fileQueue;
        setFileQueue(rest);
        await parseFile(nextFile);
      } else if (!result.queued) setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đợt nhập bị từ chối; dữ liệu chưa được ghi.");
    }
  }

  function exportErrors() {
    const lines = [["Mức độ","Sheet","Dòng","Trường","Lỗi","Cách sửa"], ...issues.map((issue) => [issue.severity, workbookState?.activeSheet ?? "", issue.row, issue.field, issue.message, issue.fix])];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\r\n");
    downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `bao-cao-loi-${workbookState?.activeSheet ?? "import"}.csv`);
  }

  return <Tabs data-import-center defaultValue="import" className="space-y-4"><TabsList className="h-auto flex-wrap rounded-xl bg-slate-200/70 p-1"><TabsTrigger value="import" className="rounded-lg px-4 py-2.5">Nhập dữ liệu</TabsTrigger><TabsTrigger value="map" className="rounded-lg px-4 py-2.5">Bản đồ nguồn đã duyệt</TabsTrigger><TabsTrigger value="history" className="rounded-lg px-4 py-2.5">Lịch sử nhập</TabsTrigger></TabsList>
    <TabsContent value="import" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">{['Chọn tệp','Chọn sheet & tiêu đề','Ánh xạ cột','Xem trước & ghi'].map((label,index)=><div key={label} className={cn("rounded-xl border p-3",step===index+1?"border-sky-300 bg-sky-50":"bg-white")}><div className="flex items-center gap-2"><span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-bold",step>index+1?"bg-emerald-500 text-white":step===index+1?"bg-[#0065a8] text-white":"bg-slate-100 text-slate-500")}>{step>index+1?<Check className="size-4"/>:index+1}</span><span className="text-sm font-semibold">{label}</span></div></div>)}</div>
      <Progress value={step*25} className="h-1.5" />
      <Card className="rounded-2xl border-sky-100 bg-sky-50/60 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">Bộ mẫu Excel chính thức UED-TC-2.0.0</CardTitle><CardDescription>Tải đúng mẫu theo nhóm nghiệp vụ; mã trường, kiểu ngày–số và danh mục đã đồng bộ với bộ nhập.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{officialTemplates.map((template)=><Button key={template.href} asChild variant="outline" className="h-auto min-h-11 justify-start whitespace-normal bg-white text-left"><a href={template.href} download><Download className="size-4 shrink-0"/><span>{template.name}</span></a></Button>)}</CardContent></Card>
      {workbookState && step >= 2 ? <div className="rounded-2xl border border-sky-200 bg-white p-3 shadow-sm"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Nhóm dữ liệu nhận diện</p><div className="flex flex-wrap gap-2">{importEntityOptions.map((option)=><button type="button" key={option.value} onClick={()=>{const next={...workbookState,entityType:option.value};setWorkbookState({...next,mappings:headers.map((header,index)=>suggestMapping(header,index,next))})}} className={cn("rounded-xl border px-3 py-2 text-sm font-medium transition",workbookState.entityType===option.value?"border-sky-300 bg-sky-50 text-[#075487]":"border-slate-200 bg-white text-slate-600 hover:border-sky-200")}>{option.label}</button>)}</div></div> : null}
      {step===1?<Card className="rounded-2xl border-dashed border-sky-300 shadow-sm"><CardContent className="flex flex-col items-center px-6 py-12 text-center"><span className="rounded-2xl bg-sky-100 p-4 text-sky-700">{loading?<Loader2 className="size-7 animate-spin"/>:<FileSpreadsheet className="size-7"/>}</span><h3 className="mt-4 text-lg font-bold">Chọn một hoặc nhiều tệp Excel/CSV</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Hỗ trợ XLSX, XLS, CSV, TSV và nhiều sheet. Tệp được đưa vào hàng đợi; từng sheet đều qua nhận diện, ánh xạ, xem trước và xác nhận riêng.</p><label className="mt-5"><input type="file" accept=".xlsx,.xls,.csv,.tsv" multiple className="sr-only" onChange={(e)=>void selectFiles(e.target.files)}/><span className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0065a8] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#075487]"><Upload className="size-4"/>Chọn tệp từ máy</span></label>{fileQueue.length?<p className="mt-4 text-xs font-semibold text-sky-700">Còn {fileQueue.length} tệp trong hàng đợi</p>:<p className="mt-4 text-xs text-slate-400">Không ghi dữ liệu ngay khi vừa chọn tệp.</p>}</CardContent></Card>:null}
      {workbookState&&step===2?<Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Kiểm tra vùng dữ liệu</CardTitle><CardDescription>{workbookState.file.name} · SHA-256: {workbookState.checksum.slice(0,12)}…</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-3"><Field label="Sheet"><Select value={workbookState.activeSheet} onValueChange={changeSheet}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{workbookState.sheets.map((sheet)=><SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>)}</SelectContent></Select></Field><Field label="Dòng tiêu đề"><Input type="number" min={1} max={25} value={workbookState.headerRow} onChange={(e)=>setWorkbookState({...workbookState,headerRow:Number(e.target.value)||1})}/></Field><Field label="Số tầng tiêu đề"><Select value={String(workbookState.headerDepth)} onValueChange={(v)=>setWorkbookState({...workbookState,headerDepth:Number(v)})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="0">Không có tiêu đề</SelectItem><SelectItem value="1">1 dòng</SelectItem><SelectItem value="2">2 dòng</SelectItem><SelectItem value="3">3 dòng</SelectItem></SelectContent></Select></Field></div>{workbookState.headerDepth===0?<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Sheet không có tiêu đề.</strong> Hãy xác nhận ý nghĩa từng cột ở bước ánh xạ; hệ thống không tự suy đoán dữ liệu còn thiếu.</div>:null}<div className="overflow-x-auto rounded-xl border"><Table><TableBody>{workbookState.rows.slice(Math.max(0,workbookState.headerRow-3),workbookState.headerRow+4).map((row,index)=><TableRow key={index} className={index===2?"bg-sky-50 font-semibold":""}><TableCell className="sticky left-0 bg-inherit font-mono text-xs text-slate-400">{Math.max(1,workbookState.headerRow-2)+index}</TableCell>{row.slice(0,12).map((cell,i)=><TableCell key={i} className="min-w-[120px] max-w-[220px] truncate text-xs">{formatCell(cell)||<span className="text-slate-300">trống</span>}</TableCell>)}</TableRow>)}</TableBody></Table></div><div className="flex justify-between"><Button variant="outline" onClick={()=>{setStep(1);setWorkbookState(null)}}>Chọn tệp khác</Button><Button className="bg-[#0065a8]" onClick={()=>{const hs=makeHeaders(workbookState.rows,workbookState.headerRow,workbookState.headerDepth);setWorkbookState({...workbookState,mappings:hs.map((h,i)=>suggestMapping(h,i,workbookState))});setStep(3)}}>Tiếp tục ánh xạ <ChevronRight className="size-4"/></Button></div></CardContent></Card>:null}
      {workbookState&&step===3?<Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Ánh xạ cột nguồn sang dữ liệu hệ thống</CardTitle><CardDescription>Cho phép nhiều cột nguồn ghép vào một trường; giá trị gốc vẫn được giữ để đối chiếu.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 lg:grid-cols-2">{headers.slice(0,50).map((header,index)=><div key={`${header}-${index}`} className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2 rounded-xl border bg-slate-50/60 p-2.5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-700">{header}</p><p className="mt-0.5 truncate text-xs text-slate-400">Cột {excelColumnName(index)} · Ví dụ: {formatCell(workbookState.rows[workbookState.headerRow-1+workbookState.headerDepth]?.[index])||'trống'}</p></div><ChevronRight className="size-4 text-slate-300"/><Select value={workbookState.mappings[index]||'ignore'} onValueChange={(value)=>{const mappings=[...workbookState.mappings];mappings[index]=value;setWorkbookState({...workbookState,mappings})}}><SelectTrigger className="h-9 bg-white"><SelectValue/></SelectTrigger><SelectContent>{canonicalFields.map((field)=><SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}</SelectContent></Select></div>)}</div><div className="flex justify-between"><Button variant="outline" onClick={()=>setStep(2)}>Quay lại</Button><Button className="bg-[#0065a8]" onClick={()=>setStep(4)}>Tạo bản xem trước <ChevronRight className="size-4"/></Button></div></CardContent></Card>:null}
      {workbookState&&step===4?<div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryTile label="Dòng nhận diện" value={records.length} tone="blue"/><SummaryTile label="Sẵn sàng" value={Math.max(0,records.length-errors)} tone="green"/><SummaryTile label="Lỗi bắt buộc" value={errors} tone="red"/><SummaryTile label="Cảnh báo" value={warnings} tone="amber"/></div><Card className="rounded-2xl shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="text-base">Bản xem trước</CardTitle><CardDescription>Hiển thị 8 dòng đầu; chưa ghi vào cơ sở dữ liệu.</CardDescription></div>{issues.length?<Button variant="outline" size="sm" onClick={exportErrors}><Download className="size-4"/>Tải báo cáo lỗi</Button>:null}</CardHeader><CardContent><div className="overflow-x-auto rounded-xl border"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="min-w-[90px]">Dòng</TableHead>{previewColumns.map((column)=><TableHead key={column.key} className="min-w-[140px]">{column.label}</TableHead>)}<TableHead className="min-w-[120px]">Kiểm tra</TableHead></TableRow></TableHeader><TableBody>{records.slice(0,8).map((row)=><TableRow key={String(row.sourceRow)}><TableCell>{String(row.sourceRow)}</TableCell>{previewColumns.map((column)=><TableCell key={column.key} className={column.key==='fullName'||column.key==='organizationName'||column.key==='fileName'?"font-semibold":undefined}>{["birthDate","effectiveDate","startDate","endDate","dueDate","completedDate","documentDate"].includes(column.key)?displayDate(row[column.key]):normalizeText(row[column.key])||'—'}</TableCell>)}<TableCell>{issues.some((issue)=>issue.row===row.sourceRow&&issue.severity==='Lỗi')?<Badge className="bg-rose-100 text-rose-700">Có lỗi</Badge>:issues.some((issue)=>issue.row===row.sourceRow)?<Badge className="bg-amber-100 text-amber-700">Cần xem</Badge>:<Badge className="bg-emerald-100 text-emerald-700">Hợp lệ</Badge>}</TableCell></TableRow>)}</TableBody></Table></div>{issues.length?<div className="mt-4 max-h-56 space-y-2 overflow-y-auto">{issues.slice(0,12).map((issue,index)=><div key={`${issue.row}-${issue.field}-${index}`} className={cn("grid gap-1 rounded-xl border px-3 py-2.5 text-sm sm:grid-cols-[90px_120px_1fr]",issue.severity==='Lỗi'?"border-rose-200 bg-rose-50":"border-amber-200 bg-amber-50")}><span className="font-semibold">{issue.severity}</span><span>Dòng {issue.row} · {issue.field}</span><span>{issue.message} <span className="text-slate-500">{issue.fix}</span></span></div>)}</div>:<div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="size-4"/>Không phát hiện lỗi trong phạm vi kiểm tra.</div>}<div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><Select value={mode} onValueChange={setMode}><SelectTrigger className="h-10"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="validate">Chỉ kiểm tra, chưa ghi</SelectItem><SelectItem value="new">Nhập mới</SelectItem><SelectItem value="update">Cập nhật theo mã/khóa</SelectItem><SelectItem value="merge">Gộp có kiểm tra</SelectItem></SelectContent></Select><div className="flex gap-2"><Button variant="outline" onClick={()=>setStep(3)}>Sửa ánh xạ</Button><Button onClick={()=>void commitImport()} className="bg-[#0065a8]"><Database className="size-4"/>{mode==='validate'?'Chạy kiểm tra':'Xác nhận ghi'}</Button></div></div></CardContent></Card></div>:null}
    </TabsContent>
    <TabsContent value="map" className="space-y-4"><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Ba tệp nguồn đã kiểm tra</CardTitle><CardDescription>Bản đồ được lập trực tiếp từ tệp bạn cung cấp ngày 08/09/2026.</CardDescription></CardHeader><CardContent className="space-y-3">{sourceFiles.map((source)=><div key={source.id} className="overflow-hidden rounded-xl border"><button onClick={()=>setExpandedFile(expandedFile===source.id?'':source.id)} className="flex w-full items-center gap-3 bg-white p-4 text-left hover:bg-slate-50"><span className={cn("rounded-xl p-2.5",source.status==='mapped'?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700")}><FileSpreadsheet className="size-5"/></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{source.file}</span><span className="mt-0.5 block text-sm text-slate-500">{source.purpose}</span></span><Badge className={source.status==='mapped'?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-800"}>{source.status==='mapped'?'Đã ánh xạ':'Nguồn trùng'}</Badge><ChevronDown className={cn("size-4 transition",expandedFile===source.id&&"rotate-180")}/></button>{expandedFile===source.id?<div className="border-t bg-slate-50/70 p-3"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sheet</TableHead><TableHead>Dòng tiêu đề</TableHead><TableHead className="text-right">Số dòng</TableHead><TableHead>Quy tắc</TableHead></TableRow></TableHeader><TableBody>{source.sheets.map((sheet)=><TableRow key={sheet.name}><TableCell className="font-semibold">{sheet.name}</TableCell><TableCell>{sheet.header}</TableCell><TableCell className="text-right font-mono">{sheet.rows}</TableCell><TableCell className="min-w-[320px] text-slate-500">{sheet.note}</TableCell></TableRow>)}</TableBody></Table></div></div>:null}</div>)}</CardContent></Card><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Ánh xạ hồ sơ đội ngũ T01–T08</CardTitle><CardDescription>Khóa nội bộ person_id được sinh ổn định; mã cán bộ cần quản trị bổ sung vì tệp nguồn chưa có.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Cột nguồn</TableHead><TableHead>Tên nguồn</TableHead><TableHead>Trường hệ thống</TableHead><TableHead>Kiểu</TableHead><TableHead>Bắt buộc</TableHead><TableHead className="min-w-[300px]">Quy tắc</TableHead></TableRow></TableHeader><TableBody>{dataMap.map((row)=><TableRow key={row.source}><TableCell className="font-mono text-xs font-semibold">{row.source}</TableCell><TableCell>{row.sourceName}</TableCell><TableCell className="font-mono text-xs text-[#075487]">{row.target}</TableCell><TableCell>{row.type}</TableCell><TableCell>{row.required?<Badge className="bg-rose-100 text-rose-700">Có</Badge>:<span className="text-slate-400">Không</span>}</TableCell><TableCell className="text-sm text-slate-500">{row.note}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Ánh xạ hợp đồng</CardTitle><CardDescription>Dùng một schema chung cho cả 6 loại hợp đồng.</CardDescription></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-2">{contractMap.map((row)=><div key={row.target} className="rounded-xl border bg-slate-50/60 p-3"><div className="flex items-center gap-2 text-sm font-semibold"><span>{row.sourceName}</span><ChevronRight className="size-4 text-slate-300"/><code className="text-xs text-[#075487]">{row.target}</code></div><p className="mt-2 text-sm leading-5 text-slate-500">{row.rule}</p></div>)}</div></CardContent></Card></TabsContent>
    <TabsContent value="history"><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Lịch sử nhập dữ liệu</CardTitle><CardDescription>Mỗi đợt lưu checksum, chế độ, số thêm/cập nhật/trùng/bỏ qua/lỗi và người thực hiện.</CardDescription></CardHeader><CardContent>{importHistory.length?<div className="overflow-x-auto rounded-xl border"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Tệp / Sheet</TableHead><TableHead>Chế độ</TableHead><TableHead className="text-right">Thêm</TableHead><TableHead className="text-right">Cập nhật</TableHead><TableHead className="text-right">Trùng</TableHead><TableHead className="text-right">Bỏ qua/Lỗi</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader><TableBody>{importHistory.map((item)=><TableRow key={String(item.id)}><TableCell><p className="font-semibold">{String(item.fileName ?? "")}</p><p className="text-xs text-slate-500">{String(item.sheetName ?? "")} · {String(item.checksumPrefix ?? "")}…</p></TableCell><TableCell>{String(item.mode ?? "")}</TableCell><TableCell className="text-right font-mono">{String(item.insertedRows ?? 0)}</TableCell><TableCell className="text-right font-mono">{String(item.updatedRows ?? 0)}</TableCell><TableCell className="text-right font-mono">{String(item.duplicateRows ?? 0)}</TableCell><TableCell className="text-right font-mono">{String(item.skippedRows ?? 0)}/{String(item.errorRows ?? 0)}</TableCell><TableCell><Badge className={item.status==='completed'?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-700"}>{item.status==='completed'?'Hoàn tất':'Có lỗi'}</Badge></TableCell></TableRow>)}</TableBody></Table></div>:<div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500"><History className="mx-auto mb-3 size-7 text-slate-300"/>Chưa có đợt nhập chính thức. Kết quả “chỉ kiểm tra” không làm thay đổi dữ liệu.</div>}</CardContent></Card></TabsContent>
  </Tabs>;
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) { return <Card className="rounded-2xl shadow-sm"><CardContent className="p-4"><p className="text-sm text-slate-500">{label}</p><p className={cn("mt-2 text-3xl font-bold",tone==='blue'&&"text-sky-700",tone==='green'&&"text-emerald-700",tone==='red'&&"text-rose-700",tone==='amber'&&"text-amber-700")}>{value.toLocaleString('vi-VN')}</p></CardContent></Card>; }

function ReportsView({ people }: { people: PersonRow[] }) {
  const [reportType, setReportType] = React.useState("staff-unit");
  const sourcePeople: PersonRow[] = people.length ? people : [...syntheticPeople];
  const reportRows = sourcePeople.map((person,index)=>({STT:index+1,"Mã cán bộ":person.staffCode,"Họ và tên":person.fullName,"Ngày sinh":displayDate(person.birthDate),"Đơn vị":person.unit,"Chức vụ":person.position,"Trình độ":person.degree,"Trạng thái":person.status}));
  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      const label = button?.textContent?.trim() ?? "";
      const format = ["XLSX", "CSV", "DOCX", "PDF", "Bản in"].find((item) => label.startsWith(item));
      if (format) void sendOrQueue("log_export", { reportType, format, rowCount: reportRows.length, filters: { period: "T08/2026", scope: "Toàn trường" } }).catch(() => undefined);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [reportRows.length, reportType]);
  const fileBase = `UED_Bao_cao_${new Date().toISOString().slice(0,10)}`;
  function exportCsv(){const headers=Object.keys(reportRows[0]);const csv=[headers,...reportRows.map(Object.values)].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),`${fileBase}.csv`);toast.success('Đã tạo tệp CSV.');}
  function exportXlsx(){if(!window.XLSX)return toast.error('Bộ xuất Excel chưa sẵn sàng.');const ws=window.XLSX.utils.json_to_sheet(reportRows);const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,'BaoCao');window.XLSX.writeFile(wb,`${fileBase}.xlsx`);toast.success('Đã tạo tệp Excel.');}
  async function exportDocx(){if(!window.docx)return toast.error('Bộ xuất Word chưa sẵn sàng.');const d=window.docx;const logo=await fetch('/ued-logo.png').then(r=>r.arrayBuffer());const doc=new d.Document({sections:[{properties:{},children:[new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.ImageRun({data:logo,transformation:{width:58,height:58}})]}),new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:'TRƯỜNG ĐẠI HỌC SƯ PHẠM – ĐẠI HỌC ĐÀ NẴNG',bold:true,size:24})]}),new d.Paragraph({alignment:d.AlignmentType.CENTER,spacing:{after:260},children:[new d.TextRun({text:'BÁO CÁO DANH SÁCH NHÂN SỰ THEO ĐƠN VỊ',bold:true,size:28,color:'0065A8'})]}),new d.Table({width:{size:100,type:d.WidthType.PERCENTAGE},rows:[new d.TableRow({tableHeader:true,children:Object.keys(reportRows[0]).map(h=>new d.TableCell({shading:{fill:'DCEEF8'},children:[new d.Paragraph({children:[new d.TextRun({text:h,bold:true,size:18})]})]}))}),...reportRows.map(row=>new d.TableRow({children:Object.values(row).map(v=>new d.TableCell({children:[new d.Paragraph({children:[new d.TextRun({text:String(v),size:17})]})]}))}))]}),new d.Paragraph({spacing:{before:240},children:[new d.TextRun({text:`Nguồn: Dữ liệu đã lọc · Tổng số: ${reportRows.length} dòng · Xuất lúc ${new Date().toLocaleString('vi-VN')}`,italics:true,size:17,color:'64748B'})]})]}]});downloadBlob(await d.Packer.toBlob(doc),`${fileBase}.docx`);toast.success('Đã tạo tệp Word.');}
  async function exportPdf(){if(!window.pdfMake)return toast.error('Bộ xuất PDF chưa sẵn sàng.');const logo=await fetch('/ued-logo.png').then(r=>r.blob()).then(blob=>new Promise<string>((resolve)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsDataURL(blob)}));const headers=Object.keys(reportRows[0]);const body=[headers.map(h=>({text:h,bold:true,color:'#ffffff',fillColor:'#0065a8'})),...reportRows.map(row=>Object.values(row).map(v=>String(v)))];window.pdfMake.createPdf({pageOrientation:'landscape',pageSize:'A4',pageMargins:[28,34,28,34],header:{columns:[{image:logo,width:28,margin:[28,5,0,0]},{text:'TRƯỜNG ĐẠI HỌC SƯ PHẠM – ĐẠI HỌC ĐÀ NẴNG',fontSize:9,bold:true,margin:[6,14,0,0]}]},footer:(current:number,pages:number)=>({text:`Trang ${current}/${pages}`,alignment:'right',fontSize:8,color:'#64748b',margin:[0,8,28,0]}),content:[{text:'BÁO CÁO DANH SÁCH NHÂN SỰ THEO ĐƠN VỊ',fontSize:15,bold:true,color:'#0065a8',alignment:'center',margin:[0,10,0,5]},{text:`Bộ lọc: Toàn trường · Năm 2026 · Tổng số: ${reportRows.length} dòng`,fontSize:9,color:'#64748b',alignment:'center',margin:[0,0,0,14]},{table:{headerRows:1,widths:[24,70,110,60,130,90,60,70],body},layout:'lightHorizontalLines'}],defaultStyle:{font:'Roboto',fontSize:8}},undefined,undefined,undefined).download(`${fileBase}.pdf`);toast.success('Đã tạo tệp PDF.');}
  return <div className="grid gap-4 xl:grid-cols-[360px_1fr]"><Card className="h-fit rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Thiết lập báo cáo</CardTitle><CardDescription>Chọn mẫu, kỳ dữ liệu và phạm vi.</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="Mẫu báo cáo"><Select value={reportType} onValueChange={setReportType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="staff-unit">Danh sách toàn trường theo đơn vị</SelectItem><SelectItem value="degree">Thống kê học hàm, học vị</SelectItem><SelectItem value="contract">Hợp đồng theo loại</SelectItem><SelectItem value="expiry">Hợp đồng sắp hết hạn</SelectItem><SelectItem value="change">Biến động nhân sự theo kỳ</SelectItem><SelectItem value="quality">Chất lượng dữ liệu</SelectItem></SelectContent></Select></Field><Field label="Kỳ dữ liệu"><Select defaultValue="t8"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="t8">T08/2026</SelectItem><SelectItem value="t7">T07/2026</SelectItem></SelectContent></Select></Field><Field label="Đơn vị"><Select defaultValue="all"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Toàn trường</SelectItem>{unitData.map(u=><SelectItem key={u.name} value={normalizeForMatch(u.name)}>{u.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Tiêu đề báo cáo"><Input defaultValue="Danh sách nhân sự theo đơn vị"/></Field><Field label="Người lập"><Input defaultValue="Cán bộ Phòng Tổ chức"/></Field><Button className="w-full bg-[#0065a8]"><FileCheck2 className="size-4"/>Cập nhật xem trước</Button></CardContent></Card><div className="space-y-4"><div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm"><Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="size-4"/>XLSX</Button><Button variant="outline" onClick={exportCsv}><FileText className="size-4"/>CSV</Button><Button variant="outline" onClick={()=>void exportDocx()}><FileText className="size-4"/>DOCX</Button><Button variant="outline" onClick={()=>void exportPdf()}><FileText className="size-4"/>PDF</Button><Button variant="outline" onClick={()=>window.print()}><Download className="size-4"/>Bản in</Button><Button variant="ghost" className="ml-auto"><SlidersHorizontal className="size-4"/>Chọn cột</Button></div><Card className="rounded-2xl shadow-sm"><CardContent className="p-6 md:p-10"><div className="mb-6 flex items-center gap-4 border-b-2 border-[#0065a8] pb-4"><Image src="/ued-logo.png" alt="Logo UED" width={64} height={64} className="size-16 object-contain"/><div><p className="text-sm font-bold uppercase text-slate-700">Trường Đại học Sư phạm – Đại học Đà Nẵng</p><h2 className="mt-1 text-xl font-bold text-[#0065a8]">Báo cáo danh sách nhân sự theo đơn vị</h2><p className="mt-1 text-xs text-slate-500">Kỳ T08/2026 · Toàn trường · Dữ liệu xem trước không chứa PII thật</p></div></div><div className="overflow-x-auto rounded-lg border"><Table><TableHeader className="bg-[#0065a8]"><TableRow>{Object.keys(reportRows[0]).map(h=><TableHead key={h} className="whitespace-nowrap text-white">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{reportRows.map(row=><TableRow key={row['Mã cán bộ']}>{Object.values(row).map((v,i)=><TableCell key={i} className="whitespace-nowrap text-xs">{String(v)}</TableCell>)}</TableRow>)}</TableBody></Table></div><div className="mt-5 flex flex-col justify-between gap-2 text-xs text-slate-500 sm:flex-row"><span>Nguồn: Hồ sơ đã lọc · Tổng số: {reportRows.length} dòng</span><span>Người lập: Cán bộ Phòng Tổ chức · {new Date().toLocaleDateString('vi-VN')}</span></div></CardContent></Card></div></div>;
}

function QualityView({ navigate, workspace }: { navigate: (view: ViewKey) => void; workspace: WorkspaceData }) {
  const [severity, setSeverity] = React.useState("all");
  const counts = workspace.dashboard?.counts;
  const live = Boolean(workspace.connected && workspace.dashboard && [counts?.people, counts?.contracts, counts?.organizations, counts?.training, counts?.commitments, counts?.documents].some((value) => Number(value) > 0));
  const brokenLinks = (counts?.brokenContractLinks ?? 0) + (counts?.brokenTrainingLinks ?? 0) + (counts?.brokenCommitmentLinks ?? 0) + (counts?.brokenDocumentLinks ?? 0);
  const liveFindings = [
    { id: "DB-001", severity: "high", title: "Khóa ngoại bị đứt", count: brokenLinks, action: "Không ghi đè; mở bản ghi nguồn và khôi phục đúng mã liên kết.", target: "sync" as ViewKey },
    { id: "DB-002", severity: "high", title: "Mã cán bộ bị trùng", count: counts?.duplicateStaffCodes ?? 0, action: "Đối chiếu hai hồ sơ trước khi gộp; không chọn theo họ tên.", target: "people" as ViewKey },
    { id: "DB-003", severity: "medium", title: "Hợp đồng chưa liên kết nhân sự", count: counts?.unlinkedContracts ?? 0, action: "Xác minh mã cán bộ hoặc họ tên + ngày sinh duy nhất.", target: "contracts" as ViewKey },
    { id: "DB-004", severity: "medium", title: "Hợp đồng thiếu số", count: workspace.dashboard?.missingContractNumber ?? 0, action: "Bổ sung từ văn bản gốc; hệ thống không tự sinh số hợp đồng.", target: "contracts" as ViewKey },
    { id: "DB-005", severity: "medium", title: "Xung đột đồng bộ đang mở", count: counts?.openConflicts ?? 0, action: "Giữ cả bản cục bộ và máy chủ để người có thẩm quyền chọn hoặc hợp nhất.", target: "sync" as ViewKey },
    { id: "DB-006", severity: "info", title: "Đối soát khóa và checksum", count: workspace.dashboard?.passed ? 1 : 0, action: workspace.dashboard?.passed ? "Số lượng, mã bản ghi và khóa ngoại đang nhất quán." : "Chạy đối soát và xử lý các nhóm lỗi phía trên.", target: "sync" as ViewKey },
  ];
  const findings = live ? liveFindings : qualityFindings.map((item) => ({ ...item, target: item.id === "DQ-005" ? "imports" as ViewKey : item.id === "DQ-002" || item.id === "DQ-004" ? "contracts" as ViewKey : "people" as ViewKey }));
  const filtered = findings.filter((item) => severity === "all" || item.severity === severity);
  const highCount = findings.filter((item) => item.severity === "high" && item.count > 0).length;
  const issueGroups = findings.filter((item) => item.severity !== "info" && item.count > 0).length;
  function exportQuality() {
    const lines = [["Mã", "Mức độ", "Nhóm kiểm tra", "Số lượng", "Hướng xử lý"], ...findings.map((item) => [item.id, item.severity, item.title, item.count, item.action])];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `UED_kiem_tra_chat_luong_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success("Đã xuất báo cáo chất lượng dữ liệu.");
  }
  return <div className="space-y-4"><DemoDataNotice live={live} connected={workspace.connected}/><div className="grid gap-4 sm:grid-cols-3"><MiniStat label="Nhóm lỗi mức cao" value={String(highCount)} icon={AlertTriangle}/><MiniStat label="Nhóm cần xác minh" value={String(issueGroups)} icon={CircleHelp}/><MiniStat label="Đối soát toàn vẹn" value={live ? (workspace.dashboard?.passed ? "Đạt" : "Chưa đạt") : "18 quy tắc đạt"} icon={ShieldCheck}/></div><div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm"><Select value={severity} onValueChange={setSeverity}><SelectTrigger className="h-10 w-[190px] rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Tất cả mức độ</SelectItem><SelectItem value="high">Mức cao</SelectItem><SelectItem value="medium">Cảnh báo</SelectItem><SelectItem value="info">Thông tin</SelectItem></SelectContent></Select><Button variant="outline" className="rounded-xl" onClick={exportQuality}><Download className="size-4"/>Xuất báo cáo kiểm tra</Button><Button className="ml-auto rounded-xl bg-[#0065a8]" onClick={()=>navigate(live?'sync':'imports')}><RefreshCw className="size-4"/>{live ? "Đối soát lại" : "Kiểm tra lại nguồn"}</Button></div><Card className="rounded-2xl shadow-sm"><CardContent className="space-y-3 p-4">{filtered.map(item=><div key={item.id} className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center"><span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl",item.severity==='high'?"bg-rose-100 text-rose-700":item.severity==='medium'?"bg-amber-100 text-amber-700":"bg-sky-100 text-sky-700")}>{item.severity==='info'?<CheckCircle2 className="size-5"/>:<AlertTriangle className="size-5"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><code className="text-xs font-semibold text-slate-400">{item.id}</code><p className="font-semibold text-slate-800">{item.title}</p></div><p className="mt-1 text-sm text-slate-500">{item.action}</p></div><div className="flex items-center gap-3"><span className="text-2xl font-bold text-slate-900">{item.count}</span><Button variant="outline" size="sm" className="rounded-lg" onClick={()=>navigate(item.target)}>Mở chi tiết</Button></div></div>)}</CardContent></Card></div>;
}

function AlertsView({ sourceAlerts, connected, onDataChanged, navigate }: { sourceAlerts: WorkspaceData["alerts"]; connected: boolean; onDataChanged: () => Promise<void>; navigate: (view: ViewKey) => void }) {
  const [resolvedIds,setResolvedIds]=React.useState<Set<string>>(() => new Set());
  const [severity,setSeverity]=React.useState("all");
  const [status,setStatus]=React.useState("open");
  const baseAlerts = connected ? sourceAlerts : [...demoAlerts];
  const alertsState = baseAlerts.map((item) => resolvedIds.has(item.id) ? { ...item, status: "Đã xử lý" } : item);
  const filtered = alertsState.filter((alert) => (severity === "all" || alert.severity === severity) && (status === "all" || (status === "done" ? alert.status === "Đã xử lý" : alert.status !== "Đã xử lý")));
  async function resolve(id:string){
    setResolvedIds((current) => new Set(current).add(id));
    try {
      if (connected && sourceAlerts.some((item)=>item.id===id)) {
        const result=await sendOrQueue('resolve_alert',{id,reason:'Xác nhận xử lý tại Trung tâm cảnh báo'});
        await onDataChanged();
        if(result.queued)return toast.warning('Thay đổi đã được giữ trong hàng đợi để gửi lại.');
      }
      toast.success(connected ? 'Đã ghi nhận xử lý và cập nhật nhật ký.' : 'Đã đánh dấu trên dữ liệu minh họa.');
    } catch (error) {
      setResolvedIds((current) => { const next = new Set(current); next.delete(id); return next; });
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật cảnh báo.');
    }
  }
  async function assign(id:string){
    try {
      if (!connected || !sourceAlerts.some((item)=>item.id===id)) return toast.info('Dữ liệu minh họa chưa thể giao người xử lý.');
      const result=await sendOrQueue('assign_alert',{id});
      await onDataChanged();
      toast[result.queued?'warning':'success'](result.queued?'Lệnh giao việc đang chờ gửi lại.':'Đã giao cảnh báo cho tài khoản hiện tại.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể giao xử lý.'); }
  }
  function exportAlerts(){
    const lines=[["Mức độ","Cảnh báo","Nội dung","Hạn","Phụ trách","Trạng thái"],...filtered.map((alert)=>[alert.severity,alert.title,alert.subject,alert.due,alert.assignee,alert.status])];
    const csv=lines.map((row)=>row.map((cell)=>`"${String(cell).replaceAll('"','""')}"`).join(',')).join('\r\n');
    downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),`UED_canh_bao_${new Date().toISOString().slice(0,10)}.csv`);
    toast.success(`Đã xuất ${filtered.length} cảnh báo.`);
  }
  return <div className="space-y-4"><div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm"><Select value={severity} onValueChange={setSeverity}><SelectTrigger className="h-10 w-[180px] rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Tất cả mức độ</SelectItem><SelectItem value="urgent">Khẩn cấp</SelectItem><SelectItem value="warning">Cảnh báo</SelectItem><SelectItem value="info">Thông tin</SelectItem></SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="h-10 w-[180px] rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="open">Chưa xử lý</SelectItem><SelectItem value="all">Tất cả trạng thái</SelectItem><SelectItem value="done">Đã xử lý</SelectItem></SelectContent></Select><Button variant="outline" className="rounded-xl" onClick={exportAlerts}><Download className="size-4"/>Xuất danh sách</Button><Button className="ml-auto rounded-xl bg-[#0065a8]" onClick={()=>navigate('admin')}><Settings className="size-4"/>Cấu hình cảnh báo</Button></div>{filtered.length?<div className="space-y-3">{filtered.map(alert=><Card key={alert.id} className="rounded-2xl shadow-sm"><CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center"><span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl",alert.severity==='urgent'?"bg-rose-100 text-rose-700":alert.severity==='warning'?"bg-amber-100 text-amber-700":"bg-sky-100 text-sky-700")}>{alert.severity==='urgent'?<CalendarClock className="size-5"/>:alert.severity==='warning'?<AlertTriangle className="size-5"/>:<ShieldCheck className="size-5"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="font-mono text-[11px]">{alert.id}</Badge><h3 className="font-semibold">{alert.title}</h3></div><p className="mt-1 text-sm text-slate-500">{alert.subject}</p><p className="mt-1 text-xs text-slate-400">Phụ trách: {alert.assignee} · Hạn: {alert.due}{alert.days!==null?` · ${alert.days>0?`Còn ${alert.days} ngày`:alert.days<0?`Quá hạn ${Math.abs(alert.days)} ngày`:'Đến hạn hôm nay'}`:''}</p></div><Badge className={cn("w-fit font-normal",alert.status==='Đã xử lý'?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700")}>{alert.status}</Badge><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>void assign(alert.id)}>Giao xử lý</Button>{alert.status!=='Đã xử lý'?<Button size="sm" className="bg-[#0065a8]" onClick={()=>void resolve(alert.id)}><Check className="size-4"/>Hoàn tất</Button>:null}</div></CardContent></Card>)}</div>:<Card className="rounded-2xl shadow-sm"><CardContent className="flex flex-col items-center p-12 text-center"><CheckCircle2 className="size-10 text-emerald-500"/><p className="mt-3 font-semibold text-slate-800">Không có cảnh báo phù hợp bộ lọc</p><p className="mt-1 text-sm text-slate-500">{connected?'Dữ liệu trung tâm đã được quét; không dùng cảnh báo minh họa thay thế.':'Hãy kết nối dữ liệu trung tâm để quét thời hạn thực tế.'}</p></CardContent></Card>}</div>;
}

function AuditView({ currentUser, sourceEvents }: { currentUser: CurrentUser; sourceEvents: WorkspaceData["audit"] }) {
  const events=sourceEvents.length?sourceEvents:[{id:'demo-audit-1',time:'23:42 · 08/09/2026',action:'Phân tích tệp nguồn',entity:'Nam 2026 (cap nhat).xls',actor:currentUser.name,result:'Thành công'},{id:'demo-audit-2',time:'23:44 · 08/09/2026',action:'Chặn bản ghi trùng',entity:'89 dòng · HDLV XĐTH',actor:'Hệ thống',result:'Thành công'},{id:'demo-audit-3',time:'23:45 · 08/09/2026',action:'Tạo báo cáo chất lượng',entity:'DQ-001 → DQ-005',actor:'Hệ thống',result:'Thành công'}];
  return <Card className="rounded-2xl shadow-sm"><CardHeader className="flex flex-row items-start justify-between"><div><CardTitle className="text-base">Dòng thời gian hoạt động</CardTitle><CardDescription>Nhật ký chỉ thêm mới, không ghi đè hoặc xóa cùng dữ liệu nghiệp vụ.</CardDescription></div><Button variant="outline"><Download className="size-4"/>Xuất nhật ký</Button></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Thời gian</TableHead><TableHead>Hoạt động</TableHead><TableHead>Đối tượng</TableHead><TableHead>Người thực hiện</TableHead><TableHead>Kết quả</TableHead><TableHead className="w-12"/></TableRow></TableHeader><TableBody>{events.map((event,index)=><TableRow key={index}><TableCell className="whitespace-nowrap text-sm text-slate-500">{event.time}</TableCell><TableCell className="font-semibold">{event.action}</TableCell><TableCell>{event.entity}</TableCell><TableCell>{event.actor}</TableCell><TableCell><Badge className="bg-emerald-100 text-emerald-700">{event.result}</Badge></TableCell><TableCell><Button variant="ghost" size="icon"><ChevronRight className="size-4"/></Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>;
}

function AdminView() {
  const [thresholds,setThresholds]=React.useState(['7','15','30','60','90']);
  return <Tabs defaultValue="roles" className="space-y-4"><TabsList className="h-auto flex-wrap rounded-xl bg-slate-200/70 p-1"><TabsTrigger value="roles" className="rounded-lg px-4 py-2.5">Phân quyền</TabsTrigger><TabsTrigger value="catalogs" className="rounded-lg px-4 py-2.5">Danh mục</TabsTrigger><TabsTrigger value="alerts" className="rounded-lg px-4 py-2.5">Cảnh báo</TabsTrigger><TabsTrigger value="branding" className="rounded-lg px-4 py-2.5">Nhận diện</TabsTrigger></TabsList><TabsContent value="roles"><Card className="rounded-2xl shadow-sm"><CardHeader className="flex flex-row items-start justify-between"><div><CardTitle className="text-base">Ma trận quyền RBAC</CardTitle><CardDescription>Quyền thực tế được kiểm tra lại ở máy chủ; ẩn nút không thay thế kiểm soát quyền.</CardDescription></div><Button className="bg-[#0065a8]"><Plus className="size-4"/>Thêm tài khoản</Button></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="min-w-[210px]">Vai trò</TableHead>{['Xem','Sửa','Nhập','Xuất','Duyệt','Khôi phục'].map(h=><TableHead key={h} className="text-center">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{roleMatrix.map(row=><TableRow key={row.role}><TableCell className="font-semibold">{row.role}</TableCell>{(['view','edit','import','export','approve','restore'] as const).map(key=><TableCell key={key} className="text-center">{row[key]?<CheckCircle2 className="mx-auto size-4 text-emerald-600"/>:<X className="mx-auto size-4 text-slate-300"/>}</TableCell>)}</TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent><TabsContent value="catalogs"><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Danh mục dùng chung</CardTitle><CardDescription>Mọi màn hình dùng cùng mã trường và danh mục; không tự đặt tên riêng.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{['Đơn vị tổ chức','Chức vụ','Chức danh nghề nghiệp','Học hàm – Học vị','Loại hợp đồng','Trạng thái công tác','Quốc gia đào tạo','Mức độ cảnh báo','Lý do biến động'].map((name,index)=><button key={name} className="flex items-center gap-3 rounded-xl border p-4 text-left hover:border-sky-200 hover:bg-sky-50/30"><span className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><ListChecks className="size-4"/></span><span className="flex-1 text-sm font-semibold">{name}</span><Badge variant="secondary">{[17,12,7,6,7,8,24,3,9][index]}</Badge><ChevronRight className="size-4 text-slate-400"/></button>)}</CardContent></Card></TabsContent><TabsContent value="alerts"><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Mốc cảnh báo hợp đồng</CardTitle><CardDescription>Thiết lập theo ngày còn lại; thông báo có khóa chống trùng.</CardDescription></CardHeader><CardContent><div className="flex flex-wrap gap-2">{thresholds.map(value=><button key={value} onClick={()=>setThresholds(current=>current.filter(x=>x!==value))} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">{value} ngày <X className="size-3"/></button>)}<Button variant="outline" className="rounded-xl" onClick={()=>!thresholds.includes('45')&&setThresholds([...thresholds,'45'].sort((a,b)=>Number(a)-Number(b)))}><Plus className="size-4"/>Thêm mốc</Button></div><Separator className="my-6"/><div className="grid gap-4 md:grid-cols-2"><Field label="Tần suất quét"><Select defaultValue="daily"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="daily">Mỗi ngày</SelectItem><SelectItem value="weekly">Mỗi tuần</SelectItem></SelectContent></Select></Field><Field label="Nhóm người nhận"><Select defaultValue="organization"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="organization">Theo đơn vị phụ trách</SelectItem><SelectItem value="manager">Trưởng phòng</SelectItem></SelectContent></Select></Field></div></CardContent></Card></TabsContent><TabsContent value="branding"><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Nhận diện trường</CardTitle><CardDescription>Logo đang dùng được lấy từ website chính thức UED; cho phép quản trị thay mà không sửa mã nguồn.</CardDescription></CardHeader><CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="flex size-32 items-center justify-center rounded-3xl border bg-white p-4 shadow-sm"><Image src="/ued-logo.png" alt="Logo UED" width={128} height={128} className="size-full object-contain"/></div><div><p className="font-semibold">Logo Trường Đại học Sư phạm – Đại học Đà Nẵng</p><p className="mt-1 text-sm text-slate-500">PNG 500 × 500, nền trong suốt, giữ nguyên tỷ lệ.</p><div className="mt-4 flex gap-2"><Button variant="outline"><Upload className="size-4"/>Thay logo</Button><Button variant="ghost">Khôi phục mặc định</Button></div></div></CardContent></Card></TabsContent></Tabs>;
}

function SyncView({online,syncing,outboxCount,lastSync,syncNow,workspace}:{online:boolean;syncing:boolean;outboxCount:number;lastSync:string;syncNow:()=>Promise<void>;workspace:WorkspaceData}) {
  const [checking,setChecking]=React.useState(false);
  const [progress,setProgress]=React.useState(workspace.dashboard?.passed?100:0);
  const [lastResult,setLastResult]=React.useState<{passed:boolean;checksum:string}|null>(null);
  const conflicts=workspace.dashboard?.counts.openConflicts??0;
  async function reconcile(){
    if(!workspace.connected)return toast.warning('Chưa kết nối CSDL trung tâm; không thể đối soát chính thức.');
    setChecking(true);setProgress(20);
    try{
      const response=await fetch('/api/workspace',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':crypto.randomUUID()},body:JSON.stringify({action:'reconcile'})});
      const result=await response.json().catch(()=>null) as {passed?:boolean;checksum?:string;error?:string}|null;
      if(!response.ok)throw new Error(result?.error??`Không thể đối soát (HTTP ${response.status}).`);
      setProgress(100);setLastResult({passed:Boolean(result?.passed),checksum:String(result?.checksum??'')});
      if(result?.passed)toast.success('Đối soát đạt: số lượng, khóa liên kết và checksum nhất quán.');
      else toast.warning('Đối soát phát hiện vấn đề; dữ liệu không bị xóa hoặc ghi đè.');
    }catch(error){setProgress(0);toast.error(error instanceof Error?error.message:'Không thể đối soát dữ liệu.');}
    finally{setChecking(false);}
  }
  async function downloadBackup(){
    try{
      const response=await fetch('/api/workspace?resource=backup');
      if(!response.ok){const message=(await response.json().catch(()=>null))?.error;throw new Error(message??`Không thể tạo sao lưu (HTTP ${response.status}).`);}
      downloadBlob(await response.blob(),`UED_sao_luu_${new Date().toISOString().slice(0,10)}.json`);toast.success('Đã tạo bản sao lưu kèm checksum.');
    }catch(error){
      if(workspace.connected)return toast.error(error instanceof Error?error.message:'Không thể tạo bản sao lưu.');
      const payload={format:'ued-organization-backup-demo',version:2,createdAt:new Date().toISOString(),note:'Bản minh họa không chứa dữ liệu cá nhân thật.'};
      downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`UED_sao_luu_minh_hoa_${new Date().toISOString().slice(0,10)}.json`);toast.warning('Đã tạo bản sao minh họa vì CSDL chưa kết nối.');
    }
  }
  const integrityStatus=(lastResult?.passed??workspace.dashboard?.passed)?'Đạt':'Cần kiểm tra';
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SyncCard label="Kết nối" value={online&&workspace.connected?'Trực tuyến':'Ngoại tuyến'} icon={online&&workspace.connected?Wifi:WifiOff} tone={online&&workspace.connected?'green':'amber'}/><SyncCard label="Hàng đợi thay đổi" value={String(outboxCount)} icon={Activity} tone={outboxCount?'amber':'green'}/><SyncCard label="Xung đột mở" value={String(conflicts)} icon={AlertTriangle} tone={conflicts?'amber':'green'}/><SyncCard label="Lần đồng bộ gần nhất" value={lastSync} icon={History} tone="blue"/></div><Card className="rounded-2xl shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="text-base">Đối soát và tự phục hồi</CardTitle><CardDescription>Không xóa dữ liệu cục bộ hoặc máy chủ khi phát hiện lỗi.</CardDescription></div><Button disabled={checking||!workspace.connected} onClick={()=>void reconcile()} className="shrink-0 bg-[#0065a8]">{checking?<Loader2 className="size-4 animate-spin"/>:<RefreshCw className="size-4"/>}Tự kiểm tra và sửa</Button></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-4">{[{title:'1. Hàng đợi',text:'Gửi theo thứ tự, idempotency key'},{title:'2. Máy chủ',text:'Kiểm tra phiên bản trước khi ghi'},{title:'3. Xung đột',text:'Giữ cục bộ, máy chủ hoặc hợp nhất'},{title:'4. Đối soát',text:'Số lượng, khóa và checksum'}].map((item,index)=><div key={item.title} className="relative rounded-xl border bg-slate-50 p-4"><span className={cn("mb-3 flex size-8 items-center justify-center rounded-full text-xs font-bold",progress>index*25?"bg-emerald-500 text-white":"bg-slate-200 text-slate-500")}>{progress>index*25?<Check className="size-4"/>:index+1}</span><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p></div>)}</div><Progress value={progress} className="mt-5 h-2"/><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500"><span>Toàn vẹn: <strong className={integrityStatus==='Đạt'?'text-emerald-700':'text-amber-700'}>{integrityStatus}</strong></span><span>Checksum: {(lastResult?.checksum??workspace.dashboard?.checksum)?.slice(0,12)||'—'}…</span></div><div className="mt-4 flex flex-wrap items-center gap-2"><Button variant="outline" onClick={()=>void syncNow()} disabled={syncing||!online}>{syncing?<Loader2 className="size-4 animate-spin"/>:<Cloud className="size-4"/>}Gửi thay đổi đang chờ</Button><Button variant="outline" onClick={()=>void downloadBackup()}><Download className="size-4"/>Tạo bản sao lưu</Button><Button variant="outline" onClick={()=>toast.info('Khôi phục chỉ dành cho Quản trị hệ thống: kiểm tra định dạng, phiên bản và checksum trước khi ghi vào vùng phục hồi tách biệt.')}><ArchiveRestore className="size-4"/>Khôi phục có kiểm tra</Button></div></CardContent></Card><div className="grid gap-4 lg:grid-cols-2"><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Cơ sở dữ liệu trung tâm</CardTitle><CardDescription>Nguồn sự thật dùng chung cho nhiều cán bộ và thiết bị.</CardDescription></CardHeader><CardContent className="space-y-3"><ConnectionRow label="Dữ liệu cấu trúc" value="CSDL trung tâm" status={workspace.connected?'Sẵn sàng':'Chưa kết nối'}/><ConnectionRow label="Tệp hồ sơ" value="Kho tệp riêng" status={workspace.connected?'Sẵn sàng':'Chưa kết nối'}/><ConnectionRow label="Bản cục bộ" value="IndexedDB + outbox" status="Hoạt động"/></CardContent></Card><Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Google Drive / Gmail</CardTitle><CardDescription>Kênh sao lưu và gửi nhắc khi quản trị cấp quyền OAuth.</CardDescription></CardHeader><CardContent><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 font-semibold text-amber-900"><LockKeyhole className="size-4"/>Chưa cấu hình OAuth của đơn vị</div><p className="mt-2 text-sm leading-6 text-amber-800">Phần mềm không yêu cầu và không lưu mật khẩu Gmail. Dữ liệu dùng chung vẫn hoạt động trên cơ sở dữ liệu trung tâm; Drive chỉ bật sau khi quản trị cung cấp Client ID và cấp quyền.</p><Button variant="outline" className="mt-4 border-amber-300 bg-white" onClick={()=>toast.info('Quản trị cần cấu hình OAuth của đơn vị và chỉ cấp các phạm vi Drive/Gmail tối thiểu cần thiết.')} >Mở hướng dẫn cấu hình</Button></div></CardContent></Card></div></div>;
}

function SyncCard({label,value,icon:Icon,tone}:{label:string;value:string;icon:React.ComponentType<{className?:string}>;tone:string}){return <Card className="rounded-2xl shadow-sm"><CardContent className="flex items-center gap-3 p-4"><span className={cn("rounded-xl p-2.5",tone==='green'&&"bg-emerald-100 text-emerald-700",tone==='amber'&&"bg-amber-100 text-amber-700",tone==='blue'&&"bg-sky-100 text-sky-700")}><Icon className="size-5"/></span><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="mt-0.5 truncate text-sm font-bold">{value}</p></div></CardContent></Card>}
function ConnectionRow({label,value,status}:{label:string;value:string;status:string}){const ready=status==='Sẵn sàng'||status==='Hoạt động';return <div className="flex items-center gap-3 rounded-xl border p-3"><span className={cn("size-2.5 rounded-full",ready?"bg-emerald-500":"bg-amber-500")}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-slate-500">{value}</p></div><Badge className={ready?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}>{status}</Badge></div>}
