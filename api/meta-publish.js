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
async function recordResult(id,result){
  if(!process.env.GITHUB_REVIEW_TOKEN) return;
  const file=await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH+'?ref='+BRANCH);
  const json=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  const items=json.items||[];
  const index=items.findIndex(x=>x.id===id);
  if(index<0) return;
  items[index]={
    ...items[index],
    socialStatus:result.ok?'published':'failed',
    socialPublishedAt:result.ok?new Date().toISOString():items[index].socialPublishedAt||null,
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

  const {id,caption='',hashtags='',imageUrl='',facebook=true,instagram=true}=req.body||{};
  if(!id) return reply(res,400,{error:'Missing article id'});
  if(!facebook&&!instagram) return reply(res,400,{error:'Choose at least one Meta account'});
  if(instagram&&!imageUrl) return reply(res,400,{error:'Instagram requires a public image URL'});

  const articleUrl='https://hallyuscope.com/article?id='+encodeURIComponent(id);
  const tags=String(hashtags||'')
    .split(/\s+/)
    .map(x=>x.trim())
    .filter(x=>/^#[\p{L}\p{N}_]+$/u.test(x));
  const fbTags=tags.slice(0,3).join(' ');
  const igTags=tags.slice(0,8).join(' ');
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
    return reply(res,200,result);
  }catch(error){
    result.error=error.message||'Meta publish failed';
    await recordResult(id,result).catch(()=>{});
    return reply(res,500,{error:result.error,...result});
  }
}
