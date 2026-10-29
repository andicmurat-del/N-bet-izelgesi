// 4. adım: bitmiş çizelgenin denetimi. Kural esnetilen günler işaretlenir (conflict) ve kullanıcıya gösterilecek
// uyarılar yazılır. Uyarı metinleri raporlar.ts'deki kalıplarla (uyariSiniflandir) sınıflandırılır; metni değiştirirken orayı da güncelleyin.
import { aktifGunMu, eczaciMi } from "../baglam";
import { fmFarkBilgisi, fmKuralKisileri, hsKuralIhlali, hsSayilari, yilGunSayilari } from "../istatistik";
import { FM_MAX_FARK, HAZ_SAYISI, YIL_GUN_TIP } from "../sabitler";
import { AYLAR, CUMA, CUMARTESI, haftaGunu, PAZAR } from "../takvim";
import { kadroYetersizlikNedenleri } from "./kapasite";
import type { Kurallar } from "./kurallar";
import type { AramaKurulumu } from "./kurulum";

/** kilitli olmayan günlerde kural esnetildi mi (gün kırmızı görünür) */
export function gunleriIsaretle(K: AramaKurulumu, kural: Kurallar): void {
  const { B, y, m, days, zorunluGun } = K;
  const { tatilGunu, ihlalSayisi } = kural;
  days.forEach((dy, i) => {
    if (dy.locked) return;
    dy.conflict = zorunluGun[i].some(zid => !dy.assigned.some(p => p.id === zid)) || dy.assigned.length < 2 || (tatilGunu(i) && dy.prep.length < HAZ_SAYISI) ||
      ihlalSayisi(i) > 0 ||
      dy.assigned.some(p => B.tercih(p.id, y, m, dy.day) === "avoid") || (dy.prep || []).some(p => B.tercih(p.id, y, m, dy.day) === "avoid");
  });
}

