// PDF çıktılarında ortak: A4 sayfa (varsayılan yatay) ve gömülü Türkçe yazı tipi (yazitipi/OKUBENI.md)
import { jsPDF } from "jspdf";
import normal from "./yazitipi/CizelgeSans-Regular.ttf?inline";
import kalin from "./yazitipi/CizelgeSans-SemiBold.ttf?inline";

const base64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);

export function yeniPdf(yon: "landscape" | "portrait" = "landscape"): jsPDF {
  const doc = new jsPDF({ orientation: yon, unit: "mm", format: "a4" });
  doc.addFileToVFS("CizelgeSans-Regular.ttf", base64(normal));
  doc.addFont("CizelgeSans-Regular.ttf", "CizelgeSans", "normal");
  doc.addFileToVFS("CizelgeSans-SemiBold.ttf", base64(kalin));
  doc.addFont("CizelgeSans-SemiBold.ttf", "CizelgeSans", "bold");
  doc.setFont("CizelgeSans", "normal");
  return doc;
}
