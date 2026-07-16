import fs from "node:fs";
import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { computePoTotals } from "@/lib/po-totals";

const BRAND_DIR = path.join(process.cwd(), "public", "brand");

// Read as a Buffer, not a path string: @react-pdf/image's local-file
// detection round-trips the src through url.parse() + path.resolve(), which
// mishandles Windows drive-letter paths (and file:// URLs, since it resolves
// the literal "file://..." string rather than the parsed pathname). Passing
// a Buffer hits its isBuffer() fast path and skips that logic entirely.
function brandImage(filename: string) {
  return fs.readFileSync(path.join(BRAND_DIR, filename));
}

function formatEgp(n: number) {
  return `EGP ${n.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const styles = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 70, paddingHorizontal: 32, fontSize: 9, fontFamily: "Helvetica" },
  letterhead: { width: "100%", marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  headerBox: { border: "1pt solid #3D1F12", borderRadius: 3, padding: 6, width: "48%" },
  headerLabel: { fontSize: 7, color: "#3D1F12", fontFamily: "Helvetica-Bold", marginBottom: 2 },
  headerValue: { fontSize: 9, marginBottom: 3 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    backgroundColor: "#3D1F12",
    padding: 4,
    marginBottom: 6,
  },
  supplierGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  supplierBox: { width: "48%" },
  supplierRow: { flexDirection: "row", marginBottom: 2 },
  supplierLabel: { width: 60, fontFamily: "Helvetica-Bold" },
  table: { marginTop: 4, marginBottom: 12 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#D4B896", padding: 4 },
  tableRow: { flexDirection: "row", padding: 4, borderBottom: "0.5pt solid #D4B896" },
  colNum: { width: "4%" },
  colCode: { width: "9%" },
  colDesc: { width: "22%" },
  colUnit: { width: "6%" },
  colPrice: { width: "10%", textAlign: "right" },
  colQty: { width: "7%", textAlign: "right" },
  colBenCompany: { width: "13%" },
  colBenDept: { width: "13%" },
  colBenEmployee: { width: "9%" },
  colTotal: { width: "11%", textAlign: "right" },
  tableHeaderText: { fontFamily: "Helvetica-Bold", fontSize: 7 },
  totalsBox: { alignSelf: "flex-end", width: "40%", marginBottom: 16 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTop: "1pt solid #3D1F12",
    marginTop: 2,
    fontFamily: "Helvetica-Bold",
  },
  termsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  termsBox: { width: "31%" },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  signatureBox: { width: "45%", borderTop: "1pt solid #3D1F12", paddingTop: 4, textAlign: "center" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, width: "100%" },
});

export type PoPdfLine = {
  lineNumber: number;
  itemCode: string | null;
  description: string;
  unit: string | null;
  unitPrice: string;
  quantity: string;
  beneficiaryCompany: string;
  beneficiaryDepartment: string;
  beneficiaryEmployee: string | null;
};

export type PoPdfOrder = {
  poNumber: string;
  date: string;
  prNumber: string | null;
  supplierName: string;
  supplierAddress: string | null;
  supplierTel: string | null;
  supplierFax: string | null;
  supplierEmail: string | null;
  vatRegistered: boolean;
  advancePaymentRegistered: boolean;
  eInvoiced: boolean;
  miscAmount: string | null;
  miscType: string | null;
  paymentTerm: string | null;
  deliveryDate: string | null;
  note: string | null;
  status: string;
  preparerName: string;
  approverName: string;
};

export function PurchaseOrderPdf({ order, lines }: { order: PoPdfOrder; lines: PoPdfLine[] }) {
  const totals = computePoTotals({
    lines: lines.map((l) => ({ unitPrice: Number(l.unitPrice), quantity: Number(l.quantity) })),
    vatRegistered: order.vatRegistered,
    advancePaymentRegistered: order.advancePaymentRegistered,
    eInvoiced: order.eInvoiced,
    miscAmount: order.miscAmount ? Number(order.miscAmount) : null,
  });

  return (
    <Document title={order.poNumber}>
      <Page size="A4" style={styles.page}>
        <Image src={brandImage("makka-letterhead.png")} style={styles.letterhead} />

        <View style={styles.headerRow}>
          <View style={styles.headerBox}>
            <Text style={styles.headerLabel}>PO NO.</Text>
            <Text style={styles.headerValue}>{order.poNumber}</Text>
            {order.prNumber && (
              <>
                <Text style={styles.headerLabel}>PR NO.</Text>
                <Text style={styles.headerValue}>{order.prNumber}</Text>
              </>
            )}
          </View>
          <View style={styles.headerBox}>
            <Text style={styles.headerLabel}>DATE</Text>
            <Text style={styles.headerValue}>{order.date}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>SUPPLIER DETAILS</Text>
        <View style={styles.supplierGrid}>
          <View style={styles.supplierBox}>
            <View style={styles.supplierRow}>
              <Text style={styles.supplierLabel}>Name:</Text>
              <Text>{order.supplierName}</Text>
            </View>
            {order.supplierAddress && (
              <View style={styles.supplierRow}>
                <Text style={styles.supplierLabel}>Address:</Text>
                <Text>{order.supplierAddress}</Text>
              </View>
            )}
            {order.supplierTel && (
              <View style={styles.supplierRow}>
                <Text style={styles.supplierLabel}>Tel:</Text>
                <Text>{order.supplierTel}</Text>
              </View>
            )}
            {order.supplierFax && (
              <View style={styles.supplierRow}>
                <Text style={styles.supplierLabel}>Fax:</Text>
                <Text>{order.supplierFax}</Text>
              </View>
            )}
            {order.supplierEmail && (
              <View style={styles.supplierRow}>
                <Text style={styles.supplierLabel}>Email:</Text>
                <Text>{order.supplierEmail}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>ORDER ITEMS</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colNum, styles.tableHeaderText]}>#</Text>
            <Text style={[styles.colCode, styles.tableHeaderText]}>ITEM CODE</Text>
            <Text style={[styles.colDesc, styles.tableHeaderText]}>DESCRIPTION</Text>
            <Text style={[styles.colUnit, styles.tableHeaderText]}>UNIT</Text>
            <Text style={[styles.colPrice, styles.tableHeaderText]}>PRICE (EGP)</Text>
            <Text style={[styles.colQty, styles.tableHeaderText]}>QTY</Text>
            <Text style={[styles.colBenCompany, styles.tableHeaderText]}>BENEFICIARY CO.</Text>
            <Text style={[styles.colBenDept, styles.tableHeaderText]}>BENEFICIARY DEPT.</Text>
            <Text style={[styles.colBenEmployee, styles.tableHeaderText]}>EMPLOYEE</Text>
            <Text style={[styles.colTotal, styles.tableHeaderText]}>TOTAL (EGP)</Text>
          </View>
          {lines.map((line) => (
            <View style={styles.tableRow} key={line.lineNumber}>
              <Text style={styles.colNum}>{line.lineNumber}</Text>
              <Text style={styles.colCode}>{line.itemCode ?? "—"}</Text>
              <Text style={styles.colDesc}>{line.description}</Text>
              <Text style={styles.colUnit}>{line.unit ?? "—"}</Text>
              <Text style={styles.colPrice}>{Number(line.unitPrice).toLocaleString("en-EG", { minimumFractionDigits: 2 })}</Text>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colBenCompany}>{line.beneficiaryCompany}</Text>
              <Text style={styles.colBenDept}>{line.beneficiaryDepartment}</Text>
              <Text style={styles.colBenEmployee}>{line.beneficiaryEmployee ?? "—"}</Text>
              <Text style={styles.colTotal}>
                {(Number(line.unitPrice) * Number(line.quantity)).toLocaleString("en-EG", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{formatEgp(totals.subtotal)}</Text>
          </View>
          {order.vatRegistered && (
            <View style={styles.totalsRow}>
              <Text>VAT (14%)</Text>
              <Text>{formatEgp(totals.vatAmount)}</Text>
            </View>
          )}
          {totals.whtAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text>WHT (1%)</Text>
              <Text>-{formatEgp(totals.whtAmount)}</Text>
            </View>
          )}
          {totals.miscWithVat > 0 && (
            <View style={styles.totalsRow}>
              <Text>{order.miscType ?? "Misc. charge"}{order.eInvoiced ? " (+14%)" : ""}</Text>
              <Text>{formatEgp(totals.miscWithVat)}</Text>
            </View>
          )}
          <View style={styles.totalsRowFinal}>
            <Text>Total</Text>
            <Text>{formatEgp(totals.totalAmount)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>COMMERCIAL TERMS</Text>
        <View style={styles.termsGrid}>
          <View style={styles.termsBox}>
            <Text style={styles.headerLabel}>PAYMENT TERM</Text>
            <Text>{order.paymentTerm ?? "—"}</Text>
          </View>
          <View style={styles.termsBox}>
            <Text style={styles.headerLabel}>DELIVERY DATE</Text>
            <Text>{order.deliveryDate ?? "—"}</Text>
          </View>
          <View style={styles.termsBox}>
            <Text style={styles.headerLabel}>NOTE</Text>
            <Text>{order.note ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Technology Department</Text>
            <Text>{order.preparerName}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Managing Director</Text>
            <Text>{order.status === "approved" ? order.approverName : "Pending"}</Text>
          </View>
        </View>

        <Image src={brandImage("makka-po-footer.png")} style={styles.footer} fixed />
      </Page>
    </Document>
  );
}
