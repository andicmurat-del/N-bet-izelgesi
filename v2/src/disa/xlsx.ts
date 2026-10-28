// Kütüphanesiz .xlsx üretimi: sıkıştırmasız ZIP + sayfa XML'i. Yalnız gereken kadar: metin/sayı hücreleri,
// kalın başlık, gölgeli tatil sütunu ve sütun genişlikleri.

export type Hucre = string | number | null | { v: string | number; s?: Stil };
export type Stil = "baslik" | "kalin" | "tatil" | "baslikTatil" | "not";
export interface Sayfa { ad: string; satirlar: Hucre[][]; genislik?: number[]; dondur?: { satir: number; sutun: number } }

const STIL_NO: Record<Stil, number> = { baslik: 1, kalin: 2, tatil: 3, baslikTatil: 4, not: 5 };
const STILLER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3EEF0"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF6EBDD"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFB8C2CA"/></left><right style="thin"><color rgb="FFB8C2CA"/></right><top style="thin"><color rgb="FFB8C2CA"/></top><bottom style="thin"><color rgb="FFB8C2CA"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" xfId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/>
<xf numFmtId="0" xfId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" xfId="0" fontId="1" fillId="0" borderId="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" xfId="0" fontId="0" fillId="3" borderId="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" xfId="0" fontId="1" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" xfId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const xe = (t: string) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
export function sutunAdi(i: number): string { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

function sayfaXml(s: Sayfa): string {
  const cols = s.genislik?.length ? "<cols>" + s.genislik.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>" : "";
  const pane = s.dondur ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${s.dondur.sutun}" ySplit="${s.dondur.satir}" topLeftCell="${sutunAdi(s.dondur.sutun)}${s.dondur.satir + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>` : "";
  const rows = s.satirlar.map((satir, r) => `<row r="${r + 1}">` + satir.map((h, c) => {
    if (h === null || h === undefined || h === "") return "";
    const o = typeof h === "object" ? h : { v: h };
    const ref = sutunAdi(c) + (r + 1), st = o.s ? ` s="${STIL_NO[o.s]}"` : ` s="0"`;
    return typeof o.v === "number" ? `<c r="${ref}"${st}><v>${o.v}</v></c>` : `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xe(o.v)}</t></is></c>`;
  }).join("") + "</row>").join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(dosyalar: { ad: string; veri: string }[], tur: string): Blob {
  const enc = new TextEncoder(), parca: Uint8Array[] = [], merkez: Uint8Array[] = [];
  let ofs = 0;
  const w16 = (a: number[], v: number) => a.push(v & 255, (v >>> 8) & 255);
  const w32 = (a: number[], v: number) => a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
  for (const f of dosyalar) {
    const ad = enc.encode(f.ad), veri = enc.encode(f.veri), crc = crc32(veri);
    const lh: number[] = []; w32(lh, 0x04034b50); w16(lh, 20); w16(lh, 0x0800); w16(lh, 0); w16(lh, 0); w16(lh, 0x21); w32(lh, crc); w32(lh, veri.length); w32(lh, veri.length); w16(lh, ad.length); w16(lh, 0);
    parca.push(new Uint8Array(lh), ad, veri);
    const ch: number[] = []; w32(ch, 0x02014b50); w16(ch, 20); w16(ch, 20); w16(ch, 0x0800); w16(ch, 0); w16(ch, 0); w16(ch, 0x21); w32(ch, crc); w32(ch, veri.length); w32(ch, veri.length); w16(ch, ad.length); w16(ch, 0); w16(ch, 0); w16(ch, 0); w16(ch, 0); w32(ch, 0); w32(ch, ofs);
    merkez.push(new Uint8Array(ch), ad);
    ofs += lh.length + ad.length + veri.length;
  }
  const msz = merkez.reduce((t, x) => t + x.length, 0);
  const son: number[] = []; w32(son, 0x06054b50); w16(son, 0); w16(son, 0); w16(son, dosyalar.length); w16(son, dosyalar.length); w32(son, msz); w32(son, ofs); w16(son, 0);
  return new Blob([...parca, ...merkez, new Uint8Array(son)] as BlobPart[], { type: tur });
}

export function xlsxKitap(sayfalar: Sayfa[]): Blob {
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sayfalar.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    sayfalar.map((s, i) => `<sheet name="${xe(s.ad.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + `</sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sayfalar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
    `<Relationship Id="rId${sayfalar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return zip([
    { ad: "[Content_Types].xml", veri: ct },
    { ad: "_rels/.rels", veri: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { ad: "xl/workbook.xml", veri: wb },
    { ad: "xl/_rels/workbook.xml.rels", veri: rels },
    { ad: "xl/styles.xml", veri: STILLER },
    ...sayfalar.map((s, i) => ({ ad: `xl/worksheets/sheet${i + 1}.xml`, veri: sayfaXml(s) })),
  ], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
