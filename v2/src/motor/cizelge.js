// Çizelge motoru: eski uygulamanın (../../../index.html) kural ve arama kodu, ekrandan ve tarayıcı
// depolamasından bağımsız hale getirilerek buraya taşındı. Kural mantığı bilerek değiştirilmedi:
// test/motor.test.js aynı girdiyle eski uygulamanın kayıtlı çizelgelerini (tests/beklenen.json) birebir
// üretmesini denetler. Kuralı değiştirmek gerekirse önce testi, sonra burayı değiştirin.
//
// Ana giriş cizelgeOlustur(veri, yil, ay, secenek): veri içindeki hiçbir şeyi değiştirmez,
// {days, warnings, history} döndürür. Diğer dışa açık işlevler (puantaj, raporlar, değişim, acil servis,
// servis hazırlama) dosyanın sonunda, açıklamalarıyla; hepsi verinin kopyasıyla çalışır.

let state = null;
let simdi = Date.now;
const AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

  // ---- ayarlar (index.html 2259–2266) ----
  const AYAR_VARSAYILAN = {nobetSuresi:24, mesai:8, arifeSaat:3, hazSaat:8, fmHedef:8, minAra:3, maxThu:1, hsTercih:1, hsUst:2, cumaEsles:true, thuHaftaSonu:true, destekAylik:2, cakismaOncelik:1, niDusum:1, kurumAdi:"", onaylayan:""};
  // Ayarlar ekranında nöbetler arası en az gün, destek personeli aylık hazırlama, arife saati ve çakışma önceliği
  // değiştirilebilir; diğer kurallar (Nİ'nin düşüldüğü dilim dahil) her zaman varsayılan değerinde çalışır
  const AYAR_GIZLI = new Set(["niDusum","nobetSuresi","mesai","hazSaat","fmHedef","maxThu","thuHaftaSonu","hsTercih","hsUst","cumaEsles"]);
  function ayar(k){
    if (AYAR_GIZLI.has(k)) return AYAR_VARSAYILAN[k];
    const v = state.settings ? state.settings[k] : undefined; return (v===undefined || v===null) ? AYAR_VARSAYILAN[k] : v;
  }
  // ---- yardimcilar (index.html 2382–2456) ----
  function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }
  function jsDowToMonFirst(jsDow){ return (jsDow + 6) % 7; } // 0=Pazartesi
  function isWeekend(y,m,d){
    const dow = jsDowToMonFirst(new Date(y,m,d).getDay());
    return dow === 5 || dow === 6; // Cmt, Paz
  }
  function dateKey(y,m,d){ return y+"-"+m+"-"+d; }
  // Resmi tatil: takvimde elle işaretlenen gün (hafta içi ya da hafta sonu)
  function isManualTatil(y,m,d){ return !!state.manualTatil[dateKey(y,m,d)]; }

  // ---- personelin çalışma dönemi (işe başlama / ayrılış tarihi) ----
  function isoNo(t){ if (!t) return null; const p = String(t).split("-"); return Number(p[0])*10000 + Number(p[1])*100 + Number(p[2]); }
  function tarihNo(y,m,d){ return y*10000 + (m+1)*100 + d; }
  function aktifGunMu(st,y,m,d){ const n = tarihNo(y,m,d), b = isoNo(st.baslangic), e = isoNo(st.bitis); return (b===null || n>=b) && (e===null || n<=e); }
  function aktifAydaMi(st,y,m){ const a = tarihNo(y,m,1), z = tarihNo(y,m,daysInMonth(y,m)), b = isoNo(st.baslangic), e = isoNo(st.bitis); return (b===null || b<=z) && (e===null || e>=a); }
  // Personel listesinde: bugün itibarıyla ya da üstte seçili aydan önce ayrılmışsa 'Ayrılanlar'da gösterilir
  function listedeAyrilmisMi(st){ const e = isoNo(st.bitis); if (e===null) return false; return ayrildiMi(st) || e < tarihNo(state.year, state.month, 1); }
  function ayrildiMi(st){ const e = isoNo(st.bitis); if (e===null) return false; const n = new Date(); return e < tarihNo(n.getFullYear(), n.getMonth(), n.getDate()); }
  // tarih kaydırma (ay/yıl sınırını aşar)
  function gunKaydir(y,m,d,k){ const t = new Date(y,m,d+k); return [t.getFullYear(), t.getMonth(), t.getDate()]; }
  // İki izinli gün arasında kalan hafta sonu / resmi tatil günleri de izin sayılır: kişi tatildeyken
  // araya nöbet ya da hazırlama yazılmaz (Cuma izinli + Pazartesi izinli → Cumartesi, Pazar da izin).
  function izinArasiMi(id,y,m,d){
    if (!isTatilGunu(y,m,d) || getPref(id,y,m,d)==="izinli") return false;
    const yon = k=>{ for (let j=1; j<=7; j++){ const [a,b,c] = gunKaydir(y,m,d,k*j); if (getPref(id,a,b,c)==="izinli") return true; if (!isTatilGunu(a,b,c)) return false; } return false; };
    return yon(-1) && yon(1);
  }
  function izinliMi(id,y,m,d){ return getPref(id,y,m,d)==="izinli" || izinArasiMi(id,y,m,d); }
  // En az 5 iş günü süren yıllık izin bloğunun hemen önündeki ve arkasındaki hafta sonu / tatil günleri:
  // kişiye nöbet ya da hazırlama yazılmaz (bir haftalık izin, iki yanındaki hafta sonlarıyla birlikte kullanılır)
  const IZIN_HAFTA_GUN = 5;
  function izinHaftasiKenariMi(id,y,m,d){
    if (!isTatilGunu(y,m,d) || getPref(id,y,m,d)==="izinli") return false;
    // k yönünde tatil günlerini geç, ilk mesai günü izinliyse o yönde izin bloğunun mesai günü sayısını say
    const blok = k=>{
      let j = 1, a, b, c;
      for (; j<=10; j++){ [a,b,c] = gunKaydir(y,m,d,k*j); if (!isTatilGunu(a,b,c)) break; if (getPref(id,a,b,c)==="izinli") return 0; }
      if (j>10 || getPref(id,a,b,c)!=="izinli") return 0;
      let n = 0;
      for (let t=0; t<40; t++, j++){ [a,b,c] = gunKaydir(y,m,d,k*j); const iz = getPref(id,a,b,c)==="izinli";
        if (!isTatilGunu(a,b,c)){ if (!iz) break; n++; } }
      return n;
    };
    return blok(1) >= IZIN_HAFTA_GUN || blok(-1) >= IZIN_HAFTA_GUN;
  }
  // izinden önceki gün: ertesi gün izinli ise o gün nöbet yazılmaması tercih edilir (nöbet ertesi izni izne düşmesin)
  function izinOncesiMi(id,y,m,d){ if (izinliMi(id,y,m,d)) return false; const [a,b,c] = gunKaydir(y,m,d,1); return izinliMi(id,a,b,c); }
  // ay içinde girilen yıllık izin / rapor / nöbet izni (puantajdaki elle kayıt) — o gün görev yazılamaz
  const DURUM_KOD = ["YI","R","NI","DI"];
  function pzDurumKodu(id,y,m,d){ const a = state.puantaj && state.puantaj[y+"-"+m]; const k = a && a[id] && a[id][d]; return (k && DURUM_KOD.indexOf(k)>=0) ? k : null; }
  function kesinYasak(id,y,m,d){
    const v = getPref(id,y,m,d); if (v==="izinli" || v==="esYok") return true;
    if (pzDurumKodu(id,y,m,d)) return true;
    if (izinArasiMi(id,y,m,d)) return true;
    if (izinHaftasiKenariMi(id,y,m,d)) return true;
    const st = state.staff.find(x=>x.id===id); return !!(st && !aktifGunMu(st,y,m,d));
  }
  function prefKey(staffId,y,m,d){ return staffId+"-"+y+"-"+m+"-"+d; }
  function getPref(staffId,y,m,d){ return state.prefs[prefKey(staffId,y,m,d)] || null; }
  function clearPrefsForStaff(staffId){
    Object.keys(state.prefs).forEach(k=>{
      if (k.indexOf(staffId+"-") === 0) delete state.prefs[k];
    });
  }
  function isTatilGunu(y,m,d){ return isWeekend(y,m,d) || isManualTatil(y,m,d); }
  function isMesaiGunu(y,m,d){ return !isTatilGunu(y,m,d); }

  function isMesaiGunuGeneric(y,m,d){
    // ay dışına taşan günler için manuel tatil işareti bilinmez, sadece hafta sonu kontrolü yapılır
    return isMesaiGunu(y,m,d);
  }
  // Arife: takvimden elle işaretlenen hafta içi gün. Tatil sayılmaz; normal mesai yarım gündür (ayar: arifeSaat).
  function isArife(y,m,d){ return !!(state.arife && state.arife[dateKey(y,m,d)]); }
  // o günün normal mesai saati: tatilde 0, arifede arifeSaat, diğer günlerde mesai
  function gunMesaiSaati(y,m,d){ if (!isMesaiGunu(y,m,d)) return 0; return isArife(y,m,d) ? ayar('arifeSaat') : ayar('mesai'); }
  // ---- roller ve kesin kurallar (index.html 2698–2786) ----
  function roleLabel(role){ return role==="eczaci" ? "Eczacı" : (role==="destek" ? "Destek Personeli" : (role==="servis" ? "Acil servis nöbetçi eczacı" : (role==="nobetci" ? "Dışarıdan nöbete gelen eczacı" : "Teknikeri"))); }
  function nobetciRol(r){ return r==="eczaci" || r==="teknisyen" || r==="nobetci"; }
  // KESİN KURALLAR (çizelge oluşturma, elle düzenleme ve uyarılarda ortak)
  //  - Fazla mesai: destek personeli hariç nöbetçi personel arasında aylık fazla mesai farkı en fazla FM_MAX_FARK saat
  //  - Hafta sonu: kişiye ayda en fazla 1 Cumartesi ve 1 Pazar nöbeti; Cuma + Cumartesi + Pazar üçü birden yazılmaz
  const FM_MAX_FARK = 8;

  // ÇİZELGE OLUŞTURMA AĞIRLIKLARI (tek yerde, öncelik sırasıyla)
  // Arama, aşağıdaki cezaların toplamını en aza indirir. Büyük ağırlık = yüksek öncelik. Bir kuralın birimi
  // (1 saat, 1 nöbet, 1 kişi…) başına verilen cezadır; ssIx ile kullanılanlar kare sapma toplamıyla çarpılır.
  //  1. UYARI: uyarı çıkaran her durum. Öncelik her zaman uyarısız çizelgedir; diğer tüm cezaların toplamından büyüktür.
  //  2. Kesin kurallar (yüz binler ve üzeri): uyarı düzeyine ek olarak ihlalin büyüklüğünü ayırt eder.
  //  3. Güçlü tercihler (on binler, yüz binler): ancak başka çare yoksa esner.
  //  4. Yıllık eşitlik ve aylık düzen (binler, yüzler): adalet; birbirleriyle dengelenir.
  //  5. Aylık denge ve ince ayar (onlar, birler): eşitlik bozulmadan karşılanan tercihler.
  // Günlük tercihler (thuHs, cuPaz, istiyor, araGun) gunTercihCarpani (3) ile çarpılır; etkin değerleri yanlarında yazılı.
  // Bir değeri değiştirmeden önce: testler (npm test) senaryolarda hata sayısının artmadığını denetler.
  const KESIN_AGIRLIK = 2e6, GUNYIL_AGIRLIK = 1.5e6;
  const AGIRLIK = Object.freeze({
    // 1. uyarı
    UYARI: 1e11,
    // 2. kesin kurallar
    KESIN: KESIN_AGIRLIK,                    // genel kesin kural birimi: aylık nöbet sayısı farkı 2'yi aşan her nöbet; fazla mesai farkı 8 saati aşan her saat
    fmBant: KESIN_AGIRLIK*0.25,              // fazla mesai: herkesi 8 saatlik tek aralığa sokmak için gereken toplam saat (arama düzlükte takılmasın)
    hzFarkHazirlamaOncelik: KESIN_AGIRLIK*200, // hazırlama farkı 1'i aşınca, Ayarlar'da "hazırlama eşitliği" öncelikliyse
    hzFarkSaatOncelik: 300000,               // hazırlama farkı 1'i aşınca, Ayarlar'da "fazla mesai saati" öncelikliyse
    destekSayi: KESIN_AGIRLIK*40,            // destek personeli ayda tam ayardaki sayı kadar hazırlama alır (her fark için)
    tekOnce: KESIN_AGIRLIK*10,               // hazırlama önce teknikerlere: eczacının (yıllık) hazırlaması teknikerinkini geçmez
    resmiYilToplam: 2*GUNYIL_AGIRLIK,        // yıllık resmi tatil görevi (nöbet + hazırlama) farkı 1'i aşınca
    gunYil: GUNYIL_AGIRLIK,                  // yıllık Perşembe / Cuma / Cumartesi / Pazar / resmi tatil nöbeti farkı 1'i aşınca
    hsKural: 500000,                         // ayda en fazla 1 Cumartesi, 1 Pazar; Cuma + Cumartesi + Pazar birlikte olmaz
    // 3. güçlü tercihler
    prepUst: 400000,                         // eczacı / tekniker ayda en fazla 2 hazırlama
    grupHazFark: 300000,                     // eczacılar kendi arasında, teknikerler kendi arasında aylık hazırlama farkı 1'i aşınca
    hsEnAz1: 150000,                         // ayda en az 1 Cumartesi/Pazar nöbeti (uygun gün varsa)
    nobetFark: 100000,                       // aylık nöbet sayısı farkı 1'i aşınca
    hsUst: 80000,                            // ayda Cumartesi/Pazar nöbeti ayardaki üst sınırı aşınca
    thuHs: 20000,                            // Perşembe nöbeti tutana aynı hafta sonu nöbet (etkin: ×3 = 60000)
    // 4. yıllık eşitlik ve aylık düzen
    cuPaz: 2000,                             // Cuma nöbeti tutana aynı hafta Pazar nöbeti / hazırlaması (etkin: ×3 = 6000)
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
    araGun: 1,                               // iki nöbet arası ayardaki en az günden kısa (etkin: ×3 = 3)
    gunTercihCarpani: 3,                     // günlük tercih toplamının (thuHs, cuPaz, istiyor, araGun) çarpanı
  });
  // fazla mesai kuralına giren kişiler: ayın tamamında çalışan eczacı, tekniker ve dışarıdan gelen eczacı
  function fmKuralKisileri(y, m){ const dim = daysInMonth(y,m); return state.staff.filter(s=>nobetciRol(s.role) && aktifGunMu(s,y,m,1) && aktifGunMu(s,y,m,dim)); }
  // günlere göre kişi başı aylık fazla mesai (nöbet + hazırlama saatleri)
  function ayFmTablosu(days){ const hz = ayar('hazSaat'), t = {};
    days.forEach(g=>{ (g.assigned||[]).forEach(p=>{ t[p.id] = (t[p.id]||0) + (g.fazlaMesai||0); }); (g.prep||[]).forEach(p=>{ t[p.id] = (t[p.id]||0) + hz; }); });
    return t; }
  function fmFarkBilgisi(y, m, days){
    const t = ayFmTablosu(days), k = fmKuralKisileri(y,m); if (k.length < 2) return {fark:0, kisiler:k, t};
    let enAz = k[0], enCok = k[0];
    k.forEach(s=>{ if ((t[s.id]||0) < (t[enAz.id]||0)) enAz = s; if ((t[s.id]||0) > (t[enCok.id]||0)) enCok = s; });
    return {fark:(t[enCok.id]||0)-(t[enAz.id]||0), enAz, enCok, t, kisiler:k};
  }
  // kişinin ay içindeki Cuma / Cumartesi / Pazar nöbet sayıları
  function hsSayilari(y, m, days, id){ const r = {cu:0, cmt:0, paz:0};
    days.forEach(g=>{ if (!(g.assigned||[]).some(p=>p.id===id)) return; const w = jsDowToMonFirst(new Date(y,m,g.day).getDay());
      if (w===4) r.cu++; else if (w===5) r.cmt++; else if (w===6) r.paz++; });
    return r; }
  function hsKuralIhlali(r){ const o = [];
    if (r.cmt > 1) o.push(r.cmt+" Cumartesi");
    if (r.paz > 1) o.push(r.paz+" Pazar");
    if (r.cu>0 && r.cmt>0 && r.paz>0) o.push("Cuma + Cumartesi + Pazar");
    return o; }
  function eczaciMi(r){ return r==="eczaci" || r==="nobetci"; }
  function hazirlamaRol(r){ return r==="eczaci" || r==="teknisyen" || r==="nobetci"; }
  // ---- yıllık devir (index.html 2881–2965) ----
  function hsDevir(y, m){ return gunTipiDevir(y, m, (yy,mm,dd)=>new Date(yy,mm,dd).getDay()%6===0); }
  // Cuma nöbeti (Cuma resmi tatil değilse): ertesi gün Cumartesi olduğundan 16 saat fazla mesai yazar
  // (düşülecek nöbet izni yoktur). Cuma nöbetleri de yıl içinde eşit paylaşılır; hafta sonu ve Cuma eşit
  // olunca fazla mesai eşitliği nöbet sayısı eşitliği demektir. Puantajdaki "Cuma" sütunu bu sayıdır.
  function cumaTipiMi(y,m,d){ return new Date(y,m,d).getDay()===5 && !isTatilGunu(y,m,d); }
  function cuDevir(y, m){ return gunTipiDevir(y, m, cumaTipiMi); }
  // Cumartesi (24 saat) ve Pazar (16 saat) nöbetleri ayrı ayrı da yıl içinde eşit paylaşılır
  function cmtDevir(y, m){ return gunTipiDevir(y, m, (yy,mm,dd)=>new Date(yy,mm,dd).getDay()===6); }
  // Perşembe nöbetleri de yıl içinde eşit paylaşılır (Perşembe nöbetçisinin hafta sonu boş kaldığından tek kişide toplanmasın)
  function pzrDevir(y, m){ return gunTipiDevir(y, m, (yy,mm,dd)=>new Date(yy,mm,dd).getDay()===4); }
  function pazDevir(y, m){ return gunTipiDevir(y, m, (yy,mm,dd)=>new Date(yy,mm,dd).getDay()===0); }
  // Yıl içinde kişi başı Perşembe / Cuma / Cumartesi / Pazar / resmi tatil NÖBET sayıları (ham sayı, Ocak'tan m. aya kadar;
  // curDays verilirse m. ayın günleri de eklenir). Kural: herkes birini almadan kimse ikincisini almasın (fark en fazla 1).
  const YIL_GUN_TIP = [["pe","Perşembe"],["cu","Cuma"],["cmt","Cumartesi"],["paz","Pazar"],["rt","Resmi tatil"]];
  // Dönüş: kişi başı {pe, cu, cmt, paz, rt} = ekip ortalamasına göre fark (yalnız kişinin çalıştığı aylar; yeni başlayan
  // personel önceki aylar için borçlu sayılmaz) ve ham sayılar (ham).
  function yilGunSayilari(y, m, curDays){
    const r = {}, T = ["pe","cu","cmt","paz","rt"];
    const kayit = id=> r[id] || (r[id] = {pe:0, cu:0, cmt:0, paz:0, rt:0, ham:{pe:0, cu:0, cmt:0, paz:0, rt:0}});
    const ay = (mm, gunler)=>{
      const hv = state.staff.filter(s=>(eczaciMi(s.role) || s.role==="teknisyen") && aktifAydaMi(s,y,mm)); if (!hv.length) return;
      const c = {}; hv.forEach(s=>{ c[s.id] = {pe:0, cu:0, cmt:0, paz:0, rt:0}; });
      gunler.forEach(d=>{ if (!d) return; const dw = new Date(y, mm, d.day).getDay(), rt = isManualTatil(y, mm, d.day);
        (d.assigned||[]).forEach(p=>{ const o = c[p.id]; if (!o) return; if (dw===4) o.pe++; else if (dw===5) o.cu++; else if (dw===6) o.cmt++; else if (dw===0) o.paz++; if (rt) o.rt++; }); });
      T.forEach(t=>{ const ort = hv.reduce((a,s)=>a+c[s.id][t], 0)/hv.length; hv.forEach(s=>{ const o = kayit(s.id); o[t] += c[s.id][t] - ort; o.ham[t] += c[s.id][t]; }); });
    };
    for (let mm=0; mm<m; mm++){ const sc = state.schedules && state.schedules[y+"-"+mm]; if (sc && Array.isArray(sc.days)) ay(mm, sc.days); }
    if (curDays) ay(m, curDays);
    return r;
  }
  // Yıllık nöbet sayısı dengesi: aynı yılın önceki aylarında tutulan nöbet sayısının o ayın nöbetçi
  // ortalamasından farkı (fazla mesai gibi izinden bağımsız: izin mesai sayıldığından herkesten eşit pay beklenir).
  function nobetDevir(y, m){
    const off = {};
    for (let mm=0; mm<m; mm++){
      const sc = state.schedules[y+"-"+mm]; if (!sc || !Array.isArray(sc.days)) continue;
      const hv = state.staff.filter(s=>(eczaciMi(s.role) || s.role==="teknisyen") && aktifAydaMi(s,y,mm)); if (!hv.length) continue;
      const c = {}; hv.forEach(s=>{ c[s.id] = 0; });
      sc.days.forEach(d=>{ (d.assigned||[]).forEach(p=>{ if (c[p.id]!==undefined) c[p.id]++; }); });
      const ort = hv.reduce((t,s)=>t+c[s.id], 0) / hv.length;
      hv.forEach(s=>{ off[s.id] = (off[s.id]||0) + c[s.id] - ort; });
    }
    return off;
  }
  function gunTipiDevir(y, m, tipMi){
    const off = {};
    for (let mm=0; mm<m; mm++){
      const sc = state.schedules[y+"-"+mm]; if (!sc || !Array.isArray(sc.days)) continue;
      const hsGun = sc.days.filter(d=>d && tipMi(y,mm,d.day));
      if (!hsGun.length) continue;
      [state.staff.filter(s=>(eczaciMi(s.role) || s.role==="teknisyen") && aktifAydaMi(s,y,mm))].forEach(hv=>{
        if (!hv.length) return;
        const say = {}, mus = {}; let top = 0, musTop = 0;
        hv.forEach(s=>{ say[s.id] = 0; mus[s.id] = 0; });
        hsGun.forEach(d=>{
          (d.assigned||[]).forEach(p=>{ if (say[p.id]!==undefined){ say[p.id]++; top++; } });
          hv.forEach(s=>{ if (aktifGunMu(s,y,mm,d.day) && !kesinYasak(s.id,y,mm,d.day)){ mus[s.id]++; musTop++; } });
        });
        if (!musTop) return;
        hv.forEach(s=>{ off[s.id] = (off[s.id]||0) + say[s.id] - top*mus[s.id]/musTop; });
      });
    }
    return off;
  }
  function resmiDevir(y, m){
    const off = {}, say = {}, offH = {}, sayH = {};
    for (let mm=0; mm<m; mm++){
      const sc = state.schedules[y+"-"+mm]; if (!sc || !Array.isArray(sc.days)) continue;
      const rg = sc.days.filter(d=>d && isManualTatil(y,mm,d.day)); if (!rg.length) continue;
      const cN = {}, cH = {};
      rg.forEach(d=>{ (d.assigned||[]).forEach(p=>{ cN[p.id] = (cN[p.id]||0) + 1; }); (d.prep||[]).forEach(p=>{ cH[p.id] = (cH[p.id]||0) + 1; }); });
      // her havuz kendi içinde: nöbetçiler (nöbet), eczacı/tekniker (hazırlama), destek personeli (hazırlama)
      const havuzlar = [
        [state.staff.filter(s=>nobetciRol(s.role) && aktifAydaMi(s,y,mm)), cN, off, say],
        [state.staff.filter(s=>hazirlamaRol(s.role) && aktifAydaMi(s,y,mm)), cH, offH, sayH],
        [state.staff.filter(s=>s.role==="destek" && aktifAydaMi(s,y,mm)), cH, offH, sayH]
      ];
      havuzlar.forEach(([hv, c, o, sy])=>{
        if (!hv.length) return;
        const ort = hv.reduce((t,s)=>t+(c[s.id]||0), 0) / hv.length;
        hv.forEach(s=>{ o[s.id] = (o[s.id]||0) + (c[s.id]||0) - ort; sy[s.id] = (sy[s.id]||0) + (c[s.id]||0); });
      });
    }
    return {off, say, offH, sayH};
  }
  // ---- aylık istatistik ve fazla mesai (index.html 3060–3139) ----
  function ayIstatistik(sch){
    const r = {};
    const dimS = daysInMonth(sch.year, sch.month);
    sch.days.forEach(d=>{
      const fmGun = computeFazlaMesaiForDay(sch.year, sch.month, d.day, dimS);
      const dw = jsDowToMonFirst(new Date(sch.year, sch.month, d.day).getDay());
      d.assigned.forEach(p=>{
        const x = r[p.id] || (r[p.id] = {fm:0, thu:0, sat:0, sun:0, cum:0, nobet:0, prep:0});
        x.fm += fmGun; x.nobet++;
        if (dw===3) x.thu++; if (dw===4) x.cum++; if (dw===5) x.sat++; if (dw===6) x.sun++;
      });
      (d.prep||[]).forEach(pp=>{
        const x = r[pp.id] || (r[pp.id] = {fm:0, thu:0, sat:0, sun:0, cum:0, nobet:0, prep:0});
        x.fm += ayar('hazSaat'); x.prep++;
      });
    });
    return r;
  }
  function ayVeriVarMi(sch){ return sch.days.some(d=>d.assigned.length>0); }
  // y/m öncesindeki aylardan: kişi başı devreden fazla mesai (ortalamaya göre fark),
  // ve hemen önceki ayın Perşembe/Cumartesi/Pazar bilgisi
  function devirHesapla(y, m){
    // Aylık sapma yöntemi: her geçmiş ayda, o ay çalışan kişilerin ortalamasına göre sapma toplanır.
    // Böylece sonradan gelen ya da ayrılan personel eski aylar için "eksik/fazla" sayılmaz;
    // sadece çalıştığı aylardaki yük farkı telafi edilir.
    // Her takvim yılı kendi içinde değerlendirilir: önceki yılların nöbetleri yeni yılı bağlamaz, Ocak'ta sayım sıfırdan başlar.
    const cur = y*12 + m;
    const aylar = [];
    Object.keys(state.schedules||{}).forEach(k=>{
      const sch = state.schedules[k];
      if (!sch || !ayVeriVarMi(sch)) return;
      const idx = sch.year*12 + sch.month;
      if (idx >= cur || sch.year !== y) return;
      aylar.push({idx, y:sch.year, m:sch.month, st: ayIstatistik(sch)});
    });
    aylar.sort((a,b)=>a.idx-b.idx);
    const ilkGorulen = {};
    aylar.forEach(a=>{ Object.keys(a.st).forEach(id=>{ const n = Number(id); if (ilkGorulen[n]===undefined) ilkGorulen[n] = a.idx; }); });
    function varMi(st, a){
      if (!aktifAydaMi(st, a.y, a.m)) return false;
      if (st.baslangic) return true;
      return ilkGorulen[st.id]!==undefined && a.idx >= ilkGorulen[st.id];
    }
    const sapma = {}, prepSapma = {};
    let oncekiAy = null, haveCum = false;
    aylar.forEach(a=>{
      const duty = state.staff.filter(s=>nobetciRol(s.role) && varMi(s,a));
      if (duty.length){
        haveCum = true;
        const v = duty.map(s=>(a.st[s.id]||{fm:0}).fm), ort = v.reduce((x,z)=>x+z,0)/duty.length;
        duty.forEach((s,i)=>{ sapma[s.id] = (sapma[s.id]||0) + (v[i]-ort); });
      }
      [state.staff.filter(s=>hazirlamaRol(s.role) && varMi(s,a)), state.staff.filter(s=>s.role==="destek" && varMi(s,a))].forEach(h=>{
        if (!h.length) return;
        const v = h.map(s=>(a.st[s.id]||{prep:0}).prep), ort = v.reduce((x,z)=>x+z,0)/h.length;
        h.forEach((s,i)=>{ prepSapma[s.id] = (prepSapma[s.id]||0) + (v[i]-ort); });
      });
      if (a.idx === cur-1) oncekiAy = a.st;
    });
    const duty = state.staff.filter(s=>nobetciRol(s.role));
    const off = {}, prepOff = {};
    state.staff.forEach(s=>{ off[s.id] = sapma[s.id]||0; prepOff[s.id] = prepSapma[s.id]||0; });
    const prev = {};
    duty.forEach(s=>{ prev[s.id] = (oncekiAy && oncekiAy[s.id]) ? oncekiAy[s.id] : {thu:0, sat:0, sun:0}; });
    return {off, prepOff, prepToplam:{}, prev, havePrev: !!oncekiAy, haveCum, toplam:{}};
  }

  // nöbet fazla mesaisi = nöbet süresi − o günün normal mesaisi − ertesi günün normal mesaisi (arife yarım gün)
  function computeFazlaMesaiForDay(y,m,d,dim){
    let ny = y, nm = m, nd = d+1;
    if (d >= dim){ nm = m===11?0:m+1; ny = m===11?y+1:y; nd = 1; }
    return Math.max(0, ayar('nobetSuresi') - gunMesaiSaati(y,m,d) - gunMesaiSaati(ny,nm,nd));
  }

  // seçili ay için bir taslak çizelge garanti eder: zaten varsa (elle girilmiş
  // günler dahil) dokunmaz, yoksa tüm günleri boş/kilitsiz olarak oluşturur
  function fmYenile(sch){
    const dimS = daysInMonth(sch.year, sch.month);
    sch.days.forEach(d=>{ d.fazlaMesai = computeFazlaMesaiForDay(sch.year, sch.month, d.day, dimS); });
  }
  // ---- motor (index.html 3163–4319) ----
  function generateSchedule(y, m, varyasyon){
    const vary = (typeof varyasyon === "number") ? varyasyon : 0;
    const dim = daysInMonth(y,m);
    const eczacilar = state.staff.filter(s=>eczaciMi(s.role) && aktifAydaMi(s,y,m));
    const teknisyenler = state.staff.filter(s=>s.role==="teknisyen" && aktifAydaMi(s,y,m));

    if (eczacilar.length + teknisyenler.length < 2){
      return {days: null, warnings: ["Toplam personel sayısı günde 2 kişi için yetersiz."], history: null};
    }

    // varsa elle girilmiş taslak korunur (kilitli günler), yoksa boş taslak
    const existingDays = taslakGunler(y, m);

    const devir = devirHesapla(y, m);
    // "farklı şekilde oluştur": eşit durumlarda kişi sırası ve arama tohumu değişir
    const sira = {};
    (function(){
      const ids = state.staff.map(s=>s.id);
      if (vary > 0){
        let t = (vary * 2654435761) >>> 0;
        const r = ()=>{ t = (t*1664525 + 1013904223) >>> 0; return t/4294967296; };
        for (let i=ids.length-1; i>0; i--){ const j = Math.floor(r()*(i+1)); const tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp; }
      }
      ids.forEach((id,ix)=>{ sira[id] = ix; });
    })();
    const resmiDv = resmiDevir(y, m);   // aynı yılın önceki aylarından resmi tatil nöbeti dengesi
    const hsDv = hsDevir(y, m);         // aynı yılın önceki aylarından Cumartesi/Pazar nöbeti dengesi
    const cuDv = cuDevir(y, m);         // aynı yılın önceki aylarından Cuma nöbeti dengesi
    const peDv = pzrDevir(y, m);        // aynı yılın önceki aylarından Perşembe nöbeti dengesi
    const cuCount = {};
    const cmtDv = cmtDevir(y, m), pazDv = pazDevir(y, m);   // aynı yılın önceki aylarından Cumartesi / Pazar dengesi
    const cmtCount = {}, pazCount = {}, cumaGunCount = {};   // cumaGunCount: bu ay tutulan (gerçek) Cuma nöbeti
    const nDv = nobetDevir(y, m);       // aynı yılın önceki aylarından nöbet sayısı dengesi
    // kişinin bu ay d. günden itibaren kalan, kesin yasağı olmayan Cumartesi/Pazar günü sayısı
    const hsKalanOnb = {};
    function hsKalan(id, d){ const k = id+"-"+d; if (hsKalanOnb[k]!==undefined) return hsKalanOnb[k];
      let n = 0; const son = new Date(y, m+1, 0).getDate();
      for (let g=d; g<=son; g++){ const w = dowOfDay(g); if ((w===5||w===6) && !kesinYasak(id,y,m,g)) n++; }
      return (hsKalanOnb[k] = n); }
    const resmiCount = {};              // id -> bu ay (şimdiye kadar) resmi tatil nöbeti
    const dutyCount = {}; // id -> toplam nöbet
    const totalFM = {};   // id -> o ana kadar birikmiş fazla mesai (adil dağılım için)
    const weekendCount = {}; // id -> o ana kadar tutulan hafta sonu (Cmt/Paz) nöbeti sayısı
    const thursdayCount = {}; // id -> bu ay tutulan Perşembe nöbeti sayısı (kişi başı en fazla 1 hedeflenir)
    const lastDutyDay = {}; // id -> en son nöbet tuttuğu gün no (sıralı nöbeti önlemek için)
    state.staff.forEach(s=>{ dutyCount[s.id]=0; totalFM[s.id]=(devir.off[s.id]||0); weekendCount[s.id]=0; cuCount[s.id]=0; thursdayCount[s.id]=0; resmiCount[s.id]=0; });
    const HAZ_SAAT = ayar('hazSaat');   // hazırlama personeli fazla mesaisi (saat)
    const HAZ_SAYISI = 2; // tatil günü başına hazırlama personeli sayısı

    function dowOfDay(d){ return jsDowToMonFirst(new Date(y,m,d).getDay()); }

    // aday havuzunu daralt: "izinli" işaretli kişi istisnasız hariç tutulur;
    // sonra dinlenme + "istemiyor" kuralına uy, hiçbiri kalmazsa sırayla
    // bu kuralları gevşet (ve conflict=true işaretle) — izinli asla gevşetilmez.
    // NOT: gün-tipi tercihleri (3 gün ara, Perşembe/hafta sonu, ay-aşırı telafi) burada
    // ELENMEZ; adalet (fazla mesai/nöbet sayısı) bozulmasın diye sadece sıralamada
    // yumuşak kıstas olarak kullanılır (bkz. sortByPref).
    // ayrılan personelin son çalışma günü: ertesi gün mesai günüyse nöbet izni kullanamaz, nöbet yazılmaz
    const sonGunEngelSet = {};
    state.staff.forEach(s=>{ if (!s.bitis) return; const b = isoNo(s.bitis); for (let d=1; d<=dim; d++){ if (tarihNo(y,m,d)===b){ const nm2 = m===11 ? 0 : m+1, ny2 = m===11 ? y+1 : y; const ertesiMs = d<dim ? gunMesaiSaati(y,m,d+1) : gunMesaiSaati(ny2,nm2,1); if (ertesiMs>0) sonGunEngelSet[s.id+"-"+d] = true; } } });
    const sonGunEngelBos = Object.keys(sonGunEngelSet).length===0;   // çoğu ay boştur: aramada anahtar oluşturmaya gerek kalmaz
    function sonGunEngel(id, d){ return !sonGunEngelBos && !!sonGunEngelSet[id+"-"+d]; }
    function pickCandidates(y,m,d, pool, restingIds){
      let notOnLeave = pool.filter(s=> !kesinYasak(s.id,y,m,d) && !sonGunEngel(s.id,d));
      // kesin kural: ayda en fazla 1 Cumartesi, 1 Pazar; Cuma + Cumartesi + Pazar üçü birden olmaz
      { const dw = dowOfDay(d), uy = notOnLeave.filter(s=>{ const cu = cumaGunCount[s.id]||0, ct = cmtCount[s.id]||0, pz = pazCount[s.id]||0;
          if (dw===5) return ct===0 && !(cu>0 && pz>0);
          if (dw===6) return pz===0 && !(cu>0 && ct>0);
          if (dw===4) return !(ct>0 && pz>0);
          return true; });
        if (uy.length) notOnLeave = uy; }
      const notResting = notOnLeave.filter(s=>!restingIds.has(s.id));
      const notRestingNoAvoid = notResting.filter(s=> getPref(s.id,y,m,d)!=='avoid' && !izinOncesiMi(s.id,y,m,d));
      if (notRestingNoAvoid.length>0) return {list: notRestingNoAvoid, conflict:false};
      if (notResting.length>0) return {list: notResting, conflict:true};
      const noAvoidOnly = notOnLeave.filter(s=> getPref(s.id,y,m,d)!=='avoid');
      if (noAvoidOnly.length>0) return {list: noAvoidOnly, conflict:true};
      return {list: notOnLeave, conflict: notOnLeave.length>0};
    }
    // istediği gün işaretleyenleri öne al; ASIL BELİRLEYİCİ olarak birikmiş toplam fazla
    // mesaisi en az olana, sonra nöbet sayısı en az olana öncelik verilir; gün Cumartesi/
    // Pazar ise bunlara ek olarak o ana kadar en az hafta sonu nöbeti tutmuş olana da
    // öncelik verilir (herkese eşite yakın hafta sonu dağıtmak için) — bunlardan sonra,
    // yalnızca eşitlik durumunda devreye giren yumuşak tercihler (telafi, 3 gün ara,
    // Perşembe/hafta sonu) gelir; hiçbiri saat/hafta sonu eşitliğini bozacak şekilde öne
    // çıkamaz
    function sortByPref(list, y,m,d){
      const todayDow = dowOfDay(d);
      const resmiBugun = isManualTatil(y,m,d);
      const isWeekendDay = (todayDow === 5 || todayDow === 6);
      const cumaTipiBugun = cumaTipiMi(y,m,d);
      function gapPenalty(id){
        const last = lastDutyDay[id];
        if (last === undefined) return 0;
        return (d - last) >= ayar('minAra') ? 0 : 1;
      }
      function thursdayPenalty(id){
        if (!ayar('thuHaftaSonu')) return 0;
        if (todayDow !== 5 && todayDow !== 6) return 0;
        const last = lastDutyDay[id];
        if (last === undefined) return 0;
        return dowOfDay(last) === 3 ? 1 : 0;
      }
      return list.slice().sort((a,b)=>{
        if (isWeekendDay){
          // bu ay henüz hafta sonu nöbeti olmayan öne (ayda en az 1 hafta sonu)
          const a0 = weekendCount[a.id]>0 ? 1 : 0, b0 = weekendCount[b.id]>0 ? 1 : 0;
          if (a0!==b0) return a0-b0;
          // ikisi de 0 ise: bu ay kalan uygun hafta sonu günü az olan öne (izne çıkacak olan kaçırmasın)
          if (a0===0){ const ak = hsKalan(a.id, d), bk = hsKalan(b.id, d); if (ak!==bk) return ak-bk; }
          // yıl içinde (önceki aylar + bu ay) hafta sonu nöbeti payına göre az olan öne
          const ah = weekendCount[a.id] + (hsDv[a.id]||0), bh = weekendCount[b.id] + (hsDv[b.id]||0);
          if (Math.abs(ah-bh) >= 0.5) return ah-bh;
          // aynı gün türü (Cumartesi ya da Pazar) yıl içinde payına göre az olan öne
          const gc = todayDow===5 ? [cmtCount, cmtDv] : [pazCount, pazDv];
          const ag = (gc[0][a.id]||0) + (gc[1][a.id]||0), bg = (gc[0][b.id]||0) + (gc[1][b.id]||0);
          if (Math.abs(ag-bg) >= 0.5) return ag-bg;
          // geçen ay Pazar tutan bu ay Cumartesi, Cumartesi tutan Pazar'a öncelikli
          function tur(id){
            const pv = devir.prev[id]; if (!pv) return 0;
            if (todayDow===5) return pv.sun>0 ? -1 : (pv.sat>0 ? 1 : 0);
            return pv.sat>0 ? -1 : (pv.sun>0 ? 1 : 0);
          }
          const ta = tur(a.id), tb = tur(b.id);
          if (ta!==tb) return ta-tb;
        }
        if (todayDow===3){
          const at = thursdayCount[a.id]>=ayar('maxThu') ? 1 : 0, bt = thursdayCount[b.id]>=ayar('maxThu') ? 1 : 0;
          if (at!==bt) return at-bt;
          // geçen ay Perşembe nöbeti almayanlara öncelik
          const pa = (devir.prev[a.id]||{thu:0}).thu>0 ? 1 : 0, pb = (devir.prev[b.id]||{thu:0}).thu>0 ? 1 : 0;
          if (pa!==pb) return pa-pb;
        }
        if (resmiBugun){
          // resmi tatil nöbeti: yıl içinde en az resmi tatil nöbeti tutana öncelik
          const ra = (resmiDv.off[a.id]||0) + (resmiCount[a.id]||0), rb = (resmiDv.off[b.id]||0) + (resmiCount[b.id]||0);
          if (Math.abs(ra-rb) > 1e-9) return ra-rb;
        }
        if (cumaTipiBugun){
          // Cuma: yıl içinde Cuma nöbetini payına göre az tutan öne
          const ac = (cuCount[a.id]||0) + (cuDv[a.id]||0), bc = (cuCount[b.id]||0) + (cuDv[b.id]||0);
          if (Math.abs(ac-bc) >= 0.5) return ac-bc;
        }
        if (totalFM[a.id] !== totalFM[b.id]) return totalFM[a.id]-totalFM[b.id];
        if (dutyCount[a.id] !== dutyCount[b.id]) return dutyCount[a.id]-dutyCount[b.id];
        if (isWeekendDay && weekendCount[a.id] !== weekendCount[b.id]) return weekendCount[a.id]-weekendCount[b.id];
        // "istiyor": eşit ve adil dağıtımın önüne geçmez, yalnız eşitlik hâlinde tercih edilir
        const aw = getPref(a.id,y,m,d)==='want' ? 0 : 1, bw = getPref(b.id,y,m,d)==='want' ? 0 : 1;
        if (aw!==bw) return aw-bw;
        const ag = gapPenalty(a.id), bg = gapPenalty(b.id);
        if (ag!==bg) return ag-bg;
        const at = thursdayPenalty(a.id), bt = thursdayPenalty(b.id);
        if (at!==bt) return at-bt;
        return sira[a.id]-sira[b.id];
      });
    }

    const days = [];
    // ay sınırı: önceki ayın son günü ve (varsa) sonraki ayın 1. günündeki nöbetçi / hazırlama personeli
    const _pmY = m===0 ? y-1 : y, _pmM = m===0 ? 11 : m-1, _nmY = m===11 ? y+1 : y, _nmM = m===11 ? 0 : m+1;
    const _oS = state.schedules[_pmY+"-"+_pmM], _sS = state.schedules[_nmY+"-"+_nmM];
    const _oSon = (_oS && _oS.days && _oS.days.length) ? _oS.days[_oS.days.length-1] : null;
    const _sIlk = (_sS && _sS.days && _sS.days.length) ? _sS.days[0] : null;
    // önceki ayın son 4 günündeki nöbetçiler (5 gün içinde 3 nöbet kuralı ay sınırında da geçerli)
    const oncekiSonGunler = {};
    // ay sınırı dinlenme kuralları gerçekte çalışılana göre (puantajdaki nöbet değişimleri dahil)
    for (let k=1; k<=4; k++){ const [a,b,c] = gunKaydir(y, m, 1, -k); oncekiSonGunler[k] = gercekGorev(a, b, c).N; }
    function nobetVarIdx(id, j){
      if (j >= 0) return j < days.length && !!days[j] && days[j].assigned.some(p=>p.id===id);
      return (oncekiSonGunler[-j]||[]).indexOf(id) >= 0;
    }
    // aynı kişiye 5 gün içinde 3 nöbet yazılmaz (ör. Pazartesi–Çarşamba–Cuma); 2 gün arayla tek bir tekrar olabilir
    function ucluSikisik(id, idx){
      const v = k=>nobetVarIdx(id, idx+k);
      return (v(-2) && v(-4)) || (v(-2) && v(2)) || (v(2) && v(4));
    }
    const _oG = _oSon ? gercekGorev(_pmY, _pmM, _oSon.day) : {N:[], H:[]}, _sG = _sIlk ? gercekGorev(_nmY, _nmM, 1) : {N:[], H:[]};
    const oncekiSonN = _oG.N, oncekiSonH = _oG.H;
    const sonrakiIlkN = _sG.N, sonrakiIlkH = _sG.H;
    let prevAssigned = oncekiSonN.slice();

    for (let d=1; d<=dim; d++){
      const tatil = isTatilGunu(y,m,d);
      const fazlaMesai = computeFazlaMesaiForDay(y,m,d,dim);
      const existing = existingDays[d-1];

      // elle girilip kilitlenmiş gün: dokunma, sadece sayaçları/adaleti güncelle
      if (existing && existing.locked){
        const assigned = existing.assigned;
        const ids = assigned.map(p=>p.id);
        const dow = dowOfDay(d);
        ids.forEach(id=>{
          dutyCount[id] = (dutyCount[id]||0) + 1;
          totalFM[id] = (totalFM[id]||0) + fazlaMesai;
          lastDutyDay[id] = d;
          if (dow===5 || dow===6) weekendCount[id] = (weekendCount[id]||0) + 1;
          if (dow===5) cmtCount[id] = (cmtCount[id]||0) + 1; else if (dow===6) pazCount[id] = (pazCount[id]||0) + 1; else if (dow===4) cumaGunCount[id] = (cumaGunCount[id]||0) + 1;
          if (cumaTipiMi(y,m,d)) cuCount[id] = (cuCount[id]||0) + 1;
          if (dow===3) thursdayCount[id] = (thursdayCount[id]||0) + 1;
          if (isManualTatil(y,m,d)) resmiCount[id] = (resmiCount[id]||0) + 1;
        });
        const kilitliPrep = existing.prep || [];
        kilitliPrep.forEach(pp=>{ totalFM[pp.id] = (totalFM[pp.id]||0) + HAZ_SAAT; });
        days.push({ day:d, tatil, conflict: existing.conflict||false, fazlaMesai, assigned, prep: kilitliPrep, locked:true });
        prevAssigned = ids;
        continue;
      }

      const restingIds = new Set(prevAssigned);
      // kilitli günlerde hazırlama personeli olanlar, komşu günlerde nöbetçi yazılmasın
      [d-2, d-1, d].forEach(ix=>{ const e = existingDays[ix]; if (e && e.locked && e.prep) e.prep.forEach(pp=>restingIds.add(pp.id)); });
      if (d===1) oncekiSonH.forEach(id=>restingIds.add(id));
      if (d===dim) sonrakiIlkN.concat(sonrakiIlkH).forEach(id=>restingIds.add(id));
      // 5 gün içinde 3 nöbet olmasın: 2 ve 4 gün önce nöbet tutan bu gün dinlenir
      eczacilar.concat(teknisyenler).forEach(s=>{ if (ucluSikisik(s.id, d-1)) restingIds.add(s.id); });
      let conflict = false;

      // eş durumu "istiyor" işaretliler bu güne kesin yazılır
      const zEcz = eczacilar.filter(s=>getPref(s.id,y,m,d)==="esVar" && aktifGunMu(s,y,m,d));
      const zDiger = teknisyenler.filter(s=>getPref(s.id,y,m,d)==="esVar" && aktifGunMu(s,y,m,d));
      let p1 = null, p2 = null;
      if (zEcz.length){ p1 = zEcz[0]; p2 = zEcz[1] || zDiger[0] || null; }
      else if (zDiger.length >= 2){ p1 = zDiger[0]; p2 = zDiger[1]; conflict = true; }
      else if (zDiger.length === 1){ p2 = zDiger[0]; }
      if (zEcz.length + zDiger.length > 2) conflict = true;
      [p1, p2].forEach(zp=>{ if (zp && restingIds.has(zp.id)) conflict = true; });

      if (!p1){
        const eczRes = pickCandidates(y,m,d, eczacilar, restingIds);
        const eligibleEczaci = sortByPref(eczRes.list, y,m,d);
        conflict = conflict || eczRes.conflict;
        p1 = eligibleEczaci.length>0 ? eligibleEczaci[0] : null;
        if (!p1) { conflict = true; }
      }
      if (!p2){
        const combinedPool = eczacilar.concat(teknisyenler).filter(s=> (!p1 || s.id!==p1.id) && !(p1 && p1.role==="nobetci" && s.role==="nobetci"));
        const pool2Res = pickCandidates(y,m,d, combinedPool, restingIds);
        const pool2 = sortByPref(pool2Res.list, y,m,d);
        conflict = conflict || pool2Res.conflict;
        p2 = pool2.length>0 ? pool2[0] : null;
        if (!p2) { conflict = true; }
      }

      const idsToday = [];
      if (p1) idsToday.push(p1.id);
      if (p2) idsToday.push(p2.id);
      const assignedToday = idsToday;
      const todayDowForComp = dowOfDay(d);
      assignedToday.forEach(id=>{
        dutyCount[id]++; totalFM[id]+=fazlaMesai; lastDutyDay[id]=d;
        if (todayDowForComp===5 || todayDowForComp===6) weekendCount[id]++;
        if (todayDowForComp===5) cmtCount[id] = (cmtCount[id]||0) + 1; else if (todayDowForComp===6) pazCount[id] = (pazCount[id]||0) + 1; else if (todayDowForComp===4) cumaGunCount[id] = (cumaGunCount[id]||0) + 1;
        if (cumaTipiMi(y,m,d)) cuCount[id] = (cuCount[id]||0) + 1;
        if (todayDowForComp===3) thursdayCount[id]++;
        if (isManualTatil(y,m,d)) resmiCount[id] = (resmiCount[id]||0) + 1;
      });

      days.push({
        day: d, tatil, conflict, fazlaMesai, locked:false, prep: [],
        assigned: [p1, p2].filter(Boolean).map(s=>({id:s.id, name:s.name, role:s.role}))
      });
      prevAssigned = assignedToday;
    }

    // --- iyileştirme turu (yerel arama): açgözlü çizelgeyi, kilitli olmayan günlerde
    // "kişi değiştir" ve "iki günü takas et" hamleleriyle, toplam fazla mesai saatleri,
    // hafta sonu ve nöbet sayıları kişiler arasında mümkün olduğunca eşitlenene kadar
    // iyileştirir. Kesin kurallar (izinli yok, arka arkaya gün yok, günde en az 1 eczacı,
    // kilitli günlere dokunma) her hamlede korunur. ---
    const staffList = eczacilar.concat(teknisyenler);
    // destek personeli varsa hazırlamaya YALNIZCA onlar yazılır (nöbet tutmazlar, nöbetçilerle
    // eşitlenmezler, kendi aralarında eşitlenirler); yoksa eski davranış: nöbetçi personel
    const destekler = state.staff.filter(s=>s.role==="destek" && aktifAydaMi(s,y,m));
    // 1. hazırlama: eczacı/teknikeri havuzu; 2. hazırlama: destek personeli (varsa).
    // Destek personeli YALNIZCA 2. hazırlama olarak yazılır.
    const destekVar = destekler.length > 0;
    const DESTEK_AYLIK = ayar('destekAylik'); // destek personeli başına aylık hazırlama görevi sayısı
    const prepAday = staffList.filter(s=>hazirlamaRol(s.role));
    function ayniTur(a,b){ return (a.role==='destek') === (b.role==='destek'); }
    // 2. hazırlama yeri (slot 1) destek personeli ya da eczacı/tekniker olabilir; iyileştirme destek personelinin gününü serbestçe değiştirebilir
    function degisimHavuzu(eski, slot){
      if (destekVar && slot===1) return prepAday.concat(destekler);
      return (destekVar && eski.role==='destek') ? destekler : prepAday;
    }
    const tumHavuz = destekler.length ? staffList.concat(destekler) : staffList;
    // eş durumu: "istiyor" işaretli güne o kişi kesin nöbetçi yazılır
    const zorunluGun = days.map(dy=> staffList.filter(s=>getPref(s.id,y,m,dy.day)==="esVar" && aktifGunMu(s,y,m,dy.day)).map(s=>s.id));
    function zorunluMu(id, i){ return zorunluGun[i].indexOf(id) >= 0; }
    const resmiGunDizi = days.map(dy=>isManualTatil(y,m,dy.day)), resmiGunVar = resmiGunDizi.some(Boolean);
    // --- hız: arama boyunca değişmeyen değerler bir kez hesaplanır (sonuç aynı kalır) ---
    const A_MINARA = ayar('minAra'), A_THUHS = ayar('thuHaftaSonu'),
          A_CUMA = ayar('cumaEsles'), A_HSUST = ayar('hsUst'), A_MAXTHU = ayar('maxThu');
    const GUN_SAY = days.length;
    const gunDow = days.map(dy=>dowOfDay(dy.day));
    const NH = tumHavuz.length, hIx = {};
    tumHavuz.forEach((s,ix)=>{ hIx[s.id] = ix; });
    const prefGun = days.map(dy=>{ const o = {}; tumHavuz.forEach(s=>{ o[s.id] = getPref(s.id,y,m,dy.day); }); return o; });
    const yasakGun = days.map(dy=>{ const o = {}; tumHavuz.forEach(s=>{ o[s.id] = kesinYasak(s.id,y,m,dy.day); }); return o; });
    // ayın ilk hafta sonu: önceki ayın son Perşembe günü nöbet tutanlar (Perşembe → aynı hafta sonu kuralı ay sınırında da geçerli)
    const oncekiAyPersembe = days.map((dy,i)=>{ const dw = gunDow[i]; if ((dw!==5 && dw!==6) || i-(dw===5?2:3) >= 0) return null;
      const [a,b,c] = gunKaydir(y, m, dy.day, -(dw===5?2:3)), sc = state.schedules[a+"-"+b];
      const g = sc && sc.days && sc.days[c-1]; return g ? new Set((g.assigned||[]).map(p=>p.id)) : null; });
    // ayın ilk Pazarı: önceki ayın son Cuma günü nöbet tutanlar (Cuma → aynı hafta Pazar kuralı ay sınırında da geçerli)
    const oncekiAyCuma = days.map((dy,i)=>{ if (gunDow[i]!==6 || i-2 >= 0) return null;
      const [a,b,c] = gunKaydir(y, m, dy.day, -2), sc = state.schedules[a+"-"+b];
      const g = sc && sc.days && sc.days[c-1]; return g ? new Set((g.assigned||[]).map(p=>p.id)) : null; });
    const izinOnceGun = days.map(dy=>{ const o = {}; tumHavuz.forEach(s=>{ o[s.id] = izinOncesiMi(s.id,y,m,dy.day); }); return o; });
    function yasak(id, i){ const v = yasakGun[i][id]; return v===undefined ? kesinYasak(id,y,m,days[i].day) : v; }
    const ixStaff = staffList.map(s=>hIx[s.id]), ixPrep = prepAday.map(s=>hIx[s.id]), ixDestek = destekler.map(s=>hIx[s.id]);
    let ixPrepAdil = null;   // bu ay en az bir hazırlama gününde yazılabilen eczacı / tekniker
    const eczIx = new Uint8Array(NH); tumHavuz.forEach((s,ix)=>{ if (eczaciMi(s.role)) eczIx[ix] = 1; });
    // yıl içinde birikmiş gün türü sayıları (önceki aylar, ham): Perşembe, Cuma, Cumartesi, Pazar, resmi tatil
    const W_GUNYIL = AGIRLIK.gunYil;   // herkes birini almadan kimse ikincisini almasın (aylık 8 saatten sonra, yıllık saatten ve hafta sonu kuralından önce)
    const yb0 = yilGunSayilari(y, m, null);
    const bPe = new Float64Array(NH), bCu = new Float64Array(NH), bCmt = new Float64Array(NH), bPaz = new Float64Array(NH), bRt = new Float64Array(NH);
    tumHavuz.forEach((s,ix)=>{ const o = yb0[s.id]; if (!o) return; bPe[ix] = o.pe; bCu[ix] = o.cu; bCmt[ix] = o.cmt; bPaz[ix] = o.paz; bRt[ix] = o.rt; });
    // hazırlama ayrıca her grubun kendi içinde dengelenir (eczacılar kendi arasında, teknikerler kendi arasında: prpGrup);
    // gruplar arası denge yıllık prpYil ile sağlanır (yıl sonunda herkese eşit hazırlama)
    const offPe = new Float64Array(NH), hThuEf = new Float64Array(NH);
    const cuGunDizi = days.map(dy=>cumaTipiMi(y,m,dy.day));
    const offCu = new Float64Array(NH), hCu = new Float64Array(NH), hCuEf = new Float64Array(NH);
    const offCmt = new Float64Array(NH), offPaz = new Float64Array(NH), hSatEf = new Float64Array(NH), hSunEf = new Float64Array(NH);     // yıllık Cumartesi ve Pazar dengesi için önceki aylardan gelen sayılar (cpYil)
    const offN = new Float64Array(NH), hCntEf = new Float64Array(NH);  // yıllık nöbet sayısı dengesi için önceki aylardan gelen sayılar (nYil)
    const offFm = new Float64Array(NH), offPrp = new Float64Array(NH), offRc = new Float64Array(NH), offRcH = new Float64Array(NH), offHs = new Float64Array(NH), hHsEf = new Float64Array(NH);
    tumHavuz.forEach((s,ix)=>{ offFm[ix] = devir.off[s.id]||0; offPrp[ix] = devir.prepOff[s.id]||0; offRc[ix] = resmiDv.off[s.id]||0; offRcH[ix] = resmiDv.offH[s.id]||0; offHs[ix] = hsDv[s.id]||0; offCu[ix] = cuDv[s.id]||0; offN[ix] = nDv[s.id]||0; offCmt[ix] = cmtDv[s.id]||0; offPaz[ix] = pazDv[s.id]||0; offPe[ix] = peDv[s.id]||0; });
    // ayda en az 1 Cumartesi/Pazar nöbeti: yalnız o ay en az bir hafta sonu günü uygun olan kişiler için
    const hsMusait = new Uint8Array(NH);
    staffList.forEach(s=>{ const ix = hIx[s.id]; for (let i=0;i<GUN_SAY;i++){ const dw = gunDow[i];
      if ((dw===5||dw===6) && !yasak(s.id,i) && aktifGunMu(s,y,m,days[i].day)){ hsMusait[ix] = 1; break; } } });
    // kesin kural grubu: fazla mesai farkı en fazla FM_MAX_FARK saat (ayın tamamında çalışan nöbetçi personel; destek hariç)
    const ixFmKural = fmKuralKisileri(y, m).map(s=>hIx[s.id]).filter(ix=>ix!==undefined);
    const KESIN = AGIRLIK.KESIN;   // kesin kuralların cezası: diğer tüm tercihlerin toplamından büyük
    // UYARI: çizelgede ya da uyarı listesinde uyarı çıkaran her durum. Öncelik her zaman uyarısız çizelgedir:
    // bu ceza diğer tüm kuralların ve eşitlik hedeflerinin toplamından büyüktür; uyarı kaçınılmazsa en az uyarılı çizelge seçilir
    const UYARI = AGIRLIK.UYARI;
    // saat ile hazırlama çakışırsa öncelik (Ayarlar): 1 = hazırlama eşitliği (fark en fazla 1, saat esner), 2 = fazla mesai saati
    const W_HZFARK = Number(ayar('cakismaOncelik'))===2 ? AGIRLIK.hzFarkSaatOncelik : AGIRLIK.hzFarkHazirlamaOncelik;
    const W_HS_KURAL = AGIRLIK.hsKural;    // hafta sonu kuralı (1 Cmt, 1 Paz, Cu+Cmt+Paz yok); ihlali uyarı çıkarır (UYARI), bu ağırlık yalnız ihlalin büyüklüğünü ayırt eder
    const ixEczPrep = eczacilar.filter(s=>hazirlamaRol(s.role)).map(s=>hIx[s.id]), ixTekPrep = teknisyenler.filter(s=>hazirlamaRol(s.role)).map(s=>hIx[s.id]);
    const pvThu = [], pvSat = [], pvSun = [];
    staffList.forEach(s=>{ const pv = devir.prev[s.id] || {thu:0, sat:0, sun:0}; pvThu.push(pv.thu); pvSat.push(pv.sat); pvSun.push(pv.sun); });
    const hFm = new Float64Array(NH), hCnt = new Float64Array(NH), hWk = new Float64Array(NH), hThu = new Float64Array(NH),
          hPrp = new Float64Array(NH), hSat = new Float64Array(NH), hSun = new Float64Array(NH), hCum = new Float64Array(NH),
          hRc = new Float64Array(NH), hHs = new Float64Array(NH), hFmEf = new Float64Array(NH), hPrpEf = new Float64Array(NH), hRcEf = new Float64Array(NH), hRcH = new Float64Array(NH), hRcHEf = new Float64Array(NH);
    function ssIx(o, ix){
      const n = ix.length; let t = 0;
      for (let q=0;q<n;q++) t += o[ix[q]];
      const mean = t/n; let r = 0;
      for (let q=0;q<n;q++){ const z = o[ix[q]]-mean; r += z*z; }
      return r;
    }
    function gundeVar(i, id){ const l = days[i].assigned; for (let q=0;q<l.length;q++) if (l[q].id===id) return true; return false; }
    const gunFm = days.map(dy=>dy.fazlaMesai);
    // bir günün nöbetçi + hazırlama katkısını sayaçlara ekler (sg=1) ya da çıkarır (sg=-1)
    function katki(i, as, pl, sg){
      const dow = gunDow[i], resmi = resmiGunDizi[i], fmGun = sg*gunFm[i];
      const hs = (dow===5||dow===6);
      for (let q=0;q<as.length;q++){
        const ix = hIx[as[q].id];
        if (ix===undefined) continue;
        hFm[ix]+=fmGun; hCnt[ix]+=sg;
        if (resmi) hRc[ix]+=sg;
        if (cuGunDizi[i]) hCu[ix]+=sg;
        if (hs){ hWk[ix]+=sg; hHs[ix]+=sg; }
        if (dow===5) hSat[ix]+=sg;
        else if (dow===6) hSun[ix]+=sg;
        else if (dow===4) hCum[ix]+=sg;
        else if (dow===3) hThu[ix]+=sg;
      }
      if (pl){ const pg = prefGun[i]; for (let q=0;q<pl.length;q++){
        const ix = hIx[pl[q].id];
        if (ix===undefined) continue;
        hFm[ix]+=sg*HAZ_SAAT; hWk[ix]+=sg; hPrp[ix]+=sg;
        if (resmi) hRcH[ix]+=sg;
        if (pg[pl[q].id]==='avoid') hPrAv += sg;
      } }
    }
    // i. günün yumuşak ceza katkısı (o gün ve 2-3 gün sonrasındaki nöbetlere bakar)
    // ağırlıklar ve öncelik sırası: AGIRLIK tablosu (thuHs, cuPaz, istiyor, araGun; toplam gunTercihCarpani ile çarpılır)
    const A_THUHS_C = AGIRLIK.thuHs, A_CUPAZ_C = AGIRLIK.cuPaz, A_ARAGUN = AGIRLIK.araGun;
    function softGun(i){
      const as = days[i].assigned, pg = prefGun[i], dow = gunDow[i]; let sf = 0;
      for (let q=0;q<as.length;q++){
        const pid = as[q].id;
        if (hIx[pid]===undefined) continue;
        const pr = pg[pid];
        if (pr==='want') sf-=AGIRLIK.istiyor;    // "istiyor": düşük öncelik — eşit/adil dağıtımı bozmadan, yalnız eşitlik varken karşılanır
        if (A_MINARA>=3 && i+2<GUN_SAY && gundeVar(i+2, pid)) sf+=A_ARAGUN;
        if (A_MINARA>=4 && i+3<GUN_SAY && gundeVar(i+3, pid)) sf+=A_ARAGUN;
        // ay başı: önceki ayın son günlerindeki (gerçekte tutulan) nöbetle en az gün farkı
        if (i < A_MINARA) for (let k=1; k<=4; k++){ const ara = i+k; if (ara>=2 && ara<A_MINARA && oncekiSonGunler[k].indexOf(pid)>=0) sf+=A_ARAGUN; }
        if (dow===3 && A_THUHS){
          // Perşembe nöbeti tutana aynı hafta sonu nöbet yazılmaz (güçlü tercih; personel gerçekten yetmezse esner)
          if (i+2<GUN_SAY && gundeVar(i+2, pid)) sf+=A_THUHS_C;
          if (i+3<GUN_SAY && gundeVar(i+3, pid)) sf+=A_THUHS_C;
        }
        if (A_THUHS && oncekiAyPersembe[i] && oncekiAyPersembe[i].has(pid)) sf+=A_THUHS_C;
        // Cuma nöbeti tutana aynı hafta Pazar nöbeti yazılmaz (mümkün olduğunca; güçlü tercih)
        if (dow===4 && i+2<GUN_SAY && gundeVar(i+2, pid)) sf+=A_CUPAZ_C;
        if (oncekiAyCuma[i] && oncekiAyCuma[i].has(pid)) sf+=A_CUPAZ_C;
      }
      // Cuma nöbeti tutana aynı hafta Pazar hazırlaması da yazılmaz (mümkün olduğunca)
      if (dow===6){ const pl = days[i].prep || [];
        for (let q=0;q<pl.length;q++){ const pid = pl[q].id;
          if ((i-2>=0 && gundeVar(i-2, pid)) || (oncekiAyCuma[i] && oncekiAyCuma[i].has(pid))) sf+=A_CUPAZ_C; } }
      return sf;
    }
    // günün uyarı çıkaran durumları: karşılanmayan eş durumu, "istemiyor" işaretli güne nöbet,
    // ertesi gün izne çıkana nöbet (nöbet ertesi izni izne düşer)
    function zGun(i){ const zg = zorunluGun[i]; let z = 0; for (let q=0;q<zg.length;q++){ if (!gundeVar(i, zg[q])) z += UYARI; }
      const as = days[i].assigned, pg = prefGun[i];
      for (let q=0;q<as.length;q++){ const pid = as[q].id; if (hIx[pid]===undefined) continue; if (pg[pid]==='avoid') z += UYARI; if (izinOnceGun[i][pid]) z += UYARI; }
      return z; }
    let hPrAv = 0;   // "istemiyor" işaretli güne yazılan hazırlama sayısı
    function sayaclariSifirla(){ hPrAv = 0; hFm.fill(0); hCnt.fill(0); hWk.fill(0); hThu.fill(0); hPrp.fill(0); hSat.fill(0); hSun.fill(0); hCum.fill(0); hRc.fill(0); hRcH.fill(0); hHs.fill(0); hCu.fill(0); }
    // ozetJ her aday hamlede çağrılır: yardımcılar dışarıda tanımlıdır (her çağrıda yeni dizi/fonksiyon oluşmasın)
    // G grubundaki sayaç değerleri arasındaki fark 1'i aşıyorsa ceza
    function grupFarkCeza(o, G, w){ if (G.length < 2) return 0; let mx = -1, mn = 1e9; for (let q=0;q<G.length;q++){ const v = o[G[q]]; if (v>mx) mx = v; if (v<mn) mn = v; } return mx-mn > 1 ? w*(mx-mn-1) : 0; }
    // fark 1'i aşınca: uyarı + farkın büyüklüğü + en iyi 1 genişliğindeki aralığın dışında kalan toplam sapma
    // (yalnız en çok – en az farkına bakılsaydı uçtaki kişilerden birini düzelten adım ödüllenmez, arama takılırdı)
    function yilBant(v){ const n = v.length; let enAz = 1e18;
      for (let q=0;q<n;q++) for (let k=0;k<2;k++){ const L = v[q]-k; let t = 0;
        for (let r=0;r<n;r++){ const x = v[r]; if (x<L) t += L-x; else if (x>L+1) t += x-L-1; } if (t<enAz) enAz = t; }
      return enAz; }
    function yilCeza(b, h){
      const n = ixFmKural.length; if (n < 2) return 0;
      let mx = -1e9, mn = 1e9; const v = [];
      for (let q=0;q<n;q++){ const ix = ixFmKural[q], x = b[ix] + h[ix]; v.push(x); if (x>mx) mx = x; if (x<mn) mn = x; }
      return mx-mn > 1+1e-9 ? UYARI + W_GUNYIL*(mx-mn-1) + W_GUNYIL*yilBant(v) : 0;
    }
    // ayda en az 1 hafta sonu: Cumartesi/Pazar nöbet yeri uygun kişi sayısından azsa bu kadar kişinin 0 kalması kaçınılmazdır (uyarı sayılmaz)
    const HS_SIFIR_IZIN = Math.max(0, hsMusait.reduce((t,v)=>t+v, 0) - 2*gunDow.filter(dw=>dw===5 || dw===6).length);
    // destek personelinin hazırlama sayısı ayardakinden farklıysa yalnız tatil günleri yetiyorsa uyarı çıkar
    const destekTamUyari = destekVar && days.filter(dy=>dy.tatil).length >= destekler.length*DESTEK_AYLIK;
    // sayaçlardan toplam amaç değeri (küçük = daha adil); uy: uyarı çıkaran durum sayısı
    function ozetJ(soft, zPen){
      let uy = 0, hsSifir = 0;
      for (let ix=0; ix<NH; ix++){ hPrpEf[ix] = hPrp[ix] + offPrp[ix]; hFmEf[ix] = hFm[ix] + offFm[ix]; }
      let destekFazla = 0;
      // hazırlama adaleti: aynı grupta (eczacı / tekniker) bu ayki hazırlama sayıları arasındaki fark en fazla 1 olsun
      let hzAdil = 0;
      // (eczacı, dışarıdan gelen eczacı ve tekniker birlikte; destek personeli kendi kuralıyla ayrı)
      if (!ixPrepAdil) ixPrepAdil = prepAday.filter(s=> days.some((dy,i)=> haftaSonuMu(i) && !yasak(s.id, i))).map(s=>hIx[s.id]);
      // eczacı + tekniker hazırlama sayıları arasında fark en fazla 1 (biri 0, biri 2 olmaz); öncelik Ayarlar'daki seçime göre
      hzAdil += grupFarkCeza(hPrp, ixEczPrep, AGIRLIK.grupHazFark); hzAdil += grupFarkCeza(hPrp, ixTekPrep, AGIRLIK.grupHazFark);
      { const c = grupFarkCeza(hPrp, ixPrepAdil, W_HZFARK); if (c > 0){ hzAdil += c; uy++; } }
      // hazırlama önce teknikerlere: her teknikere 1, sonra eczacılara; yeni tur yine teknikerden. Sıra yıl boyunca
      // sürer (önceki aylar dahil): her ay baştan başlasaydı ay içinde artan hazırlama hep teknikerlere kalır, yılda birikirdi
      { let mxE = -1e9, mnT = 1e9; for (let q=0;q<ixPrepAdil.length;q++){ const ix = ixPrepAdil[q], v = hPrpEf[ix]; if (eczIx[ix]){ if (v>mxE) mxE = v; } else if (v<mnT) mnT = v; }
        if (mxE > -1e9 && mnT < 1e9 && mxE > mnT + 1e-6) hzAdil += AGIRLIK.tekOnce*(mxE-mnT); }
      // nöbet sayısı: kişiler arasında fark mümkünse en fazla 1, en fazla 2
      if (ixFmKural.length > 1){ let mx = -1, mn = 1e9; for (let q=0;q<ixFmKural.length;q++){ const v = hCnt[ixFmKural[q]]; if (v>mx) mx = v; if (v<mn) mn = v; }
        if (mx-mn > 1) hzAdil += AGIRLIK.nobetFark*(mx-mn-1); if (mx-mn > 2){ hzAdil += KESIN*(mx-mn-2); uy++; } }
      if (destekVar) for (let q=0;q<ixDestek.length;q++){ const v = hPrp[ixDestek[q]]; destekFazla += AGIRLIK.destekSayi*Math.abs(v-DESTEK_AYLIK); if (destekTamUyari && v!==DESTEK_AYLIK) uy++; }   // KESİN: destek personeli ayda tam ayardaki sayı kadar hazırlama alır
      // hafta sonu düzeni: kişi başı ayda en fazla 1 Cumartesi/Pazar nöbeti (ne ikisi birden, ne
      // 2 Cumartesi, ne 2 Pazar); mümkünse Cuma + Cumartesi ya da Cuma + Pazar eşleşmesi
      let hsPen = 0, thuFazla = 0, devirPen = 0, kesinPen = 0;
      const dv = devir.havePrev;
      // KESİN: aylık fazla mesai farkı (destek hariç) en fazla FM_MAX_FARK saat
      if (ixFmKural.length > 1){ let mx = -1e9, mn = 1e9; const n = ixFmKural.length;
        for (let q=0;q<n;q++){ const v = hFm[ixFmKural[q]]; if (v>mx) mx = v; if (v<mn) mn = v; }
        if (mx-mn > FM_MAX_FARK){
          // herkesi FM_MAX_FARK genişliğinde tek bir aralığa sokmak için gereken toplam saat (en iyi aralığa göre);
          // tek kişinin bile aralığa yaklaşması ceza azaltır, böylece arama düzlükte takılmaz
          let enAz = 1e18;
          for (let q=0;q<2*n;q++){
            const L = q<n ? hFm[ixFmKural[q]] : hFm[ixFmKural[q-n]] - FM_MAX_FARK, U = L + FM_MAX_FARK;
            let t = 0; for (let r=0;r<n;r++){ const v = hFm[ixFmKural[r]]; if (v<L) t += L-v; else if (v>U) t += v-U; }
            if (t<enAz) enAz = t;
          }
          kesinPen += KESIN*(mx-mn-FM_MAX_FARK) + AGIRLIK.fmBant*enAz; uy++;
        } }
      for (let q=0;q<ixStaff.length;q++){
        const ix = ixStaff[q];
        const w = hSat[ix] + hSun[ix], cm = hCum[ix];
        // ayda en fazla 1 Cumartesi ve 1 Pazar nöbeti; Cuma + Cumartesi + Pazar üçü birden olmaz (eşitlikten sonra gelir)
        if (hSat[ix] > 1){ kesinPen += W_HS_KURAL*(hSat[ix]-1); uy += hSat[ix]-1; }
        if (hSun[ix] > 1){ kesinPen += W_HS_KURAL*(hSun[ix]-1); uy += hSun[ix]-1; }
        if (cm > 0 && hSat[ix] > 0 && hSun[ix] > 0){ kesinPen += W_HS_KURAL; uy++; }
        // (ayda tercih edilen hafta sonu sayısı kuralı kaldırıldı; yerine yıllık hafta sonu dengesi yüksek öncelikte)
        if (A_CUMA && w >= 1 && cm === 0) hsPen += AGIRLIK.cumaEslesmeYok;
        if (A_CUMA && w === 0 && cm >= 1) hsPen += AGIRLIK.cumaTek;
        if (cm > 1) hsPen += AGIRLIK.cumaFazla*(cm-1);
        // ayda en az 1 Cumartesi/Pazar nöbeti (uygun hafta sonu günü varsa)
        if (hHs[ix] === 0 && hsMusait[ix]){ hsPen += AGIRLIK.hsEnAz1; hsSifir++; }
        // Cumartesi/Pazar NÖBETİ Ayarlar'daki hafta sonu üst sınırını (varsayılan 2) aşmasın (hazırlama sayılmaz)
        if (hHs[ix] > A_HSUST){ hsPen += AGIRLIK.hsUst*(hHs[ix]-A_HSUST); uy += hHs[ix]-A_HSUST; }
        if (hThu[ix]>A_MAXTHU) thuFazla += hThu[ix]-A_MAXTHU;
        // eczacı / tekniker: ayda en fazla 2 hazırlama (çok güçlü tercih; yalnız başka çare yoksa aşılır)
        if (hPrp[ix] > 2){ hsPen += AGIRLIK.prepUst*(hPrp[ix]-2); uy += hPrp[ix]-2; }
        // ayda 1 hazırlama hedef: 2. hazırlama yalnız yerler 1'er kişiyle dolmuyorsa
        if (hPrp[ix] > 1) hsPen += AGIRLIK.prp2*(hPrp[ix]-1);
        if (dv){
          if (pvThu[q]===0 && hThu[ix]===0) devirPen += AGIRLIK.devirPersembe;
          if (pvThu[q]>0 && hThu[ix]>0) devirPen += AGIRLIK.devirPersembe;
          if (pvSun[q]>0 && hSun[ix]>0) devirPen += AGIRLIK.devirPazar*hSun[ix];
          if (pvSat[q]>0 && hSat[ix]>0) devirPen += AGIRLIK.devirCumartesi*hSat[ix];
        }
      }
      if (hsSifir > HS_SIFIR_IZIN) uy += hsSifir - HS_SIFIR_IZIN;
      // resmi tatil nöbetleri: aynı yılın önceki aylarıyla birlikte kişiler arasında eşitlenir
      let resmiPen = 0;
      // nöbet ve hazırlama ayrı ayrı, gün sayısı olarak (saat değil); destek personeli kendi arasında
      if (resmiGunVar){
        for (let ix=0; ix<NH; ix++){ hRcEf[ix] = hRc[ix] + offRc[ix]; hRcHEf[ix] = hRcH[ix] + offRcH[ix]; }
        resmiPen = AGIRLIK.resmi*ssIx(hRcEf, ixStaff) + AGIRLIK.resmi*ssIx(hRcHEf, ixPrep) + (destekVar ? AGIRLIK.resmi*ssIx(hRcHEf, ixDestek) : 0);
        // yıllık toplam resmi tatil görevi (nöbet + hazırlama) kişiler arasında en fazla 1 fark (resmi tatil yılda az: açılan fark sonradan kapanmaz)
        { let mx = -1e9, mn = 1e9; const v = [];
          for (let q=0;q<ixPrep.length;q++){ const ix = ixPrep[q], x = hRcEf[ix] + hRcHEf[ix]; v.push(x); if (x>mx) mx = x; if (x<mn) mn = x; }
          if (mx-mn > 1+1e-6) resmiPen += AGIRLIK.resmiYilToplam*(mx-mn-1 + yilBant(v)); }
      }
      for (let ix=0; ix<NH; ix++) hHsEf[ix] = hHs[ix] + offHs[ix];
      const hsYilPen = AGIRLIK.hsYil*ssIx(hHsEf, ixStaff);
      for (let ix=0; ix<NH; ix++) hCuEf[ix] = hCu[ix] + offCu[ix];
      const cuYilPen = AGIRLIK.cuYil*ssIx(hCuEf, ixStaff);
      for (let ix=0; ix<NH; ix++) hThuEf[ix] = hThu[ix] + offPe[ix];
      const peYilPen = AGIRLIK.peYil*ssIx(hThuEf, ixStaff);
      for (let ix=0; ix<NH; ix++) hCntEf[ix] = hCnt[ix] + offN[ix];
      const nYilPen = AGIRLIK.nYil*ssIx(hCntEf, ixStaff);
      for (let ix=0; ix<NH; ix++){ hSatEf[ix] = hSat[ix] + offCmt[ix]; hSunEf[ix] = hSun[ix] + offPaz[ix]; }
      const cpYilPen = AGIRLIK.cpYil*(ssIx(hSatEf, ixStaff) + ssIx(hSunEf, ixStaff));
      let gunYilPen = 0;
      if (ixFmKural.length > 1){
        gunYilPen = yilCeza(bPe, hThu) + yilCeza(bCu, hCum) + yilCeza(bCmt, hSat) + yilCeza(bPaz, hSun) + (resmiGunVar ? yilCeza(bRt, hRc) : 0);
      }
      return UYARI*(uy + hPrAv) + kesinPen + zPen + AGIRLIK.fmYil*ssIx(hFmEf, ixStaff) /* fazla mesai (saat) eşitliği: yıllık — her ay 8 saat kuralının yanında yıl toplamı da eşite yakın */ + hsYilPen + cuYilPen + peYilPen + nYilPen + cpYilPen + gunYilPen + devirPen + AGIRLIK.nobetAy*ssIx(hCnt, ixStaff) + AGIRLIK.haftaSonuIs*ssIx(hWk, ixStaff) + AGIRLIK.prpYil*ssIx(hPrpEf, ixPrep) + AGIRLIK.prpGrup*(ssIx(hPrpEf, ixEczPrep) + ssIx(hPrpEf, ixTekPrep)) + (destekVar ? AGIRLIK.destekYil*ssIx(hPrpEf, ixDestek) : 0) + destekFazla + hzAdil + hsPen + AGIRLIK.gunTercihCarpani*soft + AGIRLIK.thuFazla*thuFazla + resmiPen;
    }
    // tam hesap: tüm günler baştan sayılır
    function hesaplaJ(){
      sayaclariSifirla();
      let soft = 0, zPen = 0;
      for (let i=0;i<GUN_SAY;i++){ zPen += zGun(i); katki(i, days[i].assigned, days[i].prep, 1); soft += softGun(i); }
      return ozetJ(soft, zPen);
    }
    // artımlı hesap: önce mevcut çözüm "taban" olarak kurulur, sonra her aday hamlede yalnızca
    // değişen 1-2 gün ve onlara bakan komşu günler yeniden hesaplanır
    const tAs = new Array(GUN_SAY), tPr = new Array(GUN_SAY), bSoftGun = new Float64Array(GUN_SAY), bZGun = new Float64Array(GUN_SAY);
    const etkiDamga = new Int32Array(GUN_SAY);
    let bSoft = 0, bZ = 0, damga = 0;
    function tabanKur(){
      sayaclariSifirla(); bSoft = 0; bZ = 0;
      for (let i=0;i<GUN_SAY;i++){
        tAs[i] = days[i].assigned; tPr[i] = days[i].prep;
        katki(i, tAs[i], tPr[i], 1);
        bSoftGun[i] = softGun(i); bZGun[i] = zGun(i);
        bSoft += bSoftGun[i]; bZ += bZGun[i];
      }
    }
    function jDelta(i, k, nobetDegisti){
      katki(i, tAs[i], tPr[i], -1); katki(i, days[i].assigned, days[i].prep, 1);
      if (k>=0){ katki(k, tAs[k], tPr[k], -1); katki(k, days[k].assigned, days[k].prep, 1); }
      let soft = bSoft, zPen = bZ;
      {
        // nöbet değiştiyse: o güne bakan günler (3 gün öncesi; Pazar hazırlaması için 2 gün sonrası) yeniden hesaplanır;
        // yalnız hazırlama değiştiyse: yalnız o günün kendisi
        damga++;
        for (let t=0; t<2; t++){
          const g = t===0 ? i : k;
          if (g<0) continue;
          if (nobetDegisti) zPen += zGun(g) - bZGun[g];
          const lo = nobetDegisti ? g-3 : g, hi = nobetDegisti ? Math.min(g+2, GUN_SAY-1) : g;
          for (let j=lo; j<=hi; j++){
            if (j<0 || etkiDamga[j]===damga) continue;
            etkiDamga[j] = damga;
            soft += softGun(j) - bSoftGun[j];
          }
        }
      }
      const r = ozetJ(soft, zPen);
      katki(i, days[i].assigned, days[i].prep, -1); katki(i, tAs[i], tPr[i], 1);
      if (k>=0){ katki(k, days[k].assigned, days[k].prep, -1); katki(k, tAs[k], tPr[k], 1); }
      return r;
    }
    function komsuda(id, idx){
      // nöbetçi olarak yazılacak kişi: komşu günlerde nöbetçi olamaz; komşu günlerde
      // ve aynı gün hazırlama personeli de olamaz
      for (let k=idx-1;k<=idx+1;k++){
        if (k<0 || k>=days.length) continue;
        if (k!==idx && days[k].assigned.some(p=>p.id===id)) return true;
        if (days[k].prep && days[k].prep.some(pp=>pp.id===id)) return true;
      }
      if (idx===0 && (oncekiSonN.indexOf(id)>=0 || oncekiSonH.indexOf(id)>=0)) return true;
      if (idx===days.length-1 && (sonrakiIlkN.indexOf(id)>=0 || sonrakiIlkH.indexOf(id)>=0)) return true;
      return false;
    }
    // hazırlama personeli yazılacak gün: Cumartesi, Pazar veya işaretli resmi tatil
    function haftaSonuMu(idx){ return !!days[idx].tatil; }
    function prepKomsu(id, idx){
      // hazırlama personeli: aynı gün ve önceki/sonraki gün nöbetçi olamaz
      for (let k=idx-1;k<=idx+1;k++){
        if (k<0 || k>=days.length) continue;
        if (days[k].assigned.some(p=>p.id===id)) return true;
      }
      if (idx===0 && oncekiSonN.indexOf(id)>=0) return true;
      if (idx===days.length-1 && sonrakiIlkN.indexOf(id)>=0) return true;
      return false;
    }
    function prepUygun(id, idx){
      return !yasak(id, idx) && !prepKomsu(id, idx) && !persembeNobetliMi(id, idx) && !prepBitisik(id, idx);
    }
    // aynı kişiye art arda iki gün hazırlama yazılmaz (Cumartesi + Pazar, ya da bitişik tatil günleri; ay sınırı dahil)
    function prepBitisik(id, idx){
      if (idx-1 >= 0 && (days[idx-1].prep||[]).some(pp=>pp.id===id)) return true;
      if (idx+1 < days.length && (days[idx+1].prep||[]).some(pp=>pp.id===id)) return true;
      if (idx===0 && oncekiSonH.indexOf(id)>=0) return true;
      if (idx===days.length-1 && sonrakiIlkH.indexOf(id)>=0) return true;
      return false;
    }
    // hafta sonu günü (idx) için: kişi aynı haftanın Perşembe günü nöbetçi mi (Perşembe önceki aydaysa o ayın çizelgesine bakılır)
    function persembeNobetliMi(id, idx){
      const dw = gunDow[idx]; if (!A_THUHS || (dw!==5 && dw!==6)) return false;
      const k = dw===5 ? 2 : 3, t = idx - k;
      if (t >= 0) return days[t].assigned.some(p=>p.id===id);
      const [a,b,c] = gunKaydir(y, m, days[idx].day, -k), sc = state.schedules[a+"-"+b];
      return !!(sc && sc.days && sc.days[c-1] && (sc.days[c-1].assigned||[]).some(p=>p.id===id));
    }
    // Perşembe günü (idx) nöbetçi yazılacak kişinin aynı hafta sonu hazırlaması var mı
    function hsHazirligiVarMi(id, idx){
      if (!A_THUHS || gunDow[idx]!==3) return false;
      for (const k of [2,3]){ const t = idx + k; if (t < days.length && (days[t].prep||[]).some(pp=>pp.id===id)) return true; }
      return false;
    }
    // dışarıdan nöbete gelen iki eczacı aynı gün birlikte nöbetçi olmaz (ikisi de eş durumu zorunluluğuysa hariç)
    function ikiDisaridan(as, idx){ const d = as.filter(p=>p.role==="nobetci"); return d.length > 1 && !d.every(p=>zorunluMu(p.id, idx)); }
    function gunGecerli(idx){
      const dy = days[idx];
      if (!dy.assigned.some(p=>eczaciMi(p.role))) return false;
      if (ikiDisaridan(dy.assigned, idx)) return false;
      return dy.assigned.every(p=>{ if (yasak(p.id, idx)) return false; if (zorunluMu(p.id, idx)) return true;
        return !sonGunEngel(p.id, dy.day) && !komsuda(p.id, idx) && !hsHazirligiVarMi(p.id, idx) && !ucluSikisik(p.id, idx); });
    }
    function kisiObj(s){ return {id:s.id, name:s.name, role:s.role}; }
    // aşama 2: Cumartesi/Pazar hazırlama personeli (8 saat) — nöbetçiler belli olduktan
    // sonra, toplam fazla mesaisi en az olana verilir
    (function hazirlamaAta(){
      const fmTop = {}, prpCnt = {}, rhCnt = {};
      tumHavuz.forEach(s=>{ fmTop[s.id]=(devir.off[s.id]||0); prpCnt[s.id]=0; });
      const prpAg = id => prpCnt[id] + (devir.prepOff[id]||0);
      days.forEach(dy=>{
        dy.assigned.forEach(p=>{ if (fmTop[p.id]!==undefined) fmTop[p.id]+=dy.fazlaMesai; });
        (dy.prep||[]).forEach(pp=>{ if (fmTop[pp.id]!==undefined){ fmTop[pp.id]+=HAZ_SAAT; prpCnt[pp.id]++; } });
      });
      // bir güne (i) bir hazırlama yeri için kişi seç ve yaz; destekMi: yalnız destek personelinden seç
      function yerAta(i, slot, destekMi){
          const secilmis = days[i].prep.map(pp=>pp.id);
          const cuPz = s=> (gunDow[i]===6 && ((i-2>=0 && days[i-2].assigned.some(p=>p.id===s.id)) || (oncekiAyCuma[i] && oncekiAyCuma[i].has(s.id)))) ? 1 : 0;
          const ist = s=> (prefGun[i][s.id]==='avoid' ? 1 : 0) + 2*cuPz(s) + (s.role!=='destek' && prpCnt[s.id]>=2 ? 8 : 0) + (s.role!=='destek' && prpCnt[s.id]===1 ? 4 : 0);
          const rH = s=> resmiGunDizi[i] ? (resmiDv.offH[s.id]||0) + (rhCnt[s.id]||0) : 0;
          let adaylarSon;
          if (destekMi){
            adaylarSon = destekler.filter(s=> !secilmis.includes(s.id) && prepUygun(s.id,i) && prpCnt[s.id]<DESTEK_AYLIK)
              .sort((a,b)=> (ist(a)-ist(b)) || (rH(a)-rH(b)) || (prpAg(a.id)-prpAg(b.id)) || sira[a.id]-sira[b.id]);
            if (!adaylarSon.length) return false;
          } else {
            // sıra: önce her teknikere 1, sonra eczacılara; yeni tur yine teknikerden
            const tur = s=> prpCnt[s.id]*2 + (eczaciMi(s.role) ? 1 : 0);
            adaylarSon = prepAday.filter(s=> !secilmis.includes(s.id) && prepUygun(s.id,i))
              .sort((a,b)=> (tur(a)-tur(b)) || (ist(a)-ist(b)) || (rH(a)-rH(b)) || fmTop[a.id]-fmTop[b.id] || prpAg(a.id)-prpAg(b.id) || sira[a.id]-sira[b.id]);
            if (!adaylarSon.length){
              // başka kimse uygun değilse (yer boş kalmasın): art arda hazırlama kuralı esnetilir, gün uyarılı görünür
              adaylarSon = (slot===1 && destekVar ? prepAday.concat(destekler) : prepAday)
                .filter(s=> !secilmis.includes(s.id) && !yasak(s.id,i) && !prepKomsu(s.id,i) && !persembeNobetliMi(s.id,i) && !(s.role==="destek" && prpCnt[s.id]>=DESTEK_AYLIK))
                .sort((a,b)=> (ist(a)-ist(b)) || (rH(a)-rH(b)) || fmTop[a.id]-fmTop[b.id] || prpAg(a.id)-prpAg(b.id) || sira[a.id]-sira[b.id]);
            }
            if (!adaylarSon.length) return false;
          }
          const sec = adaylarSon[0];
          days[i].prep.push(kisiObj(sec)); fmTop[sec.id]+=HAZ_SAAT; prpCnt[sec.id]++; if (resmiGunDizi[i]) rhCnt[sec.id] = (rhCnt[sec.id]||0) + 1;
          return true;
      }
      const hzGunler = []; for (let i=0;i<days.length;i++) if (!days[i].locked && haftaSonuMu(i)) hzGunler.push(i);
      // 1. geçiş: her tatil gününün 1. hazırlamacısı (eczacı / tekniker)
      hzGunler.forEach(i=>{ if (days[i].prep.length < 1) yerAta(i, 0, false); });
      // 2. geçiş: destek personeli, eczacı/tekniker için 2. yeri doldurmanın en zor olduğu günlere
      //    (uygun ve o ay henüz hazırlama almamış, tercihi engel olmayan kişi sayısı en az olan günler önce)
      if (destekVar){
        const kolaylik = i=>{ const secilmis = days[i].prep.map(pp=>pp.id);
          return prepAday.filter(s=> !secilmis.includes(s.id) && prepUygun(s.id,i) && prpCnt[s.id]===0 && prefGun[i][s.id]!=='avoid').length; };
        const sirali = hzGunler.filter(i=>days[i].prep.length===1).map(i=>({i, k:kolaylik(i)})).sort((a,b)=> a.k-b.k || a.i-b.i);
        sirali.forEach(({i})=>{ if (days[i].prep.length===1) yerAta(i, 1, true); });
      }
      // 3. geçiş: kalan 2. yerler eczacı / teknikerle
      hzGunler.forEach(i=>{ while (days[i].prep.length < HAZ_SAYISI){ if (!yerAta(i, days[i].prep.length, false)) break; } });
    })();
    let J = hesaplaJ();
    function inis(){
     for (let tur=0; tur<400; tur++){
      let enIyiJ = J, enIyi = null;
      tabanKur();
      // 1) kişi değiştir
      for (let i=0;i<days.length;i++){
        const dy = days[i];
        if (dy.locked) continue;
        const eski = dy.assigned;
        for (const a of eski){
          if (zorunluMu(a.id, i)) continue;
          for (const b of staffList){
            if (b.id===a.id || eski.some(p=>p.id===b.id)) continue;
            dy.assigned = eski.map(p=> p.id===a.id ? kisiObj(b) : p);
            if (gunGecerli(i)){
              const j2 = jDelta(i, -1, true);
              if (j2 < enIyiJ - 1e-9){ enIyiJ=j2; enIyi={tip:'r', i, a, b}; }
            }
            dy.assigned = eski;
          }
        }
      }
      // 2) iki günü takas et
      for (let i=0;i<days.length;i++){
        if (days[i].locked) continue;
        for (let k=i+1;k<days.length;k++){
          if (days[k].locked) continue;
          const ei = days[i].assigned, ek = days[k].assigned;
          for (const a of ei){
            if (ek.some(p=>p.id===a.id) || zorunluMu(a.id, i)) continue;
            for (const b of ek){
              if (ei.some(p=>p.id===b.id) || zorunluMu(b.id, k)) continue;
              days[i].assigned = ei.map(p=> p.id===a.id ? b : p);
              days[k].assigned = ek.map(p=> p.id===b.id ? a : p);
              if (gunGecerli(i) && gunGecerli(k)){
                const j2 = jDelta(i, k, true);
                if (j2 < enIyiJ - 1e-9){ enIyiJ=j2; enIyi={tip:'s', i, k, a, b}; }
              }
              days[i].assigned = ei; days[k].assigned = ek;
            }
          }
        }
      }
      // 3) bir hazırlama personelini (belirli bir slotta) değiştir
      for (let i=0;i<days.length;i++){
        if (days[i].locked || !haftaSonuMu(i)) continue;
        const eskiListe = days[i].prep;
        for (let slot=0; slot<eskiListe.length; slot++){
          const eskiP = eskiListe[slot];
          for (const b of degisimHavuzu(eskiP, slot)){
            if (b.id===eskiP.id || eskiListe.some((pp,ix)=>ix!==slot && pp.id===b.id)) continue;
            days[i].prep = eskiListe.map((pp,ix)=> ix===slot ? kisiObj(b) : pp);
            if (prepUygun(b.id,i)){
              const j2 = jDelta(i, -1, false);
              if (j2 < enIyiJ - 1e-9){ enIyiJ=j2; enIyi={tip:'pr', i, slot, b}; }
            }
            days[i].prep = eskiListe;
          }
        }
      }
      // 4) iki günün hazırlama personelini (slot slota) takas et
      for (let i=0;i<days.length;i++){
        if (days[i].locked || !haftaSonuMu(i) || !days[i].prep.length) continue;
        for (let k=i+1;k<days.length;k++){
          if (days[k].locked || !haftaSonuMu(k) || !days[k].prep.length) continue;
          for (let si=0; si<days[i].prep.length; si++){
            for (let sk=0; sk<days[k].prep.length; sk++){
              const pa = days[i].prep[si], pb = days[k].prep[sk];
              if (pa.id===pb.id || (!ayniTur(pa,pb) && !(si===1 && sk===1))) continue;
              if (days[i].prep.some((pp,ix)=>ix!==si && pp.id===pb.id)) continue;
              if (days[k].prep.some((pp,ix)=>ix!==sk && pp.id===pa.id)) continue;
              const eskiI = days[i].prep, eskiK = days[k].prep;
              days[i].prep = eskiI.map((pp,ix)=> ix===si ? pb : pp);
              days[k].prep = eskiK.map((pp,ix)=> ix===sk ? pa : pp);
              if (prepUygun(pb.id,i) && prepUygun(pa.id,k)){
                const j2 = jDelta(i, k, false);
                if (j2 < enIyiJ - 1e-9){ enIyiJ=j2; enIyi={tip:'ps', i, k, si, sk}; }
              }
              days[i].prep = eskiI; days[k].prep = eskiK;
            }
          }
        }
      }
      // 5) destek slotu boş olan tatil gününe destek personeli ekle
      if (destekVar){
        for (let i=0;i<days.length;i++){
          if (days[i].locked || !haftaSonuMu(i)) continue;
          if (days[i].prep.some(pp=>pp.role==='destek')) continue;
          const eskiL = days[i].prep;
          for (const b of destekler){
            if (eskiL.some(pp=>pp.id===b.id)) continue;
            days[i].prep = eskiL.length<HAZ_SAYISI
              ? eskiL.concat([kisiObj(b)])
              : eskiL.map((pp,ix)=> ix===eskiL.length-1 ? kisiObj(b) : pp);
            if (prepUygun(b.id,i)){
              const j2 = jDelta(i, -1, false);
              if (j2 < enIyiJ - 1e-9){ enIyiJ=j2; enIyi={tip:'pa', i, b}; }
            }
            days[i].prep = eskiL;
          }
        }
      }
      // 6) resmi tatil hazırlaması: b komşu günde nöbetçi olduğu için hazırlamaya geçemiyorsa, o nöbeti c'ye
      //    devredip b'yi hazırlamaya almayı dene (nöbet ve hazırlama gün sayısı ayrı ayrı eşitlenebilsin)
      if (resmiGunVar){
        for (let i=0;i<days.length;i++){
          if (days[i].locked || !haftaSonuMu(i) || !resmiGunDizi[i]) continue;
          const eskiListe = days[i].prep;
          for (let slot=0; slot<eskiListe.length; slot++){
            const pa = eskiListe[slot];
            for (const b of degisimHavuzu(pa, slot)){
              if (b.id===pa.id || eskiListe.some(pp=>pp.id===b.id) || yasak(b.id, i) || gundeVar(i, b.id)) continue;
              const kl = [i-1, i+1].filter(k=> k>=0 && k<days.length && gundeVar(k, b.id));
              if (kl.length!==1) continue;
              const k = kl[0];
              if (days[k].locked || zorunluMu(b.id, k)) continue;
              const eskiK = days[k].assigned;
              for (const c of staffList){
                if (c.id===b.id || eskiK.some(p=>p.id===c.id)) continue;
                days[k].assigned = eskiK.map(p=> p.id===b.id ? kisiObj(c) : p);
                days[i].prep = eskiListe.map((pp,ix)=> ix===slot ? kisiObj(b) : pp);
                if (gunGecerli(k) && prepUygun(b.id, i) && !(days[i].prep.some(pp=>pp.id===c.id)) && (k-1<0 || !(days[k-1].prep||[]).some(pp=>pp.id===c.id)) && (k+1>=days.length || !(days[k+1].prep||[]).some(pp=>pp.id===c.id))){
                  const j2 = jDelta(i, k, true);
                  if (j2 < enIyiJ - 1e-9){ enIyiJ=j2; enIyi={tip:'rk', i, k, slot, b, c}; }
                }
                days[k].assigned = eskiK; days[i].prep = eskiListe;
              }
            }
          }
        }
      }
      // 7) resmi tatil nöbeti: b komşu günde nöbetçi olduğu için resmi tatil nöbetine geçemiyorsa, komşu
      //    gündeki nöbetini c'ye devredip resmi tatil gününde a'nın yerine b'yi yazmayı dene
      if (resmiGunVar){
        for (let i=0;i<days.length;i++){
          if (days[i].locked || !resmiGunDizi[i]) continue;
          const eskiI = days[i].assigned;
          for (const a of eskiI){
            if (zorunluMu(a.id, i)) continue;
            for (const b of staffList){
              if (eskiI.some(p=>p.id===b.id) || yasak(b.id, i)) continue;
              const kl = [i-1, i+1].filter(k=> k>=0 && k<days.length && gundeVar(k, b.id));
              if (kl.length!==1) continue;
              const k = kl[0];
              if (days[k].locked || zorunluMu(b.id, k)) continue;
              const eskiK = days[k].assigned;
              for (const c of staffList){
                if (c.id===b.id || eskiK.some(p=>p.id===c.id)) continue;
                days[k].assigned = eskiK.map(p=> p.id===b.id ? kisiObj(c) : p);
                days[i].assigned = eskiI.map(p=> p.id===a.id ? kisiObj(b) : p);
                if (gunGecerli(i) && gunGecerli(k)){
                  const j2 = jDelta(i, k, true);
                  if (j2 < enIyiJ - 1e-9){ enIyiJ=j2; enIyi={tip:'nk', i, k, a, b, c}; }
                }
                days[k].assigned = eskiK; days[i].assigned = eskiI;
              }
            }
          }
        }
      }
      // 8) resmi tatil gününde aynı günün nöbetçisi ile hazırlama personelinin görevlerini değiştir
      //    (nöbet sayısı fazla olan hazırlamaya, hazırlaması fazla olan nöbete geçebilsin)
      if (resmiGunVar){
        for (let i=0;i<days.length;i++){
          if (days[i].locked || !resmiGunDizi[i] || !haftaSonuMu(i)) continue;
          const eA = days[i].assigned, eP = days[i].prep;
          for (const a of eA){
            if (zorunluMu(a.id, i) || hIx[a.id]===undefined) continue;
            for (let slot=0; slot<eP.length; slot++){
              const pp = eP[slot];
              if (pp.role==='destek' || !hazirlamaRol(a.role) || !staffList.some(s=>s.id===pp.id)) continue;
              days[i].assigned = eA.map(p=> p.id===a.id ? kisiObj(staffList.find(s=>s.id===pp.id)) : p);
              days[i].prep = eP.map((q,ix)=> ix===slot ? kisiObj(a) : q);
              if (gunGecerli(i) && prepUygun(a.id, i)){
                const j2 = jDelta(i, -1, true);
                if (j2 < enIyiJ - 1e-9){ enIyiJ=j2; enIyi={tip:'np', i, a, slot, pid: pp.id}; }
              }
              days[i].assigned = eA; days[i].prep = eP;
            }
          }
        }
      }
      // 9) hazırlamayı a'dan b'ye ver, karşılığında b'nin bir nöbetini a'ya ver (fazla mesai saatleri korunurken
      //    hazırlama sayıları eşitlenebilsin; fazla mesai kesin kuralı tek adımlık değişimlere izin vermediğinde gerekir)
      for (let i=0;i<days.length;i++){
        if (days[i].locked || !haftaSonuMu(i)) continue;
        const eP = days[i].prep;
        for (let slot=0; slot<eP.length; slot++){
          const pa = eP[slot];
          if (pa.role==='destek' || hIx[pa.id]===undefined) continue;
          const aS = staffList.find(s=>s.id===pa.id); if (!aS) continue;
          for (const b of degisimHavuzu(pa, slot)){
            if (b.id===pa.id || b.role==='destek' || eP.some(pp=>pp.id===b.id) || hIx[b.id]===undefined) continue;
            for (let k=0;k<days.length;k++){
              if (k===i || days[k].locked) continue;
              const eK = days[k].assigned;
              if (!eK.some(p=>p.id===b.id) || eK.some(p=>p.id===pa.id) || zorunluMu(b.id, k)) continue;
              days[k].assigned = eK.map(p=> p.id===b.id ? kisiObj(aS) : p);
              days[i].prep = eP.map((pp,ix)=> ix===slot ? kisiObj(b) : pp);
              if (gunGecerli(k) && prepUygun(b.id, i)){
                const j2 = jDelta(i, k, true);
                if (j2 < enIyiJ - 1e-9){ enIyiJ=j2; enIyi={tip:'pn', i, k, slot, aId:pa.id, bId:b.id}; }
              }
              days[k].assigned = eK; days[i].prep = eP;
            }
          }
        }
      }
      if (!enIyi) break;
      if (enIyi.tip==='pn'){
        const aOb = kisiObj(staffList.find(s=>s.id===enIyi.aId)), bOb = kisiObj(tumHavuz.find(s=>s.id===enIyi.bId) || staffList.find(s=>s.id===enIyi.bId));
        days[enIyi.k].assigned = days[enIyi.k].assigned.map(p=> p.id===enIyi.bId ? aOb : p);
        days[enIyi.i].prep = days[enIyi.i].prep.map((pp,ix)=> ix===enIyi.slot ? bOb : pp);
      } else if (enIyi.tip==='np'){
        const dI = days[enIyi.i], pOb = kisiObj(staffList.find(s=>s.id===enIyi.pid)), aOb = kisiObj(enIyi.a);
        dI.assigned = dI.assigned.map(p=> p.id===enIyi.a.id ? pOb : p);
        dI.prep = dI.prep.map((q,ix)=> ix===enIyi.slot ? aOb : q);
      } else if (enIyi.tip==='nk'){
        const bOb = kisiObj(staffList.find(s=>s.id===enIyi.b.id)), cOb = kisiObj(staffList.find(s=>s.id===enIyi.c.id));
        days[enIyi.k].assigned = days[enIyi.k].assigned.map(p=> p.id===enIyi.b.id ? cOb : p);
        days[enIyi.i].assigned = days[enIyi.i].assigned.map(p=> p.id===enIyi.a.id ? bOb : p);
      } else if (enIyi.tip==='rk'){
        const bOb = kisiObj(tumHavuz.find(s=>s.id===enIyi.b.id) || enIyi.b), cOb = kisiObj(staffList.find(s=>s.id===enIyi.c.id));
        days[enIyi.k].assigned = days[enIyi.k].assigned.map(p=> p.id===enIyi.b.id ? cOb : p);
        days[enIyi.i].prep = days[enIyi.i].prep.map((pp,ix)=> ix===enIyi.slot ? bOb : pp);
      } else if (enIyi.tip==='pa'){
        const lst = days[enIyi.i].prep, nb = kisiObj(tumHavuz.find(s=>s.id===enIyi.b.id));
        days[enIyi.i].prep = lst.length<HAZ_SAYISI ? lst.concat([nb]) : lst.map((pp,ix)=> ix===lst.length-1 ? nb : pp);
      } else if (enIyi.tip==='pr'){
        const liste = days[enIyi.i].prep;
        days[enIyi.i].prep = liste.map((pp,ix)=> ix===enIyi.slot ? kisiObj(tumHavuz.find(s=>s.id===enIyi.b.id)) : pp);
      } else if (enIyi.tip==='ps'){
        const li = days[enIyi.i].prep, lk = days[enIyi.k].prep;
        const pa = li[enIyi.si], pb = lk[enIyi.sk];
        days[enIyi.i].prep = li.map((pp,ix)=> ix===enIyi.si ? pb : pp);
        days[enIyi.k].prep = lk.map((pp,ix)=> ix===enIyi.sk ? pa : pp);
      } else if (enIyi.tip==='r'){
        const dy = days[enIyi.i];
        const b = staffList.find(s=>s.id===enIyi.b.id);
        dy.assigned = dy.assigned.map(p=> p.id===enIyi.a.id ? kisiObj(b) : p);
      } else {
        const ei = days[enIyi.i].assigned, ek = days[enIyi.k].assigned;
        days[enIyi.i].assigned = ei.map(p=> p.id===enIyi.a.id ? enIyi.b : p);
        days[enIyi.k].assigned = ek.map(p=> p.id===enIyi.b.id ? enIyi.a : p);
      }
      J = enIyiJ;
     }
    }
    inis();
    // yinelemeli yerel arama: küçük rastgele bozmalar + tekrar iyileştirme; daha iyi
    // sonuç bulunursa saklanır (~2.5 sn; uyarı kalmışsa uyarısız çizelge için en fazla ~8 sn)
    let enIyiKopya = days.map(dy=>({a:dy.assigned.slice(), p:dy.prep.slice()}));
    let enIyiToplamJ = J;
    let tohum = 12345 + vary*7919;
    function rnd(){ tohum = (tohum*1103515245 + 12345) & 0x7fffffff; return tohum/0x7fffffff; }
    const bitis = simdi() + 2500, bitisUzun = simdi() + 8000;
    const acikGunler = [];
    days.forEach((dy,i)=>{ if(!dy.locked) acikGunler.push(i); });
    let denemeSayisi = 0;
    while (acikGunler.length>2 && (simdi() < bitis && denemeSayisi < 60 || enIyiToplamJ >= UYARI && simdi() < bitisUzun && denemeSayisi < 600)){
      denemeSayisi++;
      const bozulacak = 3 + Math.floor(rnd()*4);
      for (let z=0; z<bozulacak; z++){
        const i = acikGunler[Math.floor(rnd()*acikGunler.length)];
        const dy = days[i];
        if (!dy.assigned.length) continue;
        const a = dy.assigned[Math.floor(rnd()*dy.assigned.length)];
        const b = staffList[Math.floor(rnd()*staffList.length)];
        if (zorunluMu(a.id, i) || b.id===a.id || dy.assigned.some(p=>p.id===b.id)) continue;
        const eski = dy.assigned;
        dy.assigned = eski.map(p=> p.id===a.id ? kisiObj(b) : p);
        if (!gunGecerli(i)) dy.assigned = eski;
      }
      for (let z=0; z<2; z++){
        const adaylarGun = acikGunler.filter(i=>haftaSonuMu(i) && days[i].prep.length>0);
        if (!adaylarGun.length) break;
        const i = adaylarGun[Math.floor(rnd()*adaylarGun.length)];
        const slot = Math.floor(rnd()*days[i].prep.length);
        const havuzB = degisimHavuzu(days[i].prep[slot], slot);
        const b = havuzB[Math.floor(rnd()*havuzB.length)];
        if (days[i].prep.some((pp,ix)=>ix!==slot && pp.id===b.id)) continue;
        const eskiListe = days[i].prep;
        days[i].prep = eskiListe.map((pp,ix)=> ix===slot ? kisiObj(b) : pp);
        if (!prepUygun(b.id,i)) days[i].prep = eskiListe;
      }
      J = hesaplaJ();
      inis();
      if (J < enIyiToplamJ - 1e-9){
        enIyiToplamJ = J;
        enIyiKopya = days.map(dy=>({a:dy.assigned.slice(), p:dy.prep.slice()}));
      } else {
        days.forEach((dy,i)=>{ dy.assigned = enIyiKopya[i].a.slice(); dy.prep = enIyiKopya[i].p.slice(); });
        J = enIyiToplamJ;
      }
    }
    days.forEach((dy,i)=>{ dy.assigned = enIyiKopya[i].a.slice(); dy.prep = enIyiKopya[i].p.slice(); });
    // onarım: ilk yerleştirmede "başka kimse yok" diye kural esnetilerek yazılmış hazırlamalar (art arda hazırlama,
    // komşu gün nöbeti) sonradan uygun biri bulunursa ona verilir (en az bozan seçilir)
    for (let tur=0; tur<3; tur++){
      let degisti = false;
      for (let i=0;i<days.length;i++){
        if (days[i].locked || !haftaSonuMu(i)) continue;
        for (let slot=0; slot<days[i].prep.length; slot++){
          const pp = days[i].prep[slot];
          if (prepUygun(pp.id, i)) continue;
          const eski = days[i].prep; let enIyiB = null, enIyiJ2 = Infinity;
          tabanKur();
          for (const b of degisimHavuzu(pp, slot)){
            if (b.id===pp.id || eski.some(q=>q.id===b.id)) continue;
            days[i].prep = eski.map((q,ix)=> ix===slot ? kisiObj(b) : q);
            if (prepUygun(b.id, i)){ const j2 = jDelta(i, -1, false); if (j2 < enIyiJ2){ enIyiJ2 = j2; enIyiB = b; } }
            days[i].prep = eski;
          }
          if (enIyiB){ days[i].prep = eski.map((q,ix)=> ix===slot ? kisiObj(enIyiB) : q); degisti = true; }
        }
      }
      if (!degisti) break;
    }
    // kilitli olmayan günlerin uyarı işaretini yeniden hesapla
    days.forEach((dy, i)=>{
      if (dy.locked) return;
      dy.conflict = zorunluGun[i].some(zid=>!dy.assigned.some(p=>p.id===zid)) || dy.assigned.length<2 || (haftaSonuMu(i) && dy.prep.length<HAZ_SAYISI) ||
        !dy.assigned.some(p=>eczaciMi(p.role)) || ikiDisaridan(dy.assigned, i) ||
        dy.assigned.some(p=> getPref(p.id,y,m,dy.day)==='avoid' || kesinYasak(p.id,y,m,dy.day) || (!zorunluMu(p.id,i) && komsuda(p.id,i))) ||
        (dy.prep||[]).some(p=> getPref(p.id,y,m,dy.day)==='avoid' || (p.role!=='destek' && prepBitisik(p.id, i)));
    });

    const warnings = [];
    if (eczacilar.length < 2){
      warnings.push("En az 2 eczacı gerekiyor; aksi halde dinlenme kuralı garanti edilemez. Şu an " + eczacilar.length + " eczacı var.");
    }
    // izinden önceki güne mecburen yazılan nöbetler (yumuşak kural esnedi): kullanıcı bilsin
    const izinOncesiAtama = [];
    days.forEach(dd=>{ if (dd.locked) return; (dd.assigned||[]).forEach(p=>{ if (izinOncesiMi(p.id,y,m,dd.day)) izinOncesiAtama.push(p.name+" ("+dd.day+" "+AYLAR[m]+")"); }); });
    if (izinOncesiAtama.length){
      warnings.push("Başka uygun kişi kalmadığı için şu nöbetler izinden önceki güne yazıldı; nöbet ertesi izni izin gününe denk gelir: "+izinOncesiAtama.join(", ")+". İsterseniz günü açıp başka bir kişiyle değiştirebilirsiniz.");
    }
    const kirmiziGunler = days.filter(dd=> dd.conflict && !dd.locked).map(dd=>dd.day);
    if (kirmiziGunler.length){
      warnings.push("Bazı otomatik atanan günlerde dinlenme kuralı ve/veya \"istemiyorum\"/\"izinli\" tercihi personel yetersizliğinden dolayı korunamadı; bu günlerde zorunlu atama yapıldı. Bu günler kırmızı ile işaretlendi (gün numarasının yanında ! var): "+kirmiziGunler.map(g=>g+" "+AYLAR[m]).join(", ")+". Günün üzerine gelince ya da güne dokununca sebebi görünür.");
    }
    (function eczaciAzMi(){
      // her gün en az bir eczacı gerektiğinden, eczacı az ise eczacılar ortalamadan fazla nöbet tutmak zorundadır
      const nE = eczacilar.length, nA = staffList.length;
      if (nE < 1 || nA <= nE) return;
      const eczEnAz = dim/nE, ort = 2*dim/nA;
      if (eczEnAz - ort >= 1.5){
        const fmFark = Math.round((eczEnAz - ort) * (days.reduce((t,d)=>t+d.fazlaMesai,0)/Math.max(1,days.length)));
        warnings.push("Eczacı sayısı ("+nE+") nöbetçi personele göre az: her gün en az bir eczacı nöbetçi olması gerektiğinden her eczacı bu ay en az "+Math.ceil(eczEnAz)+" nöbet tutar, diğer nöbetçiler ortalama "+Math.round(ort)+". Bu yüzden eczacılarla teknikerler arasında yaklaşık "+fmFark+" saat fazla mesai farkı kalır; personel yapısından kaynaklanır, normaldir.");
      }
    })();
    (function hsKontrol(){
      const sy = {}, ay = {};
      staffList.forEach(s=>{ sy[s.id]=0; ay[s.id]=s.name; });
      days.forEach(dd=>{ const dw = dowOfDay(dd.day); if (dw===5||dw===6) dd.assigned.forEach(p=>{ if (sy[p.id]!==undefined) sy[p.id]++; }); });
      // ayda en az 1 hafta sonu: uygun hafta sonu günü olduğu hâlde 0 kalanlar uyarılır
      const uygun = staffList.filter(s=>days.some(dd=>{ const dw = dowOfDay(dd.day);
        return (dw===5||dw===6) && !kesinYasak(s.id,y,m,dd.day) && aktifGunMu(s,y,m,dd.day); }));
      const sifir = uygun.filter(s=>sy[s.id]===0).map(s=>ay[s.id]);
      // hafta sonu nöbet yeri uygun kişi sayısından azsa bazılarının 0 kalması kaçınılmazdır; yalnız fazlası uyarılır
      const yer = 2*days.filter(dd=>{ const dw = dowOfDay(dd.day); return dw===5 || dw===6; }).length;
      if (sifir.length > Math.max(0, uygun.length - yer)) warnings.push("Bu ay hafta sonu nöbeti yazılamayan kişiler (personel/izin durumu yetmedi): "+sifir.join(", ")+".");
    })();
    (function esKontrol(){
      days.forEach((dd,i)=>{
        if (dd.locked) return;
        const zor = staffList.filter(s=>getPref(s.id,y,m,dd.day)==="esVar" && aktifGunMu(s,y,m,dd.day));
        if (zor.length > 2) warnings.push(dd.day+". gün için eş durumu 'istiyor' işaretli "+zor.length+" kişi var, günde en fazla 2 nöbetçi yazılabilir.");
        zor.forEach(z=>{
          if (!dd.assigned.some(p=>p.id===z.id)){ warnings.push(dd.day+". gün "+z.name+" için eş durumu isteği karşılanamadı."); return; }
          [-1,1].forEach(k=>{ const gg = days[i+k]; if (gg && gg.assigned.some(p=>p.id===z.id)) warnings.push(z.name+": eş durumu isteği nedeniyle "+dd.day+". gün ile "+gg.day+". gün art arda nöbet yazıldı."); });
        });
      });
    })();
    (function kesinKuralKontrol(){
      // kesin kurallar: personel/izin durumu nedeniyle sağlanamadıysa açıkça bildirilir
      const hsI = [];
      staffList.forEach(s=>{ const ih = hsKuralIhlali(hsSayilari(y, m, days, s.id)); if (ih.length) hsI.push(s.name+" ("+ih.join(", ")+")"); });
      if (hsI.length) warnings.push("Hafta sonu kuralı esnetildi (ayda en fazla 1 Cumartesi, 1 Pazar; Cuma + Cumartesi + Pazar birlikte olmaz): "+hsI.join("; ")+". Personel/izin durumu nedeniyle uyarısız bir çizelge bulunamadı; en az uyarılı çizelge seçildi, ilgili günleri elle düzenleyebilirsin.");
      { const hz = {}; prepAday.forEach(s=>{ hz[s.id] = 0; });
        days.forEach(dd=>(dd.prep||[]).forEach(p=>{ if (hz[p.id]!==undefined) hz[p.id]++; }));
        const L = prepAday.filter(s=> days.some(dy=> dy.tatil && !kesinYasak(s.id, y, m, dy.day)));
        if (L.length > 1){ const v = L.map(s=>hz[s.id]), mx = Math.max.apply(null, v), mn = Math.min.apply(null, v);
          if (mx-mn > 1) warnings.push("Hazırlama farkı sağlanamadı: hazırlama sayıları arasındaki fark "+(mx-mn)+" (en fazla 1). En çok: "+L.filter(s=>hz[s.id]===mx).map(s=>s.name+" ("+mx+")").join(", ")+"; en az: "+L.filter(s=>hz[s.id]===mn).map(s=>s.name+" ("+mn+")").join(", ")+". "+(Number(ayar('cakismaOncelik'))===2 ? "Ayarlar'da çakışmada öncelik fazla mesai saati seçili." : "Personel/izin durumu nedeniyle.")); } }
      { const kk = fmKuralKisileri(y, m), ys = yilGunSayilari(y, m, days), sat = [];
        const dv = (s,k)=> (ys[s.id]||{})[k]||0, hm = (s,k)=> ((ys[s.id]||{}).ham||{})[k]||0;
        if (kk.length > 1) YIL_GUN_TIP.forEach(([k, ad])=>{ const v = kk.map(s=>dv(s,k)), mx = Math.max.apply(null, v), mn = Math.min.apply(null, v);
          if (mx-mn > 1+1e-9) sat.push(ad+" (en çok: "+kk.filter(s=>dv(s,k) > mx-0.5).map(s=>s.name+" "+hm(s,k)).join(", ")+"; en az: "+kk.filter(s=>dv(s,k) < mn+0.5).map(s=>s.name+" "+hm(s,k)).join(", ")+")"); });
        if (sat.length) warnings.push("Yıllık gün dağılımında fark 1'i aşıyor ("+y+" başından bu aya kadar; sonradan başlayan personel yalnız çalıştığı aylara göre karşılaştırılır): "+sat.join("; ")+". Önceki aylardan gelen fark sonraki aylarda kapatılır; fazla mesai ya da hazırlama kuralları bu ay izin vermedi."); }
      { const kk = fmKuralKisileri(y, m), nc = {}; kk.forEach(s=>{ nc[s.id] = 0; });
        days.forEach(dd=>dd.assigned.forEach(p=>{ if (nc[p.id]!==undefined) nc[p.id]++; }));
        if (kk.length > 1){ const v = kk.map(s=>nc[s.id]), mx = Math.max.apply(null, v), mn = Math.min.apply(null, v);
          if (mx-mn > 2) warnings.push("Nöbet sayısı farkı sağlanamadı: kişiler arasındaki fark "+(mx-mn)+" (en fazla 2). En çok: "+kk.filter(s=>nc[s.id]===mx).map(s=>s.name+" ("+mx+")").join(", ")+"; en az: "+kk.filter(s=>nc[s.id]===mn).map(s=>s.name+" ("+mn+")").join(", ")+"."); } }
      const fb = fmFarkBilgisi(y, m, days);
      if (fb.fark > FM_MAX_FARK) warnings.push("KESİN KURAL sağlanamadı: fazla mesai farkı "+fb.fark+" saat (en fazla "+FM_MAX_FARK+"). En çok: "+fb.enCok.name+" ("+(fb.t[fb.enCok.id]||0)+" sa), en az: "+fb.enAz.name+" ("+(fb.t[fb.enAz.id]||0)+" sa). "+(Number(ayar('cakismaOncelik'))===2 ? "Uzun izin, az eczacı ya da kilitli günler nedeniyle olur." : "Ayarlar'da çakışmada öncelik hazırlama eşitliği seçili; hazırlama farkını en fazla 1 tutmak için ya da uzun izin, az eczacı, kilitli günler nedeniyle olur.")+"");
    })();
    (function hs3Kontrol(){
      const t = {}; staffList.forEach(s=>{ t[s.id]=0; });
      days.forEach(dd=>{ const dw = dowOfDay(dd.day); if (dw!==5 && dw!==6) return;
        dd.assigned.forEach(p=>{ if (t[p.id]!==undefined) t[p.id]++; }); });
      const uc = staffList.filter(s=>t[s.id]>ayar('hsUst')).map(s=>s.name+" ("+t[s.id]+")");
      if (uc.length) warnings.push("Personel yetersizliğinden ayda "+(ayar('hsUst')+1)+" ya da daha fazla Cumartesi/Pazar nöbeti düşen kişiler: "+uc.join(", ")+".");
    })();
    const eksikPrep = days.filter((dd,i)=> !dd.locked && haftaSonuMu(i) && dd.prep.length<HAZ_SAYISI).map(dd=>dd.day+(dd.prep.length?" ("+dd.prep.length+"/"+HAZ_SAYISI+")":""));
    if (eksikPrep.length){
      warnings.push("Şu günler için yeterli hazırlama personeli bulunamadı: " + eksikPrep.join(", ") + "." + (destekVar ? "" : ""));
    }
    if (destekVar){
      const tatilGunSayisi = days.filter(dd=>dd.tatil).length;
      const gerekli = destekler.length * DESTEK_AYLIK;
      const sayac = {}; destekler.forEach(s=>{ sayac[s.id]=0; });
      days.forEach(dd=>dd.prep.forEach(pp=>{ if (sayac[pp.id]!==undefined) sayac[pp.id]++; }));
      const farkli = destekler.filter(s=>sayac[s.id]!==DESTEK_AYLIK).map(s=>s.name+" ("+sayac[s.id]+")");
      if (tatilGunSayisi < gerekli){
        warnings.push("Bu ay "+tatilGunSayisi+" tatil günü var; "+destekler.length+" destek personeline ayda kesin "+DESTEK_AYLIK+"'şer görev için "+gerekli+" gün gerekiyor. Destek personeli sayısını azaltırsan ya da tatil günü sayısı artarsa hepsi "+DESTEK_AYLIK+" görev alır.");
      }
      // tatil günü destek personelinin karşılayabileceğinden fazlaysa kalan 2. hazırlama yerlerini eczacı/tekniker doldurur:
      // bu her ay olan olağan durumdur, uyarı olarak gösterilmez
      if (farkli.length && tatilGunSayisi >= gerekli){
        warnings.push("Şu destek personelinde hazırlama sayısı "+DESTEK_AYLIK+" olamadı: "+farkli.join(", ")+". Nedeni: izin, komşu nöbet ya da art arda hazırlama kuralı izin vermedi.");
      }
    }
    days.forEach(dd=>{
      if (!dd.locked || !dd.prep.length) return;
      const ix = dd.day-1;
      dd.prep.forEach(pp=>{
        for (let k=ix-1;k<=ix+1;k++){
          if (k>=0 && k<days.length && days[k].assigned.some(p=>p.id===pp.id)){
            warnings.push(dd.day+". gün elle atadığınız hazırlama personeli "+pp.name+", "+days[k].day+". gün nöbetçi (kural ihlali).");
            break;
          }
        }
        if (kesinYasak(pp.id,y,m,dd.day)){
          warnings.push(dd.day+". gün elle atadığınız hazırlama personeli "+pp.name+" o gün izinli olarak işaretli.");
        }
      });
    });
    days.forEach(dd=>{
      if (!dd.locked) return;
      const hasEcz = dd.assigned.some(p=>eczaciMi(p.role));
      if (!hasEcz && dd.assigned.length>0){
        warnings.push(dd.day+". gün elle atadığınız nöbette eczacı yok.");
      }
      dd.assigned.forEach(p=>{
        if (kesinYasak(p.id,y,m,dd.day)){
          warnings.push(dd.day+". gün elle atadığınız "+p.name+" o gün izinli olarak işaretli.");
        }
      });
    });

    // bu ayın kategorilere göre dağılımını geçmişe kaydet (gelecek ayın telafi hesabı için)
    const monthCatCounts = {};
    state.staff.forEach(s=>{ monthCatCounts[s.id] = {haftaici:0, cuma:0, cumartesi:0, pazar:0}; });
    days.forEach(day=>{
      const cat = dayCategory(y, m, day.day);
      day.assigned.forEach(p=>{
        if (!monthCatCounts[p.id]) monthCatCounts[p.id] = {haftaici:0, cuma:0, cumartesi:0, pazar:0};
        monthCatCounts[p.id][cat]++;
      });
    });
    return {days, warnings, history: monthCatCounts};
  }
  // ---- uyarı sınıfı (index.html 4321–4332) ----
  // uyarının önemi ve kısa başlığı: hata (kural gevşetildi / eksik), uyarı (sınır aşıldı), bilgi (açıklama)
  function uyariSinif(w){
    const t = String(w);
    const seviye = /(dolduruldu|normaldir)\.?$/.test(t) ? "bilgi"
      : /(korunamadı|bulunamadı|karşılanamadı|yetersiz\.|gerekiyor|eczacı yok|eksik kişi|eksik tatil|yeri eksik|sağlanamadı)/i.test(t) ? "hata" : "uyari";
    const B = [[/^Yıllık gün dağılımı/, "Yıllık gün dağılımı"], [/^Hazırlama farkı/, "Hazırlama farkı"], [/^Nöbet sayısı farkı/, "Nöbet sayısı farkı"], [/^Hafta sonu kuralı/, "Hafta sonu kuralı"], [/^KESİN KURAL sağlanamadı: fazla mesai/, "Fazla mesai farkı"], [/KESİN KURAL/i, "Kesin kural"], [/dinlenme kuralı/i, "Zorunlu atama yapılan günler"], [/kural dışı atama/i, "Kural dışı atama"], [/hazırlama (personeli bulunamadı|yeri eksik)/i, "Eksik hazırlama"],
      [/3 ya da daha fazla Cumartesi/i, "3 ya da daha fazla hafta sonu nöbeti"], [/Hafta sonu .*aşan/i, "Hafta sonu sınırı aşıldı"], [/eş durumu/i, "Eş durumu"],
      [/Perşembe/i, "Perşembe nöbeti sınırı"], [/destek personeli ayda/i, "Destek personeli yetmiyor"], [/Eczacı sayısı/i, "Eczacı sayısı az"],
      [/En az 2 eczacı/i, "Eczacı yetersiz"], [/personel sayısı/i, "Personel yetersiz"], [/sonraki ay/i, "Ay geçişi"]];
    const b = B.find(x=>x[0].test(t));
    return {seviye, baslik: b ? b[1] : (seviye==="bilgi" ? "Bilgi" : "Uyarı")};
  }
  // ---- gün kategorisi (index.html 4738–4746) ----
  function dayCategory(y, m, dayNum){
    const dow = jsDowToMonFirst(new Date(y, m, dayNum).getDay());
    if (dow === 4) return "cuma";       // Cuma
    if (dow === 5) return "cumartesi";  // Cumartesi
    if (dow === 6) return "pazar";      // Pazar
    return "haftaici";                  // Pzt, Sal, Çar, Per
  }
  function monthKey(y,m){ return y+"-"+m; }
  function prevMonthOf(y,m){ return m===0 ? {y:y-1, m:11} : {y, m:m-1}; }
  // ---- gerçek görev (index.html 4768–4777) ----
  // bir günde GERÇEKTE nöbet / hazırlama tutanlar: çizelge + puantajdaki değişimler (nöbet değişimi, devir, takas).
  // Yalnız ay sınırındaki dinlenme kuralları (art arda nöbet, 3 gün ara) için kullanılır; eşitlik hesabı çizelgeye göredir.
  function gercekGorev(y, m, d){
    const sc = state.schedules[y+"-"+m], g = sc && sc.days && sc.days[d-1];
    const N = new Set(g ? (g.assigned||[]).map(p=>p.id) : []), H = new Set(g ? (g.prep||[]).map(p=>p.id) : []);
    const ov = state.puantaj && state.puantaj[y+"-"+m];
    if (ov) Object.keys(ov).forEach(k=>{ const c = ov[k] && ov[k][d]; if (c===undefined || c===null || c==="") return; const id = Number(k);
      N.delete(id); H.delete(id); if (c==="N") N.add(id); else if (c==="H") H.add(id); });
    return {N:[...N], H:[...H]};
  }

  // ---- elle gün düzenlemede anlık kural kontrolü (index.html 5548–5658) ----
  const DURUM_AD = {YI:"Yıllık izin", R:"Rapor", NI:"Nöbet izni (fazla mesai karşılığı)", DI:"Diğer izin"};
  function gunKontrol(sch, day, nb, pr, opts){
    const days = sch.days, idx = day.day-1, y = sch.year, m = sch.month;
    const out = []; const ekle = (sev, t)=> out.push({sev, t});
    const dw = jsDowToMonFirst(new Date(y,m,day.day).getDay());
    const hz = ayar('hazSaat');
    // ay sınırında komşu gün: önceki ayın son günü / sonraki ayın 1. günü
    const pmY = m===0 ? y-1 : y, pmM = m===0 ? 11 : m-1, nmY = m===11 ? y+1 : y, nmM = m===11 ? 0 : m+1;
    const oS = state.schedules[pmY+"-"+pmM], sS = state.schedules[nmY+"-"+nmM];
    const komsuAy = k=>{
      const ob = gg=>({assigned: gg.N.map(id=>({id})), prep: gg.H.map(id=>({id}))});
      if (idx+k===-1 && oS && oS.days.length){ const d = oS.days[oS.days.length-1]; return Object.assign({day: d.day+" "+AYLAR[pmM]+" günü"}, ob(gercekGorev(pmY, pmM, d.day))); }
      if (idx+k===days.length && sS && sS.days.length){ return Object.assign({day: "1 "+AYLAR[nmM]+" günü"}, ob(gercekGorev(nmY, nmM, 1))); }
      return undefined;
    };
    const g = k => days[idx+k] || komsuAy(k);
    const gl = gg => (typeof gg.day==="number") ? gg.day+". gün" : gg.day;
    if (nb.length && !nb.some(p=>eczaciMi(p.role))) ekle("hata", "Bu günde eczacı yok.");
    if (nb.filter(p=>p.role==="nobetci").length > 1) ekle("hata", "Dışarıdan nöbete gelen iki eczacı aynı güne birlikte nöbetçi yazılmaz (biri hazırlama olabilir).");
    if (nb.length < 2) ekle("uyari", "Günde 2 nöbetçi olmalı; ikinci kişi boş.");
    state.staff.filter(s=>nobetciRol(s.role) && getPref(s.id,y,m,day.day)==="esVar" && aktifGunMu(s,y,m,day.day) && !nb.some(q=>q.id===s.id)).forEach(s=> ekle("hata", s.name+" için eş durumu: bu güne nöbetçi yazılması gerekiyor."));
    nb.forEach(p=>{
      [-1, 1].forEach(k=>{
        const gg = g(k); if (!gg) return;
        if (gg.assigned.some(q=>q.id===p.id)) ekle("hata", p.name+", "+gl(gg)+" de nöbetçi; nöbetten sonra ertesi gün izinli olmalı.");
        if ((gg.prep||[]).some(q=>q.id===p.id)) ekle("hata", p.name+", "+gl(gg)+" hazırlama personeli (komşu gün).");
      });
      { const v = k=>{ const gg = days[idx+k]; return !!(gg && gg.assigned.some(q=>q.id===p.id)); };
        if ((v(-2) && v(-4)) || (v(-2) && v(2)) || (v(2) && v(4))) ekle("hata", p.name+" 5 gün içinde 3. nöbetini tutuyor (ör. Pazartesi–Çarşamba–Cuma); en fazla bir kez 2 gün arayla yazılabilir."); }
      const ara = ayar('minAra');
      for (let k=2; k<ara; k++){
        [-k, k].forEach(kk=>{ const gg = g(kk); if (gg && gg.assigned.some(q=>q.id===p.id)) ekle("uyari", p.name+", "+gg.day+". gün de nöbetçi (en az "+ara+" gün ara önerilir)."); });
      }
      const stp = state.staff.find(x=>x.id===p.id);
      if (stp && !aktifGunMu(stp, y, m, day.day)) ekle("hata", p.name+" bu tarihte çalışmıyor (işe başlama / ayrılış tarihi dışında).");
      else if (stp && stp.bitis && isoNo(stp.bitis)===tarihNo(y,m,day.day)){
        const ertesiMs = day.day < days.length ? gunMesaiSaati(y,m,day.day+1) : gunMesaiSaati(nmY,nmM,1);
        if (ertesiMs > 0) ekle("uyari", p.name+" için bu gün son çalışma günü; ertesi gün nöbet izni kullanamaz (fazla mesaisi çizelgedekinden "+ertesiMs+" saat fazla çıkar).");
      }
      const pr0 = getPref(p.id, y, m, day.day);
      const dk0 = pzDurumKodu(p.id, y, m, day.day);
      if (dk0) ekle("hata", p.name+" bu gün "+DURUM_AD[dk0].toLowerCase()+" kullanıyor (puantajda kayıtlı).");
      else if (pr0==="izinli") ekle("hata", p.name+" bu gün izinli olarak işaretli.");
      else if (izinArasiMi(p.id, y, m, day.day)) ekle("hata", p.name+" bu gün izin arasında (iki izin günü arasındaki tatil).");
      else if (izinHaftasiKenariMi(p.id, y, m, day.day)) ekle("hata", p.name+" bu gün bir haftalık yıllık izninin önündeki / arkasındaki hafta sonu.");
      else if (izinOncesiMi(p.id, y, m, day.day)) ekle("uyari", p.name+" ertesi gün izne çıkıyor; nöbet ertesi izni izin gününe düşer.");
      if (pr0==="esYok") ekle("hata", p.name+" için eş durumu: bu güne yazılmaması gerekiyor.");
      if (pr0==="avoid") ekle("uyari", p.name+" bu gün nöbet istemiyor.");
      let thu = 0, hs = 0;
      days.forEach((gg,i)=>{ if (i===idx) return; if (gg.assigned.some(q=>q.id===p.id)){ const w = jsDowToMonFirst(new Date(y,m,gg.day).getDay()); if (w===3) thu++; if (w===5||w===6) hs++; } });
      if (dw===3){ thu++; if (thu > ayar('maxThu')) ekle("uyari", p.name+" bu ay "+thu+". Perşembe nöbetini tutuyor (sınır "+(ayar('maxThu')>=99?"yok":ayar('maxThu'))+")."); }
      // Perşembe nöbeti ↔ aynı hafta sonu: hazırlama kesin yasak, nöbet önerilmez
      if (dw===3 && ayar('thuHaftaSonu')) [2,3].forEach(k=>{ const gg = days[idx+k]; if (!gg) return;
        if ((gg.prep||[]).some(q=>q.id===p.id)) ekle("hata", p.name+" Perşembe nöbetçisi, ama aynı hafta sonu "+gg.day+". gün hazırlama görevinde.");
        if (gg.assigned.some(q=>q.id===p.id)) ekle("uyari", p.name+" Perşembe nöbetçisi; aynı hafta sonu "+gg.day+". gün de nöbetçi."); });
      if (dw===4){ const gg = days[idx+2]; if (gg && gg.assigned.some(q=>q.id===p.id)) ekle("uyari", p.name+" Cuma nöbetçisi; aynı hafta Pazar ("+gg.day+". gün) de nöbetçi.");
        if (gg && (gg.prep||[]).some(q=>q.id===p.id)) ekle("uyari", p.name+" Cuma nöbetçisi; aynı hafta Pazar ("+gg.day+". gün) hazırlama görevinde."); }
      if (dw===6){ const gg = days[idx-2]; if (gg && gg.assigned.some(q=>q.id===p.id)) ekle("uyari", p.name+" aynı haftanın Cuma günü ("+gg.day+". gün) nöbetçi; Cuma ve Pazar aynı kişiye yazılmamalı."); }
      if ((dw===5 || dw===6) && ayar('thuHaftaSonu')){ const gg = days[idx-(dw===5?2:3)]; if (gg && gg.assigned.some(q=>q.id===p.id)) ekle("uyari", p.name+" aynı haftanın Perşembe günü ("+gg.day+". gün) nöbetçi."); }
      if (dw===5 || dw===6){
        hs++;
        if (hs > ayar('hsUst')) ekle("hata", p.name+" bu ay "+hs+". hafta sonu nöbetini tutuyor (en fazla "+ayar('hsUst')+").");
      }
      if (dw===4 || dw===5 || dw===6){
        const yeniGunler = days.map((gg,i)=> i===idx ? {day:gg.day, assigned:nb} : gg);
        const ih = hsKuralIhlali(hsSayilari(y, m, yeniGunler, p.id));
        if (ih.length) ekle("hata", p.name+": hafta sonu kuralı — ayda en fazla 1 Cumartesi ve 1 Pazar; Cuma + Cumartesi + Pazar birlikte yazılmaz (bu ay: "+ih.join(", ")+").");
      }
    });
    pr.forEach(p=>{
      if (nb.some(q=>q.id===p.id)) ekle("hata", p.name+" hem nöbetçi hem hazırlama olamaz.");
      for (let k=-1; k<=1; k++){
        const gg = g(k); if (!gg || k===0) continue;
        if (gg.assigned.some(q=>q.id===p.id)) ekle("hata", p.name+" hazırlama, ama "+gl(gg)+" nöbetçi.");
      }
      [-1, 1].forEach(k=>{ const gg = g(k); if (gg && (gg.prep||[]).some(q=>q.id===p.id)) ekle("hata", p.name+", "+gl(gg)+" de hazırlama görevinde; art arda iki gün hazırlama yazılmaz."); });
      if (izinliMi(p.id, y, m, day.day)) ekle("hata", p.name+" bu gün izinli"+(getPref(p.id, y, m, day.day)==="izinli" ? " olarak işaretli." : " (iki izin günü arasındaki tatil)."));
      else if (izinHaftasiKenariMi(p.id, y, m, day.day)) ekle("hata", p.name+" bu gün bir haftalık yıllık izninin önündeki / arkasındaki hafta sonu.");
      if (dw===6){ const gg = days[idx-2]; if (gg && gg.assigned.some(q=>q.id===p.id)) ekle("uyari", p.name+" aynı haftanın Cuma günü ("+gg.day+". gün) nöbetçi; Pazar hazırlaması yazılmamalı."); }
      if ((dw===5 || dw===6) && ayar('thuHaftaSonu')){ const gg = days[idx-(dw===5?2:3)]; if (gg && gg.assigned.some(q=>q.id===p.id)) ekle("hata", p.name+" aynı haftanın Perşembe günü ("+gg.day+". gün) nöbetçi; hafta sonu hazırlama yazılmaz."); }
      if (getPref(p.id, y, m, day.day)==="esYok") ekle("hata", p.name+" için eş durumu: bu güne yazılmaması gerekiyor.");
      if (p.role!=="destek"){
        let say = 1; days.forEach((gg,i)=>{ if (i!==idx && (gg.prep||[]).some(q=>q.id===p.id)) say++; });
        if (say > 2) ekle("hata", p.name+" bu ay "+say+". hazırlama görevini alıyor (ayda en fazla 2).");
      }
      if (p.role==="destek"){
        let say = 1; days.forEach((gg,i)=>{ if (i!==idx && (gg.prep||[]).some(q=>q.id===p.id)) say++; });
        if (say > ayar('destekAylik')) ekle("uyari", p.name+" bu ay "+say+". hazırlama görevini alıyor (destek personeli için "+ayar('destekAylik')+")."); 
      }
    });
    // fazla mesai etkisi
    const top = {}; state.staff.forEach(s=>{ top[s.id] = 0; });
    days.forEach((gg,i)=>{
      if (i===idx) return;
      gg.assigned.forEach(p=>{ if (top[p.id]!==undefined) top[p.id] += gg.fazlaMesai; });
      (gg.prep||[]).forEach(p=>{ if (top[p.id]!==undefined) top[p.id] += hz; });
    });
    nb.forEach(p=>{ top[p.id] += day.fazlaMesai; }); pr.forEach(p=>{ top[p.id] += hz; });
    const duty = state.staff.filter(s=>nobetciRol(s.role));
    const ort = duty.length ? duty.reduce((a,s)=>a+top[s.id],0)/duty.length : 0;
    if (opts && opts.fm){ const kk = fmKuralKisileri(y, m);
      if (kk.length > 1){ let mx = kk[0], mn = kk[0]; kk.forEach(s=>{ if (top[s.id]>top[mx.id]) mx = s; if (top[s.id]<top[mn.id]) mn = s; });
        const fk = top[mx.id]-top[mn.id];
        if (fk > FM_MAX_FARK) ekle("hata", "Kesin kural: bu değişiklikle fazla mesai farkı "+fk+" saat olur (en fazla "+FM_MAX_FARK+"). En çok "+mx.name+" ("+top[mx.id]+" sa), en az "+mn.name+" ("+top[mn.id]+" sa)."); } }
    const hedef = ayar('fmHedef');
    nb.concat(pr.filter(p=>p.role!=="destek")).filter((p,i,a)=>a.findIndex(q=>q.id===p.id)===i).forEach(p=>{
      const fark = Math.round(top[p.id]-ort);
      const metin = p.name+": toplam "+top[p.id]+" saat, ortalama "+Math.round(ort)+" ("+(fark>=0?"+":"")+fark+").";
      ekle(Math.abs(fark) > hedef ? "uyari" : "bilgi", metin);
    });
    return out;
  }

  // ---- puantaj kodları ve yardımcılar (index.html 4747–4767) ----

  // ---------- puantaj (günlük düzenlenebilir) ----------
  const PZ_KODLAR = [["M","Normal mesai"],["N","Nöbet"],["H","Hazırlama (tatil günü)"],["NI","Nöbet izni"],["YI","Yıllık izin"],["R","Rapor"],["B","Çalışmadı (devamsız / ücretsiz)"]];
  const PZ_ROL_SIRA = {eczaci:0, nobetci:1, teknisyen:2, destek:3, servis:4};
  function pzMetin(kod){
    if (kod==="M") return String(ayar('mesai')); if (kod==="N") return String(ayar('nobetSuresi')); if (kod==="H") return String(ayar('hazSaat'));
    if (kod==="NI") return "Nİ"; if (kod==="YI") return "Yİ"; if (kod==="R") return "R"; if (kod==="DI") return "Dİ"; if (kod==="P") return "–";
    if (kod && kod.indexOf("S:")===0) return kod.slice(2);
    return "";
  }
  function pzSaat(kod){
    if (kod==="M") return ayar('mesai'); if (kod==="N") return ayar('nobetSuresi'); if (kod==="H") return ayar('hazSaat');
    if (kod && kod.indexOf("S:")===0) return Number(kod.slice(2)) || 0;
    return 0;
  }
  function pzSinif(kod){ return (kod && kod.indexOf("S:")===0) ? "k-S" : "k-"+kod; }
  function pzOv(y,m,olustur){
    const k = y+"-"+m;
    if (!state.puantaj[k]){ if (!olustur) return {}; state.puantaj[k] = {}; }
    return state.puantaj[k];
  }
  // ---- aylık puantaj cetveli (index.html 4779–4872) ----
  function pzSonGunKodu(id, y, m){
    const pm = prevMonthOf(y,m), dimP = daysInMonth(pm.y, pm.m);
    const ov = state.puantaj[pm.y+"-"+pm.m];
    const o = ov && ov[id] && ov[id][dimP];
    if (o) return o;
    const st = state.staff.find(x=>x.id===id);
    if (st && !aktifGunMu(st, pm.y, pm.m, dimP)) return "P";
    const sch = state.schedules[pm.y+"-"+pm.m];
    if (sch && sch.days[dimP-1] && sch.days[dimP-1].assigned.some(p=>p.id===id)) return "N";
    if (sch && sch.days[dimP-1] && (sch.days[dimP-1].prep||[]).some(p=>p.id===id)) return "H";
    // acil servis nöbeti (acil eczane çizelgesinden) ayın son gününe düştüyse ertesi ayın 1'i nöbet iznidir
    const ac = (state.acil||{})[pm.y+"-"+pm.m];
    if (ac && Array.isArray(ac[dimP]) && ac[dimP].indexOf(id) >= 0) return "N";
    return "";
  }
  function puantajGrid(y, m){
    const dim = daysInMonth(y,m), sch = state.schedules[y+"-"+m], ov = pzOv(y,m,false), acilAy = state.acil[y+"-"+m] || {};
    const gunler = [];
    for (let d=1; d<=dim; d++){ const tt = isTatilGunu(y,m,d); gunler.push({gun:d, dw:jsDowToMonFirst(new Date(y,m,d).getDay()), tatil:tt, arife: !tt && isArife(y,m,d), ms: gunMesaiSaati(y,m,d)}); }
    const mesaiS = ayar('mesai'), mesaiGun = gunler.filter(g=>!g.tatil).length;
    // arife varsa beklenen mesai gün gün saatle hesaplanır (arife yarım gün); yoksa eski hesap aynen
    const arifeVar = gunler.some(g=>g.arife), mesaiToplam = gunler.reduce((t,g)=>t+g.ms, 0);
    const kisiler = state.staff.filter(st=>aktifAydaMi(st,y,m)).sort((a,b)=> PZ_ROL_SIRA[a.role]-PZ_ROL_SIRA[b.role] || a.name.localeCompare(b.name,"tr") || a.id-b.id);
    const satirlar = kisiler.map(st=>{
      const hucre = []; let prev = pzSonGunKodu(st.id, y, m);
      const r = {s:st, cells:hucre, toplam:0, fm:0, n:0, hi:0, cu:0, cmt:0, paz:0, thu:0, h:0, ni:0, yi:0, rd:0, rt:0, gunlerN:[]};
      let nMesaiSaat = 0, niSaat = 0, pSaat = 0, izinMesai = 0;
      const sadeceNobet = st.role==="nobetci" || st.role==="destek"; // normal mesaisi olmayanlar: yalnızca nöbet/hazırlama günleri
      gunler.forEach((g,i)=>{
        const o = ov[st.id] && ov[st.id][g.gun];
        let kod, acilFlag = false;
        const acilVar = !!(acilAy[g.gun] && acilAy[g.gun].indexOf(st.id) >= 0);
        if (o){ kod = o; // acil servis nöbetçi eczacısına puantajda elle yazılan nöbet, eczane nöbeti değil acil servis nöbetidir
          if (o==="N" && (st.role==="servis" || acilVar)) acilFlag = true; }
        else {
          const sd = sch && sch.days[i];
          if (!aktifGunMu(st,y,m,g.gun)) kod = "P";
          else if (sd && sd.assigned.some(p=>p.id===st.id)) kod = "N";
          else if (sd && (sd.prep||[]).some(p=>p.id===st.id)) kod = "H";
          else if (acilVar){ kod = "N"; acilFlag = true; }
          else if (sadeceNobet) kod = (st.role==="nobetci" && !g.tatil && prev==="N") ? "NI" : "B";
          else if (!g.tatil){
            if (prev==="N") kod = "NI";
            else if (getPref(st.id,y,m,g.gun)==="izinli") kod = "YI";
            else kod = "M";
          } else kod = "B";
        }
        let saat = (kod==="M" && g.arife) ? g.ms : pzSaat(kod);
        // memur: yıllık izin ve raporlu gün, o günün normal mesai saatiyle çalışılmış sayılır
        if (!sadeceNobet && (kod==="YI" || kod==="R" || kod==="DI")) saat = g.ms;
        hucre.push({kod, saat, ov:!!o, acil:acilFlag});
        r.toplam += saat;
        if (kod==="N"){ r.n++; if (!acilFlag && isManualTatil(y,m,g.gun)) r.rt++; if (!g.tatil) nMesaiSaat += g.ms; if (g.dw===5) r.cmt++; else if (g.dw===6) r.paz++; else if (g.dw===4) r.cu++; else r.hi++; if (g.dw===3) r.thu++; r.gunlerN.push({gun:g.gun, dw:g.dw, tip:"N"}); }
        else if (kod==="H"){ r.h++; r.gunlerN.push({gun:g.gun, dw:g.dw, tip:"H"}); }
        else if (kod==="NI"){ r.ni++; niSaat += g.ms; }
        else if (kod==="YI") r.yi++;
        else if (kod==="R" || kod==="DI") r.rd++;
        if (!g.tatil && (kod==="YI" || kod==="R" || kod==="DI" || kod==="P")){ if (kod==="P") pSaat += g.ms; else izinMesai += g.ms; }
        prev = kod;
      });
      // Ay sınırı: nöbetin ertesi gün izni (Nİ) nöbetin yazıldığı aya sayılır (çizelge planlamasıyla aynı):
      //  - ayın 1. gününe düşen, önceki ayın son gün nöbetinden gelen Nİ bu ayın fazla mesaisini azaltmaz
      //  - ayın son günü nöbet varsa ve ertesi gün mesai günüyse o Nİ bu aydan düşülür
      const ilkNI = hucre.length && hucre[0].kod==="NI" && !hucre[0].ov && pzSonGunKodu(st.id, y, m)==="N";
      const nm = m===11 ? 0 : m+1, ny = m===11 ? y+1 : y;
      const ileriNI = (hucre.length && hucre[hucre.length-1].kod==="N" && isMesaiGunuGeneric(ny, nm, 1)) ? gunMesaiSaati(ny, nm, 1) : 0;
      r.fmAdj = (ilkNI ? gunler[0].ms : 0) - ileriNI;
      // dışarıdan nöbete gelen eczacı: nöbet gününün ve ertesi günün normal mesaisi düşülür
      // (hafta içi 24-8-8 = 8, Cuma 16, Cumartesi 24, Pazar 16); destek: hazırlama saatleri aynen
      // Aylık çalışma saati: ayın normal mesai saatleri (işe başlama öncesi / ayrılış sonrası günler hariç).
      // Fazla mesai = toplam çalışma saati (Yİ ve R günleri mesai sayılarak) − aylık çalışma saati.
      // Dışarıdan gelen eczacı: nöbet günü (mesai günüyse) ve nöbet izni gününün mesaisi düşülür. Destek: hazırlama saatleri.
      r.aylik = sadeceNobet ? null : mesaiToplam - pSaat;
      r.izinMesai = izinMesai;
      r.dusum = st.role==="nobetci" ? niSaat + nMesaiSaat : 0;
      r.fm = st.role==="nobetci" ? r.toplam - r.dusum + r.fmAdj : (sadeceNobet ? r.toplam : r.toplam - r.aylik + r.fmAdj);
      // saat dilimleri: nöbet 08:00'de başlar. 20:00-08:00 dilimi (12 saat) tamamen fazla mesaidir; 08:00-20:00
      // diliminden o günün normal mesaisi düşülür. Ertesi günün nöbet izni (Nİ) önce 08:00-20:00 diliminden düşülür
      // (niDusum gizli ayar, hep 1), yetmezse kalanı 20:00-08:00 diliminden. Nöbet dışı tüm farklar (hazırlama, özel saat, eksik gün...) 08:00-20:00'e yazılır.
      { const L = pzSaat("N"), gecePay = Math.min(12, L), gunduzOnce = ayar('niDusum')!==2; let gece = 0;
        hucre.forEach((c,i)=>{
          if (c.kod!=="N") return;
          let gd = Math.max(0, L - gecePay - gunler[i].ms), gc = gecePay;
          const D = (i+1 < hucre.length) ? (hucre[i+1].kod==="NI" ? gunler[i+1].ms : 0) : ileriNI;
          if (gunduzOnce){ gd -= D; if (gd < 0){ gc += gd; gd = 0; } } else { gc -= D; if (gc < 0){ gd += gc; gc = 0; } }
          gece += Math.max(0, gc);
        });
        if (r.fm <= 0){ r.fmGece = 0; r.fmGunduz = r.fm; }
        else { r.fmGece = Math.min(gece, r.fm); r.fmGunduz = r.fm - r.fmGece; }
      }
      return r;
    });
    return {y, m, gunler, satirlar, mesaiGun, mesaiS, arifeVar, mesaiToplam, ay: AYLAR[m]+" "+y};
  }

  // ---- yıllık raporlar (index.html 6608, 6611–6644, 6668–6709) ----
  const AY_KISA = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  function ayDetayGrid(y, m){
    const G = puantajGrid(y,m), r = {};
    G.satirlar.forEach(x=>{ r[x.s.id] = {fm:x.fm, nobet:x.n, hi:x.hi, cu:x.cu, cmt:x.cmt, paz:x.paz, thu:x.thu, prep:x.h, ni:x.ni, yi:x.yi, rd:x.rd, rt:x.rt||0, gunler:x.gunlerN}; });
    // listeden çıkarılmış kişilerin eski çizelge verisi
    const sch = state.schedules[y+"-"+m];
    if (sch){
      const dimS = daysInMonth(y,m), hz = ayar('hazSaat');
      sch.days.forEach(d=>{
        const dw = jsDowToMonFirst(new Date(y,m,d.day).getDay()), fm = computeFazlaMesaiForDay(y,m,d.day,dimS);
        d.assigned.filter(p=>!state.staff.some(s=>s.id===p.id)).forEach(p=>{ const x = r[p.id] || (r[p.id] = {fm:0,nobet:0,hi:0,cu:0,cmt:0,paz:0,thu:0,prep:0,ni:0,yi:0,rd:0,rt:0,gunler:[]}); x.fm += fm; x.nobet++; if (dw===5) x.cmt++; else if (dw===6) x.paz++; else if (dw===4) x.cu++; else x.hi++; if (dw===3) x.thu++; x.gunler.push({gun:d.day, dw, tip:"N"}); });
        (d.prep||[]).filter(p=>!state.staff.some(s=>s.id===p.id)).forEach(p=>{ const x = r[p.id] || (r[p.id] = {fm:0,nobet:0,hi:0,cu:0,cmt:0,paz:0,thu:0,prep:0,ni:0,yi:0,rd:0,rt:0,gunler:[]}); x.fm += hz; x.prep++; x.gunler.push({gun:d.day, dw, tip:"H"}); });
      });
    }
    return r;
  }
  function yilVerisi(yil){
    const aylar = [];
    for (let m=0;m<12;m++){
      const sch = state.schedules[yil+"-"+m];
      const veri = (sch && ayVeriVarMi(sch)) || Object.keys(state.puantaj[yil+"-"+m] || {}).length > 0 || Object.keys(state.acil[yil+"-"+m] || {}).length > 0;
      aylar.push(veri ? {m, sch: sch || null, det: ayDetayGrid(yil, m)} : null);
    }
    const kisiler = []; const goruldu = {};
    state.staff.forEach(s=>{ kisiler.push({id:s.id, name:s.name, role:s.role, aktif:true, ayrildi: !!s.bitis && ayrildiMi(s)}); goruldu[s.id] = true; });
    aylar.forEach(a=>{ if (!a || !a.sch) return; a.sch.days.forEach(d=>d.assigned.concat(d.prep||[]).forEach(p=>{ if (!goruldu[p.id]){ goruldu[p.id] = true; kisiler.push({id:p.id, name:p.name, role:p.role, aktif:false}); } })); });
    kisiler.sort((a,b)=> PZ_ROL_SIRA[a.role]-PZ_ROL_SIRA[b.role] || a.id-b.id);
    return {yil, aylar, kisiler, kayitli: aylar.filter(Boolean).length};
  }
  const bosDet = {fm:0, nobet:0, hi:0, cu:0, cmt:0, paz:0, thu:0, prep:0, ni:0, yi:0, rd:0, rt:0, gunler:[]};
  function kisiYillik(V, id){
    const t = {fm:0, nobet:0, hi:0, cu:0, cmt:0, paz:0, thu:0, prep:0, ni:0, yi:0, rd:0, rt:0};
    V.aylar.forEach(a=>{ if (!a) return; const d = a.det[id]; if (!d) return; Object.keys(t).forEach(k=>{ t[k] += (d[k]||0); }); });
    return t;
  }
  // ---- yıllık denge: her nöbetçinin yıl toplamları, çalıştığı ay sayısına göre beklenen paydan farkı ----
  const DENGE_KOL = [
    {k:"nobet", t:"Nöbet sayısı"}, {k:"pe", t:"Perşembe"}, {k:"cu", t:"Cuma"}, {k:"cmt", t:"Cumartesi"}, {k:"paz", t:"Pazar"},
    {k:"prep", t:"Hazırlama"}, {k:"rt", t:"Resmi tatil"}, {k:"fm", t:"Fazla mesai", saat:true}
  ];
  // Yıllık denge onaylanan çizelgeden hesaplanır (adalet referansı): puantajdaki gönüllü nöbet değişimleri sayılmaz;
  // izin/rapor nedeniyle yerine geçmeler çizelgeye işlendiği için sayılır. Fazla mesai = nöbet + hazırlama saatleri (çizelgeye göre).
  function cizelgeYillik(yil){
    const t = {}, aylar = [], hz = ayar('hazSaat');
    const bos = ()=>({nobet:0, cu:0, cmt:0, paz:0, pe:0, rt:0, prep:0, fm:0});
    for (let mm=0; mm<12; mm++){
      const sc = state.schedules[yil+"-"+mm]; if (!sc || !Array.isArray(sc.days) || !ayVeriVarMi(sc)) continue;
      aylar.push(mm); const dim = daysInMonth(yil,mm), kisiAy = {};
      sc.days.forEach(d=>{
        const dw = jsDowToMonFirst(new Date(yil,mm,d.day).getDay()), tt = isTatilGunu(yil,mm,d.day), rt = isManualTatil(yil,mm,d.day), fm = computeFazlaMesaiForDay(yil,mm,d.day,dim);
        (d.assigned||[]).forEach(p=>{ const x = t[p.id] || (t[p.id] = bos()); x.nobet++; x.fm += fm; if (dw===4 && !tt) x.cu++; if (dw===5) x.cmt++; if (dw===6) x.paz++; if (dw===3) x.pe++; if (rt) x.rt++; kisiAy[p.id] = true; });
        // nöbet sayısı = nöbetler + hazırlama (raporlarda ortak tanım)
        (d.prep||[]).forEach(p=>{ const x = t[p.id] || (t[p.id] = bos()); x.prep++; x.nobet++; x.fm += hz; kisiAy[p.id] = true; });
      });
      Object.keys(kisiAy).forEach(id=>{ (t[id].aylar = t[id].aylar || []).push(mm); });
    }
    return {t, aylar, bos};
  }
  function dengeVerisi(V){
    const CZ = cizelgeYillik(V.yil);
    const kayitliAy = CZ.aylar;
    const kisiler = V.kisiler.filter(k=>nobetciRol(k.role)).map(k=>{
      const st = state.staff.find(s=>s.id===k.id), t = CZ.t[k.id] || CZ.bos();
      const ay = kayitliAy.filter(i=> st ? aktifAydaMi(st, V.yil, i) : (t.aylar||[]).indexOf(i)>=0).length;
      return {k, t, ay};
    }).filter(x=>x.ay > 0);
    const ayTop = kisiler.reduce((a,x)=>a+x.ay, 0);
    const ort = {};
    DENGE_KOL.forEach(c=>{ ort[c.k] = ayTop ? kisiler.reduce((a,x)=>a+x.t[c.k], 0) / ayTop : 0; });   // ay başına ortalama
    const tamAy = kayitliAy.length;
    kisiler.forEach(x=>{ x.fark = {}; x.bek = {}; DENGE_KOL.forEach(c=>{ x.bek[c.k] = ort[c.k]*x.ay; x.fark[c.k] = x.t[c.k] - x.bek[c.k]; }); x.kismi = x.ay < tamAy; });
    const hedef = ayar('fmHedef');
    const sinif = (c, d)=>{ const a = Math.abs(d), s1 = c.saat ? hedef : 1.5, s2 = c.saat ? hedef*2 : 2.5; return a <= s1 ? "" : (a <= s2 ? "d-mid" : "d-bad"); };
    // yalnız tüm yıl (kayıtlı ayların hepsinde) çalışanlar arasında en çok − en az
    const tam = kisiler.filter(x=>!x.kismi), aralik = {};
    DENGE_KOL.forEach(c=>{ const v = tam.map(x=>x.t[c.k]); aralik[c.k] = v.length ? {min:Math.min.apply(null,v), max:Math.max.apply(null,v)} : null; });
    return {kisiler, ort, tamAy, sinif, aralik, hedef};
  }

  // ---- taşıma katmanı ----
  // eski ensureScheduleDraft'ın karşılığı: ayın kayıtlı taslağı varsa (elle kilitlenmiş günler) o, yoksa boş günler
  function taslakGunler(y, m){
    const kayitli = state.schedules[y+"-"+m];
    if (kayitli && Array.isArray(kayitli.days) && kayitli.days.length){ fmYenile(kayitli); return kayitli.days; }
    const dim = daysInMonth(y,m), days = [];
    for (let d=1; d<=dim; d++) days.push({day:d, tatil:isTatilGunu(y,m,d), conflict:false, fazlaMesai:computeFazlaMesaiForDay(y,m,d,dim), assigned:[], prep:[], locked:false});
    return days;
  }

