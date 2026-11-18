import articleHandler from '../../api/article.js';
import { runReadOnlyHandler } from '../_lib/legacy-response.js';

export function onRequest(context) {
  return runReadOnlyHandler(articleHandler, context, {
    slug: context.params.slug,
  });
}
