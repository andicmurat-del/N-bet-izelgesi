# Nöbet Çizelgesi (yeni sürüm)

Eczane nöbet çizelgesinin baştan yazılan sürümü. Eski uygulama (`../index.html`) ve onun artifact'i değişmeden kalır.

- **Arayüz:** Svelte 5 + TypeScript, tasarım sistemi `src/stil.css`.
- **Çizelge motoru:** `src/motor/cizelge.js`. Eski uygulamanın kural ve arama kodu, ekrandan bağımsız hale getirilerek taşındı. Ekran donmasın diye arka planda (Web Worker) çalışır.
- **Veri:** Yalnız bu tarayıcıda (`localStorage`) saklanır. Taşımak için Ayarlar > Yedek.
- **Çıktı:** Tek bir HTML dosyası; claude.ai artifact'i olarak yayımlanır.

## Komutlar

```
npm ci
npm run dev        # geliştirme sunucusu
npm run check      # tip denetimi
npm test           # motor, eski uygulamanın kayıtlı çizelgelerini birebir üretmeli (../tests/beklenen.json)
npm run artifact   # dist/index.html ve artifact sayfası dist/artifact.html
```

`npm test` yaklaşık 1,5 dakika sürer: 5 senaryonun 15 ayı, eski uygulamanın aynı girdiyle kaydettiği çizelgelerle karşılaştırılır. Motoru değiştirmeniz gerekirse önce bu testi güncelleyin.

## Bölümler

- **Çizelge:** eczane nöbet çizelgesi (oluştur, elle düzenle, onayla; PDF ve Excel), günlük çalışma listesi (puantaja göre onay, hazırlama, izinliler) ve acil servis nöbetleri (acil servis eczacıları için elle; PDF ve Excel).
- **Puantaj:** aylık cetvel; hücreler elle değiştirilebilir, acil servis nöbetleri 24 saat sayılır. PDF ve Excel.
- **İzin ve tercihler**, **Personel**, **Ayarlar** (kurallar, yedek).
- **Raporlar:** yıllık fazla mesai, görev dağılımı, yıllık denge ve kişi geçmişi; Excel.

## Yapılacaklar

- Puantajda izin/rapor aralığı girişi ve yerine geçecek kişi önerisi; nöbet değişimi kaydı
