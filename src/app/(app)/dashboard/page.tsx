import { requireUser } from "@/lib/auth/dal";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Boxes, PackageCheck, Wallet, Users } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await getDashboardStats();

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${user.firstName ?? user.email}`}
        description={`Signed in as ${user.role.name.replace(/_/g, " ")}.`}
      />

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
