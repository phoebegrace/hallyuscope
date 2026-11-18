// Cloudflare Pages Function wrapper for the Vercel handler.
// The real logic lives in api/concert.js and is unchanged; this file only
// adapts it through the Vercel-style shim.
import handler from '../../api/concert.js';
import { vercelHandler } from '../_lib/vercel-shim.js';

export const onRequest = vercelHandler(handler);
