<script lang="ts">
  // Öğlen Nöbet Listesi > kurallar tablosu ve eşitlik ilkesi (açıklama).
  import Ikon from "../ortak/Ikon.svelte";
  let { git, gerek }: { git: (ad: "kisiler") => void; gerek: { hafta: { e: number; t: number }; cuma: { e: number; t: number } } } =
    $props();
</script>

<div class="alt-duzen">
  <section class="panel">
    <div class="panel-bas"><h2>Öğlen nöbeti kuralları</h2></div>
    <table class="tablo">
      <thead><tr><th>Gün</th><th class="sag">Eczacı</th><th class="sag">Tekniker</th></tr></thead>
      <tbody>
        <tr><td>Pazartesi – Perşembe</td><td class="sag">{gerek.hafta.e}</td><td class="sag">{gerek.hafta.t}</td></tr>
        <tr><td>Cuma</td><td class="sag">{gerek.cuma.e}</td><td class="sag">{gerek.cuma.t}</td></tr>
        <tr><td>Resmi tatil ve arife</td><td class="sag">—</td><td class="sag">—</td></tr>
      </tbody>
    </table>
  </section>
  <section class="panel">
    <div class="panel-bas"><h2>Eşitlik ilkesi</h2></div>
    <div class="panel-ic ilke">
      <p>
        O gün mesaide çalışanlardan yazılır. Herkese haftada bir (kişi yetmezse iki; haftada iki sırayla verilir, herkes bir kez almadan
        kimse yeniden almaz); yıl boyunca toplam sayı ve Cuma sayısı ayrı ayrı eşit dağıtılır. Eşitlik kişinin çalıştığı günlere göre
        hesaplanır: yıllık izin ve raporlu günler paydan düşer, izinden dönen fazladan yazılmaz. Mümkünse aynı kişi art arda iki Cuma
        yazılmaz. Teknikerde Pazartesi–Perşembe Cuma'dan muaf olanlara, Cuma öbürlerine yazılır (muaflar yetmezse öbürleri de); eşitlik iki
        grubun kendi içinde aranır. Eşitlik bozulmuyorsa o günün nöbetçisine yazılmaz. Cuma günü onay listesinde Masa 1, Masa 2, Masa 7 ve
        jokerlerden en az 2 eczacı masada kalır: bu gruptan öğlene en fazla (grup − 2) kişi, öğlen nöbetini en az tutanlar yazılır.
      </p>
      <p>
        Öğlen nöbeti haftalık oluşturulur ve onaylanır; haftanın onay listesi onaylanmadan yazılmaz (onay listesinin onayı kalkarsa o
        haftanın öğlen nöbeti de silinir). Bir hücreye dokunup kişileri elle değiştirebilirsiniz: yalnız değiştirdiğiniz yerler korunur,
        "Seçilmedi" yaptığınız yer boş kalır. Sonradan girilen izin ve raporlarda boşalan yerler kendiliğinden doldurulur.
      </p>
      <button class="baglanti" onclick={() => git("kisiler")}
        ><Ikon ad="kisiler" boyut={16} />Cuma'dan muaf olanları düzenle (Personel)</button
      >
    </div>
  </section>
</div>

<style>
  .alt-duzen {
    display: grid;
    grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
    gap: var(--b4);
    margin-top: var(--b4);
    align-items: start;
  }
  .ilke {
    display: grid;
    gap: var(--b2);
    font-size: var(--f-sm);
    color: var(--yazi-2);
  }
  .baglanti {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    background: none;
    padding: 0;
    color: var(--baglanti);
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
    justify-self: start;
    text-align: left;
  }
  @media (max-width: 960px) {
    .alt-duzen {
      grid-template-columns: 1fr;
    }
  }
</style>
