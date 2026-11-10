import { createHash } from 'node:crypto';

const OWNER='phoebegrace';
const REPO='hallyuscope';
const PATH='data/article-drafts.json';
const BRANCH='live-data';
const GITHUB='https://api.github.com';
const OPENAI='https://api.openai.com/v1/responses';
const MODEL=process.env.AI_CENTER_MODEL||process.env.OPENAI_DRAFT_MODEL||'gpt-6.1-terra';

function reply(res,status,data){res.status(status).json(data);}
function authorized(req){
  const expected=process.env.REVIEW_PASSWORD||'';
  const supplied=req.headers['x-review-password']||'';
  return expected&&supplied&&supplied===expected;
}
async function github(path,options={}){
  const token=process.env.GITHUB_REVIEW_TOKEN;
  if(!token) throw new Error('GITHUB_REVIEW_TOKEN is not configured');
  const r=await fetch(GITHUB+path,{
    ...options,
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  });
  if(!r.ok) throw new Error('GitHub '+r.status+': '+(await r.text()).slice(0,220));
  return r.json();
}
function responseText(payload){
  for(const item of payload.output||[]){
    for(const part of item.content||[]){
      if(part.type==='output_text'&&part.text) return part.text;
    }
  }
  return '';
}
function citations(payload){
  const found=[];
  const seen=new Set();
  for(const item of payload.output||[]){
    for(const part of item.content||[]){
      for(const a of part.annotations||[]){
        const url=a.url||a.url_citation?.url||'';
        const title=a.title||a.url_citation?.title||'';
        if(url&&!seen.has(url)){
          seen.add(url);
          found.push({publisher:'',title,url,kind:'publisher'});
        }
      }
    }
  }
  return found;
}
function parseJson(text){
  const trimmed=String(text||'').trim();
  const fenced=trimmed.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i);
  return JSON.parse(fenced?fenced[1]:trimmed);
}
function cleanUrl(value=''){
  try{
    const u=new URL(value);
    return /^https?:$/.test(u.protocol)?u.href:'';
  }catch{return '';}
}
function publisherFromUrl(value=''){
  try{
    const host=new URL(value).hostname.replace(/^www\./,'');
    if(/billboard\.com$/i.test(host)) return 'Billboard';
    if(/billboardphilippines\.com$/i.test(host)) return 'Billboard Philippines';
    if(/soompi\.com$/i.test(host)) return 'Soompi';
    if(/koreaherald\.com$/i.test(host)) return 'The Korea Herald';
    if(/koreatimes\.co\.kr$/i.test(host)||/koreatimes\.com$/i.test(host)) return 'The Korea Times';
    if(/koreajoongangdaily\.joins\.com$/i.test(host)) return 'Korea JoongAng Daily';
    return host.split('.')[0].replace(/[-_]/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
  }catch{return 'Source';}
}
function slugify(value=''){
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
}
function normalizeSources(modelSources=[],annotationSources=[]){
  const all=[...(Array.isArray(modelSources)?modelSources:[]),...annotationSources];
  const seen=new Set();
  return all.map(s=>{
    const url=cleanUrl(s.url||'');
    if(!url||seen.has(url)) return null;
    seen.add(url);
    return {
      publisher:String(s.publisher||publisherFromUrl(url)).trim(),
      title:String(s.title||'').trim(),
      url,
      kind:s.kind==='official'?'official':'publisher'
    };
  }).filter(Boolean).slice(0,8);
}
async function research(seed,notes){
  if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const prompt=`You are the research editor for HallyuScope, an independent K-pop and Korean entertainment publication.

The editor saw this story:
${seed}

Optional editorial notes:
${notes||'[none]'}

Use web search to research this exact story before drafting. Find corroborating coverage and prioritize, in this order:
1. official artist/agency/promoter/venue/ticketing/TV/network announcements;
2. established original reporting such as Billboard, Billboard Philippines, The Korea Herald, Korea JoongAng Daily, major Korean outlets, or equivalent;
3. secondary entertainment publishers only when needed.

Do not treat Google News, search result pages, repost aggregators, or social fan accounts as the publisher. If the underlying article is Billboard, identify Billboard as the source. Do not default to Soompi.

Cross-check names, dates, venues, release details, chart positions, ticket information and other factual claims. Do not invent missing information. If a detail is not verified, omit it rather than writing meta-commentary like "the report does not specify" or "details were not included."

Write an original HallyuScope article, not a rewrite of one source. Aim for 300-550 words when the research supports it. A short story may be 180-300 words, but it must still feel complete and useful.

Return ONLY valid JSON with exactly this shape:
{
  "researchSummary": "2-4 sentence summary of what the research established",
  "facts": ["verified fact 1", "verified fact 2"],
  "sources": [
    {"publisher":"actual publisher name","title":"source title","url":"https://...","kind":"official or publisher"}
  ],
  "draft": {
    "category":"HALLYU NEWS, K-DRAMA NEWS, COMEBACK NEWS, CONCERT NEWS, or TRENDING",
    "headline":"original HallyuScope headline",
    "dek":"one-sentence summary",
    "body":["paragraph 1","paragraph 2","paragraph 3"],
    "seoDescription":"140-160 character SEO description",
    "socialCaption":"short human social caption; no hashtags",
    "socialHashtags":["maximum 5 relevant hashtags including #HallyuScope"]
  }
}`;

  const r=await fetch(OPENAI,{
    method:'POST',
    headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:MODEL,
      reasoning:{effort:'low'},
      tools:[{type:'web_search'}],
      max_output_tokens:3000,
      input:prompt
    })
  });
  const payload=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(payload.error?.message||('OpenAI '+r.status));
  const data=parseJson(responseText(payload));
  const sources=normalizeSources(data.sources,citations(payload));
  const hasOfficial=sources.some(s=>s.kind==='official');
  if(sources.length<2&&!hasOfficial) throw new Error('AI could not verify this story with enough usable sources yet. Try adding the original URL or more context.');
  const draft=data.draft||{};
  draft.socialHashtags=(Array.isArray(draft.socialHashtags)?draft.socialHashtags:[])
    .map(x=>String(x).trim()).filter(x=>/^#[\p{L}\p{N}_]+$/u.test(x)).slice(0,5);
  if(!draft.socialHashtags.includes('#HallyuScope')) draft.socialHashtags=['#HallyuScope',...draft.socialHashtags].slice(0,5);
  return {
    researchSummary:String(data.researchSummary||'').trim(),
    facts:(Array.isArray(data.facts)?data.facts:[]).map(x=>String(x).trim()).filter(Boolean).slice(0,12),
    sources,
    draft
  };
}
async function saveDraft(payload){
  const file=await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH+'?ref='+BRANCH);
  const json=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  const sources=normalizeSources(payload.sources||[],[]);
  const draft=payload.draft||{};
  if(!draft.headline||!Array.isArray(draft.body)||!draft.body.length) throw new Error('Headline and article body are required');
  const id=createHash('sha1').update('ai-center|'+draft.headline+'|'+Date.now()).digest('hex').slice(0,12);
  const now=new Date().toISOString();
  const primary=sources[0]||{publisher:'AI research',title:String(payload.seed||''),url:''};
  const item={
    id,
    createdAt:now,
    status:'pending_review',
    publishedAt:null,
    sourcePublishedAt:null,
    model:MODEL,
    qualityVersion:'ai-center-1',
    slug:slugify(draft.headline),
    source:{publisher:primary.publisher,title:primary.title,url:primary.url},
    aiResearch:{
      seed:String(payload.seed||'').trim(),
      notes:String(payload.notes||'').trim(),
      researchSummary:String(payload.researchSummary||'').trim(),
      facts:(payload.facts||[]).map(x=>String(x).trim()).filter(Boolean),
      sources
    },
    imageUrl:'',
    imageType:'hallyuscope_original',
    sourceImageUrl:null,
    imagePolicy:{type:'hallyuscope_original',note:'Add or generate a HallyuScope editorial image during review.'},
    category:String(draft.category||'HALLYU NEWS').trim(),
    headline:String(draft.headline).trim(),
    dek:String(draft.dek||'').trim(),
    body:draft.body.map(x=>String(x).trim()).filter(Boolean),
    seoDescription:String(draft.seoDescription||'').trim(),
    socialCaption:String(draft.socialCaption||'').trim(),
    socialHashtags:(draft.socialHashtags||[]).map(x=>String(x).trim()).filter(x=>/^#[\p{L}\p{N}_]+$/u.test(x)).slice(0,5),
    sourceNote:sources.length?'Sources: '+sources.map(s=>s.publisher).filter((x,i,a)=>a.indexOf(x)===i).join(', '):'AI-assisted research'
  };
  const items=[item,...(json.items||[])];
  await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH,{
    method:'PUT',
    body:JSON.stringify({
      message:'editorial: add AI Center draft '+id,
      content:Buffer.from(JSON.stringify({...json,updatedAt:now,items},null,2)+'\n').toString('base64'),
      sha:file.sha,
      branch:BRANCH
    })
  });
  return {id,status:'pending_review'};
}
export default async function handler(req,res){
  if(req.method!=='POST') return reply(res,405,{error:'Method not allowed'});
  if(!authorized(req)) return reply(res,401,{error:'Incorrect review password'});
  try{
    const {action='ping'}=req.body||{};
    if(action==='ping') return reply(res,200,{ok:true});
    if(action==='research'){
      const seed=String(req.body?.seed||'').trim();
      if(seed.length<5) return reply(res,400,{error:'Paste a news URL or headline first'});
      return reply(res,200,await research(seed,String(req.body?.notes||'').trim()));
    }
    if(action==='save') return reply(res,200,await saveDraft(req.body||{}));
    return reply(res,400,{error:'Invalid action'});
  }catch(error){
    return reply(res,500,{error:error.message||'AI Center failed'});
  }
}
