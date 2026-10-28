<script lang="ts">
  // Tek çizgi kalınlığında, 24'lük ızgarada simgeler. Her zaman ekran okuyucudan gizlidir; anlamı düğme metni ya da aria-label taşır.
  type Ad = "takvim" | "kisiler" | "izin" | "ayarlar" | "sol" | "sag" | "indir" | "kilit" | "uyari" | "tamam" | "yenile" | "kapat" | "arti" | "sil" | "duzenle" | "yukle" | "karisik" | "tablo" | "grafik" | "acil" | "liste" | "katman" | "diger";
  let { ad, boyut = 18 }: { ad: Ad; boyut?: number } = $props();
</script>

<svg viewBox="0 0 24 24" width={boyut} height={boyut} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if ad === "takvim"}<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />
  {:else if ad === "kisiler"}<circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.5" /><path d="M15.5 14.6a4.6 4.6 0 0 1 5 4.9" />
  {:else if ad === "izin"}<path d="M5 21V4" /><path d="M5 4.5h11l-2 3.5 2 3.5H5" />
  {:else if ad === "ayarlar"}<circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" /><circle cx="12" cy="12" r="7" />
  {:else if ad === "sol"}<path d="M14.5 6 8.5 12l6 6" />
  {:else if ad === "sag"}<path d="m9.5 6 6 6-6 6" />
  {:else if ad === "indir"}<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  {:else if ad === "yukle"}<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14" />
  {:else if ad === "kilit"}<rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
  {:else if ad === "uyari"}<path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 9.5v4.5M12 17v.01" />
  {:else if ad === "tamam"}<path d="m5 12.5 4.5 4.5L19 7.5" />
  {:else if ad === "yenile"}<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" />
  {:else if ad === "karisik"}<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.6M13 9.6C13.9 8 15 7 16.5 7H20" /><path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5l2.5 2.5-2.5 2.5" />
  {:else if ad === "kapat"}<path d="M6 6l12 12M18 6 6 18" />
  {:else if ad === "arti"}<path d="M12 5v14M5 12h14" />
  {:else if ad === "sil"}<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
  {:else if ad === "tablo"}<rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v15" />
  {:else if ad === "grafik"}<path d="M4 20h16" /><rect x="5.5" y="11" width="3" height="6.5" rx="0.8" /><rect x="10.5" y="6" width="3" height="11.5" rx="0.8" /><rect x="15.5" y="13.5" width="3" height="4" rx="0.8" />
  {:else if ad === "acil"}<path d="M2.5 12h4l2.2-5.5 4.3 11 2.2-5.5h6.3" />
  {:else if ad === "liste"}<path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.8" cy="6.5" r="1.2" /><circle cx="4.8" cy="12" r="1.2" /><circle cx="4.8" cy="17.5" r="1.2" />
  {:else if ad === "katman"}<path d="M12 3.5 21 8.5l-9 5-9-5z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 16.5 9 5 9-5" />
  {:else if ad === "diger"}<circle cx="5.5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18.5" cy="12" r="1.4" />
  {:else if ad === "duzenle"}<path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" />
  {/if}
</svg>
