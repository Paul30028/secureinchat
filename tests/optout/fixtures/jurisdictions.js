// Fictional jurisdiction fixtures for engine tests only.
// These are NOT legal information and must never ship to users.

export const TEST_JURISDICTIONS = Object.freeze([
  Object.freeze({
    id: 'TEST-A',
    name: 'Testland A (fictional)',
    law: 'TEST-A Data Protection Act (fictional test data)',
    rights: Object.freeze(['erasure', 'access', 'rectification']),
    responseDays: 30,
    extendableDays: 30,
    dayType: 'calendar',
    verificationNote: 'Fictional fixture for engine tests. Not legal information.',
    regulator: Object.freeze({
      name: 'Testland A Privacy Authority (fictional)',
      complaintUrl: 'https://example.test/test-a/complaint'
    }),
    appliesWhen: 'Fictional test only. Never show as real law.',
    sources: Object.freeze([
      Object.freeze({
        url: 'https://example.test/test-a/law',
        checked: '2026-11-08',
        quote: 'Fictional fixture text.'
      })
    ]),
    verified: false
  }),
  Object.freeze({
    id: 'TEST-B',
    name: 'Testland B (fictional)',
    law: 'TEST-B Consumer Privacy Act (fictional test data)',
    rights: Object.freeze(['optout-sale', 'object', 'rectification']),
    responseDays: 10,
    extendableDays: 0,
    dayType: 'business',
    verificationNote: 'Fictional fixture for engine tests. Not legal information.',
    regulator: Object.freeze({
      name: 'Testland B Consumer Agency (fictional)',
      complaintUrl: 'https://example.test/test-b/complaint'
    }),
    appliesWhen: 'Fictional test only. Never show as real law.',
    sources: Object.freeze([
      Object.freeze({
        url: 'https://example.test/test-b/law',
        checked: '2026-11-08',
        quote: 'Fictional fixture text.'
      })
    ]),
    verified: false
  })
]);
