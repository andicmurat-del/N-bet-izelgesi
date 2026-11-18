// Kural denetimi panelinde uyarıdan güne geçiş: uyarı metnindeki günler.
import { test, expect } from "vitest";
import { uyariGunleri } from "../src/veri/uyariGunleri";

test("motorun uyarı biçimlerinden günler", () => {
  expect(uyariGunleri("Nöbette eczacı yok: 3. gün, 14. gün (her gün en az bir eczacı nöbetçi olmalı).", 10, 30)).toEqual([3, 14]);
  expect(uyariGunleri("Nöbetçi sayısında eksik kişi: 7. gün (1/2), 21. gün (2/3).", 10, 30)).toEqual([7, 21]);
  expect(
    uyariGunleri("... hazırlamanın ertesi günü nöbet tutuyor (hazırlama günü yazılı): T3 (4 Nisan), T2 (5 Nisan), T3 (23 Nisan).", 3, 30),
  ).toEqual([4, 5, 23]);
  expect(uyariGunleri("Şu günler için yeterli hazırlama personeli bulunamadı: 4 (1/2), 5 (1/2), 11, 12 (1/2), 26 (1/2).", 3, 30)).toEqual([
    4, 5, 11, 12, 26,
  ]);
  // başka ayın adı, ayda olmayan gün ve sayılar gün sayılmaz
  expect(uyariGunleri("E1 (2 Cumartesi, 2 Pazar); 31 Nisan; fark 64 saat (en fazla 8).", 3, 30)).toEqual([]);
  expect(uyariGunleri("İzinli günde görevi olanlar: Dila (21. gün, nöbet). 3 Kasım ve 4 Aralık", 10, 30)).toEqual([3, 21]);
});
