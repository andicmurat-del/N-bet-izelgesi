// Sunucudaki günlük kopyalar: günün ilk sunucu yazımından önce sunucudaki verinin o anki hâli (yani bir önceki günün
// sonu) "kopyalar/<gün>" altına saklanır; son KOPYA_GUN gün tutulur. Bütün sorumlular görür ve bir kopyaya dönebilir
// (dönüş de bir değişikliktir, geçmişe yazılır). Tarayıcıdaki günlük kopyalardan farkı: cihaz değişse, tarayıcı verisi
// silinse de durur.
import type { Parcalar } from "./bulutBicim";

interface Belge {
  exists: boolean;
  id: string;
  data(): Record<string, unknown> | undefined;
}
interface BelgeRef {
  get(): Promise<Belge>;
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
export interface KopyaDb {
  doc(yol: string): BelgeRef;
  collection(yol: string): { doc(id: string): BelgeRef; limit(n: number): { get(): Promise<{ docs: Belge[] }> } };
}

const KOK = "kopyalar";
export const SUNUCU_KOPYA_GUN = 7;
export const gunAnahtari = (t: Date) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

let alinanGun = "";
/** bugünün kopyası yoksa p'yi (sunucudaki, yazımdan önceki hâl) saklar; eski kopyaları siler. kim: claude.ai kimliği */
export async function gunlukSunucuKopyasi(db: KopyaDb, p: Parcalar, kim: string | null, simdi = new Date()): Promise<void> {
  const gun = gunAnahtari(simdi);
  if (alinanGun === gun) return;
  const ana = db.doc(`${KOK}/${gun}`);
  if (!(await ana.get()).exists) {
    const aylar = Object.keys(p.aylar);
    for (const k of aylar) await db.collection(`${KOK}/${gun}/aylar`).doc(k).set({ json: p.aylar[k] });
    // ana belge en son: varsa kopya tamdır
    await ana.set({ z: simdi.getTime(), json: p.ana, aylar, ...(kim ? { kim } : {}) });
  }
  alinanGun = gun;
  const sinir = gunAnahtari(new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() - SUNUCU_KOPYA_GUN + 1));
  for (const b of (await db.collection(KOK).limit(100).get()).docs) {
    if (!b.exists || b.id >= sinir) continue;
    const aylar = b.data()?.aylar;
    if (Array.isArray(aylar)) for (const k of aylar) await db.collection(`${KOK}/${b.id}/aylar`).doc(String(k)).delete();
    await db.doc(`${KOK}/${b.id}`).delete();
  }
}

export interface SunucuKopyasi {
  gun: string;
  z: number;
  kim: string | null;
  kb: number;
}
/** saklanan kopyalar, yeniden eskiye */
export async function sunucuKopyalari(db: KopyaDb): Promise<SunucuKopyasi[]> {
  const l: SunucuKopyasi[] = [];
  for (const b of (await db.collection(KOK).limit(100).get()).docs) {
    const d = b.data();
    if (!b.exists || !d || typeof d.json !== "string") continue;
    l.push({ gun: b.id, z: Number(d.z) || 0, kim: typeof d.kim === "string" ? d.kim : null, kb: Math.round(d.json.length / 1024) });
  }
  return l.sort((a, b) => (a.gun < b.gun ? 1 : -1));
}
/** kopyanın belgeleri (okunamazsa null) */
export async function sunucuKopyasiOku(db: KopyaDb, gun: string): Promise<Parcalar | null> {
  const a = await db.doc(`${KOK}/${gun}`).get();
  const d = a.data();
  if (!a.exists || !d || typeof d.json !== "string") return null;
  const aylar: Record<string, string> = {};
  for (const k of Array.isArray(d.aylar) ? d.aylar : []) {
    const b = await db.collection(`${KOK}/${gun}/aylar`).doc(String(k)).get();
    const j = b.data()?.json;
    if (!b.exists || typeof j !== "string") return null;
    aylar[String(k)] = j;
  }
  return { ana: d.json, aylar };
}
/** testler için */
export function sunucuKopyaSifirla() {
  alinanGun = "";
}
