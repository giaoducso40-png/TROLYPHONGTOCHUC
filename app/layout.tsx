import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UED Tổ chức | Quản lý nhân sự và hợp đồng",
  description:
    "Hệ thống quản lý hồ sơ cán bộ, hợp đồng, biến động, cảnh báo và báo cáo dành cho Phòng Tổ chức – Trường Đại học Sư phạm, Đại học Đà Nẵng.",
  icons: {
    icon: "/ued-logo.png",
    shortcut: "/ued-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <script defer src="/vendor/xlsx.full.min.js" />
        <script defer src="/vendor/docx.iife.js" />
        <script defer src="/vendor/pdfmake.min.js" />
        <script defer src="/vendor/vfs_fonts.js" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
