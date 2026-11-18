// Cloudflare Pages Function wrapper for the Vercel handler.
// The real logic lives in api/album.js and is unchanged; this file only
// adapts it through the Vercel-style shim.
import handler from '../../api/album.js';
import { vercelHandler } from '../_lib/vercel-shim.js';

export const onRequest = vercelHandler(handler);
