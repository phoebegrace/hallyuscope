// Handle legacy /album?id= links directly; static rewrites cannot dispatch Functions.
import handler from '../api/album.js';
import { vercelHandler } from './_lib/vercel-shim.js';
export const onRequest = vercelHandler(handler);
