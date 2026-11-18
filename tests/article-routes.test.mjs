import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as legacy} from '../functions/article.js';
import {onRequest as pretty} from '../functions/article/[slug].js';
const item={id:'abc123',slug:'sample-story',status:'published',headline:'Sample story',dek:'Details'};
async function withFetch(fetcher,run){const original=globalThis.fetch;globalThis.fetch=fetcher;try{return await run();}finally{globalThis.fetch=original;}}
test('legacy article ID and headline routes both resolve published articles',()=>withFetch(async()=>Response.json({items:[item]}),async()=>{
 for(const [handler,url,params] of [[legacy,'https://hallyuscope.com/article?id=abc123',{}],[pretty,'https://hallyuscope.com/article/sample-story',{slug:'sample-story'}]]){
  const response=await handler({request:new Request(url),params});assert.equal(response.status,200);assert.match(await response.text(),/<title>Sample story/);
 }
}));
test('unpublished articles remain unavailable',()=>withFetch(async()=>Response.json({items:[{...item,status:'pending_review'}]}),async()=>{
 const response=await legacy({request:new Request('https://hallyuscope.com/article?id=abc123'),params:{}});assert.equal(response.status,404);
}));
test('a failed data source returns a retryable 503 instead of a false cached 404',()=>withFetch(async()=>{throw Error('offline');},async()=>{
 const response=await legacy({request:new Request('https://hallyuscope.com/article?id=abc123'),params:{}});assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'no-store');
}));
