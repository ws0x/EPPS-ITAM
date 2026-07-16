import { requireUser } from "@/lib/auth/dal";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Boxes, PackageCheck, Wallet, Users, AlertCircle, ShieldAlert, ArrowRight } from "lucide-react";
import { db } from "@/db/client";
import { acceptances, checkouts, requests } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await getDashboardStats();

  const isTechOrManager =
    user.role.name === "admin" ||
    user.role.name === "it_manager" ||
    user.role.name === "technician";

  // 1. Fetch counts of pending acceptances for current user
  const [acceptancesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(acceptances)
    .innerJoin(checkouts, eq(acceptances.checkoutId, checkouts.id))
    .where(
      and(
        eq(checkouts.assignedToUserId, user.id),
        eq(acceptances.status, "pending")
      )
    );
  const pendingAcceptances = Number(acceptancesCount?.count ?? 0);

  // 2. Fetch counts of pending approvals (direct reports if standard employee, all if IT manager/admin)
  const approvalsWhereClause = isTechOrManager
    ? and(eq(requests.companyId, user.companyId), eq(requests.status, "pending_approval"))
    : and(
        eq(requests.companyId, user.companyId),
        eq(requests.status, "pending_approval"),
        eq(requests.approverUserId, user.id)
      );

  const [approvalsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(requests)
    .where(approvalsWhereClause);
  const pendingApprovals = Number(approvalsCount?.count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${user.firstName ?? user.email}`}
        description={`Signed in as ${user.role.name.replace(/_/g, " ")}.`}
      />

      {/* Dynamic Alerts */}
      <div className="flex flex-col gap-3">
        {pendingAcceptances > 0 && (
          <div className="flex items-start justify-between gap-4 p-4 text-sm bg-amber-500/[0.06] text-amber-800 dark:text-amber-300 rounded-lg border border-amber-500/20">
            <div className="flex items-center gap-3">
              <ShieldAlert className="size-5 shrink-0 text-amber-500" />
              <div>
                <span className="font-bold">Custody Action Needed:</span> You have{" "}
                <strong className="font-semibold underline">{pendingAcceptances}</strong> checked-out{" "}
                {pendingAcceptances === 1 ? "item" : "items"} requiring your EULA signature before they can be officially verified.
              </div>
            </div>
            <Link
              href="/requests"
              className="flex items-center gap-1 font-semibold hover:underline text-xs shrink-0 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-md transition-colors border border-amber-500/25"
            >
              Sign Off Now <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}

        {pendingApprovals > 0 && (
          <div className="flex items-start justify-between gap-4 p-4 text-sm bg-teal-500/[0.06] text-teal-800 dark:text-teal-300 rounded-lg border border-teal-500/20">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 shrink-0 text-teal-600" />
              <div>
                <span className="font-bold">Approvals Pending:</span> You have{" "}
                <strong className="font-semibold underline">{pendingApprovals}</strong> pending item allocation{" "}
                {pendingApprovals === 1 ? "request" : "requests"} awaiting your review.
              </div>
            </div>
            <Link
              href="/requests"
              className="flex items-center gap-1 font-semibold hover:underline text-xs shrink-0 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-md transition-colors border border-teal-500/25"
            >
              Review Requests <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Assets" value={stats.totalAssets} icon={Boxes} accent="teal" />
        <StatCard label="Deployed" value={stats.deployedAssets} icon={PackageCheck} accent="green" />
        <StatCard
          label="Total Value"
          value={stats.totalValue.toLocaleString("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 })}
          icon={Wallet}
          accent="amber"
        />
        <StatCard label="Users" value={stats.totalUsers} icon={Users} accent="teal" />
      </div>
    </div>
  );
}
