import type { AtsAdapter } from './types';

/**
 * iCIMS (*.icims.com).
 * iCIMS markup varies and often renders inside an iframe with opaque field ids,
 * so we lean on the generic label/aria matcher and mainly contribute form
 * scoping plus file-kind detection. `all_frames` in the manifest ensures the
 * content script also runs inside the iCIMS iframe.
 */
export const icims: AtsAdapter = {
  id: 'icims',
  matches: (h) => /(^|\.)icims\.com$/.test(h),
  getRoot: () =>
    document.querySelector('#icims_content_iframe, .iCIMS_MainWrapper, form[name="form"], main') ?? document,
  hintKey: (ctx) => {
    const t = ` ${ctx.id} ${ctx.name} `;
    if (t.includes(' first ') && t.includes(' name ')) return 'firstName';
    if (t.includes(' last ') && t.includes(' name ')) return 'lastName';
    if (t.includes(' email ')) return 'email';
    if (t.includes(' phone ')) return 'phone';
    return null;
  },
  fileKindFor: (input) => {
    const t = `${input.name} ${input.id}`.toLowerCase();
    if (t.includes('cover')) return 'coverLetter';
    return 'resume';
  },
};
