import Isci from "./isci.ts?worker&inline";
import { cizelgeOlustur } from "./index";
import type { Gun, Veri } from "../veri/tipler";

export interface OlusturmaSonucu { days: Gun[] | null; warnings: string[] }

// Bazı gömülü sayfalar (claude.ai artifact görünümü gibi) arka plan işçisini engeller; bir kez engellenince bir daha denenmez.
let isciEngelli = false;

/** İşçide bir hesap: açılamazsa (engelli sayfa) aynı hesap sayfada yapılır. */
function isciyle<T>(mesaj: object, sayfada: () => T): Promise<T> {
  const yedek = () => new Promise<T>((coz, reddet) => setTimeout(() => { try { coz(sayfada()); } catch (e) { reddet(e); } }, 30));
  if (isciEngelli) return yedek();
  let isci: Worker;
  try { isci = new Isci(); } catch { isciEngelli = true; return yedek(); }
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
      yedek().then(coz, reddet);
    };
    isci.postMessage(mesaj);
  });
}

/** Ayın çizelgesini arka planda oluşturur. veri düz bir kopya olmalı (veriAnlik). */
export function arkaPlandaOlustur(veri: Veri, yil: number, ay: number, varyasyon = 0): Promise<OlusturmaSonucu> {
  return isciyle({ veri, yil, ay, varyasyon }, () => cizelgeOlustur(veri, yil, ay, { varyasyon }) as OlusturmaSonucu);
}

