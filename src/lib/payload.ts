/** Turn a stored profile into the minimal payload the content engine consumes. */
import type { JobProfile, AppSettings } from '../types/schema';
import { ALL_FIELD_KEYS, VOLUNTARY_KEYS, resolveFieldValue } from './fields';
import type { FillPayload } from '../shared/messages';

export function buildFillPayload(profile: JobProfile, settings: AppSettings): FillPayload {
  const fields = ALL_FIELD_KEYS.filter((k) => profile.fillVoluntary || !VOLUNTARY_KEYS.has(k))
    .map((key) => ({ key, value: resolveFieldValue(profile, key) }))
    .filter((f) => f.value.trim() !== '');

  const qa = profile.qa
    .filter((q) => q.question.trim() && q.answer.trim())
    .map((q) => ({ question: q.question, answer: q.answer }));

  return {
    fields,
    qa,
    documents: {
      resume: profile.documents.find((d) => d.kind === 'resume')?.fileName,
      coverLetter: profile.documents.find((d) => d.kind === 'coverLetter')?.fileName,
    },
    settings: {
      highlightFilled: settings.highlightFilled,
      showFileHints: settings.showFileHints,
    },
  };
}
