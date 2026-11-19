# Çizelge motoru: nasıl çalışır

Bu belge, `src/motor/` altındaki kodu ilk kez okuyacak kişi içindir. Kuralların kullanıcıya dönük tam metni
`src/veri/kurallarMetni.ts`'tedir (Ayarlar > Kurallar); burada kodun nasıl düzenlendiği ve bir kuralın nereye
yazıldığı anlatılır.

## Temel ilkeler

- **Girdi değişmez.** Dışa açık her işlev (`src/motor/index.ts`) verinin kopyasıyla çalışır (`Baglam`, `baglam.ts`).
  Arayüz motoru yalnız `index.ts` üzerinden çağırır.
- **Aynı veri, aynı sonuç.** Arama süreyle değil tur sayısıyla sınırlıdır (`nobet/arama.ts` `ARAMA_TUR`); rastgelelik sabit
  tohumludur ("Farklı dağılım" yalnız tohumu değiştirir). Aynı veriyle her bilgisayarda, telefonda ve testte aynı çizelge çıkar.
- **Kesin kural ve tercih ayrı.** Kesin kurallar aramada her hamlede korunur (`nobet/kurallar.ts`); tercihler amaç
  fonksiyonunda ağırlıklı cezadır (`nobet/amac.ts`, ağırlıklar `sabitler.ts` `AGIRLIK`). Kadro yetmediğinde esneyen kesin
  kural gün üzerinde kırmızı işaretlenir (`conflict`) ve uyarıda nedeniyle söylenir (`nobet/uyarilar.ts`).
- **Takvim:** ay 0'dan (Ocak = 0), haftanın günü Pazartesi'den (0 = Pazartesi … 6 = Pazar) sayılır (`takvim.ts`).

## Günlük eczane nöbet çizelgesi (bir ay)

```
cizelgeOlustur (index.ts)
  └─ cizelgeUret (nobet/olustur.ts)
       0. ay hazırlığı       nobet/ay.ts        kadro, yıllık devir (devir.ts), ay sınırı (nobet/sinir.ts), kişi sırası
       1. ilk yerleştirme    nobet/ilkYerlestirme.ts   açgözlü, gün gün: o ana kadarki yüke göre en uygun eczacı + ikinci nöbetçi
       2. hazırlama          nobet/hazirlama.ts        tatil günleri: önce her teknikere 1, sonra eczacılara; destek 2. yere
       3. yerel arama        nobet/arama.ts            iniş (her turda en iyi hamle) + yinelemeli arama (küçük bozma, yeniden iniş)
                             nobet/amac.ts             amaç değeri (artımlı hesap)
                             nobet/kurallar.ts         her hamlede korunan kesin kurallar
       4. denetim, uyarılar  nobet/uyarilar.ts         esneyen günler kırmızı, uyarı metinleri
  └─ uyarı kaldıysa: farklı başlangıçlarla EK_DENEME kez daha aranır, en az uyarılısı seçilir (index.ts)
```

Ekranda arama arka planda yürür (`istemci.ts` → `isci.ts`, Web Worker); asıl arama ile ek denemeler ayrı işçilerde aynı
anda çalışır, sonuç sırayla aramadakiyle aynıdır.

### Yerel arama (`nobet/arama.ts`)

`yerelArama` üç parçadır:

1. **İniş (`inis`)**: her turda bütün hamle türleri denenir, amaç değerini en çok düşüren hamle uygulanır; iyileşme kalmayınca
   biter. Hamle türleri ayrı işlevlerdir ve `HAMLELER` dizisindeki sırayla denenir (eşit iyilikte önce bulunan seçilir):
   nöbetçi değiştir, iki günün nöbetçilerini takas et, hazırlamacı değiştir, hazırlama takası, destek ekle, hazırlama için nöbet
   devri, resmi tatil nöbeti için devir, aynı gün nöbet ↔ hazırlama, hazırlamayı ver nöbet al.
2. **Yinelemeli arama (`yinelemeliArama`)**: birkaç nöbetçi ve hazırlama yeri rastgele değiştirilir, yeniden iniş yapılır;
   sonuç daha iyiyse saklanır. Uyarı yoksa `ARAMA_TUR.KISA`, varsa `ARAMA_TUR.UZUN` tur.
3. **Hazırlama onarımı (`hazirlamaOnarimi`)**: ilk yerleştirmede "başka kimse yok" diye kural esnetilerek yazılan
   hazırlamalar, sonradan uygun biri bulunursa ona verilir.

### Amaç fonksiyonu (`nobet/amac.ts`)

