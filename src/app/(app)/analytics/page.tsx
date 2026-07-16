import {
  getUtilizationByStatus,
  getAssetCountByCategory,
  getValueByCategory,
  getLicenseExpiryForecast,
  getWarrantyExpiryForecast,
  getAuditCompliance,
  getCheckoutTurnaround,
  getDepreciationSummary,
} from "@/lib/actions/analytics";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageSearch, CalendarClock, ShieldCheck, Timer, DollarSign, Package, TrendingDown } from "lucide-react";
import { StatusDonutChart, CategoryHorizontalBarChart, ValueBarChart } from "@/components/analytics/dashboard-charts";

function EmptyState({ icon: Icon, message }: { icon: typeof PackageSearch; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
      <Icon className="size-7 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default async function AnalyticsPage() {
  const [
    utilizationByStatus,
    assetsByCategory,
    valueByCategory,
    licenseExpiry,
    warrantyExpiry,
    auditCompliance,
    turnaround,
    depreciationSummary,
  ] = await Promise.all([
    getUtilizationByStatus(),
    getAssetCountByCategory(),
    getValueByCategory(),
    getLicenseExpiryForecast(),
    getWarrantyExpiryForecast(),
    getAuditCompliance(),
    getCheckoutTurnaround(),
    getDepreciationSummary(),
  ]);

  const totalAssets = utilizationByStatus.reduce((acc, curr) => acc + curr.count, 0);
  const totalValue = valueByCategory.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Insights"
        title="Analytics Dashboard"
        description="Monitor fleet health, lifecycle transitions, and financial value metrics."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssets.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Managed in system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalValue.toLocaleString("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Recorded purchase cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Audits</CardTitle>
            <ShieldCheck className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{auditCompliance.overdue}</div>
            <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checkout Speed</CardTitle>
            <Timer className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{turnaround.avgDays.toFixed(1)} days</div>
            <p className="text-xs text-muted-foreground mt-1">Average turnaround</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Book Value</CardTitle>
            <TrendingDown className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {depreciationSummary.currentValue.toLocaleString("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {depreciationSummary.assetCount > 0 ? `Across ${depreciationSummary.assetCount} depreciating assets` : "No assets have a schedule yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Row 1: Charts */}
        <div className="lg:col-span-1">
          {utilizationByStatus.length > 0 ? (
            <StatusDonutChart data={utilizationByStatus} />
          ) : (
            <Card><CardContent><EmptyState icon={PackageSearch} message="No assets yet." /></CardContent></Card>
          )}
        </div>
        <div className="lg:col-span-1">
          {assetsByCategory.length > 0 ? (
            <CategoryHorizontalBarChart data={assetsByCategory} />
          ) : (
             <Card><CardContent><EmptyState icon={PackageSearch} message="No assets yet." /></CardContent></Card>
          )}
        </div>
        <div className="lg:col-span-1">
          {valueByCategory.length > 0 ? (
            <ValueBarChart data={valueByCategory} />
          ) : (
             <Card><CardContent><EmptyState icon={PackageSearch} message="No purchase cost recorded." /></CardContent></Card>
          )}
        </div>

        {/* Row 2: Expiries */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Warranty Expiries</CardTitle>
            <CardDescription>Ending within 90 days</CardDescription>
          </CardHeader>
          <CardContent>
            {warrantyExpiry.length === 0 ? (
              <EmptyState icon={CalendarClock} message="No expirations soon." />
            ) : (
              <div className="flex flex-col gap-2">
                {warrantyExpiry.slice(0, 6).map((w) => (
                  <div key={w.label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 border rounded-md">
                    <span className="text-sm truncate font-medium">{w.label}</span>
                    <Badge variant="outline" className={w.daysUntil < 0 ? "border-destructive text-destructive bg-destructive/10" : ""}>
                      {w.daysUntil < 0 ? `Expired ${Math.abs(w.daysUntil)}d ago` : `${w.daysUntil}d left`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>License Expiries</CardTitle>
            <CardDescription>Ending within 90 days</CardDescription>
          </CardHeader>
          <CardContent>
            {licenseExpiry.upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} message="No expirations soon." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {licenseExpiry.upcoming.slice(0, 8).map((l) => (
                  <div key={l.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 border rounded-md">
                    <span className="text-sm truncate font-medium">{l.name}</span>
                    <Badge variant="outline" className={l.daysUntil < 0 ? "border-destructive text-destructive bg-destructive/10" : ""}>
                      {l.daysUntil < 0 ? `Expired ${Math.abs(l.daysUntil)}d ago` : `${l.daysUntil}d left`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
