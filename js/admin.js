import { app, db, SDK, formatPrice, TAGS, fetchSeed } from "./firebase.js";
const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } =
  await import(`${SDK}/firebase-auth.js`);
const { collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } =
  await import(`${SDK}/firebase-firestore.js`);

const $ = (s) => document.querySelector(s);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2600); };

const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);

let categories = [], products = [], unsubs = [], settings = null;
const seedP = fetchSeed();

// ---------- AUTH ----------
onAuthStateChanged(auth, (user) => {
  $("#login").hidden = !!user;
  $("#app").hidden = !user;
  unsubs.forEach((u) => u()); unsubs = [];
  if (user) startListeners();
});

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginErr").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value);
  } catch (err) {
    $("#loginErr").textContent = "Credenziali non valide.";
    console.error(err);
  }
});
$("#logout").addEventListener("click", () => signOut(auth));

// ---------- DATA ----------
function startListeners() {
  unsubs.push(onSnapshot(collection(db, "categories"), (s) => {
    categories = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    renderAll();
  }, (e) => toast("Errore lettura categorie: " + e.code)));
  unsubs.push(onSnapshot(collection(db, "products"), (s) => {
    products = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    renderAll();
  }));
  unsubs.push(onSnapshot(doc(db, "settings", "general"), (s) => {
    settings = s.data() || {};
    if (document.activeElement !== $("#notesText")) $("#notesText").value = (settings.notes || []).join("\n");
    renderInfo();
    $("#v2Banner").hidden = !categories.length || !!settings.v2;
  }));
}

function renderAll() {
  $("#seedBanner").hidden = categories.length > 0;
  $("#v2Banner").hidden = !categories.length || !settings || !!settings.v2;
  // filtro + select categoria
  const cur = $("#pFilter").value;
  const opts = categories.map((c) => `<option value="${esc(c.id)}">${esc(c.emoji || "")} ${esc(c.name)}</option>`).join("");
  $("#pFilter").innerHTML = `<option value="">Tutte le categorie</option>${opts}`;
  $("#pFilter").value = cur;
  $("#pCat").innerHTML = opts;
  renderProducts();
  renderCategories();
}

