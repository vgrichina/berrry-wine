'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {PNG}=require('pngjs');
const {createMenuContext,createImageSink,CAPABILITY,POLICY}=require('../tools/mcm-menu-reviewed-context.cjs');
function fixture(){
  let time=100000,down=0,reads=0,shots=0,cancelled=false;
  const p=new PNG({width:40,height:30});p.data.fill(255);
  let png=PNG.sync.write(p),owner={session:'session',owner:{actual:'owner'},process:'process',
    hwnd:41,generation:'window-object-1',endpoint:'endpoint',epoch:'epoch',module:'module',
    viewport:{width:40,height:30,screen:{x:0,y:0,width:40,height:30}}};
  const retained=[];
  const config={now:()=>time,checkpoint:()=>assert(!cancelled,'cancelled'),
    capture:async()=>{shots++;return png;},identity:async()=>{reads++;return owner;},
    evidenceSink:row=>{retained.push(row);return true;}};
  const authority=createMenuContext(config);
  return {authority,config,retained,owner,p,get down(){return down;},get reads(){return reads;},get shots(){return shots;},
    set time(v){time=v;},get time(){return time;},cancel(){cancelled=true;},
    pixel(){p.data[0]--;png=PNG.sync.write(p);},
    async prepare(){const image=await authority.captureReview();const intent={capability:CAPABILITY,mode:'MENU',action:'Start',
      kind:'mouse',button:'left',holdMs:100,x:20,y:15,nonce:'only-start',review:'I reviewed the complete MENU source and this exact Start',
      reviewedAt:time,imageSHA256:image.sha256};return {image,intent,handle:authority.review(intent)};},
    dispatch(){down++;return 'DOWN';}};
}
test('explicit MENU equality uses independent source30/review15/fresh5 limits',async()=>{
  assert.deepEqual(POLICY,{sourceMs:30000,reviewMs:15000,freshMs:5000});
  const f=fixture(),p=await f.prepare();f.time+=13000;
  assert.equal(await f.authority.start(p.handle,p.intent,f.dispatch),'DOWN');assert.equal(f.down,1);
  assert.deepEqual(f.retained.map(r=>r.stage),['source','review','fresh','final']);
  assert(f.retained.filter(r=>r.stage!=='review').every(r=>r.personallyReviewed===false));
  assert(f.retained.every(r=>PNG.sync.read(r.png).data.length===40*30*4));
});
for(const key of ['session','owner','process','hwnd','generation','endpoint','epoch','viewport','module'])test('current identity change refuses '+key,async()=>{
  const f=fixture(),p=await f.prepare();f.owner[key]='replacement';
  await assert.rejects(f.authority.start(p.handle,p.intent,f.dispatch),/changed|COMPLETE viewport/);
  assert.equal(f.down,0);assert(f.authority.closed);assert(f.retained.some(r=>r.stage==='refused'));
  const reads=f.reads;await assert.rejects(f.authority.captureReview(),/closed/);assert.equal(f.reads,reads);
});
test('one changed pixel refuses whole frame, retains full changed image before refusal',async()=>{
  const f=fixture(),p=await f.prepare();f.pixel();
  await assert.rejects(f.authority.start(p.handle,p.intent,f.dispatch),/EXACT whole RGBA/);
  assert.equal(f.down,0);assert(f.retained.some(r=>r.stage==='fresh'&&r.png.equals(f.retained.at(-1).png)));
});
test('pixel changed after fresh capture is refused by the final whole-frame comparison',async()=>{
  const f=fixture(),original=f.config.evidenceSink;
  const a=createMenuContext({...f.config,evidenceSink:row=>{const ok=original(row);if(row.stage==='fresh')f.pixel();return ok;}});
  const source=await a.captureReview(),p=await fixture().prepare(),intent={...p.intent,imageSHA256:source.sha256},h=a.review(intent);
  await assert.rejects(a.start(h,intent,f.dispatch),/EXACT whole RGBA/);assert.equal(f.down,0);
  assert(f.retained.some(r=>r.stage==='final'));assert(f.retained.some(r=>r.stage==='refused'));
});
for(const [label,offset]of [['review boundary',15000],['source boundary',30000],['reverse',-1]])test('clock refuses '+label,async()=>{
  const f=fixture(),p=await f.prepare();f.time+=offset;
  await assert.rejects(f.authority.start(p.handle,p.intent,f.dispatch),/clock/);assert.equal(f.down,0);
});
test('review now cannot renew original source age',async()=>{
  const f=fixture(),p=await f.prepare();f.time+=30000;p.intent.reviewedAt=f.time;
  assert.throws(()=>f.authority.review(p.intent),/clock/);assert.equal(f.down,0);
});
for(const stage of ['fresh','final'])test('slow '+stage+' capture cannot renew 5s freshness',async()=>{
  const f=fixture(),p=await f.prepare();
  const g=fixture(),original=g.config.evidenceSink;
  g.config.evidenceSink=r=>{const result=original(r);if(r.stage===stage)g.time+=5000;return result;};
  const a=createMenuContext(g.config),image=await a.captureReview(),intent={...p.intent,imageSHA256:image.sha256,reviewedAt:g.time};
  const handle=a.review(intent);await assert.rejects(a.start(handle,intent,g.dispatch),/clock/);assert.equal(g.down,0);
});
for(const stage of ['source','review','fresh','final'])test('synchronous sink failure at '+stage+' sends zero DOWN',async()=>{
  const f=fixture(),original=f.config.evidenceSink;
  f.config.evidenceSink=row=>{if(row.stage===stage)throw Error('sink refused');return original(row);};
  const a=createMenuContext(f.config);
  try{const image=await a.captureReview(),p=await fixture().prepare(),intent={...p.intent,imageSHA256:image.sha256};
    const h=a.review(intent);await a.start(h,intent,f.dispatch);assert.fail('sink admitted');
  }catch(e){assert.match(e.message,/sink/);}assert.equal(f.down,0);assert(a.closed);
});
test('async evidence acknowledgement is rejected',async()=>{
  const f=fixture(),a=createMenuContext({...f.config,evidenceSink:async()=>true});
  await assert.rejects(a.captureReview(),/synchronous/);assert.equal(f.down,0);
});
test('sink receives detached copies and cannot change private source pixels or identity',async()=>{
  const f=fixture(),original=f.config.evidenceSink;
  f.config.evidenceSink=row=>{const result=original(row);row.png.fill(0);row.identity.module='forged';return result;};
  const a=createMenuContext(f.config),image=await a.captureReview(),p=await fixture().prepare();
  const intent={...p.intent,imageSHA256:image.sha256},h=a.review(intent);
  await a.start(h,intent,f.dispatch);assert.equal(f.down,1);
});
test('forged, cross-session and replayed handles refuse with zero additional DOWN',async()=>{
  const f=fixture(),p=await f.prepare(),g=fixture(),q=await g.prepare();
  await assert.rejects(g.authority.start(p.handle,q.intent,g.dispatch),/private/);assert.equal(g.down,0);
  await f.authority.start(p.handle,p.intent,f.dispatch);const reads=f.reads;
  await assert.rejects(f.authority.start(p.handle,p.intent,f.dispatch),/one-use/);assert.equal(f.down,1);assert.equal(f.reads,reads);
});
for(const change of [i=>i.action='Quit',i=>i.mode='GAME',i=>i.x++,i=>i.holdMs=200,i=>i.nonce='other'])test('exact intent cannot be replaced '+change.toString(),async()=>{
  const f=fixture(),p=await f.prepare();change(p.intent);
  await assert.rejects(f.authority.start(p.handle,p.intent,f.dispatch),/intent changed/);assert.equal(f.down,0);
});
test('cancel during final sink is checked before DOWN',async()=>{
  const f=fixture(),original=f.config.evidenceSink;
  const a=createMenuContext({...f.config,evidenceSink:row=>{const ok=original(row);if(row.stage==='final')f.cancel();return ok;}});
  const image=await a.captureReview(),p=await fixture().prepare(),intent={...p.intent,imageSHA256:image.sha256},h=a.review(intent);
  await assert.rejects(a.start(h,intent,f.dispatch),/cancelled/);assert.equal(f.down,0);
});
test('exclusive synchronous image sink retains full immutable PNG and rejects collision',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcm-context-sink-'));
  try{const f=fixture(),sink=createImageSink(dir),png=PNG.sync.write(f.p);
    assert(sink({stage:'source',png,personallyReviewed:false}));
    assert(fs.readFileSync(path.join(dir,'0001-source.png')).equals(png));
    assert.equal(fs.statSync(path.join(dir,'0001-source.png')).mode&0o777,0o400);
    assert.throws(()=>createImageSink(dir)({stage:'source',png}),/EEXIST/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
