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
  if (GUNCELLE) fs.writeFileSync(BEKLENEN, JSON.stringify(yeni, null, 2) + "\n");
});

for (const sen of senaryolar){
  test(sen.ad + " (" + sen.aciklama + ")", async()=>{
    const sonuc = (await senaryoCalistir(tarayici, sen)).map(kayit);
    yeni[sen.ad] = sonuc;

    if (sen.temizBeklenir){
      sonuc.forEach(a=>assert.deepStrictEqual(a.hatalar, [], AY[a.ay] + ": yeterli kadroda hata düzeyinde uyarı çıktı"));
    }
    if (GUNCELLE) return;

    const eski = beklenen[sen.ad];
    assert.ok(eski, "beklenen.json'da bu senaryo yok: GUNCELLE=1 npm test ile ekleyin");
    assert.strictEqual(sonuc.length, eski.length, "ay sayısı değişti: GUNCELLE=1 npm test ile yenileyin");

    if (SIKI){
      sonuc.forEach((a,i)=>assert.strictEqual(a.imza, eski[i].imza, AY[a.ay] + ": çizelge kayıtlı sonuçtan farklı"));
      return;
    }
    // Uyarı kaçınılmaz senaryolarda ağırlık değişiklikleri çizelgeyi aylara göre farklı yönlere oynatabilir;
    // bu yüzden senaryonun toplamına bakılır: hata düzeyinde uyarı ve fazla mesai aşımı artmamalı.
    const topla = (dizi, f)=>dizi.reduce((t,a)=>t+f(a), 0);
    const hataSay = a=>a.hatalar.length, fmAsim = a=>a.fazlaMesaiFarki ? a.fazlaMesaiFarki - 8 : 0;
    const ozet = dizi=>dizi.map(a=>AY[a.ay]+": "+(a.hatalar.join(", ")||"hata yok")+(a.fazlaMesaiFarki ? " (fazla mesai farkı "+a.fazlaMesaiFarki+" sa)" : "")).join("\n  ");
    const mesaj = "\n  önce:\n  " + ozet(eski) + "\n  şimdi:\n  " + ozet(sonuc) + "\n  Değişiklik bilerek yapıldıysa: GUNCELLE=1 npm test";
    assert.ok(topla(sonuc, hataSay) <= topla(eski, hataSay), "hata düzeyinde uyarı sayısı arttı" + mesaj);
    assert.ok(topla(sonuc, fmAsim) <= topla(eski, fmAsim), "fazla mesai kesin kural aşımı arttı" + mesaj);
  });
}
