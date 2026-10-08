// Generazione PDF del menu (lato client, con jsPDF) a partire dai dati attuali del database.
import { TAGS } from "./firebase.js";

const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

const C = {
  paper: [247, 236, 214], ink: [42, 13, 6], red: [142, 31, 23], gold: [184, 116, 26],
  muted: [107, 74, 47], line: [222, 203, 168], dark: [26, 9, 5], goldHi: [242, 183, 60]
};

function loadScript(src) {
  if (window.jspdf) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("Impossibile caricare jsPDF"));
    document.head.appendChild(s);
  });
}

function loadImg(src) {
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

// Converte un'immagine (anche webp / data-URL) in JPEG quadrato ritagliato al centro
function squareJpeg(img, px = 220) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const x = c.getContext("2d");
  const s = Math.min(img.width, img.height);
  x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, px, px);
  return c.toDataURL("image/jpeg", 0.82);
}

// Foto copertina scurita con sfumatura verso il fondo scuro
function heroJpeg(img, maxW = 1400) {
  const c = document.createElement("canvas");
  const k = Math.min(1, maxW / img.width);
  c.width = img.width * k; c.height = img.height * k;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, c.width, c.height);
  const g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, "rgba(26,9,5,.35)"); g.addColorStop(.55, "rgba(26,9,5,.45)"); g.addColorStop(1, "rgba(26,9,5,1)");
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

// Logo circolare con anello dorato (PNG trasparente fuori dal cerchio)
function circleLogo(img, px = 600) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const x = c.getContext("2d");
  const r = px / 2;
  const g = x.createLinearGradient(0, 0, px, px);
  g.addColorStop(0, "#ffd978"); g.addColorStop(.5, "#f2b73c"); g.addColorStop(1, "#a8661a");
  x.fillStyle = g; x.beginPath(); x.arc(r, r, r - 4, 0, Math.PI * 2); x.fill();
  x.save(); x.beginPath(); x.arc(r, r, r - 22, 0, Math.PI * 2); x.clip();
  x.drawImage(img, 22, 22, px - 44, px - 44); x.restore();
  return c.toDataURL("image/png");
}

