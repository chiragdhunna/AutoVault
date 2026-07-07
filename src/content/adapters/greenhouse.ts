import type { AtsAdapter } from './types';

/**
 * Greenhouse (boards.greenhouse.io, job-boards.greenhouse.io).
 * Classic ids: #first_name, #last_name, #email, #phone; file inputs named
 * "resume"/"cover_letter". Labels are reliable, so hints just harden the basics.
 */
export const greenhouse: AtsAdapter = {
  id: 'greenhouse',
  matches: (h) => /(^|\.)greenhouse\.io$/.test(h),
  getRoot: () =>
    document.querySelector('#application_form, #application-form, .application--form, form[id*="application"]') ??
    document,
  hintKey: (ctx) => {
    const t = ` ${ctx.id} ${ctx.name} `;
    if (t.includes(' first name ') || /\bfirst\b/.test(ctx.id)) return 'firstName';
    if (t.includes(' last name ') || /\blast\b/.test(ctx.id)) return 'lastName';
    if (t.includes(' email ')) return 'email';
    if (t.includes(' phone ')) return 'phone';
    return null;
  },
  fileKindFor: (input) => {
    const t = `${input.name} ${input.id} ${input.getAttribute('aria-label') ?? ''}`.toLowerCase();
    if (t.includes('cover')) return 'coverLetter';
    if (t.includes('resume') || t.includes('cv')) return 'resume';
    return null;
  },
};
