import { loadMenu, formatPrice, TAGS, visibleTags, isFrozen, displayName } from "./firebase.js";
import { loadEN, initialLang, saveLang, ui, tagLabel, localize } from "./i18n.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

$("#yr").textContent = new Date().getFullYear();

// --- Titolo ad arco (stile insegna western) ---
document.querySelectorAll(".hero-title .arc").forEach((row, r) => {
  const letters = [...row.children];
  const n = letters.length;
  letters.forEach((el, i) => {
    const t = (i - (n - 1) / 2) / ((n - 1) / 2 || 1); // -1 .. 1
    const k = r === 0 ? 1 : 0.6;
    el.style.setProperty("--arc", `${(t * t * 0.18 * k).toFixed(3)}em`);
    el.style.setProperty("--rot", `${(t * 9 * k).toFixed(1)}deg`);
    el.style.setProperty("--i", r * 8 + i);
  });
});

// --- Braci che salgono ---
const embers = $(".embers");
for (let i = 0; i < 22; i++) {
  const e = document.createElement("i");
  e.style.left = Math.random() * 100 + "%";
  e.style.animationDuration = 6 + Math.random() * 8 + "s";
  e.style.animationDelay = -Math.random() * 12 + "s";
  e.style.setProperty("--dx", (Math.random() * 80 - 40).toFixed(0) + "px");
  const s = 2 + Math.random() * 3;
  e.style.width = e.style.height = s + "px";
  embers.appendChild(e);
}

// --- Rendering menu ---
let raw, data, lang = initialLang();
const productsById = new Map();

const tagIcons = (p) => {
  const t = visibleTags(p);
  return t.length ? `<span class="tags">${t.map((k) => `<i title="${esc(tagLabel(lang, k))}">${TAGS[k].icon}</i>`).join("")}</span>` : "";
};

function itemHTML(p) {
  const img = p.image
    ? `<div class="item-img"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async"></div>`
    : "";
  const off = p.available === false;
  return `<article class="item reveal ${p.image ? "" : "no-img"} ${off ? "unavailable" : ""}" data-id="${esc(p.id)}">
    ${off ? `<span class="tag-out">${ui(lang, "soldOut")}</span>` : ""}
    ${img}
    <div class="item-body">
      <h3 class="item-name">${esc(displayName(p))}</h3>
      ${p.description ? `<p class="item-desc">${esc(p.description)}</p>` : ""}
      <div class="item-foot">${tagIcons(p)}<span class="price">${formatPrice(p.price)}</span></div>
    </div>
  </article>`;
}

function render(filter = "") {
  const q = filter.trim().toLowerCase();
  const menu = $("#menu");
  let html = "";
  for (const c of data.categories) {
    if (c.visible === false) continue;
    const items = data.products.filter(
      (p) => p.categoryId === c.id && p.visible !== false &&
        (!q || `${p.name} ${p.description}`.toLowerCase().includes(q))
    );
    if (!items.length) continue;
    html += `<section class="cat" id="cat-${esc(c.id)}" data-cat="${esc(c.id)}">
      <header class="cat-head reveal">
        <span class="cat-emoji">${esc(c.emoji || "🐺")}</span>
        <h2 class="cat-title">${esc(c.name)}</h2>
        <div class="cat-rule">✦</div>
        ${c.description ? `<p class="cat-desc">${esc(c.description)}</p>` : ""}
      </header>
      <div class="items">${items.map(itemHTML).join("")}</div>
      ${items.some(isFrozen) ? `<p class="footnote">${ui(lang, "frozenNote")}</p>` : ""}
    </section>`;
  }
  menu.innerHTML = html || `<p class="empty">${ui(lang, "empty")}</p>`;
  document.querySelector(".extra").hidden = !!q;
  observeReveal();
  observeSections();
}

function renderChips() {
  $("#chips").innerHTML = data.categories
    .filter((c) => c.visible !== false && data.products.some((p) => p.categoryId === c.id && p.visible !== false))
    .map((c) => `<a class="chip" href="#cat-${esc(c.id)}" data-cat="${esc(c.id)}">${esc(c.name)}</a>`)
    .join("") +
    `<a class="chip" href="#cat-recensioni" data-cat="recensioni">${ui(lang, "reviewsChip")}</a>` +
    `<a class="chip" href="#cat-dove-siamo" data-cat="dove-siamo">${ui(lang, "whereChip")}</a>` +
    `<a class="chip" href="#cat-allergeni" data-cat="allergeni">${ui(lang, "allergensChip")}</a>`;
}

