<script lang="ts">
  // Ayarlar > Yardım: çalışanlar için kısa "nasıl yapılır" rehberi (kuralların tam metni Kurallar sekmesinde).
  const BOLUMLER: { baslik: string; adimlar: string[] }[] = [
    { baslik: "İlk kurulum (bir kez)", adimlar: [
      "Ayarlar > Genel: kurum adını ve onaylayanın adını yazın; nöbet kurallarını gözden geçirin.",
      "Ayarlar > Personel: herkesi görevi ile ekleyin (eczacı, tekniker, kemoterapi eczacısı, destek, acil servis personeli). İşe yeni başlayan ya da ayrılanın tarihini girin; ayrılanı silmeyin, ayrılış tarihi verin.",
      "Acil eczanede nöbet tutan eczacıda \"Acil eczane\" anahtarını, Cuma öğlen nöbeti tutmayanda \"Cuma'dan muaf\" anahtarını açın.",
    ] },
    { baslik: "Her ay: günlük eczane nöbet listesi", adimlar: [
      "Günlük Eczane > İzinler: yıllık izinleri, nöbet isteklerini (+ / −) ve eş durumlarını işaretleyin; Resmi tatil ve arife sekmesinde bayramları işaretleyin.",
      "Nöbet Listesi > Çizelgeyi oluştur. Çubuk dolana kadar bekleyin; aynı bilgilerle her bilgisayarda aynı çizelge çıkar.",
      "Kural denetimi panelindeki kırmızı (hata) ve sarı (dikkat) satırlara bakın. Bir günü değiştirmek için güne dokunup \"Nöbet değişikliği yap\". Elle değiştirilen gün kilitlenir; yeniden oluşturmada korunur.",
      "Tatil gününde nöbetçi / hazırlama sayısını ve o günün fazla mesai saatlerini aynı pencereden değiştirebilirsiniz.",
      "Uygunsa Onayla; sonra PDF ya da Excel alın. Personele göndermek için \"Paylaş\" ile metin olarak kopyalayın (tüm liste ya da tek kişinin nöbetleri).",
    ] },
    { baslik: "Her ay: acil eczane nöbet listesi", adimlar: [
      "Acil Eczane > Nöbet Listesi > Acil nöbet listesini oluştur. Günlük eczane listesiyle çakışmaz (aynı / komşu günde eczane görevi olan acile yazılmaz).",
      "Sorunlu gün kalırsa güne dokunup yerine birini seçin; sonra Onayla ve PDF.",
    ] },
    { baslik: "Her hafta: onay listesi ve öğlen nöbeti", adimlar: [
      "Onay Listesi: haftayı seçin, masaları kontrol edin (iki kişinin yerini değiştirmek için ada dokunun), Haftayı onayla.",
      "Öğlen Nöbet Listesi: onay listesi onaylı haftada \"Haftanın öğlen nöbetini oluştur\", kontrol edin, Haftayı onayla, Haftalık PDF.",
      "Sonradan girilen izin / rapor öğlen nöbetini kendiliğinden onarır (bugünden sonraki günler).",
    ] },
    { baslik: "Ay içinde izin, rapor ya da nöbet değişimi", adimlar: [
      "Rapor / yıllık izin: Puantaj > İzin ve rapor: kişiyi, türü ve günleri seçin; görevli olduğu günler için önerilen kişi yerine yazılır (çizelgeye ve puantaja).",
      "İzinler sekmesinde, çizelge yapıldıktan sonra görevli olduğu güne izin işaretlerseniz, \"yerine kim yazılsın?\" listesi hemen çıkar; kişiyi seçip \"Yerine yaz\".",
      "İki kişinin kendi aralarındaki değişimi: Puantaj > Nöbet değişimi: devredilecek göreve dokunun, yerine tutacak kişiyi seçin (karşılıklı takas da olur). Değişim geçmişinden geri alınabilir.",
    ] },
    { baslik: "Günlük: hazırlama listesi", adimlar: [
      "Hazırlama Listesi: o gün çalışan teknikerlere servisler dengeli dağıtılır. Bir servisi başka teknikere vermek için servise dokunun; kişiyi o gün dağıtımdan çıkarmak için adının yanındaki anahtarı kapatın.",
      "PDF: tek sayfa, kişi başı kontrol listesi ya da servis → hazırlayan listesi.",
    ] },
    { baslik: "Güvenlik", adimlar: [
      "Yanlış bir değişikliği Ctrl+Z (telefonda üstteki geri ok) ile geri alın; onay bir geri alma noktasıdır.",
      "Haftada bir \"Yedek al\". Yedek, verilerinizin elinizdeki bağımsız kopyasıdır; başka bilgisayara da onunla taşınır.",
      "Yanlış yedek yüklediyseniz ya da tüm verileri yanlışlıkla sildiyseniz Ayarlar > Genel > \"Önceki verilere dön\".",
    ] },
  ];
</script>

<div class="yardim">
  {#each BOLUMLER as b, i}
    <section class="kart panel-blok">
      <h2><span class="no rakam">{i + 1}</span>{b.baslik}</h2>
      <ol>{#each b.adimlar as a}<li>{a}</li>{/each}</ol>
    </section>
  {/each}
</div>

<style>
  .yardim { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: var(--b4); align-items: start; }
  section { padding: var(--b4) var(--b5); }
  h2 { display: flex; align-items: center; gap: var(--b2); font-size: var(--f-md); margin: 0 0 var(--b3); color: var(--lacivert); }
  .no { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--vurgu-zemin); color: var(--vurgu); font-size: var(--f-xs); flex: none; }
  ol { margin: 0; padding-left: 1.2em; display: grid; gap: var(--b2); font-size: var(--f-sm); line-height: 1.5; }
  @media (max-width: 420px) { .yardim { grid-template-columns: 1fr; } section { padding: var(--b3); } }
</style>
