// Starts the data refresh workflows on a reliable schedule.
// GitHub's own cron often runs hours late, so a Cloudflare cron trigger
// calls this endpoint every 30 minutes. Each workflow is started only when
// its last run is older than its interval, so extra calls are harmless.
import { draftWeekly, draftAlerts } from './newsletter.js';
const OWNER='phoebegrace';
const REPO='hallyuscope';
const API='https://api.github.com';
const WORKFLOWS=[
 {file:'refresh-trackers.yml',everyMinutes:30},
 {file:'refresh-kpop-data.yml',everyMinutes:60}
];

async function github(path,options={}){
 const token=process.env.GITHUB_REVIEW_TOKEN;
 if(!token)throw new Error('GITHUB_REVIEW_TOKEN is not configured');
 const r=await fetch(API+path,{...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'HallyuScope (+https://hallyuscope.com)',...(options.headers||{})}});
 if(!r.ok)throw new Error('GitHub '+r.status+': '+(await r.text()).slice(0,160));
 return r.status===204?null:r.json();
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const now=Date.now();
 const results=[];
 for(const wf of WORKFLOWS){
  try{
   const runs=await github('/repos/'+OWNER+'/'+REPO+'/actions/workflows/'+wf.file+'/runs?per_page=1');
   const last=runs.workflow_runs?.[0];
   const lastAt=last?new Date(last.created_at).getTime():0;
   const busy=last&&last.status!=='completed';
   const ageMin=Math.round((now-lastAt)/60000);
   // Leave a few minutes of slack so a 30-minute trigger never skips a beat.
   if(busy||ageMin<wf.everyMinutes-5){results.push({workflow:wf.file,started:false,lastRunMinutesAgo:ageMin,running:!!busy});continue;}
   await github('/repos/'+OWNER+'/'+REPO+'/actions/workflows/'+wf.file+'/dispatches',{method:'POST',body:JSON.stringify({ref:'main'})});
   results.push({workflow:wf.file,started:true,lastRunMinutesAgo:ageMin});
  }catch(error){results.push({workflow:wf.file,started:false,error:error.message});}
 }
 // The Weekly Scope: ticket and comeback alerts are checked on every run;
 // the weekly issue is drafted on Friday morning (Manila) for a 6 PM send.
 // Both only create Brevo drafts, never send.
 const manila=new Date(now+8*3600000);
 const newsletter={};
 try{newsletter.alerts=await draftAlerts();}catch(error){newsletter.alerts={error:error.message};}
 if(manila.getUTCDay()===5&&manila.getUTCHours()>=9){try{newsletter.weekly=await draftWeekly();}catch(error){newsletter.weekly={error:error.message};}}
 res.status(results.some(x=>x.error)?502:200).json({checkedAt:new Date(now).toISOString(),results,newsletter});
}
