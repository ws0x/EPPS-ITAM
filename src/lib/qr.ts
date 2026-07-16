import "server-only";
import QRCode from "qrcode";

/** PNG data URI - @react-pdf/renderer's <Image> accepts this as `src` directly. */
export async function assetQrDataUrl(assetId: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${appUrl}/assets/${assetId}`;
  return QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" });
}
