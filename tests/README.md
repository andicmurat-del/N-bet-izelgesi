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

- **rahat-kadro**: kadro yeterli; hiçbir ayda hata düzeyinde uyarı (kesin kural ihlali, eksik kişi…) çıkmamalı.
- **Diğer senaryolar** (uzun izin, ay ortasında başlayan, orta kadro, az kadro): kurallar her zaman tutamaz.
  Senaryo toplamında hata düzeyinde uyarı sayısı ve fazla mesai kesin kural aşımı kayıtlı sonuçtan kötüleşmemeli.

Uyarı kaçınılmaz senaryolarda küçük bir ağırlık değişikliği bile çizelgeyi aylara göre farklı yönlere
oynatabilir (bir ay iyileşir, öbürü kötüleşir). Test kırılırsa çıktıdaki "önce / şimdi" listesine bakın;
değişiklik bilerek yapıldıysa ve toplamda kabul edilebilirse `GUNCELLE=1 npm test` ile kaydı yenileyin.

Arama normalde birkaç saniyelik süre sınırıyla da durur; testlerde sayfa saati durdurulur, arama yalnız
deneme sayısıyla biter. Bu yüzden sonuçlar her makinede aynıdır (uygulamadaki çizelge yavaş bir
bilgisayarda biraz farklı çıkabilir).

Ağırlıkların hepsi `index.html` içindeki `AGIRLIK` tablosundadır.
