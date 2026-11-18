// Cloudflare Pages Function port of api/social-card-url.js.
//
// Signs a social-card URL so the review dashboard can generate a card
// for an article. Behaviour is identical to the Vercel version: same
// POST-only endpoint, same x-review-password auth, same validations,
// same response shape. The signed URL it returns still points at
// https://hallyuscope.com/api/social-card with the same params, which
// Pages Functions now serves from functions/api/social-card.js, so no
// caller needs to change. HMAC-SHA256 uses the Web Crypto API, native
// to Workers (no nodejs_compat needed, no dependency).

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const expected = env.REVIEW_PASSWORD || '';
  const supplied = request.headers.get('x-review-password') || '';
  if (!expected || !supplied || supplied !== expected) {
    return json(401, { error: 'Incorrect review password' });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  let { image = '', category = 'K-POP', headline = '', description = '' } = body || {};
  if (!headline) return json(400, { error: 'Headline is required' });
  if (!image) return json(400, { error: 'Feature image is required' });

  const origin = 'https://hallyuscope.com';
  if (String(image).includes('/api/social-card')) {
    return json(400, { error: 'Generated social-card URLs cannot be used as source images' });
  }
  if (String(image).startsWith('/')) image = origin + image;

  const ts = Date.now().toString();
  const params = new URLSearchParams({ image, category, headline, description, ts });
  const sig = await hmacHex(env.REVIEW_PASSWORD, params.toString());
  params.set('sig', sig);
  return json(200, {
    imageUrl: origin + '/api/social-card?' + params.toString(),
    previewUrl: origin + '/social-card.html?' + new URLSearchParams({ image, category, headline, description }).toString(),
  });
}
