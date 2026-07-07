/**
 * Autofill orchestration.
 *
 * 1. Pick an ATS adapter and scope the search to the application form.
 * 2. Match & fill text inputs / textareas / selects.
 * 3. Fall back to the Q&A bank for unmatched free-text fields.
 * 4. Match & set radio / checkbox groups for enum-style questions.
 * 5. Flag file inputs (never fake-set them) with a copy-filename helper.
 * 6. Optionally highlight everything that changed.
 */
import type { FillPayload, FillResult } from '../shared/messages';
import type { FieldKey } from '../lib/fields';
import type { DocumentKind } from '../types/schema';
import { normalizeText } from '../lib/util';
import {
  collectControls,
  collectFileInputs,
  collectChoiceGroups,
  describe,
  bestKeyFor,
  type FieldContext,
  type FillableEl,
  type ChoiceGroup,
} from './matcher';
import { setTextValue, selectBestOption, setChecked, textMatchScore } from './filler';
import { highlightFilled, flagFileInput } from './highlight';
import { pickAdapter, type AtsAdapter } from './adapters';

const FILLED_ATTR = 'data-autovault-filled';

/** Keys that typically appear as <select>/radio/checkbox rather than free text. */
const CHOICE_KEYS: FieldKey[] = [
  'workAuthorization',
  'requiresSponsorship',
  'genderIdentity',
  'veteranStatus',
  'disabilityStatus',
];

