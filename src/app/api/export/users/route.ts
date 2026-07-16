import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { listUsersFull } from "@/lib/actions/users";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    requirePermission(user, "users:manage");

    const search = request.nextUrl.searchParams.get("search")?.trim();
    const data = await listUsersFull(search);

    const headers = ["First Name", "Last Name", "Email", "Job Title", "Phone", "Employee Number", "Role", "Department", "Location", "Status"];
    const rows = data.map((u) => [
      u.firstName,
      u.lastName,
      u.email,
      u.jobTitle,
      u.phone,
      u.employeeNumber,
      u.roleName,
      u.departmentName,
      u.locationName,
      u.loginEnabled ? "Active" : "Disabled",
    ]);

    return new NextResponse(buildCsv(headers, rows), { headers: csvResponseHeaders("users_export") });
  } catch (error) {
    console.error("Failed to export users:", error);
    return NextResponse.json({ error: "Failed to export users" }, { status: 500 });
  }
}
