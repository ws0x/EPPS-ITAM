import fs from "node:fs";
import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { PoPdfLetterhead } from "./purchase-order-pdf";

const BRAND_DIR = path.join(process.cwd(), "public", "brand");

// Read as a Buffer, not a path string: @react-pdf/image's local-file
// detection round-trips the src through url.parse() + path.resolve(), which
// mishandles Windows drive-letter paths. Passing a Buffer hits its
// isBuffer() fast path and skips that logic entirely - same fix already
// proven in purchase-order-pdf.tsx.
function brandImage(filename: string) {
  return fs.readFileSync(path.join(BRAND_DIR, filename));
}

const BROWN = "#3D1F12";

const styles = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 50, paddingHorizontal: 32, fontSize: 8.5, fontFamily: "Helvetica" },

  letterheadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    marginBottom: 12,
    borderBottom: `1.5pt solid ${BROWN}`,
    paddingBottom: 8,
  },
  logo: { width: 32, height: 32 },
  letterheadText: { alignItems: "flex-end" },
  letterheadNameLine1: { fontSize: 11, fontFamily: "Helvetica-Bold", color: BROWN, textAlign: "right" },
  letterheadNameLine2: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BROWN, textAlign: "right", marginTop: 1 },
  letterheadTagline: { fontSize: 7, fontFamily: "Helvetica-Oblique", color: BROWN, textAlign: "right", marginTop: 2 },

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  subtitle: { fontSize: 8, color: "#64748b", marginTop: 2 },

  table: { width: "100%" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", minHeight: 20, alignItems: "center" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", minHeight: 22, alignItems: "center" },

  colTag: { width: "15%", paddingHorizontal: 4 },
  colName: { width: "25%", paddingHorizontal: 4 },
  colCategory: { width: "15%", paddingHorizontal: 4 },
  colStatus: { width: "15%", paddingHorizontal: 4 },
  colLocation: { width: "15%", paddingHorizontal: 4 },
  colAssignee: { width: "15%", paddingHorizontal: 4 },

  headerText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#334155" },
  cellText: { fontSize: 8, color: "#334155" },

  footer: { position: "absolute", bottom: 24, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 6 },
  footerText: { fontSize: 7, color: "#94a3b8" },

  summary: { marginTop: 12, flexDirection: "row", justifyContent: "flex-end", gap: 16 },
  summaryText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#334155" },
});

type AssetRegisterData = {
  assets: {
    assetTag: string;
    name: string | null;
    category: string;
    status: string;
    location: string | null;
    assignedTo: string;
  }[];
  letterhead: PoPdfLetterhead;
  generatedAt: string;
  generatedBy: string;
};

export function AssetRegisterPdf({ data }: { data: AssetRegisterData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.letterheadRow}>
          <Image src={brandImage("EPPS-logo-mark.png")} style={styles.logo} />
          <View style={styles.letterheadText}>
            {data.letterhead.nameLine1 && <Text style={styles.letterheadNameLine1}>{data.letterhead.nameLine1}</Text>}
            {data.letterhead.nameLine2 && <Text style={styles.letterheadNameLine2}>{data.letterhead.nameLine2}</Text>}
            {data.letterhead.tagline && <Text style={styles.letterheadTagline}>{data.letterhead.tagline}</Text>}
          </View>
        </View>

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Asset Register</Text>
            <Text style={styles.subtitle}>Generated on {data.generatedAt} by {data.generatedBy}</Text>
          </View>
          <Text style={styles.subtitle}>{data.assets.length} assets</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <View style={styles.colTag}><Text style={styles.headerText}>ASSET TAG</Text></View>
            <View style={styles.colName}><Text style={styles.headerText}>NAME</Text></View>
            <View style={styles.colCategory}><Text style={styles.headerText}>CATEGORY</Text></View>
            <View style={styles.colStatus}><Text style={styles.headerText}>STATUS</Text></View>
            <View style={styles.colLocation}><Text style={styles.headerText}>LOCATION</Text></View>
            <View style={styles.colAssignee}><Text style={styles.headerText}>ASSIGNED TO</Text></View>
          </View>

          {data.assets.map((asset, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <View style={styles.colTag}><Text style={styles.cellText}>{asset.assetTag}</Text></View>
              <View style={styles.colName}><Text style={styles.cellText}>{asset.name || "-"}</Text></View>
              <View style={styles.colCategory}><Text style={styles.cellText}>{asset.category}</Text></View>
              <View style={styles.colStatus}><Text style={styles.cellText}>{asset.status}</Text></View>
              <View style={styles.colLocation}><Text style={styles.cellText}>{asset.location || "-"}</Text></View>
              <View style={styles.colAssignee}><Text style={styles.cellText}>{asset.assignedTo || "-"}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.summary} wrap={false}>
          <Text style={styles.summaryText}>Total Assets: {data.assets.length}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.letterhead.nameLine1 ?? "EPPS ITAM"} - Confidential
          </Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
