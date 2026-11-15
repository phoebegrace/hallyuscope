// Cloudflare Pages replacement for the Vercel newsletter endpoint.
// Brevo credentials must be configured as Pages Secrets in context.env.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { Allow: 'POST', 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const website = String(body.website || '').trim();

    // Same honeypot behavior as the Vercel endpoint.
    if (website) return json(200, { message: 'You’re on the list.' });
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return json(400, { error: 'Please enter a valid email address.' });
    }

    const apiKey = env.BREVO_API_KEY;
    const rawListId = env.BREVO_LIST_ID;
    const listId = Number(rawListId);
    if (!apiKey || !rawListId || !Number.isInteger(listId) || listId <= 0) {
      console.error('Newsletter backend is missing BREVO_API_KEY or BREVO_LIST_ID');
      return json(503, { error: 'Newsletter signup is temporarily unavailable.' });
    }

    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ email, listIds: [listId], updateEnabled: true })
    });
    if (!response.ok) {
      console.error('Brevo signup failed, status', response.status);
      return json(502, { error: 'We could not add you right now. Please try again.' });
    }
    return json(200, { message: 'You’re on the list. Check your inbox for future HallyuScope updates.' });
  } catch (error) {
    console.error('Newsletter subscribe error', error);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
}
