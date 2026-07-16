import { NextRequest, NextResponse } from "next/server";
import { eq, sql, and, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const isTechOrManager =
      user.role.name === "admin" || user.role.name === "it_manager" || user.role.name === "technician";
    if (!isTechOrManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetType = searchParams.get("targetType");
    const actionType = searchParams.get("actionType");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const conditions: SQL[] = [eq(auditLogs.companyId, user.companyId)];
    if (targetType) conditions.push(eq(auditLogs.targetType, targetType));
    if (actionType) conditions.push(sql`${auditLogs.actionType} like ${"%" + actionType + "%"}`);
    if (from) conditions.push(gte(auditLogs.createdAt, new Date(from)));
    if (to) conditions.push(lte(auditLogs.createdAt, new Date(to + "T23:59:59")));

    const logs = await db
      .select({
        createdAt: auditLogs.createdAt,
        actionType: auditLogs.actionType,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
        actorEmail: users.email,
        meta: auditLogs.meta,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(and(...conditions))
      .orderBy(sql`${auditLogs.createdAt} desc`)
      .limit(2000);

    const headers = ["Timestamp", "Actor", "Action", "Target Type", "Target ID", "Details"];
    const rows = logs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.actorFirstName ? `${log.actorFirstName} ${log.actorLastName ?? ""}`.trim() : (log.actorEmail ?? "System / Automated"),
      log.actionType,
      log.targetType,
      log.targetId,
      Object.keys(log.meta ?? {}).length > 0 ? JSON.stringify(log.meta) : "",
    ]);

    return new NextResponse(buildCsv(headers, rows), { headers: csvResponseHeaders("audit_logs_export") });
  } catch (error) {
    console.error("Failed to export audit logs:", error);
    return NextResponse.json({ error: "Failed to export audit logs" }, { status: 500 });
  }
}
