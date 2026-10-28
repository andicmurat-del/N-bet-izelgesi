// Elle gün düzenlemede anlık kural denetimi (gün penceresi): seçilen nöbetçiler ve hazırlama personeli için
// hata / uyarı / bilgi listesi.
import type { Gorevli } from "../veri/tipler";
import { aktifGunMu, eczaciMi, nobetciRol, type Baglam, type MotorCizelgesi, type MotorGunu } from "./baglam";
import { fmKuralKisileri, hsKuralIhlali, hsSayilari } from "./istatistik";
import { DURUM_AD, FM_MAX_FARK } from "./sabitler";
import { AYLAR, ayGunSayisi, CUMA, CUMARTESI, haftaGunu, isoNo, oncekiAy, PAZAR, PERSEMBE, sonrakiAy, tarihNo } from "./takvim";

export interface Bulgu { sev: "hata" | "uyari" | "bilgi"; t: string }
type KomsuGun = { day: number | string; assigned: { id: number }[]; prep: { id: number }[] };

/** sch: ayın çizelgesi (düzenlenen gün eski hâliyle); gun 1'den; nb: nöbetçiler; pr: hazırlama personeli */
export function gunuDenetle(B: Baglam, sch0: MotorCizelgesi, gun: number, nb: Gorevli[], pr: Gorevli[]): Bulgu[] {
  const sch: MotorCizelgesi = JSON.parse(JSON.stringify(sch0));
  const y = sch.year, m = sch.month, days = sch.days, dimS = ayGunSayisi(y, m);
  days.forEach(d => { d.fazlaMesai = B.fazlaMesai(y, m, d.day, dimS); });
  const day = days[gun - 1], idx = day.day - 1;
  const out: Bulgu[] = [];
  const ekle = (sev: Bulgu["sev"], t: string) => out.push({ sev, t });
  const dw = haftaGunu(y, m, day.day);
  const hz = B.sayi("hazSaat");
  // ay sınırında komşu gün: önceki ayın son günü / sonraki ayın 1. günü (gerçekte çalışılana göre)
  const pm = oncekiAy(y, m), nmA = sonrakiAy(y, m);
  const oS = B.cizelge(pm.y, pm.m), sS = B.cizelge(nmA.y, nmA.m);
  const komsuAy = (k: number): KomsuGun | undefined => {
    const ob = (gg: { N: number[]; H: number[] }) => ({ assigned: gg.N.map(id => ({ id })), prep: gg.H.map(id => ({ id })) });
    if (idx + k === -1 && oS && oS.days.length) { const d = oS.days[oS.days.length - 1]; return Object.assign({ day: d.day + " " + AYLAR[pm.m] + " günü" }, ob(B.gercekGorev(pm.y, pm.m, d.day))); }
    if (idx + k === days.length && sS && sS.days.length) return Object.assign({ day: "1 " + AYLAR[nmA.m] + " günü" }, ob(B.gercekGorev(nmA.y, nmA.m, 1)));
    return undefined;
  };
  const g = (k: number): MotorGunu | KomsuGun | undefined => days[idx + k] || komsuAy(k);
  const gl = (gg: { day: number | string }) => (typeof gg.day === "number" ? gg.day + ". gün" : gg.day);
  const thuHaftaSonu = B.ayar("thuHaftaSonu");

  if (nb.length && !nb.some(p => eczaciMi(p.role))) ekle("hata", "Bu günde eczacı yok.");
  if (nb.filter(p => p.role === "nobetci").length > 1) ekle("hata", "Dışarıdan nöbete gelen iki eczacı aynı güne birlikte nöbetçi yazılmaz (biri hazırlama olabilir).");
  if (nb.length < 2) ekle("uyari", "Günde 2 nöbetçi olmalı; ikinci kişi boş.");
  B.staff.filter(s => nobetciRol(s.role) && B.tercih(s.id, y, m, day.day) === "esVar" && aktifGunMu(s, y, m, day.day) && !nb.some(q => q.id === s.id))
    .forEach(s => ekle("hata", s.name + " için eş durumu: bu güne nöbetçi yazılması gerekiyor."));

  nb.forEach(p => {
    [-1, 1].forEach(k => {
      const gg = g(k); if (!gg) return;
      if (gg.assigned.some(q => q.id === p.id)) ekle("hata", p.name + ", " + gl(gg) + " de nöbetçi; nöbetten sonra ertesi gün izinli olmalı.");
      if ((gg.prep || []).some(q => q.id === p.id)) ekle("hata", p.name + ", " + gl(gg) + " hazırlama personeli (komşu gün).");
    });
    {
      const v = (k: number) => { const gg = days[idx + k]; return !!(gg && gg.assigned.some(q => q.id === p.id)); };
      if ((v(-2) && v(-4)) || (v(-2) && v(2)) || (v(2) && v(4))) ekle("hata", p.name + " 5 gün içinde 3. nöbetini tutuyor (ör. Pazartesi–Çarşamba–Cuma); en fazla bir kez 2 gün arayla yazılabilir.");
    }
    const ara = B.sayi("minAra");
    for (let k = 2; k < ara; k++) {
      [-k, k].forEach(kk => { const gg = g(kk); if (gg && gg.assigned.some(q => q.id === p.id)) ekle("uyari", p.name + ", " + gg.day + ". gün de nöbetçi (en az " + ara + " gün ara önerilir)."); });
    }
    const stp = B.kisi(p.id);
    if (stp && !aktifGunMu(stp, y, m, day.day)) ekle("hata", p.name + " bu tarihte çalışmıyor (işe başlama / ayrılış tarihi dışında).");
    else if (stp && stp.bitis && isoNo(stp.bitis) === tarihNo(y, m, day.day)) {
      const ertesiMs = day.day < days.length ? B.mesaiSaati(y, m, day.day + 1) : B.mesaiSaati(nmA.y, nmA.m, 1);
      if (ertesiMs > 0) ekle("uyari", p.name + " için bu gün son çalışma günü; ertesi gün nöbet izni kullanamaz (fazla mesaisi çizelgedekinden " + ertesiMs + " saat fazla çıkar).");
    }
    const tercih = B.tercih(p.id, y, m, day.day);
    const durum = B.puantajDurumu(p.id, y, m, day.day);
    if (durum) ekle("hata", p.name + " bu gün " + DURUM_AD[durum].toLowerCase() + " kullanıyor (puantajda kayıtlı).");
    else if (tercih === "izinli") ekle("hata", p.name + " bu gün izinli olarak işaretli.");
    else if (B.izinArasiMi(p.id, y, m, day.day)) ekle("hata", p.name + " bu gün izin arasında (iki izin günü arasındaki tatil).");
    else if (B.izinHaftasiKenariMi(p.id, y, m, day.day)) ekle("hata", p.name + " bu gün bir haftalık yıllık izninin önündeki / arkasındaki hafta sonu.");
    else if (B.izinOncesiMi(p.id, y, m, day.day)) ekle("uyari", p.name + " ertesi gün izne çıkıyor; nöbet ertesi izni izin gününe düşer.");
    if (tercih === "esYok") ekle("hata", p.name + " için eş durumu: bu güne yazılmaması gerekiyor.");
    if (tercih === "avoid") ekle("uyari", p.name + " bu gün nöbet istemiyor.");
    let thu = 0, hs = 0;
    days.forEach((gg, i) => {
      if (i === idx) return;
      if (gg.assigned.some(q => q.id === p.id)) { const w = haftaGunu(y, m, gg.day); if (w === PERSEMBE) thu++; if (w === CUMARTESI || w === PAZAR) hs++; }
    });
    if (dw === PERSEMBE) { thu++; if (thu > B.sayi("maxThu")) ekle("uyari", p.name + " bu ay " + thu + ". Perşembe nöbetini tutuyor (sınır " + (B.sayi("maxThu") >= 99 ? "yok" : B.sayi("maxThu")) + ")."); }
    // Perşembe nöbeti ↔ aynı hafta sonu: hazırlama kesin yasak, nöbet önerilmez
    if (dw === PERSEMBE && thuHaftaSonu) [2, 3].forEach(k => {
      const gg = days[idx + k]; if (!gg) return;
      if ((gg.prep || []).some(q => q.id === p.id)) ekle("hata", p.name + " Perşembe nöbetçisi, ama aynı hafta sonu " + gg.day + ". gün hazırlama görevinde.");
      if (gg.assigned.some(q => q.id === p.id)) ekle("uyari", p.name + " Perşembe nöbetçisi; aynı hafta sonu " + gg.day + ". gün de nöbetçi.");
    });
    if (dw === CUMA) {
      const gg = days[idx + 2];
      if (gg && gg.assigned.some(q => q.id === p.id)) ekle("uyari", p.name + " Cuma nöbetçisi; aynı hafta Pazar (" + gg.day + ". gün) de nöbetçi.");
      if (gg && (gg.prep || []).some(q => q.id === p.id)) ekle("uyari", p.name + " Cuma nöbetçisi; aynı hafta Pazar (" + gg.day + ". gün) hazırlama görevinde.");
    }
    if (dw === PAZAR) { const gg = days[idx - 2]; if (gg && gg.assigned.some(q => q.id === p.id)) ekle("uyari", p.name + " aynı haftanın Cuma günü (" + gg.day + ". gün) nöbetçi; Cuma ve Pazar aynı kişiye yazılmamalı."); }
    if ((dw === CUMARTESI || dw === PAZAR) && thuHaftaSonu) { const gg = days[idx - (dw === CUMARTESI ? 2 : 3)]; if (gg && gg.assigned.some(q => q.id === p.id)) ekle("uyari", p.name + " aynı haftanın Perşembe günü (" + gg.day + ". gün) nöbetçi."); }
    if (dw === CUMARTESI || dw === PAZAR) {
      hs++;
      if (hs > B.sayi("hsUst")) ekle("hata", p.name + " bu ay " + hs + ". hafta sonu nöbetini tutuyor (en fazla " + B.sayi("hsUst") + ").");
    }
    if (dw === CUMA || dw === CUMARTESI || dw === PAZAR) {
      const yeniGunler = days.map((gg, i) => (i === idx ? { day: gg.day, assigned: nb } : gg));
      const ih = hsKuralIhlali(hsSayilari(y, m, yeniGunler, p.id));
      if (ih.length) ekle("hata", p.name + ": hafta sonu kuralı — ayda en fazla 1 Cumartesi ve 1 Pazar; Cuma + Cumartesi + Pazar birlikte yazılmaz (bu ay: " + ih.join(", ") + ").");
    }
  });

  pr.forEach(p => {
    if (nb.some(q => q.id === p.id)) ekle("hata", p.name + " hem nöbetçi hem hazırlama olamaz.");
    for (let k = -1; k <= 1; k++) {
      const gg = g(k); if (!gg || k === 0) continue;
      if (gg.assigned.some(q => q.id === p.id)) ekle("hata", p.name + " hazırlama, ama " + gl(gg) + " nöbetçi.");
    }
    [-1, 1].forEach(k => { const gg = g(k); if (gg && (gg.prep || []).some(q => q.id === p.id)) ekle("hata", p.name + ", " + gl(gg) + " de hazırlama görevinde; art arda iki gün hazırlama yazılmaz."); });
    if (B.izinliMi(p.id, y, m, day.day)) ekle("hata", p.name + " bu gün izinli" + (B.tercih(p.id, y, m, day.day) === "izinli" ? " olarak işaretli." : " (iki izin günü arasındaki tatil)."));
    else if (B.izinHaftasiKenariMi(p.id, y, m, day.day)) ekle("hata", p.name + " bu gün bir haftalık yıllık izninin önündeki / arkasındaki hafta sonu.");
    if (dw === PAZAR) { const gg = days[idx - 2]; if (gg && gg.assigned.some(q => q.id === p.id)) ekle("uyari", p.name + " aynı haftanın Cuma günü (" + gg.day + ". gün) nöbetçi; Pazar hazırlaması yazılmamalı."); }
    if ((dw === CUMARTESI || dw === PAZAR) && thuHaftaSonu) { const gg = days[idx - (dw === CUMARTESI ? 2 : 3)]; if (gg && gg.assigned.some(q => q.id === p.id)) ekle("hata", p.name + " aynı haftanın Perşembe günü (" + gg.day + ". gün) nöbetçi; hafta sonu hazırlama yazılmaz."); }
    if (B.tercih(p.id, y, m, day.day) === "esYok") ekle("hata", p.name + " için eş durumu: bu güne yazılmaması gerekiyor.");
    let say = 1; days.forEach((gg, i) => { if (i !== idx && (gg.prep || []).some(q => q.id === p.id)) say++; });
    if (p.role !== "destek" && say > 2) ekle("hata", p.name + " bu ay " + say + ". hazırlama görevini alıyor (ayda en fazla 2).");
    if (p.role === "destek" && say > B.sayi("destekAylik")) ekle("uyari", p.name + " bu ay " + say + ". hazırlama görevini alıyor (destek personeli için " + B.sayi("destekAylik") + ").");
  });

  // fazla mesai etkisi
  const top: Record<number, number> = {}; B.staff.forEach(s => { top[s.id] = 0; });
  days.forEach((gg, i) => {
    if (i === idx) return;
    gg.assigned.forEach(p => { if (top[p.id] !== undefined) top[p.id] += gg.fazlaMesai; });
    (gg.prep || []).forEach(p => { if (top[p.id] !== undefined) top[p.id] += hz; });
  });
  nb.forEach(p => { top[p.id] += day.fazlaMesai; }); pr.forEach(p => { top[p.id] += hz; });
  const duty = B.staff.filter(s => nobetciRol(s.role));
  const ort = duty.length ? duty.reduce((a, s) => a + top[s.id], 0) / duty.length : 0;
  {
    const kk = fmKuralKisileri(B, y, m);
    if (kk.length > 1) {
      let mx = kk[0], mn = kk[0];
      kk.forEach(s => { if (top[s.id] > top[mx.id]) mx = s; if (top[s.id] < top[mn.id]) mn = s; });
      const fk = top[mx.id] - top[mn.id];
      if (fk > FM_MAX_FARK) ekle("hata", "Kesin kural: bu değişiklikle fazla mesai farkı " + fk + " saat olur (en fazla " + FM_MAX_FARK + "). En çok " + mx.name + " (" + top[mx.id] + " sa), en az " + mn.name + " (" + top[mn.id] + " sa).");
    }
  }
  const hedef = B.sayi("fmHedef");
  nb.concat(pr.filter(p => p.role !== "destek")).filter((p, i, a) => a.findIndex(q => q.id === p.id) === i).forEach(p => {
    const fark = Math.round(top[p.id] - ort);
    const metin = p.name + ": toplam " + top[p.id] + " saat, ortalama " + Math.round(ort) + " (" + (fark >= 0 ? "+" : "") + fark + ").";
    ekle(Math.abs(fark) > hedef ? "uyari" : "bilgi", metin);
  });
  return out;
}
