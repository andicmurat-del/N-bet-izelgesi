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
npm test           # motor eski uygulamanın kayıtlı çizelgelerini birebir üretmeli (../tests/beklenen.json); değişim denetimi; servis dağıtımı eski uygulamanın kayıtlı sonucuyla (test/servis-beklenen.json)
npm run artifact   # dist/index.html ve artifact sayfası dist/artifact.html
```

`npm test` yaklaşık 1,5 dakika sürer: 5 senaryonun 15 ayı, eski uygulamanın aynı girdiyle kaydettiği çizelgelerle karşılaştırılır. Motoru değiştirmeniz gerekirse önce bu testi güncelleyin.

## Bölümler

- **Çizelge:** eczane nöbet çizelgesi (oluştur, elle düzenle, onayla; PDF ve Excel), günlük çalışma listesi (puantaja göre onay, hazırlama, izinliler) ve acil servis nöbetleri (acil servis eczacıları için elle; PDF ve Excel).
- **Puantaj:** aylık cetvel (hücreler elle değiştirilebilir, acil servis nöbetleri 24 saat; PDF ve Excel); ay içi izin ve rapor kaydı (kişinin görevli olduğu günler için yerine geçecek kişi önerilir, seçilen kişi çizelgeye de işlenir); nöbet değişimi (yerine tutma, karşılıklı takas, kural denetimi, geri alma).
- **Servis hazırlama:** o gün çalışan teknikerlere servislerin zorluk × hasta sayısına göre dengeli dağıtımı (eski uygulamanın algoritması aynen; kişi başı servis, YB ve zor servis sayısı her gün en çok 1 farklı, aylar boyunca yük eşitlenir). Kişiyi dağıtımdan çıkarma, yeniden karıştırma, servisi elle başka teknikere verme; PDF listeler (tek sayfa, kişi başı kontrol listesi, toplu liste). Servis listesi ayarları aynı bölümde; yıllık rapor Raporlar > Servis hazırlama.
- **İzin ve tercihler**, **Personel**, **Ayarlar** (kurallar, yedek).
- **Raporlar:** yıllık fazla mesai, görev dağılımı, yıllık denge ve kişi geçmişi; Excel.
