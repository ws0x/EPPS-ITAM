import { requireUser } from "@/lib/auth/dal";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Boxes,
  PackageCheck,
  Wallet,
  Users,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from "lucide-react";
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

  // 2. Fetch counts of pending approvals
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

  const displayName = user.firstName ?? user.email;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6 animate-fade-slide-up">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-background to-primary/4 p-7">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 size-28 rounded-full bg-amber-500/8 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-4 text-primary/60" />
              <span className="text-xs font-semibold text-primary/70 uppercase tracking-wider">
                {greeting}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">
              Signed in as <span className="font-medium text-foreground/80">{user.role.name.replace(/_/g, " ")}</span>
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 text-right">
            <span className="text-xs text-muted-foreground">EPPS ITAM</span>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Asset Management</span>
          </div>
        </div>
      </div>

      {/* Dynamic Alerts */}
      <div className="flex flex-col gap-3">
        {pendingAcceptances > 0 && (
          <div className="flex items-start justify-between gap-4 p-4 text-sm bg-amber-500/[0.06] text-amber-800 dark:text-amber-300 rounded-xl border border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <ShieldAlert className="size-4 text-amber-500" />
              </div>
              <div>
                <span className="font-semibold">Custody Action Needed:</span>{" "}
                You have <strong className="font-bold">{pendingAcceptances}</strong> checked-out{" "}
                {pendingAcceptances === 1 ? "item" : "items"} requiring your EULA signature.
              </div>
            </div>
            <Link
              href="/requests"
              className="flex items-center gap-1 font-semibold text-xs shrink-0 bg-amber-500/12 hover:bg-amber-500/22 px-3 py-1.5 rounded-lg transition-colors border border-amber-500/25"
            >
              Sign Off <ArrowRight className="size-3" />
            </Link>
          </div>
        )}

        {pendingApprovals > 0 && (
          <div className="flex items-start justify-between gap-4 p-4 text-sm bg-teal-500/[0.06] text-teal-800 dark:text-teal-300 rounded-xl border border-teal-500/20">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
                <AlertCircle className="size-4 text-teal-600" />
              </div>
              <div>
                <span className="font-semibold">Approvals Pending:</span>{" "}
                You have <strong className="font-bold">{pendingApprovals}</strong> item allocation{" "}
                {pendingApprovals === 1 ? "request" : "requests"} awaiting your review.
              </div>
            </div>
            <Link
              href="/requests"
              className="flex items-center gap-1 font-semibold text-xs shrink-0 bg-teal-500/12 hover:bg-teal-500/22 px-3 py-1.5 rounded-lg transition-colors border border-teal-500/25"
            >
              Review <ArrowRight className="size-3" />
            </Link>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Assets" value={stats.totalAssets} icon={Boxes} accent="indigo" />
        <StatCard label="Deployed" value={stats.deployedAssets} icon={PackageCheck} accent="green" />
        <StatCard
          label="Total Value"
          value={stats.totalValue.toLocaleString("en-US", {
            style: "currency",
            currency: "EGP",
            maximumFractionDigits: 0,
          })}
          icon={Wallet}
          accent="amber"
        />
        <StatCard label="Users" value={stats.totalUsers} icon={Users} accent="indigo" />
      </div>
    </div>
  );
}
