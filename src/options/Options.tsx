import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AutoVaultStore, JobProfile, DocumentMeta, SocialLink, QAPair } from '../types/schema';
import {
  loadStore,
  saveStore,
  ensureInitialized,
  isEncrypted,
  isUnlocked,
  unlock,
  lock,
  enableEncryption,
  disableEncryption,
  changePassphrase,
  createProfile,
  renameProfile,
  duplicateProfile,
  deleteProfile,
  setActiveProfile,
  attachDocument,
  removeDocument,
  exportJSON,
  importJSON,
  deleteAllData,
} from '../lib/storage';
import { getDocumentObjectUrl } from '../lib/db';
import { addCustomDomain, removeCustomDomain } from '../lib/domains';
import { clone, debounce, humanFileSize, uuid } from '../lib/util';
import { Section } from './components/Section';
import { FieldGrid, TextField, TextAreaField, SelectField, Toggle } from './components/fields';

type Phase = 'loading' | 'locked' | 'ready';
type SaveState = 'idle' | 'saving' | 'saved';

const WORK_AUTH_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'us_citizen', label: 'U.S. Citizen' },
  { value: 'permanent_resident', label: 'Permanent Resident (Green Card)' },
  { value: 'visa_authorized', label: 'Authorized to work on a visa' },
  { value: 'need_sponsorship', label: 'Require sponsorship' },
  { value: 'other', label: 'Other' },
];
const YES_NO_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
const PERIOD_OPTIONS = [
  { value: 'year', label: 'per year' },
  { value: 'month', label: 'per month' },
  { value: 'hour', label: 'per hour' },
];
const GENDER_OPTIONS = [
  { value: '', label: '— Prefer not to set —' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'decline', label: 'Decline to self-identify' },
];
const VETERAN_OPTIONS = [
  { value: '', label: '— Prefer not to set —' },
  { value: 'not_veteran', label: 'Not a protected veteran' },
  { value: 'veteran', label: 'Veteran' },
  { value: 'protected_veteran', label: 'Protected veteran' },
  { value: 'decline', label: 'Decline to self-identify' },
];
const DISABILITY_OPTIONS = [
  { value: '', label: '— Prefer not to set —' },
  { value: 'yes', label: 'Yes, I have a disability' },
  { value: 'no', label: 'No, I do not have a disability' },
  { value: 'decline', label: "I don't wish to answer" },
];

