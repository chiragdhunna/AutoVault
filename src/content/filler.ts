/**
 * Low-level value setting.
 *
 * Controlled React/Vue inputs ignore a plain `el.value = x` because the
 * framework owns the value. The reliable fix is to call the NATIVE value setter
 * from the element prototype (bypassing React's override) and then dispatch the
 * 'input' and 'change' events the framework listens for. We also fire
 * 'focusout' to satisfy blur-based validation.
 */
import { normalizeText } from '../lib/util';

const inputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
const textareaValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
const selectValueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
const checkedSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;

function fireInputChange(el: Element): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('focusout', { bubbles: true }));
}

export function setTextValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
  const setter = el instanceof HTMLTextAreaElement ? textareaValueSetter : inputValueSetter;
  if (setter) setter.call(el, value);
  else el.value = value;
  fireInputChange(el);
  return el.value === value;
}

export function setSelectValue(sel: HTMLSelectElement, optionValue: string): boolean {
  if (selectValueSetter) selectValueSetter.call(sel, optionValue);
  else sel.value = optionValue;
  fireInputChange(sel);
  return sel.value === optionValue;
}

export function setChecked(el: HTMLInputElement, desired: boolean): boolean {
  if (el.checked === desired) return true;
  // A real click is the most framework-friendly way to toggle.
  el.click();
  if (el.checked === desired) return true;
  // Fallback: native setter + synthetic events.
  if (checkedSetter) checkedSetter.call(el, desired);
  else el.checked = desired;
  fireInputChange(el);
  return el.checked === desired;
}

/* ------------------------------------------------------------------ */
/* Fuzzy matching for <select> options and radio labels                */
/* ------------------------------------------------------------------ */

function toTokens(s: string): Set<string> {
  return new Set(s.split(' ').filter(Boolean));
}

function jaccard(a: string, b: string): number {
  const A = toTokens(a);
  const B = toTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Similarity in [0,1] between a desired value and a candidate's text/value. */
export function textMatchScore(value: string, candidateText: string, candidateValue = ''): number {
  const target = normalizeText(value);
  if (!target) return 0;
  const ot = normalizeText(candidateText);
  const ov = normalizeText(candidateValue);
  if (ot === target || ov === target) return 1;

  let best = 0;
  if (ot) {
    if (ot.includes(target) || target.includes(ot)) {
      const ratio = Math.min(ot.length, target.length) / Math.max(ot.length, target.length);
      best = Math.max(best, 0.6 + 0.3 * ratio);
    }
    best = Math.max(best, jaccard(target, ot));
  }
  if (ov && (ov.includes(target) || target.includes(ov))) {
    best = Math.max(best, 0.7);
  }
  return best;
}

/** Pick and set the <select> option that best matches `value`. */
export function selectBestOption(sel: HTMLSelectElement, value: string, threshold = 0.5): boolean {
  let best: HTMLOptionElement | null = null;
  let bestScore = 0;
  for (const opt of Array.from(sel.options)) {
    if (!opt.value && !opt.textContent?.trim()) continue; // skip empty placeholder
    const score = textMatchScore(value, opt.textContent ?? '', opt.value);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }
  if (best && bestScore >= threshold) {
    return setSelectValue(sel, best.value);
  }
  return false;
}
