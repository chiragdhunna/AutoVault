import {
  type AutoVaultStore,
  type JobProfile,
  type AppSettings,
  SCHEMA_VERSION,
  DEFAULT_CURRENCY,
} from '../types/schema';
import { uuid, nowMs } from './util';

export function defaultSettings(): AppSettings {
  return {
    highlightFilled: true,
    showFileHints: true,
    autofillOnLoad: false,
    encryption: { enabled: false },
  };
}

export function createEmptyProfile(name: string): JobProfile {
  const t = nowMs();
  return {
    id: uuid(),
    name,
    createdAt: t,
    updatedAt: t,
    personal: { fullName: '', preferredName: '', pronouns: '' },
    contact: {
      phone: '',
      email: '',
      streetAddress: '',
      addressLine2: '',
      city: '',
      state: '',
      zip: '',
      country: '',
    },
    links: { linkedin: '', github: '', portfolio: '', other: [] },
    work: {
      currentTitle: '',
      currentEmployer: '',
      yearsOfExperience: '',
      desiredSalary: { min: '', max: '', currency: DEFAULT_CURRENCY, period: 'year' },
      workAuthorization: '',
      workAuthorizationOther: '',
      requiresSponsorship: '',
      noticePeriod: '',
      startDateAvailability: '',
    },
    voluntary: {
      raceEthnicity: '',
      genderIdentity: '',
      veteranStatus: '',
      disabilityStatus: '',
    },
    fillVoluntary: false,
    documents: [],
    qa: [],
  };
}

export function createDefaultStore(): AutoVaultStore {
  const first = createEmptyProfile('Default profile');
  return {
    schemaVersion: SCHEMA_VERSION,
    profiles: [first],
    activeProfileId: first.id,
    customDomains: [],
    settings: defaultSettings(),
  };
}
