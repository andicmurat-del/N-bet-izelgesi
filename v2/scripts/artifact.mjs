// dist/index.html → dist/artifact.html: claude.ai artifact sayfası kendi <html>/<head>/<body> iskeletini ekler;
// buraya yalnız sayfa içeriği yazılır (başlık, yazı tipi bağlantıları, stil, gövde, betik).
import { readFileSync, writeFileSync } from "fs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const al = re => [...html.matchAll(re)].map(m => m[0]);
const tek = (re, ad) => { const m = html.match(re); if (!m) throw new Error(ad + " bulunamadı"); return m; };

// betikler önce ayrılır: paketlenmiş kodun içindeki metinler (ör. Excel'in <styleSheet> XML'i) etiket sanılmasın
const BETIK = /<script\b[^>]*>[\s\S]*?<\/script>/g;
const betikler = al(BETIK);
const bas = tek(/<head>([\s\S]*?)<\/head>/, "head")[1].replace(BETIK, "");
const baslik = tek(/<title>[\s\S]*?<\/title>/, "title")[0];
const baglantilar = [...bas.matchAll(/<link\b[^>]*>/g)].map(m => m[0]).filter(l => /fonts\.(googleapis|gstatic)\.com/.test(l));
const stiller = [...bas.matchAll(/<style\b(?:\s[^>]*)?>[\s\S]*?<\/style>/g)].map(m => m[0]);
const govde = tek(/<body[^>]*>([\s\S]*?)<\/body>/, "body")[1].replace(BETIK, "").trim();
if (betikler.length !== 1) throw new Error("tek betik bekleniyordu, bulunan: " + betikler.length);

const parca = [
  baslik,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  ...baglantilar,
  ...stiller,
  govde,
  ...betikler,
].join("\n");
writeFileSync(new URL("../dist/artifact.html", import.meta.url), parca + "\n");
console.log("dist/artifact.html", (parca.length / 1024).toFixed(0) + " KB");
