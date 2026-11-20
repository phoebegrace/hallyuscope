// Refresh factual dates from source listings. No AI-generated dates or paid API calls.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {parseComebacks,parseSmTickets,parseJsonLdEvents,parseYouTubeReleases,mergeCalendar} from './lib/trackers.mjs';
const dir=new URL('../data/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name+'.json',dir),'utf8'));
const [sources,profiles,concerts,comebacks,manual]=await Promise.all([read('tracker-sources'),read('profiles'),read('concerts-calendar'),read('comebacks-calendar'),read('manual-releases').catch(()=>({items:[]}))]);
const names=[...new Set([...profiles.items.filter(x=>x.category!=='k-actors').map(x=>x.name),...concerts.items.map(x=>x.artist),...comebacks.items.map(x=>x.artist)])];
let browserPromise;
async function renderedHtml(url){
 if(!process.env.TRACKER_BROWSER_MODULE)throw Error('Browser renderer is not configured.');
 const renderer=createRequire(process.env.TRACKER_BROWSER_MODULE).resolve('puppeteer-core');
 browserPromise ||= import(renderer).then(({default:puppeteer})=>puppeteer.launch({executablePath:process.env.TRACKER_BROWSER_EXECUTABLE||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}));
 const browser=await browserPromise;
 const page=await browser.newPage();
 try{
  await page.goto(url,{waitUntil:'networkidle2',timeout:30000});
  await page.waitForFunction(()=>[...document.querySelectorAll('script[type="application/ld+json"]')].some(x=>/startDate/.test(x.textContent)),{timeout:10000}).catch(()=>{});
  return await page.content();
 }finally{await page.close();}
}
const parse=(source,html)=>source.parser==='sm-tickets'?parseSmTickets(html,names):source.parser==='kpop-official'?parseComebacks(html):source.parser==='youtube-mv'?parseYouTubeReleases(html,names,source.name.replace(/ \(YouTube\)$/,'')):parseJsonLdEvents(html,names,source.url);
const checkedAt=new Date().toISOString();
const results=await Promise.all(sources.sources.map(async source=>{
 try{
  const response=await fetch(source.url,{signal:AbortSignal.timeout(25000),headers:{'User-Agent':'HallyuScope/1.0 (+https://hallyuscope.com)','Accept':source.parser==='youtube-mv'?'application/atom+xml,application/xml':'text/html'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const html=await response.text();
  let items=parse(source,html);
  if(!items.length&&source.parser==='youtube-mv')return {...source,ok:true,count:0,checkedAt,items};
  if(!items.length&&process.env.TRACKER_BROWSER_MODULE){
   items=parse(source,await renderedHtml(source.url));
  }
  if(!items.length)throw Error('No usable schedule records returned; keeping the last known dates.');
  return {...source,ok:true,count:items.length,checkedAt,items};
 }catch(error){return {...source,ok:false,count:0,checkedAt,error:error.message,items:[]};}
}));
if(browserPromise){const browser=await browserPromise.catch(()=>null);if(browser)await browser.close();}
const summary={checkedAt,refreshMinutes:30,sources:results.map(({items,...x})=>x)};
for(const [kind,previous] of [['concerts',concerts],['comebacks',comebacks]]){
 const successful=results.filter(x=>x.kind===kind&&x.ok);
 // Hand-checked releases (data/manual-releases.json) fill gaps the feeds miss.
 const incoming=[...successful.flatMap(x=>x.items),...(kind==='comebacks'?manual.items||[]:[])];
 const merged=mergeCalendar(previous.items||[],incoming,kind,checkedAt);
 const next={...previous,...(successful.length?{lastCheckedAt:checkedAt}:{}),...(merged.added||merged.changed?{updatedAt:checkedAt}:{}),items:merged.items};
 await writeFile(new URL(kind==='concerts'?'concerts-calendar.json':'comebacks-calendar.json',dir),JSON.stringify(next,null,2)+'\n');
 summary[kind]={records:merged.items.length,added:merged.added,changed:merged.changed,successfulSources:successful.length};
}
await writeFile(new URL('tracker-health.json',dir),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
if(!results.some(x=>x.ok))process.exitCode=1;
