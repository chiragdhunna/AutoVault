/**
 * Synonym dictionary. For every canonical field key we list:
 *  - autocomplete: HTML autocomplete tokens that are a near-certain match
 *  - keywords: phrases matched (word-boundary) against labels / attributes /
 *    nearby text
 *  - negative: phrases that, if present, argue AGAINST this key (disambiguates
 *    e.g. "First name" from a bare "Name", or "Company name" from full name)
 *
 * Longer keywords score higher, so specific phrases ("first name") beat generic
 * ones ("name") when both are present.
 */
import type { FieldKey } from '../lib/fields';

export interface Synonym {
  autocomplete: string[];
  keywords: string[];
  negative?: string[];
}

export const SYNONYMS: Record<FieldKey, Synonym> = {
  fullName: {
    autocomplete: ['name'],
    keywords: ['full name', 'legal name', 'your name', 'candidate name', 'name'],
    negative: ['first', 'last', 'middle', 'user name', 'username', 'company', 'employer', 'file', 'event', 'school', 'reference', 'nick'],
  },
  firstName: {
    autocomplete: ['given-name'],
    keywords: ['first name', 'given name', 'forename', 'fname', 'legal first'],
  },
  lastName: {
    autocomplete: ['family-name'],
    keywords: ['last name', 'surname', 'family name', 'lname', 'legal last'],
  },
  preferredName: {
    autocomplete: ['nickname'],
    keywords: ['preferred name', 'preferred first name', 'nickname', 'goes by', 'known as'],
  },
  pronouns: {
    autocomplete: [],
    keywords: ['pronoun', 'pronouns'],
  },
  phone: {
    autocomplete: ['tel', 'tel-national'],
    keywords: ['phone', 'mobile', 'cell', 'telephone', 'phone number', 'mobile number', 'contact number', 'tel'],
    negative: ['emergency'],
  },
  email: {
    autocomplete: ['email'],
    keywords: ['email', 'e-mail', 'email address'],
  },
  streetAddress: {
    autocomplete: ['address-line1', 'street-address'],
    keywords: ['street address', 'address line 1', 'mailing address', 'street', 'address'],
    negative: ['email', 'ip', 'web', 'url', 'line 2', 'city', 'zip', 'postal'],
  },
  addressLine2: {
    autocomplete: ['address-line2'],
    keywords: ['address line 2', 'apt', 'apartment', 'suite', 'unit'],
  },
  city: {
    autocomplete: ['address-level2'],
    keywords: ['city', 'town', 'locality'],
  },
  state: {
    autocomplete: ['address-level1'],
    keywords: ['state', 'province', 'region'],
  },
  zip: {
    autocomplete: ['postal-code'],
    keywords: ['zip', 'zip code', 'postal code', 'postcode', 'postal'],
  },
  country: {
    autocomplete: ['country-name', 'country'],
    keywords: ['country', 'nation'],
  },
  linkedin: {
    autocomplete: [],
    keywords: ['linkedin', 'linked in', 'linkedin profile', 'linkedin url'],
  },
  github: {
    autocomplete: [],
    keywords: ['github', 'git hub', 'github profile', 'github url'],
  },
  portfolio: {
    autocomplete: ['url'],
    keywords: ['portfolio', 'personal website', 'personal site', 'website', 'web site', 'homepage', 'url', 'link'],
    negative: ['linkedin', 'github', 'company', 'video'],
  },
  currentTitle: {
    autocomplete: ['organization-title'],
    keywords: ['current title', 'job title', 'current role', 'current position', 'present title', 'title', 'role', 'position'],
    negative: ['salutation', 'prefix', 'honorific', 'requisition', 'posting', 'company', 'employer'],
  },
  currentEmployer: {
    autocomplete: ['organization'],
    keywords: ['current employer', 'current company', 'present employer', 'employer', 'company name', 'organization', 'company'],
    negative: ['email', 'title', 'role'],
  },
  yearsOfExperience: {
    autocomplete: [],
    keywords: ['years of experience', 'years experience', 'total experience', 'yrs of experience', 'how many years', 'years of relevant'],
  },
  desiredSalary: {
    autocomplete: [],
    keywords: ['desired salary', 'expected salary', 'salary expectation', 'salary requirement', 'desired compensation', 'expected compensation', 'compensation', 'desired pay', 'salary'],
  },
  workAuthorization: {
    autocomplete: [],
    keywords: ['work authorization', 'authorized to work', 'legally authorized', 'right to work', 'work eligibility', 'employment authorization', 'authorized to work in'],
  },
  requiresSponsorship: {
    autocomplete: [],
    keywords: ['sponsorship', 'require sponsorship', 'need sponsorship', 'visa sponsorship', 'require visa', 'will you require', 'require immigration'],
  },
  noticePeriod: {
    autocomplete: [],
    keywords: ['notice period', 'notice', 'how much notice'],
  },
  startDate: {
    autocomplete: [],
    keywords: ['start date', 'available start', 'availability date', 'when can you start', 'earliest start', 'date available', 'availability'],
  },
  raceEthnicity: {
    autocomplete: [],
    keywords: ['race', 'ethnicity', 'race ethnicity'],
  },
  genderIdentity: {
    autocomplete: ['sex'],
    keywords: ['gender', 'gender identity', 'sex'],
  },
  veteranStatus: {
    autocomplete: [],
    keywords: ['veteran', 'protected veteran', 'military status', 'veteran status'],
  },
  disabilityStatus: {
    autocomplete: [],
    keywords: ['disability', 'disability status', 'disabled'],
  },
};
