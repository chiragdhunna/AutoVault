/**
 * Canonical fillable field keys and the logic that turns a stored profile into
 * concrete string values for each key. Shared by the popup (which builds the
 * fill payload) and the content engine (which matches DOM fields to keys).
 */
import type {
  JobProfile,
  SalaryExpectation,
  WorkInfo,
  GenderIdentity,
  VeteranStatus,
  DisabilityStatus,
  YesNoUnspecified,
  WorkAuthStatus,
} from '../types/schema';

export type FieldKey =
  // personal
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'preferredName'
  | 'pronouns'
  // contact
  | 'phone'
  | 'email'
  | 'streetAddress'
  | 'addressLine2'
  | 'city'
  | 'state'
  | 'zip'
  | 'country'
  // links
  | 'linkedin'
  | 'github'
  | 'portfolio'
  // work
  | 'currentTitle'
  | 'currentEmployer'
  | 'yearsOfExperience'
  | 'desiredSalary'
  | 'workAuthorization'
  | 'requiresSponsorship'
  | 'noticePeriod'
  | 'startDate'
  // voluntary / EEO
  | 'raceEthnicity'
  | 'genderIdentity'
  | 'veteranStatus'
  | 'disabilityStatus';

/** Every fillable key, in a sensible priority order. */
export const ALL_FIELD_KEYS: readonly FieldKey[] = [
  'fullName',
  'firstName',
  'lastName',
  'preferredName',
  'pronouns',
  'email',
  'phone',
  'streetAddress',
  'addressLine2',
  'city',
  'state',
  'zip',
  'country',
  'linkedin',
  'github',
  'portfolio',
  'currentTitle',
  'currentEmployer',
  'yearsOfExperience',
  'desiredSalary',
  'workAuthorization',
  'requiresSponsorship',
  'noticePeriod',
  'startDate',
  'raceEthnicity',
  'genderIdentity',
  'veteranStatus',
  'disabilityStatus',
];

/** Keys that belong to the voluntary/EEO section — never filled unless opted in. */
export const VOLUNTARY_KEYS: ReadonlySet<FieldKey> = new Set<FieldKey>([
  'raceEthnicity',
  'genderIdentity',
  'veteranStatus',
  'disabilityStatus',
]);

/** Keys whose value is a boolean-style yes/no answer (drives radio/checkbox logic). */
export const BOOLEAN_KEYS: ReadonlySet<FieldKey> = new Set<FieldKey>(['requiresSponsorship']);

export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function yesNo(v: YesNoUnspecified): string {
  return v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '';
}

export function workAuthLabel(work: WorkInfo): string {
  const map: Record<WorkAuthStatus, string> = {
    '': '',
    us_citizen: 'U.S. Citizen',
    permanent_resident: 'Permanent Resident (Green Card)',
    visa_authorized: 'Authorized to work on a visa',
    need_sponsorship: 'Require sponsorship',
    other: work.workAuthorizationOther || 'Other',
  };
  return map[work.workAuthorization];
}

function genderLabel(v: GenderIdentity): string {
  const map: Record<GenderIdentity, string> = {
    '': '',
    male: 'Male',
    female: 'Female',
    nonbinary: 'Non-binary',
    decline: 'Decline to self-identify',
  };
  return map[v];
}

function veteranLabel(v: VeteranStatus): string {
  const map: Record<VeteranStatus, string> = {
    '': '',
    not_veteran: 'I am not a protected veteran',
    veteran: 'I am a veteran',
    protected_veteran: 'I am a protected veteran',
    decline: 'Decline to self-identify',
  };
  return map[v];
}

function disabilityLabel(v: DisabilityStatus): string {
  const map: Record<DisabilityStatus, string> = {
    '': '',
    yes: 'Yes, I have a disability',
    no: 'No, I do not have a disability',
    decline: "I don't wish to answer",
  };
  return map[v];
}

export function formatSalary(s: SalaryExpectation): string {
  const per = s.period === 'year' ? '/yr' : s.period === 'month' ? '/mo' : '/hr';
  const cur = s.currency || 'USD';
  if (s.min && s.max) return `${cur} ${s.min}–${s.max}${per}`;
  if (s.min) return `${cur} ${s.min}${per}`;
  if (s.max) return `${cur} ${s.max}${per}`;
  return '';
}

/** Resolve a canonical field key to its display/fill string for a profile. */
export function resolveFieldValue(profile: JobProfile, key: FieldKey): string {
  const { first, last } = splitName(profile.personal.fullName);
  switch (key) {
    case 'fullName':
      return profile.personal.fullName;
    case 'firstName':
      return first;
    case 'lastName':
      return last;
    case 'preferredName':
      return profile.personal.preferredName || first;
    case 'pronouns':
      return profile.personal.pronouns;
    case 'phone':
      return profile.contact.phone;
    case 'email':
      return profile.contact.email;
    case 'streetAddress':
      return profile.contact.streetAddress;
    case 'addressLine2':
      return profile.contact.addressLine2;
    case 'city':
      return profile.contact.city;
    case 'state':
      return profile.contact.state;
    case 'zip':
      return profile.contact.zip;
    case 'country':
      return profile.contact.country;
    case 'linkedin':
      return profile.links.linkedin;
    case 'github':
      return profile.links.github;
    case 'portfolio':
      return profile.links.portfolio;
    case 'currentTitle':
      return profile.work.currentTitle;
    case 'currentEmployer':
      return profile.work.currentEmployer;
    case 'yearsOfExperience':
      return profile.work.yearsOfExperience;
    case 'desiredSalary':
      return formatSalary(profile.work.desiredSalary);
    case 'workAuthorization':
      return workAuthLabel(profile.work);
    case 'requiresSponsorship':
      return yesNo(profile.work.requiresSponsorship);
    case 'noticePeriod':
      return profile.work.noticePeriod;
    case 'startDate':
      return profile.work.startDateAvailability;
    case 'raceEthnicity':
      return profile.voluntary.raceEthnicity;
    case 'genderIdentity':
      return genderLabel(profile.voluntary.genderIdentity);
    case 'veteranStatus':
      return veteranLabel(profile.voluntary.veteranStatus);
    case 'disabilityStatus':
      return disabilityLabel(profile.voluntary.disabilityStatus);
    default:
      return '';
  }
}
