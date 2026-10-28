// Dosya kaydetme: artifact içinde tarayıcı indirme bağlantıları çalışmaz; claude.ai'nin "downloads" yeteneği kullanılır.
// Artifact dışında (geliştirme sırasında) normal indirme bağlantısına düşer.

type Indirme = { save(o: { filename: string; data: Blob | string }): Promise<void> };
declare global { interface Window { claude?: { use(ad: string): Promise<unknown> } } }

/** Dosya kaydedilemedi; mesajı kullanıcıya gösterilir */
export class IndirmeHatasi extends Error {}
/** Hata kullanıcıya gösterilecek metne çevrilir; beklenmeyen hata konsola da yazılır (hata ayıklarken görünsün) */
export function hataMetni(e: unknown, yedek: string): string {
  if (e instanceof IndirmeHatasi) return e.message;
  console.error(e);
  return yedek;
}

let yetenek: Promise<Indirme | null> | null = null;
function indirmeYetenegi(): Promise<Indirme | null> {
  // yetenek alınamazsa saklanmaz: bir sonraki denemede yeniden istenir
  if (!yetenek) yetenek = window.claude ? (window.claude.use("downloads") as Promise<Indirme | null>).then(d => { if (!d) yetenek = null; return d; }, () => { yetenek = null; return null; }) : Promise.resolve(null);
  return yetenek;
}

/** true: kaydedildi, false: kullanıcı vazgeçti. Kaydedilemezse IndirmeHatasi fırlatır. */
export async function dosyaKaydet(dosyaAdi: string, veri: Blob | string, tur: string): Promise<boolean> {
  const d = await indirmeYetenegi();
  if (d) {
    try { await d.save({ filename: dosyaAdi, data: veri }); return true; }
    catch (e: any) { if (e?.code === "declined") return false; throw new IndirmeHatasi("Dosya kaydedilemedi: " + (e?.message ?? "indirme reddedildi") + "."); }
  }
  // claude.ai içinde indirme izni yoksa bağlantıyla indirme de çalışmaz: başarılı gibi görünmesin
  if (window.claude) throw new IndirmeHatasi("Dosya kaydedilemedi: bu sayfanın dosya indirme izni yok. Sayfanın İzinler menüsünden indirmeye izin verin.");
  const blob = veri instanceof Blob ? veri : new Blob([veri], { type: tur });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = dosyaAdi;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
