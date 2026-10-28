import Isci from "./isci.ts?worker&inline";
import { cizelgeOlustur } from "./cizelge.js";
import type { Gun, Veri } from "../veri/tipler";

export interface OlusturmaSonucu { days: Gun[] | null; warnings: string[] }

// Bazı gömülü sayfalar (claude.ai artifact görünümü gibi) arka plan işçisini engeller; bir kez engellenince bir daha denenmez.
let isciEngelli = false;

/** İşçi açılamazsa aynı hesap sayfanın kendisinde yapılır; bu sırada ekran birkaç saniye donabilir. */
function sayfadaOlustur(veri: Veri, yil: number, ay: number, varyasyon: number): Promise<OlusturmaSonucu> {
  return new Promise((coz, reddet) => setTimeout(() => {
    try { coz(cizelgeOlustur(veri, yil, ay, { varyasyon })); } catch (e) { reddet(e); }
  }, 30));   // "hazırlanıyor" yazısı ekrana çizilsin diye kısa bekleme
}

/** Ayın çizelgesini arka planda oluşturur. veri düz bir kopya olmalı ($state.snapshot). */
export function arkaPlandaOlustur(veri: Veri, yil: number, ay: number, varyasyon = 0): Promise<OlusturmaSonucu> {
  if (isciEngelli) return sayfadaOlustur(veri, yil, ay, varyasyon);
  let isci: Worker;
  try { isci = new Isci(); } catch { isciEngelli = true; return sayfadaOlustur(veri, yil, ay, varyasyon); }
  return new Promise((coz, reddet) => {
    isci.onmessage = (e: MessageEvent) => {
      isci.terminate();
      if (e.data.tamam) coz(e.data.sonuc);
      else reddet(new Error(e.data.hata));
    };
    // işçi yanıt vermeden hata verdiyse açılamamıştır (motor hataları yukarıdaki mesajla gelir)
    isci.onerror = e => {
      e.preventDefault();
      isci.terminate();
      isciEngelli = true;
      sayfadaOlustur(veri, yil, ay, varyasyon).then(coz, reddet);
    };
    isci.postMessage({ veri, yil, ay, varyasyon });
  });
}
