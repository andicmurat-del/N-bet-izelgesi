// Çizelge araması birkaç saniye sürer; ekran donmasın diye ayrı iş parçacığında (Web Worker) çalışır.
// deneme verilirse yalnız o arama denemesi yapılır (denemeler ayrı işçilerde aynı anda çalışır: istemci.ts).
import { cizelgeDenemesi, cizelgeOlustur } from "./index";

self.onmessage = (e: MessageEvent) => {
  const { veri, yil, ay, varyasyon, deneme } = e.data;
  // ilerleme ayrı iletiyle bildirilir (ekrandaki ilerleme çubuğu)
  const ilerleme = (_: number, oran: number) => self.postMessage({ ilerleme: oran });
  try {
    const r =
      deneme === undefined
        ? cizelgeOlustur(veri, yil, ay, { varyasyon, ilerleme })
        : cizelgeDenemesi(veri, yil, ay, deneme, { varyasyon, ilerleme });
    self.postMessage({ tamam: true, sonuc: r });
  } catch (err) {
    self.postMessage({ tamam: false, hata: String((err as Error)?.message || err) });
  }
};
