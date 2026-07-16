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

const BROWN = "#3D1F12";
const TAN = "#D4B896";

const styles = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 60, paddingHorizontal: 32, fontSize: 9, fontFamily: "Helvetica" },

  // Header: logo fixed-size on the left, name/tagline block on the right —
  // both vertically centered in one fixed-height row so they read as equally
  // aligned regardless of how much text the name/tagline block has.
  letterheadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    marginBottom: 14,
    borderBottom: `1.5pt solid ${BROWN}`,
    paddingBottom: 10,
  },
  logo: { width: 36, height: 36 },
  letterheadText: { alignItems: "flex-end" },
  letterheadNameLine1: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BROWN, textAlign: "right" },
  letterheadNameLine2: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BROWN, textAlign: "right", marginTop: 1 },
  letterheadTagline: { fontSize: 7.5, fontFamily: "Helvetica-Oblique", color: BROWN, textAlign: "right", marginTop: 3 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, gap: 8 },
  headerBox: { border: `1pt solid ${BROWN}`, borderRadius: 3, padding: 6, flex: 1 },
  headerLabel: { fontSize: 7, color: BROWN, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  headerValue: { fontSize: 9, marginBottom: 3 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    backgroundColor: BROWN,
    padding: 4,
    marginBottom: 6,
  },
  supplierGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  supplierBox: { width: "48%" },
  supplierRow: { flexDirection: "row", marginBottom: 2 },
  supplierLabel: { width: 60, fontFamily: "Helvetica-Bold" },

  table: { marginTop: 4, marginBottom: 12 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: TAN, paddingVertical: 5, paddingHorizontal: 3 },
  tableRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 3, borderBottom: `0.5pt solid ${TAN}` },
  // Every data/header cell shares this base: small readable font + a right
  // gutter so adjacent columns never visually touch (the "QTYBENEFICIARY
  // CO." crowding came from cells having zero gap between them).
  cell: { fontSize: 6, paddingRight: 6 },
  cellHeader: { fontSize: 6, fontFamily: "Helvetica-Bold", paddingRight: 6 },
  colNum: { width: "3%" },
  colCode: { width: "10%" },
  colDesc: { width: "22%" },
  colUnit: { width: "6%" },
  colPrice: { width: "10%", textAlign: "right" },
  colQty: { width: "6%", textAlign: "right" },
  colBenCompany: { width: "12%" },
  colBenDept: { width: "12%" },
  colBenEmployee: { width: "9%" },
  colTotal: { width: "10%", textAlign: "right", paddingRight: 0 },

  totalsBox: { alignSelf: "flex-end", width: "40%", marginBottom: 16 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTop: `1pt solid ${BROWN}`,
    marginTop: 2,
    fontFamily: "Helvetica-Bold",
  },
  termsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  termsBox: { width: "31%" },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  signatureBox: { width: "45%", borderTop: `1pt solid ${BROWN}`, paddingTop: 4, textAlign: "center" },

  // Footer: native text rows instead of a pixel image, so it can never
  // overflow the page or clip on the right — width always matches the
  // printable area because it's the same flex row the rest of the page uses.
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    borderTop: `0.75pt solid ${TAN}`,
    paddingTop: 6,
  },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2, width: "100%" },
  footerCell: { fontSize: 6.5, color: BROWN, textAlign: "center", flex: 1 },
  footerAddress: { fontSize: 6.5, color: BROWN, textAlign: "center", marginTop: 2, width: "100%" },
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

export type PoPdfLetterhead = {
  logoUrl: string | null;
  nameLine1: string | null;
  nameLine2: string | null;
  tagline: string | null;
  officePhone: string | null;
  mobilePhone: string | null;
  fax: string | null;
  emails: string | null;
  website: string | null;
  address: string | null;
};

