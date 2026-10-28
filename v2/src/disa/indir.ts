// Dosya kaydetme: artifact içinde tarayıcı indirme bağlantıları çalışmaz; claude.ai'nin "downloads" yeteneği kullanılır.
// Artifact dışında (geliştirme sırasında) normal indirme bağlantısına düşer.

type Indirme = { save(o: { filename: string; data: Blob | string }): Promise<void> };
declare global { interface Window { claude?: { use(ad: string): Promise<unknown> } } }

let yetenek: Promise<Indirme | null> | null = null;
function indirmeYetenegi(): Promise<Indirme | null> {
  if (!yetenek) yetenek = window.claude ? (window.claude.use("downloads") as Promise<Indirme | null>).catch(() => null) : Promise.resolve(null);
  return yetenek;
}

/** true: kaydedildi, false: kullanıcı vazgeçti */
export async function dosyaKaydet(dosyaAdi: string, veri: Blob | string, tur: string): Promise<boolean> {
  const d = await indirmeYetenegi();
  if (d) {
    try { await d.save({ filename: dosyaAdi, data: veri }); return true; }
    catch (e: any) { if (e?.code === "declined") return false; throw e; }
  }
  const blob = veri instanceof Blob ? veri : new Blob([veri], { type: tur });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = dosyaAdi;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
