// Çizelge oluşturucu senaryo testleri.
//   npm test              → kurallar ve kayıtlı sonuçla karşılaştırma
//   SIKI=1 npm test       → çizelgeler kayıtlıyla birebir aynı olmalı (davranışı değiştirmeyen düzenlemeler için)
//   GUNCELLE=1 npm test   → bilerek yapılan bir değişiklikten sonra kayıtlı sonucu (beklenen.json) yeniler
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const {chromium} = require("playwright");
const {senaryoCalistir} = require("./calistir");
const senaryolar = require("./senaryolar");

const BEKLENEN = path.join(__dirname, "beklenen.json");
const GUNCELLE = process.env.GUNCELLE === "1";
const SIKI = process.env.SIKI === "1";
const AY = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

function kayit(ay){
  return {
    ay: ay.ay,
    imza: ay.imza,
    hatalar: ay.uyarilar.filter(u=>u.seviye==="hata").map(u=>u.baslik).sort(),
    uyarilar: ay.uyarilar.filter(u=>u.seviye==="uyari").map(u=>u.baslik).sort(),
    fazlaMesaiFarki: ay.fazlaMesaiFarki,
    nobetFarki: ay.nobetFarki,
    hazirlamaFarki: ay.hazirlamaFarki,
  };
}

let tarayici;
const beklenen = fs.existsSync(BEKLENEN) ? JSON.parse(fs.readFileSync(BEKLENEN, "utf8")) : {};
const yeni = {};

test.before(async()=>{ tarayici = await chromium.launch(); });
test.after(async()=>{
  if (tarayici) await tarayici.close();
  if (!GUNCELLE) return;
  // yalnız bütün senaryolar başarıyla çalıştıysa yaz: eksik ya da hatalı bir çalıştırma kaydı bozmasın
  const eksik = senaryolar.filter(s=>!yeni[s.ad]).map(s=>s.ad);
  if (eksik.length) console.error("beklenen.json YAZILMADI; çalışmayan ya da hata veren senaryolar: " + eksik.join(", "));
  else fs.writeFileSync(BEKLENEN, JSON.stringify(yeni, null, 2) + "\n");
});

for (const sen of senaryolar){
  test(sen.ad + " (" + sen.aciklama + ")", async(t)=>{
    const ham = await senaryoCalistir(tarayici, sen);
    const sonuc = ham.map(kayit);

    if (sen.kontrol){ const sorun = sen.kontrol(ham); assert.strictEqual(sorun, null, sorun); }
    if (sen.temizBeklenir){
      sonuc.forEach(a=>{
        assert.deepStrictEqual(a.hatalar, [], AY[a.ay] + ": yeterli kadroda hata düzeyinde uyarı çıktı");
        assert.ok(a.nobetFarki <= 2, AY[a.ay] + ": nöbet sayısı farkı " + a.nobetFarki + " (en fazla 2)");
        assert.ok(a.hazirlamaFarki <= 1, AY[a.ay] + ": hazırlama farkı " + a.hazirlamaFarki + " (en fazla 1)");
      });
    }
    if (GUNCELLE){ yeni[sen.ad] = sonuc; return; }

    const eski = beklenen[sen.ad];
    assert.ok(eski, "beklenen.json'da bu senaryo yok: GUNCELLE=1 npm test ile ekleyin");
    assert.strictEqual(sonuc.length, eski.length, "ay sayısı değişti: GUNCELLE=1 npm test ile yenileyin");

    const farkliAy = sonuc.filter((a,i)=>a.imza !== eski[i].imza).map(a=>AY[a.ay]);
    if (SIKI){
      assert.deepStrictEqual(farkliAy, [], "çizelge kayıtlı sonuçtan farklı: " + farkliAy.join(", "));
      return;
    }
    if (farkliAy.length) t.diagnostic("davranış değişti (" + farkliAy.join(", ") + "): çizelge kayıtlıdan farklı, kurallar aşağıda denetleniyor");

    const ozet = dizi=>dizi.map(a=>AY[a.ay]+": "+(a.hatalar.join(", ")||"hata yok")+(a.fazlaMesaiFarki ? " (fazla mesai farkı "+a.fazlaMesaiFarki+" sa)" : "")+", nöbet farkı "+a.nobetFarki+", hazırlama farkı "+a.hazirlamaFarki).join("\n  ");
    const mesaj = "\n  önce:\n  " + ozet(eski) + "\n  şimdi:\n  " + ozet(sonuc) + "\n  Değişiklik bilerek yapıldıysa: GUNCELLE=1 npm test";

    // her ay: kayıtta uyarısı olan bir ayda hiç uyarı okunamıyorsa uyarı alanı değişmiş olabilir
    sonuc.forEach((a,i)=>{
      const once = eski[i].hatalar.length + eski[i].uyarilar.length, simdi = a.hatalar.length + a.uyarilar.length;
      assert.ok(!(once > 0 && simdi === 0), AY[a.ay] + ": kayıtta " + once + " uyarı vardı, şimdi hiç uyarı okunmadı (uyarı alanı değişmiş olabilir; gerçekten düzeldiyse GUNCELLE=1 npm test)");
    });
    // daha önce bu senaryoda hiç görülmemiş bir hata türü
    const eskiTurler = new Set(eski.flatMap(a=>a.hatalar));
    const yeniTur = [...new Set(sonuc.flatMap(a=>a.hatalar))].filter(h=>!eskiTurler.has(h));
    assert.deepStrictEqual(yeniTur, [], "yeni hata türü: " + yeniTur.join(", ") + mesaj);

    // Uyarı kaçınılmaz senaryolarda ağırlık değişiklikleri çizelgeyi aylara göre farklı yönlere oynatabilir;
    // bu yüzden sayılar senaryonun toplamında karşılaştırılır: hiçbiri artmamalı.
    const topla = f=>dizi=>dizi.reduce((t,a)=>t+f(a), 0);
    const olcutler = [
      ["hata düzeyinde uyarı sayısı", topla(a=>a.hatalar.length)],
      ["fazla mesai kesin kural aşımı (saat)", topla(a=>a.fazlaMesaiFarki ? a.fazlaMesaiFarki - 8 : 0)],
      ["nöbet sayısı farkı", topla(a=>a.nobetFarki)],
      ["hazırlama farkı", topla(a=>a.hazirlamaFarki)],
    ];
    olcutler.forEach(([ad, f])=>assert.ok(f(sonuc) <= f(eski), ad + " arttı (" + f(eski) + " → " + f(sonuc) + ")" + mesaj));
  });
}
