// Traduzione inglese del menu.
// Priorità: campi name_en / description_en salvati dall'admin → traduzioni in /en.json → testo italiano.
import { TAGS } from "./firebase.js";

let EN = null;
export async function loadEN() {
  if (!EN) EN = await fetch("/en.json").then((r) => r.json()).catch(() => ({}));
  return EN;
}

// Lingua iniziale: ?lang=en|it, poi scelta salvata, poi lingua del telefono
export function initialLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "it") return q;
  try { const s = localStorage.getItem("lang"); if (s) return s; } catch {}
  return (navigator.language || "it").toLowerCase().startsWith("it") ? "it" : "en";
}
export function saveLang(l) { try { localStorage.setItem("lang", l); } catch {} }

const IT_UI = {
  frozenNote: "* Prodotto surgelato", soldOut: "Esaurito", allergensLabel: "Allergeni",
  empty: "Nessun prodotto trovato 🐺", reviewsOn: "recensioni su",
  reviewsChip: "⭐ Recensioni", whereChip: "📍 Dove siamo", allergensChip: "Allergeni"
};
export const ui = (lang, key) => (lang === "en" && EN?.ui?.[key]) || IT_UI[key] || "";

export const tagLabel = (lang, k) => (lang === "en" && EN?.tags?.[k]) || TAGS[k]?.label || k;

// Restituisce una copia dei dati con i testi nella lingua scelta
export function localize(data, lang) {
  if (lang !== "en" || !EN) return data;
  const P = EN.products || {}, C = EN.categories || {}, N = EN.notes || {}, A = EN.allergens || {};
  return {
    ...data,
    categories: data.categories.map((c) => ({
      ...c,
      name: c.name_en || C[c.id]?.name || c.name,
      description: c.description_en ?? C[c.id]?.description ?? c.description
    })),
    products: data.products.map((p) => ({
      ...p,
      name: p.name_en || P[p.id]?.name || p.name,
      description: p.description_en || P[p.id]?.description || p.description
    })),
    notes: (data.notes || []).map((n) => N[n] || n),
    allergens: (data.allergens || []).map((a) => (A[a.id] ? { ...a, name: A[a.id][0], description: A[a.id][1] } : a))
  };
}
