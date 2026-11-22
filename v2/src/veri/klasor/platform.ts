// Ortak klasör oturumunu, uygulamanın claude.ai'den beklediği yeteneklere çevirir: "db" (kayıtlar: belgeler.ts),
// "user" (kim giriş yaptı, rolü, öteki kişilerin adları: kasadan) ve "room" (şu an kim açık: klasördeki oda kayıtları).
import type { KlasorDb } from "./belgeler";
import type { Oturum } from "./kasa";
import { kimlikUret } from "./sifre";

export interface Platform {
  use(ad: string): Promise<unknown>;
}

/** oda kaydı bu kadar süre yenilenmezse kişi çıkmış sayılır; daha eskiler silinir */
const ODA_CANLI = 60_000,
  ODA_SIL = 10 * 60_000;

export function klasorPlatformu(o: Oturum, db: KlasorDb, ayar: { odaAraligi?: number } = {}): Platform & { kapat(): Promise<void> } {
  const kullanici = {
    me: async () => ({ id: o.id, name: o.ben.ad, isOwner: o.rol === "sahip", canEdit: o.rol === "duzenleyen" }),
    can: async (ad: string) => (ad === "data.write" ? true : null),
    profiles: async (ids: readonly string[]) => {
      const p: Record<string, { id: string; name: string; color: string; guest: boolean }> = {};
      for (const id of ids) {
        const k = o.kisi(id);
        if (k) p[id] = { id, name: k.ad + (k.durum === "kaldirildi" ? " (kaldırıldı)" : ""), color: "", guest: false };
      }
      return p;
    },
  };

  // oda: her oturum kendi kaydını yazar ("oda/<oturum>"), ötekiler yoklamayla okunur
  const oturumNo = kimlikUret(10),
    aralik = ayar.odaAraligi ?? 10_000;
  let son: Record<string, unknown> = {},
    zaman: ReturnType<typeof setInterval> | undefined;
  const yaz = () => db.doc(`oda/${oturumNo}`).set({ z: Date.now(), p: son });
  type Es = { peer: string; by: string | null; isMe: boolean; kind: string; presence: Record<string, unknown> };
  const oda = {
    async presence(p: Record<string, unknown>) {
      son = { ...p };
      await yaz();
      if (!zaman) zaman = setInterval(() => void yaz().catch(() => {}), Math.max(aralik, 15_000));
    },
    onPeers(f: (d: { peers: readonly Es[] }) => void, h?: (e: unknown) => void) {
      let durdu = false;
      const bak = async () => {
        if (durdu) return;
        try {
          const simdi = Date.now();
          const peers: Es[] = [];
          for (const { id, ic } of await db.liste("oda")) {
            const z = Number(ic.d.z) || 0;
            if (simdi - z > ODA_SIL)
              void db
                .doc(`oda/${id}`)
                .delete()
                .catch(() => {});
            if (simdi - z > ODA_CANLI) continue;
            const p = ic.d.p && typeof ic.d.p === "object" ? (ic.d.p as Record<string, unknown>) : {};
            peers.push({ peer: id, by: ic.k, isMe: ic.k === o.id, kind: "viewer", presence: p });
          }
          f({ peers });
        } catch (e) {
          h?.(e);
        }
      };
      void bak();
      const t = setInterval(() => void bak(), aralik);
      return () => {
        durdu = true;
        clearInterval(t);
      };
    },
  };
  return {
    use: async (ad: string) => (ad === "db" ? db : ad === "user" ? kullanici : ad === "room" ? oda : null),
    /** oturum kapanırken: oda kaydı silinir, yoklamalar durur */
    async kapat() {
      clearInterval(zaman);
      try {
        await db.doc(`oda/${oturumNo}`).delete();
      } catch {
        /* klasöre ulaşılamadı: kayıt bir dakikada eskir */
      }
      db.kapat();
    },
  };
}
