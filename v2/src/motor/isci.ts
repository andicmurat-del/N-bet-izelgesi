// Çizelge araması birkaç saniye sürer; ekran donmasın diye ayrı iş parçacığında (Web Worker) çalışır.
import { cizelgeOlustur } from "./cizelge.js";

self.onmessage = (e: MessageEvent) => {
  const { veri, yil, ay, varyasyon } = e.data;
  try {
    const r = cizelgeOlustur(veri, yil, ay, { varyasyon });
    self.postMessage({ tamam: true, sonuc: r });
  } catch (err) {
    self.postMessage({ tamam: false, hata: String((err as Error)?.message || err) });
  }
};
