const OWNER = 'phoebegrace';
const REPO = 'hallyuscope';
const PATH = 'data/article-drafts.json';
const API = 'https://api.github.com';

function reply(res, status, data) {
  res.status(status).json(data);
}

function authorized(req) {
  const expected = process.env.REVIEW_PASSWORD || '';
  const supplied = req.headers['x-review-password'] || '';
  return expected && supplied && supplied === expected;
}

async function github(path, options={}) {
  const token = process.env.GITHUB_REVIEW_TOKEN;
  if (!token) throw new Error('GITHUB_REVIEW_TOKEN is not configured');
  const r = await fetch(API + path, {
    ...options,
    headers:{
      'Accept':'application/vnd.github+json',
      'Authorization':'Bearer ' + token,
      'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  });
  if(!r.ok){
    const text=await r.text();
    throw new Error('GitHub ' + r.status + ': ' + text.slice(0,220));
  }
  return r.json();
}

async function readQueue(){
  const file=await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH+'?ref=main');
  const json=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  return {file,json};
}

function cleanPatch(patch={}){
  const out={};
  for(const key of ['headline','dek','category','seoDescription','socialCaption']){
    if(typeof patch[key]==='string') out[key]=patch[key].trim();
  }
  if(Array.isArray(patch.body)) out.body=patch.body.map(x=>String(x).trim()).filter(Boolean);
  return out;
}

export default async function handler(req,res){
  if(req.method!=='POST') return reply(res,405,{error:'Method not allowed'});
  if(!authorized(req)) return reply(res,401,{error:'Incorrect review password'});
  if(!process.env.GITHUB_REVIEW_TOKEN) return reply(res,503,{error:'Review dashboard is not connected to GitHub yet'});

  try{
    const {action='list',id,operation,patch}=req.body||{};
    const {file,json}=await readQueue();
    const items=json.items||[];

    if(action==='list') return reply(res,200,{updatedAt:json.updatedAt,autoPublish:json.autoPublish===true,items});

    if(action==='set_auto_publish'){
      const enabled=req.body?.enabled===true;
      const nextJson={...json,autoPublish:enabled,updatedAt:new Date().toISOString()};
      const body={
        message:'editorial: auto-publish '+(enabled?'on':'off'),
        content:Buffer.from(JSON.stringify(nextJson,null,2)+'\n').toString('base64'),
        sha:file.sha,
        branch:'main'
      };
      await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH,{method:'PUT',body:JSON.stringify(body)});
      return reply(res,200,{autoPublish:enabled,items});
    }

    if(action!=='update'||!id) return reply(res,400,{error:'Invalid action'});
    const index=items.findIndex(x=>x.id===id);
    if(index<0) return reply(res,404,{error:'Draft not found'});

    const next={...items[index],...cleanPatch(patch)};
    if(operation==='publish'){
      next.status='published';
      next.publishedAt=new Date().toISOString();
      next.reviewedAt=next.publishedAt;
    }else if(operation==='skip'){
      next.status='skipped';
      next.reviewedAt=new Date().toISOString();
    }else{
      next.status=next.status||'pending_review';
      next.editedAt=new Date().toISOString();
    }
    items[index]=next;

    const body={
      message:'editorial: '+operation+' '+id,
      content:Buffer.from(JSON.stringify({...json,updatedAt:new Date().toISOString(),items},null,2)+'\n').toString('base64'),
      sha:file.sha,
      branch:'main'
    };
    await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH,{method:'PUT',body:JSON.stringify(body)});
    return reply(res,200,{items});
  }catch(error){
    return reply(res,500,{error:error.message||'Review update failed'});
  }
}