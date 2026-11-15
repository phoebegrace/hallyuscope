// Bridge the existing read-only Vercel handlers to Cloudflare Pages Functions.
// Keep mutation/API handlers separate: this adapter intentionally accepts GET only.
export async function runReadOnlyHandler(handler, context, params = {}) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const url = new URL(context.request.url);
  const query = Object.fromEntries(url.searchParams);
  Object.assign(query, params);
  const headers = new Headers();
  let status = 200;
  let body = '';
  const res = {
    setHeader(name, value) { headers.set(name, String(value)); return res; },
    status(code) { status = code; return res; },
    send(value) { body = value ?? ''; return res; },
    json(value) { headers.set('Content-Type', 'application/json; charset=utf-8'); body = JSON.stringify(value); return res; }
  };
  try {
    await handler({ method: context.request.method, query, headers: Object.fromEntries(context.request.headers) }, res);
    return new Response(context.request.method === 'HEAD' ? null : body, { status, headers });
  } catch (err) {
    console.error('HallyuScope function error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
