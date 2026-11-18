import sitemapHandler from '../api/sitemap.js';
import { runReadOnlyHandler } from './_lib/legacy-response.js';

export function onRequest(context) {
  return runReadOnlyHandler(sitemapHandler, context);
}