export function uyarilariYaz(K: AramaKurulumu, kural: Kurallar): string[] {
  const { A, B, y, m, days, staffList, prepAday, destekler, destekVar, DESTEK_AYLIK } = K;
  const { eczacilar, dim } = A;
  const { tatilGunu } = kural;
  const gunTuru = (d: number) => haftaGunu(y, m, d);
  const haftaSonu = (d: number) => { const dw = gunTuru(d); return dw === CUMARTESI || dw === PAZAR; };
  const cakismaSaat = Number(B.ayar("cakismaOncelik")) === 2;
  const warnings: string[] = [];

  if (eczacilar.length < 2) {
    warnings.push("En az 2 eczacı gerekiyor; aksi halde dinlenme kuralı garanti edilemez. Şu an " + eczacilar.length + " eczacı var.");
  }
  // kadro kesin kurallara yetmiyorsa kırmızı günler kaçınılmazdır: nedeniyle birlikte söylenir
  const yetersiz = kadroYetersizlikNedenleri(K);
  if (yetersiz.length) {
    warnings.push("Bu ay personel kesin kurallara yetmiyor; kurallara tam uyan bir çizelge matematiksel olarak mümkün değil. Nedeni: " + yetersiz.join("; ") + ". Kırmızı günler bundan kaynaklanır; daha fazla personel ya da daha az izin gerekir.");
  }
  // izinden önceki güne mecburen yazılan nöbetler (yumuşak kural esnedi): kullanıcı bilsin
  const izinOncesiAtama: string[] = [];
  days.forEach(dd => { if (dd.locked) return; (dd.assigned || []).forEach(p => { if (B.izinOncesiMi(p.id, y, m, dd.day)) izinOncesiAtama.push(p.name + " (" + dd.day + " " + AYLAR[m] + ")"); }); });
  if (izinOncesiAtama.length) {
    warnings.push("Başka uygun kişi kalmadığı için şu nöbetler izinden önceki güne yazıldı; nöbet ertesi izni izin gününe denk gelir: " + izinOncesiAtama.join(", ") + ". İsterseniz günü açıp başka bir kişiyle değiştirebilirsiniz.");
  }
  // kadro yetmediği için hazırlama yapan ertesi gün nöbetçi (kadro yetmediğinde ilk esneyen kural)
  {
    const l: string[] = [];
    days.forEach((dd, i) => {
      if (dd.locked || !tatilGunu(i)) return;
      (dd.prep || []).forEach(p => { if (!kural.prepKomsuSert(p.id, i) && kural.prepSonrasiNobet(p.id, i)) l.push(p.name + " (" + dd.day + " " + AYLAR[m] + ")"); });
    });
    if (l.length) warnings.push("Personel yetmediği için hazırlama yeri boş kalmasın diye şu kişiler hazırlamanın ertesi günü nöbet tutuyor (hazırlama günü yazılı): " + l.join(", ") + ".");
  }
  const kirmiziGunler = days.filter(dd => dd.conflict && !dd.locked).map(dd => dd.day);
  if (kirmiziGunler.length) {
    warnings.push("Bazı otomatik atanan günlerde dinlenme kuralı ve/veya \"istemiyorum\"/\"izinli\" tercihi personel yetersizliğinden dolayı korunamadı; bu günlerde zorunlu atama yapıldı. Bu günler kırmızı ile işaretlendi (gün numarasının yanında ! var): " + kirmiziGunler.map(g => g + " " + AYLAR[m]).join(", ") + ". Günün üzerine gelince ya da güne dokununca sebebi görünür.");
  }
  // her gün en az bir eczacı gerektiğinden, eczacı az ise eczacılar ortalamadan fazla nöbet tutmak zorundadır
  {
    const nE = eczacilar.length, nA = staffList.length;
    if (nE >= 1 && nA > nE) {
      const eczEnAz = dim / nE, ort = 2 * dim / nA;
      if (eczEnAz - ort >= 1.5) {
        const fmFark = Math.round((eczEnAz - ort) * (days.reduce((t, d) => t + d.fazlaMesai, 0) / Math.max(1, days.length)));
        warnings.push("Eczacı sayısı (" + nE + ") nöbetçi personele göre az: her gün en az bir eczacı nöbetçi olması gerektiğinden her eczacı bu ay en az " + Math.ceil(eczEnAz) + " nöbet tutar, diğer nöbetçiler ortalama " + Math.round(ort) + ". Bu yüzden eczacılarla teknikerler arasında yaklaşık " + fmFark + " saat fazla mesai farkı kalır; personel yapısından kaynaklanır, normaldir.");
      }
    }
  }
  // ayda en az 1 hafta sonu: uygun hafta sonu günü olduğu hâlde 0 kalanlar
  {
    const sy: Record<number, number> = {}, ad: Record<number, string> = {};
    staffList.forEach(s => { sy[s.id] = 0; ad[s.id] = s.name; });
    days.forEach(dd => { if (haftaSonu(dd.day)) dd.assigned.forEach(p => { if (sy[p.id] !== undefined) sy[p.id]++; }); });
    const uygun = staffList.filter(s => days.some(dd => haftaSonu(dd.day) && !B.kesinYasak(s.id, y, m, dd.day) && aktifGunMu(s, y, m, dd.day)));
    const sifir = uygun.filter(s => sy[s.id] === 0).map(s => ad[s.id]);
    // hafta sonu nöbet yeri uygun kişi sayısından azsa bazılarının 0 kalması kaçınılmazdır; yalnız fazlası uyarılır
    const yer = 2 * days.filter(dd => haftaSonu(dd.day)).length;
    if (sifir.length > Math.max(0, uygun.length - yer)) warnings.push("Bu ay hafta sonu nöbeti yazılamayan kişiler (personel/izin durumu yetmedi): " + sifir.join(", ") + ".");
  }
  // eş durumu
  days.forEach((dd, i) => {
    if (dd.locked) return;
    const zor = staffList.filter(s => B.tercih(s.id, y, m, dd.day) === "esVar" && aktifGunMu(s, y, m, dd.day));
    if (zor.length > 2) warnings.push(dd.day + ". gün için eş durumu 'istiyor' işaretli " + zor.length + " kişi var, günde en fazla 2 nöbetçi yazılabilir.");
    zor.forEach(z => {
      if (!dd.assigned.some(p => p.id === z.id)) { warnings.push(dd.day + ". gün " + z.name + " için eş durumu isteği karşılanamadı."); return; }
      [-1, 1].forEach(k => { const gg = days[i + k]; if (gg && gg.assigned.some(p => p.id === z.id)) warnings.push(z.name + ": eş durumu isteği nedeniyle " + dd.day + ". gün ile " + gg.day + ". gün art arda nöbet yazıldı."); });
    });
  });
  // kesin kurallar: personel/izin durumu nedeniyle sağlanamadıysa açıkça bildirilir
  {
    const hsI: string[] = [];
    staffList.forEach(s => { const ih = hsKuralIhlali(hsSayilari(y, m, days, s.id)); if (ih.length) hsI.push(s.name + " (" + ih.join(", ") + ")"); });
    if (hsI.length) warnings.push("Hafta sonu kuralı esnetildi (ayda en fazla 1 Cumartesi, 1 Pazar): " + hsI.join("; ") + ". Personel/izin durumu nedeniyle uyarısız bir çizelge bulunamadı; en az uyarılı çizelge seçildi, ilgili günleri elle düzenleyebilirsin.");
  }
  {
    const hz: Record<number, number> = {}; prepAday.forEach(s => { hz[s.id] = 0; });
    days.forEach(dd => (dd.prep || []).forEach(p => { if (hz[p.id] !== undefined) hz[p.id]++; }));
    const L = prepAday.filter(s => days.some(dy => dy.tatil && !B.kesinYasak(s.id, y, m, dy.day)));
    if (L.length > 1) {
      const v = L.map(s => hz[s.id]), mx = Math.max(...v), mn = Math.min(...v);
      if (mx - mn > 1) warnings.push("Hazırlama farkı sağlanamadı: hazırlama sayıları arasındaki fark " + (mx - mn) + " (en fazla 1). En çok: " + L.filter(s => hz[s.id] === mx).map(s => s.name + " (" + mx + ")").join(", ") + "; en az: " + L.filter(s => hz[s.id] === mn).map(s => s.name + " (" + mn + ")").join(", ") + ". " + (cakismaSaat ? "Ayarlar'da çakışmada öncelik fazla mesai saati seçili." : "Personel/izin durumu nedeniyle."));
    }
  }
  {
    const kk = fmKuralKisileri(B, y, m), ys = yilGunSayilari(B, y, m, days), sat: string[] = [];
    const dv = (id: number, k: (typeof YIL_GUN_TIP)[number][0]) => (ys[id] ? ys[id][k] : 0) || 0;
    const hm = (id: number, k: (typeof YIL_GUN_TIP)[number][0]) => (ys[id] ? ys[id].ham[k] : 0) || 0;
    if (kk.length > 1) YIL_GUN_TIP.forEach(([k, ad]) => {
      const v = kk.map(s => dv(s.id, k)), mx = Math.max(...v), mn = Math.min(...v);
      if (mx - mn > 1 + 1e-9) sat.push(ad + " (en çok: " + kk.filter(s => dv(s.id, k) > mx - 0.5).map(s => s.name + " " + hm(s.id, k)).join(", ") + "; en az: " + kk.filter(s => dv(s.id, k) < mn + 0.5).map(s => s.name + " " + hm(s.id, k)).join(", ") + ")");
    });
    if (sat.length) warnings.push("Yıllık gün dağılımında fark 1'i aşıyor (" + y + " başından bu aya kadar; sonradan başlayan personel yalnız çalıştığı aylara göre karşılaştırılır): " + sat.join("; ") + ". Önceki aylardan gelen fark sonraki aylarda kapatılır; fazla mesai ya da hazırlama kuralları bu ay izin vermedi.");
  }
  {
    const kk = fmKuralKisileri(B, y, m), nc: Record<number, number> = {}; kk.forEach(s => { nc[s.id] = 0; });
    days.forEach(dd => dd.assigned.forEach(p => { if (nc[p.id] !== undefined) nc[p.id]++; }));
    if (kk.length > 1) {
      const v = kk.map(s => nc[s.id]), mx = Math.max(...v), mn = Math.min(...v);
      if (mx - mn > 2) warnings.push("Nöbet sayısı farkı sağlanamadı: kişiler arasındaki fark " + (mx - mn) + " (en fazla 2). En çok: " + kk.filter(s => nc[s.id] === mx).map(s => s.name + " (" + mx + ")").join(", ") + "; en az: " + kk.filter(s => nc[s.id] === mn).map(s => s.name + " (" + mn + ")").join(", ") + ".");
    }
  }
  {
    const fb = fmFarkBilgisi(B, y, m, days);
    if (fb.fark > FM_MAX_FARK && fb.enCok && fb.enAz) warnings.push("KESİN KURAL sağlanamadı: fazla mesai farkı " + fb.fark + " saat (en fazla " + FM_MAX_FARK + "). En çok: " + fb.enCok.name + " (" + (fb.t[fb.enCok.id] || 0) + " sa), en az: " + fb.enAz.name + " (" + (fb.t[fb.enAz.id] || 0) + " sa). " + (cakismaSaat ? "Uzun izin, az eczacı ya da kilitli günler nedeniyle olur." : "Ayarlar'da çakışmada öncelik hazırlama eşitliği seçili; hazırlama farkını en fazla 1 tutmak için ya da uzun izin, az eczacı, kilitli günler nedeniyle olur."));
  }
  // Cumartesi/Pazar nöbeti ayardaki üst sınırı aşanlar
  {
    const t: Record<number, number> = {}; staffList.forEach(s => { t[s.id] = 0; });
    days.forEach(dd => { if (!haftaSonu(dd.day)) return; dd.assigned.forEach(p => { if (t[p.id] !== undefined) t[p.id]++; }); });
    const hsUst = B.sayi("hsUst");
    const uc = staffList.filter(s => t[s.id] > hsUst).map(s => s.name + " (" + t[s.id] + ")");
    if (uc.length) warnings.push("Personel yetersizliğinden ayda " + (hsUst + 1) + " ya da daha fazla Cumartesi/Pazar nöbeti düşen kişiler: " + uc.join(", ") + ".");
  }
  const eksikPrep = days.filter((dd, i) => !dd.locked && tatilGunu(i) && dd.prep.length < HAZ_SAYISI).map(dd => dd.day + (dd.prep.length ? " (" + dd.prep.length + "/" + HAZ_SAYISI + ")" : ""));
  if (eksikPrep.length) warnings.push("Şu günler için yeterli hazırlama personeli bulunamadı: " + eksikPrep.join(", ") + ".");
  if (destekVar) {
    const tatilGunSayisi = days.filter(dd => dd.tatil).length;
    const gerekli = destekler.length * DESTEK_AYLIK;
    const sayac: Record<number, number> = {}; destekler.forEach(s => { sayac[s.id] = 0; });
    days.forEach(dd => dd.prep.forEach(pp => { if (sayac[pp.id] !== undefined) sayac[pp.id]++; }));
    const farkli = destekler.filter(s => sayac[s.id] !== DESTEK_AYLIK).map(s => s.name + " (" + sayac[s.id] + ")");
    if (tatilGunSayisi < gerekli) {
      warnings.push("Bu ay " + tatilGunSayisi + " tatil günü var; " + destekler.length + " destek personeline ayda kesin " + DESTEK_AYLIK + "'şer görev için " + gerekli + " gün gerekiyor. Destek personeli sayısını azaltırsan ya da tatil günü sayısı artarsa hepsi " + DESTEK_AYLIK + " görev alır.");
    }
    // tatil günü destek personelinin karşılayabileceğinden fazlaysa kalan 2. hazırlama yerlerini eczacı/tekniker doldurur:
    // bu her ay olan olağan durumdur, uyarı olarak gösterilmez
    if (farkli.length && tatilGunSayisi >= gerekli) {
      warnings.push("Şu destek personelinde hazırlama sayısı " + DESTEK_AYLIK + " olamadı: " + farkli.join(", ") + ". Nedeni: izin, komşu nöbet ya da art arda hazırlama kuralı izin vermedi.");
    }
  }
  // elle girilen (kilitli) günlerin kural ihlalleri
  days.forEach(dd => {
    if (!dd.locked || !dd.prep.length) return;
    const ix = dd.day - 1;
    dd.prep.forEach(pp => {
      for (let k = ix - 1; k <= ix + 1; k++) {
        if (k >= 0 && k < days.length && days[k].assigned.some(p => p.id === pp.id)) {
          warnings.push(dd.day + ". gün elle atadığınız hazırlama personeli " + pp.name + ", " + days[k].day + ". gün nöbetçi (kural ihlali).");
          break;
        }
      }
      if (B.kesinYasak(pp.id, y, m, dd.day)) warnings.push(dd.day + ". gün elle atadığınız hazırlama personeli " + pp.name + " o gün izinli olarak işaretli.");
    });
  });
  days.forEach(dd => {
    if (!dd.locked) return;
    if (!dd.assigned.some(p => eczaciMi(p.role)) && dd.assigned.length > 0) warnings.push(dd.day + ". gün elle atadığınız nöbette eczacı yok.");
    dd.assigned.forEach(p => { if (B.kesinYasak(p.id, y, m, dd.day)) warnings.push(dd.day + ". gün elle atadığınız " + p.name + " o gün izinli olarak işaretli."); });
  });
  return warnings;
}

/** ayın kişi başı gün kategorisi dağılımı (çizelge kaydında "history") */
export function ayGecmisi(K: AramaKurulumu) {
  const { B, y, m, days } = K;
  const sayac: Record<number, { haftaici: number; cuma: number; cumartesi: number; pazar: number }> = {};
  const yeni = () => ({ haftaici: 0, cuma: 0, cumartesi: 0, pazar: 0 });
  B.staff.forEach(s => { sayac[s.id] = yeni(); });
  days.forEach(day => {
    const dw = haftaGunu(y, m, day.day);
    const kat = dw === CUMA ? "cuma" : dw === CUMARTESI ? "cumartesi" : dw === PAZAR ? "pazar" : "haftaici";
    day.assigned.forEach(p => { (sayac[p.id] || (sayac[p.id] = yeni()))[kat]++; });
  });
  return sayac;
}
