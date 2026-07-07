import type { AtsAdapter } from './types';

/**
 * LinkedIn Easy Apply (*.linkedin.com).
 * Critically, scope to the Easy Apply modal so we never touch LinkedIn's global
 * search / messaging inputs. If no modal is open, return an empty fragment so
 * nothing matches. Easy Apply is multi-step; the engine's MutationObserver
 * re-fills fields as each step renders.
 */
export const linkedin: AtsAdapter = {
  id: 'linkedin',
  matches: (h) => /(^|\.)linkedin\.com$/.test(h),
  getRoot: () => {
    const modal = document.querySelector(
      '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], div[role="dialog"]',
    );
    return modal ?? document.createDocumentFragment();
  },
  hintKey: (ctx) => {
    const t = ` ${ctx.labelText} ${ctx.ariaLabel} ${ctx.id} ${ctx.name} `;
    if (t.includes(' phone ') || t.includes(' mobile ')) return 'phone';
    if (t.includes(' email ')) return 'email';
    if (t.includes(' first name ')) return 'firstName';
    if (t.includes(' last name ')) return 'lastName';
    if (t.includes(' city ')) return 'city';
    return null;
  },
  fileKindFor: (input) => {
    const t = `${input.name} ${input.id} ${input.getAttribute('aria-label') ?? ''}`.toLowerCase();
    if (t.includes('cover')) return 'coverLetter';
    return 'resume';
  },
};
