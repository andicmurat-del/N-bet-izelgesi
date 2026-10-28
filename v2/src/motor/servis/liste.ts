// Servis listesi: varsayılan servisler (zorluk, hazırlama gün sayısı, hasta sayısı), aynı kişiye aynı gün verilmeyecek
// gruplar ve kayıtlı ayarlarla (zorluk, hasta, çok günlük, hazırlanıyor mu) birleştirilmiş güncel liste.

/** eski kısa adlar → ekranda görünen adlar */
const AD_DEGISIKLIGI: Record<string, string> = { "2.BAS 10 YATAK YB": "+10 YATAK YB", "2.BAS 8 YATAK YB": "+8 YATAK YB", "2.BAS KORONER YB": "KORONER YB", "3.BAS GENEL YB": "CERRAHİ YB", "NÖR YB": "NÖROLOJİ YB", "BEYİN CER": "BEYİN CERRAHİ", "CERRAHİ-A": "GENEL CERRAHİ-A", "CERRAHİ-B": "GENEL CERRAHİ-B", "ÇOCUK CER": "ÇOCUK CERRAHİ", "ÇOCUK HAST.": "ÇOCUK HASTALIKLARI", "DAHİLİYE H": "DAHİLİYE-H", "FİZİK": "FİZİK TEDAVİ", "GÖĞÜS A": "GÖĞÜS-A", "GÖĞÜS CER": "GÖĞÜS CERRAHİ", "İNTANİYE+GERİATRİ": "İNTANİYE", "KADIN": "KADIN HASTALIKLARI", "KBB+PLASTİK": "KBB/PLASTİK", "KRONİK YARA": "KRONİK YARA BAKIM", "PALYATİF BKM": "PALYATİF BAKIM", "PSK": "PSİKİYATRİ", "RADYASYON": "RADYASYON ONKOLOJİ" };

/** [kısa ad, zorluk (10 üzerinden), hazırlama gün sayısı (1'den fazlaysa çok günlük), hasta sayısı] */
const VARSAYILAN: [string, number, number, number][] = [
  ["2.BAS 10 YATAK YB", 6, 1, 10], ["2.BAS 8 YATAK YB", 5, 1, 8], ["2.BAS KORONER YB", 6, 1, 10], ["GÖĞÜS-2 YB", 5, 1, 10],
  ["3.BAS GENEL YB", 5, 1, 10], ["ANJİO YB", 5, 1, 10], ["ARS YB", 6, 1, 10], ["BEYİN CER", 8, 3, 25], ["CERRAHİ-A", 8, 1, 25],
  ["CERRAHİ-B", 8, 1, 25], ["ÇOCUK CER", 3, 3, 10], ["ÇOCUK HAST.", 3, 3, 10], ["ÇYB-2 YB", 3, 1, 5], ["ÇYB-3 YB", 3, 1, 5],
  ["DAHİLİYE H", 8, 3, 25], ["DAHİLİYE-G", 8, 3, 25], ["DOĞUM-G", 4, 1, 15], ["DOĞUM-H", 4, 1, 15], ["EYB-1 YB", 8, 1, 10],
  ["EYB-2 YB", 8, 1, 10], ["EYB-3 YB", 7, 1, 10], ["EYB-4 YB", 6, 1, 10], ["FİZİK", 2, 3, 10], ["GÖĞÜS A", 10, 3, 25],
  ["GÖĞÜS CER", 7, 3, 20], ["GÖĞÜS-1 YB", 3, 1, 10], ["GÖĞÜS-C", 9, 3, 25], ["GÖĞÜS-D", 9, 3, 25],
  ["GÖZ", 1, 1, 2], ["İNME YB", 2, 1, 6], ["İNTANİYE+GERİATRİ", 7, 3, 20], ["KADIN", 2, 1, 10], ["KALP DAMAR", 6, 3, 20],
  ["KARDİYOLOJİ-C", 7, 1, 20], ["KARDİYOLOJİ-D", 7, 1, 20], ["KBB+PLASTİK", 5, 3, 10], ["KRONİK YARA", 10, 3, 25],
  ["KVC YB", 7, 1, 10], ["MAHKUM", 1, 1, 1], ["NEFROLOJİ", 10, 3, 25], ["NÖR YB", 6, 1, 10], ["NÖROLOJİ-E", 7, 3, 20],
  ["NÖROLOJİ-F", 7, 3, 20], ["ORTOPEDİ-E", 7, 3, 20], ["ORTOPEDİ-F", 7, 3, 20], ["ORTOPEDİ-G", 7, 3, 20],
  ["PALYATİF BKM", 10, 3, 25], ["PSK", 1, 1, 3], ["RADYASYON", 6, 3, 15], ["TBC", 2, 1, 4], ["TDL", 2, 1, 5],
  ["ÜROLOJİ", 5, 3, 20], ["YANIK", 5, 3, 15], ["YANIK YB", 2, 1, 2], ["YENİDOĞAN YB", 5, 1, 15],
];
/** Aynı kişiye aynı gün verilmeyecek servis grupları (kısa adlarla) */
const GRUPLAR = [
  ["CERRAHİ-A", "CERRAHİ-B"],
  ["ORTOPEDİ-E", "ORTOPEDİ-F", "ORTOPEDİ-G"],
  ["EYB-1 YB", "EYB-2 YB", "EYB-3 YB", "EYB-4 YB"],
  ["NÖROLOJİ-E", "NÖROLOJİ-F"],
  ["DAHİLİYE-G", "DAHİLİYE H"],
  ["GÖĞÜS A", "GÖĞÜS-C", "GÖĞÜS-D"],
  ["KARDİYOLOJİ-C", "KARDİYOLOJİ-D"],
  ["NEFROLOJİ", "PALYATİF BKM", "GÖĞÜS A", "GÖĞÜS-C"],
];