function isTextOrArea(el: FillableEl): el is HTMLInputElement | HTMLTextAreaElement {
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

function isEmpty(el: FillableEl): boolean {
  return (el.value ?? '').trim() === '';
}

function markFilled(el: Element): void {
  el.setAttribute(FILLED_ATTR, '1');
}

function optionLabel(input: HTMLInputElement): string {
  const viaLabels = input.labels && input.labels[0]?.textContent;
  if (viaLabels?.trim()) return viaLabels;
  const wrap = input.closest('label');
  if (wrap?.textContent?.trim()) return wrap.textContent;
  const aria = input.getAttribute('aria-label');
  if (aria) return aria;
  return input.value;
}

function resolveKey(ctx: FieldContext, adapter: AtsAdapter | null, valueKeys: FieldKey[]): FieldKey | null {
  if (ctx.el.tagName === 'INPUT') {
    const t = (ctx.el as HTMLInputElement).type;
    if (t === 'email' && valueKeys.includes('email')) return 'email';
    if (t === 'tel' && valueKeys.includes('phone')) return 'phone';
  }
  const hinted = adapter?.hintKey?.(ctx);
  if (hinted && valueKeys.includes(hinted)) return hinted;
  return bestKeyFor(ctx, valueKeys)?.key ?? null;
}

function fillTextOrSelect(el: FillableEl, value: string, highlight: boolean): boolean {
  if (el.tagName === 'SELECT') {
    const sel = el as HTMLSelectElement;
    if (sel.value && sel.selectedIndex > 0) return false; // user/site already chose
    const ok = selectBestOption(sel, value);
    if (ok && highlight) highlightFilled(sel);
    return ok;
  }
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  if (!isEmpty(input)) return false; // never overwrite existing input
  const ok = setTextValue(input, value);
  if (ok && highlight) highlightFilled(input);
  return ok;
}

function matchQA(ctx: FieldContext, qa: FillPayload['qa']): string | null {
  const hay = `${ctx.labelText} ${ctx.ariaLabel} ${ctx.placeholder} ${ctx.nearbyText}`.trim();
  if (!hay) return null;
  const hayTokens = new Set(hay.split(' ').filter(Boolean));
  for (const { question, answer } of qa) {
    const q = normalizeText(question);
    if (!q) continue;
    if (hay.includes(q)) return answer;
    const qt = q.split(' ').filter(Boolean);
    if (qt.length >= 3) {
      let found = 0;
      for (const t of qt) if (hayTokens.has(t)) found++;
      if (found / qt.length >= 0.7) return answer;
    }
  }
  return null;
}

function fillChoice(group: ChoiceGroup, value: string, highlight: boolean): boolean {
  const v = normalizeText(value);

  if (group.type === 'radio') {
    let best: HTMLInputElement | null = null;
    let bestScore = 0;
    for (const input of group.inputs) {
      const s = textMatchScore(value, optionLabel(input), input.value);
      if (s > bestScore) {
        bestScore = s;
        best = input;
      }
    }
    if (best && bestScore >= 0.5) {
      const ok = setChecked(best, true);
      if (ok && highlight) highlightFilled(best.labels?.[0] ?? best);
      return ok;
    }
    return false;
  }

  // checkbox
  if (group.inputs.length === 1) {
    if (v !== 'yes' && v !== 'true') return false; // only check for affirmative
    const ok = setChecked(group.inputs[0], true);
    if (ok && highlight) highlightFilled(group.inputs[0].labels?.[0] ?? group.inputs[0]);
    return ok;
  }
  let best: HTMLInputElement | null = null;
  let bestScore = 0;
  for (const input of group.inputs) {
    const s = textMatchScore(value, optionLabel(input), input.value);
    if (s > bestScore) {
      bestScore = s;
      best = input;
    }
  }
  if (best && bestScore >= 0.6) {
    const ok = setChecked(best, true);
    if (ok && highlight) highlightFilled(best.labels?.[0] ?? best);
    return ok;
  }
  return false;
}

function fileKindFor(input: HTMLInputElement, adapter: AtsAdapter | null): DocumentKind {
  const fromAdapter = adapter?.fileKindFor?.(input);
  if (fromAdapter) return fromAdapter;
  const t = normalizeText(
    `${input.name} ${input.id} ${input.labels?.[0]?.textContent ?? ''} ${input.getAttribute('aria-label') ?? ''}`,
  );
  return t.includes('cover') ? 'coverLetter' : 'resume';
}

export function runFill(payload: FillPayload): FillResult {
  const adapter = pickAdapter(location.hostname);
  const root: ParentNode = adapter?.getRoot?.() ?? document;

  const values = new Map<FieldKey, string>();
  for (const f of payload.fields) if (f.value.trim()) values.set(f.key, f.value);
  const valueKeys = Array.from(values.keys());
  const choiceKeys = CHOICE_KEYS.filter((k) => values.has(k));
  const highlight = payload.settings.highlightFilled;

  let filled = 0;
  let matched = 0;

  // 1 + 3: text-like controls, with Q&A fallback
  for (const el of collectControls(root)) {
    if (el.getAttribute(FILLED_ATTR) === '1') continue;
    const ctx = describe(el);
    const key = resolveKey(ctx, adapter, valueKeys);
    if (key) {
      matched++;
      if (fillTextOrSelect(el, values.get(key)!, highlight)) {
        filled++;
        markFilled(el);
      }
    } else if (isTextOrArea(el) && isEmpty(el) && payload.qa.length) {
      const answer = matchQA(ctx, payload.qa);
      if (answer !== null) {
        matched++;
        if (setTextValue(el, answer)) {
          filled++;
          markFilled(el);
          if (highlight) highlightFilled(el);
        }
      }
    }
  }

  // 4: radio / checkbox groups
  if (choiceKeys.length) {
    for (const group of collectChoiceGroups(root)) {
      const key = bestKeyFor(group.context, choiceKeys)?.key;
      if (!key) continue;
      matched++;
      if (fillChoice(group, values.get(key)!, highlight)) filled++;
    }
  }

  // 5: file inputs (flag only — browsers forbid programmatic file setting)
  let fileInputs = 0;
  if (payload.settings.showFileHints) {
    for (const input of collectFileInputs(root)) {
      const kind = fileKindFor(input, adapter);
      const filename = kind === 'coverLetter' ? payload.documents.coverLetter : payload.documents.resume;
      flagFileInput(input, filename, kind === 'coverLetter' ? 'cover letter' : 'résumé');
      fileInputs++;
    }
  }

  return { filled, matched, fileInputs, adapter: adapter?.id ?? 'unknown' };
}
