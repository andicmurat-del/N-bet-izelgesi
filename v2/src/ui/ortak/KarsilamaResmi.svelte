<!-- Karşılama ekranı illüstrasyonu: takvim, kontrol listesi ve yapraklar. Renkler tema belirteçlerinden gelir (açık ve koyu temada uyumlu). Süs amaçlıdır. -->
<svg viewBox="0 0 320 240" role="presentation" aria-hidden="true" focusable="false">
  <ellipse cx="160" cy="214" rx="132" ry="10" fill="var(--tablo-bas)" />
  <circle cx="168" cy="108" r="92" fill="var(--hs-zemin)" />

  <!-- sol yapraklar -->
  <g fill="var(--acik-mavi)" opacity=".75">
    <path d="M34 190c-14-22-8-50 12-66 10 22 6 50-12 66z" />
    <path d="M52 198c-2-24 12-46 34-54 2 24-12 46-34 54z" opacity=".6" />
  </g>

  <!-- takvim -->
  <g>
    <rect x="62" y="48" width="142" height="148" rx="6" fill="var(--yuzey)" stroke="var(--cizgi)" stroke-width="2" />
    <path d="M62 54a6 6 0 0 1 6-6h130a6 6 0 0 1 6 6v26H62z" fill="var(--lacivert)" />
    <g stroke="var(--yuzey)" stroke-width="5" stroke-linecap="round">
      <path d="M92 40v16M122 40v16M152 40v16M182 40v16" />
    </g>
    <g fill="var(--tablo-bas)">
      {#each [0, 1, 2, 3] as satir}
        {#each [0, 1, 2, 3, 4] as sutun}
          <rect x={74 + sutun * 25} y={92 + satir * 24} width="17" height="15" rx="2" />
        {/each}
      {/each}
    </g>
    <!-- işaretli günler -->
    <rect x="99" y="92" width="17" height="15" rx="2" fill="var(--acik-mavi)" />
    <rect x="149" y="116" width="17" height="15" rx="2" fill="var(--lacivert)" />
    <rect x="74" y="140" width="17" height="15" rx="2" fill="var(--acik-mavi)" />
    <rect x="124" y="140" width="17" height="15" rx="2" fill="var(--altin)" />
    <rect x="174" y="164" width="17" height="15" rx="2" fill="var(--lacivert)" />
  </g>

  <!-- kontrol listesi -->
  <g>
    <rect x="196" y="70" width="86" height="126" rx="6" fill="var(--yuzey)" stroke="var(--cizgi)" stroke-width="2" />
    <rect x="222" y="62" width="34" height="14" rx="4" fill="var(--lacivert)" />
    {#each [0, 1, 2, 3] as i}
      <circle cx="214" cy={102 + i * 24} r="7" fill={i < 3 ? "var(--lacivert)" : "none"} stroke="var(--lacivert)" stroke-width="2" />
      {#if i < 3}<path d={`m210.5 ${102 + i * 24} 2.4 2.6 4.6-5.2`} fill="none" stroke="var(--yuzey)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />{/if}
      <rect x="228" y={99 + i * 24} width={i === 1 ? 34 : 42} height="6" rx="3" fill="var(--tablo-bas)" />
    {/each}
  </g>

  <!-- yapraklar, sağ -->
  <g fill="var(--acik-mavi)" opacity=".75">
    <path d="M296 186c10-22 4-46-12-60-8 22-4 44 12 60z" />
  </g>

  <!-- ilaç şişeleri -->
  <g>
    <rect x="40" y="168" width="26" height="34" rx="4" fill="var(--lacivert)" />
    <rect x="43" y="160" width="20" height="9" rx="2.5" fill="var(--acik-mavi)" />
    <rect x="46" y="177" width="14" height="12" rx="2" fill="var(--yuzey)" opacity=".92" />
    <rect x="70" y="178" width="22" height="24" rx="4" fill="var(--acik-mavi)" />
    <rect x="73" y="171" width="16" height="8" rx="2.5" fill="var(--lacivert)" />
  </g>

  <!-- süs noktaları -->
  <g fill="var(--altin)">
    <circle cx="240" cy="30" r="3" />
    <circle cx="48" cy="82" r="2.5" />
    <circle cx="292" cy="96" r="2" />
  </g>
</svg>

<style>
  svg { display: block; width: 100%; height: auto; }
</style>