const kopya = v => JSON.parse(JSON.stringify(v));

// ---- günlük çalışma listesi (eski uygulama index.html gunlukListe, aynen) ----
function gunlukListe(G, d){
  const var_ = [], yok = [], tatil = !!G.gunler[d-1].tatil;
  G.satirlar.forEach(r=>{
    const c = r.cells[d-1], kod = c.kod;
    const calisiyor = kod==="M" || kod==="N" || kod==="H" || (kod && kod.indexOf("S:")===0 && c.saat>0);
    if (calisiyor){ var_.push({s:r.s, kod, saat:c.saat, acil:!!c.acil}); return; }
    const neden = {NI:"Nöbet ertesi izni", YI:"Yıllık izin", R:"Raporlu", DI:"Diğer izin"}[kod];
    if (neden) yok.push({s:r.s, neden});
  });
  let onay, haz, dst;
  // hafta sonu / tatil: dışarıdan gelen eczacı ayrı listelenmez, görevine göre onaycı ya da hazırlamacıdır
  const gel = tatil ? [] : var_.filter(x=>x.s.role==="nobetci");
  if (tatil){
    // Hafta sonu/tatil: nöbetçiler (eczacı+tekniker ya da eczacı+eczacı) onay görevinde;
    // 2 hazırlamacı rolü ne olursa olsun (eczacı, tekniker, destek) hazırlama görevinde.
    // Acil serviste nöbet tutan eczacılar (acil servis nöbetçi eczacısı ya da acil listesine yazılan eczacı)
    // hafta sonu / tatil listesinde gösterilmez: yalnız günlük eczanede nöbet tutanlar onaycıdır.
    const acilMi = x=> x.acil || x.s.role==="servis";
    const hazMi = x=> x.kod==="H" && !acilMi(x);
    const onayMi = x=> x.kod==="N" && !acilMi(x);
    onay = var_.filter(onayMi);
    haz = var_.filter(hazMi);
    dst = [];
    // nöbet/hazırlama dışında kalan diğer çalışanlar rolüne göre yerleşir
    var_.forEach(x=>{ if (acilMi(x) || onayMi(x) || hazMi(x) || x.s.role==="nobetci") return;
      if (x.s.role==="eczaci") onay.push(x); else haz.push(x); });
  } else {
    onay = var_.filter(x=>x.s.role==="eczaci" || x.s.role==="servis");
    haz = var_.filter(x=>x.s.role==="teknisyen");
    dst = var_.filter(x=>x.s.role==="destek");
  }
  const azSira = (a,b)=> a.s.name.localeCompare(b.s.name, "tr");
  [onay, haz, dst, gel, yok].forEach(l=>l.sort(azSira));
  return {tatil, onay, haz, dst, gel, yok, toplam: var_.length, nobetci: var_.filter(x=>x.kod==="N" && !x.acil).length, acilN: var_.filter(x=>x.acil).length};
}