Kişi başı sayaçlar (fazla mesai, nöbet, Perşembe / Cuma / Cumartesi / Pazar, hazırlama, resmi tatil…) dizilerde tutulur.
`tabanKur` mevcut çizelgeyi sayar; `jDelta(i, k)` bir hamlenin değiştirdiği 1–2 günü ve onlara bakan komşu günleri yeniden
hesaplayıp yeni amaç değerini verir (her aday hamlede bütün ay yeniden sayılmaz). Toplam `ozetJ`'de, parçalar ayrı
işlevlerde ama sabit bir sırayla toplanır: kayan nokta toplamı sıraya bağlıdır ve sonuç birebir aynı kalmalıdır.

Ağırlıkların büyüklüğü öncelik sırasını verir: `UYARI` her şeyden büyüktür (önce uyarısız çizelge), sonra kesin kural
birimleri (`KESIN`, `hsKural`…), güçlü tercihler, yıllık eşitlik dengeleri (kare sapma), en son ince ayarlar.

## Öteki listeler

| Liste                   | Dosya                                                                       | Yöntem                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Acil eczane             | `acil.ts`                                                                   | açgözlü başlangıç + yerel arama (yer değiştir / takas); ayda en fazla 1 Cumartesi / 1 Pazar için kaçınılmaz fazla eşleştirmeyle hesaplanır |
| Öğlen nöbeti            | `oglen.ts`                                                                  | haftalık; yerel arama; Cuma masa kuralı onay listesine (`onayMasa.ts`) bakar                                                               |
| Onay listesi masaları   | `onayMasa.ts`                                                               | her gün en az maliyetli atama (Macar yöntemi), yıl başından gün gün yürütülür                                                              |
| Servis hazırlama        | `servis/`                                                                   | gün gün dağıtım (`dagit.ts`), ay kaydı ve elle değişiklikler (`ay.ts`)                                                                     |
| Puantaj                 | `puantaj.ts`                                                                | çizelge + elle kodlar + acil nöbetleri → gün kodları, saatler, fazla mesai                                                                 |
| Elle düzenleme denetimi | `denetim.ts`, `degisim.ts`, `acilDegisim.ts`, `raporlar.ts` (`acilDenetle`) | gün penceresi, nöbet değişimi ve acil günü için hata / uyarı listesi                                                                       |

## Yeni bir kural eklemek

1. **Kesin mi, tercih mi?** Kesinse `nobet/kurallar.ts`'e (aramada hiç bozulmasın) ve gerekiyorsa `nobet/ilkYerlestirme.ts`'e;
   tercihse `sabitler.ts` `AGIRLIK`'a bir ağırlık ve `nobet/amac.ts`'e cezası.
2. **Esneyebilirse söyle:** kadro yetmediğinde esneyecekse `nobet/uyarilar.ts`'te günü işaretleyin / uyarı yazın; uyarı metnini
   `raporlar.ts` `uyariSiniflandir`'a tanıtın.
3. **Elle düzenleme:** aynı kuralı gün penceresi denetimine (`denetim.ts`) ekleyin.
4. **Metin:** `src/veri/kurallarMetni.ts`'e kuralı ve (ağırlık eklediyseniz) açıklamasını yazın; `test/kurallar-metni.test.js`
   her ağırlığın açıklaması olduğunu denetler.
5. **Bağımsız denetçi:** `test/denetim/bagimsiz.js`'e kuralı motordan bağımsız olarak yazın; `test/kural-denetimi.test.js`
   rastgele senaryolarda ihlalin ya işaretli ya da söylenmiş olduğunu denetler.
6. **Altın kayıt:** davranış bilerek değiştiyse `ALTIN_YAZ=1 npx vitest run test/altin` ile kaydı yenileyin; değişen satırlar
   `test/altin/ozet/` altında okunur biçimde görünür (git diff).

## Testler

| Test                                                                 | Ne güvence verir                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `test/altin*.test.js`                                                | tüm motor işlevlerinin zengin bir senaryodaki çıktısı birebir aynı (düzenlemede davranış değişmedi) |
| `test/kural-denetimi.test.js`                                        | yazılı kurallardan bağımsız denetçi: her kesin kural ihlali işaretli ya da söylenmiş                |
| `test/motor*.test.js`                                                | eski uygulamanın kayıtlı senaryolarından kötü değil                                                 |
| `test/tarama*.test.js`                                               | rastgele senaryolarda çökme yok, girdi değişmez, aynı girdi aynı sonuç                              |
| `test/kurallar*.test.js`, `test/acil.test.js`, `test/oglen.test.js`… | tek tek kurallar                                                                                    |
| `e2e/`                                                               | derlenmiş uygulama gerçek tarayıcıda: düğmeler, PDF / Excel içerikleri, telefon görünümü            |
