// Uygulamayı (index.html) başsız tarayıcıda açar, bir senaryonun aylarını sırayla oluşturur
// ve her ay için uyarıları, kişi başı sayıları ve gün gün atamaları döndürür.
// Oluşturma sessizce başarısız olursa (sayfa hatası, boş çizelge, okunamayan uyarı) hata fırlatır:
// "uyarı yok" hiçbir zaman "her şey yolunda" sanılmasın.
const crypto = require("crypto");
const path = require("path");

const LS_KEY = "eczane-nobet-v1";
const HTML = process.env.CIZELGE_HTML || path.resolve(__dirname, "..", "index.html");   // başka bir sürümü denemek için
const GUNDE_NOBETCI = 2;

async function ayOlustur(page){
  await page.evaluate(()=>document.getElementById("generate-btn").click());
  // izin / uygunluk ön kontrolü pencere açarsa "Yine de oluştur"
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ const b = document.getElementById("uyg-devam"); if (b) b.click(); });
  await page.waitForFunction(()=>!document.body.classList.contains("uretiliyor") && !document.getElementById("generate-btn").disabled, null, {timeout:300000});
}

function ozet(sch, staff){
  const ad = {}, kisi = {};
  staff.forEach(s=>{ ad[s.id] = s.name; kisi[s.name] = {nobet:0, hazirlama:0}; });
  sch.days.forEach(d=>{
    d.assigned.forEach(p=>{ if (kisi[ad[p.id]]) kisi[ad[p.id]].nobet++; });
    (d.prep||[]).forEach(p=>{ if (kisi[ad[p.id]]) kisi[ad[p.id]].hazirlama++; });
  });
  const imza = sch.days.map(d=>d.day+":"+d.assigned.map(p=>p.id).join(",")+"/"+(d.prep||[]).map(p=>p.id).join(",")).join(";");
  const gunler = sch.days.map(d=>({gun: d.day, nobet: d.assigned.map(p=>ad[p.id]), hazirlama: (d.prep||[]).map(p=>ad[p.id])}));
  return {kisi, gunler, imza: crypto.createHash("sha1").update(imza).digest("hex").slice(0, 12)};
}

function fark(kisi, alan, adlar){
  const v = adlar.map(a=>kisi[a][alan]); return v.length ? Math.max(...v) - Math.min(...v) : 0;
}

// uygulamadaki fmKuralKisileri ile aynı: ayın ilk ve son günü çalışan personel
function tamAyKisileri(staff, y, m){
  const z = n=>String(n).padStart(2, "0"), son = new Date(y, m+1, 0).getDate();
  const ilk = y+"-"+z(m+1)+"-01", sonGun = y+"-"+z(m+1)+"-"+z(son);
  return staff.filter(s=>!(s.baslangic && s.baslangic > ilk) && !(s.bitis && s.bitis < sonGun)).map(s=>s.name);
}

async function senaryoCalistir(browser, sen){
  const page = await browser.newPage();
  const sayfaHatalari = [];
  page.on("pageerror", e=>sayfaHatalari.push(e.message));
  page.on("dialog", d=>{ sayfaHatalari.push("beklenmeyen pencere: " + d.message()); d.accept(); });
  // Arama süreyle de sınırlı (birkaç saniye); hızlı ve yavaş makinede farklı sonuç çıkmasın diye saat
  // durdurulur, arama yalnız deneme sayısı sınırıyla biter. Böylece sonuç her makinede aynıdır.
  await page.addInitScript(()=>{ const t = Date.now(); Date.now = ()=>t; });
  const hataVarsa = ay=>{ if (sayfaHatalari.length) throw new Error(sen.ad + ", " + ay + ": sayfada hata: " + sayfaHatalari.join(" | ")); };
  try {
    await page.goto("file://" + HTML);
    let S = {staff: sen.staff, prefs: sen.prefs || {}, year: sen.yil, settings: sen.settings || {}};
    const sonuc = [];
    for (const m of sen.aylar){
      const ay = (m+1) + ". ay";
      S.month = m; delete S.schedule;
      await page.evaluate(([k, v])=>localStorage.setItem(k, v), [LS_KEY, JSON.stringify(S)]);
      await page.reload();
      await ayOlustur(page);
      hataVarsa(ay);
      const uyarilar = await page.evaluate(()=>[...document.querySelectorAll("#warnings .warning-box")].map(el=>({
        seviye: (el.className.match(/\buy-(hata|uyari|bilgi)\b/)||[])[1] || null,
        baslik: (el.querySelector("summary b")||{}).textContent,
        metin: (el.querySelector(".uy-detay")||{}).textContent,
      })));
      uyarilar.forEach(u=>{ if (!u.seviye || !u.baslik || !u.metin) throw new Error(sen.ad + ", " + ay + ": uyarı okunamadı (sayfa yapısı değişmiş olabilir): " + JSON.stringify(u)); u.baslik = u.baslik.trim(); u.metin = u.metin.trim(); });
      S = JSON.parse(await page.evaluate(k=>localStorage.getItem(k), LS_KEY));
      const sch = S.schedules[sen.yil + "-" + m];
      // sayfa açılınca boş bir taslak kaydedilir: "çizelge var" yetmez, her günün nöbetçileri yazılmış olmalı
      const eksik = sch ? sch.days.filter(d=>d.assigned.length < GUNDE_NOBETCI).map(d=>d.day) : null;
      if (!sch || !sch.days.length || eksik.length) throw new Error(sen.ad + ", " + ay + ": çizelge oluşmadı" + (eksik && eksik.length ? " (nöbetçisi eksik günler: " + eksik.join(", ") + ")" : ""));
      const o = ozet(sch, sen.staff);
      const tamAy = tamAyKisileri(sen.staff, sen.yil, m);
      const fm = uyarilar.map(u=>u.metin.match(/fazla mesai farkı (\d+(?:[.,]\d+)?) saat/)).find(Boolean);
      if (!fm && uyarilar.some(u=>u.baslik==="Fazla mesai farkı")) throw new Error(sen.ad + ", " + ay + ": fazla mesai uyarısındaki saat okunamadı (metin değişmiş olabilir)");
      sonuc.push({
        ay: m,
        uyarilar,
        nobetFarki: fark(o.kisi, "nobet", tamAy),
        hazirlamaFarki: fark(o.kisi, "hazirlama", tamAy),
        fazlaMesaiFarki: fm ? Number(fm[1].replace(",", ".")) : null,   // yalnız kesin kural uyarısı varsa
        kisi: o.kisi,
        gunler: o.gunler,
        imza: o.imza,
      });
    }
    return sonuc;
  } finally {
    await page.close();
  }
}

module.exports = {senaryoCalistir};
