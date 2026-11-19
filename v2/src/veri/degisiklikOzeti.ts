// Değişiklik geçmişi için iki veri hâli arasındaki farkın okunur özeti ("Kasım 2026 çizelgesi: 3 gün değişti",
// "Personel: Dila Şahin eklendi"…). Durumdan bağımsız; servis dağıtımının kendiliğinden yenilenen kaydı sayılmaz.
import type { Veri } from "./tipler";
import { AYLAR } from "./tarih";

const ayAdi = (ayK: string) => {
  const [y, m] = ayK.split("-").map(Number);
  return `${AYLAR[m] ?? "?"} ${y}`;
};
const haftaAdi = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${AYLAR[m - 1] ?? "?"} ${y} haftası`;
};
const json = (x: unknown) => JSON.stringify(x ?? null);
/** "yil-ay-gun" ya da "id-yil-ay-gun" anahtarlarından "yil-ay" */
const ayOf = (k: string, onekli: boolean) => {
  const p = k.split("-");
  return onekli ? `${p[1]}-${p[2]}` : `${p[0]}-${p[1]}`;
};
/** iki kayıt nesnesinde değişen anahtarlar */
function farkliAnahtarlar<T>(a: Record<string, T> | undefined, b: Record<string, T> | undefined): string[] {
  const l = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...l].filter(k => json(a?.[k]) !== json(b?.[k]));
}
/** ay ay sayım: "Kasım 2026: 3, Aralık 2026: 1" */
const ayAy = (anahtarlar: string[], onekli: boolean) => {
  const say = new Map<string, number>();
  for (const k of anahtarlar) say.set(ayOf(k, onekli), (say.get(ayOf(k, onekli)) ?? 0) + 1);
  return [...say]
    .sort((p, q) => p[0].localeCompare(q[0], "tr", { numeric: true }))
    .map(([ayK, n]) => `${ayAdi(ayK)}: ${n}`)
    .join(", ");
};

/** önce → sonra arasındaki değişikliklerin satır satır özeti (değişiklik yoksa boş) */
export function degisiklikOzeti(once: Veri, sonra: Veri): string[] {
  const l: string[] = [];
  // personel
  const oncekiKisi = new Map(once.staff.map(k => [k.id, k])),
    sonrakiKisi = new Map(sonra.staff.map(k => [k.id, k]));
  for (const k of sonra.staff) {
    const o = oncekiKisi.get(k.id);
    if (!o) l.push(`Personel: ${k.name} eklendi`);
    else if (json(o) !== json(k)) l.push(`Personel: ${k.name} bilgileri değişti`);
  }
  for (const k of once.staff) if (!sonrakiKisi.has(k.id)) l.push(`Personel: ${k.name} silindi`);
  // çizelgeler
  for (const ayK of farkliAnahtarlar(once.schedules, sonra.schedules)) {
    const a = once.schedules[ayK],
      b = sonra.schedules[ayK];
    if (!a) l.push(`${ayAdi(ayK)} nöbet çizelgesi oluşturuldu`);
    else if (!b) l.push(`${ayAdi(ayK)} nöbet çizelgesi silindi`);
    else {
      const gun = b.days.filter((g, i) => json(g) !== json(a.days[i])).length;
      if (!a.onay && b.onay) l.push(`${ayAdi(ayK)} nöbet çizelgesi onaylandı`);
      else if (a.onay && !b.onay) l.push(`${ayAdi(ayK)} nöbet çizelgesinin onayı kaldırıldı`);
      if (gun && b.olusturma !== a.olusturma) l.push(`${ayAdi(ayK)} nöbet çizelgesi yeniden oluşturuldu`);
      else if (gun) l.push(`${ayAdi(ayK)} nöbet çizelgesi: ${gun} gün elle değişti`);
    }
  }
  // izinler, tatiller, puantaj
  const tercih = farkliAnahtarlar(once.prefs, sonra.prefs);
  if (tercih.length) l.push(`İzin ve tercih işaretleri (${ayAy(tercih, true)})`);
  const tatil = [...farkliAnahtarlar(once.manualTatil, sonra.manualTatil), ...farkliAnahtarlar(once.arife, sonra.arife)];
  if (tatil.length) l.push(`Resmi tatil / arife işaretleri (${ayAy(tatil, false)})`);
  for (const ayK of farkliAnahtarlar(once.puantaj, sonra.puantaj)) {
    const a = once.puantaj[ayK] ?? {},
      b = sonra.puantaj[ayK] ?? {};
    let n = 0;
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) n += farkliAnahtarlar(a[id], b[id]).length;
    l.push(`${ayAdi(ayK)} puantajı: ${n} hücre`);
  }
  const yeniDegisim = sonra.degisimler.filter(d => !once.degisimler.some(x => x.id === d.id));
  for (const d of yeniDegisim.slice(0, 5)) {
    const ad = (id: number) => sonra.staff.find(k => k.id === id)?.name ?? d.cikAd;
    l.push(
      `${d.gun} ${AYLAR[d.m]} ${d.y}: ${d.gorev === "H" ? "hazırlama" : "nöbet"} ${ad(d.cik)} → ${d.yerAd || ad(d.yer)}${d.sebep ? " (izin / rapor)" : ""}`,
    );
  }
  if (yeniDegisim.length > 5) l.push(`… ve ${yeniDegisim.length - 5} değişim daha`);
  const geriAlinan = once.degisimler.filter(d => !sonra.degisimler.some(x => x.id === d.id)).length;
  if (geriAlinan) l.push(`Nöbet değişimi geri alındı: ${geriAlinan}`);
  // acil, öğlen, onay listesi
  for (const ayK of farkliAnahtarlar(once.acil, sonra.acil)) {
    const n = farkliAnahtarlar(once.acil[ayK], sonra.acil[ayK]).length;
    l.push(
      !once.acil[ayK]
        ? `${ayAdi(ayK)} acil listesi oluşturuldu`
        : !sonra.acil[ayK]
          ? `${ayAdi(ayK)} acil listesi silindi`
          : `${ayAdi(ayK)} acil listesi: ${n} gün`,
    );
  }
  for (const ayK of farkliAnahtarlar(once.oglen, sonra.oglen))
    l.push(`${ayAdi(ayK)} öğlen nöbeti: ${farkliAnahtarlar(once.oglen[ayK], sonra.oglen[ayK]).length} gün`);
  for (const [tur, ad] of [
    ["acil", "acil listesi"],
    ["oglen", "öğlen nöbeti"],
    ["onay", "onay listesi"],
  ] as const)
    for (const k of farkliAnahtarlar(once.listeOnay[tur], sonra.listeOnay[tur])) {
      const zaman = tur === "acil" ? ayAdi(k) : haftaAdi(k);
      l.push(`${zaman} ${ad} ${sonra.listeOnay[tur][k] ? "onaylandı" : "onayı kaldırıldı"}`);
    }
  if (json(once.onayMasa) !== json(sonra.onayMasa)) l.push("Onay listesi masaları elle değişti");
  // ayarlar
  const ayar = farkliAnahtarlar(once.settings as unknown as Record<string, unknown>, sonra.settings as unknown as Record<string, unknown>);
  if (ayar.length) l.push(`Ayarlar: ${ayar.join(", ")}`);
  if (json(once.kurum) !== json(sonra.kurum)) l.push("Kurum bilgileri");
  if (json(once.servisAyar) !== json(sonra.servisAyar)) l.push("Servis listesi ayarları");
  return l;
}
