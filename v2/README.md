# Nöbet Çizelgesi (yeni sürüm)

Eczane nöbet çizelgesinin baştan yazılan sürümü. Eski uygulama (`../index.html`) ve onun artifact'i değişmeden kalır.

- **Arayüz:** Svelte 5 + TypeScript, tasarım sistemi `src/stil.css`.
- **Çizelge motoru:** `src/motor/` (TypeScript). Eski uygulamanın kural ve arama kodu; davranışı birebir aynı, ama bölümlere ayrılıp yeniden yazıldı. Giriş `index.ts`; her çağrı verinin kendi kopyasıyla (`baglam.ts`) çalışır. Çizelge oluşturma `nobet/` altında adım adım: ilk yerleştirme, hazırlama, yerel arama (amaç fonksiyonu `nobet/amac.ts`, kesin kurallar `nobet/kurallar.ts`), uyarılar. Kural ağırlıkları tek tabloda: `sabitler.ts`. Ekran donmasın diye arka planda (Web Worker) çalışır; tarayıcı işçiyi engellerse sayfada çalışır.
- **Veri:** Yalnız bu tarayıcıda (`localStorage`) saklanır. Taşımak için Ayarlar > Yedek.
- **Çıktı:** Tek bir HTML dosyası; claude.ai artifact'i olarak yayımlanır.

## Komutlar

```
npm ci
npm run dev        # geliştirme sunucusu
npm run check      # tip denetimi
npm test           # motor eski uygulamanın kayıtlı çizelgelerini birebir üretmeli (../tests/beklenen.json); altın kayıt (test/altin.test.js); değişim denetimi; servis dağıtımı
npm run artifact   # dist/index.html ve artifact sayfası dist/artifact.html
```

`npm test` yaklaşık 4 dakika sürer:

- 5 senaryonun 15 ayı, eski uygulamanın aynı girdiyle kaydettiği çizelgelerle karşılaştırılır.
- Altın kayıt testi, zengin bir senaryoda (izinler, resmi tatil, arife, kilitli günler, destek ve dışarıdan gelen eczacı, acil servis, servis hazırlama) motorun tüm işlevlerinin çıktısını kayıtla karşılaştırır. Kodu düzenlerken davranışın değişmediğinin güvencesidir.
- Kuralı bilerek değiştirdiyseniz kaydı yenileyin: `ALTIN_YAZ=1 npx vitest run test/altin.test.js`.

## Bölümler

- **Çizelge:** eczane nöbet çizelgesi (oluştur, elle düzenle, onayla; PDF ve Excel), günlük çalışma listesi (puantaja göre onay, hazırlama, izinliler) ve acil servis nöbetleri (acil servis eczacıları için elle; PDF ve Excel).
- **Puantaj:** aylık cetvel (hücreler elle değiştirilebilir, acil servis nöbetleri 24 saat; PDF ve Excel); ay içi izin ve rapor kaydı (kişinin görevli olduğu günler için yerine geçecek kişi önerilir, seçilen kişi çizelgeye de işlenir); nöbet değişimi (yerine tutma, karşılıklı takas, kural denetimi, geri alma).
- **Servis hazırlama:** o gün çalışan teknikerlere servislerin zorluk × hasta sayısına göre dengeli dağıtımı (eski uygulamanın algoritması aynen; kişi başı servis, YB ve zor servis sayısı her gün en çok 1 farklı; yük her ay kendi içinde eşitlenir, eski uygulamadaki gibi yıl boyunca taşınmaz). Kişiyi dağıtımdan çıkarma, yeniden karıştırma, servisi elle başka teknikere verme; PDF listeler (tek sayfa, kişi başı kontrol listesi, toplu liste). Servis listesi ayarları aynı bölümde; yıllık rapor Raporlar > Servis hazırlama.
- **İzin ve tercihler**, **Personel**, **Ayarlar** (kurallar, yedek).
- **Geri al / yinele:** yan menüde (telefonda üstte) ve Ctrl+Z / Ctrl+Y; son 30 adım, bu oturum boyunca. Onay bir geri alma noktasıdır.
- **Raporlar:** yıllık fazla mesai, görev dağılımı, yıllık denge ve kişi geçmişi; Excel.
