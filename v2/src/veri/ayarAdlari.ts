// Ayarların okunur adları ve değerleri (değişiklik geçmişi, ayar önizlemesi).
import type { Ayarlar } from "./tipler";

export const AYAR_ADI: Record<keyof Ayarlar, string> = {
  minAra: "iki nöbet arası en az gün",
  acilMinAra: "acil: iki nöbet arası en az gün",
  destekAylik: "destek personeli aylık hazırlama",
  arifeSaat: "arife günü mesaisi (saat)",
  nobetSuresi: "nöbet süresi (saat)",
  mesai: "günlük mesai (saat)",
  hazSaat: "hazırlama süresi (saat)",
  maxThu: "ayda en fazla Perşembe nöbeti",
  hsUst: "ayda en fazla hafta sonu nöbeti",
  thuHaftaSonu: "Perşembe nöbetçisi aynı hafta sonu görev almasın",
  cumaEsles: "Cuma ile hafta sonu nöbeti eşleşsin",
  hsTopla: "hafta sonu tek kişide toplanabilsin",
  fmHedef: "elle düzenlemede fazla mesai sapma uyarısı (saat)",
  niDusum: "nöbet izninin düşüldüğü dilim",
  acilArdArda: "acil: kadro yetmezse art arda nöbet",
  oglenHE: "öğlen nöbeti Pzt–Per eczacı",
  oglenHT: "öğlen nöbeti Pzt–Per tekniker",
  oglenCE: "öğlen nöbeti Cuma eczacı",
  oglenCT: "öğlen nöbeti Cuma tekniker",
  tatilOtomatik: "resmi tatiller kendiliğinden işaretlensin",
};
/** ayar değerinin okunur hâli */
export function ayarDegeri(k: keyof Ayarlar, v: unknown): string {
  if (typeof v === "boolean") return v ? "açık" : "kapalı";
  if (k === "maxThu" && Number(v) >= 99) return "sınırsız";
  if (k === "niDusum") return Number(v) === 2 ? "20:00–08:00" : "08:00–20:00";
  return String(v);
}
/** iki ayar takımı arasında değişenler: "iki nöbet arası en az gün 3 → 4" */
export function ayarFarklari(a: Partial<Ayarlar>, b: Partial<Ayarlar>): { k: keyof Ayarlar; metin: string }[] {
  const l: { k: keyof Ayarlar; metin: string }[] = [];
  for (const k of Object.keys({ ...a, ...b }) as (keyof Ayarlar)[])
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k]))
      l.push({ k, metin: `${AYAR_ADI[k] ?? k} ${ayarDegeri(k, a[k])} → ${ayarDegeri(k, b[k])}` });
  return l;
}
