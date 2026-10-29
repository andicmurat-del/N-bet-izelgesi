// Motorun kuralları ve ağırlıkları: tek yerde, öncelik sırasıyla.

/** Ayarların varsayılan değerleri. Ayarlar ekranında nöbetler arası en az gün, destek personeli aylık hazırlama,
 *  arife saati ve çakışma önceliği değiştirilebilir; AYAR_GIZLI'dakiler her zaman varsayılan değerinde çalışır. */
export const AYAR_VARSAYILAN = { nobetSuresi: 24, mesai: 8, arifeSaat: 3, hazSaat: 8, fmHedef: 8, minAra: 3, maxThu: 1, hsTercih: 1, hsUst: 2, cumaEsles: true, thuHaftaSonu: true, destekAylik: 2, cakismaOncelik: 1, niDusum: 1, kurumAdi: "", onaylayan: "" };
export type AyarAdi = keyof typeof AYAR_VARSAYILAN;
export const AYAR_GIZLI = new Set<AyarAdi>(["niDusum", "nobetSuresi", "mesai", "hazSaat", "fmHedef", "maxThu", "thuHaftaSonu", "hsTercih", "hsUst", "cumaEsles"]);

// KESİN KURALLAR (çizelge oluşturma, elle düzenleme ve uyarılarda ortak)
//  - Fazla mesai: destek personeli hariç nöbetçi personel arasında aylık fazla mesai farkı en fazla FM_MAX_FARK saat
//  - Hafta sonu: kişiye ayda en fazla 1 Cumartesi ve 1 Pazar nöbeti (Cuma + Cumartesi + Pazar üçü birden güçlü tercihtir, kesin değil)
export const FM_MAX_FARK = 8;

/** tatil günü başına hazırlama personeli sayısı */
export const HAZ_SAYISI = 2;
/** hazırlama günü ertesi gün nöbet: kadro yetmediğinde ilk esneyen kural; ihlal sayısında yarım sayılır (boş hazırlama
 *  yerinden ya da başka kesin kural ihlalinden önce seçilsin) */
export const HAFIF_IHLAL = 0.5;
/** en az bu kadar iş günü süren yıllık izin bloğunun iki yanındaki hafta sonu da yasak */
export const IZIN_HAFTA_GUN = 5;
/** puantajda elle girilen ve o gün görev yazılmasını engelleyen kodlar */
export const DURUM_KOD = ["YI", "R", "NI", "DI"];
export const DURUM_AD: Record<string, string> = { YI: "Yıllık izin", R: "Rapor", NI: "Nöbet izni (fazla mesai karşılığı)", DI: "Diğer izin" };

/** Yıl içinde eşit paylaşılan gün türleri (herkes birini almadan kimse ikincisini almasın) */
export const YIL_GUN_TIP = [["pe", "Perşembe"], ["cu", "Cuma"], ["cmt", "Cumartesi"], ["paz", "Pazar"], ["rt", "Resmi tatil"]] as const;
export type YilGunTipi = (typeof YIL_GUN_TIP)[number][0];

