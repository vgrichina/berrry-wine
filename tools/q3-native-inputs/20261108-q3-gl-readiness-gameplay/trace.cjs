'use strict';
const fs=require('node:fs'),{AsyncLocalStorage}=require('node:async_hooks'),crypto=require('node:crypto');
const context=new AsyncLocalStorage(),active=new Map();let seq=0,file;
exports.init=out=>{fs.mkdirSync(out,{recursive:true});file=out+'/await-trace.jsonl';};
function log(v){if(file)fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),epochMs:Date.now(),...v})+'\n');}
exports.expression=s=>({kind:s.includes('__mcmPassiveIdentityV1')?'page.owner':s.includes('__mcmPassiveInstanceV1')?'guest.instance':s.includes('__mcmPassiveRenderV1')?'renderer.owner':s.includes('Array.from(endpoints')?'state.renderer':s.includes('gpu:typeof')?'state.guest':s.includes('__simgolfGL')?'state.context':s.includes('const all=')?'state.page':'other',sha256:crypto.createHash('sha256').update(s).digest('hex')});
exports.span=async function(name,fn,meta={}){const id=++seq,parent=context.getStore()??null,start=Date.now(),row={id,parent,name,start,...meta};active.set(id,row);log({event:'entry',...row});try{const v=await context.run(id,fn);log({event:'exit',id,name,elapsedMs:Date.now()-start});return v;}catch(e){log({event:'error',id,name,elapsedMs:Date.now()-start,error:String(e)});throw e;}finally{active.delete(id);}};
exports.snapshot=(reason,meta={})=>log({event:'deadline',reason,...meta,active:[...active.values()].map(v=>({...v,elapsedMs:Date.now()-v.start}))});
exports.log=log;
