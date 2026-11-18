// Pretty URL /album/:slug - file-based route (deterministic; does not rely
// on the _redirects rewrite reaching the Functions router, which local
// wrangler dev does not do). The real logic lives in api/album.js; this is
// only a thin adapter, same as functions/api/album.js.
import { vercelHandler } from '../_lib/vercel-shim.js';
import handler from '../../api/album.js';
export const onRequest = vercelHandler(handler);
