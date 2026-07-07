import type { AtsId } from '../../lib/ats';
import type { FieldKey } from '../../lib/fields';
import type { DocumentKind } from '../../types/schema';
import type { FieldContext } from '../matcher';

/**
 * Per-ATS adapter. Everything except `id`/`matches` is optional — an adapter is
 * a set of hints layered on top of the generic matching engine, not a
 * replacement for it. Because these platforms keep a consistent DOM across
 * companies, a few targeted selectors dramatically improve accuracy.
 */
export interface AtsAdapter {
  id: AtsId;
  matches(host: string): boolean;
  /** Scope the field search to the application form (avoids nav/search inputs). */
  getRoot?(): ParentNode;
  /** Short-circuit key detection for a control when the DOM is unambiguous. */
  hintKey?(ctx: FieldContext): FieldKey | null;
  /** Which document a given file input expects. */
  fileKindFor?(input: HTMLInputElement): DocumentKind | null;
}