async function fontBase64(url) {
  const buf = await fetch(url).then((r) => r.arrayBuffer());
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// I font standard PDF non hanno emoji: le togliamo
const clean = (s = "") => String(s)
  .replace(/[^\u0000-ɏ‘-„…€–—•]/g, "")
  .replace(/\s+/g, " ").trim();
const euro = (n) => "€ " + Number(n || 0).toFixed(2).replace(".", ",");

export async function generateMenuPdf({ categories, products, settings = {}, seed, onProgress = () => {} }) {
  onProgress("Carico librerie…");
  await loadScript(JSPDF_URL);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  try {
    doc.addFileToVFS("Rye.ttf", await fontBase64("/fonts/Rye-Regular.ttf"));
    doc.addFont("Rye.ttf", "Rye", "normal");
  } catch { /* fallback su Times */ }
  const display = doc.getFontList().Rye ? "Rye" : "times";

  const info = { ...(seed.info || {}), ...(settings.info || {}) };
  const notes = settings.notes || seed.notes || [];
  const allergens = seed.allergens || [];

  const cats = categories.filter((c) => c.visible !== false);
  const byCat = (id) => products.filter((p) => p.categoryId === id && p.visible !== false);

  // immagini prodotti → JPEG
  onProgress("Preparo le foto…");
  const thumbs = new Map();
  const withImg = cats.flatMap((c) => byCat(c.id)).filter((p) => p.image);
  let done = 0;
  await Promise.all(withImg.map(async (p) => {
    const img = await loadImg(p.image);
    if (img) thumbs.set(p.id, squareJpeg(img));
    onProgress(`Preparo le foto… ${++done}/${withImg.length}`);
  }));
  const [heroImg, logoImg] = await Promise.all([loadImg("/img/hero-foto.jpg"), loadImg("/img/logo.jpg")]);

  const W = 210, H = 297, M = 14, CW = W - M * 2, BOTTOM = 280;
  let y = 0, page = 1;

  const paper = () => { doc.setFillColor(...C.paper); doc.rect(0, 0, W, H, "F"); };
  const header = () => {
    doc.setFont(display, "normal"); doc.setFontSize(9); doc.setTextColor(...C.gold);
    doc.text("La Tana del Lupo", W / 2, 10, { align: "center" });
    doc.setDrawColor(...C.line); doc.setLineWidth(.3); doc.line(M, 13, W - M, 13);
  };
  const footer = () => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
    doc.text(clean(info.address || ""), M, 290);
    doc.text(String(page), W - M, 290, { align: "right" });
  };
  const newPage = () => { footer(); doc.addPage(); page++; paper(); header(); y = 22; };
  const ensure = (h) => { if (y + h > BOTTOM) newPage(); };
  const ornament = (cy, w = 60) => {
    doc.setDrawColor(...C.gold); doc.setLineWidth(.4);
    doc.line(W / 2 - w / 2, cy, W / 2 - 4, cy); doc.line(W / 2 + 4, cy, W / 2 + w / 2, cy);
    doc.setFillColor(...C.gold);
    doc.triangle(W / 2 - 2, cy, W / 2, cy - 2, W / 2 + 2, cy, "F");
    doc.triangle(W / 2 - 2, cy, W / 2, cy + 2, W / 2 + 2, cy, "F");
  };

  // ---------- COPERTINA ----------
  onProgress("Impagino…");
  doc.setFillColor(...C.dark); doc.rect(0, 0, W, H, "F");
  if (heroImg) {
    const hh = W * heroImg.height / heroImg.width;
    doc.addImage(heroJpeg(heroImg), "JPEG", 0, 0, W, hh);
  }
  if (logoImg) doc.addImage(circleLogo(logoImg), "PNG", W / 2 - 42, 52, 84, 84);
  doc.setFont(display, "normal"); doc.setTextColor(...C.goldHi);
  doc.setFontSize(46); doc.text("La Tana", W / 2, 168, { align: "center" });
  doc.setFontSize(38); doc.text("del Lupo", W / 2, 186, { align: "center" });
  ornament(196, 90);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(247, 231, 198);
  doc.text("M  E  N  U", W / 2, 210, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(207, 180, 140);
  doc.text("Smash Burger  •  Birre Selezionate  •  Panini Gourmet", W / 2, 220, { align: "center" });
  doc.setFontSize(10.5); doc.setTextColor(247, 231, 198);
  doc.text(clean(info.address || ""), W / 2, 252, { align: "center" });
  if (info.phone) doc.text("Tel. " + clean(info.phone), W / 2, 258, { align: "center" });
  doc.setFontSize(8); doc.setTextColor(207, 180, 140);
  doc.text("Menu aggiornato al " + new Date().toLocaleDateString("it-IT"), W / 2, 284, { align: "center" });

  // ---------- CATEGORIE ----------
  doc.addPage(); page++; paper(); header(); y = 22;
  for (const c of cats) {
    const items = byCat(c.id);
    if (!items.length) continue;
    const desc = c.description ? doc.setFont("helvetica", "italic").setFontSize(9).splitTextToSize(clean(c.description), CW - 30) : [];
    ensure(22 + desc.length * 4 + 22);
    y += 4;
    doc.setFont(display, "normal"); doc.setFontSize(22); doc.setTextColor(...C.red);
    doc.text(clean(c.name), W / 2, y + 7, { align: "center" });
    ornament(y + 12);
    y += 17;
    if (desc.length) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...C.muted);
      doc.text(desc, W / 2, y + 1, { align: "center" });
      y += desc.length * 4 + 2;
    }
    y += 2;

    for (const p of items) {
      const thumb = thumbs.get(p.id);
      const IMG = 17;
      const tx = M + (thumb ? IMG + 4 : 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      const price = euro(p.price);
      const pw = doc.getTextWidth(price);
      const tw = W - M - tx - pw - 5;
      doc.setFontSize(10.5);
      const nameL = doc.splitTextToSize(clean(p.name).toUpperCase(), tw);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      const descL = p.description ? doc.splitTextToSize(clean(p.description), W - M - tx) : [];
      const tagTxt = (p.tags || []).filter((k) => TAGS[k]).map((k) => TAGS[k].label).join(" · ");
      const algTxt = (p.allergens || []).map((id) => allergens.find((a) => a.id === id)?.name).filter(Boolean).join(", ");
      const extra = [tagTxt, algTxt ? "Allergeni: " + algTxt : ""].filter(Boolean);
      const textH = nameL.length * 4.6 + descL.length * 3.7 + extra.length * 3.5;
      const h = Math.max(thumb ? IMG : 0, textH) + 5;
      ensure(h);

      if (thumb) {
        doc.addImage(thumb, "JPEG", M, y, IMG, IMG);
        doc.setDrawColor(...C.gold); doc.setLineWidth(.3); doc.rect(M, y, IMG, IMG);
      }
      let ty = y + 4;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...C.ink);
      doc.text(nameL, tx, ty);
      // puntini guida fino al prezzo
      const lastW = doc.getTextWidth(nameL[nameL.length - 1]);
      const ly = ty + (nameL.length - 1) * 4.6;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C.red);
      doc.text(price, W - M, ly, { align: "right" });
      doc.setDrawColor(...C.line); doc.setLineDashPattern([.4, 1.2], 0); doc.setLineWidth(.35);
      const x1 = tx + lastW + 2, x2 = W - M - pw - 2;
      if (x2 > x1) doc.line(x1, ly, x2, ly);
      doc.setLineDashPattern([], 0);
      ty += nameL.length * 4.6 - 0.8;
      if (descL.length) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...C.muted);
        doc.text(descL, tx, ty); ty += descL.length * 3.7;
      }
      doc.setFont("helvetica", "italic"); doc.setFontSize(7.5);
      if (tagTxt) { doc.setTextColor(...C.gold); doc.text(tagTxt, tx, ty); ty += 3.5; }
      if (algTxt) { doc.setTextColor(...C.red); doc.text("Allergeni: " + algTxt, tx, ty); ty += 3.5; }
      y += h;
    }
    y += 4;
  }

  // ---------- INFO FINALI ----------
  const section = (title) => {
    ensure(26); y += 4;
    doc.setFont(display, "normal"); doc.setFontSize(18); doc.setTextColor(...C.red);
    doc.text(title, W / 2, y + 6, { align: "center" }); ornament(y + 10); y += 16;
  };

  if (notes.length) {
    section("Da sapere");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...C.ink);
    for (const n of notes) { ensure(6); doc.text("•  " + clean(n), M + 4, y); y += 5.5; }
  }

  section("Legenda");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...C.ink);
  Object.values(TAGS).forEach((t, i) => {
    const col = i % 2, cx = M + 4 + col * (CW / 2);
    if (col === 0) ensure(6);
    doc.text("•  " + t.label, cx, y);
    if (col === 1 || i === Object.values(TAGS).length - 1) y += 5.5;
  });

  if (allergens.length) {
    section("Allergeni");
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...C.muted);
    const intro = doc.splitTextToSize("Per la tua sicurezza comunica al personale allergie e intolleranze. Elenco delle sostanze che provocano allergie o intolleranze (Reg. UE 1169/2011):", CW);
    doc.text(intro, M, y); y += intro.length * 3.8 + 2;
    allergens.forEach((a, i) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      const dl = doc.splitTextToSize(clean(a.description), CW - 10);
      ensure(5 + dl.length * 3.3);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...C.ink);
      doc.text(`${i + 1}. ${clean(a.name)}`, M, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
      doc.text(dl, M + 6, y + 3.6);
      y += 4.6 + dl.length * 3.3;
    });
  }

  section("Dove siamo");
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...C.ink);
  doc.text(clean(info.address || ""), W / 2, y, { align: "center" }); y += 5.5;
  if (info.phone) { doc.text("Tel. " + clean(info.phone), W / 2, y, { align: "center" }); y += 5.5; }
  if (info.googleRating) {
    doc.setTextColor(...C.gold);
    doc.text(`Google: ${String(info.googleRating).replace(".", ",")} / 5 su ${info.googleCount || ""} recensioni`, W / 2, y, { align: "center" });
    y += 5.5;
  }
  doc.setTextColor(...C.muted); doc.setFontSize(8.5);
  doc.textWithLink("Menu digitale: " + location.host, W / 2 - doc.getTextWidth("Menu digitale: " + location.host) / 2, y, { url: location.origin });
  footer();

  const d = new Date();
  const name = `menu-la-tana-del-lupo-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.pdf`;
  doc.save(name);
  return name;
}
