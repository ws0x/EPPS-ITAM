import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import {
  getPurchaseOrder,
  listPoBeneficiaryCompanies,
  listPoBeneficiaryDepartments,
  removePoLine,
} from "@/lib/actions/purchase-orders";
import { computePoTotals } from "@/lib/po-totals";
import { PoHeaderForm } from "./po-header-form";
import { AddPoLineDialog } from "./add-po-line-dialog";
import { SubmitPoButton } from "./submit-po-button";
import { RecordHistory } from "@/components/record-history";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Receipt, FileDown } from "lucide-react";

function formatEgp(n: number) {
  return `EGP ${n.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await requireUser();
  const [data, beneficiaryCompanies, beneficiaryDepartments] = await Promise.all([
    getPurchaseOrder(id),
    listPoBeneficiaryCompanies(),
    listPoBeneficiaryDepartments(),
  ]);

  if (!data) notFound();
  const { order, lines } = data;
  const editable = order.status === "draft";

  const totals = computePoTotals({
    lines: lines.map((l) => ({ unitPrice: Number(l.unitPrice), quantity: Number(l.quantity) })),
    vatRegistered: order.vatRegistered,
    advancePaymentRegistered: order.advancePaymentRegistered,
    eInvoiced: order.eInvoiced,
    miscAmount: order.miscAmount ? Number(order.miscAmount) : null,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Procurement / Purchase Orders"
        title={order.poNumber}
        description={`Supplier: ${order.supplierName}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge
              variant={
                order.status === "pending_approval"
                  ? "outline"
                  : order.status === "approved"
                  ? "default"
                  : order.status === "rejected"
                  ? "destructive"
                  : "secondary"
              }
              className="capitalize text-xs px-2 py-1"
            >
              {order.status.replace("_", " ")}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/purchase-orders/${order.id}/pdf`} target="_blank" rel="noopener noreferrer" />}
            >
              <FileDown /> View PDF
            </Button>
            {editable && <SubmitPoButton poId={order.id} disabled={lines.length === 0} />}
          </div>
        }
      />

      {order.status === "rejected" && order.rejectionReason && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <span className="font-semibold text-destructive">Rejection reason: </span>
          {order.rejectionReason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <PoHeaderForm
            po={{
              id: order.id,
              date: order.date,
              prNumber: order.prNumber,
              supplierName: order.supplierName,
              supplierAddress: order.supplierAddress,
              supplierTel: order.supplierTel,
              supplierFax: order.supplierFax,
              supplierEmail: order.supplierEmail,
              vatRegistered: order.vatRegistered,
              advancePaymentRegistered: order.advancePaymentRegistered,
              eInvoiced: order.eInvoiced,
              miscAmount: order.miscAmount,
              miscType: order.miscType,
              paymentTerm: order.paymentTerm,
              deliveryDate: order.deliveryDate,
              note: order.note,
            }}
            editable={editable}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Line Items</h3>
              {editable && (
                <AddPoLineDialog
                  poId={order.id}
                  beneficiaryCompanies={beneficiaryCompanies}
                  beneficiaryDepartments={beneficiaryDepartments}
                />
              )}
            </div>
            <div className="rounded-lg border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                    {editable && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={editable ? 7 : 6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Receipt className="size-8 opacity-40" />
                          <p className="text-sm">No line items yet.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-xs">{line.lineNumber}</TableCell>
                      <TableCell>
                        {line.description}
                        {line.itemCode && <span className="block text-[10px] text-muted-foreground font-mono">{line.itemCode}</span>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatEgp(Number(line.unitPrice))}</TableCell>
                      <TableCell className="font-mono text-sm">{line.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {line.beneficiaryCompany} / {line.beneficiaryDepartment}
                        {line.beneficiaryEmployee && <span className="block">{line.beneficiaryEmployee}</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatEgp(Number(line.unitPrice) * Number(line.quantity))}
                      </TableCell>
                      {editable && (
                        <TableCell>
                          <form action={removePoLine}>
                            <input type="hidden" name="poId" value={order.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" type="submit">
                              <Trash2 className="size-4" />
                            </Button>
                          </form>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                {lines.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={editable ? 5 : 4}>Subtotal</TableCell>
                      <TableCell className="text-right font-mono" colSpan={editable ? 2 : 2}>{formatEgp(totals.subtotal)}</TableCell>
                    </TableRow>
                    {order.vatRegistered && (
                      <TableRow>
                        <TableCell colSpan={editable ? 5 : 4}>VAT (14%)</TableCell>
                        <TableCell className="text-right font-mono" colSpan={2}>{formatEgp(totals.vatAmount)}</TableCell>
                      </TableRow>
                    )}
                    {totals.whtAmount > 0 && (
                      <TableRow>
                        <TableCell colSpan={editable ? 5 : 4}>WHT (1%)</TableCell>
                        <TableCell className="text-right font-mono" colSpan={2}>-{formatEgp(totals.whtAmount)}</TableCell>
                      </TableRow>
                    )}
                    {totals.miscWithVat > 0 && (
                      <TableRow>
                        <TableCell colSpan={editable ? 5 : 4}>{order.miscType ?? "Misc. charge"}{order.eInvoiced ? " (+14%)" : ""}</TableCell>
                        <TableCell className="text-right font-mono" colSpan={2}>{formatEgp(totals.miscWithVat)}</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="font-semibold">
                      <TableCell colSpan={editable ? 5 : 4}>Total</TableCell>
                      <TableCell className="text-right font-mono" colSpan={2}>{formatEgp(totals.totalAmount)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </div>

        <div>
          <RecordHistory companyId={currentUser.companyId} targetType="purchase_order" targetId={order.id} />
        </div>
      </div>
    </div>
  );
}
