# Testing AutoVault manually

AutoVault touches real, third-party application forms, so the most valuable
testing is manual against live postings. This guide walks through setup and a
per-platform checklist.

## 0. Build & load

```bash
npm install
npm run build      # → dist/
```

- `chrome://extensions` → **Developer mode** → **Load unpacked** → select `dist/`.
- After any code change: `npm run build`, then click the **↻ reload** icon on the AutoVault card. (Reload matters most for `content.js` / `background.js`.)
- Open the service-worker console via the **"service worker"** link on the extension card to see background logs.

## 1. Seed a profile

1. Open the options page (opens automatically on install, or right-click the icon → **Options**).
2. Fill in **Personal**, **Contact**, **Links**, and **Work** with realistic values. Changes autosave (watch the "Saved ✓" chip).
3. Upload a résumé (any small PDF) under **Documents** → confirm it shows filename + size, and **Preview** opens it in a new tab.
4. Add one **Q&A** pair, e.g. *"Why do you want to work here?" → "…"*.
5. Leave the **EEO / voluntary** toggle **off** for now.

## 2. Popup smoke test

- Click the toolbar icon on any normal web page. The popup shows the active profile, a detected-ATS chip ("Generic form" off-ATS), and **⚡ Autofill this page**.
- The quick profile switcher changes the active profile immediately.

---

## 3. Per-platform tests

For each, open a **real job posting's application page** (search the platform for
any open role), then click **Autofill this page** in the popup.

### Greenhouse  (`boards.greenhouse.io`, `job-boards.greenhouse.io`)
Good first target — clean labels/ids.
- [ ] First name, Last name, Email, Phone fill correctly.
- [ ] LinkedIn / Website custom questions fill (label-matched).
- [ ] The résumé file input gets a dashed outline + **"Attach your résumé here"** tooltip; **Copy filename** copies the stored filename.
- [ ] Filled fields flash green.
- [ ] Popup reports a plausible "*N fields filled*".

### Lever  (`jobs.lever.co`)
Uses stable field names (`name`, `email`, `phone`, `org`, `urls[...]`).
- [ ] Full name (single field), Email, Phone fill.
- [ ] Current company (`org`) fills.
- [ ] LinkedIn / GitHub / Portfolio URL fields fill via the `urls[...]` names.
- [ ] "Additional information" textarea: if it matches a Q&A question, it fills; otherwise it's left alone.

### Workday  (`*.myworkdayjobs.com`)
React app keyed by `data-automation-id`; multi-step.
- [ ] On the **My Information** step, First/Last name, Email, Phone fill.
- [ ] Address line 1, City, Postal code fill (text inputs).
- [ ] **Expected:** custom popup **dropdowns** (Country, State) are *not* auto-set — this is a documented limitation.
- [ ] Advancing to a later step re-fills newly-rendered text fields (MutationObserver).

### iCIMS  (`*.icims.com`)
Often an iframe with opaque ids; relies on label matching + `all_frames`.
- [ ] First/Last name, Email, Phone fill via visible labels.
- [ ] If the form is inside an iframe, filling still works (content script runs in all frames).

### LinkedIn Easy Apply  (`www.linkedin.com`)
- [ ] Open a job with the **Easy Apply** button and start it (the modal appears).
- [ ] Phone number / email prefill only inside the **modal** — verify the page's global search bar is **never** touched (adapter scopes to the dialog).
- [ ] Clicking **Next** to a new step fills fields that render on that step.

---

## 4. Feature tests

**Controlled-input correctness (React/Vue)**
- [ ] On any React ATS (Greenhouse/Workday), after autofill, click into a filled field and blur it — the value persists and no "required" validation error re-appears (proves `input`/`change` dispatched).

**Selects / radios / checkboxes**
- [ ] A `<select>` (e.g. Country) picks the option matching your stored value via fuzzy match.
- [ ] A Yes/No radio (e.g. "Do you require sponsorship?") selects the option matching your Work setting.

**Multiple profiles**
- [ ] Create a second profile, give it different values, switch active in the popup, autofill again → the second profile's values appear.
- [ ] Duplicate a profile → an independent copy is created. Delete → active falls back to another profile.

**EEO / voluntary (opt-in)**
- [ ] With the voluntary toggle **off**, autofill on a form with gender/veteran/disability fields → those are **not** filled.
- [ ] Turn the toggle **on**, set values, autofill → they fill.

**File hints**
- [ ] With no résumé uploaded, the file hint reads "Attach your résumé here" (no filename button).
- [ ] With a résumé uploaded, the **Copy filename** button copies the exact filename.

**Encryption**
- [ ] Options → **Security** → enable encryption with a passphrase (≥ 8 chars). Reload the extension.
- [ ] Reopen options → you're prompted to **unlock**; wrong passphrase is rejected, correct one decrypts.
- [ ] The popup shows the active profile name while locked, but **Autofill** requires unlocking.
- [ ] Change passphrase, then turn encryption off → data is readable again.
- [ ] Inspect `chrome://extensions` → service worker → Application → Storage → `chrome.storage.local`: the payload is ciphertext while encrypted.

**Export / import / delete**
- [ ] Export JSON downloads a file containing your profiles + base64 documents.
- [ ] Import that file → profiles are added with new ids (no clobbering).
- [ ] **Delete all my data** (double-confirm) wipes storage + IndexedDB and reseeds an empty default profile.

**Custom domains**
- [ ] Options → **Custom domains** → add a host (e.g. a company careers page). Approve Chrome's per-domain permission prompt.
- [ ] Navigate there and use the popup → autofill runs. Remove the domain → permission is revoked and the dynamic script unregisters.

**On-demand injection (activeTab)**
- [ ] On a non-ATS page that still has a contact-style form, click **Autofill** → the popup injects `content.js` (no standing host permission) and fills matching fields. On a restricted page (e.g. `chrome://`), the popup reports it can't run there.

---

## 5. Regression sanity

- [ ] `npm run typecheck` passes.
- [ ] No console errors from AutoVault on a normal browsing session (content script is silent until invoked, except opt-in auto-fill-on-load on ATS domains).
- [ ] Re-invoking autofill on an already-filled page does not duplicate values or wipe user edits (existing non-empty fields are skipped).
