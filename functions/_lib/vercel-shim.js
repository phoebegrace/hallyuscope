// Adapt a Vercel-style handler(req, res) to a Cloudflare Pages Function.
// The Vercel handler keeps its logic untouched; this only translates the
// request in and the response out.
//
// Usage in functions/api/<name>.js:
//   import handler from '../../api/<name>.js';
//   import { vercelHandler } from '../_lib/vercel-shim.js';
//   export const onRequest = vercelHandler(handler);
export function vercelHandler(handler) {
  return async function onRequest(context) {
    const { request, params } = context;
    const url = new URL(request.url);

    const req = {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      // Query string params first, then Pages Functions route params
      // (e.g. /album/:id lands in context.params and overrides on clash).
      query: Object.fromEntries(url.searchParams.entries()),
      body: undefined,
    };
    Object.assign(req.query, params || {});

    if (request.method === 'POST') {
      const ct = request.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        try { req.body = await request.json(); } catch { req.body = {}; }
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        try {
          req.body = Object.fromEntries(
            new URLSearchParams(await request.text()).entries()
          );
        } catch { req.body = {}; }
      }
    }

    let status = 200;
    const headers = new Headers();
    let body = null;

    const res = {
      status(code) { status = code; return this; },
      setHeader(k, v) { headers.set(k, v); return this; },
      send(data) {
        // Vercel stringifies objects passed to send(); keep that parity so
        // a handler passing an object never breaks the Response constructor.
        if (data !== null && typeof data === 'object' && !(data instanceof Uint8Array)) {
          if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json; charset=utf-8');
          body = JSON.stringify(data);
        } else {
          body = data;
        }
        return this;
      },
      json(data) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
        body = JSON.stringify(data);
        return this;
      },
      // subscribe.js finishes with res.end(string) instead of send/json.
      end(data) {
        if (data !== undefined) body = data;
        return this;
      },
    };

    await handler(req, res);

    // A handler that never calls send/json still gets a well-formed reply.
    if (body === null || body === undefined) body = '';
    return new Response(body, { status, headers });
  };
}
