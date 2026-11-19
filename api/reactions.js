const OWNER='phoebegrace';
const REPO='hallyuscope';
const PATH='data/reactions.json';
const BRANCH='live-data';
const API='https://api.github.com';
const ALLOWED=new Set(['love','omg','congrats','interesting','sad']);

function reply(res,status,data){res.status(status).json(data);}
async function github(path,options={}){
  const token=process.env.GITHUB_REVIEW_TOKEN;
  if(!token) throw new Error('Reaction storage is not configured');
  const r=await fetch(API+path,{
    ...options,
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json',
      ...(options.headers||{}),
      'User-Agent':'HallyuScope (+https://hallyuscope.com)'
    }
  });
  if(!r.ok) throw new Error('GitHub '+r.status+': '+(await r.text()).slice(0,180));
  return r.json();
}
async function readStore(){
  const file=await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH+'?ref='+encodeURIComponent(BRANCH));
  const json=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  return {file,json};
}
// K-Profile "bias" hearts: one per browser per artist, counts shared by everyone.
const BIAS_ID=/^[a-z0-9][a-z0-9-]{0,63}$/;
function cleanBiases(input={}){
  const out={};
  for(const [k,v] of Object.entries(input||{})) if(BIAS_ID.test(k)) out[k]=Math.max(0,Number(v)||0);
  return out;
}
async function handleBias(req,res){
  if(req.method==='GET'){
    const {json}=await readStore();
    const biases=cleanBiases(json.biases);
    const total=Object.values(biases).reduce((a,b)=>a+b,0);
    return reply(res,200,{biases,total});
  }
  const id=String(req.body?.bias||'').trim();
  const on=req.body?.on===true;
  if(!BIAS_ID.test(id)) return reply(res,400,{error:'Invalid artist'});
  for(let attempt=0;attempt<3;attempt++){
    const {file,json}=await readStore();
    const biases=cleanBiases(json.biases);
    if(!(id in biases) && Object.keys(biases).length>=500) return reply(res,400,{error:'Unknown artist'});
    biases[id]=Math.max(0,(biases[id]||0)+(on?1:-1));
    const next={...json,updatedAt:new Date().toISOString(),biases};
    try{
      await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH,{
        method:'PUT',
        body:JSON.stringify({message:'bias: '+id+(on?' +1':' -1'),content:Buffer.from(JSON.stringify(next,null,2)+'\n').toString('base64'),sha:file.sha,branch:BRANCH})
      });
      return reply(res,200,{id,count:biases[id],total:Object.values(biases).reduce((a,b)=>a+b,0)});
    }catch(error){ if(attempt===2) throw error; }
  }
}
function emptyCounts(){return {love:0,omg:0,congrats:0,interesting:0,sad:0};}
function cleanCounts(input={}){
  const out=emptyCounts();
  for(const k of ALLOWED) out[k]=Math.max(0,Number(input[k]||0)||0);
  return out;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if((req.method==='GET'&&req.query?.bias!==undefined)||(req.method==='POST'&&req.body?.bias!==undefined)) return await handleBias(req,res);
    if(req.method==='GET'){
      const id=String(req.query?.id||'').trim();
      if(!id) return reply(res,400,{error:'Missing article id'});
      const {json}=await readStore();
      return reply(res,200,{counts:cleanCounts(json.articles?.[id])});
    }
    if(req.method!=='POST') return reply(res,405,{error:'Method not allowed'});
    const id=String(req.body?.id||'').trim();
    const reaction=String(req.body?.reaction||'').trim();
    const previous=req.body?.previous ? String(req.body.previous).trim() : null;
    if(!id||!ALLOWED.has(reaction)) return reply(res,400,{error:'Invalid reaction'});
    if(previous && !ALLOWED.has(previous)) return reply(res,400,{error:'Invalid previous reaction'});

    for(let attempt=0;attempt<2;attempt++){
      const {file,json}=await readStore();
      const articles={...(json.articles||{})};
      const counts=cleanCounts(articles[id]);
      if(previous && previous!==reaction) counts[previous]=Math.max(0,counts[previous]-1);
      if(previous!==reaction) counts[reaction]+=1;
      articles[id]=counts;
      const next={...json,updatedAt:new Date().toISOString(),articles};
      try{
        await github('/repos/'+OWNER+'/'+REPO+'/contents/'+PATH,{
          method:'PUT',
          body:JSON.stringify({
            message:'reaction: '+id+' '+reaction,
            content:Buffer.from(JSON.stringify(next,null,2)+'\n').toString('base64'),
            sha:file.sha,
            branch:BRANCH
          })
        });
        return reply(res,200,{counts});
      }catch(error){
        if(attempt===1) throw error;
      }
    }
  }catch(error){
    return reply(res,500,{error:error.message||'Reaction update failed'});
  }
}
