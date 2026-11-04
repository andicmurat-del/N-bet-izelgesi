// Bir öğeyi sayfanın başka bir yerine taşır (ör. alt sekmenin işlem düğmeleri → sayfa başlığının işlem alanı).
// Öğe Svelte'in denetiminde kalır: olay dinleyicileri ve güncellemeler aynen çalışır, bileşen kapanınca öğe kaldırılır.
export function tasi(node: HTMLElement, hedefKimlik = "sayfa-islemleri") {
  const hedef = document.getElementById(hedefKimlik);
  if (hedef) hedef.appendChild(node);
  return { destroy() { node.remove(); } };
}
