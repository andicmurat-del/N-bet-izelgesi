// Kayıt yeteneğinin (veri/klasor/belgeler.ts ile aynı arayüz) bellekte çalışan sahtesi (testler için): belgeler,
// koleksiyonlar, where / orderBy / limit, belge dinleme. Kurallar (yetki) uygulanmaz; onlar belgeler.ts'in işidir.
export function sahteDb() {
  const belgeler = new Map();
  const dinleyiciler = new Map();
  const ust = yol => yol.split("/").slice(0, -1).join("/");
  const anlik = (yol, d) => ({
    id: yol.split("/").pop(),
    exists: d !== undefined,
    data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))),
    metadata: { fromCache: false, hasPendingWrites: false },
  });
  const bildir = yol => (dinleyiciler.get(yol) ?? []).forEach(f => f(anlik(yol, belgeler.get(yol))));
  const doc = yol => ({
    id: yol.split("/").pop(),
    path: yol,
    get: async () => anlik(yol, belgeler.get(yol)),
    set: async d => {
      belgeler.set(yol, JSON.parse(JSON.stringify(d)));
      bildir(yol);
    },
    update: async d => {
      if (!belgeler.has(yol)) throw { code: "invalid_argument", message: "yok" };
      belgeler.set(yol, { ...belgeler.get(yol), ...JSON.parse(JSON.stringify(d)) });
      bildir(yol);
    },
    delete: async () => {
      belgeler.delete(yol);
      bildir(yol);
    },
    onSnapshot(next) {
      const l = dinleyiciler.get(yol) ?? [];
      l.push(next);
      dinleyiciler.set(yol, l);
      queueMicrotask(() => next(anlik(yol, belgeler.get(yol))));
      return () => l.splice(l.indexOf(next), 1);
    },
    collection: alt => koleksiyon(yol + "/" + alt),
  });
  const sorgu = (yol, filtre = [], sira = null, sinir = 1000) => ({
    where: (a, op, v) => {
      if (op !== "==") throw new Error("sahte: yalnız ==");
      return sorgu(yol, [...filtre, [a, v]], sira, sinir);
    },
    orderBy: (a, yon = "asc") => sorgu(yol, filtre, [a, yon], sinir),
    limit: n => sorgu(yol, filtre, sira, n),
    get: async () => {
      let l = [...belgeler.entries()].filter(([k]) => ust(k) === yol).filter(([, d]) => filtre.every(([a, v]) => d[a] === v));
      if (sira)
        l.sort((p, q) => (p[1][sira[0]] < q[1][sira[0]] ? -1 : p[1][sira[0]] > q[1][sira[0]] ? 1 : 0) * (sira[1] === "desc" ? -1 : 1));
      else l.sort((p, q) => (p[0] < q[0] ? -1 : 1));
      const docs = l.slice(0, sinir).map(([k, d]) => anlik(k, d));
      return { docs, size: docs.length, empty: !docs.length };
    },
  });
  const koleksiyon = yol => ({ ...sorgu(yol), path: yol, doc: id => doc(yol + "/" + id) });
  return { doc, collection: koleksiyon, belgeler };
}
