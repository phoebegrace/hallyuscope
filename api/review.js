const OWNER = 'phoebegrace';
const REPO = 'hallyuscope';
const PATH = 'data/article-drafts.json';
const API = 'https://api.github.com';
const BRANCH = 'live-data';

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
  const file=await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH+'?ref='+BRANCH);
  const json=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  return {file,json};
}

const COMEBACKS_PATH = 'data/comebacks-calendar.json';

async function readComebacks(){
  const file=await github('/repos/'+OWNER+'/'+REPO+'/contents/'+COMEBACKS_PATH+'?ref='+BRANCH);
  const json=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  return {file,json};
}

async function writeFile(path, sha, json, message){
  const body={
    message,
    content:Buffer.from(JSON.stringify(json,null,2)+'\n').toString('base64'),
    sha,
    branch:BRANCH
  };
  await github('/repos/'+OWNER+'/'+REPO+'/contents/'+path,{method:'PUT',body:JSON.stringify(body)});
}

function isShopeeUrl(value=''){
  const u=String(value).trim();
  if(!u) return true; // empty clears the link
  let host='';
  try{ host=new URL(u).hostname.toLowerCase(); }catch{ return false; }
  return host==='shopee.ph' || host.endsWith('.shopee.ph') || host==='shope.ee' || host.endsWith('.shope.ee');
}

function buyLinkOf(entry){
  const links=Array.isArray(entry.buyLinks)?entry.buyLinks:[];
  const first=links.find(b=>b && b.url);
  return first ? String(first.url) : '';
}

function listAlbums(items){
  return items.map(e=>({
    id:e.id, artist:e.artist||'', title:e.title||'', date:e.date||'',
    cover:e.cover||'', buyLink:buyLinkOf(e),
    buyLinks:(Array.isArray(e.buyLinks)?e.buyLinks:[]).filter(b=>b&&b.url)
      .map(b=>({label:String(b.label||'Buy on Shopee'),url:String(b.url)}))
  }));
}

async function buyLinksHandler(req,res,action){
  const {file,json}=await readComebacks();
  const items=json.items||[];

  if(action==='buy_links_list'){
    return reply(res,200,{albums:listAlbums(items)});
  }

  // buy_links_save: {links:{<albumId>: [{label,url}, ...]}}.
  // Albums ship in different versions (Standard, Limited, member ver...),
  // each with its own Shopee listing, so one album holds several labelled
  // links. A plain string is still accepted as one unlabelled link.
  const links=(req.body && req.body.links)||{};
  if(typeof links!=='object' || Array.isArray(links)) return reply(res,400,{error:'No links to save'});
  let changed=0;
  for(const [id,value] of Object.entries(links)){
    const entry=items.find(x=>x.id===id);
    if(!entry) continue;
    const rows=Array.isArray(value) ? value : [{label:'Buy on Shopee',url:value}];
    const next=[];
    for(const row of rows){
      const url=String((row && row.url)||'').trim();
      if(!url) continue;
      if(!isShopeeUrl(url)){
        return reply(res,400,{error:'Not a Shopee link: '+url.slice(0,80)});
      }
      next.push({label:String((row && row.label)||'').trim()||'Buy on Shopee',url});
    }
    const before=JSON.stringify(Array.isArray(entry.buyLinks)?entry.buyLinks:[]);
    if(before!==JSON.stringify(next)){ entry.buyLinks=next; changed++; }
  }
  if(!changed) return reply(res,200,{albums:listAlbums(items),changed:0});
  await writeFile(COMEBACKS_PATH,file.sha,{...json,updatedAt:new Date().toISOString(),items},'editorial: update Shopee affiliate links ('+changed+' album'+(changed===1?'':'s')+')');
  return reply(res,200,{albums:listAlbums(items),changed});
}

// Long dashes are never allowed in HallyuScope articles. The model is
// told not to use them, and this strips any that slip through anyway, so
// a draft can never contain one no matter which model wrote it.
function cleanDashes(value = '') {
  return String(value)
    .replace(/ —\./g, '.')
    .replace(/ —/g, ',')
    .replace(/ — /g, ', ')
    .replace(/— /g, ', ')
    .replace(/—/g, ', ')
    .replace(/–/g, '-')
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/ +/g, ' ')
    .trim();
}

function cleanPatch(patch={}){
  const out={};
  for(const key of ['headline','dek','category','seoDescription','socialCaption','socialHashtags','socialImageUrl','imageUrl','imageType']){
    if(typeof patch[key]==='string') out[key]=cleanDashes(patch[key]);
  }
  if(Array.isArray(patch.body)) out.body=patch.body.map(x=>cleanDashes(x)).filter(Boolean);
  if(patch.socialPlatforms && typeof patch.socialPlatforms==='object'){
    out.socialPlatforms={
      facebook:patch.socialPlatforms.facebook!==false,
      instagram:patch.socialPlatforms.instagram!==false
    };
  }
  return out;
}

export default async function handler(req,res){
  if(req.method!=='POST') return reply(res,405,{error:'Method not allowed'});
  if(!authorized(req)) return reply(res,401,{error:'Incorrect review password'});
  if(!process.env.GITHUB_REVIEW_TOKEN) return reply(res,503,{error:'Review dashboard is not connected to GitHub yet'});

  try{
    const {action='list',id,operation,patch}=req.body||{};

    // Shopee affiliate links live in the comebacks data, not the drafts queue.
    if(action==='buy_links_list' || action==='buy_links_save'){
      return buyLinksHandler(req,res,action);
    }

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
        branch:BRANCH
      };
      await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH,{method:'PUT',body:JSON.stringify(body)});
      return reply(res,200,{autoPublish:enabled,items});
    }

    if(action!=='update'||!id) return reply(res,400,{error:'Invalid action'});
    const index=items.findIndex(x=>x.id===id);
    if(index<0) return reply(res,404,{error:'Draft not found'});

    const next={...items[index],...cleanPatch(patch)};
    if(next.imageType==='official'){
      next.imagePolicy={type:'official',note:'Marked in editorial review as a verified official promotional asset.'};
    }else{
      next.imageType='hallyuscope_original';
      next.imagePolicy={type:'hallyuscope_original',note:'HallyuScope original editorial cover.'};
    }
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
      branch:BRANCH
    };
    await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH,{method:'PUT',body:JSON.stringify(body)});
    return reply(res,200,{items});
  }catch(error){
    return reply(res,500,{error:error.message||'Review update failed'});
  }
}