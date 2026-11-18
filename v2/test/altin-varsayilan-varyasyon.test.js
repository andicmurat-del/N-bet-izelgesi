// Altın kayıt (zengin senaryo, varsayılan ayarlar, farklı dağılım): gövde test/altin/govde.js; kayıt test/altin/beklenen-varsayilan-varyasyon.json.
// Bilerek yapılan bir davranış değişikliğinden sonra: ALTIN_YAZ=1 npx vitest run test/altin
import { altinTestleri } from "./altin/govde.js";

altinTestleri("varsayilan", "varyasyon");
