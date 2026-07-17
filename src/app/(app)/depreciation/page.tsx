import { listDepreciationSchedules } from "@/lib/actions/depreciations";
import { getDepreciationSummary } from "@/lib/actions/analytics";
import { DepreciationDialog } from "./depreciation-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, TrendingDown } from "lucide-react";

export default async function DepreciationPage() {
  const [schedules, summary] = await Promise.all([
    listDepreciationSchedules(),
    getDepreciationSummary(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Reference Data"
        title="Depreciation"
        description="Straight-line depreciation schedules, and current book value across assigned assets."
        actions={<DepreciationDialog />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assets with a schedule</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.assetCount.toLocaleString()}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Original cost</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {summary.originalCost.toLocaleString("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current book value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {summary.currentValue.toLocaleString("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 })}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Useful Life</TableHead>
              <TableHead>Minimum Value</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TrendingDown className="size-8 opacity-40" />
                    <p className="text-sm">No depreciation schedules yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-semibold">{s.name}</TableCell>
                <TableCell className="font-mono">{s.months} months</TableCell>
                <TableCell className="font-mono">{s.minimumValuePct}%</TableCell>
                <TableCell>
                  <DepreciationDialog
                    editing={s}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${s.name}`}>
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
