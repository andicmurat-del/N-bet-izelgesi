<script lang="ts">
  // Ortak klasör kipinde uygulamanın kapısı: giriş yapılana kadar giriş ekranı, sonra uygulama
  import { giris } from "../../veri/klasor/oturum.svelte";
  import KlasorGiris from "./KlasorGiris.svelte";
  import App from "../../App.svelte";
</script>

{#if giris.asama === "acik"}<App />{:else}<KlasorGiris />{/if}
