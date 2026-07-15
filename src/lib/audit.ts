import "server-only";
import { auditLogs } from "@/db/schema";

// Matches both `db` and a `db.transaction(async (tx) => ...)` callback param —
// both expose the same `.insert()` query builder shape.
type DbLike = { insert: typeof import("@/db/client").db.insert };

const IGNORED_DIFF_KEYS = new Set(["updatedAt", "createdAt"]);

function diffRows(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (IGNORED_DIFF_KEYS.has(key)) continue;
    const beforeVal = before[key];
    const afterVal = after[key];
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff[key] = { from: beforeVal, to: afterVal };
    }
  }
  return diff;
}

type TargetType =
  | "asset" | "license" | "license_seat" | "consumable" | "kit" | "kit_item"
  | "location" | "department" | "manufacturer" | "model" | "user"
  | "checkout" | "acceptance" | "request";

/** Log a record's creation, snapshotting the full row for later reference. */
export async function logCreate(
  dbOrTx: DbLike,
  params: { companyId: string; actorUserId: string; targetType: TargetType; targetId: string; row: Record<string, unknown> },
) {
  await dbOrTx.insert(auditLogs).values({
    companyId: params.companyId,
    actorUserId: params.actorUserId,
    actionType: `${params.targetType}.created`,
    targetType: params.targetType,
    targetId: params.targetId,
    meta: { created: params.row },
  });
}

/**
 * Log a record's update as a field-level before/after diff. No-ops (doesn't
 * write a row) if nothing actually changed — a save that touched no fields
 * shouldn't clutter the activity feed.
 */
export async function logUpdate(
  dbOrTx: DbLike,
  params: {
    companyId: string;
    actorUserId: string;
    targetType: TargetType;
    targetId: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
) {
  const diff = diffRows(params.before, params.after);
  if (Object.keys(diff).length === 0) return;
  await dbOrTx.insert(auditLogs).values({
    companyId: params.companyId,
    actorUserId: params.actorUserId,
    actionType: `${params.targetType}.updated`,
    targetType: params.targetType,
    targetId: params.targetId,
    meta: { diff },
  });
}

/** Log a record's deletion, snapshotting the full row (it won't exist to look up afterward). */
export async function logDelete(
  dbOrTx: DbLike,
  params: { companyId: string; actorUserId: string; targetType: TargetType; targetId: string; row: Record<string, unknown> },
) {
  await dbOrTx.insert(auditLogs).values({
    companyId: params.companyId,
    actorUserId: params.actorUserId,
    actionType: `${params.targetType}.deleted`,
    targetType: params.targetType,
    targetId: params.targetId,
    meta: { deleted: params.row },
  });
}

/** Escape hatch for events that aren't a plain create/update/delete (login, logout, custom actions). */
export async function logEvent(
  dbOrTx: DbLike,
  params: {
    companyId: string;
    actorUserId: string | null;
    actionType: string;
    targetType: TargetType;
    targetId: string;
    meta?: Record<string, unknown>;
  },
) {
  await dbOrTx.insert(auditLogs).values({
    companyId: params.companyId,
    actorUserId: params.actorUserId,
    actionType: params.actionType,
    targetType: params.targetType,
    targetId: params.targetId,
    meta: params.meta ?? {},
  });
}
