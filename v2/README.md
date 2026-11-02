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
- Altın kayıt testi, zengin bir senaryoda (izinler, resmi tatil, arife, kilitli günler, destek ve kemoterapi eczacısı, acil eczane, servis hazırlama) motorun tüm işlevlerinin çıktısını kayıtla karşılaştırır. Kodu düzenlerken davranışın değişmediğinin güvencesidir.
- Rastgele senaryo taraması (`test/tarama.test.js`) 20 rastgele kadro/izin/ayar bileşiminde motorun tüm işlevlerini çalıştırır: çökme yok, girdi değişmez, aynı girdi aynı sonuç, her kesin kural ihlali gün üzerinde işaretli. Daha geniş tarama: `N=200 npx vitest run test/tarama.test.js`. Acil eczane ve öğlen nöbeti için ayrı tarama (`test/tarama-acil.test.js`): rastgele acil kadrosu, acil listesi eczaneden önce ya da sonra; acil yalnız acil kadrosundan, acil kadrosu eczanede görev almaz, acil nöbetinin yanında eczane görevi yok, öğlene yalnız o gün mesaide olan eczacı / tekniker.
- Kuralı bilerek değiştirdiyseniz kaydı yenileyin: `ALTIN_YAZ=1 npx vitest run test/altin.test.js`.

## Bölümler

- **Bölümler:** Günlük Eczane (Günlük Eczane Nöbet Listesi, Aylık Çalışma Listesi, Öğlen Nöbet Listesi, Hazırlama Listesi, Puantaj, İzinler — yalnız günlük eczane kadrosu), Acil Eczane (Acil Eczane Nöbet Listesi, Puantaj, İzinler — yalnız acil kadrosu: acil servis personeli ve acilde nöbet tutanlar; acil servis personeli Günlük Eczane çalışma listesinde ve puantajında görünmez), Raporlar, Personel, Ayarlar.
- **Çizelge:** eczane nöbet çizelgesi (oluştur, elle düzenle, onayla; PDF ve Excel), günlük çalışma listesi (puantaja göre onay, hazırlama, izinliler) ve acil eczane nöbet listesi (günde 2 kişi; acil servis personeli ve Personel'de "Acilde nöbet tutar" işaretli eczacılar (kemoterapi eczacıları dahil) arasından otomatik ve eşit, eczane nöbetinden ayrı ve yıl boyunca (pay yazılabilen gün sayısına göre: izinli / raporlu günler düşülür, telafi yok; ay ortası başlayan / ayrılan çalıştığı gün kadar); iki liste birbirinden bağımsız oluşturulur ama çakışmaz: acil nöbeti olan kişi aynı / komşu günde eczanede görev almaz; elle düzenlenen günler korunur; PDF ve Excel; `motor/acil.ts`, test `test/acil.test.js`).
- **Öğlen nöbeti:** Çizelge > Öğlen nöbeti. Hafta içi öğle arasında eczanede kalanlar: Pzt–Prş 2 eczacı + 1 tekniker, Cuma 3 eczacı + 2 tekniker (eczacılar ve teknikerler; acil servis personeli ve kemoterapi eczacısı yazılmaz; Personel'de "Cuma'dan muaf" işaretlenen eczacı ya da tekniker Cuma yazılmaz). O gün mesaide çalışanlardan yazılır (puantaja göre); resmi tatil ve arife günü yoktur. Herkese haftada bir (kişi yetmezse iki), yıl boyunca toplam ve Cuma sayısı ayrı ayrı eşit; eşitlik bozulmuyorsa o günün nöbetçisine yazılmaz. Bir güne dokunup elle değiştirilebilir (elle düzenlenen gün korunur); sonradan girilen izin / rapor ile boşalan yerler bugünden itibaren kendiliğinden doldurulur; PDF çıktısı (A4 dikey) (`motor/oglen.ts`, test `test/oglen.test.js`).
- **Puantaj:** aylık cetvel (hücreler elle değiştirilebilir, acil servis nöbetleri 24 saat; PDF ve Excel); ay içi izin ve rapor kaydı (kişinin görevli olduğu günler için yerine geçecek kişi önerilir; yerine tutma sırayla gelir, seçilen kişi çizelgeye de işlenir, yıllık eşitlikte görev raporlu / izinli kişinin sayılır, telafi edilmez); nöbet değişimi (yerine tutma, karşılıklı takas, kural denetimi, geri alma).
- **Servis hazırlama:** o gün çalışan teknikerlere servislerin zorluk × hasta sayısına göre dengeli dağıtımı (eski uygulamanın algoritması aynen; kişi başı servis, YB ve zor servis sayısı her gün en çok 1 farklı; yük her ay kendi içinde eşitlenir, eski uygulamadaki gibi yıl boyunca taşınmaz). Kişiyi dağıtımdan çıkarma, yeniden karıştırma, servisi elle başka teknikere verme; PDF listeler (tek sayfa, kişi başı kontrol listesi, toplu liste). Servis listesi ayarları aynı bölümde; yıllık rapor Raporlar > Servis hazırlama.
- **İzin ve tercihler**, **Personel**, **Ayarlar** (kurallar, yedek).
- **Geri al / yinele:** yan menüde (telefonda üstte) ve Ctrl+Z / Ctrl+Y; son 30 adım, bu oturum boyunca. Onay bir geri alma noktasıdır.
- **Raporlar:** yıllık fazla mesai, görev dağılımı, yıllık denge ve kişi geçmişi; Excel. Acil ve öğlen: kişi başı ay ay acil eczane nöbeti (hafta sonu / tatil ayrıca) ve öğlen nöbeti (Cuma ayrıca), en çok − en az farkı.
- **Liste onayı:** acil eczane ve öğlen nöbet listeleri de onaylanır; onaylı ay yeniden oluşturulmaz, silinmez, elle değiştirilmez (geri alma onayı bozmaz). Onaylı acil listesinde sonradan izin / rapor alan kişinin günü işaretlenir; yerine yazılabilecekler uygunluğa ve yıl içindeki acil nöbet sayısına göre sıralı önerilir. Onaylı öğlen listesinde izin / rapor sonrası onarım yine kendiliğinden yapılır.
