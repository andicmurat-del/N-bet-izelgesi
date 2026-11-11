// Ayarlar > Kurallar metni: motordaki her ağırlığın açıklaması var, değerler metne motordan geliyor, ayarlar yazılıyor.
import { test, expect } from "vitest";
import { kurallarMetni, NOBET_AGIRLIK_ACIKLAMA, ACIL_AGIRLIK_ACIKLAMA, OGLEN_AGIRLIK_ACIKLAMA, ONAY_AGIRLIK_ACIKLAMA, SERVIS_AGIRLIK_ACIKLAMA } from "../src/veri/kurallarMetni";
import { AGIRLIK } from "../src/motor/sabitler";
import { W as ACIL } from "../src/motor/acil";
import { W as OGLEN } from "../src/motor/oglen";
import { AGIR as ONAY } from "../src/motor/onayMasa";
import { W as SERVIS } from "../src/motor/servis/dagit";

test("her ağırlığın açıklaması var ve metinde değeriyle yer alır", () => {
  const m = kurallarMetni();
  for (const [w, a] of [[AGIRLIK, NOBET_AGIRLIK_ACIKLAMA], [ACIL, ACIL_AGIRLIK_ACIKLAMA], [OGLEN, OGLEN_AGIRLIK_ACIKLAMA], [ONAY, ONAY_AGIRLIK_ACIKLAMA], [SERVIS, SERVIS_AGIRLIK_ACIKLAMA]]) {
    expect(Object.keys(a).sort()).toEqual(Object.keys(w).sort());
    for (const k of Object.keys(w)) expect(m).toContain("| `" + k + "` |");
  }
  expect(m).not.toMatch(/undefined|NaN|\[object/);
});

test("kurumun ayarları metne yazılır", () => {
  const m = kurallarMetni({ minAra: 5, acilMinAra: 4, destekAylik: 3, arifeSaat: 4 });
  expect(m).toContain("| Günlük eczane: iki nöbet arasında önerilen en az gün | 5 |");
  expect(m).toContain("| Acil eczane: iki acil nöbeti arasında önerilen en az gün | 4 |");
  expect(m).toContain("| Destek personeli aylık hazırlama sayısı | 3 |");
});
