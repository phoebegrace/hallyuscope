import crypto from 'node:crypto';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const WIDTH=1080;
const HEIGHT=1350;
const MAX_AGE_MS=7*24*60*60*1000;

function esc(value=''){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function validPublicHttps(value){
  try{
    const u=new URL(value);
    if(u.protocol!=='https:') return false;
    const h=u.hostname.toLowerCase();
    if(h==='localhost'||h.endsWith('.local')||h==='127.0.0.1'||h==='0.0.0.0'||h==='::1') return false;
    if(/^10\./.test(h)||/^192\.168\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  }catch{return false;}
}
function signature(params,secret){
  const unsigned=new URLSearchParams(params);
  unsigned.delete('sig');
  return crypto.createHmac('sha256',secret).update(unsigned.toString()).digest('hex');
}
function timingSafeEqual(a,b){
  const aa=Buffer.from(String(a||''));
  const bb=Buffer.from(String(b||''));
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
function headlineSize(len){
  if(len>110) return 56;
  if(len>82) return 64;
  if(len>58) return 74;
  return 82;
}
function descriptionSize(len){
  if(len>190) return 24;
  if(len>135) return 26;
  return 29;
}
function html({image,category,headline,description,logoUrl}){
  const hs=headlineSize(headline.length);
  const ds=descriptionSize(description.length);
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
  *{box-sizing:border-box}html,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#01229a}
  body{font-family:Arial,Helvetica,sans-serif}
  .card{position:relative;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;isolation:isolate;background:#01229a;color:white}
  .photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0}
  .fade{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(1,34,154,0) 0%,rgba(1,34,154,0) 34%,rgba(1,34,154,.10) 46%,rgba(1,34,154,.36) 58%,rgba(1,34,154,.72) 72%,rgba(1,34,154,.94) 89%,#01229a 100%)}
  .logo{position:absolute;top:54px;left:58px;z-index:3;width:260px;height:auto;filter:drop-shadow(0 2px 0 rgba(1,34,154,.95)) drop-shadow(0 3px 8px rgba(0,0,0,.35))}
  .content{position:absolute;z-index:3;left:70px;right:70px;bottom:74px;display:flex;flex-direction:column;align-items:flex-start}
  .category{margin:0 0 20px;color:#fe0862;font-size:24px;line-height:1;font-weight:800;letter-spacing:.12em;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.35)}
  h1{max-width:950px;margin:0;color:white;font-size:${hs}px;line-height:.91;font-weight:800;letter-spacing:-.035em;text-shadow:0 2px 12px rgba(0,0,0,.28)}
  p{max-width:880px;margin:22px 0 0;color:rgba(255,255,255,.92);font-size:${ds}px;line-height:1.22;font-weight:500;letter-spacing:-.01em;text-shadow:0 2px 10px rgba(0,0,0,.25)}
  </style></head><body><article class="card">
  <img class="photo" src="${esc(image)}" alt="">
  <div class="fade"></div>
  <img class="logo" src="${esc(logoUrl)}" alt="HallyuScope">
  <div class="content">
    <div class="category">${esc(category)}</div>
    <h1>${esc(headline)}</h1>
    <p>${esc(description)}</p>
  </div>
  </article></body></html>`;
}
export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const secret=process.env.REVIEW_PASSWORD||'';
  if(!secret) return res.status(503).json({error:'Renderer is not configured'});
  const raw=new URLSearchParams();
  for(const key of ['image','category','headline','description','ts']){
    raw.set(key,String(req.query?.[key]||''));
  }
  const sig=String(req.query?.sig||'');
  const expected=signature(raw,secret);
  if(!sig||!timingSafeEqual(sig,expected)) return res.status(403).json({error:'Invalid image signature'});
  const ts=Number(raw.get('ts'));
  if(!Number.isFinite(ts)||Math.abs(Date.now()-ts)>MAX_AGE_MS) return res.status(403).json({error:'Image URL expired'});

  const image=raw.get('image');
  const category=(raw.get('category')||'K-POP').slice(0,60);
  const headline=raw.get('headline').slice(0,180);
  const description=raw.get('description').slice(0,260);
  if(!image||!headline||!validPublicHttps(image)) return res.status(400).json({error:'Valid HTTPS image and headline are required'});

  const host=req.headers['x-forwarded-host']||req.headers.host||'hallyuscope.com';
  const proto=req.headers['x-forwarded-proto']||'https';
  const logoUrl=proto+'://'+host+'/assets/hallyuscope-logo.png';

  let browser;
  try{
    browser=await puppeteer.launch({
      args:chromium.args,
      defaultViewport:{width:WIDTH,height:HEIGHT,deviceScaleFactor:1},
      executablePath:await chromium.executablePath(),
      headless:'shell'
    });
    const page=await browser.newPage();
    await page.setViewport({width:WIDTH,height:HEIGHT,deviceScaleFactor:1});
    await page.setContent(html({image,category,headline,description,logoUrl}),{waitUntil:'networkidle0',timeout:30000});
    await page.evaluate(async()=>{if(document.fonts?.ready) await document.fonts.ready;});
    const screenshot=await page.screenshot({type:'jpeg',quality:94,fullPage:false});
    const buffer=Buffer.from(screenshot);
    res.setHeader('Content-Type','image/jpeg');
    res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(buffer);
  }catch(error){
    return res.status(500).json({error:error.message||'Social card render failed'});
  }finally{
    if(browser) await browser.close().catch(()=>{});
  }
}
