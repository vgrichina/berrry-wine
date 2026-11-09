'use strict';
const assert=require('node:assert/strict');
// Read only completed observer receipts scoped to the actual GL adapter,
// current guest owner and context. A software legacy transport is paired with
// that same guest's GL bridge; its native triangle counter remains mandatory.
const READ=`(() => {
 if(typeof endpoints==='undefined')return [];
 if(!globalThis.__q3ProducerIds)globalThis.__q3ProducerIds={ids:new WeakMap(),next:0,epoch:crypto.randomUUID()};
 const s=__q3ProducerIds,token=o=>{if(!o)return null;if(!s.ids.has(o))s.ids.set(o,s.epoch+':'+(++s.next));return s.ids.get(o)};
 return Array.from(endpoints,([id,e])=>({id,options:e.options,failed:!!e.failed,
  control:e.control?{ready:Atomics.load(e.control,0),completed:Atomics.load(e.control,1),error:Atomics.load(e.control,2)}:null,
  gl:e.adapter?.__q3Producer?{adapter:token(e.adapter),bridge:token(e.adapter.__q3Producer.bridge),
   owners:[...e.adapter.__q3Producer.owners].map(([owner,v])=>{
    const b=e.adapter.__q3Producer.bridge,c=b.contexts.get(b.currentByOwner.get(owner));
    return {owner,...v,context:token(c),contextHandle:c?.handle,hwnd:c?.hwnd,software:!!c?.software,
     webgl:!!c?.backend?.gl,backend:c?.backend?.constructor?.name,writeSeq:c?.layer?.writeSeq??0,
     draws:c?.__q3CompletedDraws??0,vertices:c?.__q3CompletedVertices??0};
   })}:null}));
})()`;
function select({a,endpoints,target,backend}){
 const matches=endpoints.filter(e=>e.options.api==='gl'&&e.options.backend===backend&&e.gl&&!e.failed)
  .flatMap(e=>e.gl.owners.filter(v=>v.owner===a.slot&&v.context&&v.hwnd>0).map(v=>({e,v})));
 if(matches.length!==1)return null;
 const {e,v}=matches[0];
 if(!(v.completed>0&&v.presented>0&&v.writeSeq>0))return null;
 let transport=e.id;
 if(backend==='software'){
  const d=a.d3dStats,l=endpoints.find(l=>l.id===a.renderEndpoint);
  if(!(v.software&&v.softwareCompleted>0&&d?.ready&&d.glTriangles>0&&d.renderEndpointId===a.renderEndpoint&&
   l?.options.api==='legacy'&&l.options.backend==='software'&&!l.failed&&l.control?.ready===1&&l.control.completed>0&&!l.control.error))return null;
  transport=l.id;
 }else if(!(backend==='webgl'&&!v.software&&v.webgl&&v.draws>0&&v.vertices>0&&a.renderEndpoint===e.id))return null;
 return {target,endpoint:e.id,transport,adapter:e.gl.adapter,bridge:e.gl.bridge,owner:v.owner,context:v.context,
  hwnd:v.hwnd,software:v.software,backend,completed:v.completed,softwareCompleted:v.softwareCompleted,
  draws:v.draws,vertices:v.vertices,presented:v.presented,writeSeq:v.writeSeq};
}
function continuity(a,b){for(const k of ['target','endpoint','transport','adapter','bridge','owner','context','hwnd','software','backend'])assert.equal(b[k],a[k],'GL producer changed: '+k);}
function advancing(a,b){continuity(a,b);return b.completed>a.completed&&b.presented>a.presented&&b.writeSeq>a.writeSeq&&
 (b.software?b.softwareCompleted>a.softwareCompleted:b.draws>a.draws);}
module.exports={READ,select,continuity,advancing};
