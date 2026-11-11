import Isci from "./isci.ts?worker&inline";
import { EK_DENEME, cizelgeOlustur, ekDenemeGerekli, enIyiDeneme, uyarisiz, type CizelgeSonucu } from "./index";
import type { Gun, Veri } from "../veri/tipler";

export interface OlusturmaSonucu { days: Gun[] | null; warnings: string[] }

// Bazı gömülü sayfalar (claude.ai artifact görünümü gibi) arka plan işçisini engeller; bir kez engellenince bir daha denenmez.
let isciEngelli = false;

/** Aynı anda çalıştırılacak arama sayısı: çekirdek sayısı kadar (arama sürerken ekranda yalnız bekleme göstergesi döner);
 *  tek çekirdekte denemeler sırayla yapılır */
function esZamanli(): number {
  const c = typeof navigator !== "undefined" ? Number(navigator.hardwareConcurrency) || 2 : 2;
  return Math.max(1, Math.min(EK_DENEME + 1, c));
}

/**
 * Ayın çizelgesini arka planda oluşturur. veri düz bir kopya olmalı (veriAnlik).
 * Asıl arama ile uyarı kalırsa yapılacak ek aramalar (cizelgeOlustur'daki denemeler) ayrı işçilerde aynı anda başlar:
 * asıl arama uyarısız biterse ötekiler durdurulur; uyarı kaldıysa sonuçların en az uyarılısı seçilir (sırayla
 * aramadaki seçimle aynı kural). İşçi açılamazsa (engelli sayfa) hesap sayfada, sırayla yapılır.
 */
export function arkaPlandaOlustur(veri: Veri, yil: number, ay: number, varyasyon = 0): Promise<OlusturmaSonucu> {
  const sayfada = () => new Promise<OlusturmaSonucu>((coz, reddet) => setTimeout(() => { try { coz(cizelgeOlustur(veri, yil, ay, { varyasyon }) as OlusturmaSonucu); } catch (e) { reddet(e); } }, 30));
  if (isciEngelli) return sayfada();
  return new Promise<OlusturmaSonucu>((coz, reddet) => {
    const N = EK_DENEME + 1, es = esZamanli();
    const sonuc: (CizelgeSonucu | undefined)[] = new Array(N).fill(undefined);
    const isciler = new Set<Worker>();
    let siradaki = 0, bitti = false, ekGerekli: boolean | null = null;
    const bitir = (f: () => void) => { if (bitti) return; bitti = true; isciler.forEach(i => i.terminate()); isciler.clear(); f(); };
    // işçi yanıt vermeden hata verdiyse açılamamıştır (motor hataları mesajla gelir): hesap sayfada yapılır
    const engelli = () => bitir(() => { isciEngelli = true; sayfada().then(coz, reddet); });
    const ilerle = () => {
      if (bitti) return;
      const ilk = sonuc[0];
      if (ilk && ekGerekli === null) ekGerekli = ekDenemeGerekli(ilk);
      if (ilk && !ekGerekli) return bitir(() => coz(ilk as OlusturmaSonucu));
      // uyarısız bir deneme bulunduysa beklemeye gerek yok
      const temiz = ilk ? sonuc.find(r => r && uyarisiz(r)) : undefined;
      if (temiz) return bitir(() => coz(temiz as OlusturmaSonucu));
      if (sonuc.every(r => r)) return bitir(() => coz(enIyiDeneme(sonuc as CizelgeSonucu[]) as OlusturmaSonucu));
      while (isciler.size < es && siradaki < N) baslat(siradaki++);
    };
    const baslat = (deneme: number) => {
      let isci: Worker;
      try { isci = new Isci(); } catch { engelli(); return; }
      isciler.add(isci);
      isci.onmessage = (e: MessageEvent) => {
        isci.terminate(); isciler.delete(isci);
        if (!e.data.tamam) { bitir(() => reddet(new Error(e.data.hata))); return; }
        sonuc[deneme] = e.data.sonuc;
        ilerle();
      };
      isci.onerror = e => { e.preventDefault(); engelli(); };
      isci.postMessage({ veri, yil, ay, varyasyon, deneme });
    };
    ilerle();
  });
}
