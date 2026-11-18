// Pretty URL /concert/:slug - file-based route. Real logic in api/concert.js.
import { vercelHandler } from '../_lib/vercel-shim.js';
import handler from '../../api/concert.js';
export const onRequest = vercelHandler(handler);
