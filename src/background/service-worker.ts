/**
 * Background service worker.
 *
 * Deliberately tiny. It seeds default storage on install, opens the options
 * page on first install, and configures the toolbar icon to open the side
 * panel. AutoVault no longer touches web pages, so there is no autofill
 * orchestration or content-script messaging here anymore.
 */
import { ensureInitialized } from '../lib/storage';

// With no default_popup declared in the manifest, clicking the toolbar icon
// opens the side panel instead.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.warn('AutoVault: could not set side panel behavior', err));

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureInitialized();
  if (details.reason === 'install') {
    try {
      await chrome.runtime.openOptionsPage();
    } catch {
      /* openOptionsPage can reject if no options page is focused yet */
    }
  }
});
