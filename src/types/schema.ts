/**
 * AutoVault data model.
 *
 * Everything a user might be asked for on a job application, expressed as typed
 * interfaces. The store (see AutoVaultStore) is what gets persisted to
 * chrome.storage.local; uploaded document bytes live separately in IndexedDB.
 */

export type UUID = string;

/** Bump when the persisted shape changes; drives migrations in storage.ts. */
export const SCHEMA_VERSION = 1;

export const DEFAULT_CURRENCY = 'USD';

/* ------------------------------------------------------------------ */
/* Personal                                                            */
/* ------------------------------------------------------------------ */

export interface PersonalInfo {
  fullName: string;
  preferredName: string;
  /** Optional. Left blank by default and never inferred. */
  pronouns: string;
}

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

export interface ContactInfo {
  phone: string;
  email: string;
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

export interface SocialLink {
  id: UUID;
  /** e.g. "Twitter/X", "Personal blog", "Dribbble" */
  label: string;
  url: string;
}

export interface LinksInfo {
  linkedin: string;
  github: string;
  portfolio: string;
  other: SocialLink[];
}

/* ------------------------------------------------------------------ */
/* Work                                                                */
/* ------------------------------------------------------------------ */

export type WorkAuthStatus =
  | '' // unspecified
  | 'us_citizen'
  | 'permanent_resident'
  | 'visa_authorized' // authorized to work on a visa (e.g. H-1B, TN, OPT)
  | 'need_sponsorship'
  | 'other';

export type YesNoUnspecified = '' | 'yes' | 'no';

export type SalaryPeriod = 'year' | 'month' | 'hour';

export interface SalaryExpectation {
  min: string; // strings so users can leave blank or enter ranges/notes
  max: string;
  currency: string; // ISO 4217
  period: SalaryPeriod;
}

export interface WorkInfo {
  currentTitle: string;
  currentEmployer: string;
  /** String to allow "5", "5+", "3-5", etc. */
  yearsOfExperience: string;
  desiredSalary: SalaryExpectation;
  workAuthorization: WorkAuthStatus;
  /** free text shown when workAuthorization === 'other' */
  workAuthorizationOther: string;
  requiresSponsorship: YesNoUnspecified;
  /** e.g. "2 weeks", "1 month", "Immediate" */
  noticePeriod: string;
  /** ISO date (yyyy-mm-dd) or free text like "Immediately" */
  startDateAvailability: string;
}

/* ------------------------------------------------------------------ */
/* EEO / Voluntary self-identification                                 */
/*                                                                     */
/* Deliberately isolated from the rest of the profile. Every field is  */
/* optional, defaults to unspecified, and is only ever autofilled when */
/* the profile's `fillVoluntary` flag is explicitly turned on.         */
/* ------------------------------------------------------------------ */

export type GenderIdentity = '' | 'male' | 'female' | 'nonbinary' | 'decline';

export type VeteranStatus =
  | ''
  | 'not_veteran'
  | 'veteran'
  | 'protected_veteran'
  | 'decline';

export type DisabilityStatus = '' | 'yes' | 'no' | 'decline';

export interface VoluntaryDisclosure {
  /** Free text so it can be matched against varied ATS race/ethnicity options. */
  raceEthnicity: string;
  genderIdentity: GenderIdentity;
  veteranStatus: VeteranStatus;
  disabilityStatus: DisabilityStatus;
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export type DocumentKind = 'resume' | 'coverLetter';

/**
 * Metadata for an uploaded document. The bytes live in IndexedDB (see
 * src/lib/db.ts) keyed by `blobKey` — never in chrome.storage, whose ~5MB
 * quota and JSON serialization make it unsuitable for files.
 */
export interface DocumentMeta {
  id: UUID;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  size: number; // bytes
  addedAt: number; // epoch ms
  blobKey: string; // IndexedDB object key
}

/* ------------------------------------------------------------------ */
/* Custom recurring Q&A                                                */
/* ------------------------------------------------------------------ */

export interface QAPair {
  id: UUID;
  question: string;
  answer: string;
  /** optional tags for future filtering, e.g. ["salary", "why-us"] */
  tags: string[];
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export interface JobProfile {
  id: UUID;
  /** Human label, e.g. "Frontend roles", "PM roles". */
  name: string;
  createdAt: number;
  updatedAt: number;

  personal: PersonalInfo;
  contact: ContactInfo;
  links: LinksInfo;
  work: WorkInfo;

  voluntary: VoluntaryDisclosure;
  /** opt-in: only when true does the engine fill EEO/voluntary fields */
  fillVoluntary: boolean;

  documents: DocumentMeta[];
  qa: QAPair[];
}

/* ------------------------------------------------------------------ */
/* Custom domains + settings + top-level store                         */
/* ------------------------------------------------------------------ */

export interface CustomDomain {
  id: UUID;
  /** match pattern, e.g. "*://careers.acme.com/*" */
  pattern: string;
  /** display host, e.g. "careers.acme.com" */
  host: string;
  addedAt: number;
}

export interface EncryptedBlob {
  iv: string; // base64 IV
  data: string; // base64 ciphertext
}

export interface EncryptionMeta {
  enabled: boolean;
  /** base64 PBKDF2 salt; present when enabled */
  salt?: string;
  /** PBKDF2 iteration count */
  iterations?: number;
  /** known-plaintext check used to validate an entered passphrase */
  verifier?: EncryptedBlob;
}

export interface AppSettings {
  /** briefly outline filled fields in green after autofill */
  highlightFilled: boolean;
  /** show the "Attach your resume here" hint on file inputs */
  showFileHints: boolean;
  /** auto-run fill when landing on a recognized ATS application page */
  autofillOnLoad: boolean;
  encryption: EncryptionMeta;
}

/** The complete object persisted to chrome.storage.local under STORE_KEY. */
export interface AutoVaultStore {
  schemaVersion: number;
  profiles: JobProfile[];
  activeProfileId: UUID | null;
  customDomains: CustomDomain[];
  settings: AppSettings;
}
