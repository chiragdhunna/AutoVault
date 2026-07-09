# AutoVault

A **local-first** Chrome extension (Manifest V3) that keeps your
job-application details in a **side panel** so you can copy any field — or a
résumé/cover-letter filename — into an application form in one click.

AutoVault stores multiple named profiles (e.g. *Frontend roles*, *PM roles*)
and **never sends your data anywhere**. It does **not** touch or autofill the
page: you stay in control and paste what you want, where you want. Everything
lives on your device.

---

## ✨ Features

- **Side-panel companion** — click the toolbar icon and AutoVault opens as a
  Chrome side panel next to the application form. It never reads or writes the
  page.
- **One-click copy** — every profile value has a copy button that flashes a
  *Copied!* check; paste it into the form field yourself.
- **Résumé & cover-letter dropdown** — pick a stored document and either **Copy
  filename** or **Preview** it (opens in a new tab from a local blob URL).
- **Search / filter** — type to filter the visible fields by label; matching
  sections expand automatically.
- **Copy all as text** — copy the whole active profile as a clean plain-text
  block for pasting into free-form applications.
- **Multiple profiles** — create, rename, duplicate, delete; switch the active
  profile from the panel or the options page.
- **Complete profile editor** (options page) grouped into collapsible sections:
  Personal, Contact, Links, Work & eligibility, Documents, a custom Q&A bank,
  and a clearly-separated, opt-in EEO / voluntary section.
- **Export / import** your profiles (and documents) as a single JSON file, plus
  a **Delete all my data** button.
- **Optional passphrase encryption** — AES-GCM-256 (Web Crypto) with a
  PBKDF2-derived key encrypts your stored profile at rest; the panel prompts to
  unlock.

---

## 🔒 Where your data is stored (and what never leaves the device)

AutoVault has **no backend**. There are **no external API calls with your data,
no analytics, and no telemetry.** Concretely:

| Data | Storage location | Notes |
|------|------------------|-------|
| Profiles (all text fields, links, Q&A, EEO opt-in) | `chrome.storage.local` | Stays in your browser profile on this machine. |
| Résumé / cover-letter **files** | **IndexedDB** (`autovault` DB) | Files can be large; `chrome.storage` is JSON-serialized and ~5 MB, so document bytes go to IndexedDB instead. |
| Encryption metadata (PBKDF2 salt, verifier) | `chrome.storage.local` | Only present when you enable encryption. The passphrase itself is never stored. |
| Unlocked session key | `chrome.storage.session` (memory only) | Lets the panel & options share one unlock for the browser session; never written to disk. |

When encryption is **on**, the profile payload in `chrome.storage.local` is
AES-GCM ciphertext. A tiny cleartext index (just profile *names*) is kept so the
launcher can show the active profile without unlocking; viewing the fields still
requires the passphrase.

Because AutoVault is a copy-and-reference tool, **it has no access to web pages
at all** — no host permissions, no content scripts, no scripting. Nothing is
ever written to a page by the extension.

---

## 🧱 Tech stack

- **TypeScript** throughout.
- **Vite** build (two self-contained output groups — see below).
- **Preact** (+ `@preact/preset-vite`) for the side panel, popup and options UI
  — tiny runtime, no heavy framework.

The production build produces these artifacts in `dist/`:

| Output | Built by | Format | Why |
|--------|----------|--------|-----|
| `sidepanel.html` / `popup.html` / `options.html` + `assets/*` | `vite.config.ts` | ES modules | Ordinary Preact pages. |
| `background.js` | `vite.background.config.ts` | single IIFE | Classic MV3 service worker, no runtime imports. |

---

## 📁 Project structure

```
AutoVault/
├── public/
│   ├── manifest.json          # MV3 manifest (static)
│   └── icons/                 # 16/32/48/128 PNGs
├── sidepanel.html             # side-panel entry (root, Vite MPA)
├── popup.html                 # launcher popup entry
├── options.html               # options entry
├── src/
│   ├── types/schema.ts        # the full typed data model
│   ├── lib/                   # shared, context-agnostic logic
│   │   ├── storage.ts         # chrome.storage.local + envelope + profile CRUD
│   │   ├── db.ts              # IndexedDB for document blobs
│   │   ├── crypto.ts          # AES-GCM + PBKDF2 (Web Crypto)
│   │   ├── fields.ts          # canonical field keys + value resolver
│   │   └── util.ts, defaults.ts
│   ├── background/service-worker.ts   # seeds storage, opens the side panel
│   ├── sidepanel/             # Sidepanel.tsx, main.tsx, sidepanel.css  (primary UI)
│   ├── popup/                 # Popup.tsx, main.tsx, popup.css  (minimal launcher)
│   └── options/               # Options.tsx, components/, options.css
├── scripts/make-icons.py      # regenerates the icon set
└── vite.config.ts, vite.background.config.ts
```

---

## 🚀 Build & load (unpacked)

**Requirements:** Node 18+ and Chrome/Chromium **116+** (needed for the
`sidePanel` API).

```bash
# 1. install dependencies
npm install

# 2. build the extension  →  outputs to dist/
npm run build

# (optional) type-check the whole project
npm run typecheck
```

Then load it in Chrome:

1. Go to `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select the **`dist/`** folder.
4. Pin **AutoVault** to your toolbar. The options page opens automatically on
   first install — fill in a profile there.
5. Click the toolbar icon to open the **side panel** next to any page.

For live development with hot-reload of the panel/popup/options: `npm run dev`
(you'll still `npm run build` + reload the unpacked extension to exercise the
service worker).

> **Note:** `npm run build` transpiles with esbuild (no type-gate) so the
> extension always builds; run `npm run typecheck` for the full TypeScript check.

---

## 🛡️ Permissions — and why each is requested

| Permission | Why |
|-----------|-----|
| `storage` | Persist profiles/settings locally and share the session unlock. |
| `sidePanel` | Open AutoVault as a side panel when you click the toolbar icon. |

That's the entire permission set. AutoVault requests **no host permissions**,
**no `activeTab`**, and **no `scripting`** — it never reads or modifies web
pages, and no remote code is loaded or executed.

---

## ⚠️ Notes & limitations

- AutoVault **does not fill forms**. By design it's a copy-and-reference tool:
  you copy a field and paste it into the application yourself. This keeps the
  permission surface tiny and puts you fully in control.
- **File inputs** still can't be set by any extension (a browser security rule).
  AutoVault stores your résumé/cover letter locally and lets you copy the
  filename or preview the file, then you attach it manually.
- The side panel reads the active profile from local storage; if encryption is
  on, you'll be prompted to unlock before the fields are shown.

---

## License

MIT. Built as a reference implementation; no warranty.
