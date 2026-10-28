import Isci from "./isci.ts?worker&inline";
import type { Gun, Veri } from "../veri/tipler";

export interface OlusturmaSonucu { days: Gun[] | null; warnings: string[] }

/** Ayın çizelgesini arka planda oluşturur. veri düz bir kopya olmalı ($state.snapshot). */
export function arkaPlandaOlustur(veri: Veri, yil: number, ay: number, varyasyon = 0): Promise<OlusturmaSonucu> {
  return new Promise((coz, reddet) => {
    const isci = new Isci();
    isci.onmessage = (e: MessageEvent) => {
      isci.terminate();
      if (e.data.tamam) coz(e.data.sonuc);
      else reddet(new Error(e.data.hata));
    };
    isci.onerror = e => { isci.terminate(); reddet(new Error(e.message || "Çizelge oluşturulamadı.")); };
    isci.postMessage({ veri, yil, ay, varyasyon });
  });
}
