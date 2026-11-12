// Eczane Yönetim Programı'nın kuralları: Ayarlar > Kurallar sayfasında gösterilir, kopyalanır ya da .md olarak indirilir
// (başka bir yapay zekâya ya da yeni bir çalışana programın nasıl karar verdiğini anlatmak için). Ağırlık tabloları
// doğrudan motordaki sabitlerden üretilir; kural değişince bu metin de kendiliğinden güncel kalır. Bir ağırlık
// eklenirse açıklaması da buraya yazılmalıdır (test/kurallar-metni.test.js denetler).
import { AGIRLIK, AYAR_VARSAYILAN, FM_MAX_FARK, HAZ_SAYISI, HAFIF_IHLAL, IZIN_HAFTA_GUN } from "../motor/sabitler";
import { W as ACIL_W } from "../motor/acil";
import { W as OGLEN_W, OGLEN_GEREK } from "../motor/oglen";
import { AGIR as ONAY_AGIR } from "../motor/onayMasa";
import { W as SERVIS_W } from "../motor/servis/dagit";
import { ZOR_ESIK } from "../motor/servis/liste";
import type { Ayarlar } from "./tipler";

/** Günlük eczane nöbet çizelgesi ağırlıkları (AGIRLIK) */
export const NOBET_AGIRLIK_ACIKLAMA: Record<keyof typeof AGIRLIK, string> = {
  UYARI: "Uyarı çıkaran her durum; öbür tüm cezaların toplamından büyüktür (öncelik her zaman uyarısız çizelge).",
  IHLAL: "Kesin kural ihlali (izinli güne nöbet, art arda nöbet, boş hazırlama yeri…); 2 uyarı sayılır.",
  tekOnceUyari: "Hazırlama sırası (önce teknikerler) bozulursa; fazla mesai 8 saat kuralından önce gelir.",
  KESIN: "Genel kesin kural birimi: aylık nöbet sayısı farkı 2'yi aşan her nöbet; fazla mesai farkı 8 saati aşan her saat.",
  fmBant: "Fazla mesai: herkesi 8 saatlik tek aralığa sokmak için gereken toplam saat.",
  hzFark: "Aylık hazırlama farkı 1'i aşınca (fazla mesai 8 saat kuralından önce).",
  destekSayi: "Destek personeli ayda Ayarlar'daki sayı kadar hazırlama alır (her fark için).",
  tekOnce: "Hazırlama önce teknikerlere: eczacının yıllık hazırlaması teknikerinkini geçmez.",
  resmiYilToplam: "Yıllık resmi tatil görevi (nöbet + hazırlama) farkı 1'i aşınca.",
  gunYil: "Yıllık Perşembe / Cuma / Cumartesi / Pazar / resmi tatil nöbeti farkı 1'i aşınca.",
  hsKural: "Ayda en fazla 1 Cumartesi ve 1 Pazar nöbeti.",
  istemiyor: "\"İstemiyor\" işaretli güne nöbet ya da hazırlama.",
  cuCmtPaz: "Cuma + Cumartesi + Pazar nöbeti aynı ay aynı kişide.",
  ucluSonHaz: "Cuma + Cumartesi + Pazar nöbeti olan, kendi grubunda (eczacı / tekniker) hazırlamayı en son alır.",
  prepUst: "Eczacı / tekniker ayda en fazla 2 hazırlama.",
  grupHazFark: "Eczacılar kendi arasında, teknikerler kendi arasında aylık hazırlama farkı 1'i aşınca.",
  hsEnAz1: "Ayda en az 1 Cumartesi / Pazar nöbeti (uygun gün varsa).",
  nobetFark: "Aylık nöbet sayısı farkı 1'i aşınca.",
  hsUst: "Ayda Cumartesi / Pazar nöbeti üst sınırı aşınca.",
  thuHs: "Perşembe nöbeti tutana aynı hafta sonu nöbet (günlük tercih, ×3).",
  thuFazla: "Ayda Perşembe nöbeti sınırı (1) aşınca.",
  hsYil: "Yıllık Cumartesi / Pazar nöbeti dengesi (kare sapma).",
  nYil: "Yıllık nöbet sayısı dengesi (kare sapma).",
  prpYil: "Yıllık hazırlama dengesi, herkes birlikte (kare sapma).",
  prpGrup: "Yıllık hazırlama dengesi, eczacılar ve teknikerler kendi içinde (kare sapma).",
  prp2: "Ayda 1 hazırlama hedefi: 2. hazırlama.",
  cuYil: "Yıllık Cuma nöbeti dengesi (kare sapma).",
  peYil: "Yıllık Perşembe nöbeti dengesi (kare sapma).",
  cpYil: "Yıllık Cumartesi ve Pazar dengesi, ayrı ayrı (kare sapma).",
  resmi: "Resmi tatil nöbeti ve hazırlaması dengesi (kare sapma).",
  cumaEslesmeYok: "Hafta sonu nöbeti var, Cuma nöbeti yok.",
  devirPazar: "Önceki ay Pazar tutana bu ay yine Pazar.",
  devirPersembe: "Perşembe: önceki ay ile bu ay ikisi de 0 ya da ikisi de var.",
  cumaFazla: "Ayda 2. Cuma nöbeti.",
  devirCumartesi: "Önceki ay Cumartesi tutana bu ay yine Cumartesi.",
  cumaTek: "Cuma nöbeti var, hafta sonu nöbeti yok.",
  fmYil: "Yıllık fazla mesai saati dengesi (kare sapma).",
  nobetAy: "Aylık nöbet sayısı dengesi (kare sapma).",
  destekYil: "Destek personeli yıllık hazırlama dengesi (kare sapma).",
  haftaSonuIs: "Aylık hafta sonu nöbeti + hazırlama sayısı dengesi (kare sapma).",
  istiyor: "\"İstiyor\" işaretli güne nöbet (ödül; günlük tercih, ×3).",
  cuPaz: "Cuma nöbeti tutana aynı hafta Pazar nöbeti / hazırlaması (günlük tercih, ×3).",
  araGun: "İki nöbet arası Ayarlar'daki en az günden kısa (günlük tercih, ×3).",
  gunTercihCarpani: "Günlük tercihlerin (thuHs, cuPaz, istiyor, araGun) çarpanı.",
};
export const ACIL_AGIRLIK_ACIKLAMA: Record<keyof typeof ACIL_W, string> = {
  ardArda: "Art arda iki gün acil nöbeti.",
  ucBes: "5 gün içinde 3 nöbet.",
  eksik: "Günde 2 nöbetçiden eksik kalan her yer (yazılabilecek kişi varken).",
  hsFazla: "Ayda 1'den fazla Cumartesi ya da Pazar.",
  araIki: "İki nöbet arası Ayarlar'daki en az günden kısa.",
  toplam: "Yıllık toplam acil nöbeti eşitliği (paya göre kare sapma).",
  tur: "Yıllık Perşembe, Cuma, Cumartesi, Pazar, resmi tatil nöbeti eşitliği (her tür ayrı).",
  fm: "Aylık fazla mesai saati eşitliği.",
  istemiyor: "\"İstemiyor\" işaretli güne nöbet.",
  istiyor: "\"İstiyor\" işaretli güne nöbet (ödül).",
  esVar: "Eş durumu \"nöbetçi olsun\" günü yazılmazsa.",
  izinOnce: "Ertesi gün izne çıkana nöbet.",
};
export const OGLEN_AGIRLIK_ACIKLAMA: Record<keyof typeof OGLEN_W, string> = {
  masaGrubu: "Cuma: onay listesinde Masa 1, Masa 2, Masa 7 ve jokerlerden masada 2'den az eczacı kalırsa (öğlene fazladan yazılan her kişi).",
  hafta3: "Aynı kişiye haftada 3. öğlen nöbeti.",
  grupDisi: "Teknikerde Pazartesi–Perşembe Cuma'dan muaf olmayana yazmak (muaf varken).",
  bosKalan: "O hafta yazılabilen biri hiç yazılmamışken başkasına ikinci öğlen.",
  ikiSira: "Haftada iki öğlen sırası: herkes bir kez almadan kimse yeniden iki almaz (kare sapma).",
  hafta: "Haftada 2. öğlen nöbeti.",
  toplam: "Yıllık toplam öğlen nöbeti eşitliği (yazılabildiği günlere göre paydan sapma, kare).",
  cuma: "Yıllık Cuma öğlen nöbeti eşitliği (kare sapma).",
  cumaArdArda: "Aynı kişi art arda iki Cuma.",
  nobetci: "O günün eczane / acil nöbetçisine öğlen nöbeti.",
  ardArda: "Haftada iki alanın iki öğleni art arda günlere (ay geçişi dahil).",
};
export const ONAY_AGIRLIK_ACIKLAMA: Record<keyof typeof ONAY_AGIR, string> = {
  sayi: "Kişinin yıl içinde o yere aynı tür günde (Cuma ya da Pazartesi–Perşembe) oturduğu her gün.",
  toplam: "Tüm günlerin toplamı (eşitlikte ayırıcı).",
  hafta: "Aynı hafta içinde aynı yere ikinci kez.",
  dun: "Önceki çalıştığı gün oturduğu yere (fiilen yasak).",
};
export const SERVIS_AGIRLIK_ACIKLAMA: Record<keyof typeof SERVIS_W, string> = {
  S: "Aylık servis-gün payından sapma.",
  L: "Aylık yük (hasta × zorluk) payından sapma.",
  Y: "Aylık yoğun bakım (YB) servisi payından sapma.",
  D: "Günlük yük farkı (kişiler arası).",
  R: "Aynı servisin aynı kişide tekrarı (çalıştığı günlere düşen paydan fazlası).",
  G: "Aynı gruptaki servislerin aynı kişiye verilmesi.",
  Z: "Aylık zor servis payından sapma.",
  M: "Yeniden hesaplanan günde önceki dağıtımdan ayrılma.",
};

