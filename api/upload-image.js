// Upload an image from the review dashboard and store it in the repo.
// Same auth as api/review.js: the review password header + GITHUB_REVIEW_TOKEN.
// Files land on the live-data branch under assets/editorial/ (the folder the
// hourly workflow preserves), and the returned raw.githubusercontent URL is
// what the editor writes into the draft's imageUrl / socialImageUrl.
const OWNER = 'phoebegrace';
const REPO = 'hallyuscope';
const API = 'https://api.github.com';
const BRANCH = 'live-data';
const ALLOWED = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
const MAX_BYTES = 3 * 1024 * 1024;

function reply(res, status, data) {
  res.status(status).json(data);
}

function authorized(req) {
  const expected = process.env.REVIEW_PASSWORD || '';
  const supplied = req.headers['x-review-password'] || '';
  return expected && supplied && supplied === expected;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, {error:'Method not allowed'});
  if (!authorized(req)) return reply(res, 401, {error:'Incorrect review password'});
  const token = process.env.GITHUB_REVIEW_TOKEN;
  if (!token) return reply(res, 503, {error:'Review dashboard is not connected to GitHub yet'});

  try {
    const {id='', kind='article', mime='', data=''} = req.body || {};
    const ext = ALLOWED[mime];
    if (!ext) return reply(res, 400, {error:'Only JPG, PNG, WebP or GIF images can be uploaded'});
    const buf = Buffer.from(data, 'base64');
    if (!buf.length || buf.length > MAX_BYTES) return reply(res, 400, {error:'Image must be under 3 MB'});
    const safeId = String(id).replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'upload';
    const safeKind = kind === 'social' ? 'social' : 'article';
    const path = 'assets/editorial/' + safeId + '-' + safeKind + '-' + Date.now().toString(36) + '.' + ext;

    const r = await fetch(API + '/repos/' + OWNER + '/' + REPO + '/contents/' + path, {
      method:'PUT',
      headers:{
        'Accept':'application/vnd.github+json',
        'Authorization':'Bearer ' + token,
        'X-GitHub-Api-Version':'2022-11-28',
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        message:'editorial: upload ' + safeKind + ' image for ' + safeId,
        content:buf.toString('base64'),
        branch:BRANCH
      })
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error('GitHub ' + r.status + ': ' + text.slice(0, 200));
    }
    return reply(res, 200, {imageUrl:'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/' + path});
  } catch (error) {
    return reply(res, 500, {error:error.message || 'Upload failed'});
  }
}