// ---- nöbet değişimi ve izin/rapor yerine geçme (eski uygulama index.html, aynen) ----
function cikYeniKod(y,m,gun,cik){
  const st = state.staff.find(x=>x.id===cik) || {};
  return (isTatilGunu(y,m,gun) || st.role==="nobetci" || st.role==="destek") ? "B" : "M";
}

function kisiAdi(id){ const q = state.staff.find(x=>x.id===id); return q ? q.name : "(silinmiş)"; }
function degisimMetni(d){
  const hz = d.gorev==="H";
  if (d.tur==="takas" && d.gun2 && d.gorev2 && d.gorev2!==d.gorev){
    const t = k=> k==="H" ? "hazırlama" : "nöbet";
    return d.gun+" "+AYLAR[d.m]+" "+kisiAdi(d.cik)+" ("+t(d.gorev)+") ↔ "+d.gun2+" "+AYLAR[d.m]+" "+kisiAdi(d.yer)+" ("+t(d.gorev2)+"), karşılıklı takas";
  }
  return d.tur==="takas" && d.gun2
    ? d.gun+" "+AYLAR[d.m]+" "+kisiAdi(d.cik)+" ↔ "+d.gun2+" "+AYLAR[d.m]+" "+kisiAdi(d.yer)+(hz ? " (hazırlama, karşılıklı takas)" : " (karşılıklı takas)")
    : d.gun+" "+AYLAR[d.m]+": "+kisiAdi(d.cik)+" yerine "+kisiAdi(d.yer)+(hz ? " (hazırlama)" : "");
}

