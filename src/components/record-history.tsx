import { db } from "@/db/client";
import { auditLogs, checkouts, users } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History, ArrowRightLeft } from "lucide-react";

function summarizeMeta(actionType: string, meta: Record<string, unknown>): string {
  if (actionType.endsWith(".created")) return "Created";
  if (actionType.endsWith(".deleted")) return "Deleted";
  if (actionType.endsWith(".updated") && meta.diff && typeof meta.diff === "object") {
    const diff = meta.diff as Record<string, { from: unknown; to: unknown }>;
    return Object.entries(diff)
      .map(([field, { from, to }]) => `${field}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`)
      .join("; ");
  }
  if (Object.keys(meta).length === 0) return "-";
  return JSON.stringify(meta);
}

/**
 * Combined per-record activity view: the audit trail (create/update/delete)
 * for this exact record, plus - when it's a checkoutable entity - its full
 * checkout/check-in history. Two sections rather than one blended timeline
 * since they carry genuinely different columns (a diff summary vs. who/when).
 */
export async function RecordHistory({
  companyId,
  targetType,
  targetId,
  checkoutable,
  checkoutableLabels,
}: {
  companyId: string;
  targetType: string;
  targetId: string;
  checkoutable?: { type: "asset" | "license_seat" | "consumable_assignment" | "kit"; id: string | string[] };
  /** Only meaningful when checkoutable.id is an array (e.g. a license's seats) - maps a checkoutableId to a display label like "Seat #2". */
  checkoutableLabels?: Record<string, string>;
}) {
  const assignedUser = alias(users, "assigned_user");
  const checkedOutByUser = alias(users, "checked_out_by_user");
  const checkedInByUser = alias(users, "checked_in_by_user");

  const [logs, checkoutRows] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        actionType: auditLogs.actionType,
        meta: auditLogs.meta,
        createdAt: auditLogs.createdAt,
        actorName: sql<string | null>`concat(${users.firstName}, ' ', ${users.lastName})`,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(and(eq(auditLogs.companyId, companyId), eq(auditLogs.targetType, targetType), eq(auditLogs.targetId, targetId)))
      .orderBy(sql`${auditLogs.createdAt} desc`)
      .limit(50),
    checkoutable
      ? db
          .select({
            id: checkouts.id,
            checkoutableId: checkouts.checkoutableId,
            checkedOutAt: checkouts.checkedOutAt,
            checkedInAt: checkouts.checkedInAt,
            expectedCheckinAt: checkouts.expectedCheckinAt,
            notes: checkouts.notes,
            assignedToFirstName: assignedUser.firstName,
            assignedToLastName: assignedUser.lastName,
            assignedToEmail: assignedUser.email,
            checkedOutByFirstName: checkedOutByUser.firstName,
            checkedOutByLastName: checkedOutByUser.lastName,
            checkedInByFirstName: checkedInByUser.firstName,
            checkedInByLastName: checkedInByUser.lastName,
          })
          .from(checkouts)
          .leftJoin(assignedUser, eq(checkouts.assignedToUserId, assignedUser.id))
          .leftJoin(checkedOutByUser, eq(checkouts.checkedOutByUserId, checkedOutByUser.id))
          .leftJoin(checkedInByUser, eq(checkouts.checkedInByUserId, checkedInByUser.id))
          .where(
            and(
              eq(checkouts.checkoutableType, checkoutable.type),
              Array.isArray(checkoutable.id)
                ? inArray(checkouts.checkoutableId, checkoutable.id)
                : eq(checkouts.checkoutableId, checkoutable.id),
            ),
          )
          .orderBy(sql`${checkouts.checkedOutAt} desc`)
      : Promise.resolve([]),
  ]);

  const showSeatColumn = Array.isArray(checkoutable?.id) && checkoutable.id.length > 1;

  const fullName = (first: string | null, last: string | null, email: string | null) =>
    first ? `${first} ${last ?? ""}`.trim() : (email ?? "-");

  return (
    <div className="flex flex-col gap-6">
      {checkoutable && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <ArrowRightLeft className="size-4 text-primary" /> Checkout History
          </h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  {showSeatColumn && <TableHead>Item</TableHead>}
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Checked Out</TableHead>
                  <TableHead>Checked In</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkoutRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={showSeatColumn ? 6 : 5} className="text-center py-8 text-muted-foreground text-sm">
                      No checkout history yet.
                    </TableCell>
                  </TableRow>
                )}
                {checkoutRows.map((row) => (
                  <TableRow key={row.id}>
                    {showSeatColumn && (
                      <TableCell className="text-xs text-muted-foreground">
                        {checkoutableLabels?.[row.checkoutableId] ?? row.checkoutableId}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      {fullName(row.assignedToFirstName, row.assignedToLastName, row.assignedToEmail)}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{new Date(row.checkedOutAt).toLocaleString()}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {row.checkedInAt ? (
                        new Date(row.checkedInAt).toLocaleString()
                      ) : (
                        <Badge variant="outline" className="border-teal-500 text-teal-600 bg-teal-500/10">
                          Still out
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fullName(row.checkedOutByFirstName, row.checkedOutByLastName, null)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{row.notes ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <History className="size-4 text-primary" /> Activity Log
        </h3>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                    No activity recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{log.actorName?.trim() || log.actorEmail || "System"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {log.actionType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate" title={summarizeMeta(log.actionType, log.meta)}>
                    {summarizeMeta(log.actionType, log.meta)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
