/**
 * Content-script entry point.
 *
 * Built as a self-contained IIFE (see vite.content.config.ts) so it can be both
 * declared in the manifest for known ATS domains AND injected on demand by the
 * popup via chrome.scripting for any other page. Guarded so re-injection is a
 * no-op.
 */
import { runFill } from './engine';
import { observeAndRefill } from './observer';
import { detectAts } from '../lib/ats';
import { collectControls, collectFileInputs } from './matcher';
import {
  isContentMessage,
  type FillResult,
  type PingResponse,
  type PayloadResponse,
  type BackgroundMessage,
} from '../shared/messages';

declare global {
  interface Window {
    __AUTOVAULT_ACTIVE__?: boolean;
  }
}

if (!window.__AUTOVAULT_ACTIVE__) {
  window.__AUTOVAULT_ACTIVE__ = true;
  init();
}

function init(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
  void maybeAutofillOnLoad();
}

function handleMessage(
  msg: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  if (!isContentMessage(msg)) return false;

  if (msg.type === 'AV_PING') {
    const resp: PingResponse = { ok: true, adapter: detectAts(location.hostname) };
    sendResponse(resp);
    return true;
  }

  // AV_AUTOFILL. If this is an empty sub-frame, stay silent so the frame that
  // actually holds the form provides the response the popup reads.
  const controlCount = collectControls().length + collectFileInputs().length;
  if (window.top !== window && controlCount === 0) return false;

  const result: FillResult = runFill(msg.payload);
  observeAndRefill(() => runFill(msg.payload), 8000);
  sendResponse(result);
  return true;
}

function sendToBackground<T>(msg: BackgroundMessage): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (r) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve((r as T) ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function maybeAutofillOnLoad(): Promise<void> {
  // Only auto-run on recognized ATS pages, and only when the user opted in.
  if (detectAts(location.hostname) === 'unknown') return;
  const resp = await sendToBackground<PayloadResponse>({ type: 'AV_GET_PAYLOAD' });
  if (resp && resp.autofillOnLoad && resp.payload) {
    const payload = resp.payload;
    window.setTimeout(() => {
      runFill(payload);
      observeAndRefill(() => runFill(payload), 8000);
    }, 400);
  }
}
