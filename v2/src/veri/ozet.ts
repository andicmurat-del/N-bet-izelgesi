// Ayın çizelgesinden kişi başı özet (nöbet, hazırlama, fazla mesai, hafta sonu). Durumdan bağımsız: çıktı paketi de kullanır.
import type { AyCizelgesi } from "./tipler";
import { haftaSonuMu } from "./tarih";

export interface KisiAyOzeti { nobet: number; hazirlama: number; fazlaMesai: number; haftaSonu: number }
export function ayOzeti(c: AyCizelgesi): Record<number, KisiAyOzeti> {
  const o: Record<number, KisiAyOzeti> = {};
  const al = (id: number) => (o[id] ??= { nobet: 0, hazirlama: 0, fazlaMesai: 0, haftaSonu: 0 });
  for (const g of c.days) {
    const hs = haftaSonuMu(c.year, c.month, g.day);
    for (const p of g.assigned) { const x = al(p.id); x.nobet++; x.fazlaMesai += g.fazlaMesai; if (hs) x.haftaSonu++; }
    for (const p of g.prep) { const x = al(p.id); x.hazirlama++; x.fazlaMesai += 8; }
  }
  return o;
}
