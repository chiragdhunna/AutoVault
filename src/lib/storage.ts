/**
 * Store manager: the single source of truth for reading/writing the profile.
 *
 * Layout on disk:
 *   chrome.storage.local['autovault_store'] holds an "envelope":
 *     - plaintext: { encrypted:false, store }
 *     - encrypted: { encrypted:true, meta, index, payload }
 *       where `payload` is the AES-GCM ciphertext of the whole store, `meta`
 *       carries the PBKDF2 salt/verifier needed to unlock, and `index` is a
 *       tiny cleartext list of profile {id,name} so the popup can render the
 *       active profile name without unlocking.
 *
 * The unlocked AES key is cached in chrome.storage.session (memory-only, never
 * written to disk, and not exposed to content scripts) so the popup and options
 * page can share an unlock for the browser session.
 *
 * Document bytes never live here — see db.ts (IndexedDB).
 */
import {
  type AutoVaultStore,
  type JobProfile,
  type EncryptedBlob,
  type EncryptionMeta,
  type DocumentMeta,
  SCHEMA_VERSION,
} from '../types/schema';
import { createDefaultStore, createEmptyProfile, defaultSettings } from './defaults';
import { clone, uuid, nowMs, arrayBufferToBase64, base64ToArrayBuffer } from './util';
import {
  deriveKey,
  encryptString,
  decryptString,
  makeVerifier,
  verifyKey,
  generateSaltB64,
  exportKeyB64,
  importKeyB64,
  PBKDF2_ITERATIONS,
} from './crypto';
import {
  putDocumentBlob,
  getDocumentBlob,
  deleteDocumentBlob,
  clearAllDocuments,
} from './db';

const LOCAL_KEY = 'autovault_store';
const SESSION_KEY = 'autovault_session_key';

interface ProfileIndexEntry {
  id: string;
  name: string;
}

interface PlainEnvelope {
  encrypted: false;
  store: AutoVaultStore;
}

interface EncryptedEnvelope {
  encrypted: true;
  meta: EncryptionMeta;
  index: { activeProfileId: string | null; profiles: ProfileIndexEntry[] };
  payload: EncryptedBlob;
}

type Envelope = PlainEnvelope | EncryptedEnvelope;

/** Thrown when the store is encrypted and no session key is available. */
export class VaultLockedError extends Error {
  constructor() {
    super('AutoVault is locked. Unlock with your passphrase to continue.');
    this.name = 'VaultLockedError';
  }
}

/* ------------------------------------------------------------------ */
/* Envelope read/write                                                 */
/* ------------------------------------------------------------------ */

async function readEnvelope(): Promise<Envelope | null> {
  const res = await chrome.storage.local.get(LOCAL_KEY);
  return (res[LOCAL_KEY] as Envelope | undefined) ?? null;
}

async function writeEnvelope(env: Envelope): Promise<void> {
  await chrome.storage.local.set({ [LOCAL_KEY]: env });
}

export async function ensureInitialized(): Promise<void> {
  if (!(await readEnvelope())) {
    await writeEnvelope({ encrypted: false, store: createDefaultStore() });
  }
}

export async function isEncrypted(): Promise<boolean> {
  const env = await readEnvelope();
  return !!env && env.encrypted === true;
}

/* ------------------------------------------------------------------ */
/* Session key cache (unlock state)                                    */
/* ------------------------------------------------------------------ */

async function getSessionKey(): Promise<CryptoKey | null> {
  try {
    const res = await chrome.storage.session.get(SESSION_KEY);
    const b64 = res[SESSION_KEY] as string | undefined;
    return b64 ? await importKeyB64(b64) : null;
  } catch {
    return null;
  }
}

async function setSessionKey(key: CryptoKey): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: await exportKeyB64(key) });
}

export async function lock(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEY);
}

export async function isUnlocked(): Promise<boolean> {
  if (!(await isEncrypted())) return true;
  return (await getSessionKey()) !== null;
}

/**
 * Validate a passphrase and, if correct, cache the derived key for the session.
 * Returns false on a wrong passphrase.
 */
export async function unlock(passphrase: string): Promise<boolean> {
  const env = await readEnvelope();
  if (!env || !env.encrypted) return true;
  const { salt, iterations, verifier } = env.meta;
  if (!salt || !verifier) return false;
  const key = await deriveKey(passphrase, salt, iterations ?? PBKDF2_ITERATIONS, true);
  if (!(await verifyKey(verifier, key))) return false;
  await setSessionKey(key);
  return true;
}

