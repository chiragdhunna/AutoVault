import { useEffect, useState } from 'preact/hooks';
import { loadIndex } from '../lib/storage';

/**
 * Minimal launcher popup.
 *
 * The side panel is AutoVault's primary UI and opens when the toolbar icon is
 * clicked (see the background service worker). This popup is just a small
 * launcher: it shows the active profile and a button to open the panel. It
 * deliberately does NOT duplicate the field list that lives in the side panel.
 */
export function Popup() {
  const [activeName, setActiveName] = useState('—');
  const [windowId, setWindowId] = useState<number | undefined>();

  useEffect(() => {
    void (async () => {
      const idx = await loadIndex();
      const name = idx.profiles.find((p) => p.id === idx.activeProfileId)?.name;
      setActiveName(name ?? idx.profiles[0]?.name ?? '—');
      try {
        const win = await chrome.windows.getCurrent();
        setWindowId(win.id);
      } catch {
        /* no window context */
      }
    })();
  }, []);

  function openPanel() {
    if (windowId === undefined) return;
    // Called synchronously in the click handler to keep the user gesture.
    chrome.sidePanel
      .open({ windowId })
      .then(() => window.close())
      .catch((err) => console.warn('AutoVault: could not open the side panel', err));
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  return (
    <div class="pp">
      <header class="pp-header">
        <div class="pp-brand">
          <span class="pp-logo">🔐</span>
          <span class="pp-name">AutoVault</span>
        </div>
        <button class="pp-gear" title="Options" onClick={openOptions}>⚙️</button>
      </header>

      <div class="pp-profile">
        <span class="pp-plabel">Active profile</span>
        <div class="pp-active">{activeName}</div>
      </div>

      <button class="pp-btn pp-btn--primary pp-btn--fill" onClick={openPanel}>
        Open AutoVault panel
      </button>

      <button class="pp-link" onClick={openOptions}>Edit full profile →</button>
      <p class="pp-privacy">Copy your details from the side panel, then paste them into the application yourself.</p>
    </div>
  );
}
