import { useEffect, useState } from 'preact/hooks';
import type { AutoVaultStore } from '../types/schema';
import { loadIndex, loadStore, setActiveProfile, unlock, type StoreIndex } from '../lib/storage';
import { buildFillPayload } from '../lib/payload';
import { detectAts, atsLabel } from '../lib/ats';
import type { FillResult, ContentMessage } from '../shared/messages';

type Phase = 'loading' | 'locked' | 'ready';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sendMessage<T>(tabId: number, msg: ContentMessage): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, msg, (resp) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve((resp as T) ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function injectContent(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content.js'],
    });
    return true;
  } catch (err) {
    console.warn('AutoVault: injection blocked on this page', err);
    return false;
  }
}

export function Popup() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [index, setIndex] = useState<StoreIndex | null>(null);
  const [store, setStore] = useState<AutoVaultStore | null>(null);
  const [tabId, setTabId] = useState<number | undefined>();
  const [atsName, setAtsName] = useState('Generic form');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FillResult | null>(null);
  const [status, setStatus] = useState('');
  const [pass, setPass] = useState('');
  const [unlockErr, setUnlockErr] = useState('');

  async function boot() {
    const idx = await loadIndex();
    setIndex(idx);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTabId(tab?.id);
    if (tab?.url) {
      try {
        setAtsName(atsLabel(detectAts(new URL(tab.url).hostname)));
      } catch {
        /* non-web URL */
      }
    }

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

  const active = store?.profiles.find((p) => p.id === store.activeProfileId);
  const activeName =
    active?.name ??
    index?.profiles.find((p) => p.id === index.activeProfileId)?.name ??
    '—';

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
    setResult(null);
    setStatus('');
  }

  async function onAutofill() {
    if (!store || tabId === undefined || !active) return;
    setBusy(true);
    setStatus('');
    setResult(null);

    const payload = buildFillPayload(active, store.settings);
    if (payload.fields.length === 0 && payload.qa.length === 0) {
      setBusy(false);
      setStatus('This profile is empty — add details in the options page first.');
      return;
    }

    let res = await sendMessage<FillResult>(tabId, { type: 'AV_AUTOFILL', payload });
    if (!res) {
      const injected = await injectContent(tabId);
      if (injected) {
        await delay(150);
        res = await sendMessage<FillResult>(tabId, { type: 'AV_AUTOFILL', payload });
      }
    }

    setBusy(false);
    if (!res) {
      setStatus("AutoVault can't run on this page (e.g. a browser or Web Store page).");
      return;
    }
    setResult(res);
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  if (phase === 'loading') {
    return <div class="pp pp--center">Loading…</div>;
  }

  if (phase === 'locked') {
    return (
      <div class="pp">
        <Header onGear={openOptions} />
        <form class="pp-unlock" onSubmit={onUnlock}>
          <p class="pp-lockmsg">🔒 Locked. Enter your passphrase to autofill.</p>
          <input
            class="pp-input"
            type="password"
            autoFocus
            placeholder="Passphrase"
            value={pass}
            onInput={(e) => setPass((e.target as HTMLInputElement).value)}
          />
          {unlockErr && <p class="pp-err">{unlockErr}</p>}
          <button class="pp-btn pp-btn--primary" type="submit" disabled={!pass}>Unlock</button>
        </form>
      </div>
    );
  }

  return (
    <div class="pp">
      <Header onGear={openOptions} />

      <div class="pp-profile">
        <label class="pp-plabel">Active profile</label>
        <select
          class="pp-input pp-select"
          value={store?.activeProfileId ?? ''}
          onChange={(e) => onSwitch((e.target as HTMLSelectElement).value)}
        >
          {store?.profiles.map((p) => (
            <option value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div class="pp-detected">
        <span class="pp-dot" />
        Detected: <strong>{atsName}</strong>
      </div>

      <button class="pp-btn pp-btn--primary pp-btn--fill" onClick={onAutofill} disabled={busy}>
        {busy ? 'Filling…' : '⚡ Autofill this page'}
      </button>

      {result && (
        <div class="pp-result">
          <div class="pp-result__big">{result.filled}</div>
          <div class="pp-result__label">
            field{result.filled === 1 ? '' : 's'} filled
            {result.matched > result.filled && <> · {result.matched} matched</>}
          </div>
          {result.fileInputs > 0 && (
            <div class="pp-result__hint">📎 {result.fileInputs} file field{result.fileInputs === 1 ? '' : 's'} flagged — attach your résumé manually.</div>
          )}
          {result.filled === 0 && result.matched === 0 && (
            <div class="pp-result__hint">No matching fields found on this page.</div>
          )}
        </div>
      )}
      {status && <div class="pp-status">{status}</div>}

      <button class="pp-link" onClick={openOptions}>Edit full profile →</button>
      <p class="pp-privacy">Stored only on this device. Nothing leaves your browser.</p>
    </div>
  );
}

function Header({ onGear }: { onGear: () => void }) {
  return (
    <header class="pp-header">
      <div class="pp-brand">
        <span class="pp-logo">🔐</span>
        <span class="pp-name">AutoVault</span>
      </div>
      <button class="pp-gear" title="Options" onClick={onGear}>⚙️</button>
    </header>
  );
}
