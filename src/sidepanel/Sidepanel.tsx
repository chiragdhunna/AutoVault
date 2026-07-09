/**
 * Side panel — the primary AutoVault surface.
 *
 * Shows the active profile's saved fields grouped into the same sections used
 * on the options page. Every value has a one-click copy button; the user pastes
 * it into the job application themselves. AutoVault never touches the page.
 *
 * Reuses the existing schema + storage layer as-is (no data-model changes) and
 * resolveFieldValue() from lib/fields to turn a profile into display strings.
 */
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { AutoVaultStore, JobProfile } from '../types/schema';
import { loadIndex, loadStore, setActiveProfile, unlock } from '../lib/storage';
import { resolveFieldValue, type FieldKey } from '../lib/fields';

type Phase = 'loading' | 'locked' | 'ready';

interface Row {
  id: string;
  label: string;
  value: string;
}
interface SectionData {
  id: string;
  title: string;
  rows: Row[];
}

/** Field groups mirror the options-page sections; values come from the profile. */
const FIELD_GROUPS: { id: string; title: string; fields: { key: FieldKey; label: string }[] }[] = [
  {
    id: 'personal',
    title: 'Personal',
    fields: [
      { key: 'fullName', label: 'Full name' },
      { key: 'firstName', label: 'First name' },
      { key: 'lastName', label: 'Last name' },
      { key: 'preferredName', label: 'Preferred name' },
      { key: 'pronouns', label: 'Pronouns' },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    fields: [
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'streetAddress', label: 'Street address' },
      { key: 'addressLine2', label: 'Address line 2' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State / Region' },
      { key: 'zip', label: 'ZIP / Postal code' },
      { key: 'country', label: 'Country' },
    ],
  },
  {
    id: 'links',
    title: 'Links',
    fields: [
      { key: 'linkedin', label: 'LinkedIn' },
      { key: 'github', label: 'GitHub' },
      { key: 'portfolio', label: 'Portfolio / Website' },
    ],
  },
  {
    id: 'work',
    title: 'Work',
    fields: [
      { key: 'currentTitle', label: 'Current title' },
      { key: 'currentEmployer', label: 'Current employer' },
      { key: 'yearsOfExperience', label: 'Years of experience' },
      { key: 'desiredSalary', label: 'Desired salary' },
      { key: 'workAuthorization', label: 'Work authorization' },
      { key: 'requiresSponsorship', label: 'Requires sponsorship' },
      { key: 'noticePeriod', label: 'Notice period' },
      { key: 'startDate', label: 'Start date availability' },
    ],
  },
  {
    id: 'eeo',
    title: 'EEO',
    fields: [
      { key: 'raceEthnicity', label: 'Race / ethnicity' },
      { key: 'genderIdentity', label: 'Gender identity' },
      { key: 'veteranStatus', label: 'Veteran status' },
      { key: 'disabilityStatus', label: 'Disability status' },
    ],
  },
];

/** Turn a profile into non-empty, grouped rows for display + copy. */
function buildSections(profile: JobProfile): SectionData[] {
  const sections: SectionData[] = [];
  for (const group of FIELD_GROUPS) {
    const rows: Row[] = [];
    for (const f of group.fields) {
      const value = resolveFieldValue(profile, f.key);
      if (value && value.trim()) rows.push({ id: `${group.id}:${f.key}`, label: f.label, value });
    }
    if (group.id === 'links') {
      for (const link of profile.links.other) {
        if (link.url && link.url.trim()) {
          rows.push({ id: `links:other:${link.id}`, label: link.label?.trim() || 'Link', value: link.url });
        }
      }
    }
    if (rows.length) sections.push({ id: group.id, title: group.title, rows });
  }
  const qaRows: Row[] = profile.qa
    .filter((q) => q.question.trim() && q.answer.trim())
    .map((q) => ({ id: `qa:${q.id}`, label: q.question.trim(), value: q.answer }));
  if (qaRows.length) sections.push({ id: 'qa', title: 'Q&A Bank', rows: qaRows });
  return sections;
}

/** Format the whole profile as a plain-text block for "Copy all as text". */
function toPlainText(profile: JobProfile, sections: SectionData[]): string {
  const lines: string[] = [`AutoVault — ${profile.name}`, ''];
  for (const s of sections) {
    lines.push(s.title.toUpperCase());
    for (const r of s.rows) lines.push(`  ${r.label}: ${r.value}`);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

export function Sidepanel() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [store, setStore] = useState<AutoVaultStore | null>(null);
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [unlockErr, setUnlockErr] = useState('');

  async function boot() {
    const idx = await loadIndex();
    if (idx.encrypted && !idx.unlocked) {
      setPhase('locked');
      return;
    }
    setStore(await loadStore());
    setPhase('ready');
  }

  useEffect(() => {
    void boot();
  }, []);

  const active: JobProfile | undefined =
    store?.profiles.find((p) => p.id === store.activeProfileId) ?? store?.profiles[0];

  async function onUnlock(e: Event) {
    e.preventDefault();
    setUnlockErr('');
    if (await unlock(pass)) {
      setPass('');
      await boot();
    } else {
      setUnlockErr('Incorrect passphrase.');
    }
  }

  async function onSwitch(id: string) {
    await setActiveProfile(id);
    setStore(await loadStore());
    setQuery('');
    setCopiedId(null);
  }

  function flashCopied(id: string) {
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  }

  async function copyValue(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      flashCopied(id);
    } catch {
      /* clipboard permission denied — nothing we can do from here */
    }
  }

  if (phase === 'loading') {
    return <div class="sp sp--center">Loading…</div>;
  }

  if (phase === 'locked') {
    return (
      <div class="sp">
        <Header />
        <form class="sp-unlock" onSubmit={onUnlock}>
          <p class="sp-lockmsg">🔒 Locked. Enter your passphrase to view your profile.</p>
          <input
            class="sp-input"
            type="password"
            autoFocus
            placeholder="Passphrase"
            value={pass}
            onInput={(e) => setPass((e.target as HTMLInputElement).value)}
          />
          {unlockErr && <p class="sp-err">{unlockErr}</p>}
          <button class="sp-btn sp-btn--primary" type="submit" disabled={!pass}>
            Unlock
          </button>
        </form>
      </div>
    );
  }

  if (!store || !active) {
    return <div class="sp sp--center">No profile found.</div>;
  }

  const allSections = buildSections(active);
  const q = query.trim().toLowerCase();
  const sections = q
    ? allSections
        .map((s) => ({ ...s, rows: s.rows.filter((r) => r.label.toLowerCase().includes(q)) }))
        .filter((s) => s.rows.length)
    : allSections;
  const plainText = toPlainText(active, allSections);

  return (
    <div class="sp">
      <Header onGear={() => chrome.runtime.openOptionsPage()} />

      <div class="sp-controls">
        <label class="sp-field">
          <span class="sp-field__label">Profile</span>
          <select
            class="sp-input sp-select"
            value={store.activeProfileId ?? ''}
            onChange={(e) => onSwitch((e.target as HTMLSelectElement).value)}
          >
            {store.profiles.map((p) => (
              <option value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <input
          class="sp-input sp-search"
          type="search"
          placeholder="Filter fields…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
      </div>

      <button
        class={`sp-btn sp-btn--wide ${copiedId === '__all__' ? 'sp-btn--done' : ''}`}
        onClick={() => copyValue('__all__', plainText)}
      >
        {copiedId === '__all__' ? '✓ Copied all' : 'Copy all as text'}
      </button>

      {sections.length === 0 ? (
        <p class="sp-empty">
          {query
            ? 'No fields match your filter.'
            : 'This profile has no saved fields yet. Use the ⚙️ options page to add your details.'}
        </p>
      ) : (
        sections.map((s) => (
          <CollapsibleSection key={s.id} title={s.title} count={s.rows.length} forceOpen={q.length > 0}>
            {s.rows.map((r) => (
              <FieldRow key={r.id} row={r} copied={copiedId === r.id} onCopy={() => copyValue(r.id, r.value)} />
            ))}
          </CollapsibleSection>
        ))
      )}

      <p class="sp-privacy">Stored only on this device. Copy a field, then paste it into the application yourself.</p>
    </div>
  );
}

function Header({ onGear }: { onGear?: () => void }) {
  return (
    <header class="sp-header">
      <span class="sp-logo">🔐</span>
      <span class="sp-name">AutoVault</span>
      {onGear && (
        <button class="sp-gear" title="Edit full profile" onClick={onGear}>
          ⚙️
        </button>
      )}
    </header>
  );
}

function CollapsibleSection({
  title,
  count,
  forceOpen,
  children,
}: {
  title: string;
  count: number;
  forceOpen?: boolean;
  children: ComponentChildren;
}) {
  const [open, setOpen] = useState(true);
  const isOpen = forceOpen || open;
  return (
    <section class="sp-section">
      <button
        type="button"
        class="sp-section__header"
        aria-expanded={isOpen}
        onClick={() => setOpen((o) => !o)}
      >
        <span class="sp-section__chevron" data-open={String(isOpen)}>
          ▸
        </span>
        <span class="sp-section__title">{title}</span>
        <span class="sp-section__count">{count}</span>
      </button>
      {isOpen && <div class="sp-section__body">{children}</div>}
    </section>
  );
}

function FieldRow({ row, copied, onCopy }: { row: Row; copied: boolean; onCopy: () => void }) {
  return (
    <div class="sp-row">
      <div class="sp-row__text">
        <span class="sp-row__label">{row.label}</span>
        <span class="sp-row__value">{row.value}</span>
      </div>
      <button
        class={`sp-copy ${copied ? 'sp-copy--done' : ''}`}
        title={copied ? 'Copied!' : `Copy ${row.label}`}
        aria-label={copied ? 'Copied' : `Copy ${row.label}`}
        onClick={onCopy}
      >
        <span class="sp-copy__glyph" aria-hidden="true">{copied ? '✓' : '📋'}</span>
      </button>
    </div>
  );
}
