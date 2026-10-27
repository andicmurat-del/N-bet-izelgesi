// Uygulamayı (index.html) başsız tarayıcıda açar, bir senaryonun aylarını sırayla oluşturur
// ve her ay için uyarıları ve kişi başı sayıları döndürür.
const crypto = require("crypto");
const path = require("path");

const LS_KEY = "eczane-nobet-v1";
const HTML = process.env.CIZELGE_HTML || path.resolve(__dirname, "..", "index.html");   // başka bir sürümü denemek için

async function ayOlustur(page){
  await page.evaluate(()=>document.getElementById("generate-btn").click());
  // izin / uygunluk ön kontrolü pencere açarsa "Yine de oluştur"
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ const b = document.getElementById("uyg-devam"); if (b) b.click(); });
  await page.waitForFunction(()=>!document.body.classList.contains("uretiliyor") && !document.getElementById("generate-btn").disabled, null, {timeout:300000});
}

function ozet(sch, staff){
  const ad = {}; staff.forEach(s=>{ ad[s.id] = s.name; });
  const kisi = {}; staff.forEach(s=>{ kisi[s.name] = {nobet:0, hazirlama:0}; });
  sch.days.forEach(d=>{
    d.assigned.forEach(p=>{ if (kisi[ad[p.id]]) kisi[ad[p.id]].nobet++; });
    (d.prep||[]).forEach(p=>{ if (kisi[ad[p.id]]) kisi[ad[p.id]].hazirlama++; });
  });
  const imza = sch.days.map(d=>d.day+":"+d.assigned.map(p=>p.id).join(",")+"/"+(d.prep||[]).map(p=>p.id).join(",")).join(";");
  return {kisi, imza: crypto.createHash("sha1").update(imza).digest("hex").slice(0, 12)};
}

function fark(kisi, alan, adlar){
  const v = adlar.map(a=>kisi[a][alan]); return v.length ? Math.max(...v) - Math.min(...v) : 0;
}

async function senaryoCalistir(browser, sen, htmlYolu){
  const page = await browser.newPage();
  page.on("dialog", d=>d.accept());
  // Arama süreyle de sınırlı (birkaç saniye); hızlı ve yavaş makinede farklı sonuç çıkmasın diye saat
  // durdurulur, arama yalnız deneme sayısı sınırıyla biter. Böylece sonuç her makinede aynıdır.
  await page.addInitScript(()=>{ const t = Date.now(); Date.now = ()=>t; });
  try {
    await page.goto("file://" + (htmlYolu || HTML));
    let S = {staff: sen.staff, prefs: sen.prefs || {}, year: sen.yil, month: sen.aylar[0], settings: sen.settings || {}};
    const sonuc = [];
    for (const m of sen.aylar){
      S.month = m; delete S.schedule;
      await page.evaluate(([k, v])=>localStorage.setItem(k, v), [LS_KEY, JSON.stringify(S)]);
      await page.reload();
      await ayOlustur(page);
      const uyarilar = await page.evaluate(()=>[...document.querySelectorAll("#warnings .warning-box")].map(el=>({
        seviye: (el.className.match(/uy-(hata|uyari|bilgi)/)||[])[1] || "uyari",
        baslik: el.querySelector("summary b").textContent.trim(),
        metin: el.querySelector(".uy-detay").textContent.trim(),
      })));
      S = JSON.parse(await page.evaluate(k=>localStorage.getItem(k), LS_KEY));
      const sch = S.schedules[sen.yil + "-" + m];
      if (!sch) throw new Error(sen.ad + ": " + (m+1) + ". ay çizelgesi oluşmadı");
      const o = ozet(sch, sen.staff);
      // ayın tamamında çalışan nöbetçi personel (ay ortasında başlayan/ayrılan hariç)
      const tamAy = sen.staff.filter(s=>!(s.baslangic && s.baslangic > sen.yil+"-"+String(m+1).padStart(2,"0")+"-01")).map(s=>s.name);
      const fm = uyarilar.map(u=>u.metin.match(/fazla mesai farkı (\d+(?:[.,]\d+)?) saat/)).find(Boolean);
      sonuc.push({
        ay: m,
        uyarilar,
        nobetFarki: fark(o.kisi, "nobet", tamAy),
        hazirlamaFarki: fark(o.kisi, "hazirlama", tamAy),
        fazlaMesaiFarki: fm ? Number(fm[1].replace(",", ".")) : null,   // yalnız kesin kural uyarısı varsa
        kisi: o.kisi,
        imza: o.imza,
      });
    }
    return sonuc;
  } finally {
    await page.close();
  }
}

module.exports = {senaryoCalistir, HTML};
