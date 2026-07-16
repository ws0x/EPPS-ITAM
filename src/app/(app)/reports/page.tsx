import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { getLicenseExpiryForecast, getWarrantyExpiryForecast, getAuditCompliance } from "@/lib/actions/analytics";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, KeyRound, ShieldCheck } from "lucide-react";

function ReportCard({
  icon: Icon,
  title,
  description,
  stat,
  href,
  format,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  stat: string;
  href: string;
  format: "PDF" | "CSV";
}) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3 shadow-xs">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">{format}</p>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="text-xs font-mono text-muted-foreground">{stat}</p>
      <Button variant="outline" size="sm" nativeButton={false} render={<a href={href} download />} className="mt-auto self-start">
        Download
      </Button>
    </div>
  );
}

export default async function ReportsPage() {
  const user = await requireUser();
  const isTechOrManager =
    user.role.name === "admin" || user.role.name === "it_manager" || user.role.name === "technician";
  if (!isTechOrManager) {
    notFound();
  }

  const [licenseForecast, warrantyForecast, auditCompliance] = await Promise.all([
    getLicenseExpiryForecast(),
    getWarrantyExpiryForecast(),
    getAuditCompliance(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Compliance & Reporting"
        title="Reports"
        description="Pre-built exports covering the full asset register, upcoming expirations, and audit compliance."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ReportCard
          icon={FileText}
          title="Asset Register"
          description="The complete list of assets, with tag, category, status, location, and current assignee."
          stat="All assets, current filters not applied"
          href="/api/export/assets/pdf"
          format="PDF"
        />
        <ReportCard
          icon={KeyRound}
          title="License Expiry"
          description="Licenses expiring within 90 days, sorted soonest first."
          stat={`${licenseForecast.upcoming.length} expiring within 90 days`}
          href="/api/export/reports/license-expiry"
          format="CSV"
        />
        <ReportCard
          icon={FileSpreadsheet}
          title="Warranty Expiry"
          description="Assets with a warranty expiring within 90 days, sorted soonest first."
          stat={`${warrantyForecast.length} expiring within 90 days`}
          href="/api/export/reports/warranty-expiry"
          format="CSV"
        />
        <ReportCard
          icon={ShieldCheck}
          title="Audit Compliance"
          description="Every asset's next-audit-date status: overdue, upcoming, or never scheduled."
          stat={`${auditCompliance.overdue} overdue, ${auditCompliance.neverScheduled} never scheduled`}
          href="/api/export/reports/audit-compliance"
          format="CSV"
        />
      </div>
    </div>
  );
}
