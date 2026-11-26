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
  /** Cuma günleri öğlen nöbeti yazılmaz (eczacı, tekniker) */
  cumaMuaf?: true;
  /** eczacı ya da kemoterapi eczacısı: eczane nöbeti yerine acil eczane nöbeti tutar (görevi değişmez) */
  acilTutar?: true;
}

/** Kişinin bir güne işaretlenen tercihi ya da izni */
export type Tercih = "izinli" | "want" | "avoid" | "esVar" | "esYok";

/** öğlen nöbetinde elle belirlenen yerler: e / t elle yazılan eczacı ve teknikerler, be / bt elle boş bırakılan yer sayısı.
 *  Yeniden oluşturma ve otomatik onarım yalnız bu yerlere dokunmaz; günün geri kalanı yeniden yazılır. */
export interface OglenSabit {
  e: number[];
  t: number[];
  be?: number;
  bt?: number;
}
/** bir günün öğlen nöbetçileri; sabit: elle belirlenen yerler; elle: günün tamamı elle (eski kayıtlar), hiç değişmez */
export interface OglenGunu {
  e: number[];
  t: number[];
  elle?: true;
  sabit?: OglenSabit;
}

export interface Gorevli {
  id: number;
  name: string;
  role: Rol;
}

export interface Gun {
  day: number;
  tatil: boolean;
  conflict: boolean;
  fazlaMesai: number;
  assigned: Gorevli[];
  prep: Gorevli[];
  /** elle düzenlendi: yeniden oluşturmada korunur */
  locked: boolean;
  /** elle belirlenen nöbetçi sayısı ve nöbet fazla mesaisi (her gün), hazırlama sayısı ve saati (tatil günü); yoksa 2 / 2
   *  ve takvimden (nöbet 24 − o günün ve ertesi günün mesaisi, hazırlama 8 saat). Yalnız elle düzenlenen (kilitli) günde. */
  nobetSay?: number;
  hazSay?: number;
  fmNobet?: number;
  fmHaz?: number;
}
/** günün elle belirlenen düzeni (tatil günü) */
export type GunDuzeni = Pick<Gun, "nobetSay" | "hazSay" | "fmNobet" | "fmHaz">;

