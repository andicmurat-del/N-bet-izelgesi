# Senaryo testleri

Çizelge oluşturucuyu başsız bir tarayıcıda çalıştırır: her senaryoda personel listesi kurulur,
aylar sırayla oluşturulur ve sonuçlar `beklenen.json` ile karşılaştırılır.

```bash
npm ci
npx playwright install chromium
npm test                 # kurallar + kayıtlı sonuçla karşılaştırma
SIKI=1 npm test          # çizelgeler birebir aynı olmalı (davranışı değiştirmeyen düzenlemelerden sonra)
GUNCELLE=1 npm test      # bilerek yapılan bir değişiklikten sonra beklenen.json'u yeniler
```

Neyi denetler:

- **Her senaryo, her ay**: çizelge gerçekten oluşmalı (her günde 2 nöbetçi), sayfada JavaScript hatası
  çıkmamalı, uyarılar okunabilmeli. Oluşturma sessizce başarısız olursa test kırmızı yanar.
- **rahat-kadro**: kadro yeterli; hiçbir ayda hata düzeyinde uyarı (kesin kural ihlali, eksik kişi…) çıkmamalı,
  nöbet sayısı farkı en fazla 2, hazırlama farkı en fazla 1 olmalı.
- **uzun-izin / ay-ortasi-baslayan**: izinli günlerde ve işe başlamadan önce görev yazılmamalı.
- **Diğer senaryolar** (orta kadro, az kadro ve yukarıdakiler): kurallar her zaman tutamaz. Kayıtlı sonuca göre
  yeni bir hata türü çıkmamalı; senaryo toplamında hata sayısı, fazla mesai aşımı, nöbet ve hazırlama farkı
  artmamalı. Çizelge kayıtlıdan farklıysa test geçse de çıktıda "davranış değişti" notu görünür.

Uyarı kaçınılmaz senaryolarda küçük bir ağırlık değişikliği bile çizelgeyi aylara göre farklı yönlere
oynatabilir (bir ay iyileşir, öbürü kötüleşir). Test kırılırsa çıktıdaki "önce / şimdi" listesine bakın;
değişiklik bilerek yapıldıysa ve toplamda kabul edilebilirse `GUNCELLE=1 npm test` ile kaydı yenileyin.
Bir senaryo hata verirse `GUNCELLE=1` kaydı yazmaz (eksik bir kayıt oluşmasın).

Arama normalde birkaç saniyelik süre sınırıyla da durur; testlerde sayfa saati durdurulur, arama yalnız
deneme sayısıyla biter. Bu yüzden sonuçlar her makinede aynıdır (uygulamadaki çizelge yavaş bir
bilgisayarda biraz farklı çıkabilir).

Ağırlıkların hepsi `index.html` içindeki `AGIRLIK` tablosundadır.
