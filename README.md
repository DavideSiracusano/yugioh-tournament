# Yu-Gi-Oh! Tournament Manager

Web app per organizzare tornei **Yu-Gi-Oh!**: iscrizione giocatori, **Swiss**, **Top Cut** ed eliminazione diretta **Quick** (best-of-1), con classifica e tiebreaker (OWP / GWP).

---

## Stack tecnologico

| Categoria | Tecnologia |
|-----------|------------|
| **Linguaggio** | **JavaScript (ES modules)** + **JSX** |
| **UI** | **React 18** (`react`, `react-dom`) |
| **Build & dev server** | **Vite 6** |
| **Plugin React** | `@vitejs/plugin-react` (Fast Refresh, trasformazione JSX) |
| **Markup** | **HTML5** (`index.html` come entry) |
| **Stile** | **CSS** (incluso globalmente nel componente + font **Google Fonts — Cinzel**) |

Niente TypeScript, niente framework CSS esterno: interfaccia costruita con **stili inline** in React e un blocco `<style>` condiviso.

---

## Funzionalità principali

- **Locale** — 4 round Swiss + Top 8, best-of-3  
- **Regionale** — 9 round Swiss + Top 32, best-of-3  
- **Quick** — bracket casuale, eliminazione diretta, best-of-1  

Avatar, nome duellista, deck (con suggerimenti e autocomplete), risultati match e schermata campione.

---

## Requisiti

- [Node.js](https://nodejs.org/) (consigliato LTS)

---

## Avvio in locale

```bash
npm install
npm run dev
```

Apri il browser all’indirizzo indicato da Vite (di solito `http://localhost:5173`).

### Build di produzione

```bash
npm run build
npm run preview
```

---

## Licenza

Progetto personale / uso libero salvo diverse indicazioni del proprietario del repository.
