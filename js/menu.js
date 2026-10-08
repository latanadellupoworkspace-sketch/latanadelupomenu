import { loadMenu, formatPrice, TAGS } from "./firebase.js";

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

const tagIcons = (p) => {
  const t = (p.tags || []).filter((k) => TAGS[k]);
  return t.length ? `<span class="tags">${t.map((k) => `<i title="${esc(TAGS[k].label)}">${TAGS[k].icon}</i>`).join("")}</span>` : "";
};

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
    </section>`;
  }
  menu.innerHTML = html || `<p class="empty">Nessun prodotto trovato 🐺</p>`;
  document.querySelector(".extra").hidden = !!q;
  observeReveal();
  observeSections();
}

function renderChips() {
  $("#chips").innerHTML = data.categories
    .filter((c) => c.visible !== false && data.products.some((p) => p.categoryId === c.id && p.visible !== false))
    .map((c) => `<a class="chip" href="#cat-${esc(c.id)}" data-cat="${esc(c.id)}">${esc(c.name)}</a>`)
    .join("") +
    `<a class="chip" href="#cat-recensioni" data-cat="recensioni">⭐ Recensioni</a>` +
    `<a class="chip" href="#cat-dove-siamo" data-cat="dove-siamo">📍 Dove siamo</a>` +
    `<a class="chip" href="#cat-allergeni" data-cat="allergeni">Allergeni</a>`;
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
      <div class="rating-sub">${info.googleCount || ""} recensioni su <b>Google</b></div></div>`;
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
  $("#legend").innerHTML = Object.values(TAGS).map((t) => `<span>${t.icon} ${esc(t.label)}</span>`).join("");
  $("#allergens").innerHTML = (data.allergens || []).map((a, i) => `
    <details class="allergen reveal">
      <summary><span class="a-ico">${a.icon}</span><span class="a-num">${i + 1}</span>${esc(a.name)}</summary>
      <p>${esc(a.description)}</p>
    </details>`).join("");
  autoScrollReviews();
}

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
    $("#mName").textContent = p.name;
    $("#mDesc").textContent = p.description || "";
    const tg = (p.tags || []).filter((k) => TAGS[k]).map((k) => `<span>${TAGS[k].icon} ${esc(TAGS[k].label)}</span>`);
    const al = (p.allergens || []).map((id) => data.allergens?.find((a) => a.id === id)).filter(Boolean)
      .map((a) => `<span class="al">${a.icon} ${esc(a.name)}</span>`);
    $("#mTags").innerHTML = (tg.length ? `<div>${tg.join("")}</div>` : "") +
      (al.length ? `<p class="m-label">Allergeni</p><div>${al.join("")}</div>` : "");
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
renderExtra();
observeReveal();
observeSections();
