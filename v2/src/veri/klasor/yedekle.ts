// Yedek klasörü: ortak klasördeki kasa ve kayıtlar her gün bir kez başka bir klasöre (USB bellek, başka bir ağ klasörü)
// kopyalanır: "eczane-yedek-<yıl-ay-gün>". Dosyalar şifreli kopyalanır (yedeği açmak için de kullanıcı adı ve şifre
// gerekir). Son YEDEK_TUT gün tutulur. Geri dönmek için yedek klasörü programda "ortak klasör" olarak açılabilir ya da
// içindekiler ortak klasöre kopyalanır.
import type { Klasor } from "./dosya";

export const YEDEK_TUT = 30;
const ONEK = "eczane-yedek-",
  TAMAM = "tamam.json";
export const gunAnahtari = (t: Date) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

/** kopyalanmayanlar: kilitler, yarım dosyalar, oda (şu an kim açık) */
const atla = (yol: string) => /\.(lock|tmp)$/.test(yol) || yol === "veri/oda" || yol.startsWith("veri/oda/");

async function dosyalar(k: Klasor, alt: string): Promise<string[]> {
  const l: string[] = [];
  for (const x of await k.listele(alt)) {
    const y = alt ? `${alt}/${x.ad}` : x.ad;
    if (atla(y)) continue;
    if (x.klasor) l.push(...(await dosyalar(k, y)));
    else l.push(y);
  }
  return l;
}

export interface YedekBilgisi {
  gun: string;
  z: number;
  dosya: number;
}
/** hedefteki yedekler (yeniden eskiye) */
export async function yedekler(hedef: Klasor): Promise<YedekBilgisi[]> {
  const l: YedekBilgisi[] = [];
  for (const x of await hedef.listele(""))
    if (x.klasor && x.ad.startsWith(ONEK)) {
      try {
        const t = JSON.parse((await hedef.oku(`${x.ad}/${TAMAM}`)) || "null");
        if (t) l.push({ gun: x.ad.slice(ONEK.length), z: Number(t.z) || 0, dosya: Number(t.dosya) || 0 });
      } catch {
        /* yarım kalmış yedek */
      }
    }
  return l.sort((a, b) => (a.gun < b.gun ? 1 : -1));
}

/** Bugünün yedeği yoksa alır (zorla: yine de alır); eskileri siler. Alındıysa bilgisini, gerekmediyse null döner. */
export async function klasoruYedekle(
  kaynak: Klasor,
  hedef: Klasor,
  o: { simdi?: Date; zorla?: boolean } = {},
): Promise<YedekBilgisi | null> {
  const simdi = o.simdi ?? new Date(),
    gun = gunAnahtari(simdi),
    ad = ONEK + gun;
  if (!o.zorla && (await hedef.bilgi(`${ad}/${TAMAM}`))) return null;
  if (!(await kaynak.bilgi("kasa.json"))) throw new Error("Ortak klasörde kasa yok: yedeklenecek bir şey yok.");
  const l = await dosyalar(kaynak, "");
  let n = 0;
  for (const y of l) {
    const m = await kaynak.oku(y);
    if (m === null) continue;
    await hedef.yaz(`${ad}/${y}`, m);
    n++;
  }
  const b: YedekBilgisi = { gun, z: simdi.getTime(), dosya: n };
  await hedef.yaz(`${ad}/${TAMAM}`, JSON.stringify(b));
  const sinir = gunAnahtari(new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() - YEDEK_TUT + 1));
  for (const x of await hedef.listele(""))
    if (x.klasor && x.ad.startsWith(ONEK) && /^\d{4}-\d{2}-\d{2}$/.test(x.ad.slice(ONEK.length)) && x.ad.slice(ONEK.length) < sinir)
      await hedef.silKlasor(x.ad);
  return b;
}
