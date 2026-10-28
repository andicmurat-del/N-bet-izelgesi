// Uygulamanın kayıtlı verisi. Alan adları motorla (src/motor) ortaktır; motor bu yapıyı olduğu gibi okur.

export type Rol = "eczaci" | "teknisyen" | "destek" | "nobetci" | "servis";

export interface Kisi {
  id: number;
  name: string;
  role: Rol;
  /** işe başlama tarihi, YYYY-AA-GG */
  baslangic?: string;
  /** ayrılış tarihi (son çalışma günü), YYYY-AA-GG */
  bitis?: string;
}

/** Kişinin bir güne işaretlenen tercihi ya da izni */
export type Tercih = "izinli" | "want" | "avoid" | "esVar" | "esYok";

export interface Gorevli { id: number; name: string; role: Rol }

export interface Gun {
  day: number;
  tatil: boolean;
  conflict: boolean;
  fazlaMesai: number;
  assigned: Gorevli[];
  prep: Gorevli[];
  /** elle düzenlendi: yeniden oluşturmada korunur */
  locked: boolean;
}

export interface Onay { zaman: number; kim: string }

export interface AyCizelgesi {
  year: number;
  month: number;
  days: Gun[];
  /** oluşturma sırasında motorun verdiği uyarı metinleri */
  uyarilar: string[];
  olusturma: number;
  onay?: Onay;
}

export interface Ayarlar {
  /** iki nöbet arasında önerilen en az gün */
  minAra: number;
  /** destek personeli başına aylık hazırlama */
  destekAylik: number;
  /** hazırlama eşitliği ile fazla mesai saati çakışırsa öncelik: 1 hazırlama, 2 saat */
  cakismaOncelik: 1 | 2;
  /** arife günü normal mesai saati */
  arifeSaat: number;
}

/** Puantajda elle yazılan gün kodu */
export type PuantajKodu = "M" | "N" | "H" | "NI" | "YI" | "R" | "DI" | "B";

export interface Veri {
  surum: 1;
  kurum: { ad: string; onaylayan: string };
  staff: Kisi[];
  /** "kisiId-yil-ay-gun" (ay 0'dan) → tercih */
  prefs: Record<string, Tercih>;
  /** "yil-ay-gun" → resmi tatil */
  manualTatil: Record<string, true>;
  /** "yil-ay-gun" → arife (yarım gün) */
  arife: Record<string, true>;
  settings: Ayarlar;
  /** "yil-ay" → ayın çizelgesi */
  schedules: Record<string, AyCizelgesi>;
  /** "yil-ay" → kişi id → gün → elle yazılan puantaj kodu (çizelgeden gelen kodun yerine geçer) */
  puantaj: Record<string, Record<string, Record<string, PuantajKodu>>>;
  /** "yil-ay" → gün → acil serviste nöbetçi kişi id'leri (en çok 2); puantajda nöbet (24 saat) sayılır */
  acil: Record<string, Record<string, number[]>>;
  /** puantajdaki nöbet değişimleri ve izin/rapor nedeniyle yerine geçmeler (geri alınabilsin diye önceki kodlarla) */
  degisimler: Degisim[];
  /** servis hazırlama ayarları: servis adına göre zorluk/hasta/çok günlük/hazırlanıyor; elle eklenen servisler */
  servisAyar: ServisAyar;
  /** "yil-ay" → servis hazırlama dağıtımı (motorun ay kaydı; gün gün kişiler ve servisleri, elle değişiklikler) */
  servisKayit: Record<string, ServisAyKaydi>;
  /** örnek kadroyla deneniyor: ekranda belirtilir, tek düğmeyle silinir */
  ornek?: true;
}

/** Puantajda bir günün görevi bir kişiden ötekine geçti (yerine tutma ya da takasın bir yarısı) */
export interface Degisim {
  id: number;
  zaman: number;
  y: number; m: number; gun: number;
  /** görevden çıkan ve yerine giren */
  cik: number; yer: number;
  cikAd: string; yerAd: string;
  /** değişimden önce puantajda elle yazılı kod (yoksa null): geri almada geri yazılır */
  cikOnce: PuantajKodu | null; yerOnce: PuantajKodu | null;
  cikYeni: PuantajKodu; yerYeni: "N" | "H";
  gorev: "N" | "H";
  /** karşılıklı takasın iki yarısı aynı grupta */
  grup?: string;
  /** izin/rapor nedeniyle değişim çizelgeye de işlendi (geri alınınca çizelgeden de geri alınır) */
  zorunlu?: true;
  sebep?: PuantajKodu;
  not?: string;
}

export interface ServisAyar {
  svc: Record<string, { z: number; h: number; multi: boolean; on: boolean }>;
  ekstra: { name: string; z: number; h: number; multi: boolean }[];
}
/** Bir günün servis dağıtımı: k çalışan teknikerler, n çok günlük servis gün sayısı, a servis → kişi */
export interface ServisGunKaydi {
  k: number[]; n: number; i: string; a: Record<string, number>;
  w: Record<string, number>; l: Record<string, number>; yb: Record<string, number>;
  t: { w: number; l: number; y: number }; z: number; sk?: number; bayat?: number;
}
export interface ServisAyKaydi {
  gun: Record<string, ServisGunKaydi>;
  /** o gün dağıtıma elle katılan/çıkarılan kişiler */
  elle: Record<string, Record<string, boolean>>;
  /** çok günlük servislerin gün sayısı elle değiştirildiyse */
  gunElle: Record<string, number>;
  /** "yeniden karıştır" sayacı */
  sk: Record<string, number>;
  ad: Record<string, string>;
  /** elle atanan servisler: gün → servis → kişi */
  ata: Record<string, Record<string, number>>;
}

export const ROL_AD: Record<Rol, string> = {
  eczaci: "Eczacı",
  teknisyen: "Tekniker",
  destek: "Destek personeli",
  nobetci: "Dışarıdan nöbetçi eczacı",
  servis: "Acil servis eczacısı",
};

export const ROL_ACIKLAMA: Record<Rol, string> = {
  eczaci: "Nöbet ve hazırlama tutar; her gün en az bir eczacı nöbetçidir.",
  teknisyen: "Nöbet ve hazırlama tutar.",
  destek: "Nöbet tutmaz; tatil günlerinde ikinci hazırlama görevini alır.",
  nobetci: "Kurum dışından nöbete gelen eczacı; eczacı yerine sayılır.",
  servis: "Eczane nöbetine yazılmaz; acil servis nöbetleri ayrı çizelgede elle girilir. Hafta içi normal mesai yapar.",
};

export const TERCIH_AD: Record<Tercih, string> = {
  izinli: "İzinli",
  want: "İstiyor",
  avoid: "İstemiyor",
  esVar: "Eş durumu: nöbetçi olsun",
  esYok: "Eş durumu: nöbetçi olmasın",
};

export const TERCIH_ACIKLAMA: Record<Tercih, string> = {
  izinli: "O gün görev yazılmaz; izin arasındaki hafta sonu da izin sayılır.",
  want: "Eşitlik bozulmuyorsa o güne nöbet yazılır.",
  avoid: "Mümkünse o güne nöbet yazılmaz; yazılırsa uyarı çıkar.",
  esVar: "Kişi o gün mutlaka nöbetçi yazılır.",
  esYok: "Kişi o gün kesinlikle nöbetçi yazılmaz.",
};
