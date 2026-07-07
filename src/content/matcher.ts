/**
 * Field-matching engine.
 *
 * For each form control we assemble text "signals" (associated <label>, name,
 * id, aria-label, placeholder, title, and nearby text) and score them against
 * the synonym dictionary. The highest-scoring canonical key above a threshold
 * wins. `autocomplete` attributes are treated as near-certain matches.
 */
import type { FieldKey } from '../lib/fields';
import { normalizeText } from '../lib/util';
import { SYNONYMS } from './synonyms';

export type FillableEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export const MATCH_THRESHOLD = 22;

const EXCLUDED_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'file',
  'password',
  'checkbox',
  'radio',
  'color',
  'range',
]);

export interface FieldContext {
  el: FillableEl;
  type: string; // 'select' | 'textarea' | input type
  autocomplete: string; // raw, lowercased
  labelText: string;
  ariaLabel: string;
  name: string;
  id: string;
  placeholder: string;
  title: string;
  nearbyText: string;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\#.:>~+*[\]]/g, '\\$&');
}

export function isVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
    return false;
  }
  if (style.position === 'fixed') return true;
  return el.getClientRects().length > 0;
}

function isFillable(el: FillableEl): boolean {
  if ((el as HTMLInputElement).disabled) return false;
  if ((el as HTMLInputElement).readOnly) return false;
  if (!isVisible(el)) return false;
  if (el.tagName === 'INPUT' && EXCLUDED_INPUT_TYPES.has((el as HTMLInputElement).type)) return false;
  return true;
}

export function collectControls(root: ParentNode = document): FillableEl[] {
  const nodes = Array.from(root.querySelectorAll<FillableEl>('input, textarea, select'));
  return nodes.filter(isFillable);
}

export function collectFileInputs(root: ParentNode = document): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('input[type="file"]')).filter((el) =>
    isVisible(el),
  );
}

export interface ChoiceGroup {
  name: string;
  type: 'radio' | 'checkbox';
  inputs: HTMLInputElement[];
  context: FieldContext;
}

