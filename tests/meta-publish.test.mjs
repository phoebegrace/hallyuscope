import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/meta-publish.js';

async function run({ imageUrl='https://hallyuscope.com/api/social-card?sig=old', photo='https://example.com/photo.png', previous, instagram=false, igId='', failInstagram=false, failedAt }={}) {
  const savedEnv={...process.env}, originalFetch=globalThis.fetch;
  Object.assign(process.env,{REVIEW_PASSWORD:'test-password',GITHUB_REVIEW_TOKEN:'test-github',META_PAGE_ACCESS_TOKEN:'test-meta',META_PAGE_ID:'page',META_IG_USER_ID:igId});
  let item={id:'article',imageUrl:photo,socialPublishResult:previous,...(failedAt?{socialStatus:'failed',socialLastAttemptAt:failedAt}:{})};
  const calls=[];
  globalThis.fetch=async (url,options={})=>{
    if(String(url).startsWith('https://api.github.com/')){
      if(options.method==='PUT') {
        item=JSON.parse(Buffer.from(JSON.parse(options.body).content,'base64').toString()).items[0];
        return Response.json({});
      }
      return Response.json({sha:'sha',content:Buffer.from(JSON.stringify({items:[item]})).toString('base64')});
    }
    calls.push({url:String(url),params:options.body&&Object.fromEntries(options.body)});
    if(failInstagram&&String(url).endsWith('/media')) return Response.json({error:{message:'Instagram rejected'}},{status:400});
    if(String(url).includes('fields=status_code')) return Response.json({status_code:'FINISHED'});
    return Response.json({id:String(url).endsWith('/photos')?'fb-id':String(url).endsWith('/media_publish')?'ig-id':'container-id'});
  };
  const res={status(code){this.code=code;return this;},json(data){this.data=data;},setHeader(){}};
  try {
    await handler({method:'POST',headers:{'x-review-password':'test-password'},body:{id:'article',imageUrl,facebook:true,instagram}},res);
    return {res,calls,item};
  } finally {globalThis.fetch=originalFetch;process.env=savedEnv;}
}

test('legacy SVG preview resolves to the saved photo; Facebook does not require Instagram config',async()=>{
  const {res,calls}=await run();assert.equal(res.code,200);assert.equal(calls[0].params.url,'https://example.com/photo.png');
});
test('empty social URL uses the saved photo',async()=>{
  const {res,calls}=await run({imageUrl:''});assert.equal(res.code,200);assert.equal(calls[0].params.url,'https://example.com/photo.png');
});
test('unusable SVG feature image is rejected before contacting Meta',async()=>{
  const {res,calls}=await run({photo:'https://example.com/art.svg'});assert.equal(res.code,400);assert.equal(calls.length,0);
});
test('retry after partial success posts only the missing channel and preserves the Facebook ID',async()=>{
  const {res,calls,item}=await run({instagram:true,igId:'ig',previous:{facebook:{id:'existing-fb'}}});
  assert.equal(res.code,200);assert.ok(calls.every(c=>!c.url.endsWith('/photos')));assert.equal(item.socialPublishResult.facebook.id,'existing-fb');assert.equal(item.socialPublishResult.instagram.id,'ig-id');
});
test('already completed channels are not published twice',async()=>{
  const {res,calls}=await run({previous:{facebook:{id:'existing-fb'}}});assert.equal(res.code,409);assert.equal(calls.length,0);
});
test('Facebook success is retained when Instagram rejects its container',async()=>{
  const {res,item}=await run({instagram:true,igId:'ig',failInstagram:true});assert.equal(res.code,500);assert.equal(item.socialPublishResult.facebook.id,'fb-id');assert.equal(item.socialStatus,'failed');
});

test('a repaired authentication error can be retried immediately',async()=>{
  const {res}=await run({previous:{error:'(#200) The permission(s) publish_actions are not available.'},failedAt:new Date().toISOString()});assert.equal(res.code,200);
});
test('unknown publishing failures retain the retry cooldown',async()=>{
  const {res,calls}=await run({previous:{error:'API access blocked'},failedAt:new Date().toISOString()});assert.equal(res.code,429);assert.equal(calls.length,0);
});
