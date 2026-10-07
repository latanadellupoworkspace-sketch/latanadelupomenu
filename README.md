# La Tana del Lupo · Menu Digitale

Sito statico (HTML/CSS/JS) + Firebase (Firestore + Authentication), deploy su Vercel.

- `/` → menu pubblico (mobile-first, categorie, ricerca, animazioni)
- `/gestione-tana` → pannello admin nascosto (login email/password)

## Setup Firebase (una tantum)
1. **Authentication → Sign-in method** → abilita *Email/Password*.
2. **Authentication → Users → Add user** → crea l'account admin.
3. **Firestore Database → Create database** (modalità production).
4. **Firestore → Rules** → incolla il contenuto di `firestore.rules` → *Publish*.
5. **Authentication → Settings → Authorized domains** → aggiungi il dominio Vercel.
6. Apri `/gestione-tana`, fai login e premi **Importa menu iniziale**.

Finché Firestore è vuoto il menu pubblico mostra i dati di `seed.json`.

Le foto caricate dall'admin vengono compresse in WebP nel browser e salvate
nel documento Firestore (non serve Firebase Storage / piano Blaze).