function degisimKontrol(d){
  const out = {engel:[], uyari:[], bilgi:[]}, y = d.y, m = d.m, ay = AYLAR[m];
  const HZ = d.gorev==="H", KOD = HZ ? "H" : "N", GOREV = HZ ? "hazırlama görevinde" : "nöbetçi";
  const KOD2 = d.gorev2==="H" ? "H" : (d.gorev2==="N" ? "N" : KOD), GOREV2 = KOD2==="H" ? "hazırlama görevinde" : "nöbetçi";
  if (!d.cik || !d.yer) return out;
  if (d.cik===d.yer){ out.engel.push("Görevden çıkan ve yerine tutan aynı kişi."); return out; }
  const G1 = puantajGrid(y,m);
  const rc = G1.satirlar.find(x=>x.s.id===d.cik), ry = G1.satirlar.find(x=>x.s.id===d.yer);
  if (!rc || !ry){ out.engel.push("Kişilerden biri bu ay çalışmıyor."); return out; }
  if (!(d.gun>=1 && d.gun<=G1.gunler.length)){ out.engel.push("Geçersiz tarih."); return out; }
  if (rc.cells[d.gun-1].kod!==KOD) out.engel.push(kisiAdi(d.cik)+", "+d.gun+" "+ay+" günü "+GOREV+" değil.");
  const takas = d.tur==="takas";
  if (takas){
    if (!d.gun2){ out.engel.push("Takas için karşılık günü seçilmedi."); return out; }
    if (d.gun2===d.gun){ out.engel.push("Takasın iki günü aynı olamaz."); return out; }
    if (ry.cells[d.gun2-1].kod!==KOD2) out.engel.push(kisiAdi(d.yer)+", "+d.gun2+" "+ay+" günü "+GOREV2+" değil.");
  }
  // varsayımsal puantaj (asıl veri değişmez)
  const k = y+"-"+m, asil = state.puantaj[k], kopya = JSON.parse(JSON.stringify(asil || {}));
  const uygula = (gun, cik, yer, kod)=>{ (kopya[cik] = kopya[cik] || {})[gun] = cikYeniKod(y,m,gun,cik); (kopya[yer] = kopya[yer] || {})[gun] = kod; };
  uygula(d.gun, d.cik, d.yer, KOD); if (takas) uygula(d.gun2, d.yer, d.cik, KOD2);
  let G2;
  state.puantaj[k] = kopya;
  try { G2 = puantajGrid(y,m); } finally { if (asil===undefined) delete state.puantaj[k]; else state.puantaj[k] = asil; }
  // sonraki ayın 1. günü nöbetçileri (ayın son günü için art arda kontrolü)
  const nmY = m===11 ? y+1 : y, nmM = m===11 ? 0 : m+1, sS = state.schedules[nmY+"-"+nmM];
  const sonrakiIlkN = (sS && sS.days && sS.days[0]) ? sS.days[0].assigned.map(p=>p.id) : [];
  const sonrakiIlkH = (sS && sS.days && sS.days[0]) ? (sS.days[0].prep||[]).map(p=>p.id) : [];
  const ortak = (id, gun, st, r1, n, et)=>{
    const once = r1.cells[gun-1].kod;
    if (once==="YI") out.engel.push(n+" "+et+" yıllık izinde.");
    else if (once==="R") out.engel.push(n+" "+et+" raporlu.");
    else if (once==="DI") out.engel.push(n+" "+et+" izinli (diğer izin).");
    else if (once==="P") out.engel.push(n+" "+et+" tarihinde çalışmıyor (işe başlama / ayrılış dışında).");
    const pr = getPref(id,y,m,gun);
    if (pr==="izinli" && once!=="YI") out.engel.push(n+" "+et+" izinli olarak işaretli.");
    else if (pr!=="izinli" && izinArasiMi(id,y,m,gun)) out.engel.push(n+" "+et+" izin arasında (iki izin günü arasındaki tatil).");
    else if (izinHaftasiKenariMi(id,y,m,gun)) out.engel.push(n+" "+et+" bir haftalık yıllık izninin önündeki / arkasındaki hafta sonu.");
    if (pr==="esYok") out.engel.push(n+" için eş durumu: "+et+" gününe yazılmaması gerekiyor.");
    return once;
  };
  const kisiKontrol = (id, gun)=>{
    const st = state.staff.find(x=>x.id===id), r1 = G1.satirlar.find(x=>x.s.id===id), r2 = G2.satirlar.find(x=>x.s.id===id);
    const n = kisiAdi(id), et = gun+" "+ay, sonGun = gun===G1.gunler.length;
    if (!st || !r1 || !r2) return;
    if (st.role==="destek") out.engel.push(n+" destek personeli; nöbet tutmaz.");
    const once = ortak(id, gun, st, r1, n, et);
    if (once==="N") out.engel.push(n+" "+et+" zaten nöbetçi.");
    const pr = getPref(id,y,m,gun);
    if (pr==="avoid") out.uyari.push(n+" "+et+" nöbet istemiyor olarak işaretli.");
    [-1, 1].forEach(kk=>{ const c = r2.cells[gun-1+kk]; if (c && c.kod==="N") out.engel.push(n+" "+(gun+kk)+". gün de nöbetçi: art arda nöbet olur."); });
    if (gun===1 && pzSonGunKodu(id,y,m)==="N") out.engel.push(n+" önceki ayın son günü nöbetçi: art arda nöbet olur.");
    if (sonGun && sonrakiIlkN.indexOf(id)>=0) out.engel.push(n+" sonraki ayın 1. günü nöbetçi: art arda nöbet olur.");
    if (gun===1 && pzSonGunKodu(id,y,m)==="H") out.engel.push(n+" önceki ayın son günü hazırlama görevinde (nöbetle komşu gün olamaz).");
    if (sonGun && sonrakiIlkH.indexOf(id)>=0) out.engel.push(n+" sonraki ayın 1. günü hazırlama görevinde (nöbetle komşu gün olamaz).");
    if (once==="H") out.engel.push(n+" "+et+" hazırlama görevinde; aynı gün nöbete geçerse hazırlama yeri boş kalır.");
    [-1, 1].forEach(kk=>{ const c = r2.cells[gun-1+kk]; if (c && c.kod==="H") out.engel.push(n+" "+(gun+kk)+". gün hazırlama görevinde (nöbetle komşu gün olamaz)."); });
    { const v = k=>{ const c = r2.cells[gun-1+k]; return !!(c && c.kod==="N"); };
      if ((v(-2) && v(-4)) || (v(-2) && v(2)) || (v(2) && v(4))) out.engel.push(n+" 5 gün içinde 3 nöbet tutmuş olur (ör. Pazartesi–Çarşamba–Cuma)."); }
    const ara = ayar('minAra');
    for (let a2=2; a2<ara; a2++) [-a2, a2].forEach(kk=>{ const c = r2.cells[gun-1+kk]; if (c && c.kod==="N") out.uyari.push(n+" "+(gun+kk)+". gün de nöbetçi (en az "+ara+" gün ara önerilir)."); });
    // Kim ne kadar nöbet verip aldığı serbesttir: hafta sonu / Perşembe sayısı burada uyarılmaz
    // ama Perşembe nöbeti ↔ aynı hafta sonu kuralı kontrol edilir
    const dwG = G1.gunler[gun-1].dw;
    if (dwG===3 && ayar('thuHaftaSonu')) [2,3].forEach(k=>{ const c = r2.cells[gun-1+k]; if (!c) return;
      if (c.kod==="H") out.engel.push(n+" "+(gun+k)+". gün hazırlama görevinde; Perşembe nöbetini alırsa aynı hafta sonu hazırlama olur.");
      else if (c.kod==="N") out.uyari.push(n+" "+(gun+k)+". gün de nöbetçi; Perşembe nöbetini tutan aynı hafta sonu nöbet tutmamalı."); });
    if (dwG===4){ const c = r2.cells[gun+1]; if (c && c.kod==="N") out.uyari.push(n+" "+(gun+2)+". gün (Pazar) de nöbetçi; Cuma ve Pazar aynı kişiye yazılmamalı.");
      else if (c && c.kod==="H") out.uyari.push(n+" "+(gun+2)+". gün (Pazar) hazırlama görevinde; Cuma nöbetçisine aynı hafta Pazar hazırlaması yazılmamalı."); }
    if (dwG===6){ const c = r2.cells[gun-3]; if (c && c.kod==="N") out.uyari.push(n+" aynı haftanın Cuma günü ("+(gun-2)+". gün) nöbetçi; Cuma ve Pazar aynı kişiye yazılmamalı."); }
    if ((dwG===5 || dwG===6) && ayar('thuHaftaSonu')){ const c = r2.cells[gun-1-(dwG===5?2:3)]; if (c && c.kod==="N") out.uyari.push(n+" aynı haftanın Perşembe günü ("+(gun-(dwG===5?2:3))+". gün) nöbetçi."); }
  };
  const kisiKontrolH = (id, gun)=>{
    const st = state.staff.find(x=>x.id===id), r1 = G1.satirlar.find(x=>x.s.id===id), r2 = G2.satirlar.find(x=>x.s.id===id);
    const n = kisiAdi(id), et = gun+" "+ay, sonGun = gun===G1.gunler.length;
    if (!st || !r1 || !r2) return;
    if (!(st.role==="eczaci" || st.role==="teknisyen" || st.role==="destek" || st.role==="nobetci")) out.engel.push(n+" hazırlama görevi almaz (yalnızca eczacı, dışarıdan gelen eczacı, tekniker ve destek personeli).");
    const once = ortak(id, gun, st, r1, n, et);
    if (once==="N") out.engel.push(n+" "+et+" nöbetçi; aynı gün hazırlama yapamaz.");
    else if (once==="H") out.engel.push(n+" "+et+" zaten hazırlama görevinde.");
    if (!G1.gunler[gun-1].tatil) out.uyari.push(et+" tatil günü değil; hazırlama yalnızca hafta sonu ve resmi tatilde yapılır.");
    [-1, 1].forEach(kk=>{ const c = r2.cells[gun-1+kk]; if (c && c.kod==="N") out.engel.push(n+" "+(gun+kk)+". gün nöbetçi (hazırlama, nöbetle komşu gün olamaz)."); });
    if (gun===1 && pzSonGunKodu(id,y,m)==="N") out.engel.push(n+" önceki ayın son günü nöbetçi (hazırlama, nöbetle komşu gün olamaz).");
    if (sonGun && sonrakiIlkN.indexOf(id)>=0) out.engel.push(n+" sonraki ayın 1. günü nöbetçi (hazırlama, nöbetle komşu gün olamaz).");
    [-1, 1].forEach(kk=>{ const c = r2.cells[gun-1+kk]; if (c && c.kod==="H") out.engel.push(n+" "+(gun+kk)+". gün de hazırlama görevinde; art arda iki gün hazırlama yazılmaz."); });
    if (gun===1 && pzSonGunKodu(id,y,m)==="H") out.engel.push(n+" önceki ayın son günü hazırlama görevinde; art arda iki gün hazırlama yazılmaz.");
    if (sonGun && sonrakiIlkH.indexOf(id)>=0) out.engel.push(n+" sonraki ayın 1. günü hazırlama görevinde; art arda iki gün hazırlama yazılmaz.");
    const dwH = G1.gunler[gun-1].dw;
    if (dwH===6){ const c = r2.cells[gun-3]; if (c && c.kod==="N") out.uyari.push(n+" aynı haftanın Cuma günü ("+(gun-2)+". gün) nöbetçi; Pazar hazırlaması yazılmamalı."); }
    if ((dwH===5 || dwH===6) && ayar('thuHaftaSonu')){ const c = r2.cells[gun-1-(dwH===5?2:3)]; if (c && c.kod==="N") out.engel.push(n+" aynı haftanın Perşembe günü ("+(gun-(dwH===5?2:3))+". gün) nöbetçi; hafta sonu hazırlama yazılmaz."); }
  };
  const gunEczaci = gun=>{ const nb = G2.satirlar.filter(r=>r.cells[gun-1].kod==="N"); if (nb.length && !nb.some(r=>eczaciMi(r.s.role))) out.engel.push(gun+" "+ay+" günü nöbette eczacı kalmıyor.");
    if (nb.filter(r=>r.s.role==="nobetci").length > 1) out.engel.push(gun+" "+ay+" günü iki dışarıdan gelen eczacı birlikte nöbetçi olur (aynı güne yalnızca biri nöbet yazılır; hazırlama olabilir)."); };
  if (HZ) kisiKontrolH(d.yer, d.gun); else { kisiKontrol(d.yer, d.gun); gunEczaci(d.gun); }
  if (takas){ if (KOD2==="H") kisiKontrolH(d.cik, d.gun2); else { kisiKontrol(d.cik, d.gun2); gunEczaci(d.gun2); } }
  const karisik = takas && KOD2!==KOD;
  [d.cik, d.yer].forEach(id=>{
    const a1 = G1.satirlar.find(x=>x.s.id===id), b1 = G2.satirlar.find(x=>x.s.id===id);
    if (a1 && b1) out.bilgi.push(kisiAdi(id)+": bu ay "+(karisik ? "nöbet "+a1.n+" → "+b1.n+", hazırlama "+a1.h+" → "+b1.h : (HZ ? "hazırlama "+a1.h+" → "+b1.h : "nöbet "+a1.n+" → "+b1.n))+", fazla mesai "+a1.fm+" → "+b1.fm+" saat.");
  });
  out.engel = out.engel.filter((v,i,arr)=>arr.indexOf(v)===i);
  out.uyari = out.uyari.filter((v,i,arr)=>arr.indexOf(v)===i);
  return out;
}

