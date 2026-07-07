/**
 * Optional at-rest encryption for the stored profile.
 *
 * Key derivation: PBKDF2(SHA-256) over the user's passphrase + a random salt.
 * Encryption: AES-GCM-256 with a fresh 96-bit IV per message.
 *
 * All primitives come from the Web Crypto API (crypto.subtle), which is
 * available in extension pages, the service worker, and content scripts.
 * Nothing here touches the network.
 */
import type { EncryptedBlob } from '../types/schema';
import { arrayBufferToBase64, base64ToArrayBuffer } from './util';

export const PBKDF2_ITERATIONS = 250_000;

/** Known plaintext used to validate that an entered passphrase is correct. */
const VERIFIER_PLAINTEXT = 'autovault::verifier::v1';

export function generateSaltB64(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt.buffer);
}

/**
 * Derive an AES-GCM key from a passphrase.
 * @param extractable when true, the raw key bytes can be exported (used to
 *   cache the unlocked key in chrome.storage.session for the browser session).
 */
export async function deriveKey(
  passphrase: string,
  saltB64: string,
  iterations: number = PBKDF2_ITERATIONS,
  extractable = false,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(base64ToArrayBuffer(saltB64)),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

export async function exportKeyB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

export async function importKeyB64(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(rawB64),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptString(plaintext: string, key: CryptoKey): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { iv: arrayBufferToBase64(iv.buffer), data: arrayBufferToBase64(ciphertext) };
}

export async function decryptString(blob: EncryptedBlob, key: CryptoKey): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(base64ToArrayBuffer(blob.iv)) },
    key,
    base64ToArrayBuffer(blob.data),
  );
  return new TextDecoder().decode(plaintext);
}

export async function makeVerifier(key: CryptoKey): Promise<EncryptedBlob> {
  return encryptString(VERIFIER_PLAINTEXT, key);
}

/** Returns true iff `key` correctly decrypts the verifier blob. */
export async function verifyKey(blob: EncryptedBlob, key: CryptoKey): Promise<boolean> {
  try {
    return (await decryptString(blob, key)) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
