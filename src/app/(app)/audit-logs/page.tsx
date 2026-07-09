import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { auditLogs, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
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

export default async function AuditLogsPage() {
  const user = await requireUser();

  const isTechOrManager =
    user.role.name === "admin" ||
    user.role.name === "it_manager" ||
    user.role.name === "technician";

  if (!isTechOrManager) {
    notFound();
  }

  // Fetch recent 100 audit logs
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
    .where(eq(auditLogs.companyId, user.companyId))
    .orderBy(sql`${auditLogs.createdAt} desc`)
    .limit(100);

  const getActionBadgeColor = (action: string) => {
    if (action.includes("create") || action.includes("add")) return "outline";
    if (action.includes("checkout") || action.includes("decline")) return "destructive";
    if (action.includes("checkin") || action.includes("accept") || action.includes("approve")) return "default";
    return "secondary";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Compliance & Security"
        title="Audit Logs"
        description="Chronological record of system modifications, checkouts, and request approvals."
      />

      <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target Type</TableHead>
              <TableHead>Target ID</TableHead>
              <TableHead>Metadata Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No audit logs recorded yet.
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
                      <span>{log.actorName || "System / Automated"}</span>
                      {log.actorEmail && (
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
                  <TableCell className="max-w-[280px] truncate font-mono text-[11px] text-muted-foreground" title={JSON.stringify(log.meta, null, 2)}>
                    {JSON.stringify(log.meta)}
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