function yilGorevSayilari(y){
  const t = {};
  for (let mm=0; mm<12; mm++){ const sc = state.schedules[y+"-"+mm]; if (!sc || !Array.isArray(sc.days)) continue;
    const st = ayIstatistik(sc); Object.keys(st).forEach(id=>{ const a = t[id] || (t[id] = {nobet:0, prep:0, fm:0}); a.nobet += st[id].nobet||0; a.prep += st[id].prep||0; a.fm += st[id].fm||0; }); }
  return t;
}

function yerineAdaylar(y,m,gun,cik,gorev){
  const G = puantajGrid(y,m), g = G.gunler[gun-1], H = gorev==="H", Y = yilGorevSayilari(y), out = [];
  G.satirlar.forEach(r=>{
    const id = r.s.id; if (id===cik) return;
    if (H ? !(hazirlamaRol(r.s.role) || r.s.role==="destek") : !nobetciRol(r.s.role)) return;
    const c = r.cells[gun-1]; if (!c || c.kod==="N" || c.kod==="H") return;
    if (["YI","R","DI","NI","P"].indexOf(c.kod)>=0 || (c.kod==="B" && !g.tatil)) return;
    if (kesinYasak(id,y,m,gun)) return;
    const k = degisimKontrol({y, m, gorev: H ? "H" : "N", tur:"devir", gun, cik, yer:id});
    const yt = Y[id] || {nobet:0, prep:0, fm:0};
    out.push({id, ad:r.s.name, rol:r.s.role, engel:k.engel.length, uyari:k.uyari.length, yil: H ? yt.prep : yt.nobet, fm: yt.fm, k});
  });
  out.sort((a,b)=> (a.engel>0)-(b.engel>0) || a.uyari-b.uyari || a.yil-b.yil || a.fm-b.fm || a.ad.localeCompare(b.ad,"tr"));
  return out;
}

