export const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const GUN_UZUN = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export const gunSayisi = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** 0 = Pazartesi … 6 = Pazar */
export const haftaGunu = (y: number, m: number, d: number) => (new Date(y, m, d).getDay() + 6) % 7;
export const haftaSonuMu = (y: number, m: number, d: number) => haftaGunu(y, m, d) >= 5;
export const gunAnahtari = (y: number, m: number, d: number) => `${y}-${m}-${d}`;
export const ayAnahtari = (y: number, m: number) => `${y}-${m}`;
export const tercihAnahtari = (id: number, y: number, m: number, d: number) => `${id}-${y}-${m}-${d}`;
export const ayEkle = (y: number, m: number, k: number) => { const t = new Date(y, m + k, 1); return { y: t.getFullYear(), m: t.getMonth() }; };
export const ayAdi = (y: number, m: number) => `${AYLAR[m]} ${y}`;
export const isoTarih = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** "12 Kasım Perşembe" */
export const gunMetni = (y: number, m: number, d: number) => `${d} ${AYLAR[m]} ${GUN_UZUN[haftaGunu(y, m, d)]}`;

/** Ekranda "Zeynep Demir" biçimi; yazılış ne olursa olsun Türkçe büyük/küçük harf kuralıyla. */
export function gorunenAd(ad: string): string {
  return String(ad || "").trim().replace(/\s+/g, " ").split(/([\s\-'’.]+)/)
    .map(w => /[AEIİOÖUÜaeıioöuü]/.test(w) ? w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1).toLocaleLowerCase("tr-TR") : w)
    .join("");
}
/** Dar takvim hücresi için kısa ad: ad; aynı adı taşıyan başka kişi varsa soyadının baş harfi de ("Ayşe Y.") */
export function kisaAd(ad: string, tumAdlar: string[]): string {
  const p = String(ad || "").trim().split(/\s+/), ilk = p[0] || "";
  const ayni = tumAdlar.filter(x => String(x || "").trim().split(/\s+/)[0] === ilk).length > 1;
  return ayni && p.length > 1 ? `${ilk} ${p[p.length - 1].charAt(0)}.` : ilk;
}
export const buyukAd = (ad: string) => String(ad || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
/** aynı ad denetimi için: boşluklar sadeleşir, Türkçe büyük/küçük harf farkı yok sayılır */
export const adAnahtari = (ad: string) => String(ad || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
/** arama için: Türkçe harfler sadeleşir ("sahin" "Şahin"i, "isik" "Işık"ı bulur) */
export const aramaAnahtari = (t: string) => adAnahtari(t).replace(/[şğıöüçâîû]/g, h => ({ ş: "s", ğ: "g", ı: "i", ö: "o", ü: "u", ç: "c", â: "a", î: "i", û: "u" })[h] ?? h).normalize("NFD").replace(/[̀-ͯ]/g, "");
/** ad, aranan metni içeriyor mu (Türkçe harfler sadeleşmiş) */
export const adIcerir = (ad: string, aranan: string) => aramaAnahtari(ad).includes(aramaAnahtari(aranan));