export interface Servis {
  id: number; name: string; kod?: string;
  /** zorluk (10 üzerinden), hasta sayısı, çok günlük mü (tatil öncesi gün tatil günleri için de hazırlanır) */
  z: number; h: number; multi: boolean;
  /** hazırlanıyor mu (Servisler ekranında işaret) */
  on: boolean;
  /** varsayılan değerler */
  z0: number; h0: number; multi0: boolean;
  /** gruplar (GRUPLAR sırası) */
  grps: number[];
  ekstra?: boolean;
}

const VARSAYILAN_SERVISLER = VARSAYILAN.map(([kod, z, g, h], i) => ({ id: i, name: AD_DEGISIKLIGI[kod] || kod, kod, z, h, multi: g > 1, grps: [] as number[] }));
GRUPLAR.forEach((adlar, gi) => adlar.forEach(n => { const sv = VARSAYILAN_SERVISLER.find(x => x.kod === n); if (sv) sv.grps.push(gi); }));

/** zor servis: zorluk puanı ZOR_ESIK ve üstü (10 üzerinden). Her gün kişi başı zor servis sayısı en fazla 1 farklı
 *  olur (kesin); ay içinde kişi başı zor servis sayısı eşitlenir. */
export const ZOR_ESIK = 7;
export const zorMu = (s: { z: number } | undefined | null) => (s && s.z >= ZOR_ESIK ? 1 : 0);
/** adı "YB" ile biten servis yoğun bakım sayılır */
export const ybMi = (sn: string) => /\sYB$/.test(sn);

export interface ServisAyari { svc?: Record<string, { z?: number; h?: number; multi?: boolean; on?: boolean }>; ekstra?: { name: string; z?: number; h?: number; multi?: boolean }[] }

/** varsayılanlar + elle eklenenler, kayıtlı ayarlarla */
export function servisleriKur(ayar: unknown): Servis[] {
  const A = (ayar && typeof ayar === "object" ? ayar : {}) as ServisAyari;
  const svc = A.svc && typeof A.svc === "object" ? A.svc : {};
  const liste: Servis[] = VARSAYILAN_SERVISLER.map(s => ({ ...s, grps: s.grps.slice(), z0: s.z, h0: s.h, multi0: s.multi, on: true }));
  (Array.isArray(A.ekstra) ? A.ekstra : []).forEach(e => {
    if (!e || !e.name || liste.some(x => x.name === e.name)) return;
    liste.push({ id: 0, name: String(e.name), z0: Number(e.z) || 1, h0: Number(e.h) || 0, multi0: !!e.multi, z: 1, h: 0, multi: false, grps: [], ekstra: true, on: true });
  });
  liste.forEach((x, i) => { x.id = i; });
  liste.forEach(s => {
    const k = svc[s.name] || {};
    s.z = Number.isFinite(k.z) && (k.z as number) >= 1 ? Math.min(10, k.z as number) : s.z0;
    s.h = Number.isFinite(k.h) && (k.h as number) >= 0 ? (k.h as number) : s.h0;
    s.multi = typeof k.multi === "boolean" ? k.multi : s.multi0;
    s.on = typeof k.on === "boolean" ? k.on : true;
  });
  return liste;
}