export function Options() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [store, setStore] = useState<AutoVaultStore | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const fileResumeRef = useRef<HTMLInputElement>(null);
  const fileCoverRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const scheduleSave = useMemo(
    () =>
      debounce((s: AutoVaultStore) => {
        setSaveState('saving');
        saveStore(s)
          .then(() => {
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 1200);
          })
          .catch((err) => {
            console.error('AutoVault save failed', err);
            setSaveState('idle');
          });
      }, 450),
    [],
  );

  async function boot() {
    await ensureInitialized();
    if ((await isEncrypted()) && !(await isUnlocked())) {
      setPhase('locked');
      return;
    }
    setStore(await loadStore());
    setPhase('ready');
  }

  useEffect(() => {
    void boot();
  }, []);

  const active: JobProfile | undefined = store?.profiles.find((p) => p.id === store.activeProfileId);

  /** Immutably patch the active profile and schedule a debounced save. */
  function update(mutate: (profile: JobProfile) => void) {
    setStore((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      const profile = next.profiles.find((p) => p.id === next.activeProfileId);
      if (profile) {
        mutate(profile);
        profile.updatedAt = Date.now();
        scheduleSave(next);
      }
      return next;
    });
  }

  function updateStore(mutate: (store: AutoVaultStore) => void) {
    setStore((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      mutate(next);
      scheduleSave(next);
      return next;
    });
  }

  async function reload() {
    setStore(await loadStore());
  }

  /* ---------------- profile actions ---------------- */
  async function onSwitchProfile(id: string) {
    await setActiveProfile(id);
    await reload();
  }
  async function onNewProfile() {
    const name = window.prompt('Name for the new profile', 'New profile');
    if (name === null) return;
    const p = await createProfile(name.trim() || 'New profile');
    await setActiveProfile(p.id);
    await reload();
  }
  async function onRenameProfile() {
    if (!active) return;
    const name = window.prompt('Rename profile', active.name);
    if (name === null) return;
    await renameProfile(active.id, name.trim() || active.name);
    await reload();
  }
  async function onDuplicateProfile() {
    if (!active) return;
    const copy = await duplicateProfile(active.id);
    if (copy) {
      await setActiveProfile(copy.id);
      await reload();
    }
  }
  async function onDeleteProfile() {
    if (!active || !store) return;
    if (!window.confirm(`Delete profile “${active.name}”? This cannot be undone.`)) return;
    await deleteProfile(active.id);
    await reload();
  }

  /* ---------------- documents ---------------- */
  async function onPickFile(kind: DocumentMeta['kind'], input: HTMLInputElement | null) {
    if (!active || !input?.files?.length) return;
    await attachDocument(active.id, kind, input.files[0]);
    input.value = '';
    await reload();
  }
  async function onPreview(doc: DocumentMeta) {
    const url = await getDocumentObjectUrl(doc.blobKey);
    if (url) window.open(url, '_blank', 'noopener');
  }
  async function onRemoveDoc(doc: DocumentMeta) {
    if (!active) return;
    await removeDocument(active.id, doc.id);
    await reload();
  }

  /* ---------------- data ---------------- */
  function downloadText(filename: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function onExport() {
    const json = await exportJSON();
    downloadText(`autovault-export-${new Date().toISOString().slice(0, 10)}.json`, json);
  }
  async function onImportFile(input: HTMLInputElement | null) {
    if (!input?.files?.length) return;
    const text = await input.files[0].text();
    input.value = '';
    try {
      const { imported } = await importJSON(text);
      await reload();
      window.alert(`Imported ${imported} profile${imported === 1 ? '' : 's'}.`);
    } catch (err) {
      window.alert(`Import failed: ${(err as Error).message}`);
    }
  }
  async function onDeleteAll() {
    if (!window.confirm('Delete ALL AutoVault data (every profile, documents, and settings)? This cannot be undone.')) return;
    if (!window.confirm('Final confirmation — permanently erase everything?')) return;
    await deleteAllData();
    await lock();
    await boot();
  }

  if (phase === 'loading') {
    return <div class="av-splash">Loading AutoVault…</div>;
  }
  if (phase === 'locked') {
    return <UnlockScreen onUnlocked={boot} />;
  }
  if (!store || !active) {
    return <div class="av-splash">No profile found.</div>;
  }

  return (
    <div class="av-app">
      <header class="av-topbar">
        <div class="av-brand">
          <span class="av-logo">🔐</span>
          <div>
            <h1>AutoVault</h1>
            <p class="av-tagline">Your job-application profile — stored locally, filled in one click.</p>
          </div>
        </div>
        <div class={`av-savechip av-savechip--${saveState}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'All changes saved locally'}
        </div>
      </header>

      <div class="av-profilebar">
        <label class="av-field av-field--inline">
          <span class="av-field__label">Active profile</span>
          <select
            class="av-input av-select"
            value={store.activeProfileId ?? ''}
            onChange={(e) => onSwitchProfile((e.target as HTMLSelectElement).value)}
          >
            {store.profiles.map((p) => (
              <option value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <div class="av-profilebar__actions">
          <button class="av-btn" onClick={onNewProfile}>New</button>
          <button class="av-btn" onClick={onRenameProfile}>Rename</button>
          <button class="av-btn" onClick={onDuplicateProfile}>Duplicate</button>
          <button class="av-btn av-btn--danger-ghost" onClick={onDeleteProfile}>Delete</button>
        </div>
      </div>

      <main class="av-main">
        {/* Personal */}
        <Section title="Personal" subtitle="Name & how you're addressed">
          <FieldGrid>
            <TextField label="Full name" value={active.personal.fullName} onInput={(v) => update((p) => (p.personal.fullName = v))} placeholder="Jordan Rivera" />
            <TextField label="Preferred name" value={active.personal.preferredName} onInput={(v) => update((p) => (p.personal.preferredName = v))} placeholder="Jordan" />
            <TextField label="Pronouns (optional)" value={active.personal.pronouns} onInput={(v) => update((p) => (p.personal.pronouns = v))} placeholder="she/her, he/him, they/them" />
          </FieldGrid>
        </Section>

        {/* Contact */}
        <Section title="Contact" subtitle="Phone, email & address">
          <FieldGrid>
            <TextField label="Phone" type="tel" value={active.contact.phone} onInput={(v) => update((p) => (p.contact.phone = v))} placeholder="+1 555 123 4567" />
            <TextField label="Email" type="email" value={active.contact.email} onInput={(v) => update((p) => (p.contact.email = v))} placeholder="jordan@example.com" />
          </FieldGrid>
          <FieldGrid cols={1}>
            <TextField label="Street address" value={active.contact.streetAddress} onInput={(v) => update((p) => (p.contact.streetAddress = v))} placeholder="123 Market St" />
            <TextField label="Address line 2 (optional)" value={active.contact.addressLine2} onInput={(v) => update((p) => (p.contact.addressLine2 = v))} placeholder="Apt 4B" />
          </FieldGrid>
          <FieldGrid cols={3}>
            <TextField label="City" value={active.contact.city} onInput={(v) => update((p) => (p.contact.city = v))} />
            <TextField label="State / Region" value={active.contact.state} onInput={(v) => update((p) => (p.contact.state = v))} />
            <TextField label="ZIP / Postal code" value={active.contact.zip} onInput={(v) => update((p) => (p.contact.zip = v))} />
          </FieldGrid>
          <FieldGrid cols={1}>
            <TextField label="Country" value={active.contact.country} onInput={(v) => update((p) => (p.contact.country = v))} placeholder="United States" />
          </FieldGrid>
        </Section>

        {/* Links */}
        <Section title="Links" subtitle="LinkedIn, GitHub, portfolio & more">
          <FieldGrid>
            <TextField label="LinkedIn" type="url" value={active.links.linkedin} onInput={(v) => update((p) => (p.links.linkedin = v))} placeholder="https://linkedin.com/in/…" />
            <TextField label="GitHub" type="url" value={active.links.github} onInput={(v) => update((p) => (p.links.github = v))} placeholder="https://github.com/…" />
            <TextField label="Portfolio / Website" type="url" value={active.links.portfolio} onInput={(v) => update((p) => (p.links.portfolio = v))} placeholder="https://…" />
          </FieldGrid>
          <LinksEditor
            links={active.links.other}
            onChange={(next) => update((p) => (p.links.other = next))}
          />
        </Section>

        {/* Work */}
        <Section title="Work & eligibility" subtitle="Role, experience, comp & authorization">
          <FieldGrid>
            <TextField label="Current title" value={active.work.currentTitle} onInput={(v) => update((p) => (p.work.currentTitle = v))} placeholder="Senior Frontend Engineer" />
            <TextField label="Current employer" value={active.work.currentEmployer} onInput={(v) => update((p) => (p.work.currentEmployer = v))} placeholder="Acme Inc." />
            <TextField label="Years of experience" value={active.work.yearsOfExperience} onInput={(v) => update((p) => (p.work.yearsOfExperience = v))} placeholder="6" />
          </FieldGrid>
          <FieldGrid cols={3}>
            <TextField label="Desired salary — min" value={active.work.desiredSalary.min} onInput={(v) => update((p) => (p.work.desiredSalary.min = v))} placeholder="120000" />
            <TextField label="Desired salary — max" value={active.work.desiredSalary.max} onInput={(v) => update((p) => (p.work.desiredSalary.max = v))} placeholder="150000" />
            <SelectField label="Period" value={active.work.desiredSalary.period} options={PERIOD_OPTIONS} onInput={(v) => update((p) => (p.work.desiredSalary.period = v as JobProfile['work']['desiredSalary']['period']))} />
          </FieldGrid>
          <FieldGrid cols={3}>
            <TextField label="Currency" value={active.work.desiredSalary.currency} onInput={(v) => update((p) => (p.work.desiredSalary.currency = v))} placeholder="USD" />
            <SelectField label="Work authorization" value={active.work.workAuthorization} options={WORK_AUTH_OPTIONS} onInput={(v) => update((p) => (p.work.workAuthorization = v as JobProfile['work']['workAuthorization']))} />
            <SelectField label="Requires sponsorship?" value={active.work.requiresSponsorship} options={YES_NO_OPTIONS} onInput={(v) => update((p) => (p.work.requiresSponsorship = v as JobProfile['work']['requiresSponsorship']))} />
          </FieldGrid>
          {active.work.workAuthorization === 'other' && (
            <FieldGrid cols={1}>
              <TextField label="Describe your work authorization" value={active.work.workAuthorizationOther} onInput={(v) => update((p) => (p.work.workAuthorizationOther = v))} />
            </FieldGrid>
          )}
          <FieldGrid>
            <TextField label="Notice period" value={active.work.noticePeriod} onInput={(v) => update((p) => (p.work.noticePeriod = v))} placeholder="2 weeks" />
            <TextField label="Start date availability" value={active.work.startDateAvailability} onInput={(v) => update((p) => (p.work.startDateAvailability = v))} placeholder="Immediately / 2026-09-01" />
          </FieldGrid>
        </Section>

        {/* Documents */}
        <Section title="Documents" subtitle="Résumé & cover letter (stored in IndexedDB on this device)">
          <p class="av-note">
            Browsers block extensions from auto-attaching files for security. AutoVault stores your files
            locally and, on file-upload fields, points you to the right spot with a one-click filename copy.
          </p>
          <DocumentRow
            label="Résumé / CV"
            doc={active.documents.find((d) => d.kind === 'resume')}
            onPick={() => fileResumeRef.current?.click()}
            onPreview={onPreview}
            onRemove={onRemoveDoc}
          />
          <input ref={fileResumeRef} type="file" hidden accept=".pdf,.doc,.docx,.txt,.rtf,.odt" onChange={() => onPickFile('resume', fileResumeRef.current)} />
          <DocumentRow
            label="Cover letter"
            doc={active.documents.find((d) => d.kind === 'coverLetter')}
            onPick={() => fileCoverRef.current?.click()}
            onPreview={onPreview}
            onRemove={onRemoveDoc}
          />
          <input ref={fileCoverRef} type="file" hidden accept=".pdf,.doc,.docx,.txt,.rtf,.odt" onChange={() => onPickFile('coverLetter', fileCoverRef.current)} />
        </Section>

        {/* Q&A */}
        <Section title="Custom Q&A bank" subtitle="Reusable answers to recurring free-text questions" defaultOpen={false}>
          <QAEditor qa={active.qa} onChange={(next) => update((p) => (p.qa = next))} />
        </Section>

        {/* Voluntary / EEO — visually + structurally separated */}
        <Section
          title="Voluntary self-identification (EEO)"
          subtitle="Entirely optional • never filled unless you opt in below"
          tone="sensitive"
          defaultOpen={false}
        >
          <p class="av-note av-note--sensitive">
            These fields are optional under U.S. equal-employment-opportunity reporting. AutoVault keeps them
            in a separate section and <strong>will not autofill them</strong> unless you explicitly enable the
            toggle below for this profile.
          </p>
          <Toggle
            label="Autofill these voluntary fields for this profile"
            checked={active.fillVoluntary}
            onChange={(c) => update((p) => (p.fillVoluntary = c))}
          />
          <div class={active.fillVoluntary ? '' : 'av-dim'}>
            <FieldGrid>
              <TextField label="Race / ethnicity" value={active.voluntary.raceEthnicity} onInput={(v) => update((p) => (p.voluntary.raceEthnicity = v))} placeholder="e.g. Two or more races" />
              <SelectField label="Gender identity" value={active.voluntary.genderIdentity} options={GENDER_OPTIONS} onInput={(v) => update((p) => (p.voluntary.genderIdentity = v as JobProfile['voluntary']['genderIdentity']))} />
            </FieldGrid>
            <FieldGrid>
              <SelectField label="Veteran status" value={active.voluntary.veteranStatus} options={VETERAN_OPTIONS} onInput={(v) => update((p) => (p.voluntary.veteranStatus = v as JobProfile['voluntary']['veteranStatus']))} />
              <SelectField label="Disability status" value={active.voluntary.disabilityStatus} options={DISABILITY_OPTIONS} onInput={(v) => update((p) => (p.voluntary.disabilityStatus = v as JobProfile['voluntary']['disabilityStatus']))} />
            </FieldGrid>
          </div>
        </Section>

        {/* Preferences */}
        <Section title="Autofill preferences" defaultOpen={false}>
          <Toggle label="Highlight filled fields briefly after autofill" checked={store.settings.highlightFilled} onChange={(c) => updateStore((s) => (s.settings.highlightFilled = c))} />
          <Toggle label="Show “Attach your résumé here” hints on file inputs" checked={store.settings.showFileHints} onChange={(c) => updateStore((s) => (s.settings.showFileHints = c))} />
          <Toggle label="Auto-fill automatically when a recognized ATS page loads" hint="Off by default — you stay in control and trigger fills from the popup." checked={store.settings.autofillOnLoad} onChange={(c) => updateStore((s) => (s.settings.autofillOnLoad = c))} />
        </Section>

        {/* Security */}
        <Section title="Security — passphrase encryption" defaultOpen={false}>
          <EncryptionPanel encrypted={store.settings.encryption.enabled} onChanged={boot} />
        </Section>

        {/* Custom domains */}
        <Section title="Custom domains" subtitle="Enable AutoVault on career sites beyond the built-in ATS list" defaultOpen={false}>
          <CustomDomains store={store} onChanged={reload} />
        </Section>

        {/* Data */}
        <Section title="Your data" defaultOpen={false}>
          <div class="av-datarow">
            <div>
              <strong>Export</strong>
              <p class="av-field__hint">Download all profiles + documents as a single JSON file.</p>
            </div>
            <button class="av-btn" onClick={onExport}>Export JSON</button>
          </div>
          <div class="av-datarow">
            <div>
              <strong>Import</strong>
              <p class="av-field__hint">Add profiles from a previously exported JSON file.</p>
            </div>
            <button class="av-btn" onClick={() => importRef.current?.click()}>Import JSON</button>
            <input ref={importRef} type="file" hidden accept="application/json,.json" onChange={() => onImportFile(importRef.current)} />
          </div>
          <div class="av-datarow av-datarow--danger">
            <div>
              <strong>Delete all my data</strong>
              <p class="av-field__hint">Erase every profile, document, and setting from this device.</p>
            </div>
            <button class="av-btn av-btn--danger" onClick={onDeleteAll}>Delete everything</button>
          </div>
        </Section>
      </main>

      <footer class="av-footer">
        AutoVault stores everything on this device only — in <code>chrome.storage.local</code> and IndexedDB.
        No servers, no analytics, no telemetry. Nothing you enter here ever leaves your browser.
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function UnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const ok = await unlock(pass);
    setBusy(false);
    if (ok) onUnlocked();
    else setError('Incorrect passphrase. Try again.');
  }

  return (
    <div class="av-splash">
      <form class="av-unlock" onSubmit={submit}>
        <div class="av-logo av-logo--lg">🔐</div>
        <h2>AutoVault is locked</h2>
        <p class="av-field__hint">Enter your passphrase to decrypt your profiles on this device.</p>
        <input class="av-input" type="password" autoFocus value={pass} onInput={(e) => setPass((e.target as HTMLInputElement).value)} placeholder="Passphrase" />
        {error && <p class="av-error">{error}</p>}
        <button class="av-btn av-btn--primary" type="submit" disabled={busy || !pass}>{busy ? 'Unlocking…' : 'Unlock'}</button>
      </form>
    </div>
  );
}

function LinksEditor({ links, onChange }: { links: SocialLink[]; onChange: (next: SocialLink[]) => void }) {
  return (
    <div class="av-repeater">
      {links.map((link, i) => (
        <div class="av-repeater__row">
          <input class="av-input" placeholder="Label (e.g. Dribbble)" value={link.label} onInput={(e) => onChange(links.map((l, j) => (j === i ? { ...l, label: (e.target as HTMLInputElement).value } : l)))} />
          <input class="av-input" placeholder="https://…" value={link.url} onInput={(e) => onChange(links.map((l, j) => (j === i ? { ...l, url: (e.target as HTMLInputElement).value } : l)))} />
          <button class="av-iconbtn" title="Remove" onClick={() => onChange(links.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button class="av-btn av-btn--ghost" onClick={() => onChange([...links, { id: uuid(), label: '', url: '' }])}>+ Add link</button>
    </div>
  );
}

function QAEditor({ qa, onChange }: { qa: QAPair[]; onChange: (next: QAPair[]) => void }) {
  return (
    <div class="av-repeater">
      {qa.map((pair, i) => (
        <div class="av-qacard">
          <input class="av-input" placeholder="Question (e.g. Why do you want to work here?)" value={pair.question} onInput={(e) => onChange(qa.map((q, j) => (j === i ? { ...q, question: (e.target as HTMLInputElement).value } : q)))} />
          <textarea class="av-input av-textarea" rows={3} placeholder="Your reusable answer" value={pair.answer} onInput={(e) => onChange(qa.map((q, j) => (j === i ? { ...q, answer: (e.target as HTMLTextAreaElement).value } : q)))} />
          <button class="av-btn av-btn--ghost av-btn--sm" onClick={() => onChange(qa.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button class="av-btn av-btn--ghost" onClick={() => onChange([...qa, { id: uuid(), question: '', answer: '', tags: [] }])}>+ Add question</button>
    </div>
  );
}

function DocumentRow({
  label,
  doc,
  onPick,
  onPreview,
  onRemove,
}: {
  label: string;
  doc?: DocumentMeta;
  onPick: () => void;
  onPreview: (d: DocumentMeta) => void;
  onRemove: (d: DocumentMeta) => void;
}) {
  return (
    <div class="av-docrow">
      <div class="av-docrow__meta">
        <span class="av-docrow__label">{label}</span>
        {doc ? (
          <span class="av-docrow__file">
            📄 {doc.fileName} <span class="av-field__hint">({humanFileSize(doc.size)})</span>
          </span>
        ) : (
          <span class="av-field__hint">No file uploaded</span>
        )}
      </div>
      <div class="av-docrow__actions">
        {doc && <button class="av-btn av-btn--sm" onClick={() => onPreview(doc)}>Preview</button>}
        <button class="av-btn av-btn--sm" onClick={onPick}>{doc ? 'Replace' : 'Upload'}</button>
        {doc && <button class="av-btn av-btn--sm av-btn--danger-ghost" onClick={() => onRemove(doc)}>Remove</button>}
      </div>
    </div>
  );
}

function EncryptionPanel({ encrypted, onChanged }: { encrypted: boolean; onChanged: () => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [oldP, setOldP] = useState('');
  const [msg, setMsg] = useState('');

  async function enable() {
    if (p1.length < 8) return setMsg('Use at least 8 characters.');
    if (p1 !== p2) return setMsg('Passphrases do not match.');
    await enableEncryption(p1);
    setP1(''); setP2(''); setMsg('');
    onChanged();
  }
  async function change() {
    if (p1.length < 8) return setMsg('New passphrase must be at least 8 characters.');
    if (p1 !== p2) return setMsg('New passphrases do not match.');
    const ok = await changePassphrase(oldP, p1);
    setMsg(ok ? '' : 'Current passphrase is incorrect.');
    if (ok) { setOldP(''); setP1(''); setP2(''); onChanged(); }
  }
  async function disable() {
    if (!window.confirm('Turn off encryption? Your profile will be stored unencrypted on this device.')) return;
    await disableEncryption();
    onChanged();
  }

  if (!encrypted) {
    return (
      <div class="av-encpanel">
        <p class="av-note">
          Add a passphrase to encrypt your stored profile with AES-GCM (Web Crypto). The key is derived from
          your passphrase and never leaves this device — if you forget it, the data cannot be recovered.
        </p>
        <FieldGrid>
          <label class="av-field"><span class="av-field__label">Passphrase</span><input class="av-input" type="password" value={p1} onInput={(e) => setP1((e.target as HTMLInputElement).value)} /></label>
          <label class="av-field"><span class="av-field__label">Confirm passphrase</span><input class="av-input" type="password" value={p2} onInput={(e) => setP2((e.target as HTMLInputElement).value)} /></label>
        </FieldGrid>
        {msg && <p class="av-error">{msg}</p>}
        <button class="av-btn av-btn--primary" onClick={enable}>Enable encryption</button>
      </div>
    );
  }

  return (
    <div class="av-encpanel">
      <p class="av-note">🔒 Encryption is <strong>on</strong>. Your profile is encrypted at rest.</p>
      <FieldGrid cols={3}>
        <label class="av-field"><span class="av-field__label">Current passphrase</span><input class="av-input" type="password" value={oldP} onInput={(e) => setOldP((e.target as HTMLInputElement).value)} /></label>
        <label class="av-field"><span class="av-field__label">New passphrase</span><input class="av-input" type="password" value={p1} onInput={(e) => setP1((e.target as HTMLInputElement).value)} /></label>
        <label class="av-field"><span class="av-field__label">Confirm new</span><input class="av-input" type="password" value={p2} onInput={(e) => setP2((e.target as HTMLInputElement).value)} /></label>
      </FieldGrid>
      {msg && <p class="av-error">{msg}</p>}
      <div class="av-btnrow">
        <button class="av-btn" onClick={change}>Change passphrase</button>
        <button class="av-btn av-btn--danger-ghost" onClick={disable}>Turn off encryption</button>
      </div>
    </div>
  );
}

function CustomDomains({ store, onChanged }: { store: AutoVaultStore; onChanged: () => void }) {
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');

  async function add() {
    setMsg('');
    const res = await addCustomDomain(input);
    if (res.ok) {
      setInput('');
      onChanged();
    } else {
      setMsg(res.reason ?? 'Could not add domain.');
    }
  }
  async function remove(id: string) {
    await removeCustomDomain(id);
    onChanged();
  }

  return (
    <div>
      <p class="av-note">
        AutoVault runs automatically on Greenhouse, Lever, Workday, iCIMS and LinkedIn. Add another career
        site here — Chrome will ask you to grant access to just that domain.
      </p>
      <div class="av-repeater__row">
        <input class="av-input" placeholder="careers.acme.com" value={input} onInput={(e) => setInput((e.target as HTMLInputElement).value)} />
        <button class="av-btn av-btn--primary" onClick={add}>Add domain</button>
      </div>
      {msg && <p class="av-error">{msg}</p>}
      <ul class="av-domainlist">
        {store.customDomains.length === 0 && <li class="av-field__hint">No custom domains yet.</li>}
        {store.customDomains.map((d) => (
          <li>
            <span>{d.host}</span>
            <button class="av-iconbtn" title="Remove" onClick={() => remove(d.id)}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
