// Kesin kontrol (geliştirme aracı): örnek veri ve gerçekçi kadrolu rastgele aylar için programın çizelgesini kesin
// çözücüyle karşılaştırır (arac/kesin/model.js). Yavaştır (ay başına birkaç dakika); npm test'e girmez.
//   npm run kesin-kontrol                     örnek ay + 4 rastgele ay
//   SEN=1,2,3 SURE=60 npm run kesin-kontrol   seçilen rastgele aylar, çözüm başına 60 sn
// Özet arac/kesin/son-sonuc.md dosyasına, ayrıntı son-sonuc.json'a yazılır (depoya girmez).
import { test } from "vitest";
import fs from "fs";
import { veriyiDogrula } from "../../src/veri/dogrulama";
import { senaryo } from "../../test/tarama/ortak";
import { incele, ozetMetni } from "./model";

const SURE = Number(process.env.SURE || 60);
const SEN = (process.env.SEN ?? "1,2,3,4").split(",").filter(Boolean).map(Number);
const ORNEK = process.env.ORNEK !== "0";
const metin = [],
  json = {};
// CIKTI=ad: aynı anda birden çok çalıştırmada ayrı dosyalar (son-sonuc-ad.md)
const ek = process.env.CIKTI ? "-" + process.env.CIKTI : "";
const yaz = () => {
  fs.writeFileSync(new URL(`son-sonuc${ek}.md`, import.meta.url), "# Kesin kontrol\n\n" + metin.join("\n\n") + "\n");
  fs.writeFileSync(
    new URL(`son-sonuc${ek}.json`, import.meta.url),
    JSON.stringify(json, (k, v) => (k === "days" ? undefined : v), 1),
  );
};

if (ORNEK)
  test("örnek veri (Kasım 2026)", async () => {
    const v = veriyiDogrula(JSON.parse(fs.readFileSync(new URL("../../e2e/veri/durum.json", import.meta.url), "utf8")));
    delete v.schedules["2026-10"];
    const s = await incele(v, 2026, 10, { sure: SURE });
    metin.push(ozetMetni("Örnek veri", s));
    json.ornek = s;
    yaz();
  });
for (const k of SEN)
  test("rastgele ay " + k, async () => {
    const { y, m0, veri } = senaryo(7000 + k, { eczaci: [6, 8], teknisyen: [4, 8] });
    const s = await incele(veriyiDogrula(veri), y, m0, { sure: SURE });
    metin.push(ozetMetni("Rastgele ay " + k, s));
    json["s" + k] = s;
    yaz();
  });