/* ------------------------------------------------------------------ */
/* Store load / save                                                   */
/* ------------------------------------------------------------------ */

export async function loadStore(): Promise<AutoVaultStore> {
  const env = await readEnvelope();
  if (!env) {
    const store = createDefaultStore();
    await writeEnvelope({ encrypted: false, store });
    return store;
  }
  if (!env.encrypted) return normalizeStore(env.store);

  const key = await getSessionKey();
  if (!key) throw new VaultLockedError();
  const json = await decryptString(env.payload, key);
  return normalizeStore(JSON.parse(json) as AutoVaultStore);
}

export async function saveStore(input: AutoVaultStore): Promise<void> {
  const store = normalizeStore(input);
  const enc = store.settings.encryption;

  if (enc.enabled) {
    const key = await getSessionKey();
    if (!key) throw new VaultLockedError();
    const payload = await encryptString(JSON.stringify(store), key);
    const env: EncryptedEnvelope = {
      encrypted: true,
      meta: enc,
      index: {
        activeProfileId: store.activeProfileId,
        profiles: store.profiles.map((p) => ({ id: p.id, name: p.name })),
      },
      payload,
    };
    await writeEnvelope(env);
  } else {
    await writeEnvelope({ encrypted: false, store });
  }
}

/** Lightweight read used by the popup — works even while locked. */
export interface StoreIndex {
  activeProfileId: string | null;
  profiles: ProfileIndexEntry[];
  encrypted: boolean;
  unlocked: boolean;
}

export async function loadIndex(): Promise<StoreIndex> {
  const env = await readEnvelope();
  if (!env) {
    await ensureInitialized();
    return loadIndex();
  }
  if (!env.encrypted) {
    return {
      activeProfileId: env.store.activeProfileId,
      profiles: env.store.profiles.map((p) => ({ id: p.id, name: p.name })),
      encrypted: false,
      unlocked: true,
    };
  }
  return {
    activeProfileId: env.index.activeProfileId,
    profiles: env.index.profiles,
    encrypted: true,
    unlocked: (await getSessionKey()) !== null,
  };
}

/* ------------------------------------------------------------------ */
/* Encryption lifecycle                                                */
/* ------------------------------------------------------------------ */

export async function enableEncryption(passphrase: string): Promise<void> {
  const store = await loadStore(); // requires plaintext or already-unlocked
  const salt = generateSaltB64();
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS, true);
  const verifier = await makeVerifier(key);
  store.settings.encryption = {
    enabled: true,
    salt,
    iterations: PBKDF2_ITERATIONS,
    verifier,
  };
  await setSessionKey(key);
  await saveStore(store);
}

export async function disableEncryption(): Promise<void> {
  const store = await loadStore(); // requires unlocked
  store.settings.encryption = { enabled: false };
  await saveStore(store); // plaintext write
  await lock();
}

export async function changePassphrase(oldPass: string, newPass: string): Promise<boolean> {
  if (!(await unlock(oldPass))) return false;
  const store = await loadStore();
  const salt = generateSaltB64();
  const key = await deriveKey(newPass, salt, PBKDF2_ITERATIONS, true);
  const verifier = await makeVerifier(key);
  store.settings.encryption = { enabled: true, salt, iterations: PBKDF2_ITERATIONS, verifier };
  await setSessionKey(key);
  await saveStore(store);
  return true;
}

/* ------------------------------------------------------------------ */
/* Profile CRUD                                                        */
/* ------------------------------------------------------------------ */

export async function listProfiles(): Promise<JobProfile[]> {
  return (await loadStore()).profiles;
}

export async function getActiveProfile(): Promise<JobProfile | null> {
  const store = await loadStore();
  return (
    store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0] ?? null
  );
}

export async function setActiveProfile(id: string): Promise<void> {
  const store = await loadStore();
  if (store.profiles.some((p) => p.id === id)) {
    store.activeProfileId = id;
    await saveStore(store);
  }
}

export async function upsertProfile(profile: JobProfile): Promise<void> {
  const store = await loadStore();
  const next = clone(profile);
  next.updatedAt = nowMs();
  const idx = store.profiles.findIndex((p) => p.id === next.id);
  if (idx >= 0) store.profiles[idx] = next;
  else store.profiles.push(next);
  await saveStore(store);
}

