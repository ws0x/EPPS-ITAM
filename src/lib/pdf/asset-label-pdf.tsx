import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

export type AssetLabelData = {
  assetTag: string;
  name: string | null;
  modelName: string;
  qrDataUrl: string;
};

const styles = StyleSheet.create({
  page: { padding: 18, fontFamily: "Helvetica" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  label: {
    width: "33.33%",
    height: 110,
    padding: 8,
    border: "0.75pt dashed #999999",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qr: { width: 68, height: 68 },
  info: { flex: 1, minWidth: 0 },
  assetTag: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 2 },
  modelName: { fontSize: 7, color: "#444444", marginBottom: 1 },
  name: { fontSize: 7, color: "#666666" },
});

/**
 * A dashed-border cutting guide grid, 3 per row - simple and printer-agnostic
 * rather than targeting a specific Avery SKU, since the physical label stock
 * this prints onto isn't specified. Each label's QR encodes a link straight
 * to that asset's detail page, for a phone scan during a walk-through audit.
 */
export function AssetLabelPdf({ labels }: { labels: AssetLabelData[] }) {
  return (
    <Document title="Asset Labels">
      <Page size="A4" style={styles.page}>
        <View style={styles.grid}>
          {labels.map((label, i) => (
            <View key={`${label.assetTag}-${i}`} style={styles.label}>
              <Image src={label.qrDataUrl} style={styles.qr} />
              <View style={styles.info}>
                <Text style={styles.assetTag}>{label.assetTag}</Text>
                <Text style={styles.modelName}>{label.modelName}</Text>
                {label.name && <Text style={styles.name}>{label.name}</Text>}
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
