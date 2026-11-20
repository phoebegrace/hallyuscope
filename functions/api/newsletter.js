// Cloudflare Pages Function wrapper for the Vercel handler in api/newsletter.js.
import handler from '../../api/newsletter.js';
import { vercelHandler } from '../_lib/vercel-shim.js';

export const onRequest = vercelHandler(handler);
