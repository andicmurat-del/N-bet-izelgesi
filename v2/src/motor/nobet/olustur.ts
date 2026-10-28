// Bir ayın nöbet çizelgesini oluşturur. Adımlar:
//  1. ilk yerleştirme (açgözlü, gün gün)        → ilkYerlestirme.ts
//  2. tatil günlerinin hazırlama personeli        → hazirlama.ts
//  3. yerel arama (amaç fonksiyonu en aza)        → arama.ts, amac.ts, kurallar.ts
//  4. kural esnetilen günler ve uyarılar          → uyarilar.ts
import { gorevli, type Baglam, type MotorGunu } from "../baglam";
import { ayBilgisi, nobetKadrosu } from "./ay";
import { amacKur } from "./amac";
import { yerelArama } from "./arama";
import { hazirlamaAta } from "./hazirlama";
import { ilkYerlestirme } from "./ilkYerlestirme";
import { kurallarKur } from "./kurallar";
import { aramaKur } from "./kurulum";
import { ayGecmisi, gunleriIsaretle, uyarilariYaz } from "./uyarilar";

export interface CizelgeSonucu {
  days: MotorGunu[] | null;
  warnings: string[];
  /** kişi başı gün kategorisi sayıları */
  history: Record<number, { haftaici: number; cuma: number; cumartesi: number; pazar: number }> | null;
}

/** varyasyon: "farklı dağılım" (eşitlerde kişi sırası ve arama tohumu değişir); simdi: aramanın süre sınırı için saat */
export function cizelgeUret(B: Baglam, y: number, m: number, varyasyon: number, simdi: () => number): CizelgeSonucu {
  const { eczacilar, teknisyenler } = nobetKadrosu(B, y, m);
  if (eczacilar.length + teknisyenler.length < 2) {
    return { days: null, warnings: ["Toplam personel sayısı günde 2 kişi için yetersiz."], history: null };
  }
  const A = ayBilgisi(B, y, m, varyasyon, eczacilar, teknisyenler);
  const days = ilkYerlestirme(A);
  const K = aramaKur(A, days);
  const kural = kurallarKur(K);
  hazirlamaAta(K, kural);
  yerelArama(K, kural, amacKur(K, kural), simdi);
  // aramada aynı kişi nesnesi birden çok günde kullanılır; sonuçta her gün kendi kopyasını taşısın
  days.forEach(d => { if (!d.locked) { d.assigned = d.assigned.map(gorevli); d.prep = d.prep.map(gorevli); } });
  gunleriIsaretle(K, kural);
  return { days, warnings: uyarilariYaz(K, kural), history: ayGecmisi(K) };
}
