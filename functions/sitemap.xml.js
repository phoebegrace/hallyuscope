// /sitemap.xml - file-based route (the _redirects rewrite to /api/sitemap
// is kept as a fallback). Real logic in api/sitemap.js.
import { vercelHandler } from './_lib/vercel-shim.js';
import handler from '../api/sitemap.js';
export const onRequest = vercelHandler(handler);
