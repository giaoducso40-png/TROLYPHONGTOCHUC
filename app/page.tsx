import { headers } from "next/headers";
import { UedOrganizationApp } from "./ued-organization-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email") ?? "quantri@ued.udn.vn";
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const name =
    encodedName && requestHeaders.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
      ? decodeURIComponent(encodedName)
      : "Cán bộ Phòng Tổ chức";

  return <UedOrganizationApp currentUser={{ name, email, role: "Quản trị hệ thống" }} />;
}
