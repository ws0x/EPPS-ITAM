import {
  getUtilizationByStatus,
  getAssetCountByCategory,
  getValueByCategory,
  getLicenseExpiryForecast,
  getWarrantyExpiryForecast,
  getAuditCompliance,
  getCheckoutTurnaround,
} from "@/lib/actions/analytics";
import { PageHeader } from "@/components/page-header";
import { ChartThemeProvider } from "@/components/analytics/chart-theme";
import { CategoryBarChart } from "@/components/analytics/category-bar-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageSearch, CalendarClock, ShieldCheck, Timer } from "lucide-react";

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
  ] = await Promise.all([
    getUtilizationByStatus(),
    getAssetCountByCategory(),
    getValueByCategory(),
    getLicenseExpiryForecast(),
    getWarrantyExpiryForecast(),
    getAuditCompliance(),
    getCheckoutTurnaround(),
  ]);

  const statusData = utilizationByStatus.map((s) => ({ name: s.name, value: s.count, color: s.color }));
  const categoryData = assetsByCategory.map((c) => ({ name: c.name, value: c.count }));
  const valueData = valueByCategory.map((v) => ({ name: v.name, value: v.total }));

  const expiryBucketData = [
    { name: "Already expired", value: licenseExpiry.buckets.expired },
    { name: "Next 30 days", value: licenseExpiry.buckets["30"] },
    { name: "31–60 days", value: licenseExpiry.buckets["60"] },
    { name: "61–90 days", value: licenseExpiry.buckets["90"] },
  ].filter((b) => b.value > 0);

  return (
    <ChartThemeProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Insights"
          title="Analytics"
          description="Fleet utilization, cost, expiry forecasting, audit compliance, and checkout turnaround."
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Utilization by status</CardTitle>
              <CardDescription>How many assets are in each lifecycle state.</CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length === 0 ? (
                <EmptyState icon={PackageSearch} message="No assets yet." />
              ) : (
                <CategoryBarChart data={statusData} valueLabel="Assets" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assets by category</CardTitle>
              <CardDescription>Top 10 categories by asset count.</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <EmptyState icon={PackageSearch} message="No assets yet." />
              ) : (
                <CategoryBarChart data={categoryData} valueLabel="Assets" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Value by category</CardTitle>
              <CardDescription>Total recorded purchase cost, top 10 categories.</CardDescription>
            </CardHeader>
            <CardContent>
              {valueData.length === 0 ? (
                <EmptyState
                  icon={PackageSearch}
                  message="No purchase cost recorded on any asset yet."
                />
              ) : (
                <CategoryBarChart
                  data={valueData}
                  valueLabel="Value"
                  formatValue={(v) => v.toLocaleString("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 })}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>License expiry forecast</CardTitle>
              <CardDescription>Licenses expiring within the next 90 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {licenseExpiry.upcoming.length === 0 ? (
                <EmptyState icon={CalendarClock} message="Nothing expiring in the next 90 days." />
              ) : (
                <div className="flex flex-col gap-4">
                  <CategoryBarChart data={expiryBucketData} valueLabel="Licenses" />
                  <div className="flex flex-col gap-1.5 border-t pt-3">
                    {licenseExpiry.upcoming.slice(0, 5).map((l) => (
                      <div key={l.name} className="flex items-center justify-between text-sm">
                        <span>{l.name}</span>
                        <Badge
                          variant="outline"
                          className={l.daysUntil < 0 ? "border-destructive text-destructive bg-destructive/10" : ""}
                        >
                          {l.daysUntil < 0 ? `Expired ${Math.abs(l.daysUntil)}d ago` : `${l.daysUntil}d left`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Warranty expiry forecast</CardTitle>
              <CardDescription>Assets with warranty ending within 90 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {warrantyExpiry.length === 0 ? (
                <EmptyState icon={CalendarClock} message="No warranty expirations in the next 90 days." />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {warrantyExpiry.slice(0, 8).map((w) => (
                    <div key={w.label} className="flex items-center justify-between text-sm">
                      <span>{w.label}</span>
                      <Badge
                        variant="outline"
                        className={w.daysUntil < 0 ? "border-destructive text-destructive bg-destructive/10" : ""}
                      >
                        {w.daysUntil < 0 ? `Expired ${Math.abs(w.daysUntil)}d ago` : `${w.daysUntil}d left`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit compliance</CardTitle>
              <CardDescription>Assets scheduled for audit vs. never scheduled.</CardDescription>
            </CardHeader>
            <CardContent>
              {auditCompliance.total === 0 ? (
                <EmptyState icon={ShieldCheck} message="No assets yet." />
              ) : (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-destructive">{auditCompliance.overdue}</p>
                    <p className="text-xs text-muted-foreground mt-1">Overdue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-emerald-600">{auditCompliance.upcoming}</p>
                    <p className="text-xs text-muted-foreground mt-1">Scheduled</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-muted-foreground">{auditCompliance.neverScheduled}</p>
                    <p className="text-xs text-muted-foreground mt-1">Never scheduled</p>
                  </div>
                </div>
              )}
              {auditCompliance.total > 0 && auditCompliance.neverScheduled === auditCompliance.total && (
                <p className="text-xs text-muted-foreground mt-4 border-t pt-3">
                  No asset has a next-audit date set yet — this fills in once audits are scheduled from an asset&apos;s detail page.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checkout turnaround</CardTitle>
              <CardDescription>Average time from checkout to checkin, completed checkouts only.</CardDescription>
            </CardHeader>
            <CardContent>
              {turnaround.completedCount === 0 ? (
                <EmptyState icon={Timer} message="No completed checkouts yet." />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold tabular-nums">{turnaround.avgDays.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">
                    avg. days across {turnaround.completedCount} completed checkout{turnaround.completedCount === 1 ? "" : "s"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ChartThemeProvider>
  );
}
