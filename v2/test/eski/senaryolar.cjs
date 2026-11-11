// Test senaryoları: her biri bir personel listesi, izin tercihleri ve sırayla oluşturulacak aylar.
// Aylar 0'dan başlar (0 = Ocak). Kişi kimlikleri: önce eczacılar (E1..), sonra teknikerler (T1..).

function kadro(eczaci, tekniker, ek){
  const staff = [];
  for (let i=1;i<=eczaci;i++) staff.push({id:i, name:"E"+i, role:"eczaci"});
  for (let i=1;i<=tekniker;i++) staff.push({id:eczaci+i, name:"T"+i, role:"teknisyen"});
  (ek||[]).forEach(f=>f(staff));
  return staff;
}
function izinli(staff, ad, y, m, gunler){
  const id = staff.find(s=>s.name===ad).id, o = {};
  gunler.forEach(d=>{ o[id+"-"+y+"-"+m+"-"+d] = "izinli"; });
  return o;
}
function aralik(a, b){ const r = []; for (let d=a; d<=b; d++) r.push(d); return r; }
// kişinin verilen günlerdeki nöbet ve hazırlama görevleri
function gorevGunleri(ay, ad, gunler){ return ay.gunler.filter(g=>gunler.includes(g.gun) && (g.nobet.includes(ad) || g.hazirlama.includes(ad))).map(g=>g.gun); }

const izinliKadro = kadro(6, 6);
const yeniBaslayanKadro = kadro(6, 7, [s=>{ s.find(x=>x.name==="T7").baslangic = "2026-02-15"; }]);

// temizBeklenir: kadro yeterli; çizelgede hiç "hata" düzeyinde uyarı (kesin kural ihlali, eksik kişi vb.) çıkmamalı.
// Diğer senaryolarda kurallar her zaman tutamaz; onlar yalnız kayıtlı sonuçla (beklenen.json) karşılaştırılır.
// kontrol(aylar): senaryonun kurduğu durumun (izin, işe başlama) çizelgeye gerçekten yansıdığını denetler;
// bir alan adı değişip ayar sessizce yok sayılırsa test kırılır. Hata metni döndürür, sorun yoksa null.
module.exports = [
  {
    ad: "rahat-kadro",
    aciklama: "6 eczacı, 6 tekniker, izin yok",
    temizBeklenir: true,
    yil: 2026, aylar: [0, 1, 2, 3],
    staff: kadro(6, 6),
  },
  {
    ad: "uzun-izin",
    aciklama: "6 eczacı, 6 tekniker; T2 Şubat'ın 1–20'si izinli",
    yil: 2026, aylar: [0, 1, 2],
    staff: izinliKadro,
    prefs: izinli(izinliKadro, "T2", 2026, 1, aralik(1, 20)),
    kontrol: aylar=>{ const g = gorevGunleri(aylar[1], "T2", aralik(1, 20)); return g.length ? "T2 izinli olduğu Şubat günlerinde görevli: " + g.join(", ") : null; },
  },
  {
    ad: "ay-ortasi-baslayan",
    aciklama: "6 eczacı, 7 tekniker; T7 15 Şubat'ta işe başlıyor",
    yil: 2026, aylar: [0, 1, 2],
    staff: yeniBaslayanKadro,
    kontrol: aylar=>{
      const once = gorevGunleri(aylar[0], "T7", aralik(1, 31)).map(g=>g+" Ocak").concat(gorevGunleri(aylar[1], "T7", aralik(1, 14)).map(g=>g+" Şubat"));
      if (once.length) return "T7 işe başlamadan görevli: " + once.join(", ");
      return gorevGunleri(aylar[1], "T7", aralik(15, 28)).length ? null : "T7 işe başladıktan sonra Şubat'ta hiç görev almadı";
    },
  },
  {
    ad: "orta-kadro",
    aciklama: "5 eczacı, 6 tekniker: eczacı nöbeti fazla düştüğü için bazı aylarda kesin kural tutmaz",
    yil: 2026, aylar: [0, 1, 2],
    staff: kadro(5, 6),
  },
  {
    ad: "az-kadro",
    aciklama: "3 eczacı, 4 tekniker: kurallar tutmaz, en az uyarılı çizelge beklenir",
    yil: 2026, aylar: [0, 1],
    staff: kadro(3, 4),
  },
];