// ---- servis hazırlama (eski uygulama index.html servisModul; ekran, yazdırma ve eski veri göçü dışındaki kod aynen) ----
let SERVICES = [], svcByName = new Map(), SV_BUGUN = 0;
function sessizKaydet(){}
function adGocuAy(){}   // eski servis adlarının göçü: yeni sürümde eski veri yok
const GUN_AD = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
function gunlukCizelgeVar(y, m){ const sc = state.schedules[y+"-"+m]; return !!(sc && ayVeriVarMi(sc)); }
  const AD_DEGISIKLIGI = {"2.BAS 10 YATAK YB": "+10 YATAK YB", "2.BAS 8 YATAK YB": "+8 YATAK YB", "2.BAS KORONER YB": "KORONER YB", "3.BAS GENEL YB": "CERRAHİ YB", "NÖR YB": "NÖROLOJİ YB", "BEYİN CER": "BEYİN CERRAHİ", "CERRAHİ-A": "GENEL CERRAHİ-A", "CERRAHİ-B": "GENEL CERRAHİ-B", "ÇOCUK CER": "ÇOCUK CERRAHİ", "ÇOCUK HAST.": "ÇOCUK HASTALIKLARI", "DAHİLİYE H": "DAHİLİYE-H", "FİZİK": "FİZİK TEDAVİ", "GÖĞÜS A": "GÖĞÜS-A", "GÖĞÜS CER": "GÖĞÜS CERRAHİ", "İNTANİYE+GERİATRİ": "İNTANİYE", "KADIN": "KADIN HASTALIKLARI", "KBB+PLASTİK": "KBB/PLASTİK", "KRONİK YARA": "KRONİK YARA BAKIM", "PALYATİF BKM": "PALYATİF BAKIM", "PSK": "PSİKİYATRİ", "RADYASYON": "RADYASYON ONKOLOJİ"};
  // zorluk 10 üzerinden (1 kolay, 10 en zor); Ekim 2026'da yenilenen varsayılanlar
  const SV_VARS = [
  ["2.BAS 10 YATAK YB",6,1,10],["2.BAS 8 YATAK YB",5,1,8],["2.BAS KORONER YB",6,1,10],["GÖĞÜS-2 YB",5,1,10],
  ["3.BAS GENEL YB",5,1,10],["ANJİO YB",5,1,10],["ARS YB",6,1,10],["BEYİN CER",8,3,25],["CERRAHİ-A",8,1,25],
  ["CERRAHİ-B",8,1,25],["ÇOCUK CER",3,3,10],["ÇOCUK HAST.",3,3,10],["ÇYB-2 YB",3,1,5],["ÇYB-3 YB",3,1,5],
  ["DAHİLİYE H",8,3,25],["DAHİLİYE-G",8,3,25],["DOĞUM-G",4,1,15],["DOĞUM-H",4,1,15],["EYB-1 YB",8,1,10],
  ["EYB-2 YB",8,1,10],["EYB-3 YB",7,1,10],["EYB-4 YB",6,1,10],["FİZİK",2,3,10],["GÖĞÜS A",10,3,25],
  ["GÖĞÜS CER",7,3,20],["GÖĞÜS-1 YB",3,1,10],["GÖĞÜS-C",9,3,25],["GÖĞÜS-D",9,3,25],
  ["GÖZ",1,1,2],["İNME YB",2,1,6],["İNTANİYE+GERİATRİ",7,3,20],["KADIN",2,1,10],["KALP DAMAR",6,3,20],
  ["KARDİYOLOJİ-C",7,1,20],["KARDİYOLOJİ-D",7,1,20],["KBB+PLASTİK",5,3,10],["KRONİK YARA",10,3,25],
  ["KVC YB",7,1,10],["MAHKUM",1,1,1],["NEFROLOJİ",10,3,25],["NÖR YB",6,1,10],["NÖROLOJİ-E",7,3,20],
  ["NÖROLOJİ-F",7,3,20],["ORTOPEDİ-E",7,3,20],["ORTOPEDİ-F",7,3,20],["ORTOPEDİ-G",7,3,20],
  ["PALYATİF BKM",10,3,25],["PSK",1,1,3],["RADYASYON",6,3,15],["TBC",2,1,4],["TDL",2,1,5],
  ["ÜROLOJİ",5,3,20],["YANIK",5,3,15],["YANIK YB",2,1,2],["YENİDOĞAN YB",5,1,15]
  ].map(([kod,z,g,h],i)=>({id:i,name:AD_DEGISIKLIGI[kod]||kod,kod,z,g,h,multi:g>1,days:1,grps:[]}));
  // Aynı kişiye aynı anda verilmeyecek servis grupları
  const GROUPS = [
    ["CERRAHİ-A","CERRAHİ-B"],
    ["ORTOPEDİ-E","ORTOPEDİ-F","ORTOPEDİ-G"],
    ["EYB-1 YB","EYB-2 YB","EYB-3 YB","EYB-4 YB"],
    ["NÖROLOJİ-E","NÖROLOJİ-F"],
    ["DAHİLİYE-G","DAHİLİYE H"],
    ["GÖĞÜS A","GÖĞÜS-C","GÖĞÜS-D"],
    ["KARDİYOLOJİ-C","KARDİYOLOJİ-D"],
    ["NEFROLOJİ","PALYATİF BKM","GÖĞÜS A","GÖĞÜS-C"]
  ];
  GROUPS.forEach((names,gi)=>names.forEach(n=>{ const sv=SV_VARS.find(x=>x.kod===n); if(sv) sv.grps.push(gi); }));
  const svKod = sn=>{ const s = SERVICES.find(x=>x.name===sn); return s && s.kod ? s.kod : sn; };
  const isYB = s => /\sYB$/.test(s.name);
  function kayitAy(y, m, olustur){
    if (!state.servisKayit || typeof state.servisKayit!=="object") state.servisKayit = {};
    const k = y+"-"+m;
    if (!state.servisKayit[k]){ if (!olustur) return null; state.servisKayit[k] = {gun:{}, elle:{}, gunElle:{}, sk:{}, ad:{}, ata:{}}; }
    const R = state.servisKayit[k];
    if (!R.__ok){
      ["gun","elle","gunElle","sk","ad"].forEach(a=>{ if (!R[a] || typeof R[a]!=="object" || Array.isArray(R[a])) R[a] = {}; });
      // bozuk ya da eksik gün kayıtları atılır (yedekten yüklenen eski/yanlış veri)
      Object.keys(R.gun).forEach(d=>{ const g = R.gun[d];
        if (!g || !Array.isArray(g.k) || !g.a || typeof g.a!=="object" || !g.t || typeof g.n!=="number") { delete R.gun[d]; return; }
        ["w","l","yb"].forEach(f=>{ if (!g[f] || typeof g[f]!=="object") g[f] = {}; }); });
      adGocuAy(R);
      Object.defineProperty(R, "__ok", {value:true, enumerable:false, configurable:true});
    }
    if (!R.ata || typeof R.ata!=="object" || Array.isArray(R.ata)) R.ata = {};   // elle atamalar: {gün: {servis: kişi}}
    return R;
  }

  // ---- takvim yardımcıları
  const z2 = n => (n<10?"0":"")+n;
  const dowOf = (y,m,d) => (new Date(y,m,d).getDay()+6)%7;
  const gunNo = (y,m,d) => y*10000+(m+1)*100+d;
  function bugunNo(){ return SV_BUGUN; }
  // çok günlük servisin bu sefer kaç gün hazırlanacağı: o gün + ardından gelen tatil günleri
  function otoGun(y,m,d){
    const dt = new Date(y,m,d); let n = 1;
    for (let i=0; i<14; i++){ dt.setDate(dt.getDate()+1); if (isTatilGunu(dt.getFullYear(), dt.getMonth(), dt.getDate())) n++; else break; }
    return n;
  }
  function gunMetni(y,m,d){ return d+" "+AYLAR[m]+" "+y+" "+GUN_AD[dowOf(y,m,d)]; }
  // servis ayarlarının kısa özeti (her gün kaydında tam metin saklanmasın)
  function cfgImza(){
    const t = SERVICES.filter(s=>s.on).map(s=>(s.kod||s.name)+":"+s.z+":"+s.h+":"+(s.multi?1:0)).join("|");
    let h = 2166136261; for (let i=0; i<t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h>>>0).toString(36);
  }

  // o günün teknikerleri (puantajdan); elle kapatılan/açılan kişiler R.elle'den
  const ETIKET = {NI:"nöbet ertesi izni", YI:"yıllık izin", R:"raporlu", DI:"izinli", P:"çalışmıyor", B:"çalışmıyor"};
  function teknikerSatirlari(G){ return G.satirlar.filter(r=>r.s.role==="teknisyen"); }
  function gunKisileri(G, R, d){
    const el = R.elle[d] || {};
    return teknikerSatirlari(G).filter(r=>r.cells[d-1] && r.cells[d-1].kod!=="P").map(r=>{
      const c = r.cells[d-1], kod = c.kod;
      const calisiyor = kod==="M" || kod==="N" || kod==="H" || (kod && kod.indexOf("S:")===0 && c.saat>0);
      const id = r.s.id, oto = !!calisiyor;
      const on = Object.prototype.hasOwnProperty.call(el, id) ? !!el[id] : oto;
      return {id, name:r.s.name, on, oto, elle: on!==oto, etiket: kod==="N" ? "nöbetçi" : (calisiyor ? "" : (ETIKET[kod] || "çalışmıyor"))};
    });
  }

  function rngOf(seed){ let t = (seed>>>0) || 1; return ()=>{ t = (t*1664525 + 1013904223)>>>0; return t/4294967296; }; }
  const W = {S:120, L:220, Y:60, D:6000, R:45, G:100000, Z:400, M:400, MU:30};
  // zor servis: zorluk puanı ZOR_ESIK ve üstü (10 üzerinden). Her gün kişi başı zor servis sayısı en fazla 1 farklı
  // olur (kesin); ay içinde (ve aynı yılın önceki aylarıyla) kişi başı zor servis sayısı eşitlenir.
  const ZOR_ESIK = 7;
  const YAKIN_GUN = 7;
  const zorMu = s => (s && s.z >= ZOR_ESIK) ? 1 : 0;
  // people: [{id}], svcs: servisler, n: çok günlük gün sayısı, cum: önceki günlerden birikim.
  // Amaç: günlük kurallar (kişi başı servis ve YB sayısı en fazla 1 fark, grup kuralı) kesin;
  // aylık servis-gün, yük ve YB payı, günlük yük dengesi ve servis tekrarı en aza indirilir.
  // Tüm maliyetler kişi başına artımlı tutulur; taşı/takas denemeleri sabit sürede hesaplanır.
  // sabit: {servis adı: kişi sırası} elle atanmış servisler; yerleri değişmez
  // onceki: {servis adı: kişi} günün önceki dağıtımı; yeniden hesaplanırken servis o gün hâlâ çalışan
  // önceki kişisinde kalmayı tercih eder (W.M): eşitlik için gerekenden fazlası yer değiştirmez
  function gunDagit(people, svcs, n, cum, seed, sabit, onceki, mW){
    sabit = sabit || {};
    const P = people.length, S = svcs.length;
    let GN = 0;
    const xs = svcs.map((s, ix)=>{ const w = s.multi ? n : 1; s.grps.forEach(g=>{ if (g+1>GN) GN = g+1; }); return {s, ix, w, l:s.h*s.z*w, y:isYB(s) ? 1 : 0, z:zorMu(s), g:s.grps}; });
    let totW = 0, totL = 0, totY = 0, totZ = 0; xs.forEach(x=>{ totW += x.w; totL += x.l; totY += x.y; totZ += x.z; });
    const fW = totW/P, fL = totL/P, fY = totY/P, fZ = totZ/P, Ls = Math.max(1, fL);
    const cLo = Math.floor(S/P), cHi = Math.ceil(S/P), yLo = Math.floor(totY/P), yHi = Math.ceil(totY/P), zLo = Math.floor(totZ/P), zHi = Math.ceil(totZ/P);
    const gsize = new Array(GN).fill(0); xs.forEach(x=>x.g.forEach(g=>{ gsize[g]++; }));
    const cap = gsize.map(v=>Math.ceil(v/P));
    const pen = (g, v)=> v>cap[g] ? W.G*(v-cap[g]) : 0;
    const base = people.map(p=>{ const c = cum[p.id] || {}; return {dW:(c.w||0)-(c.fw||0), dL:(c.l||0)-(c.fl||0), dY:(c.y||0)-(c.fy||0), dZ:(c.zr||0)-(c.fz||0)}; });
    const fOf = (i, w, l, y, z)=>{ const b = base[i];
      const a = b.dW + w - fW, c = (b.dL + l - fL)/Ls, e = b.dY + y - fY, dd = (l - fL)/Ls, zz = b.dZ + z - fZ;
      return W.S*a*a + W.L*c*c + W.Y*e*e + W.D*dd*dd + W.Z*zz*zz; };
    // aynı servis aynı kişiye: çalıştığı günlere göre düşen paydan fazlası cezalandırılır
    const burada = new Set(people.map(p=>p.id));
    const rc = people.map(p=>{ const c = cum[p.id] || {}, rep = c.rep || {}, frep = c.frep || {};
      return xs.map(x=>{ const d = (rep[x.s.name]||0) - (frep[x.s.name]||0) - 1/P, o = onceki ? onceki[x.s.name] : undefined;
        return W.R*(2*d+1) + (o!==undefined && o!==p.id && burada.has(o) ? mW : 0); }); });
    let best = null, bestJ = Infinity;
    for (let deneme=0; deneme<4; deneme++){
      const rnd = rngOf(seed*7919 + deneme*104729 + 17);
      const A = people.map(()=>({items:[], c:0, w:0, l:0, y:0, z:0, gc:new Array(GN).fill(0), gp:0, rp:0}));
      const upd = (i, x, sg)=>{ const a = A[i]; a.c += sg; a.w += sg*x.w; a.l += sg*x.l; a.y += sg*x.y; a.z += sg*x.z; a.rp += sg*rc[i][x.ix];
        for (let q=0; q<x.g.length; q++){ const g = x.g[q], o = a.gc[g]; a.gc[g] = o+sg; a.gp += pen(g, o+sg) - pen(g, o); } };
      // günlük sınırlar (kişi başı servis ve YB sayısı) aşılırsa çok büyük ceza: iyileştirme bunu önce düzeltir
      const sinirC = (c, y, z)=> Math.max(0, c-cHi) + Math.max(0, cLo-c) + Math.max(0, y-yHi) + Math.max(0, yLo-y) + Math.max(0, z-zHi) + Math.max(0, zLo-z);
      const costHizli = i=>{ const a = A[i]; return fOf(i, a.w, a.l, a.y, a.z) + a.gp + a.rp; };
      const costCezali = i=>{ const a = A[i]; return fOf(i, a.w, a.l, a.y, a.z) + a.gp + a.rp + W.G*sinirC(a.c, a.y, a.z); };
      let cost = costCezali;
      let ybKalan = totY, zrKalan = totZ;
      // önce elle atananlar yerine konur
      const sabitX = new Set();
      xs.forEach(x=>{ const i = sabit[x.s.name]; if (i!==undefined && i>=0 && i<P){ A[i].items.push(x); upd(i, x, 1); sabitX.add(x); } });
      sabitX.forEach(x=>{ if (x.y) ybKalan--; if (x.z) zrKalan--; });
      // açgözlü başlangıç: önce zor servisler ve YB'ler, sonra diğerleri; büyük yükten küçüğe (eşitlerde rastgele)
      const sira = xs.filter(x=>!sabitX.has(x)).map(x=>({x, r:rnd()})).sort((p,q)=> (q.x.z-p.x.z) || (q.x.y-p.x.y) || (q.x.l-p.x.l) || (p.r-q.r)).map(o=>o.x);
      const S2 = sira.length;
      for (let ix=0; ix<S2; ix++){
        const x = sira[ix];
        let eksik = 0, ybEksik = 0, zrEksik = 0; for (let i=0;i<P;i++){ eksik += Math.max(0, cLo-A[i].c); ybEksik += Math.max(0, yLo-A[i].y); zrEksik += Math.max(0, zLo-A[i].z); }
        const doldur = (S2-ix) <= eksik, ybDoldur = x.y && ybKalan <= ybEksik, zrDoldur = x.z && zrKalan <= zrEksik;
        if (x.y) ybKalan--;
        if (x.z) zrKalan--;
        let bi = -1, bm = Infinity;
        for (let tur=0; tur<3 && bi<0; tur++){
          for (let i=0;i<P;i++){
            const a = A[i], c = a.items.length;
            if (tur<2 && (c >= cHi || (doldur && c >= cLo))) continue;
            if (tur<1 && x.y && (a.y >= yHi || (ybDoldur && a.y >= yLo))) continue;
            if (tur<2 && x.z && (a.z >= zHi || (zrDoldur && a.z >= zLo))) continue;
            const once = cost(i); upd(i, x, 1); const mm = cost(i) - once + rnd()*1e-6; upd(i, x, -1);
            if (mm < bm){ bm = mm; bi = i; }
          }
        }
        A[bi].items.push(x); upd(bi, x, 1);
      }
      // iyileştirme: taşı ve takas et (kişi başı servis ve YB sayısı sınırları korunur).
      // Başlangıç sınırları sağlıyorsa hızlı yol: sınırı bozacak hamle hiç denenmez.
      let bozuk = 0; for (let i=0;i<P;i++) bozuk += sinirC(A[i].c, A[i].y, A[i].z);
      const hizli = bozuk===0; cost = hizli ? costHizli : costCezali;
      let iyi = true, tur = 0;
      while (iyi && tur++ < 80){
        iyi = false;
        for (let a=0;a<P;a++) for (let b=0;b<P;b++){
          if (a===b) continue;
          const Aa = A[a], Ab = A[b];
          // taşı
          for (let k=Aa.items.length-1; k>=0 && k<Aa.items.length; k--){
            const x = Aa.items[k];
            if (sabitX.has(x)) continue;
            if (hizli){
              if (Aa.c-1 < cLo || Ab.c+1 > cHi) break;
              if (x.y && (Aa.y-1 < yLo || Ab.y+1 > yHi)) continue;
              if (x.z && (Aa.z-1 < zLo || Ab.z+1 > zHi)) continue;
            } else if (sinirC(Aa.c-1, Aa.y-x.y, Aa.z-x.z) + sinirC(Ab.c+1, Ab.y+x.y, Ab.z+x.z) > sinirC(Aa.c, Aa.y, Aa.z) + sinirC(Ab.c, Ab.y, Ab.z)) continue;
            const once = cost(a)+cost(b); upd(a,x,-1); upd(b,x,1);
            if (cost(a)+cost(b) < once - 1e-9){ Aa.items.splice(k,1); Ab.items.push(x); iyi = true; }
            else { upd(b,x,-1); upd(a,x,1); }
          }
          if (b < a) continue;
          // takas
          for (let k=0; k<Aa.items.length; k++){
            for (let j=0; j<Ab.items.length; j++){
              const x = Aa.items[k], t = Ab.items[j];
              if (sabitX.has(x) || sabitX.has(t)) continue;
              if (x.y!==t.y || x.z!==t.z){
                if (hizli){ const ya = Aa.y + t.y - x.y, yb2 = Ab.y + x.y - t.y, za = Aa.z + t.z - x.z, zb = Ab.z + x.z - t.z;
                  if (ya<yLo || ya>yHi || yb2<yLo || yb2>yHi || za<zLo || za>zHi || zb<zLo || zb>zHi) continue; }
                else if (sinirC(Aa.c, Aa.y+t.y-x.y, Aa.z+t.z-x.z) + sinirC(Ab.c, Ab.y+x.y-t.y, Ab.z+x.z-t.z) > sinirC(Aa.c, Aa.y, Aa.z) + sinirC(Ab.c, Ab.y, Ab.z)) continue;
              }
              const once = cost(a)+cost(b);
              upd(a,x,-1); upd(b,t,-1); upd(a,t,1); upd(b,x,1);
              if (cost(a)+cost(b) < once - 1e-9){ Aa.items[k] = t; Ab.items[j] = x; iyi = true; }
              else { upd(a,t,-1); upd(b,x,-1); upd(a,x,1); upd(b,t,1); }
            }
          }
        }
      }
      let J = 0; for (let i=0;i<P;i++) J += costCezali(i);
      if (J < bestJ - 1e-9){ bestJ = J; best = A.map(a=>({items:a.items.map(x=>x.s), w:a.w, l:a.l, y:a.y})); }
    }
    return {kisi: best, totW, totL, totY};
  }

  // birikim (önceki günlerin kaydı)
  function birikimEkle(cum, rec){
    const P = rec.k.length; if (!P) return;
    const t = rec.t || {w:0,l:0,y:0};
    // zor servis sayısı kayıttaki servis adlarından, güncel zorluk puanına göre sayılır
    let zToplam = 0; const zKisi = {};
    Object.keys(rec.a).forEach(sn=>{ if (zorMu(svcByName.get(sn))){ zToplam++; zKisi[rec.a[sn]] = (zKisi[rec.a[sn]]||0) + 1; } });
    rec.k.forEach(id=>{
      const c = cum[id] || (cum[id] = {w:0,l:0,y:0,zr:0,fw:0,fl:0,fy:0,fz:0,rep:{},frep:{},gun:0});
      c.fw += t.w/P; c.fl += t.l/P; c.fy += t.y/P; c.fz += zToplam/P; c.gun++;
      Object.keys(rec.a).forEach(sn=>{ c.frep[sn] = (c.frep[sn]||0) + 1/P; });
      c.w += (rec.w && rec.w[id]) || 0; c.l += (rec.l && rec.l[id]) || 0; c.y += (rec.yb && rec.yb[id]) || 0;
    });
    Object.keys(rec.a).forEach(sn=>{ const id = rec.a[sn]; const c = cum[id]; if (c) c.rep[sn] = (c.rep[sn]||0)+1; });
    Object.keys(zKisi).forEach(id=>{ const c = cum[id]; if (c) c.zr += zKisi[id]; });
  }

  // kayıttaki imzadan kişi/gün kısmı (önceki sürüm imzayı JSON dizisi olarak saklıyordu)
  function ikOf(i){
    i = String(i||"");
    if (i.charAt(0)==="["){ try { const a = JSON.parse(i); return (a[0]||[]).join(",")+"/"+a[1]; } catch(e){ return ""; } }
    return i.split("/").slice(0,2).join("/");
  }
  function kisaImza(t){ let h = 2166136261; for (let i=0; i<t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h>>>0).toString(36); }
  // aynı yılın önceki aylarının servis kayıtlarından birikim (aylar arası denge) ve bunun imzası
  function devirBirikim(y, m){
    const cum = {}; let t = "";
    for (let mm=0; mm<m; mm++){
      if (!cizVar(y, mm)) continue;
      const R = state.servisKayit && state.servisKayit[y+"-"+mm]; if (!R || !R.gun) continue;
      Object.keys(R.gun).map(Number).sort((a,b)=>a-b).forEach(d=>{ const g = R.gun[d];
        if (!g || !Array.isArray(g.k) || !g.a || !g.t) return;
        birikimEkle(cum, g); t += mm+"."+d+":"+g.k.join(",")+"|"+g.n+"|"+JSON.stringify(g.a)+";"; });
    }
    return {cum, imza: t ? kisaImza(t) : "0"};
  }
  // ayın tüm mesai günlerini hesaplar: kayıtlı ve değişmemiş günler korunur; bugün ve sonrasında
  // girdisi değişen ilk günden itibaren yeniden dağıtılır. Geçmiş günler kendiliğinden değişmez.
  // opts.from: bu günden itibaren (geçmiş dahil) zorla yeniden dağıt
  function ayHesapla(y, m, opts){
    opts = opts || {};
    const R = kayitAy(y, m, true), once = JSON.stringify(R);
    let G; try { G = puantajGrid(y, m); } catch(e){ return false; }
    const dim = daysInMonth(y, m), bugun = bugunNo(), cfg = cfgImza();
    const svcs = SERVICES.filter(s=>s.on);
    // aylar arası denge: aynı yılın önceki aylarındaki kayıtlar birikime eklenir (Ocak'ta sıfırdan başlar)
    const dv = devirBirikim(y, m), cum = dv.cum; let degisti = false, ilkDegisen = null;
    teknikerSatirlari(G).forEach(r=>{ R.ad[r.s.id] = r.s.name; });
    for (let d=1; d<=dim; d++){
      if (isTatilGunu(y, m, d)){ if (R.gun[d]){ delete R.gun[d]; degisti = true; } continue; }
      const aktif = gunKisileri(G, R, d).filter(k=>k.on).map(k=>k.id);
      const n = R.gunElle[d] || otoGun(y, m, d), sk = R.sk[d] || 0;
      const ata = R.ata[d] || {}, sabit = {};
      Object.keys(ata).forEach(sn=>{ const ix = aktif.indexOf(ata[sn]); if (ix>=0 && svcs.some(s=>s.name===sn)) sabit[sn] = ix; });
      const ataImza = Object.keys(sabit).map(sn=>[svKod(sn), sn]).sort((a,b)=> a[0]<b[0] ? -1 : a[0]>b[0] ? 1 : 0).map(([kd, sn])=>kd+"="+aktif[sabit[sn]]).join(";");
      const ik = aktif.join(",")+"/"+n, imza = ik+"/"+cfg+"/"+sk+"/"+kisaImza(ataImza)+"/"+dv.imza;
      const eski = R.gun[d], gecmis = gunNo(y,m,d) < bugun, zorla = (opts.from && d >= opts.from && !(opts.gecmisKoru && gecmis)) || opts.zorlaGun===d;
      // elle değiştirilen gün: kayıt olduğu gibi kalır, imzası güncellenir
      if (eski && opts.imzaTazele===d){ eski.i = imza; delete eski.bayat; birikimEkle(cum, eski); continue; }
      if (eski && !zorla && (gecmis || (!degisti && eski.i===imza))){
        // geçmiş gün: yalnızca kişi ya da gün sayısı değiştiyse uyarı (servis ayarı değişikliği geçmişi bozmaz)
        if (ikOf(eski.i)!==ik) eski.bayat = 1; else delete eski.bayat;
        birikimEkle(cum, eski); continue;
      }
      if (!aktif.length || !svcs.length){ if (eski){ delete R.gun[d]; degisti = true; } continue; }
      // "Yeniden karıştır" (sk değişti) o günü baştan dağıtır; diğer yeniden hesaplamalarda önceki liste korunmaya çalışılır
      // değişikliği izleyen YAKIN_GUN gün (yakında yazdırılan / bilinen listeler) sıkı korunur; daha sonraki günler
      // tekrar dengesini toparlamak için daha serbesttir
      const onceki = eski && (eski.sk||0)===sk ? eski.a : null;
      if (ilkDegisen===null) ilkDegisen = d;
      const mW = ilkDegisen!==null && d - ilkDegisen >= YAKIN_GUN ? W.MU : W.M;
      const res = gunDagit(aktif.map(id=>({id})), svcs, n, cum, gunNo(y,m,d)*31 + sk*977, sabit, onceki, mW);
      const rec = {k:aktif, n, i:imza, a:{}, w:{}, l:{}, yb:{}, t:{w:res.totW, l:res.totL, y:res.totY}, z:Date.now()};
      if (sk) rec.sk = sk;
      res.kisi.forEach((p, ix)=>{ const id = aktif[ix]; p.items.forEach(s=>{ rec.a[s.name] = id; }); rec.w[id] = p.w; rec.l[id] = p.l; rec.yb[id] = p.y; });
      if (!eski || JSON.stringify(eski.a)!==JSON.stringify(rec.a) || JSON.stringify(eski.k)!==JSON.stringify(rec.k) || eski.n!==rec.n) degisti = true;
      else rec.z = eski.z;
      R.gun[d] = rec;
      birikimEkle(cum, rec);
    }
    const sonra = JSON.stringify(R);
    if (sonra !== once){ sessizKaydet(); return true; }
    return false;
  }

  function gecmisAy(y, m){ return gunNo(y, m, daysInMonth(y, m)) < bugunNo(); }
  // servis dağıtımı yalnızca nöbet çizelgesi olan aylarda yapılır (çizelge yoksa kayıt yok sayılır)
  function cizVar(y, m){ try { return typeof gunlukCizelgeVar!=="function" || gunlukCizelgeVar(y, m); } catch(e){ return true; } }
  function otoHesaplanir(y, m){ return cizVar(y, m) && (!!kayitAy(y, m, false) || !gecmisAy(y, m)); }
  function ayVerisi(y, m){
    const R = kayitAy(y, m, false) || {gun:{}, elle:{}, gunElle:{}, sk:{}, ad:{}};
    const G = puantajGrid(y, m);
    const satir = teknikerSatirlari(G);
    const ad = id => { const r = satir.find(x=>x.s.id===id); return r ? r.s.name : (R.ad[id] || "(silinmiş)"); };
    return {R, G, satir, ad};
  }
  function gunSonucu(V, d){
    const rec = V.R.gun[d]; if (!rec) return null;
    const kisi = rec.k.map(id=>({id, name:V.ad(id), items:[], total:0, w:rec.w[id]||0, yb:rec.yb[id]||0, zr:0}));
    const svcs = [];
    Object.keys(rec.a).forEach(sn=>{
      const p = kisi.find(k=>k.id===rec.a[sn]); if (!p) return;
      const s = svcByName.get(sn) || {name:sn, h:0, z:0, multi:false};
      const l = s.h*s.z*(s.multi ? rec.n : 1);
      const it = {name:sn, multi:!!s.multi, l, zor:!!zorMu(s)};
      p.items.push(it); p.total += l; svcs.push(it); if (it.zor) p.zr++;
    });
    const ybSv = sn=> /\sYB$/.test(sn) ? 1 : 0;
    kisi.forEach(p=>p.items.sort((a,b)=> (ybSv(b.name)-ybSv(a.name)) || a.name.localeCompare(b.name, "tr")));
    kisi.sort((a,b)=>a.name.localeCompare(b.name, "tr"));
    return {rec, kisi, svcs};
  }
  const AY3 = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  function yillikVeri(yil){
    const aylar = [], kisi = {}, adlar = {};
    (state.staff||[]).forEach(st=>{ adlar[st.id] = st.name; });
    for (let mm=0; mm<12; mm++){
      const R = cizVar(yil, mm) && state.servisKayit && state.servisKayit[yil+"-"+mm];
      const recs = R && R.gun ? Object.keys(R.gun).map(Number).sort((a,b)=>a-b).map(d=>R.gun[d]).filter(g=>g && Array.isArray(g.k) && g.k.length && g.a && g.t) : [];
      if (R && R.ad) Object.keys(R.ad).forEach(id=>{ if (!adlar[id]) adlar[id] = R.ad[id]; });
      aylar.push(recs);
      recs.forEach(g=>{ const P = g.k.length;
        g.k.forEach(id=>{ const k = kisi[id] || (kisi[id] = {id, ay:AY3.map(()=>null), gun:0, w:0, l:0, fw:0, fl:0, y:0, adet:0});
          const a = k.ay[mm] || (k.ay[mm] = {gun:0, w:0, l:0});
          a.gun++; a.w += g.w[id]||0; a.l += g.l[id]||0; k.gun++; k.w += g.w[id]||0; k.l += g.l[id]||0; k.y += g.yb[id]||0; k.fw += g.t.w/P; k.fl += (g.t.l||0)/P; });
        Object.keys(g.a).forEach(sn=>{ const k = kisi[g.a[sn]]; if (k) k.adet++; }); });
    }
    const ad = id=> adlar[id] || "(silinmiş)";
    const ids = Object.keys(kisi).map(Number).sort((a,b)=>ad(a).localeCompare(ad(b), "tr"));
    return {yil, aylar, kisi, ids, ad, kayitli: aylar.filter(r=>r.length).length};
  }
  // aylar: kişinin o ayki toplam hazırlama yükü (hasta × zorluk, çok günlük servis gün sayısıyla);
  // Gün: servis hazırladığı gün; Yük: yıllık toplam; Ort. yük: çalıştığı gün başına ortalama yük;
  // Ekip ort.: kişinin çalıştığı günlerde ekipte kişi başına düşen ortalama yük (adil pay ölçüsü).
  // Ort. yük, ekip ortalamasından %5'ten fazla saparsa turuncu (fazla) / mavi (az) işaretlenir.
  const yukSapma = k=>{ if (!k.gun || !k.fl) return 0; const o = k.l/k.gun, e = k.fl/k.gun; return (o - e) / e; };
  const ybMi = sn=> /\sYB$/.test(sn);
  function svcYuk(sn, n){ const s = svcByName.get(sn); return s ? s.h*s.z*(s.multi ? n : 1) : 0; }
  function kisiServisleri(rec, id){ return Object.keys(rec.a).filter(sn=>rec.a[sn]===id); }
  function gunSinirlari(rec){
    const P = rec.k.length, adlar = Object.keys(rec.a), S = adlar.length, Y = adlar.filter(ybMi).length, gs = {};
    adlar.forEach(sn=>{ const s = svcByName.get(sn); (s ? s.grps : []).forEach(g=>{ gs[g] = (gs[g]||0) + 1; }); });
    return {cLo:Math.floor(S/P), cHi:Math.ceil(S/P), yLo:Math.floor(Y/P), yHi:Math.ceil(Y/P), cap:g=>Math.ceil((gs[g]||0)/P)};
  }
  // id kişisi sn servisini alırsa (cikan servis kişiden ayrılırken) aynı grupta sınırı aşan servisler
  function grupCakisma(rec, K, id, sn, cikan){
    const s = svcByName.get(sn); if (!s) return [];
    const L = kisiServisleri(rec, id).filter(x=>x!==cikan && x!==sn), out = [];
    s.grps.forEach(g=>{ const ayni = L.filter(x=>{ const t = svcByName.get(x); return t && t.grps.indexOf(g)>=0; }); if (ayni.length+1 > K.cap(g)) ayni.forEach(x=>{ if (out.indexOf(x)<0) out.push(x); }); });
    return out;
  }
  // sn servisi hedef kişiye verilirse: sayı/YB dengesi bozulacaksa hedefin aynı türden, yükü en yakın servisi karşılık olarak geri verilir
  function degisimPlani(rec, R, d, sn, hedef){
    const K = gunSinirlari(rec), kaynak = rec.a[sn], ata = R.ata[d] || {};
    const ks = kisiServisleri(rec, kaynak).filter(x=>x!==sn), hs = kisiServisleri(rec, hedef).concat([sn]);
    const tamam = L=>{ const yb = L.filter(ybMi).length; return L.length>=K.cLo && L.length<=K.cHi && yb>=K.yLo && yb<=K.yHi; };
    let karsilik = null;
    if (!tamam(ks) || !tamam(hs)){
      const l0 = svcYuk(sn, rec.n);
      karsilik = kisiServisleri(rec, hedef).filter(t=> ybMi(t)===ybMi(sn) && ata[t]!==hedef && !grupCakisma(rec, K, kaynak, t, sn).length)
        .sort((a,b)=> Math.abs(svcYuk(a, rec.n)-l0) - Math.abs(svcYuk(b, rec.n)-l0))[0] || null;
    }
    const uyari = [], cak = grupCakisma(rec, K, hedef, sn, karsilik);
    if (cak.length) uyari.push("Grup kuralı: aynı gün "+cak.join(", ")+" de bu kişide.");
    if (!karsilik && (!tamam(ks) || !tamam(hs))) uyari.push("Karşılık verilecek uygun servis yok; o gün kişi başı servis ya da YB sayısı 1'den fazla farklı olur.");
    return {kaynak, hedef, karsilik, uyari};
  }
  function kayitTopla(rec){
    rec.w = {}; rec.l = {}; rec.yb = {};
    rec.k.forEach(id=>{ rec.w[id] = 0; rec.l[id] = 0; rec.yb[id] = 0; });
    Object.keys(rec.a).forEach(sn=>{ const id = rec.a[sn], s = svcByName.get(sn), w = s && s.multi ? rec.n : 1;
      if (rec.w[id]===undefined) return; rec.w[id] += w; rec.l[id] += s ? s.h*s.z*w : 0; if (ybMi(sn)) rec.yb[id]++; });
  }
