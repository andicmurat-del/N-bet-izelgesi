# Nöbet Çizelgesi (yeni sürüm)

Eczane nöbet çizelgesinin baştan yazılan sürümü. Eski uygulama (`../index.html`) ve onun artifact'i değişmeden kalır.

- **Arayüz:** Svelte 5 + TypeScript, tasarım sistemi `src/stil.css`.
- **Çizelge motoru:** `src/motor/` (TypeScript). Eski uygulamanın kural ve arama kodu, bölümlere ayrılıp yeniden yazıldı. Davranış aynıdır; tek fark, eski uygulamanın sessizce bıraktığı kesin kural ihlallerini (ör. 5 günde 3 nöbet) yeni motorun gidermeye çalışması ve kalanları gün üzerinde kırmızı işaretlemesidir. İlk aramada uyarı kalırsa farklı başlangıçlarla en fazla 3 kez daha aranır, en az uyarılı çizelge seçilir (`index.ts`). Kadro bir ay kesin kurallara matematiksel olarak yetmiyorsa (ör. Cumartesi–Pazar için 8 farklı kişi gerekir) çizelge uyarısında nedeniyle söylenir (`nobet/kapasite.ts`). Giriş `index.ts`; her çağrı verinin kendi kopyasıyla (`baglam.ts`) çalışır. Çizelge oluşturma `nobet/` altında adım adım: ilk yerleştirme, hazırlama, yerel arama (amaç fonksiyonu `nobet/amac.ts`, kesin kurallar `nobet/kurallar.ts`), uyarılar. Kural ağırlıkları tek tabloda: `sabitler.ts`. Ekran donmasın diye arka planda (Web Worker) çalışır; tarayıcı işçiyi engellerse sayfada çalışır.
- **Veri:** Yalnız bu tarayıcıda (`localStorage`) saklanır. Taşımak için Ayarlar > Yedek.
- **Çıktı:** Tek bir HTML dosyası; claude.ai artifact'i olarak yayımlanır.

## Komutlar

```
npm ci
npm run dev        # geliştirme sunucusu
npm run check      # tip denetimi
npm test           # eski uygulamanın senaryoları (sonuç kayıttan kötü değil); altın kayıt (test/altin.test.js); rastgele senaryo taraması; kurallar; değişim denetimi; servis dağıtımı
npm run artifact   # dist/index.html ve artifact sayfası dist/artifact.html
```

`npm test` yaklaşık 4 dakika sürer:

- 5 senaryonun 15 ayı eski uygulamanın aynı girdiyle kaydettiği sonuçla karşılaştırılır: hata düzeyinde uyarı sayısı ve nöbet / hazırlama / fazla mesai farkı eski uygulamadan kötü olmamalı (kurallar bilerek değiştirildiği için çizelgeler artık birebir aynı değil; kuralların tam tutmadığı aylarda yalnız hata sayısı karşılaştırılır).
- Altın kayıt testi, zengin bir senaryoda (izinler, resmi tatil, arife, kilitli günler, destek ve dışarıdan gelen eczacı, acil servis, servis hazırlama) motorun tüm işlevlerinin çıktısını kayıtla karşılaştırır. Kodu düzenlerken davranışın değişmediğinin güvencesidir.
- Rastgele senaryo taraması (`test/tarama.test.js`) 20 rastgele kadro/izin/ayar bileşiminde motorun tüm işlevlerini çalıştırır: çökme yok, girdi değişmez, aynı girdi aynı sonuç, her kesin kural ihlali gün üzerinde işaretli. Daha geniş tarama: `N=200 npx vitest run test/tarama.test.js`.
- Kuralı bilerek değiştirdiyseniz kaydı yenileyin: `ALTIN_YAZ=1 npx vitest run test/altin.test.js`.

## Bölümler

- **Çizelge:** eczane nöbet çizelgesi (oluştur, elle düzenle, onayla; PDF ve Excel), günlük çalışma listesi (puantaja göre onay, hazırlama, izinliler) ve acil servis nöbetleri (acil servis eczacıları için elle; PDF ve Excel).
- **Puantaj:** aylık cetvel (hücreler elle değiştirilebilir, acil servis nöbetleri 24 saat; PDF ve Excel); ay içi izin ve rapor kaydı (kişinin görevli olduğu günler için yerine geçecek kişi önerilir; yerine tutma sırayla gelir, seçilen kişi çizelgeye de işlenir, yıllık eşitlikte görev raporlu / izinli kişinin sayılır, telafi edilmez); nöbet değişimi (yerine tutma, karşılıklı takas, kural denetimi, geri alma).
- **Servis hazırlama:** o gün çalışan teknikerlere servislerin zorluk × hasta sayısına göre dengeli dağıtımı (eski uygulamanın algoritması aynen; kişi başı servis, YB ve zor servis sayısı her gün en çok 1 farklı; yük her ay kendi içinde eşitlenir, eski uygulamadaki gibi yıl boyunca taşınmaz). Kişiyi dağıtımdan çıkarma, yeniden karıştırma, servisi elle başka teknikere verme; PDF listeler (tek sayfa, kişi başı kontrol listesi, toplu liste). Servis listesi ayarları aynı bölümde; yıllık rapor Raporlar > Servis hazırlama.
- **İzin ve tercihler**, **Personel**, **Ayarlar** (kurallar, yedek).
- **Geri al / yinele:** yan menüde (telefonda üstte) ve Ctrl+Z / Ctrl+Y; son 30 adım, bu oturum boyunca. Onay bir geri alma noktasıdır.
- **Raporlar:** yıllık fazla mesai, görev dağılımı, yıllık denge ve kişi geçmişi; Excel.
