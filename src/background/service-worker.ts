/**
 * Background service worker.
 *
 * Deliberately tiny: it seeds default storage on install, opens the options
 * page on first install, and restores dynamically-registered content scripts
 * for user-added custom domains. All autofill orchestration happens in the
 * popup (which has activeTab + scripting) and the content script.
 */
import { ensureInitialized, loadStore } from '../lib/storage';
import { syncDynamicScripts } from '../lib/domains';
import { buildFillPayload } from '../lib/payload';
import type { PayloadResponse } from '../shared/messages';

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureInitialized();
  await syncDynamicScripts();
  if (details.reason === 'install') {
    try {
      await chrome.runtime.openOptionsPage();
    } catch {
      /* openOptionsPage can reject if no options page is focused yet */
    }
  }
});

chrome.runtime.onStartup.addListener(() => {
  void syncDynamicScripts();
});

/**
 * Content scripts on recognized ATS pages ask for the active profile's payload
 * so they can auto-fill on load (when the user enabled that). The background is
 * a trusted context, so it can read chrome.storage.session and thus decrypt an
 * unlocked vault; a locked vault yields { locked: true } and no data.
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if ((msg as { type?: string })?.type !== 'AV_GET_PAYLOAD') return false;
  (async () => {
    try {
      const store = await loadStore();
      const active =
        store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];
      const payload = active ? buildFillPayload(active, store.settings) : null;
      const resp: PayloadResponse = {
        autofillOnLoad: store.settings.autofillOnLoad,
        locked: false,
        payload,
      };
      sendResponse(resp);
    } catch {
      const resp: PayloadResponse = { autofillOnLoad: false, locked: true, payload: null };
      sendResponse(resp);
    }
  })();
  return true; // async response
});