// servis listesi: varsayılanlar + elle eklenenler, kayıtlı ayarlarla (zorluk, hasta, çok günlük, hazırlanıyor mu)
function servisleriKur(A){
  A = (A && typeof A==="object") ? A : {};
  const svc = (A.svc && typeof A.svc==="object") ? A.svc : {};
  SERVICES = SV_VARS.map(s=>Object.assign({}, s, {grps:s.grps.slice(), z0:s.z, h0:s.h, multi0:s.multi}));
  (Array.isArray(A.ekstra) ? A.ekstra : []).forEach(e=>{ if (!e || !e.name || SERVICES.some(x=>x.name===e.name)) return;
    SERVICES.push({name:String(e.name), z0:Number(e.z)||1, h0:Number(e.h)||0, multi0:!!e.multi, z:1, h:0, multi:false, grps:[], ekstra:true}); });
  SERVICES.forEach((x,i)=>{ x.id = i; });
  SERVICES.forEach(s=>{
    const k = svc[s.name] || {};
    s.z = (Number.isFinite(k.z) && k.z>=1) ? Math.min(10, k.z) : s.z0;
    s.h = (Number.isFinite(k.h) && k.h>=0) ? k.h : s.h0;
    s.multi = (typeof k.multi==="boolean") ? k.multi : s.multi0;
    s.on = (typeof k.on==="boolean") ? k.on : true;
  });
  svcByName = new Map(SERVICES.map(s=>[s.name, s]));
}

