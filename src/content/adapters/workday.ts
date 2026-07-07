import type { AtsAdapter } from './types';

/**
 * Workday (*.myworkdayjobs.com).
 * A React app that annotates controls with `data-automation-id`, which is the
 * single most reliable selector. Note: Workday's dropdowns are custom widgets
 * (not <select>), so this adapter targets the real text <input>s; custom
 * dropdowns are left for the user (documented in TESTING.md).
 */
export const workday: AtsAdapter = {
  id: 'workday',
  matches: (h) => /(^|\.)myworkdayjobs\.com$/.test(h) || /(^|\.)myworkday\.com$/.test(h),
  getRoot: () =>
    document.querySelector('[data-automation-id="applyFlowPage"], [data-automation-id="jobApplication"], form') ??
    document,
  hintKey: (ctx) => {
    const aid = (ctx.el.getAttribute('data-automation-id') ?? '').toLowerCase();
    if (!aid) return null;
    if (aid.includes('firstname') || aid.includes('legalnamefirst')) return 'firstName';
    if (aid.includes('lastname') || aid.includes('legalnamelast')) return 'lastName';
    if (aid.includes('preferredname')) return 'preferredName';
    if (aid.includes('email')) return 'email';
    if (aid.includes('phone')) return 'phone';
    if (aid.includes('addressline1') || aid.includes('addresssection_addressline1')) return 'streetAddress';
    if (aid.includes('addressline2')) return 'addressLine2';
    if (aid.includes('city')) return 'city';
    if (aid.includes('postal') || aid.includes('zip')) return 'zip';
    if (aid.includes('region') || aid.includes('state')) return 'state';
    if (aid.includes('country')) return 'country';
    return null;
  },
  fileKindFor: (input) => {
    const t = `${input.name} ${input.id} ${input.getAttribute('data-automation-id') ?? ''}`.toLowerCase();
    if (t.includes('cover')) return 'coverLetter';
    return 'resume';
  },
};
