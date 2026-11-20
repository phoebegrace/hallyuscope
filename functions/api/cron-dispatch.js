// Cloudflare Pages Function wrapper for the Vercel handler in api/cron-dispatch.js.
import handler from '../../api/cron-dispatch.js';
import { vercelHandler } from '../_lib/vercel-shim.js';

export const onRequest = vercelHandler(handler);