export function collectChoiceGroups(root: ParentNode = document): ChoiceGroup[] {
  const inputs = Array.from(
    root.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'),
  ).filter((el) => !el.disabled && isVisible(el));

  const byName = new Map<string, HTMLInputElement[]>();
  for (const el of inputs) {
    const key = `${el.type}:${el.name || el.id || Math.random().toString(36)}`;
    const arr = byName.get(key) ?? [];
    arr.push(el);
    byName.set(key, arr);
  }

  const groups: ChoiceGroup[] = [];
  for (const [key, els] of byName) {
    const type = key.startsWith('radio') ? 'radio' : 'checkbox';
    groups.push({
      name: els[0].name,
      type,
      inputs: els,
      context: describeGroup(els),
    });
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Signal extraction                                                   */
/* ------------------------------------------------------------------ */

function labelForControl(el: Element): string {
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const txt = labelledby
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (txt) return txt;
  }
  const id = (el as HTMLElement).id;
  if (id) {
    try {
      const lab = document.querySelector(`label[for="${cssEscape(id)}"]`);
      if (lab?.textContent?.trim()) return lab.textContent;
    } catch {
      /* invalid selector */
    }
  }
  const wrap = el.closest('label');
  if (wrap?.textContent?.trim()) return wrap.textContent;
  return '';
}

function nearbyText(el: Element): string {
  const chunks: string[] = [];
  const container = el.closest(
    '.field, .form-group, .form-field, [class*="field"], [class*="question"], [class*="form-group"], fieldset, [role="group"]',
  );
  if (container && container !== el) {
    const lbl = container.querySelector('label, legend, [class*="label"], [class*="title"]');
    if (lbl?.textContent?.trim()) chunks.push(lbl.textContent);
  }
  let prev = el.previousElementSibling;
  let hops = 0;
  while (prev && hops < 3) {
    if (!/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(prev.tagName)) {
      const t = prev.textContent?.trim();
      if (t) chunks.push(t);
    }
    prev = prev.previousElementSibling;
    hops++;
  }
  return chunks.join(' ').slice(0, 240);
}

export function describe(el: FillableEl): FieldContext {
  const type = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : (el as HTMLInputElement).type || 'text';
  return {
    el,
    type,
    autocomplete: (el.getAttribute('autocomplete') ?? '').toLowerCase().trim(),
    labelText: normalizeText(labelForControl(el)),
    ariaLabel: normalizeText(el.getAttribute('aria-label') ?? ''),
    name: normalizeText(el.getAttribute('name') ?? ''),
    id: normalizeText(el.getAttribute('id') ?? ''),
    placeholder: normalizeText((el as HTMLInputElement).placeholder ?? ''),
    title: normalizeText(el.getAttribute('title') ?? ''),
    nearbyText: normalizeText(nearbyText(el)),
  };
}

function describeGroup(inputs: HTMLInputElement[]): FieldContext {
  const first = inputs[0];
  const fieldset = first.closest('fieldset, [role="group"], .form-group, [class*="field"]');
  let groupLabel = '';
  if (fieldset) {
    const legend = fieldset.querySelector('legend, label, [class*="label"], [class*="title"], [class*="question"]');
    if (legend?.textContent?.trim()) groupLabel = legend.textContent;
  }
  return {
    el: first,
    type: first.type,
    autocomplete: '',
    labelText: normalizeText(groupLabel || labelForControl(first)),
    ariaLabel: normalizeText(first.getAttribute('aria-label') ?? ''),
    name: normalizeText(first.getAttribute('name') ?? ''),
    id: normalizeText(first.getAttribute('id') ?? ''),
    placeholder: '',
    title: normalizeText(first.getAttribute('title') ?? ''),
    nearbyText: normalizeText(nearbyText(first)),
  };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function contains(text: string, keyword: string): boolean {
  const k = normalizeText(keyword);
  if (!k) return false;
  return ` ${text} `.includes(` ${k} `);
}

function bestKeywordLength(text: string, keywords: string[]): number {
  let best = 0;
  for (const kw of keywords) {
    if (contains(text, kw)) {
      const len = normalizeText(kw).length;
      if (len > best) best = len;
    }
  }
  return best;
}

export function scoreKey(ctx: FieldContext, key: FieldKey): number {
  const syn = SYNONYMS[key];
  let score = 0;

  if (ctx.autocomplete && ctx.autocomplete !== 'off' && ctx.autocomplete !== 'on') {
    const acTokens = ctx.autocomplete.split(/\s+/);
    if (syn.autocomplete.some((a) => acTokens.includes(a))) score += 120;
  }

  const signals: Array<[string, number]> = [
    [ctx.labelText, 10],
    [ctx.ariaLabel, 10],
    [ctx.name, 6],
    [ctx.id, 5],
    [ctx.placeholder, 5],
    [ctx.title, 5],
    [ctx.nearbyText, 3],
  ];

  for (const [text, weight] of signals) {
    if (!text) continue;
    const m = bestKeywordLength(text, syn.keywords);
    if (m > 0) score += weight * m;
    if (syn.negative) {
      for (const neg of syn.negative) {
        if (contains(text, neg)) score -= weight * normalizeText(neg).length * 0.8;
      }
    }
  }
  return score;
}

export function bestKeyFor(
  ctx: FieldContext,
  keys: Iterable<FieldKey>,
): { key: FieldKey; score: number } | null {
  let best: FieldKey | null = null;
  let bestScore = 0;
  for (const key of keys) {
    const s = scoreKey(ctx, key);
    if (s > bestScore) {
      bestScore = s;
      best = key;
    }
  }
  return best && bestScore >= MATCH_THRESHOLD ? { key: best, score: bestScore } : null;
}