export interface Onay {
  zaman: number;
  /** kurumun onaylayanı (Ayarlar > Genel; çıktılarda) */
  kim: string;
  /** programda onaylayan: kullanıcı kimliği (ortak klasör kipinde; adı gösterimde çözülür) ya da bu cihazda yazılan ad */
  kimId?: string;
  kimAd?: string;
  /** yalnız çıktıya giderken: programda onaylayanın çözülmüş adı (saklanmaz) */
  onaylayanAd?: string;
}

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
  /** günlük eczane: iki nöbet arasında önerilen en az gün */
  minAra: number;
  /** acil eczane: iki acil nöbeti arasında önerilen en az gün */
  acilMinAra: number;
  /** destek personeli başına aylık hazırlama */
  destekAylik: number;
  /** arife günü normal mesai saati */
  arifeSaat: number;
  // ---- gelişmiş kurallar (Ayarlar > Gelişmiş kurallar; anlamları motor/sabitler.ts AYAR_VARSAYILAN'da) ----
  /** nöbet süresi, günlük normal mesai, hazırlama süresi (saat) */
  nobetSuresi: number;
  mesai: number;
  hazSaat: number;
  /** kişiye ayda en fazla Perşembe nöbeti (99: sınırsız) ve Cumartesi + Pazar nöbeti */
  maxThu: number;
  hsUst: number;
  /** Perşembe nöbetçisi aynı hafta sonu görev almaz; hafta sonu nöbeti olana aynı ay Cuma da yazılır */
  thuHaftaSonu: boolean;
  cumaEsles: boolean;
  /** Cumartesi hazırlaması + Pazar nöbeti aynı kişiye yazılabilir ve tercih edilir (hafta sonu tek kişide toplanır) */
  hsTopla: boolean;
  /** elle düzenlemede kişinin fazla mesaisi ortalamadan bu kadar saat saparsa uyarı */
  fmHedef: number;
  /** nöbet izni önce 08–20 (1) ya da 20–08 (2) diliminden düşülür */
  niDusum: number;
  /** acil kadrosu yetmezse art arda acil nöbeti yazılır (kapalıysa gün eksik kalır) */
  acilArdArda: boolean;
  /** öğlen nöbeti: Pazartesi–Perşembe ve Cuma eczacı / tekniker sayısı */
  oglenHE: number;
  oglenHT: number;
  oglenCE: number;
  oglenCT: number;
  /** resmi tatiller ve arifeler her yıl ilk açılışta kendiliğinden işaretlenir (veri/resmiTatiller.ts) */
  tatilOtomatik: boolean;
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
  /** "yil-ay" → elle düzenlenen acil nöbet günleri (otomatik oluşturma bu günlere dokunmaz) */
  acilElle: Record<string, Record<string, true>>;
  /** "yil-ay" → gün → öğlen nöbetçileri: e eczacılar, t teknikerler (kişi id'leri); elle: elle düzenlendi */
  oglen: Record<string, Record<string, OglenGunu>>;
  /** onaylanan listeler: acil "yil-ay" → ay; öğlen nöbeti ve onay listesi haftalık, haftanın Pazartesi'si "YYYY-AA-GG" →
   *  onay. Onaylı liste elle değiştirilemez, yeniden oluşturulmaz. Öğlen nöbeti, o haftanın onay listesi onaylanmadan
   *  oluşturulmaz; onay listesinin onayı kalkarsa haftanın öğlen nöbeti de silinir. */
  listeOnay: { acil: Record<string, Onay>; oglen: Record<string, Onay>; onay: Record<string, Onay> };
  /** puantajdaki nöbet değişimleri ve izin/rapor nedeniyle yerine geçmeler (geri alınabilsin diye önceki kodlarla) */
  degisimler: Degisim[];
  /** servis hazırlama ayarları: servis adına göre zorluk/hasta/çok günlük/hazırlanıyor; elle eklenen servisler */
  servisAyar: ServisAyar;
  /** "yil-ay" → servis hazırlama dağıtımı (motorun ay kaydı; gün gün kişiler ve servisleri, elle değişiklikler) */
  servisKayit: Record<string, ServisAyKaydi>;
  /** onay listesi masaları: elle değiştirilen gün ("YYYY-AA-GG") → kişi id → yer ("1"–"7", "J"); masalar her gün
   *  kendiliğinden dağıtılır (motor/onayMasa.ts) */
  onayMasa: { elle: Record<string, Record<string, string>> };
  /** resmi tatilleri kendiliğinden işaretlenmiş yıllar ("2027" → true): sonradan elle kaldırılan gün yeniden işaretlenmez */
  tatilYillari: Record<string, true>;
  /** gün notları: "yil-ay" → gün → notlar (sorumlular arası; onaylı ayda da yazılır, çıktılara girmez) */
  notlar: Record<string, Record<string, GunNotu[]>>;
}

/** Bir güne bırakılan not: yazan (kullanıcı kimliği ya da bu cihazda yazılan ad), zaman, metin */
export interface GunNotu {
  id: string;
  z: number;
  kimId?: string;
  kimAd?: string;
  metin: string;
}

/** Puantajda bir günün görevi bir kişiden ötekine geçti (yerine tutma ya da takasın bir yarısı) */
export interface Degisim {
  id: number;
  zaman: number;
  y: number;
  m: number;
  gun: number;
  /** görevden çıkan ve yerine giren */
  cik: number;
  yer: number;
  cikAd: string;
  yerAd: string;
  /** değişimden önce puantajda elle yazılı kod (yoksa null): geri almada geri yazılır */
  cikOnce: PuantajKodu | null;
  yerOnce: PuantajKodu | null;
  cikYeni: PuantajKodu;
  yerYeni: "N" | "H";
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
  k: number[];
  n: number;
  i: string;
  a: Record<string, number>;
  w: Record<string, number>;
  l: Record<string, number>;
  yb: Record<string, number>;
  t: { w: number; l: number; y: number };
  z: number;
  sk?: number;
  bayat?: number;
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
  nobetci: "Kemoterapi eczacısı",
  servis: "Acil servis personeli",
};

export const ROL_ACIKLAMA: Record<Rol, string> = {
  eczaci: "Nöbet ve hazırlama tutar; her gün en az bir eczacı nöbetçidir.",
  teknisyen: "Nöbet ve hazırlama tutar.",
  destek: "Nöbet tutmaz; tatil günlerinde ikinci hazırlama görevini alır.",
  nobetci:
    "Hafta içi mesai ve öğlen nöbeti yoktur; nöbetini günlük eczanede ya da acil eczanede tutar (Düzenle > Nöbet tuttuğu yer). Günlük eczanede eczacı yerine sayılır.",
  servis:
    "Günlük eczanede nöbet, hazırlama ve öğlen nöbeti tutmaz; nöbetleri Acil Eczane Nöbet Listesi'ne yazılır. Hafta içi normal mesai yapar.",
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
