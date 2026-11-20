import Isci from "./isci.ts?worker&inline";
import { EK_DENEME, cizelgeOlustur, ekDenemeGerekli, enIyiDeneme, uyarisiz, type CizelgeSonucu } from "./index";
import { uyariSiniflandir } from "./raporlar";
import type { Gun, Veri } from "../veri/tipler";

export interface OlusturmaSonucu {
  days: Gun[] | null;
  warnings: string[];
}

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
/** Aramanın ekranda gösterilecek ilerlemesi: oran 0–1; ek: asıl arama uyarılı bitti, farklı başlangıçlarla aranıyor.
 *  Ek denemelerde: biten / toplam ek deneme ve şimdiye kadarki en iyi sonucun uyarı sayısı */
export interface Ilerleme {
  oran: number;
  ek: boolean;
  biten?: number;
  toplam?: number;
  enIyiUyari?: number;
}
/** Arama sürerken çağıranın elindeki denetim: dur() asıl arama bittiyse bekleyen ek denemeleri bırakıp şimdiye kadarki
 *  en iyi sonuçla bitirir (asıl arama bitmeden bir şey yapmaz) */
export interface AramaDenetimi {
  dur?: () => boolean;
}
export function arkaPlandaOlustur(
  veri: Veri,
  yil: number,
  ay: number,
  varyasyon = 0,
  ilerleme?: (i: Ilerleme) => void,
  denetim?: AramaDenetimi,
): Promise<OlusturmaSonucu> {
  // sayfada (işçi yoksa) hesap ekranı dondurur; ilerleme yalnız başta ve sonda bildirilir
  const sayfada = () =>
    new Promise<OlusturmaSonucu>((coz, reddet) =>
      setTimeout(() => {
        try {
          coz(cizelgeOlustur(veri, yil, ay, { varyasyon }));
        } catch (e) {
          reddet(e);
        }
      }, 30),
    );
  if (isciEngelli) return sayfada();
  return new Promise<OlusturmaSonucu>((coz, reddet) => {
    const N = EK_DENEME + 1,
      es = esZamanli();
    const sonuc: (CizelgeSonucu | undefined)[] = new Array(N).fill(undefined);
    // denemelerin ilerlemesi: asıl arama sürerken onun oranı; uyarılı bitince ek denemelerin ortalaması
    const oranlar: number[] = new Array(N).fill(0);
    const bildir = () => {
      if (!ilerleme || bitti) return;
      if (!sonuc[0]) ilerleme({ oran: oranlar[0], ek: false });
      else {
        const ek = oranlar.slice(1).map((o, i) => (sonuc[i + 1] ? 1 : o));
        const biten = sonuc.filter(Boolean) as CizelgeSonucu[];
        ilerleme({
          oran: ek.reduce((t, x) => t + x, 0) / Math.max(1, ek.length),
          ek: true,
          biten: biten.length - 1,
          toplam: N - 1,
          enIyiUyari: enIyiDeneme(biten).warnings.filter(w => uyariSiniflandir(w).seviye !== "bilgi").length,
        });
      }
    };
    const isciler = new Set<Worker>();
    let siradaki = 0,
      bitti = false,
      ekGerekli: boolean | null = null;
    const bitir = (f: () => void) => {
      if (bitti) return;
      bitti = true;
      isciler.forEach(i => i.terminate());
      isciler.clear();
      f();
    };
    if (denetim)
      denetim.dur = () => {
        const biten = sonuc.filter(Boolean) as CizelgeSonucu[];
        if (bitti || !biten.length) return false;
        bitir(() => coz(enIyiDeneme(biten)));
        return true;
      };
    // işçi yanıt vermeden hata verdiyse açılamamıştır (motor hataları mesajla gelir): hesap sayfada yapılır
    const engelli = () =>
      bitir(() => {
        isciEngelli = true;
        sayfada().then(coz, reddet);
      });
    const ilerle = () => {
      if (bitti) return;
      const ilk = sonuc[0];
      if (ilk && ekGerekli === null) ekGerekli = ekDenemeGerekli(ilk);
      if (ilk && !ekGerekli) return bitir(() => coz(ilk));
      // uyarısız bir deneme bulunduysa beklemeye gerek yok
      const temiz = ilk ? sonuc.find(r => r && uyarisiz(r)) : undefined;
      if (temiz) return bitir(() => coz(temiz));
      if (sonuc.every(r => r)) return bitir(() => coz(enIyiDeneme(sonuc as CizelgeSonucu[])));
      while (isciler.size < es && siradaki < N) baslat(siradaki++);
    };
    const baslat = (deneme: number) => {
      let isci: Worker;
      try {
        isci = new Isci();
      } catch {
        engelli();
        return;
      }
      isciler.add(isci);
      isci.onmessage = (e: MessageEvent) => {
        if (typeof e.data.ilerleme === "number") {
          oranlar[deneme] = e.data.ilerleme;
          bildir();
          return;
        }
        isci.terminate();
        isciler.delete(isci);
        if (!e.data.tamam) {
          bitir(() => reddet(new Error(e.data.hata)));
          return;
        }
        sonuc[deneme] = e.data.sonuc;
        oranlar[deneme] = 1;
        ilerle();
        bildir();
      };
      isci.onerror = e => {
        e.preventDefault();
        engelli();
      };
      isci.postMessage({ veri, yil, ay, varyasyon, deneme });
    };
    ilerle();
  });
}
