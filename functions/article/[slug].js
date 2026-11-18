// Pretty URL /article/:slug - file-based route. Real logic in api/article.js.
import { vercelHandler } from '../_lib/vercel-shim.js';
import handler from '../../api/article.js';
export const onRequest = vercelHandler(handler);
