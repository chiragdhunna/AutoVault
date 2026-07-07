/**
 * Custom-domain support.
 *
 * Known ATS domains are covered by the static `content_scripts` in the
 * manifest. For any other site the user wants to autofill on, we:
 *   1. request the specific host permission at runtime (optional_host_permissions
 *      is declared broadly, but each request is narrowed to one origin), and
 *   2. persistently register the content script for that origin via
 *      chrome.scripting.registerContentScripts.
 * The extension therefore never holds <all_urls> — access is granted one
 * explicitly-added domain at a time.
 */
import type { CustomDomain } from '../types/schema';
import { loadStore, saveStore } from './storage';
import { uuid, nowMs } from './util';

const DYNAMIC_PREFIX = 'autovault-custom-';

export function hostToPattern(host: string): string {
  return `*://${host}/*`;
}

/** Clean user input into a bare hostname, or null if it isn't a valid domain. */
export function normalizeHost(input: string): string | null {
  let h = input.trim();
  if (!h) return null;
  try {
    if (/^https?:\/\//i.test(h)) h = new URL(h).hostname;
  } catch {
    /* fall through to manual cleanup */
  }
  h = h
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return null;
  return h;
}

export function requestDomainPermission(pattern: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [pattern] });
}

export function hasDomainPermission(pattern: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [pattern] });
}

/** Re-sync the set of dynamically-registered content scripts to match storage. */
export async function registerDynamicScripts(domains: CustomDomain[]): Promise<void> {
  if (!chrome.scripting?.registerContentScripts) return;
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const ids = existing.filter((s) => s.id.startsWith(DYNAMIC_PREFIX)).map((s) => s.id);
    if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
  } catch {
    /* nothing registered yet */
  }

  for (const d of domains) {
    if (!(await hasDomainPermission(d.pattern))) continue;
    try {
      await chrome.scripting.registerContentScripts([
        {
          id: `${DYNAMIC_PREFIX}${d.id}`,
          matches: [d.pattern],
          js: ['content.js'],
          runAt: 'document_idle',
          allFrames: true,
          persistAcrossSessions: true,
        },
      ]);
    } catch (err) {
      console.warn('AutoVault: could not register content script for', d.pattern, err);
    }
  }
}

export interface AddDomainResult {
  ok: boolean;
  reason?: string;
  domain?: CustomDomain;
}

export async function addCustomDomain(input: string): Promise<AddDomainResult> {
  const host = normalizeHost(input);
  if (!host) return { ok: false, reason: 'Enter a valid domain, e.g. careers.acme.com' };
  const pattern = hostToPattern(host);

  const store = await loadStore();
  if (store.customDomains.some((d) => d.host === host)) {
    return { ok: false, reason: 'That domain is already in your list.' };
  }

  // Must be triggered from a user gesture (the options-page button click).
  const granted = await requestDomainPermission(pattern);
  if (!granted) return { ok: false, reason: 'Chrome denied permission for that domain.' };

  const domain: CustomDomain = { id: uuid(), pattern, host, addedAt: nowMs() };
  store.customDomains.push(domain);
  await saveStore(store);
  await registerDynamicScripts(store.customDomains);
  return { ok: true, domain };
}

export async function removeCustomDomain(id: string): Promise<void> {
  const store = await loadStore();
  const domain = store.customDomains.find((d) => d.id === id);
  store.customDomains = store.customDomains.filter((d) => d.id !== id);
  await saveStore(store);
  if (domain) {
    try {
      await chrome.permissions.remove({ origins: [domain.pattern] });
    } catch {
      /* permission may already be gone */
    }
  }
  await registerDynamicScripts(store.customDomains);
}

/** Called by the background worker on startup/install to restore registrations. */
export async function syncDynamicScripts(): Promise<void> {
  try {
    const store = await loadStore();
    await registerDynamicScripts(store.customDomains);
  } catch {
    // Store may be locked (encrypted); persistAcrossSessions keeps prior
    // registrations alive until the user next unlocks and re-syncs.
  }
}
