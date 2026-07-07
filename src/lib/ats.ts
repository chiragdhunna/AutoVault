/** Known ATS platforms: detection + the host patterns declared in the manifest. */

export type AtsId = 'greenhouse' | 'lever' | 'workday' | 'icims' | 'linkedin' | 'unknown';

export interface AtsDescriptor {
  id: AtsId;
  label: string;
  /** hostname test */
  test: (host: string) => boolean;
  /** match pattern mirrored in manifest host_permissions / content_scripts */
  hostPattern: string;
}

export const KNOWN_ATS: AtsDescriptor[] = [
  {
    id: 'greenhouse',
    label: 'Greenhouse',
    test: (h) => /(^|\.)greenhouse\.io$/.test(h),
    hostPattern: '*://*.greenhouse.io/*',
  },
  {
    id: 'lever',
    label: 'Lever',
    test: (h) => /(^|\.)lever\.co$/.test(h),
    hostPattern: '*://*.lever.co/*',
  },
  {
    id: 'workday',
    label: 'Workday',
    test: (h) => /(^|\.)myworkdayjobs\.com$/.test(h),
    hostPattern: '*://*.myworkdayjobs.com/*',
  },
  {
    id: 'icims',
    label: 'iCIMS',
    test: (h) => /(^|\.)icims\.com$/.test(h),
    hostPattern: '*://*.icims.com/*',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn Easy Apply',
    test: (h) => /(^|\.)linkedin\.com$/.test(h),
    hostPattern: '*://*.linkedin.com/*',
  },
];

export function detectAts(host: string = location.hostname): AtsId {
  const match = KNOWN_ATS.find((a) => a.test(host));
  return match ? match.id : 'unknown';
}

export function atsLabel(id: AtsId): string {
  return KNOWN_ATS.find((a) => a.id === id)?.label ?? 'Generic form';
}
