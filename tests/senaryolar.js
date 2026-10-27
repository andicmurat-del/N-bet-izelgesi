// Test senaryoları: her biri bir personel listesi, izin tercihleri ve sırayla oluşturulacak aylar.
// Aylar 0'dan başlar (0 = Ocak). Kişi kimlikleri: önce eczacılar (E1..), sonra teknikerler (T1..).

function kadro(eczaci, tekniker, ek){
  const staff = [];
  for (let i=1;i<=eczaci;i++) staff.push({id:i, name:"E"+i, role:"eczaci"});
  for (let i=1;i<=tekniker;i++) staff.push({id:eczaci+i, name:"T"+i, role:"teknisyen"});
  (ek||[]).forEach(f=>f(staff));
  return staff;
}
function izinli(id, y, m, gunler){ const o = {}; gunler.forEach(d=>{ o[id+"-"+y+"-"+m+"-"+d] = "izinli"; }); return o; }
function aralik(a, b){ const r = []; for (let d=a; d<=b; d++) r.push(d); return r; }

// temizBeklenir: kadro yeterli; çizelgede hiç "hata" düzeyinde uyarı (kesin kural ihlali, eksik kişi vb.) çıkmamalı.
// Diğer senaryolarda kurallar her zaman tutamaz; onlar yalnız kayıtlı sonuçla (beklenen.json) karşılaştırılır.
module.exports = [
  {
    ad: "rahat-kadro",
    aciklama: "6 eczacı, 6 tekniker, izin yok",
    temizBeklenir: true,
    yil: 2026, aylar: [0, 1, 2, 3],
    staff: kadro(6, 6),
    prefs: {},
  },
  {
    ad: "uzun-izin",
    aciklama: "6 eczacı, 6 tekniker; T2 Şubat'ın 1–20'si izinli",
    yil: 2026, aylar: [0, 1, 2],
    staff: kadro(6, 6),
    prefs: izinli(8, 2026, 1, aralik(1, 20)),
  },
  {
    ad: "ay-ortasi-baslayan",
    aciklama: "6 eczacı, 7 tekniker; T7 15 Şubat'ta işe başlıyor",
    yil: 2026, aylar: [0, 1, 2],
    staff: kadro(6, 7, [s=>{ s.find(x=>x.name==="T7").baslangic = "2026-02-15"; }]),
    prefs: {},
  },
  {
    ad: "orta-kadro",
    aciklama: "5 eczacı, 6 tekniker: eczacı nöbeti fazla düştüğü için bazı aylarda kesin kural tutmaz",
    yil: 2026, aylar: [0, 1, 2],
    staff: kadro(5, 6),
    prefs: {},
  },
  {
    ad: "az-kadro",
    aciklama: "3 eczacı, 4 tekniker: kurallar tutmaz, en az uyarılı çizelge beklenir",
    yil: 2026, aylar: [0, 1],
    staff: kadro(3, 4),
    prefs: {},
  },
];
