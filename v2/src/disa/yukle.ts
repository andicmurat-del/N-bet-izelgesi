// Çıktı paketini (PDF / Excel) ilk kullanımda yükler. Paket derlemede ayrı bir betik olarak hazırlanır ve sayfaya
// çalıştırılmayan bir betik bloğu (#cikti-paketi) olarak gömülür (vite.config.ts); ilk istekte çalıştırılır, sonra
// önbellekte kalır. Geliştirme sunucusunda kod içe aktarılan metinden gelir.
import kod from "virtual:cikti-paketi";

type Paket = typeof import("./paket");
let yukleniyor: Promise<Paket> | null = null;

export function ciktiPaketi(): Promise<Paket> {
  yukleniyor ??= new Promise<Paket>((tamam, hata) => {
    try {
      const s = document.createElement("script");
      s.textContent = document.getElementById("cikti-paketi")?.textContent || kod;
      document.head.appendChild(s);
      s.remove();
      const p = (globalThis as unknown as { __ciktiPaketi?: Paket }).__ciktiPaketi;
      if (p) tamam(p); else throw new Error("Çıktı modülü yüklenemedi.");
    } catch (e) { yukleniyor = null; hata(e); }
  });
  return yukleniyor;
}
