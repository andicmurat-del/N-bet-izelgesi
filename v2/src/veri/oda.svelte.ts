// Şu an kim açık: sayfayı aynı anda açmış öteki sorumlular ve hangi ekranda oldukları (claude.ai "room" yeteneği).
// Hiçbir şey saklanmaz; kişinin claude.ai kimliğini platform verir (ad, kimlik.svelte.ts'te çözülür). İki kişi aynı
// ekranda, aynı ayda çalışıyorsa üst şeritte belirtilir (değişiklikleri birbirinin üzerine yazmasınlar diye).
import { adlariCoz, kimlikBaslat } from "./kimlik.svelte";

interface Es {
  peer: string;
  by: string | null;
  isMe: boolean;
  kind: string;
  presence: Readonly<Record<string, unknown>>;
}
interface Oda {
  presence(p: Record<string, unknown>): Promise<void>;
  onPeers(f: (d: { peers: readonly Es[] }) => void, h?: (e: unknown) => void): () => void;
}

export interface Konum {
  sayfa: string;
  alt: string;
  ay: string;
}
export const oda = $state({ digerleri: [] as { id: string | null; konum: Konum | null }[] });

let odaNs: Oda | null = null,
  son: Konum | null = null;
const konumOku = (p: Readonly<Record<string, unknown>>): Konum | null =>
  typeof p.sayfa === "string" && typeof p.alt === "string" && typeof p.ay === "string"
    ? { sayfa: p.sayfa.slice(0, 20), alt: p.alt.slice(0, 20), ay: p.ay.slice(0, 10) }
    : null;

export async function odaBaslat() {
  if (typeof window === "undefined" || !window.claude || odaNs) return;
  try {
    odaNs = (await window.claude.use("room")) as Oda | null;
  } catch {
    odaNs = null;
  }
  if (!odaNs) return;
  await kimlikBaslat();
  if (son) void odaNs.presence({ ...son }).catch(() => {});
  odaNs.onPeers(
    ({ peers }) => {
      // aynı kişinin birden çok sekmesi tek gösterilir; kendi sekmelerim gösterilmez
      const l = new Map<string, { id: string | null; konum: Konum | null }>();
      for (const p of peers) if (p.kind === "viewer" && !p.isMe) l.set(p.by ?? p.peer, { id: p.by, konum: konumOku(p.presence) });
      oda.digerleri = [...l.values()];
      void adlariCoz(oda.digerleri.map(x => x.id).filter((x): x is string => !!x));
    },
    () => {
      oda.digerleri = [];
    },
  );
}
/** bu sekmenin hangi ekranda olduğunu ötekilere bildirir */
export function konumBildir(k: Konum) {
  son = k;
  if (odaNs) void odaNs.presence({ ...k }).catch(() => {});
}