// ÇİZELGE OLUŞTURMA AĞIRLIKLARI (öncelik sırasıyla)
// Arama, aşağıdaki cezaların toplamını en aza indirir. Büyük ağırlık = yüksek öncelik. Bir kuralın birimi
// (1 saat, 1 nöbet, 1 kişi…) başına verilen cezadır; "kare sapma" yazanlar kişiler arası kare sapma toplamıyla çarpılır.
//  1. UYARI: uyarı çıkaran her durum. Öncelik her zaman uyarısız çizelgedir; diğer tüm cezaların toplamından büyüktür.
//  2. Kesin kurallar (yüz binler ve üzeri): uyarı düzeyine ek olarak ihlalin büyüklüğünü ayırt eder.
//  3. Güçlü tercihler (on binler, yüz binler): ancak başka çare yoksa esner.
//  4. Yıllık eşitlik ve aylık düzen (binler, yüzler): adalet; birbirleriyle dengelenir.
//  5. Aylık denge ve ince ayar (onlar, birler): eşitlik bozulmadan karşılanan tercihler.
// Günlük tercihler (thuHs, cuPaz, istiyor, araGun) gunTercihCarpani (3) ile çarpılır; etkin değerleri yanlarında yazılı.
// Bir değeri değiştirmeden önce: testler (npm test) senaryolarda hata sayısının artmadığını denetler.
const KESIN_AGIRLIK = 2e6, GUNYIL_AGIRLIK = 1.5e6;
export const AGIRLIK = Object.freeze({
  // 1. uyarı
  UYARI: 1e11,
  // 2. kesin kurallar
  KESIN: KESIN_AGIRLIK,                    // genel kesin kural birimi: aylık nöbet sayısı farkı 2'yi aşan her nöbet; fazla mesai farkı 8 saati aşan her saat
  fmBant: KESIN_AGIRLIK * 0.25,            // fazla mesai: herkesi 8 saatlik tek aralığa sokmak için gereken toplam saat (arama düzlükte takılmasın)
  hzFarkHazirlamaOncelik: KESIN_AGIRLIK * 200, // hazırlama farkı 1'i aşınca, Ayarlar'da "hazırlama eşitliği" öncelikliyse
  hzFarkSaatOncelik: 300000,               // hazırlama farkı 1'i aşınca, Ayarlar'da "fazla mesai saati" öncelikliyse
  destekSayi: KESIN_AGIRLIK * 40,          // destek personeli ayda tam ayardaki sayı kadar hazırlama alır (her fark için)
  tekOnce: KESIN_AGIRLIK * 10,             // hazırlama önce teknikerlere: eczacının (yıllık) hazırlaması teknikerinkini geçmez
  resmiYilToplam: 2 * GUNYIL_AGIRLIK,      // yıllık resmi tatil görevi (nöbet + hazırlama) farkı 1'i aşınca
  gunYil: GUNYIL_AGIRLIK,                  // yıllık Perşembe / Cuma / Cumartesi / Pazar / resmi tatil nöbeti farkı 1'i aşınca
  hsKural: 500000,                         // ayda en fazla 1 Cumartesi, 1 Pazar
  istemiyor: KESIN_AGIRLIK * 2.5,          // "istemiyor" işaretli güne nöbet / hazırlama (uyarı düzeyindeki eşitlik kuralları önce gelir)
  // 3. güçlü tercihler
  cuCmtPaz: 50000,                         // Cuma + Cumartesi + Pazar aynı ay aynı kişide (yıllık Cuma eşitliği bundan önce gelir)
  ucluSonHaz: 200000,                      // Cuma + Cumartesi + Pazar nöbeti olan kendi grubunda (eczacı / tekniker) hazırlamayı en son alır
  prepUst: 400000,                         // eczacı / tekniker ayda en fazla 2 hazırlama
  grupHazFark: 300000,                     // eczacılar kendi arasında, teknikerler kendi arasında aylık hazırlama farkı 1'i aşınca
  hsEnAz1: 150000,                         // ayda en az 1 Cumartesi/Pazar nöbeti (uygun gün varsa)
  nobetFark: 100000,                       // aylık nöbet sayısı farkı 1'i aşınca
  hsUst: 80000,                            // ayda Cumartesi/Pazar nöbeti ayardaki üst sınırı aşınca
  thuHs: 20000,                            // Perşembe nöbeti tutana aynı hafta sonu nöbet (etkin: ×3 = 60000)
  // 4. yıllık eşitlik ve aylık düzen
  thuFazla: 4000,                          // ayda Perşembe nöbeti ayardaki sınırı aşınca
  hsYil: 2500,                             // yıllık Cumartesi/Pazar nöbeti dengesi (kare sapma)
  nYil: 2000,                              // yıllık nöbet sayısı dengesi (kare sapma)
  prpYil: 2000,                            // yıllık hazırlama dengesi, herkes birlikte (kare sapma)
  prpGrup: 2000,                           // yıllık hazırlama dengesi, eczacılar ve teknikerler kendi içinde (kare sapma)
  prp2: 1500,                              // ayda 1 hazırlama hedefi: 2. hazırlama
  cuYil: 1500,                             // yıllık Cuma nöbeti dengesi (kare sapma)
  peYil: 1200,                             // yıllık Perşembe nöbeti dengesi (kare sapma)
  cpYil: 800,                              // yıllık Cumartesi ve Pazar dengesi, ayrı ayrı (kare sapma)
  resmi: 800,                              // resmi tatil nöbeti ve hazırlaması dengesi (kare sapma)
  cumaEslesmeYok: 600,                     // hafta sonu nöbeti var, Cuma nöbeti yok (Cuma eşleşmesi açıksa)
  devirPazar: 500,                         // önceki ay Pazar tutana bu ay yine Pazar
  devirPersembe: 400,                      // Perşembe: önceki ay ile bu ay ikisi de 0 ya da ikisi de var
  cumaFazla: 300,                          // ayda 2. Cuma nöbeti
  devirCumartesi: 250,                     // önceki ay Cumartesi tutana bu ay yine Cumartesi
  cumaTek: 200,                            // Cuma nöbeti var, hafta sonu nöbeti yok (Cuma eşleşmesi açıksa)
  // 5. aylık denge ve ince ayar
  fmYil: 80,                               // yıllık fazla mesai saati dengesi (kare sapma)
  nobetAy: 60,                             // aylık nöbet sayısı dengesi (kare sapma)
  destekYil: 25,                           // destek personeli yıllık hazırlama dengesi (kare sapma)
  haftaSonuIs: 20,                         // aylık hafta sonu nöbeti + hazırlama sayısı dengesi (kare sapma)
  istiyor: 5,                              // "istiyor" işaretli güne nöbet (ödül; etkin: ×3 = 15)
  cuPaz: 2,                                // Cuma nöbeti tutana aynı hafta Pazar nöbeti / hazırlaması (etkin: ×3 = 6); yalnız eşitliği
                                           // bozmuyorsa kaçınılır (art arda gün kuralı zaten var)
  araGun: 1,                               // iki nöbet arası ayardaki en az günden kısa (etkin: ×3 = 3)
  gunTercihCarpani: 3,                     // günlük tercih toplamının (thuHs, cuPaz, istiyor, araGun) çarpanı
});
