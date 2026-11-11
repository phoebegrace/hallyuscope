const OWNER='phoebegrace';
const REPO='hallyuscope';
const PATH='data/article-drafts.json';
const GITHUB='https://api.github.com';
const BRANCH='live-data';
const GRAPH_VERSION=process.env.META_GRAPH_VERSION||'v26.0';
const GRAPH='https://graph.facebook.com/'+GRAPH_VERSION;

function reply(res,status,data){res.status(status).json(data);}
function authorized(req){
  const expected=process.env.REVIEW_PASSWORD||'';
  const supplied=req.headers['x-review-password']||'';
  return expected&&supplied&&supplied===expected;
}
async function graph(path,params){
  const body=new URLSearchParams(params);
  const r=await fetch(GRAPH+path,{method:'POST',body});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.error) throw new Error(data.error?.message||('Meta request failed ('+r.status+')'));
  return data;
}
async function graphGet(path,params){
  const qs=new URLSearchParams(params);
  const r=await fetch(GRAPH+path+'?'+qs.toString());
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.error) throw new Error(data.error?.message||('Meta request failed ('+r.status+')'));
  return data;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForInstagramContainer(containerId,token){
  for(let i=0;i<12;i++){
    const status=await graphGet('/'+encodeURIComponent(containerId),{
      fields:'status_code,status',
      access_token:token
    });
    if(status.status_code==='FINISHED') return status;
    if(status.status_code==='ERROR'||status.status_code==='EXPIRED'){
      throw new Error(status.status||('Instagram media container '+status.status_code.toLowerCase()));
    }
    await sleep(1000);
  }
  throw new Error('Instagram media is still processing. Please retry in a moment.');
}
async function github(path,options={}){
  const token=process.env.GITHUB_REVIEW_TOKEN;
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
  if(!r.ok) throw new Error('GitHub '+r.status+': '+(await r.text()).slice(0,180));
  return r.json();
}
// ---------- posting limits (protects the Page from Meta's anti-spam blocks) ----------
// New Pages that post in fast bursts get flagged ("API access blocked").
const MIN_GAP_MIN=30;        // at least 30 minutes between successful posts
const MAX_PER_DAY=6;         // at most 6 successful posts in any rolling 24 hours
const FAIL_COOLDOWN_MIN=10;  // after Meta rejects a post, wait before trying again
const MIN=60*1000;
const manilaDay=t=>new Date(t).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'});
const manila=t=>{
  const time=new Date(t).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'});
  return manilaDay(t)===manilaDay(Date.now())?time:(manilaDay(t)===manilaDay(Date.now()+864e5)?'tomorrow at '+time:new Date(t).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'})+' at '+time);
};
const when=t=>{ const m=manila(t); return /^\d/.test(m)?'at '+m:m;
};
const span=m=>m<60?m+' min':Math.floor(m/60)+' hr'+(m%60?' '+(m%60)+' min':'');

async function readDrafts(){
  const file=await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH+'?ref='+BRANCH);
  const json=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  return {file,json};
}
function postingLimit(items,now=Date.now()){
  const pubs=items.filter(x=>x.socialStatus==='published'&&x.socialPublishedAt)
    .map(x=>Date.parse(x.socialPublishedAt)).filter(Number.isFinite).sort((a,b)=>a-b);
  const lastPub=pubs.length?pubs[pubs.length-1]:0;
  const lastFail=items.filter(x=>x.socialStatus==='failed'&&x.socialLastAttemptAt)
    .map(x=>Date.parse(x.socialLastAttemptAt)).filter(Number.isFinite).sort((a,b)=>b-a)[0]||0;
  const today=pubs.filter(t=>now-t<24*60*MIN);
  const waits=[];
  if(lastPub&&now-lastPub<MIN_GAP_MIN*MIN) waits.push({until:lastPub+MIN_GAP_MIN*MIN,why:'Posts need '+MIN_GAP_MIN+' minutes between them (last post '+manila(lastPub)+')'});
  if(today.length>=MAX_PER_DAY) waits.push({until:today[today.length-MAX_PER_DAY]+24*60*MIN,why:'Daily limit reached ('+MAX_PER_DAY+' posts in 24 hours)'});
  if(lastFail&&lastFail>lastPub&&now-lastFail<FAIL_COOLDOWN_MIN*MIN) waits.push({until:lastFail+FAIL_COOLDOWN_MIN*MIN,why:'Meta rejected the last attempt, so retries are paused for '+FAIL_COOLDOWN_MIN+' minutes'});
  if(!waits.length){
    const next=Math.max(now+MIN_GAP_MIN*MIN, today.length+1>=MAX_PER_DAY?today[today.length+1-MAX_PER_DAY]+24*60*MIN:0);
    return {ok:true,postsToday:today.length,nextAfterPost:next};
  }
  const w=waits.sort((a,b)=>b.until-a.until)[0];
  return {ok:false,until:w.until,minutes:Math.max(1,Math.ceil((w.until-now)/MIN)),why:w.why,postsToday:today.length};
}
async function recordResult(id,result){
  if(!process.env.GITHUB_REVIEW_TOKEN) return;
  const {file,json}=await readDrafts();
  const items=json.items||[];
  const index=items.findIndex(x=>x.id===id);
  if(index<0) return;
  items[index]={
    ...items[index],
    socialStatus:result.ok?'published':'failed',
    socialPublishedAt:result.ok?new Date().toISOString():items[index].socialPublishedAt||null,
    socialLastAttemptAt:new Date().toISOString(),
    socialPublishResult:result
  };
  await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH,{
    method:'PUT',
    body:JSON.stringify({
      message:'social: record Meta publish '+id,
      content:Buffer.from(JSON.stringify({...json,updatedAt:new Date().toISOString(),items},null,2)+'\n').toString('base64'),
      sha:file.sha,
      branch:BRANCH
    })
  });
}
export default async function handler(req,res){
  if(req.method!=='POST') return reply(res,405,{error:'Method not allowed'});
  if(!authorized(req)) return reply(res,401,{error:'Incorrect review password'});

  const token=process.env.META_PAGE_ACCESS_TOKEN;
  const pageId=process.env.META_PAGE_ID;
  const igId=process.env.META_IG_USER_ID;
  if(!token||!pageId||!igId) return reply(res,503,{error:'Meta connection is not configured yet.'});

  const {id,slug='',caption='',hashtags='',imageUrl='',facebook=true,instagram=true}=req.body||{};
  if(!id) return reply(res,400,{error:'Missing article id'});
  if(!facebook&&!instagram) return reply(res,400,{error:'Choose at least one Meta account'});
  if(instagram&&!imageUrl) return reply(res,400,{error:'Instagram requires a public image URL'});

  // Canonical article URLs use words from the headline: /article/<slug>.
  const articleUrl=slug
    ? 'https://hallyuscope.com/article/'+encodeURIComponent(slug)
    : 'https://hallyuscope.com/article?id='+encodeURIComponent(id);
  const tags=String(hashtags||'')
    .split(/\s+/)
    .map(x=>x.trim())
    .filter(x=>/^#[\p{L}\p{N}_]+$/u.test(x));
  // Exactly five hashtags, from the review editor's hashtags form.
  const fbTags=tags.slice(0,5).join(' ');
  const igTags=tags.slice(0,5).join(' ');
  // Enforce posting limits before calling Meta. Fail closed if the history can't be read.
  if(!process.env.GITHUB_REVIEW_TOKEN) return reply(res,503,{error:'Posting history is unavailable, so posting is paused to protect the Page.'});
  let limit;
  try{
    const {json}=await readDrafts();
    const items=json.items||[];
    const prev=items.find(x=>x.id===id)?.socialPublishResult;
    const dupFb=facebook&&prev?.facebook?.id, dupIg=instagram&&prev?.instagram?.id;
    if((!facebook||dupFb)&&(!instagram||dupIg)&&(dupFb||dupIg)){
      return reply(res,409,{error:'This article is already posted to '+[dupFb&&'Facebook',dupIg&&'Instagram'].filter(Boolean).join(' and ')+'. Untick that channel to avoid a duplicate post.'});
    }
    limit=postingLimit(items);
  }catch(e){
    return reply(res,503,{error:'Could not check the posting limit right now. Please try again in a minute.'});
  }
  if(!limit.ok){
    res.setHeader('Retry-After',String(limit.minutes*60));
    return reply(res,429,{error:limit.why+'. You can post again '+when(limit.until)+' (in '+span(limit.minutes)+').',retryAt:new Date(limit.until).toISOString(),postsToday:limit.postsToday});
  }

  const result={ok:false,facebook:null,instagram:null};

  try{
    if(facebook){
      if(!imageUrl) throw new Error('Facebook photo publishing requires a public social image URL');
      result.facebook=await graph('/'+encodeURIComponent(pageId)+'/photos',{
        url:imageUrl,
        caption:[caption,'Read more: '+articleUrl,fbTags].filter(Boolean).join('\n\n'),
        access_token:token
      });
    }
    if(instagram){
      const media=await graph('/'+encodeURIComponent(igId)+'/media',{
        image_url:imageUrl,
        caption:[caption,'Link in bio.',igTags].filter(Boolean).join('\n\n'),
        access_token:token
      });
      if(!media.id) throw new Error('Instagram did not return a media container ID.');
      await waitForInstagramContainer(media.id,token);
      result.instagram=await graph('/'+encodeURIComponent(igId)+'/media_publish',{
        creation_id:media.id,
        access_token:token
      });
    }
    result.ok=true;
    await recordResult(id,result).catch(()=>{});
    return reply(res,200,{...result,postsToday:limit.postsToday+1,nextAllowedAt:new Date(limit.nextAfterPost).toISOString()});
  }catch(error){
    result.error=error.message||'Meta publish failed';
    await recordResult(id,result).catch(()=>{});
    return reply(res,500,{error:result.error,...result});
  }
}
