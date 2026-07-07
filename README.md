# AutoVault

A secure, **local-first** Chrome extension (Manifest V3) that remembers your
job-application details once and fills any application form in a click.

AutoVault stores multiple named profiles (e.g. *Frontend roles*, *PM roles*),
autofills forms across the major Applicant Tracking Systems, and — importantly —
**never sends your data anywhere**. Everything lives on your device.

---

## ✨ Features

- **Multiple profiles** — create, rename, duplicate, delete; one is always the active default.
- **Complete profile editor** (options page) grouped into collapsible sections: Personal, Contact, Links, Work & eligibility, Documents, a custom Q&A bank, and a clearly-separated, opt-in EEO / voluntary section.
- **One-click autofill** from the popup, with a live "*N fields filled*" status.
- **Smart field matching** — scores each form field against your profile using its `<label>`, `name`/`id`/`aria-label`/`placeholder`, nearby text, and `autocomplete` attribute, backed by a synonym dictionary (e.g. *mobile / cell / telephone → phone*).
- **Framework-safe filling** — sets values through the native `HTMLInputElement`/`HTMLTextAreaElement`/`HTMLSelectElement` setters and dispatches `input` + `change` (+ `focusout`) so React/Vue/Angular controlled inputs update correctly.
- **Handles every control type** — text, textarea, `<select>` (fuzzy option matching), radio groups, and checkboxes.
- **Async-form aware** — a `MutationObserver` keeps filling fields that render later (SPA forms, Workday steps, LinkedIn Easy Apply multi-step modals).
- **ATS-tuned adapters** for **Greenhouse, Lever, Workday, iCIMS, and LinkedIn Easy Apply**.
- **File inputs done honestly** — browsers forbid extensions from setting file inputs, so AutoVault highlights the résumé/cover-letter field and shows a *"Attach your résumé here"* tooltip with a one-click **Copy filename** helper (no fake-setting).
- **Review before submit** — filled fields flash a green outline so you can eyeball them.
- **Export / import** your profiles (and documents) as a single JSON file, plus a **Delete all my data** button.
- **Optional passphrase encryption** — AES-GCM-256 (Web Crypto) with a PBKDF2-derived key encrypts your stored profile at rest.

---

## 🔒 Where your data is stored (and what never leaves the device)

AutoVault has **no backend**. There are **no external API calls with your data, no analytics, and no telemetry.** Concretely:

| Data | Storage location | Notes |
|------|------------------|-------|
| Profiles (all text fields, links, Q&A, EEO opt-in) | `chrome.storage.local` | Stays in your browser profile on this machine. |
| Résumé / cover-letter **files** | **IndexedDB** (`autovault` DB) | Files can be large; `chrome.storage` is JSON-serialized and ~5 MB, so document bytes go to IndexedDB instead. |
| Encryption metadata (PBKDF2 salt, verifier) | `chrome.storage.local` | Only present when you enable encryption. The passphrase itself is never stored. |
| Unlocked session key | `chrome.storage.session` (memory only) | Lets the popup & options share one unlock for the browser session; never written to disk; not exposed to content scripts. |

When encryption is **on**, the profile payload in `chrome.storage.local` is
AES-GCM ciphertext. A tiny cleartext index (just profile *names*) is kept so the
popup can show the active profile without unlocking; autofill still requires the
passphrase.

The only thing AutoVault ever writes to a web page is the values **you** stored,
into the form fields on the tab **you** invoked it on.

---

## 🧱 Tech stack

- **TypeScript** throughout.
- **Vite** build (three self-contained outputs — see below). No CRXJS: building the content script and service worker as plain IIFEs keeps them injectable via `chrome.scripting` and free of module/loader concerns.
- **Preact** (+ `@preact/preset-vite`) for the popup and options UI — tiny runtime, no heavy framework.
- **Vanilla TypeScript** in the content script — zero UI framework injected into pages, minimal overhead.

The production build produces three artifacts in `dist/`:

| Output | Built by | Format | Why |
|--------|----------|--------|-----|
| `popup.html` / `options.html` + `assets/*` | `vite.config.ts` | ES modules | Ordinary Preact pages. |
| `content.js` | `vite.content.config.ts` | single IIFE | Declared for known ATS domains **and** injectable on demand for any tab / custom domain. |
| `background.js` | `vite.background.config.ts` | single IIFE | Classic MV3 service worker, no runtime imports. |

