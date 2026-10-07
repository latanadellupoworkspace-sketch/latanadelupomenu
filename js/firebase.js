// Firebase (SDK modulare via CDN). La apiKey web di Firebase è pubblica per design:
// la sicurezza è garantita dalle regole in firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyD4fOUXW04FQHFti1ObPAD9A52aaQEyvE0",
  authDomain: "menudigitale-3ba26.firebaseapp.com",
  projectId: "menudigitale-3ba26",
  storageBucket: "menudigitale-3ba26.firebasestorage.app",
  messagingSenderId: "44574953668",
  appId: "1:44574953668:web:e0965177ef2f978a5e3991"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const SDK = "https://www.gstatic.com/firebasejs/11.10.0";

export const formatPrice = (n) =>
  "€ " + Number(n || 0).toFixed(2).replace(".", ",");

// Carica il menu: prima Firestore, se vuoto/irraggiungibile usa seed.json
export async function loadMenu() {
  const { collection, getDocs, doc, getDoc } = await import(`${SDK}/firebase-firestore.js`);
  try {
    const [cs, ps, st] = await Promise.all([
      getDocs(collection(db, "categories")),
      getDocs(collection(db, "products")),
      getDoc(doc(db, "settings", "general"))
    ]);
    if (!cs.empty) {
      return {
        source: "firestore",
        categories: cs.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        products: ps.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        notes: st.exists() ? st.data().notes || [] : []
      };
    }
  } catch (e) {
    console.warn("Firestore non disponibile, uso seed.json", e);
  }
  const seed = await fetch("/seed.json").then((r) => r.json());
  return { source: "seed", ...seed };
}
