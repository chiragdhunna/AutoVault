import type { AtsAdapter } from './types';
import { greenhouse } from './greenhouse';
import { lever } from './lever';
import { workday } from './workday';
import { icims } from './icims';
import { linkedin } from './linkedin';

const ADAPTERS: AtsAdapter[] = [greenhouse, lever, workday, icims, linkedin];

export function pickAdapter(host: string = location.hostname): AtsAdapter | null {
  return ADAPTERS.find((a) => a.matches(host)) ?? null;
}

export type { AtsAdapter } from './types';
