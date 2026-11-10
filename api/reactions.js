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
      ...(options.headers||{})
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
function emptyCounts(){return {love:0,omg:0,congrats:0,interesting:0,sad:0};}
function cleanCounts(input={}){
  const out=emptyCounts();
  for(const k of ALLOWED) out[k]=Math.max(0,Number(input[k]||0)||0);
  return out;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
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
