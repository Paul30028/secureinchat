// Real data-rights jurisdiction records.
//
// Only records with `verified: true` and at least one official source + quote
// may be shown as verified law. Everything else is a draft and the UI must
// label it as unverified. This file is data plus a lookup helper; the schema
// and `isUsable` gate live in ./jurisdictions.schema.js.
//
// Research date: 2026-11-08. This is general information, not legal advice.

export {
  DAY_TYPES,
  JURISDICTION_FIELDS,
  JurisdictionError,
  RIGHTS,
  assertUsable,
  isUsable,
  validateJurisdiction
} from './jurisdictions.schema.js';

const DRAFT_DEADLINE_NOTE =
  'Not yet verified against the official text (official site blocked from our network on 2026-11-08). Shown as draft only.';

const EU_GDPR = Object.freeze({
  id: 'eu-gdpr',
  name: 'European Union / EEA (GDPR)',
  law: 'Regulation (EU) 2016/679 (GDPR)',
  lawShort: 'GDPR',
  rights: Object.freeze(['access', 'rectification', 'erasure', 'object']),
  rightArticles: Object.freeze({
    access: 'Article 15',
    rectification: 'Article 16',
    erasure: 'Article 17',
    object: 'Article 21'
  }),
  deadlineArticle: 'Article 12(3)',
  recipientsArticle: 'Article 19',
  complaintArticle: 'Article 77',
  responseDays: 30,
  dayType: 'calendar',
  extendableDays: 60,
  deadlineNote:
    "GDPR Art. 12(3): without undue delay and in any event within one month of receipt; may be extended by two further months where necessary, and the controller must say so within the first month. 'One month' is a calendar month; 30 days is used here as a conservative reminder.",
  sources: Object.freeze([
    Object.freeze({
      url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679',
      checked: '2026-11-08',
      quote:
        'within one month of receipt of the request. That period may be extended by two further months where necessary'
    }),
    Object.freeze({
      url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679',
      checked: '2026-11-08',
      quote:
        'Article 15 Right of access ... Article 16 Right to rectification ... Article 17 Right to erasure ... Article 19 Notification obligation ... Article 21 Right to object ... Article 77 Right to lodge a complaint'
    })
  ]),
  regulator: Object.freeze({
    name: 'Your national data protection authority (EDPB list)',
    complaintUrl: 'https://www.edpb.europa.eu/about-edpb/about-edpb/members_en'
  }),
  appliesWhen:
    'The company is in the EU/EEA, or offers goods or services to, or monitors, people in the EU/EEA (GDPR Art. 3).',
  verificationNote:
    'The company may ask for information needed to confirm it is you (Art. 12(6)); give only what identifies you.',
  verified: true
});

const UK_GDPR = Object.freeze({
  id: 'uk-gdpr',
  name: 'United Kingdom (UK GDPR / DPA 2018)',
  law: 'UK General Data Protection Regulation (UK GDPR) and Data Protection Act 2018',
  rights: Object.freeze(['access', 'rectification', 'erasure', 'object']),
  responseDays: 30,
  dayType: 'calendar',
  extendableDays: 60,
  deadlineNote: DRAFT_DEADLINE_NOTE,
  sources: Object.freeze([]),
  regulator: Object.freeze({
    name: "Information Commissioner's Office (ICO)",
    complaintUrl: 'https://ico.org.uk/for-the-public/how-to-make-a-data-protection-complaint/'
  }),
  appliesWhen:
    'The company is established in the UK, or offers goods or services to, or monitors, people in the UK.',
  verificationNote:
    'Draft only. The ICO generally expects you to raise the issue with the organisation first; check the current ICO guidance before relying on it.',
  verified: false
});

const US_CA = Object.freeze({
  id: 'us-ca',
  name: 'California, USA (CCPA/CPRA)',
  law: 'California Consumer Privacy Act, as amended by the California Privacy Rights Act (CCPA/CPRA)',
  rights: Object.freeze(['access', 'erasure', 'rectification', 'optout-sale']),
  responseDays: 45,
  dayType: 'calendar',
  extendableDays: 45,
  deadlineNote: DRAFT_DEADLINE_NOTE,
  sources: Object.freeze([]),
  regulator: Object.freeze({
    name: 'California Privacy Protection Agency (CPPA)',
    complaintUrl: 'https://www.cppa.ca.gov/faq.html'
  }),
  appliesWhen:
    'A business that does business in California, meets the statutory thresholds and processes California residents\' personal information. Check the current thresholds and exemptions.',
  verificationNote:
    'Draft only. Businesses must verify requests; do not send more identity information than is reasonably necessary.',
  verified: false
});

const US_CO = Object.freeze({
  id: 'us-co',
  name: 'Colorado, USA (CPA)',
  law: 'Colorado Privacy Act (CPA)',
  rights: Object.freeze(['access', 'erasure', 'rectification', 'optout-sale', 'object']),
  responseDays: 45,
  dayType: 'calendar',
  extendableDays: 45,
  deadlineNote: DRAFT_DEADLINE_NOTE,
  sources: Object.freeze([]),
  regulator: Object.freeze({
    name: 'Colorado Attorney General',
    complaintUrl: 'https://coag.gov/resources/colorado-privacy-act/'
  }),
  appliesWhen:
    'A controller that does business in Colorado, meets the statutory processing thresholds and processes Colorado residents\' personal data.',
  verificationNote:
    'Draft only. Identity verification should be proportionate to the sensitivity of the data.',
  verified: false
});

const US_CT = Object.freeze({
  id: 'us-ct',
  name: 'Connecticut, USA (CTDPA)',
  law: 'Connecticut Data Privacy Act (CTDPA)',
  rights: Object.freeze(['access', 'erasure', 'rectification', 'optout-sale']),
  responseDays: 45,
  dayType: 'calendar',
  extendableDays: 45,
  deadlineNote: DRAFT_DEADLINE_NOTE,
  sources: Object.freeze([]),
  regulator: Object.freeze({
    name: 'Connecticut Attorney General',
    complaintUrl: 'https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act'
  }),
  appliesWhen:
    'A controller that does business in Connecticut, meets the statutory thresholds and processes Connecticut residents\' personal data.',
  verificationNote:
    'Draft only. Use the controller\'s secure request channel; identity verification must be reasonable.',
  verified: false
});

const US_VA = Object.freeze({
  id: 'us-va',
  name: 'Virginia, USA (VCDPA)',
  law: 'Virginia Consumer Data Protection Act (VCDPA)',
  rights: Object.freeze(['access', 'erasure', 'rectification', 'optout-sale']),
  responseDays: 45,
  dayType: 'calendar',
  extendableDays: 45,
  deadlineNote: DRAFT_DEADLINE_NOTE,
  sources: Object.freeze([]),
  regulator: Object.freeze({
    name: 'Virginia Attorney General',
    complaintUrl: 'https://www.oag.state.va.us/'
  }),
  appliesWhen:
    'A controller that does business in Virginia, meets the statutory thresholds and processes Virginia residents\' personal data.',
  verificationNote:
    'Draft only. The official complaint entry point was not verified on 2026-11-08; check the Attorney General site before filing.',
  verified: false
});

export const JURISDICTIONS = Object.freeze([
  EU_GDPR,
  UK_GDPR,
  US_CA,
  US_CO,
  US_CT,
  US_VA
]);

export function getJurisdiction(id, list = JURISDICTIONS) {
  if (!Array.isArray(list)) {
    return null;
  }
  return list.find((entry) => entry && entry.id === id) || null;
}