const stars = (n) => {
  const r = Math.round(n * 2) / 2;
  return [1, 2, 3, 4, 5].map((i) => `<span class="${i <= r ? "on" : i - 0.5 === r ? "half" : ""}">★</span>`).join("");
};

function renderExtra() {
  const info = data.info || {};
  // Recensioni
  if (info.googleRating) {
    $("#rating").innerHTML = `<div class="rating-num">${String(info.googleRating).replace(".", ",")}</div>
      <div><div class="stars big">${stars(info.googleRating)}</div>
      <div class="rating-sub">${info.googleCount || ""} ${ui(lang, "reviewsOn")} <b>Google</b></div></div>`;
  }
  $("#reviews").innerHTML = (data.reviews || []).map((r) => `
    <figure class="review">
      <div class="stars">${stars(r.rating || 5)}</div>
      <blockquote>“${esc(r.text)}”</blockquote>
      <figcaption><span class="avatar">${esc((r.author || "?")[0])}</span>${esc(r.author || "")}<small>via Google</small></figcaption>
    </figure>`).join("");
  $("#gReviews").href = info.googleUrl || "#";
  // Dove siamo
  const q = encodeURIComponent(info.mapsQuery || info.address || "");
  $("#map").src = `https://maps.google.com/maps?q=${q}&z=16&output=embed`;
  $("#addr").innerHTML = `<b>La Tana del Lupo</b><br>${esc(info.address || "")}${info.phone ? `<br><a href="tel:${esc(info.phone.replace(/\s/g, ""))}">${esc(info.phone)}</a>` : ""}`;
  $("#directions").href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  $("#call").href = `tel:${(info.phone || "").replace(/\s/g, "")}`;
  $("#call").hidden = !info.phone;
  // Allergeni
  $("#legend").innerHTML = Object.entries(TAGS).map(([k, t]) => `<span>${t.icon} ${esc(tagLabel(lang, k))}</span>`).join("");
  $("#allergens").innerHTML = (data.allergens || []).map((a, i) => `
    <details class="allergen reveal">
      <summary><span class="a-ico">${a.icon}</span><span class="a-num">${i + 1}</span>${esc(a.name)}</summary>
      <p>${esc(a.description)}</p>
    </details>`).join("");
  if (!autoScrollStarted) { autoScrollStarted = true; autoScrollReviews(); }
}
let autoScrollStarted = false;

// carosello recensioni con scorrimento automatico (si ferma al tocco)
function autoScrollReviews() {
  const box = $("#reviews");
  let paused = false, timer;
  ["pointerdown", "touchstart", "wheel"].forEach((ev) => box.addEventListener(ev, () => {
    paused = true; clearTimeout(timer); timer = setTimeout(() => (paused = false), 6000);
  }, { passive: true }));
  setInterval(() => {
    if (paused || !box.children.length) return;
    const card = box.children[0].getBoundingClientRect().width + 14;
    const end = box.scrollLeft + box.clientWidth >= box.scrollWidth - 4;
    box.scrollTo({ left: end ? 0 : box.scrollLeft + card, behavior: "smooth" });
  }, 4500);
}

function renderNotes() {
  $("#notes").innerHTML = (data.notes || []).map((n) => `<div class="note reveal">${esc(n)}</div>`).join("");
}

// --- Animazioni reveal ---
let revealIO;
function observeReveal() {
  revealIO?.disconnect();
  revealIO = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
    }),
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  document.querySelectorAll(".reveal:not(.in)").forEach((el, i) => {
    const sib = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
    el.style.transitionDelay = `${Math.min(sib % 2, 1) * 70}ms`;
    revealIO.observe(el);
  });
}

// --- Scrollspy chip attiva ---
let spyIO;
function setActive(id) {
  document.querySelectorAll(".chip").forEach((ch) => {
    const on = ch.dataset.cat === id;
    ch.classList.toggle("active", on);
    if (on) {
      const box = $("#chips");
      box.scrollTo({ left: ch.offsetLeft - box.clientWidth / 2 + ch.clientWidth / 2, behavior: "smooth" });
    }
  });
}
function observeSections() {
  spyIO?.disconnect();
  spyIO = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.dataset.cat)),
    { rootMargin: "-40% 0px -55% 0px" }
  );
  document.querySelectorAll(".cat").forEach((s) => spyIO.observe(s));
}