---

## 📁 Project structure

```
AutoVault/
├── public/
│   ├── manifest.json          # MV3 manifest (static)
│   └── icons/                 # 16/32/48/128 PNGs
├── popup.html                 # popup entry (root, Vite MPA)
├── options.html               # options entry
├── src/
│   ├── types/schema.ts        # the full typed data model
│   ├── lib/                   # shared, context-agnostic logic
│   │   ├── storage.ts         # chrome.storage.local + envelope + profile CRUD
│   │   ├── db.ts              # IndexedDB for document blobs
│   │   ├── crypto.ts          # AES-GCM + PBKDF2 (Web Crypto)
│   │   ├── domains.ts         # custom-domain permissions + dynamic scripts
│   │   ├── fields.ts          # canonical field keys + value resolver
│   │   ├── payload.ts         # profile → fill payload
│   │   ├── ats.ts             # ATS detection
│   │   └── util.ts, defaults.ts
│   ├── background/service-worker.ts
│   ├── popup/                 # Popup.tsx, main.tsx, popup.css
│   ├── options/               # Options.tsx, components/, options.css
│   ├── content/               # autofill engine (vanilla TS)
│   │   ├── index.ts           # entry: messaging, idempotent init
│   │   ├── matcher.ts         # signal extraction + scoring
│   │   ├── synonyms.ts        # synonym dictionary
│   │   ├── filler.ts          # native setters + fuzzy option matching
│   │   ├── highlight.ts       # green-outline + file-input hints
│   │   ├── observer.ts        # MutationObserver re-fill
│   │   ├── engine.ts          # orchestration
│   │   └── adapters/          # greenhouse, lever, workday, icims, linkedin
│   └── shared/messages.ts     # cross-context message contract
├── scripts/make-icons.py      # regenerates the icon set
└── vite.config.ts, vite.content.config.ts, vite.background.config.ts
```

---

## 🚀 Build & load (unpacked)

**Requirements:** Node 18+ and Chrome/Chromium **116+** (needed for
`optional_host_permissions` + dynamic content-script registration).

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
4. Pin **AutoVault** to your toolbar. The options page opens automatically on first install — fill in a profile there.

For live development with hot-reload of the popup/options: `npm run dev`
(you'll still `npm run build` + reload the unpacked extension to exercise the
content script and service worker).

> **Note:** `npm run build` transpiles with esbuild (no type-gate) so the
> extension always builds; run `npm run typecheck` for the full TypeScript check.

---

## 🛡️ Permissions — and why each is requested

| Permission | Why |
|-----------|-----|
| `storage` | Persist profiles/settings locally and share the session unlock. |
| `activeTab` | Lets the popup inject/run autofill on the tab you're looking at **when you click** — no standing access to your browsing. |
| `scripting` | Inject `content.js` on demand and register content scripts for custom domains you add. |
| `host_permissions` for `*.greenhouse.io`, `*.lever.co`, `*.myworkdayjobs.com`, `*.icims.com`, `*.linkedin.com` | Auto-run the content script on the supported ATS platforms. |
| `optional_host_permissions` | **Not requested up front.** When you add a custom domain in options, Chrome asks you to grant access to *just that one domain*. AutoVault never holds `<all_urls>`. |

No remote code is loaded or executed; there are no `<all_urls>` host permissions.

### Custom domains

Applying on a career site that isn't one of the built-in five? Options →
**Custom domains** → enter the host (e.g. `careers.acme.com`). Chrome prompts for
that single origin, and AutoVault registers the content script there.

---

## ⚠️ Known limitations

- **Workday custom dropdowns** are bespoke widgets (not native `<select>`); AutoVault fills Workday's text inputs (name, email, phone, address) reliably but leaves those popup dropdowns to you.
- **File inputs are never auto-set** — this is a browser security rule, not a gap. AutoVault flags the field and offers to copy the filename.
- Auto-fill-on-load (opt-in) only runs on the five built-in ATS domains and only when the vault is unlocked/unencrypted.
- Field matching is heuristic; always review the highlighted fields before submitting.

---

## License

MIT. Built as a reference implementation; no warranty.