function renderProducts() {
  const q = $("#pSearch").value.trim().toLowerCase();
  const f = $("#pFilter").value;
  let html = "";
  for (const c of categories) {
    if (f && c.id !== f) continue;
    const items = products.filter((p) => p.categoryId === c.id && (!q || p.name.toLowerCase().includes(q)));
    if (!items.length && q) continue;
    html += `<div class="group-title">${esc(c.emoji || "")} ${esc(c.name)} <small>${items.length} prodotti</small></div>`;
    html += items.map((p) => `
      <div class="row-item" data-pid="${esc(p.id)}">
        ${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="" loading="lazy">` : `<div class="thumb">🐺</div>`}
        <div class="info">
          <div class="name">${esc(p.name)}${p.available === false ? '<span class="pill">Esaurito</span>' : ""}${p.visible === false ? '<span class="pill grey">Nascosto</span>' : ""}</div>
          <div class="meta">${esc((p.description || "").slice(0, 70))}</div>
        </div>
        <div class="pr">${formatPrice(p.price)}</div>
      </div>`).join("");
  }
  const orphans = products.filter((p) => !categories.some((c) => c.id === p.categoryId));
  if (orphans.length && !f) {
    html += `<div class="group-title">⚠️ Senza categoria</div>` + orphans.map((p) =>
      `<div class="row-item" data-pid="${esc(p.id)}"><div class="thumb">?</div><div class="info"><div class="name">${esc(p.name)}</div></div><div class="pr">${formatPrice(p.price)}</div></div>`).join("");
  }
  $("#productList").innerHTML = html || `<p class="hint">Nessun prodotto.</p>`;
}

function renderCategories() {
  $("#categoryList").innerHTML = categories.map((c) => `
    <div class="row-item" data-cid="${esc(c.id)}">
      <div class="thumb">${esc(c.emoji || "🐺")}</div>
      <div class="info">
        <div class="name">${esc(c.name)}${c.visible === false ? '<span class="pill grey">Nascosta</span>' : ""}</div>
        <div class="meta">Ordine ${c.order ?? 0} · ${products.filter((p) => p.categoryId === c.id).length} prodotti</div>
      </div>
    </div>`).join("") || `<p class="hint">Nessuna categoria.</p>`;
}

$("#pSearch").addEventListener("input", renderProducts);
$("#pFilter").addEventListener("change", renderProducts);

// ---------- TABS ----------
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
  ["products", "categories", "notes", "info"].forEach((n) => ($("#tab-" + n).hidden = n !== t.dataset.tab));
}));
document.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

// ---------- IMMAGINI ----------
// Compressione lato client in WebP e salvataggio come data-URL nel documento Firestore
// (niente Firebase Storage → nessun piano a pagamento richiesto).
async function compressImage(file, maxSide = 900) {
  const bmp = await createImageBitmap(file);
  let side = maxSide, quality = 0.8, out;
  for (let i = 0; i < 6; i++) {
    const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    out = c.toDataURL("image/webp", quality);
    if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", quality);
    if (out.length < 350_000) break;
    quality -= 0.1; side = Math.round(side * 0.85);
  }
  return out;
}

// ---------- PRODOTTO ----------
let editingP = null, pImage = "";
function setPreview(src) {
  pImage = src || "";
  $("#photoPrev").innerHTML = pImage ? `<img src="${esc(pImage)}" alt="">` : "<span>Nessuna foto</span>";
}
function openProduct(p) {
  editingP = p || null;
  $("#pTitle").textContent = p ? "Modifica prodotto" : "Nuovo prodotto";
  $("#pName").value = p?.name || "";
  $("#pDesc").value = p?.description || "";
  $("#pPrice").value = p?.price ?? "";
  $("#pCat").value = p?.categoryId || $("#pFilter").value || categories[0]?.id || "";
  const sameCat = products.filter((x) => x.categoryId === $("#pCat").value);
  $("#pOrder").value = p?.order ?? (sameCat.length ? Math.max(...sameCat.map((x) => x.order ?? 0)) + 1 : 0);
  $("#pAvail").checked = p?.available !== false;
  $("#pVisible").checked = p?.visible !== false;
  $("#pDelete").hidden = !p;
  const chk = (name, val, on, txt) => `<label><input type="checkbox" name="${name}" value="${val}" ${on ? "checked" : ""}>${txt}</label>`;
  $("#pTags").innerHTML = Object.entries(TAGS).map(([k, t]) => chk("tag", k, p?.tags?.includes(k), `${t.icon} ${t.label}`)).join("");
  seedP.then((seed) => {
    $("#pAllergens").innerHTML = seed.allergens.map((a) => chk("alg", a.id, p?.allergens?.includes(a.id), `${a.icon} ${a.name}`)).join("");
  });
  setPreview(p?.image);
  $("#photoInput").value = "";
  $("#pDialog").showModal();
}
$("#addProduct").addEventListener("click", () => {
  if (!categories.length) return toast("Crea prima una categoria");
  openProduct(null);
});
$("#productList").addEventListener("click", (e) => {
  const r = e.target.closest("[data-pid]");
  if (r) openProduct(products.find((p) => p.id === r.dataset.pid));
});
$("#photoInput").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  $("#photoPrev").innerHTML = "<span>Elaboro…</span>";
  try { setPreview(await compressImage(f)); } catch (err) { console.error(err); toast("Immagine non valida"); setPreview(pImage); }
});
$("#photoRemove").addEventListener("click", () => setPreview(""));

$("#pForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: $("#pName").value.trim(),
    description: $("#pDesc").value.trim(),
    price: Math.round(parseFloat(String($("#pPrice").value).replace(",", ".")) * 100) / 100 || 0,
    categoryId: $("#pCat").value,
    order: parseInt($("#pOrder").value, 10) || 0,
    available: $("#pAvail").checked,
    visible: $("#pVisible").checked,
    image: pImage,
    tags: [...document.querySelectorAll("#pTags input:checked")].map((i) => i.value),
    allergens: [...document.querySelectorAll("#pAllergens input:checked")].map((i) => i.value),
    updatedAt: serverTimestamp()
  };
  $("#pSave").disabled = true;
  try {
    if (editingP) await updateDoc(doc(db, "products", editingP.id), data);
    else await addDoc(collection(db, "products"), data);
    $("#pDialog").close();
    toast("Prodotto salvato ✔");
  } catch (err) { console.error(err); toast("Errore salvataggio: " + err.code); }
  $("#pSave").disabled = false;
});
$("#pDelete").addEventListener("click", async () => {
  if (!editingP || !confirm(`Eliminare "${editingP.name}"?`)) return;
  await deleteDoc(doc(db, "products", editingP.id));
  $("#pDialog").close();
  toast("Prodotto eliminato");
});

// ---------- CATEGORIA ----------
let editingC = null;
function openCategory(c) {
  editingC = c || null;
  $("#cTitle").textContent = c ? "Modifica categoria" : "Nuova categoria";
  $("#cName").value = c?.name || "";
  $("#cEmoji").value = c?.emoji || "";
  $("#cDesc").value = c?.description || "";
  $("#cOrder").value = c?.order ?? (categories.length ? Math.max(...categories.map((x) => x.order ?? 0)) + 1 : 0);
  $("#cVisible").checked = c?.visible !== false;
  $("#cDelete").hidden = !c;
  $("#cDialog").showModal();
}
$("#addCategory").addEventListener("click", () => openCategory(null));
$("#categoryList").addEventListener("click", (e) => {
  const r = e.target.closest("[data-cid]");
  if (r) openCategory(categories.find((c) => c.id === r.dataset.cid));
});
$("#cForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: $("#cName").value.trim(),
    emoji: $("#cEmoji").value.trim(),
    description: $("#cDesc").value.trim(),
    order: parseInt($("#cOrder").value, 10) || 0,
    visible: $("#cVisible").checked
  };
  try {
    if (editingC) await updateDoc(doc(db, "categories", editingC.id), data);
    else await addDoc(collection(db, "categories"), data);
    $("#cDialog").close();
    toast("Categoria salvata ✔");
  } catch (err) { console.error(err); toast("Errore: " + err.code); }
});
$("#cDelete").addEventListener("click", async () => {
  if (!editingC) return;
  const n = products.filter((p) => p.categoryId === editingC.id).length;
  if (n) return toast(`La categoria contiene ${n} prodotti: spostali o eliminali prima.`);
  if (!confirm(`Eliminare la categoria "${editingC.name}"?`)) return;
  await deleteDoc(doc(db, "categories", editingC.id));
  $("#cDialog").close();
  toast("Categoria eliminata");
});

// ---------- NOTE ----------
$("#saveNotes").addEventListener("click", async () => {
  const notes = $("#notesText").value.split("\n").map((s) => s.trim()).filter(Boolean);
  try { await setDoc(doc(db, "settings", "general"), { notes }, { merge: true }); toast("Note salvate ✔"); }
  catch (err) { toast("Errore: " + err.code); }
});

// ---------- IMPORT INIZIALE ----------
$("#seedBtn").addEventListener("click", async () => {
  if (!confirm("Importare il menu iniziale nel database?")) return;
  $("#seedBtn").disabled = true;
  try {
    const seed = await fetch("/seed.json").then((r) => r.json());
    const batch = writeBatch(db);
    seed.categories.forEach(({ id, ...c }) => batch.set(doc(db, "categories", id), { ...c, visible: true }));
    seed.products.forEach(({ id, ...p }) => batch.set(doc(db, "products", id), { ...p, visible: true }));
    batch.set(doc(db, "settings", "general"), { notes: seed.notes, info: seed.info, reviews: seed.reviews, v2: true });
    await batch.commit();
    toast(`Importati ${seed.products.length} prodotti ✔`);
  } catch (err) { console.error(err); toast("Errore import: " + (err.code || err.message)); }
  $("#seedBtn").disabled = false;
});

// ---------- INFO & RECENSIONI ----------
let revs = [], infoLoaded = false;
async function renderInfo() {
  if (infoLoaded || !settings) return;   // non sovrascrivere mentre si modifica
  infoLoaded = true;
  const seed = await seedP;
  const info = { ...seed.info, ...(settings.info || {}) };
  $("#iAddr").value = info.address || "";
  $("#iMaps").value = info.mapsQuery || "";
  $("#iPhone").value = info.phone || "";
  $("#iRating").value = info.googleRating ?? "";
  $("#iCount").value = info.googleCount ?? "";
  $("#iGUrl").value = info.googleUrl || "";
  revs = structuredClone(settings.reviews || seed.reviews || []);
  drawRevs();
}
function drawRevs() {
  $("#revList").innerHTML = revs.map((r, i) => `
    <div class="rev" data-i="${i}">
      <div class="row">
        <label>Nome<input data-k="author" value="${esc(r.author)}"></label>
        <label class="rate">Stelle<select data-k="rating">${[5, 4, 3, 2, 1].map((n) => `<option ${n == r.rating ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <button type="button" class="btn danger sm del">✕</button>
      </div>
      <label>Testo<textarea data-k="text" rows="3">${esc(r.text)}</textarea></label>
    </div>`).join("") || `<p class="hint">Nessuna recensione.</p>`;
}
$("#revList").addEventListener("input", (e) => {
  const k = e.target.dataset.k, i = e.target.closest(".rev")?.dataset.i;
  if (k && i != null) revs[i][k] = k === "rating" ? Number(e.target.value) : e.target.value;
});
$("#revList").addEventListener("click", (e) => {
  if (!e.target.classList.contains("del")) return;
  revs.splice(Number(e.target.closest(".rev").dataset.i), 1);
  drawRevs();
});
$("#addRev").addEventListener("click", () => { revs.unshift({ author: "", rating: 5, text: "" }); drawRevs(); });
$("#saveInfo").addEventListener("click", async () => {
  const info = {
    address: $("#iAddr").value.trim(), mapsQuery: $("#iMaps").value.trim(), phone: $("#iPhone").value.trim(),
    googleRating: parseFloat($("#iRating").value) || 0, googleCount: parseInt($("#iCount").value, 10) || 0,
    googleUrl: $("#iGUrl").value.trim()
  };
  const reviews = revs.filter((r) => r.text?.trim()).map((r) => ({ author: r.author.trim(), rating: r.rating || 5, text: r.text.trim() }));
  try { await setDoc(doc(db, "settings", "general"), { info, reviews }, { merge: true }); toast("Info salvate ✔"); }
  catch (err) { toast("Errore: " + err.code); }
});

// ---------- IMPORT NOVITÀ (caratteristiche, info, recensioni) su database già popolato ----------
$("#v2Btn").addEventListener("click", async () => {
  $("#v2Btn").disabled = true;
  try {
    const seed = await seedP;
    const batch = writeBatch(db);
    const ids = new Set(products.map((p) => p.id));
    seed.products.forEach((p) => {
      if (ids.has(p.id) && p.tags.length) batch.update(doc(db, "products", p.id), { tags: p.tags });
    });
    batch.set(doc(db, "settings", "general"), {
      info: settings?.info || seed.info, reviews: settings?.reviews || seed.reviews, v2: true
    }, { merge: true });
    await batch.commit();
    infoLoaded = false;
    toast("Importazione completata ✔");
  } catch (err) { console.error(err); toast("Errore: " + (err.code || err.message)); }
  $("#v2Btn").disabled = false;
});

// ---------- PDF ----------
// Generato al momento dai dati attuali: ogni modifica al menu è subito inclusa nel PDF.
$("#pdfBtn").addEventListener("click", async () => {
  const btn = $("#pdfBtn");
  btn.disabled = true;
  try {
    const { generateMenuPdf } = await import("./pdf.js");
    const name = await generateMenuPdf({
      categories, products, settings: settings || {}, seed: await seedP,
      onProgress: (m) => (btn.textContent = m.length > 22 ? m.slice(0, 22) + "…" : m)
    });
    toast("PDF scaricato ✔ " + name);
  } catch (err) { console.error(err); toast("Errore PDF: " + err.message); }
  btn.textContent = "📄 PDF";
  btn.disabled = false;
});