export type PoPdfOrder = {
  poNumber: string;
  date: string;
  prNumber: string | null;
  quotationNumber: string | null;
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

export function PurchaseOrderPdf({
  order,
  lines,
  letterhead,
}: {
  order: PoPdfOrder;
  lines: PoPdfLine[];
  letterhead: PoPdfLetterhead;
}) {
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
        <View style={styles.letterheadRow}>
          <Image src={brandImage("makka-logo-mark.png")} style={styles.logo} />
          <View style={styles.letterheadText}>
            {letterhead.nameLine1 && <Text style={styles.letterheadNameLine1}>{letterhead.nameLine1}</Text>}
            {letterhead.nameLine2 && <Text style={styles.letterheadNameLine2}>{letterhead.nameLine2}</Text>}
            {letterhead.tagline && <Text style={styles.letterheadTagline}>{letterhead.tagline}</Text>}
          </View>
        </View>

        <View style={styles.headerRow}>
          <View style={styles.headerBox}>
            <Text style={styles.headerLabel}>PO NO.</Text>
            <Text style={styles.headerValue}>{order.poNumber}</Text>
          </View>
          <View style={styles.headerBox}>
            <Text style={styles.headerLabel}>DATE</Text>
            <Text style={styles.headerValue}>{order.date}</Text>
          </View>
          <View style={styles.headerBox}>
            <Text style={styles.headerLabel}>QUOTATION / RFQ NO.</Text>
            <Text style={styles.headerValue}>{order.quotationNumber ?? "—"}</Text>
          </View>
        </View>

        {order.prNumber && (
          <View style={[styles.headerRow, { marginTop: -6 }]}>
            <View style={styles.headerBox}>
              <Text style={styles.headerLabel}>PR NO.</Text>
              <Text style={styles.headerValue}>{order.prNumber}</Text>
            </View>
          </View>
        )}

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
            <Text style={[styles.colNum, styles.cellHeader]}>#</Text>
            <Text style={[styles.colCode, styles.cellHeader]}>ITEM CODE</Text>
            <Text style={[styles.colDesc, styles.cellHeader]}>DESCRIPTION</Text>
            <Text style={[styles.colUnit, styles.cellHeader]}>UNIT</Text>
            <Text style={[styles.colPrice, styles.cellHeader]}>PRICE (EGP)</Text>
            <Text style={[styles.colQty, styles.cellHeader]}>QTY</Text>
            <Text style={[styles.colBenCompany, styles.cellHeader]}>BENEFICIARY CO.</Text>
            <Text style={[styles.colBenDept, styles.cellHeader]}>BENEFICIARY DEPT.</Text>
            <Text style={[styles.colBenEmployee, styles.cellHeader]}>EMPLOYEE</Text>
            <Text style={[styles.colTotal, styles.cellHeader]}>TOTAL (EGP)</Text>
          </View>
          {lines.map((line) => (
            <View style={styles.tableRow} key={line.lineNumber}>
              <Text style={[styles.colNum, styles.cell]}>{line.lineNumber}</Text>
              <Text style={[styles.colCode, styles.cell]}>{line.itemCode ?? "—"}</Text>
              <Text style={[styles.colDesc, styles.cell]}>{line.description}</Text>
              <Text style={[styles.colUnit, styles.cell]}>{line.unit ?? "—"}</Text>
              <Text style={[styles.colPrice, styles.cell]}>
                {Number(line.unitPrice).toLocaleString("en-EG", { minimumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.colQty, styles.cell]}>{line.quantity}</Text>
              <Text style={[styles.colBenCompany, styles.cell]}>{line.beneficiaryCompany}</Text>
              <Text style={[styles.colBenDept, styles.cell]}>{line.beneficiaryDepartment}</Text>
              <Text style={[styles.colBenEmployee, styles.cell]}>{line.beneficiaryEmployee ?? "—"}</Text>
              <Text style={[styles.colTotal, styles.cell]}>
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

        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            {letterhead.officePhone && <Text style={styles.footerCell}>Tel: {letterhead.officePhone}</Text>}
            {letterhead.mobilePhone && <Text style={styles.footerCell}>Mobile: {letterhead.mobilePhone}</Text>}
            {letterhead.fax && <Text style={styles.footerCell}>Fax: {letterhead.fax}</Text>}
          </View>
          <View style={styles.footerRow}>
            {letterhead.emails && <Text style={styles.footerCell}>Email: {letterhead.emails}</Text>}
            {letterhead.website && <Text style={styles.footerCell}>Web: {letterhead.website}</Text>}
          </View>
          {letterhead.address && <Text style={styles.footerAddress}>{letterhead.address}</Text>}
        </View>
      </Page>
    </Document>
  );
}
