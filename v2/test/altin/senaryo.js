// Altın kayıt senaryosu: motorun tüm kurallarına dokunan zengin bir veri (iki kadro, ayarlar, izinler, resmi tatil,
// arife, kilitli günler, puantaj değişimleri, acil servis, servis hazırlama). Yeniden düzenlemelerde motorun
// çıktısı birebir aynı kalmalı; test/altin.test.js bu verinin üzerinde motoru çalıştırıp kayıtla karşılaştırır.

const anahtar = (id, y, m, d) => `${id}-${y}-${m}-${d}`;

function kadroKur() {
  const staff = [];
  let id = 1;
  const ekle = (name, role, fazla) => staff.push({ id: id++, name, role, ...(fazla || {}) });
  ["Ayşe", "Bora", "Cem", "Dila", "Ece"].forEach(n => ekle(n + " Ecz", "eczaci"));
  ekle("Fikret Dış", "nobetci");
  ["Gül", "Hakan", "Irmak", "Jale", "Kaan", "Lale"].forEach(n => ekle(n + " Tek", "teknisyen"));
  ekle("Mert Destek", "destek");
  ekle("Nur Destek", "destek");
  ekle("Oya Acil", "servis");
  ekle("Pelin Tek", "teknisyen", { baslangic: "2026-02-10" });   // ay ortasında başlayan
  ekle("Rıza Ecz", "eczaci", { bitis: "2026-03-17" });          // ay ortasında ayrılan
  return staff;
}

function veriKur() {
  const staff = kadroKur();
  const id = ad => staff.find(s => s.name.startsWith(ad)).id;
  const prefs = {};
  const isaret = (ad, y, m, gunler, v) => gunler.forEach(d => { prefs[anahtar(id(ad), y, m, d)] = v; });
  // Aralık 2025
  isaret("Bora", 2025, 11, [8, 9, 10], "izinli");
  isaret("Gül", 2025, 11, [24, 25], "avoid");
  // Ocak 2026: bir haftalık yıllık izin (iki yanındaki hafta sonu da yasak), eş durumu, istek, istememe
  isaret("Cem", 2026, 0, [12, 13, 14, 15, 16], "izinli");
  isaret("Dila", 2026, 0, [7, 21], "esVar");
  isaret("Ece", 2026, 0, [3, 4, 10], "esYok");
  isaret("Hakan", 2026, 0, [5, 6, 19, 20], "avoid");
  isaret("Irmak", 2026, 0, [9, 23, 30], "want");
  isaret("Jale", 2026, 0, [16], "izinli");
  isaret("Jale", 2026, 0, [19], "izinli");                    // arada kalan hafta sonu da izin sayılır
  // Şubat 2026
  isaret("Ayşe", 2026, 1, [2, 3, 4, 5, 6, 9, 10], "izinli");
  isaret("Kaan", 2026, 1, [14, 15], "avoid");
  isaret("Lale", 2026, 1, [27], "esVar");
  isaret("Fikret", 2026, 1, [7, 8], "want");
  // Mart 2026
  isaret("Gül", 2026, 2, [20, 21, 22, 23, 24, 25, 26, 27], "izinli");
  isaret("Bora", 2026, 2, [11], "esVar");
  isaret("Irmak", 2026, 2, [7, 8], "avoid");

  const manualTatil = { "2026-0-1": true, "2026-2-20": true, "2026-2-21": true, "2025-11-31": false };
  const arife = { "2026-2-19": true, "2026-0-30": true };
  const puantaj = {
    "2026-0": { [id("Jale")]: { 26: "R", 27: "R" }, [id("Bora")]: { 13: "YI" } },
    "2026-1": { [id("Hakan")]: { 3: "DI" }, [id("Kaan")]: { 18: "NI" } },
  };
  const acil = {
    "2026-0": { 5: [id("Oya"), id("Ece")], 6: [id("Oya")], 17: [id("Dila"), id("Oya")], 31: [id("Oya")] },
    "2026-1": { 1: [id("Ayşe")], 14: [id("Oya"), id("Bora")] },
  };
  return { staff, prefs, manualTatil, arife, puantaj, acil, settings: {}, schedules: {}, servisAyar: {} };
}

// iki ayar takımı: varsayılan ve değiştirilmiş (Ayarlar ekranındaki seçenekler)
const AYARLAR = {
  varsayilan: {},
  farkli: { minAra: 4, cakismaOncelik: 2, destekAylik: 1, arifeSaat: 5 },
};

// sırayla oluşturulan aylar (önceki ayın çizelgesi sonrakinin girdisi olur)
const AYLAR = [[2025, 11], [2026, 0], [2026, 1], [2026, 2]];

// küçük kadro: kurallar tutmaz, arama uyarılı çizelge arar (en az uyarılı çizelge seçimi)
function darVeri() {
  const staff = [];
  ["E1", "E2"].forEach((n, i) => staff.push({ id: i + 1, name: n, role: "eczaci" }));
  ["T1", "T2", "T3"].forEach((n, i) => staff.push({ id: i + 3, name: n, role: "teknisyen" }));
  const prefs = { [anahtar(3, 2026, 3, 11)]: "izinli", [anahtar(3, 2026, 3, 12)]: "izinli", [anahtar(1, 2026, 3, 20)]: "avoid" };
  return { staff, prefs, manualTatil: { "2026-3-23": true }, arife: {}, puantaj: {}, acil: {}, settings: {}, schedules: {} };
}

export { veriKur, AYARLAR, AYLAR, darVeri, anahtar };
