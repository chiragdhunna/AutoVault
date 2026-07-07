import type { AtsAdapter } from './types';

/**
 * Lever (jobs.lever.co).
 * Uses stable field names: name, email, phone, org (current company), and
 * urls[LinkedIn] / urls[GitHub] / urls[Portfolio]. Those names are the most
 * reliable signal, so we read the raw attribute directly.
 */
export const lever: AtsAdapter = {
  id: 'lever',
  matches: (h) => /(^|\.)lever\.co$/.test(h),
  getRoot: () =>
    document.querySelector('.application-form, form[action*="lever"], .application-page') ?? document,
  hintKey: (ctx) => {
    const raw = (ctx.el.getAttribute('name') ?? '').toLowerCase();
    if (raw === 'name') return 'fullName';
    if (raw === 'email') return 'email';
    if (raw === 'phone') return 'phone';
    if (raw === 'org' || raw === 'company') return 'currentEmployer';
    if (raw.includes('linkedin')) return 'linkedin';
    if (raw.includes('github')) return 'github';
    if (raw.includes('portfolio')) return 'portfolio';
    return null;
  },
  fileKindFor: (input) => {
    const t = `${input.name} ${input.id}`.toLowerCase();
    if (t.includes('cover')) return 'coverLetter';
    return 'resume';
  },
};
