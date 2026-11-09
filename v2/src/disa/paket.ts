// PDF ve Excel çıktı modülleri tek paket: açılışta yüklenmez, ilk çıktı isteğinde yükle.ts ile yüklenir
// (jsPDF ve gömülü yazı tipi büyük; telefonda açılışı yavaşlatıyordu).
export * from "./cizelgePdf";
export * from "./oglenCikti";
export * from "./puantajCikti";
export * from "./acilCikti";
export * from "./servisCikti";
export * from "./raporCikti";
export * from "./onayCikti";
