import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { auditLogs, users } from "@/db/schema";
import { eq, sql, and, gte, lte, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AuditLogFilters } from "./filters";

const TARGET_TYPES = [
  "asset", "license", "license_seat", "consumable", "kit", "kit_item",
  "location", "department", "manufacturer", "model", "user",
  "checkout", "acceptance", "request",
];

function summarizeMeta(actionType: string, meta: Record<string, unknown>): string {
  if (actionType.endsWith(".created")) return "created";
  if (actionType.endsWith(".deleted")) return "deleted";
  if (actionType.endsWith(".updated") && meta.diff && typeof meta.diff === "object") {
    const diff = meta.diff as Record<string, { from: unknown; to: unknown }>;
    const parts = Object.entries(diff).map(([field, { from, to }]) => `${field}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`);
    return parts.join("; ");
  }
  if (Object.keys(meta).length === 0) return "—";
  return JSON.stringify(meta);
}

function getActionBadgeColor(action: string) {
  if (action.endsWith(".created") || action.includes("add")) return "outline" as const;
  if (action.includes("login_failed") || action.includes("declined") || action.endsWith(".deleted")) return "destructive" as const;
  if (action.includes("login") || action.includes("accepted") || action.includes("approved")) return "default" as const;
  return "secondary" as const;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ targetType?: string; actionType?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const isTechOrManager =
    user.role.name === "admin" ||
    user.role.name === "it_manager" ||
    user.role.name === "technician";

  if (!isTechOrManager) {
    notFound();
  }

  const conditions: SQL[] = [eq(auditLogs.companyId, user.companyId)];
  if (params.targetType) conditions.push(eq(auditLogs.targetType, params.targetType));
  if (params.actionType) conditions.push(sql`${auditLogs.actionType} like ${"%" + params.actionType + "%"}`);
  if (params.from) conditions.push(gte(auditLogs.createdAt, new Date(params.from)));
  if (params.to) conditions.push(lte(auditLogs.createdAt, new Date(params.to + "T23:59:59")));

  const logs = await db
    .select({
      id: auditLogs.id,
      actionType: auditLogs.actionType,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt,
      actorName: sql<string | null>`concat(${users.firstName}, ' ', ${users.lastName})`,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(and(...conditions))
    .orderBy(sql`${auditLogs.createdAt} desc`)
    .limit(200);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Compliance & Security"
        title="Audit Logs"
        description="Chronological record of system modifications, checkouts, logins, and request approvals."
      />

      <AuditLogFilters targetTypes={TARGET_TYPES} />

      <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target Type</TableHead>
              <TableHead>Target ID</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No audit logs match these filters.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>{log.actorName?.trim() || log.actorEmail || "System / Automated"}</span>
                      {log.actorName?.trim() && log.actorEmail && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {log.actorEmail}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeColor(log.actionType)} className="font-mono text-[10px] px-2 py-0.5 whitespace-nowrap">
                      {log.actionType}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize text-xs font-semibold text-teal-600 dark:text-teal-500 whitespace-nowrap">
                    {log.targetType}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap" title={log.targetId}>
                    {log.targetId.substring(0, 8)}...
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate font-mono text-[11px] text-muted-foreground" title={summarizeMeta(log.actionType, log.meta)}>
                    {summarizeMeta(log.actionType, log.meta)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
