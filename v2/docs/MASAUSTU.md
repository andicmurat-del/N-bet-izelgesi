# Ortak klasör ve masaüstü uygulaması

İnternet ve sunucu olmadan, birden çok sorumlunun kendi kullanıcı adı ve şifresiyle çalışması için. Veriler hastanenin ortak
ağ klasöründe (ör. `\\sunucu\eczane`) şifreli durur; bilgisayarlarda kopya kalmaz.

## Kullanım

1. **Kurulum:** GitHub Actions > "Masaüstü uygulaması (Windows)" > son çalıştırma > Artifacts > `eczane-nobet-windows`.
   İçinde iki dosya var:
   - `Eczane Nobet_<sürüm>_x64-setup.exe`: kurulum (yönetici izni istemez, yalnız o Windows kullanıcısına kurar).
   - `eczane-nobet.exe`: kurulmadan çalışan tek dosya (USB bellekten de açılır).

   İkisi de Windows 10/11'de hazır gelen WebView2'yi kullanır (çok eski bir Windows 10'da yoksa kurulum dosyası internetten
   indirir; internetsiz bilgisayara Microsoft'un "WebView2 Runtime" çevrimdışı kurulumu önceden kurulmalı).
   Uygulama imzasız olduğu için Windows SmartScreen ilk açılışta "Windows bilgisayarınızı korudu" diyebilir: "Ek bilgi" >
   "Yine de çalıştır".

2. **Kasayı kurmak (bir kez, sahip):** uygulamayı açın > "Klasör seç" (ya da yolu yazın: `\\sunucu\eczane`) > klasör boşsa
   "Yeni kasa kurun": adınız, kullanıcı adınız, şifreniz. Kurtarma anahtarı bir kez gösterilir: yazdırın ya da dosyaya
   kaydedip kilitli bir yerde saklayın (ortak klasöre koymayın). Önceki verilerinizi aktarmak için eski programda
   "Yedek al", burada Ayarlar > Genel > "Yedekten yükle".
3. **Kullanıcı eklemek (sahip):** Ayarlar > Geçmiş > Kullanıcılar > "Kullanıcı ekle": ad, kullanıcı adı, rol, geçici şifre.
   Kişi kendi bilgisayarında uygulamayı açar, aynı klasörü seçer, geçici şifreyle girer ve kendi şifresini belirler.
4. **Her gün:** uygulamayı açın, kullanıcı adı ve şifreyle girin. 30 dakika işlem yapılmazsa oturum kapanır. Pencere
   kapatılırken bekleyen değişiklikler önce klasöre yazılır.
5. **Yedek klasörü (her bilgisayar kendisi için seçer):** Ayarlar > Geçmiş > "Yedek klasörü seç" (USB bellek ya da başka bir
   ağ klasörü). Ortak klasör her gün ilk girişte oraya kopyalanır (`eczane-yedek-<gün>`, son 30 gün; dosyalar şifreli).

Tarayıcıda da olur (Edge / Chrome): tek HTML dosyasını açın > Ayarlar > Geçmiş > "Ortak klasörde çalış". Tarayıcı her
açılışta klasör iznini yeniden sorar. Masaüstü uygulaması ile tarayıcı aynı klasörü birlikte kullanabilir.

## Roller

- **Sorumlu:** çizelge, izin, puantaj, acil / öğlen / onay listeleri, gün notları.
- **Baş sorumlu:** ayrıca personel, ayarlar, kurum bilgileri, servis listesi; yedekten yükleme, kopyaya dönme.
- **Sahip:** hepsi; ayrıca kullanıcı ekler, rol değiştirir, şifre yeniler, kullanıcı kaldırır, kurtarma anahtarını yeniler.
  Birden çok sahip olabilir; en az bir sahip kalmalı.

## Nasıl çalışır (`src/veri/klasor/`)

- **Kasa (`kasa.ts`, klasörde `kasa.json`):** kullanıcılar, roller, her kullanıcının açık anahtarları (ECDH P-256 ve ECDSA
  P-256) ve her kullanıcıya sarılmış veri anahtarı. Şifre saklanmaz: şifreden PBKDF2-SHA256 (600 000 tekrar) ile türetilen
  anahtar, kişinin gizli anahtarlarını açar; onlar da kendisine sarılmış veri anahtarını. Kullanıcı listesini ve sarılmış
  anahtarları kasanın imza anahtarı imzalar; bu anahtar yalnız sahiplere (ve kurtarma anahtarına) açıktır. Her bilgisayar
  kasanın imza anahtarını ve gördüğü son sürümü hatırlar: kasa başka bir kasayla ya da eski bir kopyayla değiştirilirse
  açılmaz (yedekten dönülüyorsa kullanıcı onayıyla açılır).
- **Kayıtlar (`belgeler.ts`, klasörde `veri/…/*.nbk`):** claude.ai veritabanıyla aynı arayüz; eşitleme, birleştirme,
  değişiklik geçmişi ve günlük kopyalar (`bulut.svelte.ts`, `sunucuGecmis.svelte.ts`, `sunucuKopya.ts`) olduğu gibi çalışır.
  Her kayıt AES-GCM 256 ile şifreli (dosyanın yolu da doğrulanır), içinde yazanın kimliği ve ECDSA imzası vardır. Okurken
  imza ve yazanın yetkisi denetlenir (sunucudaki veritabanı kurallarının yerine): personel / ayar kaydını yalnız sahip ve
  baş sorumlu, değişiklik geçmişini yalnız kişinin kendisi yazabilir. Geçmeyen kayıt kullanılmaz, nedeni gösterilir.
- **Kullanıcı kaldırma:** girişi kapanır, açık oturumu birkaç saniyede kapanır, veri anahtarı yenilenir (yeni nesil yalnız
  kalanlara sarılır); kayıtlar arkadan yeni anahtarla yeniden şifrelenir ve kaldırılan kişinin yazdığı kayıtlar sahibin
  imzasıyla yenilenir (`belgeleriYenile`; değişiklik geçmişinde kişinin kendi imzası kalır). Şifre sıfırlama ve
  baş sorumluluktan çıkarma da aynı bakımla.
- **Kilit:** yazımdan önce kısa süreli kilit dosyası (`veri/nobet/kilit.lock`); masaüstünde tek adımda, yarışsız oluşturulur.
- **Bu bilgisayarda:** veriler yalnız bellekte (`src/veri/saklama.ts`); tarayıcı kaydına yalnız klasörün yolu, son kullanıcı
  adı ve kasanın parmak izi yazılır.
- **Masaüstü (`masaustu/`, Tauri 2):** program (`dist/index.html`) uygulamanın içine gömülüdür. Rust tarafı yalnız dosya
  işlerini yapar (`src/main.rs`): yalnız seçilen klasörlerde, yol parçaları harf / rakam / `-_.` ile sınırlı.

## Sınırlar (bilerek)

- Şifreleme verileri okumayı engeller; klasöre yazma izni olan biri dosyaları silebilir ya da bozabilir. Bu yüzden yedek
  klasörü ve klasörün Windows paylaşım izinleri önemlidir: görevden ayrılanı programdan kaldırın ve paylaşım izninden çıkarın.
- Yetki denetimi her bilgisayarda programın içindedir (sunucu yok). Programı atlayıp kendi anahtarıyla kural dışı kayıt
  yazan sorumlunun kaydı öteki bilgisayarlarda kullanılmaz; ama sahip yetkisi kaldırılmış biri, eski kasa imza anahtarını
  saklamışsa kullanıcı listesini bozabilir (verileri yine açamaz). Bu durumda klasörü yedekten geri koyun.
- Yeni bir bilgisayar kasayı ilk açtığında tanır (o ana kadarki sürümü bilmez); eski bir kasa kopyasına karşı koruma
  kasayı daha önce açmış bilgisayarlardadır.
- Kurtarma anahtarı da kaybolur ve bütün sahiplerin şifresi unutulursa veriler açılamaz.
- Üst şeritteki "Yedek al" (JSON yedek dosyası) ile PDF / Excel çıktıları şifresizdir: kaydedildikleri yerde korunmaları
  gerekir. Şifreli kopya için yedek klasörünü kullanın.

## Geliştirme

```
npm run masaustu   # vite build + tauri build (Windows'ta: masaustu/target/release/eczane-nobet.exe ve bundle/nsis)
npx vitest run test/klasor.test.js          # kasa, şifreleme, kurallar, kaldırma, bakım, oda
npx playwright test e2e/klasor.spec.ts      # ekranda: kurulum, aktarma, kullanıcı ekleme, iki oturum, kaldırma (Chromium)
```

Windows derlemesi GitHub Actions'ta (`.github/workflows/masaustu.yml`) her `v2/` değişikliğinde yapılır.