// --- Modale dettaglio ---
const modal = $("#modal");
document.addEventListener("click", (e) => {
  const card = e.target.closest(".item");
  if (card) {
    const p = productsById.get(card.dataset.id);
    if (!p) return;
    $("#mImg").innerHTML = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : "";
    $("#mName").textContent = displayName(p);
    $("#mDesc").textContent = p.description || "";
    const tg = visibleTags(p).map((k) => `<span>${TAGS[k].icon} ${esc(tagLabel(lang, k))}</span>`);
    const al = (p.allergens || []).map((id) => data.allergens?.find((a) => a.id === id)).filter(Boolean)
      .map((a) => `<span class="al">${a.icon} ${esc(a.name)}</span>`);
    $("#mTags").innerHTML = (tg.length ? `<div>${tg.join("")}</div>` : "") +
      (isFrozen(p) ? `<p class="footnote">${ui(lang, "frozenNote")}</p>` : "") +
      (al.length ? `<p class="m-label">${ui(lang, "allergensLabel")}</p><div>${al.join("")}</div>` : "");
    $("#mPrice").innerHTML = `<span class="price">${formatPrice(p.price)}</span>`;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  if (e.target.closest("[data-close]")) closeModal();
});
function closeModal() { modal.hidden = true; document.body.style.overflow = ""; }
document.addEventListener("keydown", (e) => e.key === "Escape" && closeModal());

// --- Ricerca ---
$("#searchBtn").addEventListener("click", () => {
  const box = $("#searchbox");
  box.hidden = !box.hidden;
  if (!box.hidden) { $("#q").focus(); $("#menu").scrollIntoView({ behavior: "smooth" }); }
  else { $("#q").value = ""; render(); }
});
let t;
$("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => render(e.target.value), 150); });

// --- Lingua (IT / EN) ---
// I testi fissi della pagina hanno data-i18n="chiave": salviamo l'italiano e lo sostituiamo con en.json
const staticIT = new Map();
function applyStaticTexts() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.dataset.i18n;
    if (!staticIT.has(el)) staticIT.set(el, el.innerHTML);
    const en = lang === "en" ? EN_UI()?.[k] : null;
    if (k === "tags") {
      const list = lang === "en" ? EN_UI()?.tags : null;
      el.innerHTML = list ? list.map((x) => `<span>${esc(x)}</span>`).join("") : staticIT.get(el);
    } else if (k === "cta") {
      el.innerHTML = en ? `${esc(en)} <span>↓</span>` : staticIT.get(el);
    } else el.innerHTML = en ? esc(en) : staticIT.get(el);
  });
  const q = $("#q");
  q.placeholder = lang === "en" ? EN_UI()?.search || q.placeholder : "Cerca nel menu… (es. bacon, IPA)";
  $("#langBtn").innerHTML = lang === "en" ? "🇮🇹 IT" : "🇬🇧 EN";
  $("#langBtn").setAttribute("aria-label", lang === "en" ? "Passa all'italiano" : "Switch to English");
}
let enData = null;
const EN_UI = () => enData?.ui;

function renderAll() {
  data = localize(raw, lang);
  productsById.clear();
  data.products.forEach((p) => productsById.set(p.id, p));
  applyStaticTexts();
  renderChips();
  render($("#q").value || "");
  renderNotes();
  renderExtra();
  observeReveal();
  observeSections();
}

$("#langBtn").addEventListener("click", async () => {
  lang = lang === "en" ? "it" : "en";
  saveLang(lang);
  if (lang === "en") enData = await loadEN();
  const y = scrollY;
  renderAll();
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
  scrollTo(0, y);
});

// --- Avvio ---
Promise.all([loadMenu(), loadEN()]).then(([menuData, en]) => {
  raw = menuData; enData = en;
  renderAll();
}).catch((err) => {
  console.error(err);
  $("#menu").innerHTML = `<p class="empty">Impossibile caricare il menu. Controlla la connessione e ricarica la pagina.</p>`;
});
