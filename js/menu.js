import { loadMenu, formatPrice } from "./firebase.js";

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
let data;
const productsById = new Map();

function itemHTML(p) {
  const img = p.image
    ? `<div class="item-img"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async"></div>`
    : "";
  const off = p.available === false;
  return `<article class="item reveal ${p.image ? "" : "no-img"} ${off ? "unavailable" : ""}" data-id="${esc(p.id)}">
    ${off ? '<span class="tag-out">Esaurito</span>' : ""}
    ${img}
    <div class="item-body">
      <h3 class="item-name">${esc(p.name)}</h3>
      ${p.description ? `<p class="item-desc">${esc(p.description)}</p>` : ""}
      <div class="item-foot"><span class="price">${formatPrice(p.price)}</span></div>
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
    </section>`;
  }
  menu.innerHTML = html || `<p class="empty">Nessun prodotto trovato 🐺</p>`;
  observeReveal();
  observeSections();
}

function renderChips() {
  $("#chips").innerHTML = data.categories
    .filter((c) => c.visible !== false && data.products.some((p) => p.categoryId === c.id && p.visible !== false))
    .map((c) => `<a class="chip" href="#cat-${esc(c.id)}" data-cat="${esc(c.id)}">${esc(c.name)}</a>`)
    .join("");
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
    $("#mName").textContent = p.name;
    $("#mDesc").textContent = p.description || "";
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

// --- Avvio ---
data = await loadMenu();
data.products.forEach((p) => productsById.set(p.id, p));
renderChips();
render();
renderNotes();
observeReveal();
