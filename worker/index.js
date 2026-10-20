// Worker entry for secureinchat.com. Handles GET /tools/api/whoami; everything else goes to static assets.
// Returns what Cloudflare saw for this request. Nothing is stored or logged by this code.

const HEADERS_TO_REPORT = [
  'accept-language',
  'user-agent',
  'via',
  'forwarded',
  'x-forwarded-for',
  'sec-ch-ua',
  'sec-ch-ua-platform',
  'sec-ch-ua-mobile',
  'dnt',
  'sec-gpc',
];

function whoami(request) {
  const cf = request.cf || {};
  const h = request.headers;

  const headers = {};
  for (const name of HEADERS_TO_REPORT) {
    const value = h.get(name);
    if (value) headers[name] = value.slice(0, 400);
  }

  const body = {
    ip: h.get('cf-connecting-ip') || null,
    asn: cf.asn ?? null,
    asOrganization: cf.asOrganization ?? null,
    city: cf.city ?? null,
    region: cf.region ?? null,
    country: cf.country ?? null,
    timezone: cf.timezone ?? null,
    colo: cf.colo ?? null,
    httpProtocol: cf.httpProtocol ?? null,
    tlsVersion: cf.tlsVersion ?? null,
    headers,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/tools/api/whoami') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
      return whoami(request);
    }
    return env.ASSETS.fetch(request);
  },
};
