# Testing AutoVault manually

AutoVault is a local, copy-and-reference side panel — it never touches web
pages — so testing is entirely self-contained: seed a profile, open the panel,
and exercise copy / search / documents / profiles / encryption. No live job
postings required.

## 0. Build & load

```bash
npm install
npm run build      # → dist/
```

- `chrome://extensions` → **Developer mode** → **Load unpacked** → select `dist/`.
- After any code change: `npm run build`, then click the **↻ reload** icon on the
  AutoVault card. (Reload matters most for `background.js`.)
- Open the service-worker console via the **"service worker"** link on the
  extension card to see background logs.

## 1. Seed a profile (options page)

1. Open the options page (opens automatically on install, or right-click the
   icon → **Options**).
2. Fill in **Personal**, **Contact**, **Links**, and **Work** with realistic
   values. Changes autosave (watch the "Saved ✓" chip).
3. Upload a résumé (any small PDF) under **Documents** → confirm it shows
   filename + size, and **Preview** opens it in a new tab.
4. Add one **Q&A** pair, e.g. *"Why do you want to work here?" → "…"*.
5. Leave the **EEO / voluntary** toggle **off** for now.

## 2. Open the side panel

- Click the AutoVault toolbar icon on any page. The **side panel** opens on the
  right (it does not inject anything into the page).
- The panel shows: a **Profile** switcher, a **Filter fields** box, a
  **Documents** section, a **Copy all as text** button, and the profile grouped
  into collapsible sections (Personal, Contact, Links, Work, EEO, Q&A Bank).

---

## 3. Copy-field tests

- [ ] Each field row shows its **label** and **value** with a copy button.
- [ ] Click a copy button → it flips to a green check (**Copied!**) for ~1.5s,
      then reverts. Paste into any text editor → the exact value is on the
      clipboard.
- [ ] Empty profile fields are **not** shown (only fields with values appear).
- [ ] **Copy all as text** copies a plain-text block of the whole active
      profile (section headings + `Label: value` lines). Paste to verify.

## 4. Search / filter

- [ ] Type in the **Filter fields** box (e.g. `email`) → only rows whose label
      matches remain, and their sections auto-expand.
- [ ] Clearing the box restores all sections.
- [ ] A no-match query shows the "No fields match your filter." message.

## 5. Documents dropdown

- [ ] The **Documents** section lists the profile's résumé / cover letter in a
      dropdown (labelled e.g. *Résumé — myresume.pdf*).
- [ ] **Copy filename** copies the exact filename (Copied! check).
- [ ] **Preview** opens the stored file in a new browser tab (blob URL).
- [ ] A profile with no documents shows the "No résumé or cover letter saved…"
      hint instead of a dropdown.

## 6. Profiles

- [ ] Create a second profile in options with different values.
- [ ] In the panel, switch the **Profile** dropdown → the fields, documents, and
      "Copy all" output all reflect the newly-selected profile.
- [ ] Duplicate a profile → an independent copy is created. Delete → the active
      profile falls back to another one.

## 7. Launcher popup

- The toolbar icon opens the side panel directly. The popup is a **minimal
  launcher** (active profile name + **Open AutoVault panel** button + a link to
  the options page) and intentionally does **not** duplicate the field list.
- [ ] If shown, the popup reflects the active profile name and its button opens
      the side panel.

---

## 8. Feature tests

**Encryption**
- [ ] Options → **Security** → enable encryption with a passphrase (≥ 8 chars).
      Reload the extension.
- [ ] Open the side panel → it shows a **Locked** state; a wrong passphrase is
      rejected, the correct one reveals the fields.
- [ ] Change passphrase, then turn encryption off → data is readable again.
- [ ] Inspect `chrome://extensions` → service worker → Application → Storage →
      `chrome.storage.local`: the payload is ciphertext while encrypted.

**Export / import / delete**
- [ ] Export JSON downloads a file containing your profiles + base64 documents.
- [ ] Import that file → profiles are added with new ids (no clobbering).
- [ ] **Delete all my data** (double-confirm) wipes storage + IndexedDB and
      reseeds an empty default profile.

---

## 9. Regression sanity

- [ ] `npm run typecheck` passes.
- [ ] `npm run build` produces a `dist/` with `sidepanel.html`, `popup.html`,
      `options.html`, `background.js`, `manifest.json`, and `icons/` — and **no**
      `content.js`.
- [ ] No console errors from AutoVault during a normal browsing session — it
      does nothing until you open the panel, and never runs on web pages.
- [ ] `manifest.json` requests only `storage` and `sidePanel` permissions (no
      host permissions, `activeTab`, or `scripting`).