export async function createProfile(name: string): Promise<JobProfile> {
  const store = await loadStore();
  const profile = createEmptyProfile(name || 'Untitled profile');
  store.profiles.push(profile);
  if (!store.activeProfileId) store.activeProfileId = profile.id;
  await saveStore(store);
  return profile;
}

export async function renameProfile(id: string, name: string): Promise<void> {
  const store = await loadStore();
  const profile = store.profiles.find((p) => p.id === id);
  if (profile) {
    profile.name = name;
    profile.updatedAt = nowMs();
    await saveStore(store);
  }
}

export async function duplicateProfile(id: string, newName?: string): Promise<JobProfile | null> {
  const store = await loadStore();
  const src = store.profiles.find((p) => p.id === id);
  if (!src) return null;
  const copy = clone(src);
  copy.id = uuid();
  copy.name = newName || `${src.name} (copy)`;
  copy.createdAt = copy.updatedAt = nowMs();
  // Document blobs are shared by reference (same blobKey); deleteProfile is
  // orphan-aware so shared blobs are only removed when no profile uses them.
  store.profiles.push(copy);
  await saveStore(store);
  return copy;
}

export async function deleteProfile(id: string): Promise<void> {
  const store = await loadStore();
  const target = store.profiles.find((p) => p.id === id);
  store.profiles = store.profiles.filter((p) => p.id !== id);

  if (store.profiles.length === 0) {
    const fresh = createEmptyProfile('Default profile');
    store.profiles.push(fresh);
    store.activeProfileId = fresh.id;
  } else if (store.activeProfileId === id) {
    store.activeProfileId = store.profiles[0].id;
  }
  await saveStore(store);

  // Remove document blobs that are no longer referenced by any profile.
  if (target) {
    for (const doc of target.documents) {
      const stillUsed = store.profiles.some((p) =>
        p.documents.some((d) => d.blobKey === doc.blobKey),
      );
      if (!stillUsed) await deleteDocumentBlob(doc.blobKey);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export async function attachDocument(
  profileId: string,
  kind: DocumentMeta['kind'],
  file: File,
): Promise<DocumentMeta | null> {
  const store = await loadStore();
  const profile = store.profiles.find((p) => p.id === profileId);
  if (!profile) return null;

  const blobKey = `doc_${uuid()}`;
  await putDocumentBlob(blobKey, file);

  const meta: DocumentMeta = {
    id: uuid(),
    kind,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    addedAt: nowMs(),
    blobKey,
  };

  // Replace any existing document of the same kind (one resume, one cover letter).
  const previous = profile.documents.filter((d) => d.kind === kind);
  profile.documents = profile.documents.filter((d) => d.kind !== kind);
  profile.documents.push(meta);
  await saveStore(store);

  for (const old of previous) {
    const stillUsed = store.profiles.some((p) =>
      p.documents.some((d) => d.blobKey === old.blobKey),
    );
    if (!stillUsed) await deleteDocumentBlob(old.blobKey);
  }
  return meta;
}

export async function removeDocument(profileId: string, docId: string): Promise<void> {
  const store = await loadStore();
  const profile = store.profiles.find((p) => p.id === profileId);
  if (!profile) return;
  const doc = profile.documents.find((d) => d.id === docId);
  profile.documents = profile.documents.filter((d) => d.id !== docId);
  await saveStore(store);
  if (doc) {
    const stillUsed = store.profiles.some((p) =>
      p.documents.some((d) => d.blobKey === doc.blobKey),
    );
    if (!stillUsed) await deleteDocumentBlob(doc.blobKey);
  }
}

/* ------------------------------------------------------------------ */
/* Export / import                                                     */
/* ------------------------------------------------------------------ */

interface DocumentExport {
  blobKey: string;
  fileName: string;
  mimeType: string;
  base64: string;
}

export interface AutoVaultExport {
  autovaultExport: true;
  version: number;
  exportedAt: number;
  profiles: JobProfile[];
  documents: DocumentExport[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  return arrayBufferToBase64(await blob.arrayBuffer());
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  return new Blob([base64ToArrayBuffer(b64)], { type: mimeType });
}

/** Export selected profiles (default: all) as a self-contained JSON string. */
export async function exportJSON(profileIds?: string[]): Promise<string> {
  const store = await loadStore();
  const profiles = profileIds
    ? store.profiles.filter((p) => profileIds.includes(p.id))
    : store.profiles;

  const seen = new Set<string>();
  const documents: DocumentExport[] = [];
  for (const profile of profiles) {
    for (const doc of profile.documents) {
      if (seen.has(doc.blobKey)) continue;
      seen.add(doc.blobKey);
      const blob = await getDocumentBlob(doc.blobKey);
      if (blob) {
        documents.push({
          blobKey: doc.blobKey,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          base64: await blobToBase64(blob),
        });
      }
    }
  }

  const payload: AutoVaultExport = {
    autovaultExport: true,
    version: SCHEMA_VERSION,
    exportedAt: nowMs(),
    profiles: clone(profiles),
    documents,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Import profiles from an export JSON string. New profile + blob ids are minted
 * so imports never clobber existing data. Returns the number imported.
 */
export async function importJSON(json: string): Promise<{ imported: number }> {
  const parsed = JSON.parse(json) as Partial<AutoVaultExport>;
  if (!parsed || parsed.autovaultExport !== true || !Array.isArray(parsed.profiles)) {
    throw new Error('Not a valid AutoVault export file.');
  }
  const store = await loadStore();

  // Recreate document blobs under fresh keys and map old -> new.
  const keyMap = new Map<string, string>();
  for (const doc of parsed.documents ?? []) {
    const newKey = `doc_${uuid()}`;
    await putDocumentBlob(newKey, base64ToBlob(doc.base64, doc.mimeType));
    keyMap.set(doc.blobKey, newKey);
  }

  let imported = 0;
  for (const raw of parsed.profiles) {
    const profile = normalizeProfile(raw);
    profile.id = uuid();
    profile.createdAt = profile.updatedAt = nowMs();
    profile.documents = profile.documents
      .map((d) => {
        const mapped = keyMap.get(d.blobKey);
        return mapped ? { ...d, id: uuid(), blobKey: mapped } : null;
      })
      .filter((d): d is DocumentMeta => d !== null);
    store.profiles.push(profile);
    imported++;
  }
  await saveStore(store);
  return { imported };
}

/* ------------------------------------------------------------------ */
/* Danger zone                                                         */
/* ------------------------------------------------------------------ */

export async function deleteAllData(): Promise<void> {
  await chrome.storage.local.remove(LOCAL_KEY);
  await lock();
  await clearAllDocuments();
  await writeEnvelope({ encrypted: false, store: createDefaultStore() });
}

/* ------------------------------------------------------------------ */
/* Normalization / migration                                           */
/*                                                                     */
/* Deep-merge persisted data with the current defaults so missing or   */
/* renamed fields never throw at read time.                            */
/* ------------------------------------------------------------------ */

function normalizeProfile(input: Partial<JobProfile>): JobProfile {
  const base = createEmptyProfile(input?.name || 'Untitled profile');
  const p = input ?? {};
  return {
    ...base,
    ...p,
    id: p.id || base.id,
    name: p.name || base.name,
    createdAt: p.createdAt || base.createdAt,
    updatedAt: p.updatedAt || base.updatedAt,
    personal: { ...base.personal, ...(p.personal ?? {}) },
    contact: { ...base.contact, ...(p.contact ?? {}) },
    links: {
      ...base.links,
      ...(p.links ?? {}),
      other: Array.isArray(p.links?.other) ? p.links!.other : [],
    },
    work: {
      ...base.work,
      ...(p.work ?? {}),
      desiredSalary: { ...base.work.desiredSalary, ...(p.work?.desiredSalary ?? {}) },
    },
    voluntary: { ...base.voluntary, ...(p.voluntary ?? {}) },
    fillVoluntary: p.fillVoluntary === true,
    documents: Array.isArray(p.documents) ? p.documents : [],
    qa: Array.isArray(p.qa) ? p.qa : [],
  };
}

export function normalizeStore(input: Partial<AutoVaultStore>): AutoVaultStore {
  const store = input ?? {};
  const profiles = Array.isArray(store.profiles) && store.profiles.length
    ? store.profiles.map(normalizeProfile)
    : createDefaultStore().profiles;

  const activeProfileId =
    store.activeProfileId && profiles.some((p) => p.id === store.activeProfileId)
      ? store.activeProfileId
      : profiles[0].id;

  return {
    schemaVersion: SCHEMA_VERSION,
    profiles,
    activeProfileId,
    customDomains: Array.isArray(store.customDomains) ? store.customDomains : [],
    settings: {
      ...defaultSettings(),
      ...(store.settings ?? {}),
      encryption: { ...defaultSettings().encryption, ...(store.settings?.encryption ?? {}) },
    },
  };
}
