/**
 * Cross-context messaging contract.
 *
 * The popup/options resolve the active profile into a minimal FillPayload and
 * send it to the content script. Only non-empty values are included, and EEO /
 * voluntary values are only present when the profile opted in — so nothing
 * sensitive is transmitted unless explicitly enabled.
 */
import type { FieldKey } from '../lib/fields';

export interface ResolvedField {
  key: FieldKey;
  value: string;
}

export interface FillPayload {
  fields: ResolvedField[];
  qa: { question: string; answer: string }[];
  /** filenames only — used to render the file-input hint tooltip */
  documents: { resume?: string; coverLetter?: string };
  settings: {
    highlightFilled: boolean;
    showFileHints: boolean;
  };
}

export interface FillResult {
  /** number of fields whose value was actually written */
  filled: number;
  /** number of DOM fields that matched a profile key (>= filled) */
  matched: number;
  /** number of file inputs that were flagged with a hint */
  fileInputs: number;
  /** detected ATS adapter id */
  adapter: string;
}

export type ContentMessage =
  | { type: 'AV_PING' }
  | { type: 'AV_AUTOFILL'; payload: FillPayload };

export interface PingResponse {
  ok: true;
  adapter: string;
}

/** Content script → background: fetch the current profile's payload for auto-fill-on-load. */
export type BackgroundMessage = { type: 'AV_GET_PAYLOAD' };

export interface PayloadResponse {
  autofillOnLoad: boolean;
  locked: boolean;
  payload: FillPayload | null;
}

/** Runtime type guard for messages arriving at the content script. */
export function isContentMessage(msg: unknown): msg is ContentMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    ((msg as { type: string }).type === 'AV_PING' ||
      (msg as { type: string }).type === 'AV_AUTOFILL')
  );
}