const sayi = (n: number) => (Math.abs(n) >= 1e6 ? n.toExponential().replace("e+", "e") : n.toLocaleString("tr-TR"));
const tablo = <K extends string>(w: Record<K, number>, ack: Record<K, string>) =>
  ["| Ad | Ağırlık | Anlamı |", "| --- | ---: | --- |", ...(Object.keys(w) as K[]).map(k => `| \`${k}\` | ${sayi(w[k])} | ${ack[k]} |`)].join("\n");

/** Kuralların tam metni (Markdown). ayar: kurumun güncel ayarları (başta yazılır). */
export function kurallarMetni(ayar: Partial<Ayarlar> = {}): string {
  const a = { ...AYAR_VARSAYILAN, ...ayar };
  return `# Eczane Yönetim Programı — Kurallar

Bu metin, hastane eczanesinin nöbet ve iş listelerini hazırlayan programın kurallarını anlatır. Program; günlük eczane nöbet
çizelgesini, hazırlama görevlerini, acil eczane nöbet listesini, öğlen nöbetini, onay listesi masalarını, servis hazırlama
dağıtımını ve puantajı (çalışma saatleri, fazla mesai) üretir. Kurallar ikiye ayrılır: kesin kurallar (hiç esnemez ya da
yalnız kadro yetmediğinde uyarıyla esner) ve tercihler (ağırlıklı ceza; büyük ağırlık önce gelir).

Program bir tarayıcı uygulamasıdır; veriler yalnız o tarayıcıda durur. Aynı veriyle her zaman aynı sonucu üretir
("farklı şekilde oluştur" eşit durumlardaki sırayı değiştirir).

## Bu kurumun güncel ayarları

| Ayar | Değer |
| --- | --- |
| Günlük eczane: iki nöbet arasında önerilen en az gün | ${a.minAra} |
| Acil eczane: iki acil nöbeti arasında önerilen en az gün | ${a.acilMinAra} |
| Destek personeli aylık hazırlama sayısı | ${a.destekAylik} |
| Arife günü normal mesai (saat) | ${a.arifeSaat} |
| Nöbet süresi (saat, değiştirilemez) | ${AYAR_VARSAYILAN.nobetSuresi} |
| Günlük normal mesai (saat, değiştirilemez) | ${AYAR_VARSAYILAN.mesai} |
| Hazırlama süresi (saat, değiştirilemez) | ${AYAR_VARSAYILAN.hazSaat} |

## Terimler

- **Görevler (roller)**
  - **Eczacı**: nöbet ve hazırlama tutar; her gün en az bir eczacı nöbetçidir. "Acilde nöbet tutar" işaretliyse eczane nöbeti ve hazırlaması yerine acil eczane nöbeti tutar (günlük eczanede mesai yapar).
  - **Tekniker**: nöbet ve hazırlama tutar.
  - **Kemoterapi eczacısı** (dışarıdan gelen eczacı): hafta içi mesaisi ve öğlen nöbeti yoktur; nöbetini günlük eczanede (eczacı yerine sayılır) ya da acil eczanede tutar.
  - **Destek personeli**: nöbet tutmaz; tatil günlerinde ikinci hazırlama yerini alır.
  - **Acil servis personeli**: günlük eczanede nöbet, hazırlama ve öğlen nöbeti tutmaz; acil eczane nöbet listesine yazılır; hafta içi normal mesai yapar.
- **Nöbet**: ${AYAR_VARSAYILAN.nobetSuresi} saat (08:00'de başlar). Günlük eczanede günde 2 nöbetçi, en az biri eczacı (ya da kemoterapi eczacısı).
- **Hazırlama**: tatil günlerinde (Cumartesi, Pazar, resmi tatil) ${HAZ_SAYISI} kişi, ${AYAR_VARSAYILAN.hazSaat} saat. 1. yer eczacı / tekniker, 2. yer önce destek personeli.
- **Nöbet ertesi izin (Nİ)**: nöbetin ertesi günü mesai günüyse kişi izinlidir.
- **Tatil günü**: Cumartesi, Pazar ve takvimde işaretlenen resmi tatiller. **Arife**: takvimde işaretlenen hafta içi gün; tatil sayılmaz, normal mesai ${a.arifeSaat} saattir.
- **Tercihler** (İzinler ekranı, kişi ve gün başına):
  - **İzinli**: o gün hiçbir görev yazılmaz; iki izinli gün arasındaki hafta sonu / tatil de izin sayılır.
  - **İstiyor**: eşitlik bozulmuyorsa o güne nöbet yazılır.
  - **İstemiyor**: mümkünse o güne nöbet / hazırlama yazılmaz; yazılırsa uyarı çıkar.
  - **Eş durumu: nöbetçi olsun**: kişi o gün mutlaka nöbetçi yazılır (komşu gün kuralları esner).
  - **Eş durumu: nöbetçi olmasın**: kişi o gün kesinlikle nöbetçi yazılmaz.
- **Yıllık eşitlik**: her takvim yılı kendi içinde değerlendirilir; Ocak'ta sayım sıfırdan başlar. Pay, kişinin o ay görev alabildiği günlere göredir: izinli / raporlu günler paydan düşer, izinden dönen fazladan yazılmaz (telafi istenmez). İşe sonradan başlayan ya da ayrılan yalnız çalıştığı aylar için değerlendirilir.

## 1. Günlük eczane nöbet çizelgesi (aylık)

### Kesin kurallar
1. Her gün 2 nöbetçi; en az biri eczacı (kemoterapi eczacısı da sayılır).
2. Kişiye görev yazılamayan günler: izinli, eş durumu "olmasın", puantajda yıllık izin / rapor / nöbet izni / diğer izin, iki izin arası tatil, en az ${IZIN_HAFTA_GUN} iş günü süren yıllık iznin hemen önündeki ve arkasındaki hafta sonu, işe başlama öncesi / ayrılış sonrası.
3. Nöbetçi komşu günlerde (önceki ve sonraki gün) nöbetçi ya da hazırlamacı olamaz; aynı gün hem nöbet hem hazırlama olmaz. Ay sınırında da geçerlidir (önceki ayın son günü, sonraki ayın 1'i; puantajdaki gerçek değişimler dahil).
4. 5 gün içinde 3 nöbet yazılmaz (ör. Pazartesi–Çarşamba–Cuma).
5. Hazırlamacı aynı gün ve önceki gün nöbetçi olamaz; ertesi gün nöbetçi olması kadro yetmediğinde ilk esneyen kuraldır (yarım ihlal sayılır: ${HAFIF_IHLAL}).
6. Aynı kişiye art arda iki gün hazırlama yazılmaz (Cumartesi + Pazar; ay sınırı dahil).
7. Perşembe nöbetçisine aynı hafta sonu hazırlama yazılmaz.
8. Dışarıdan gelen iki eczacı (kemoterapi eczacısı) aynı gün birlikte nöbetçi olmaz; Cuma ve Cumartesi olabilir.
9. Destek personelinin aylık hazırlama sayısı Ayarlar'daki sayıyı (${a.destekAylik}) aşmaz.
10. Ayrılan personelin son çalışma günü, ertesi gün mesai günüyse nöbet yazılmaz (nöbet izni kullanamaz).
11. Nöbet tutanlar arasında aylık fazla mesai farkı en fazla ${FM_MAX_FARK} saat (destek personeli hariç; eczacı ve teknikerler birlikte).
12. Ayda kişi başı en fazla 1 Cumartesi ve 1 Pazar nöbeti.

Kadro bir kuralı imkânsız kılıyorsa (ör. tatilde yeterli kişi yok) program bunu nedeniyle birlikte söyler ve kuralı esnettiği
günü kırmızı işaretler. Elle düzenlenen (kilitli) günler yeniden oluşturmada korunur; ihlalleri uyarı olarak gösterilir.

### Öncelik sırası
1. Uyarısız çizelge (her şeyden önce).
2. Kesin kurallar: aylık nöbet sayısı farkı en fazla 2, fazla mesai farkı en fazla ${FM_MAX_FARK} saat, aylık hazırlama farkı en fazla 1, hazırlama önce teknikerlere, yıllık Perşembe / Cuma / Cumartesi / Pazar / resmi tatil farkı en fazla 1, ayda en fazla 1 Cumartesi ve 1 Pazar, "istemiyor" günleri.
3. Güçlü tercihler: Cuma + Cumartesi + Pazar aynı kişide toplanmasın, eczacı / tekniker ayda en fazla 2 hazırlama, ayda en az 1 hafta sonu nöbeti, aylık nöbet farkı en fazla 1, Perşembe nöbetçisine aynı hafta sonu nöbet yok.
4. Yıllık eşitlik ve aylık düzen: yıllık nöbet, hafta sonu, Cuma, Perşembe, hazırlama, resmi tatil dengeleri; önceki aydan devir (Pazar / Cumartesi tutan bu ay yine tutmasın).
5. İnce ayar: yıllık fazla mesai dengesi, "istiyor" günleri, iki nöbet arası en az gün (${a.minAra}).

### Hazırlama sırası
Nöbetçiler yazıldıktan sonra tatil günlerinin hazırlamacıları seçilir: önce her teknikere 1, sonra eczacılara; eşitlikte
fazla mesaisi en az olana. Cuma + Cumartesi + Pazar nöbeti olan kendi grubunda en son alır. Cuma nöbetçisine aynı hafta
Pazar hazırlaması yazılmaz. Destek personeli 2. yerleri, eczacı / teknikerle doldurmanın en zor olduğu günlerden başlayarak alır.

### Eş durumu
Aynı gün birden çok kişi eş durumu "olsun" isterse ve hepsi yazılamıyorsa (günde 2 nöbetçi, en az 1 eczacı), yıl içinde eş
durumu isteği daha az karşılanan yazılır; öbürüne uyarı verilir.

### İzin, rapor ve nöbet değişimi (puantajdan)
- İzin / rapor girilirken kişinin görevli olduğu günler için yerine geçecek kişi seçilir; çizelgeye ve puantaja işlenir. Yıllık eşitlikte görev yine izne çıkanın sayılır (yerine tutan fazla, izinli eksik görünmez; sonradan telafi edilmez).
- Nöbet değişimi (devir ya da takas) yalnız puantaja işlenir; çizelge değişmez. Ay sınırındaki dinlenme kuralları gerçekte tutulana göre denetlenir.

### Ağırlıklar (amaç fonksiyonu; küçük toplam = daha iyi çizelge)
"Kare sapma" yazanlar kişiler arası kare sapma toplamıyla çarpılır.

${tablo(AGIRLIK, NOBET_AGIRLIK_ACIKLAMA)}

## 2. Acil eczane nöbet listesi (aylık)

- Her gün 2 nöbetçi, ${AYAR_VARSAYILAN.nobetSuresi} saat. Eczane nöbet çizelgesinden bağımsızdır; hazırlama ve "her gün en az bir eczacı" kuralı yoktur.
- Nöbet tutanlar: acil servis personeli ve "acilde nöbet tutar" işaretli eczacılar / kemoterapi eczacıları.
- İzinli, eş durumu "olmasın", çalışma dönemi dışı güne yazılmaz. Kişinin aynı gün ya da komşu günde eczane nöbeti / hazırlaması varsa yazılmaz (iki liste çakışmaz).
- Art arda iki gün ve 5 günde 3 nöbet olmaz; iki nöbet arası en az ${a.acilMinAra} gün önerilir; ayda en fazla 1 Cumartesi ve 1 Pazar.
- Eş durumu "olsun" günü yazılır; "istemiyor" mümkünse yazılmaz; ertesi gün izne çıkana mümkünse yazılmaz.
- Eşitlik yalnız acil nöbetleri arasında ve yıl boyuncadır: toplam nöbet; Perşembe, Cuma, Cumartesi, Pazar, resmi tatil ayrı ayrı; fazla mesai saati her ay. Pay yazılabildiği gün sayısına göredir.
- Elle düzenlenen günler korunur. Onaylanan ay elle değiştirilemez, yeniden oluşturulmaz; sonradan izne çıkan kişinin günü uyarılı görünür, yerine geçeni kullanıcı seçer.

${tablo(ACIL_W, ACIL_AGIRLIK_ACIKLAMA)}

## 3. Onay listesi masaları (haftalık)

- Hafta içi her gün, o gün çalışan eczacılar (acilde tutanlar dahil; kemoterapi eczacıları, nöbet ertesi izinli, izinli, raporlu olanlar hariç) masalara oturur. Resmi tatilde liste yoktur; arife günü vardır.
- Masa 1–6 doldurulur. 7. kişi joker olur; 8 ve daha çok kişide fazlalardan ilki Masa 7'ye, kalanlar jokere.
- İlk 6 masa dolmazsa o günün hazırlama teknikerlerinden biri oturur (yıl boyunca sırayla).
- Sabit sıra yoktur; yerler her gün yeniden dağıtılır (en az maliyetli atama, Macar yöntemi). Kimse önceki çalıştığı gün oturduğu yere oturmaz; mümkünse aynı hafta aynı yere ikinci kez oturmaz.
- Yıl boyunca herkes her masaya ve jokerliğe eşit oturur. Cuma hafta sonu listeleriyle birlikte 3 günlük iş olduğundan ayrı sayılır: Cumalar kendi arasında, Pazartesi–Perşembe kendi arasında eşitlenir. Hesap her yıl 1 Ocak'tan yeniden yürütülür.
- Kullanıcı bir günde iki kişinin yerini elle değiştirebilir; o gün elle kaydedilir ve eşitlikte gerçekte oturulan yer sayılır. Elle yazılan kişi o gün çalışmıyorsa yalnız onun yeri yeniden dağıtılır.
- Liste haftalık onaylanır. Onaylı hafta elle değiştirilemez ama canlıdır: sonradan girilen izin / rapor yerleri yine değiştirir. Onay kaldırılırsa o haftanın öğlen nöbeti (onayıyla birlikte) silinir.
- Bir izin, yılın sırasını değiştirdiği için sonraki haftaların masalarını da kaydırabilir.

${tablo(ONAY_AGIR, ONAY_AGIRLIK_ACIKLAMA)}

## 4. Öğlen nöbeti (haftalık)

- Hafta içi öğle arasında eczanede kalanlar: Pazartesi–Perşembe ${OGLEN_GEREK.hafta.e} eczacı + ${OGLEN_GEREK.hafta.t} tekniker, Cuma ${OGLEN_GEREK.cuma.e} eczacı + ${OGLEN_GEREK.cuma.t} tekniker. Resmi tatil ve arife günü öğlen nöbeti yoktur.
- O gün mesaide çalışanlardan yazılır (izinli, raporlu, nöbet ertesi izinli olan yazılmaz). Eczacı grubuna acilde tutan eczacılar da girer; kemoterapi eczacısı, acil servis personeli ve destek personeli yazılmaz.
- "Cuma'dan muaf" işaretli kişi Cuma yazılmaz. Teknikerde Pazartesi–Perşembe muaf olanlara, Cuma öbürlerine yazılır (muaflar yetmezse öbürleri de); eşitlik iki grubun kendi içinde aranır.
- Hedefler (önem sırasıyla): herkese haftada bir (kişi yetmezse iki; haftada iki sırayla verilir); yıl boyu toplam sayı ve Cuma sayısı ayrı ayrı eşit (yazılabildiği günlere göre); mümkünse o günün nöbetçisine yazılmaz; mümkünse aynı kişi art arda iki Cuma yazılmaz ve haftada iki alanın ikisi art arda günlere düşmez (ay geçişi dahil).
- **Cuma masa kuralı**: Cuma günü onay listesinde Masa 1, Masa 2, Masa 7 ve jokerlerdeki eczacılardan en az 2'si masada kalır; bu gruptan öğlene en fazla (grup − 2) kişi yazılır, yazılacak kişiyi yıllık eşitlik seçer (en az tutan öne geçer).
- Haftalık oluşturulur, onaylanır ve silinir; ay sınırını aşan hafta tek parçadır. Haftanın onay listesi onaylanmadan öğlen nöbeti oluşturulmaz ve onaylanmaz.
- Elle düzenleme: değiştirilen yerler korunur; "Seçilmedi" yapılan yer boş kalır. Onaylı hafta elle değiştirilemez.
- Kendiliğinden onarım (her kayıtta): sonradan girilen izin / rapor yüzünden o gün çalışmayan kişinin yeri bugünden sonraki günlerde doldurulur; Cuma masa kuralı bozulduysa gruptaki elle yazılmamış kişi yeniden seçilir. Geçmiş günlere, elle yazılan kişiye ve hiç oluşturulmamış haftalara dokunulmaz. Onaylı haftada da yapılır. Düzeltilemeyen durum ekranda uyarı olarak görünür.

${tablo(OGLEN_W, OGLEN_AGIRLIK_ACIKLAMA)}

## 5. Servis hazırlama listesi (günlük)

- Hastane servislerinin ilaç hazırlaması o gün çalışan hazırlama teknikerlerine dağıtılır. Her servisin zorluğu (10 üzerinden), hasta sayısı ve hazırlama gün sayısı vardır; yük = hasta × zorluk (çok günlük servislerde gün sayısıyla).
- Kesin: her gün kişi başı servis, yoğun bakım (adı "YB" ile biten) ve zor servis (zorluk ${ZOR_ESIK} ve üstü) sayıları en fazla 1 farklıdır; aynı gruptaki servisler (ör. Genel Cerrahi-A / -B) aynı kişiye verilmez.
- En aza indirilen: aylık servis-gün, yük, YB ve zor servis payından sapma, günlük yük farkı, aynı servisin aynı kişide tekrarı, yeniden hesaplanan günde önceki listeden ayrılma.
- Geçmiş günler kendiliğinden değişmez; bugün ve sonrasında girdisi (çalışanlar, servis ayarı) değişen günler yeniden dağıtılır. Elle atanan servisler yerinde kalır.

${tablo(SERVIS_W, SERVIS_AGIRLIK_ACIKLAMA)}

## 6. Puantaj ve fazla mesai

- Gün kodları: **M** mesai (${AYAR_VARSAYILAN.mesai} saat; arifede ${a.arifeSaat}), **N** nöbet (${AYAR_VARSAYILAN.nobetSuresi} saat), **H** hazırlama (${AYAR_VARSAYILAN.hazSaat} saat), **Nİ** nöbet ertesi izin (0), **Yİ** yıllık izin, **R** rapor, **Dİ** diğer izin, **B** boş (tatil), **P** çalışma dönemi dışı.
- Yıllık izin, rapor ve diğer izin günleri o günün normal mesai saatiyle çalışılmış sayılır.
- Fazla mesai = toplam çalışma saati − ayın normal mesai saatleri (çalışma dönemi dışı günler düşülür).
- Ay sınırı: nöbet ertesi izin nöbetin yazıldığı aya sayılır.
- Kemoterapi eczacısında nöbet günü ve nöbet izni gününün mesaisi düşülür. Destek personelinde yalnız hazırlama saatleri sayılır.
- Saat dilimleri: 20:00–08:00 dilimi (12 saat) tamamen fazla mesaidir; 08:00–20:00 diliminden o günün normal mesaisi ve ertesi günün nöbet izni düşülür.
- Cuma nöbeti (Cuma resmi tatil değilse) 16 saat fazla mesai yazar (ertesi gün Cumartesi; düşülecek nöbet izni yok).

## 7. Onaylar

- Günlük eczane nöbet çizelgesi ve acil eczane listesi aylık, öğlen nöbeti ve onay listesi haftalık onaylanır.
- Onaylı liste elle değiştirilemez, yeniden oluşturulmaz, silinemez; önce onay kaldırılır. Geri alma onayları ve onaylı listeleri değiştirmez.
- Onaylı aylarda kaydı olan kişi silinemez; ayrılış tarihi girilir.

## 8. Veri yapısı (yedek dosyası, JSON)

Ayarlar > Yedek al ile alınan dosya şu alanları taşır (aylar 0'dan sayılır: Ocak = 0; "yil-ay" ör. "2026-10" = Kasım 2026):

- \`staff\`: kişiler — \`id\`, \`name\`, \`role\` (eczaci, teknisyen, destek, nobetci = kemoterapi eczacısı, servis = acil servis personeli), \`baslangic\` / \`bitis\` (YYYY-AA-GG), \`cumaMuaf\`, \`acilTutar\`.
- \`prefs\`: "kisiId-yil-ay-gun" → izinli / want (istiyor) / avoid (istemiyor) / esVar / esYok.
- \`manualTatil\`, \`arife\`: "yil-ay-gun" → true.
- \`settings\`: minAra, acilMinAra, destekAylik, arifeSaat.
- \`schedules\`: "yil-ay" → { year, month, days: [{ day, tatil, assigned (nöbetçiler), prep (hazırlamacılar), locked (elle), conflict (kural esnedi) }], uyarilar, onay }.
- \`puantaj\`: "yil-ay" → kişi id → gün → elle yazılan kod (M, N, H, NI, YI, R, DI, B).
- \`degisimler\`: nöbet değişimi ve izin nedeniyle yerine geçme kayıtları (cik: çıkan, yer: giren, gorev: N ya da H).
- \`acil\`: "yil-ay" → gün → acil nöbetçi id'leri; \`acilElle\`: elle düzenlenen günler.
- \`oglen\`: "yil-ay" → gün → { e: eczacı id'leri, t: tekniker id'leri, sabit: elle yazılan yerler }.
- \`onayMasa.elle\`: "YYYY-AA-GG" → kişi id → yer ("1"–"7", "J" joker); "bos" → elle boş bırakılan masalar ("3,5").
- \`listeOnay\`: \`acil\` "yil-ay" → onay; \`oglen\` ve \`onay\` (onay listesi) haftanın Pazartesi'si "YYYY-AA-GG" → onay ({ zaman, kim }).
- \`servisAyar\`, \`servisKayit\`: servis ayarları ve gün gün servis dağıtımı.

Onay listesi masaları kaydedilmez: her açılışta yıl başından yeniden hesaplanır (yalnız elle değiştirilen günler kayıtlıdır).
`;
}