function veriyiHazirla(veri, y, m){
  const v = kopya(veri || {});
  const nesne = x => (x && typeof x==="object" && !Array.isArray(x)) ? x : {};
  return {
    staff: Array.isArray(v.staff) ? v.staff : [],
    prefs: nesne(v.prefs), manualTatil: nesne(v.manualTatil), arife: nesne(v.arife),
    settings: nesne(v.settings), schedules: nesne(v.schedules), puantaj: nesne(v.puantaj), acil: nesne(v.acil),
    servisKayit: nesne(v.servisKayit),
    year: y, month: m,
  };
}

/**
 * Bir ayın çizelgesini oluşturur.
 * @param {object} veri  {staff, prefs, manualTatil, arife, settings, schedules, puantaj}
 * @param {number} yil
 * @param {number} ay    0 = Ocak
 * @param {{varyasyon?: number, saat?: () => number}} secenek  saat: süre sınırı için (testlerde sabit verilir)
 */
export function cizelgeOlustur(veri, yil, ay, secenek = {}){
  state = veriyiHazirla(veri, yil, ay);
  simdi = secenek.saat || Date.now;
  try { return generateSchedule(yil, ay, secenek.varyasyon || 0); }
  finally { state = null; simdi = Date.now; }
}

/**
 * Elle düzenlenen bir günün kurallarını denetler (gün düzenleme penceresi).
 * @param {object} veri  cizelgeOlustur ile aynı
 * @param {{year:number, month:number, days:any[]}} sch  ayın çizelgesi (düzenlenen gün dahil, eski hâliyle)
 * @param {number} gun   1'den başlar
 * @param {any[]} nobetciler  [{id, name, role}]
 * @param {any[]} hazirlama   [{id, name, role}]
 * @returns {{sev:"hata"|"uyari"|"bilgi", t:string}[]}
 */
export function gunuDenetle(veri, sch, gun, nobetciler, hazirlama){
  state = veriyiHazirla(veri, sch.year, sch.month);
  try {
    const s2 = kopya(sch); fmYenile(s2);
    return gunKontrol(s2, s2.days[gun-1], nobetciler, hazirlama, {fm: true});
  } finally { state = null; }
}

/**
 * Ayın puantaj cetveli: kişi başı gün gün kod (M, N, H, NI, YI, R, DI, B, P) ve saat, toplamlar, fazla mesai
 * ve 08:00-20:00 / 20:00-08:00 dilimleri. Çizelge + puantajdaki elle değişiklikler (veri.puantaj) birlikte okunur.
 */
export function puantajHesapla(veri, yil, ay){
  state = veriyiHazirla(veri, yil, ay);
  try { return puantajGrid(yil, ay); } finally { state = null; }
}
export const PUANTAJ_KODLARI = PZ_KODLAR;

/** Değişim yapılırsa ne olur: d = {y, m, gorev:"N"|"H", tur:"devir"|"takas", gun, cik, yer, gun2?, gorev2?} → {engel, uyari, bilgi} */
export function degisimDenetle(veri, d){
  state = veriyiHazirla(veri, d.y, d.m);
  try { return degisimKontrol(d); } finally { state = null; }
}
/** Görevden düşen kişinin (cik) yerine geçebilecekler: kurallara uyanlar önce, sonra yıl içinde en az görev alan */
export function yerineAdaylarHesapla(veri, y, m, gun, cik, gorev){
  state = veriyiHazirla(veri, y, m);
  try { return yerineAdaylar(y, m, gun, cik, gorev); } finally { state = null; }
}

// ---- servis hazırlama: dışa açılan işlemler. Her çağrı verinin kopyasıyla çalışır; değişen ay kaydı (servisKayit["yıl-ay"])
// sonuç olarak döner, ekran onu kaydeder. bugun: YYYYAAGG sayısı (gün öncesi kayıtlar geçmiş sayılır, kendiliğinden değişmez).
function servisBaglam(veri, y, m, bugun){
  state = veriyiHazirla(veri, y, m);
  servisleriKur((veri || {}).servisAyar);
  SV_BUGUN = bugun || bugunSayisi();
}
function bugunSayisi(){ const n = new Date(); return gunNo(n.getFullYear(), n.getMonth(), n.getDate()); }
const kayitKopyasi = (y, m) => { const R = state.servisKayit[y+"-"+m]; return R ? JSON.parse(JSON.stringify(R)) : null; };

/** Servisler ekranı için servis listesi: kayıtlı ayarlar uygulanmış (z, h, multi, on); varsayılanlar z0, h0, multi0 alanlarında */
export function servisListesi(veri){
  servisleriKur((veri || {}).servisAyar);
  return SERVICES.map(s=>({id:s.id, name:s.name, z:s.z, h:s.h, multi:s.multi, on:s.on, z0:s.z0, h0:s.h0, multi0:s.multi0, ekstra:!!s.ekstra, yb:isYB(s), zor:!!zorMu(s), grup:s.grps.length>0}));
}
export const SERVIS_ZOR_ESIK = ZOR_ESIK;

/**
 * Ayın dağıtımını günceller (girdisi değişen bugünkü ve sonraki günler yeniden dağıtılır, geçmiş korunur).
 * Dönüş: {cizelgeVar, kayit (ayın kaydı ya da null), degisti, sil (çizelgesi silinen ayın kaydı silinmeli)}
 */
export function servisAyHesapla(veri, y, m, opts, bugun){
  servisBaglam(veri, y, m, bugun);
  try {
    opts = opts || {};
    if (!cizVar(y, m)) return {cizelgeVar:false, kayit:null, degisti:false, sil: !!state.servisKayit[y+"-"+m] && !gecmisAy(y, m)};
    if (!opts.zorla && !otoHesaplanir(y, m)) return {cizelgeVar:true, kayit:kayitKopyasi(y, m), degisti:false};
    const degisti = ayHesapla(y, m, opts);
    return {cizelgeVar:true, kayit:kayitKopyasi(y, m), degisti};
  } finally { state = null; }
}

/** Bir günün ekranı: kişiler (puantajdan, elle açılıp kapatılanlarla), dağıtım, çok günlük servis gün sayısı */
export function servisGunu(veri, y, m, d, bugun){
  servisBaglam(veri, y, m, bugun);
  try {
    const V = ayVerisi(y, m), oto = otoGun(y, m, d);
    const S = gunSonucu(V, d);
    return {
      tatil: isTatilGunu(y, m, d), gecmis: gunNo(y, m, d) < SV_BUGUN, teknikerVar: V.satir.length > 0,
      kisiler: isTatilGunu(y, m, d) ? [] : gunKisileri(V.G, V.R, d), oto, n: V.R.gunElle[d] || oto,
      ata: (V.R.ata && V.R.ata[d]) || {}, bayat: !!(S && S.rec.bayat),
      sonuc: S ? {kisi: S.kisi, svcs: S.svcs, n: S.rec.n} : null,
    };
  } finally { state = null; }
}

/**
 * Ay kaydında bir işlem yapar ve dağıtımı buna göre yeniler (eski uygulamadaki düğmeler):
 * {tur:"kisi", gun, id} kişiyi o gün dağıtıma kat/çıkar · {tur:"karistir", gun} günü yeniden karıştır ·
 * {tur:"ngun", gun, n} çok günlük servis gün sayısı · {tur:"yeniden", gun} bu günden itibaren yeniden dağıt ·
 * {tur:"ata", gun, sn, hedef, karsilik} servisi elle başka teknikere ver · {tur:"oto", gun, sn} elle atamayı kaldır ·
 * {tur:"ataSifirla", gun} günün tüm elle atamalarını kaldır · {tur:"olustur"} geçmiş ay için dağıtım oluştur
 */
export function servisIslem(veri, y, m, islem, bugun){
  servisBaglam(veri, y, m, bugun);
  try {
    const R = kayitAy(y, m, true), d = islem.gun;
    let opts = {};
    if (islem.tur==="kisi"){
      const V = ayVerisi(y, m), k = gunKisileri(V.G, R, d).find(x=>x.id===islem.id); if (!k) return kayitKopyasi(y, m);
      const el = R.elle[d] || (R.elle[d] = {});
      if (!k.on===k.oto) delete el[k.id]; else el[k.id] = !k.on;
      if (!Object.keys(el).length) delete R.elle[d];
      opts = {from: d};
    } else if (islem.tur==="karistir"){ R.sk[d] = (R.sk[d]||0)+1; opts = {from: d}; }
    else if (islem.tur==="ngun"){ if (islem.n===otoGun(y,m,d)) delete R.gunElle[d]; else R.gunElle[d] = islem.n; opts = {from: d}; }
    else if (islem.tur==="yeniden"){ opts = {from: d}; }
    else if (islem.tur==="ataSifirla"){ delete R.ata[d]; opts = {zorlaGun: d, from: d+1, gecmisKoru: true}; }
    else if (islem.tur==="oto"){ const ata = R.ata[d] || {}; delete ata[islem.sn]; if (!Object.keys(ata).length) delete R.ata[d]; opts = {zorlaGun: d, from: d+1, gecmisKoru: true}; }
    else if (islem.tur==="ata"){
      const rec = R.gun[d]; if (!rec || rec.a[islem.sn]===undefined) return kayitKopyasi(y, m);
      const kaynak = rec.a[islem.sn], A = R.ata[d] || (R.ata[d] = {});
      rec.a[islem.sn] = islem.hedef; A[islem.sn] = islem.hedef;
      if (islem.karsilik){ rec.a[islem.karsilik] = kaynak; A[islem.karsilik] = kaynak; }
      kayitTopla(rec); rec.z = Date.now();
      opts = {imzaTazele: d, from: d+1, gecmisKoru: true};
    } else if (islem.tur==="olustur"){ opts = {zorla: true}; }
    if (cizVar(y, m)) ayHesapla(y, m, opts);
    return kayitKopyasi(y, m);
  } finally { state = null; }
}

/** Bir servisi başka teknikere verme seçenekleri: gerekirse karşılığında geri verilecek servis ve uyarılar */
export function servisAtamaAdaylari(veri, y, m, d, sn, bugun){
  servisBaglam(veri, y, m, bugun);
  try {
    const R = kayitAy(y, m, false), rec = R && R.gun[d];
    if (!rec || rec.a[sn]===undefined) return null;
    const V = ayVerisi(y, m), kaynak = rec.a[sn], ata = R.ata[d] || {};
    const adaylar = rec.k.filter(id=>id!==kaynak).map(id=>{ const pl = degisimPlani(rec, R, d, sn, id), L = kisiServisleri(rec, id);
        return {id, ad:V.ad(id), karsilik:pl.karsilik, uyari:pl.uyari, servis:L.length, yb:L.filter(ybMi).length, yuk:L.reduce((t,x)=>t+svcYuk(x, rec.n), 0)}; })
      .sort((a,b)=> (a.uyari.length-b.uyari.length) || a.ad.localeCompare(b.ad, "tr"));
    return {kaynak, kaynakAd:V.ad(kaynak), elle: ata[sn]===kaynak, elleVar: ata[sn]!==undefined, adaylar};
  } finally { state = null; }
}

/**
 * Yılın servis raporu. Önce çizelgesi olan ayların dağıtımı güncellenir (eski uygulamadaki yilGuncelle);
 * dönüşte güncellenen kayıtlar (kayitlar) ve rapor verisi: kişi başı aylık yük, servis × kişi dağılımı.
 */
export function servisYillik(veri, yil, bugun){
  servisBaglam(veri, yil, 0, bugun);
  try {
    const kayitlar = {};
    for (let mm=0; mm<12; mm++){
      const k = yil+"-"+mm;
      if (!cizVar(yil, mm)){ if (state.servisKayit[k] && !gecmisAy(yil, mm)){ delete state.servisKayit[k]; kayitlar[k] = null; } continue; }
      if (!otoHesaplanir(yil, mm)) continue;
      if (ayHesapla(yil, mm, {})) kayitlar[k] = kayitKopyasi(yil, mm);
    }
    const Y = yillikVeri(yil), adlar = {};
    Y.ids.forEach(id=>{ adlar[id] = Y.ad(id); });
    // servis × kişi: kaç kez ve çalıştığı günlere göre payı (eski matrisRecs)
    const recs = [].concat.apply([], Y.aylar), say = {}, pay = {}, gun = {};
    for (const rec of recs){
      const P = rec.k.length;
      rec.k.forEach(id=>{ gun[id] = (gun[id]||0) + 1; });
      Object.keys(rec.a).forEach(sn=>{ const id = rec.a[sn]; (say[sn] = say[sn] || {})[id] = (say[sn][id]||0) + 1;
        const ps = pay[sn] || (pay[sn] = {}); rec.k.forEach(k=>{ ps[k] = (ps[k]||0) + 1/P; }); });
    }
    const grupOf = sn=>{ if (/\sYB$/.test(sn)) return "yb"; const s = svcByName.get(sn); return s && s.multi ? "cok" : "tek"; };
    const servisler = Object.keys(say).sort((a,b)=>a.localeCompare(b, "tr")).map(sn=>({sn, grup:grupOf(sn), say:say[sn], pay:pay[sn]||{}}));
    const kisi = Y.ids.map(id=>{ const k = Y.kisi[id]; return {id, ad:adlar[id], ay:k.ay, gun:k.gun, l:k.l, fl:k.fl, w:k.w, y:k.y, adet:k.adet, sapma:yukSapma(k)}; });
    return {kayitlar, kayitli:Y.kayitli, bosAy:Y.aylar.map(r=>!r.length), kisi, matris:{servisler, gun}};
  } finally { state = null; }
}

/**
 * Acil servis nöbeti denetimi (eski acilKontrol): aynı kişi iki kez, izin/eş durumu, art arda iki gün,
 * aynı gün eczane nöbeti. {sev:"hata"|"uyari", t} listesi döner.
 */
export function acilDenetle(veri, y, m, g, ids){
  state = veriyiHazirla(veri, y, m);
  try {
    const ay = state.acil[y+"-"+m] || {}, out = [];
    if (ids.length===2 && ids[0]===ids[1]) out.push({sev:"hata", t:"Aynı kişi iki kez seçilemez."});
    const sch = state.schedules[y+"-"+m];
    [...new Set(ids)].forEach(id=>{
      const s = state.staff.find(x=>x.id===id); if (!s) return;
      if (kesinYasak(id,y,m,g)) out.push({sev:"uyari", t:s.name+" bu gün izinli, eş durumu nedeniyle yazılmamalı ya da çalışma dönemi dışında."});
      [-1,1].forEach(k=>{ if ((ay[g+k]||[]).indexOf(id)>=0) out.push({sev:"uyari", t:s.name+", "+(g+k)+". gün de acil serviste nöbetçi (nöbet ertesi gün izin gerekir)."}); });
      if (sch && sch.days[g-1] && sch.days[g-1].assigned.some(p=>p.id===id)) out.push({sev:"uyari", t:s.name+" aynı gün eczane nöbetçisi."});
    });
    return out;
  } finally { state = null; }
}

/**
 * Günlük çalışma listesi: puantaja göre her gün kim onayda, kim hazırlamada, kim yok (izin/rapor).
 * Hafta sonu ve tatilde onaycılar eczane nöbetçileri, hazırlamacılar o günün hazırlamacılarıdır.
 */
export function calismaListesiHesapla(veri, y, m){
  state = veriyiHazirla(veri, y, m);
  try {
    const G = puantajGrid(y, m);
    return G.gunler.map(g=>({gun:g.gun, dw:g.dw, ...gunlukListe(G, g.gun)}));
  } finally { state = null; }
}

/**
 * Yılın raporu: ay ay kişi başı puantaj özeti (fazla mesai, nöbet, gün türleri, hazırlama, izin, rapor) ve
 * yıllık denge (çizelgeye göre; kişinin çalıştığı ay sayısına göre beklenen paydan fark).
 */
export function yillikRaporHesapla(veri, yil){
  state = veriyiHazirla(veri, yil, 0);
  try {
    const V = yilVerisi(yil);
    const D = V.kayitli ? dengeVerisi(V) : null;
    const toplam = {}; V.kisiler.forEach(k => { toplam[k.id] = kisiYillik(V, k.id); });
    return { V, D: D && { kisiler: D.kisiler, ort: D.ort, tamAy: D.tamAy, aralik: D.aralik, hedef: D.hedef }, toplam, kolonlar: DENGE_KOL, ayKisa: AY_KISA };
  } finally { state = null; }
}

export function uyariSiniflandir(metin){ return uyariSinif(metin); }
export { AGIRLIK, FM_MAX_FARK, AYAR_VARSAYILAN };
