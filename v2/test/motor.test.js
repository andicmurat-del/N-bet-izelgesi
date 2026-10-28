// Yeni motor, eski uygulamanın (../index.html) aynı senaryolarda kaydettiği çizelgeleri birebir üretmeli.
// Kayıtlar: ../tests/beklenen.json (eski uygulamanın senaryo testleri). Arama süreyle de sınırlı olduğundan
// saat sabit verilir; arama yalnız deneme sayısıyla biter ve sonuç her makinede aynıdır.
// BILEREK_FARKLI: eski uygulamanın hatası düzeltildiği için farklı çıkan aylar. Eski uygulama "5 günde 3 nöbet" gibi
// kesin kural ihlallerini ilk yerleştirmeden olduğu gibi bırakıyor, günü de uyarılı işaretlemiyordu; yeni motor bu
// ihlalleri amaç fonksiyonunda cezalandırıp gidermeye çalışır, kalanları işaretler (bkz. motor/nobet/kurallar.ts ihlalSayisi).
import { describe, test, expect } from "vitest";
import { createRequire } from "module";
import crypto from "crypto";
import { cizelgeOlustur } from "../src/motor";

const require = createRequire(import.meta.url);
const senaryolar = require("../../tests/senaryolar.js");
const beklenen = require("../../tests/beklenen.json");

const BILEREK_FARKLI = { "az-kadro": { 0: "93d53d3167f1", 1: "841a6379371b" } };

const imza = days => crypto.createHash("sha1")
  .update(days.map(d => d.day + ":" + d.assigned.map(p => p.id).join(",") + "/" + (d.prep || []).map(p => p.id).join(",")).join(";"))
  .digest("hex").slice(0, 12);

// Her ay ayrı bir test: aylar sırayla çalışır ve önceki ayların çizelgesi sonrakine aktarılır (yıllık eşitlik).
// Uzun ve kesintisiz hesap tek testte toplanınca test aracının iç haberleşmesi zaman aşımına düşüyor.
for (const sen of senaryolar) {
  describe(sen.ad + " (" + sen.aciklama + ")", () => {
    const veri = { staff: sen.staff, prefs: sen.prefs || {}, settings: sen.settings || {}, schedules: {} };
    const personel = JSON.stringify(sen.staff);
    sen.aylar.forEach((m, i) => {
      const farkli = BILEREK_FARKLI[sen.ad]?.[i];
      test((m + 1) + (farkli ? ". ay (eski uygulamanın hatası düzeltildi)" : ". ay eski uygulamayla aynı"), () => {
        const r = cizelgeOlustur(veri, sen.yil, m, { saat: () => 0 });
        expect(imza(r.days)).toBe(farkli || beklenen[sen.ad][i].imza);
        veri.schedules[sen.yil + "-" + m] = { year: sen.yil, month: m, days: r.days };
        expect(JSON.stringify(sen.staff), "motor girdiyi değiştirmemeli").toBe(personel);
      });
    });
  });
}
