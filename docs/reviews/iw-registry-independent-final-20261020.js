'use strict';
// Independent review; exact Git sources and compiled slices, never a full VM.
const fs=require('fs'),cp=require('child_process'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const repo=path.resolve(process.argv[2]||'.');
const candidate='ecf1850383c4c155aae0650de3ef5ab8b8661326',baseline='ac72debe7522d4d57034627712b8ec000f8e1d92',prior='a56f9b6014a939fdf08c22e9dfd877f734e6d9fb';
const object=(rev,file)=>cp.execFileSync('git',['show',rev+':'+file],{cwd:repo,encoding:'utf8',maxBuffer:16e6,stdio:['ignore','pipe','pipe']});
function exactRequire(rev){
 const rel=p=>typeof p==='string'?path.relative(repo,p):'..';
 const inside=p=>!rel(p).startsWith('..')&&!path.isAbsolute(rel(p));
 const vfs={...fs,readFileSync(p,opt){if(!inside(p))return fs.readFileSync(p,opt);const t=object(rev,rel(p));return typeof opt==='string'||opt?.encoding?t:Buffer.from(t);},existsSync(p){if(!inside(p))return fs.existsSync(p);return cp.spawnSync('git',['cat-file','-e',rev+':'+rel(p)],{cwd:repo,stdio:'ignore'}).status===0;},writeFileSync(){throw Error('Fixture writes forbidden');}};
 return n=>n==='fs'?vfs:require(n);
}
function independentFinal(){
 const checks=[],failures=[];
 const check=(label,body)=>{try{body();checks.push({label,pass:true});}catch(e){checks.push({label,pass:false,error:e.message});failures.push(label);}};
 check('unpublished foreign UTF16 class and ANSI title use owner memory without writes',()=>{
  registryHostModule=null;const a=fixture('registry'),b=fixture('registry');a.ctx.renderer=b.ctx.renderer;
  b.add(1201,'窓Ω😀',0,false,1);b.row(1201).title=b.put('Café');
  const cls=a.put('窓Ω😀',true),title=a.put('Café',true),before=Buffer.from(b.ctx.getMemory());
  assert.equal(a.ex.find(0,0,cls,title,1),1201);
  assert.deepEqual(Buffer.from(b.ctx.getMemory()),before);
  assert.equal(a.ex.find(0,0,a.put('窓Ψ😀',true),title,1),0);
 });
 check('caller application atoms resolve names despite different owner atom slots',()=>{
  registryHostModule=null;const a=fixture('registry'),b=fixture('registry');a.ctx.renderer=b.ctx.renderer;
  a.register('CallerFiller');const ac=a.register('SharedClass',1);const bc=b.add(1210,'SharedClass',0,false,1);
  assert.notEqual(ac.atom,bc.atom);assert.equal(a.ex.find(0,0,ac.atom,0,0),1210);assert.equal(a.ex.find(0,0,ac.atom,0,1),1210);
 });
 check('registry excludes a different renderer and observes late desktop assignment',()=>{
  registryHostModule=null;const a=fixture('registry'),b=fixture('registry');b.add(1220,'Private',0,false);
  assert.equal(a.ex.find(0,0,a.put('Private'),0,0),0);a.ctx.renderer=b.ctx.renderer;
  assert.equal(a.ex.find(0,0,a.put('Private'),0,0),1220);
 });
 check('foreign native subtree enumeration and strict after agree for three callers',()=>{
  registryHostModule=null;const a=fixture('registry'),b=fixture('registry'),c=fixture('registry');a.ctx.renderer=b.ctx.renderer;c.ctx.renderer=b.ctx.renderer;
  b.add(1230,'HiddenRoot',0,false);const one=b.ex.child(1230,2,1,0,0,10,10,0,0),two=b.ex.child(1230,1,2,0,0,10,10,0,0);
  for(const f of [a,b,c]){assert.equal(f.ex.find(1230,0,0,0,0),two);assert.equal(f.ex.find(1230,two,0,0,0),one);assert.equal(f.ex.find(1230,one,0,0,0),0);assert.equal(f.ex.find(0,one,0,0,0),0);}
 });
 check('generation updates only allocation and preserves adjacent owner bytes',()=>{
  const f=lifetimeFixture(),e=f.ex;e.wnd_table_set(1240,1);e.wnd_table_set(1241,2);
  const first=e.wnd_lookup_generation(1240),neighbor=e.wnd_lookup_generation(1241);assert(first>0n);assert.notEqual(first,neighbor);
  e.wnd_table_set(1240,3);assert.equal(e.wnd_lookup_generation(1240),first);e.wnd_lookup_retire(1240);assert.equal(e.wnd_lookup_generation(1240),first);
  e.wnd_table_remove(1240);assert.equal(e.wnd_lookup_generation(1240),0n);e.wnd_table_set(1242,4);
  assert.notEqual(e.wnd_lookup_generation(1242),first);assert.equal(e.wnd_lookup_generation(1241),neighbor);assert.equal(e.wnd_lookup_live(1241),1);
 });
 check('unqueried remove, different HWND reuse, original HWND reuse, fresh publication',()=>{
  const f=fixture();let life=lifetimeFixture(false,(...args)=>f.host.set_window_class(...args));f.add(1250,'Old');life.ex.wnd_table_set(1250,1);f.ctx.exports=life.ex;
  Object.assign(f.ctx.renderer.windows[1250],{wasm:{exports:life.ex},wasmMemory:life.memory});
  life.ex.wnd_table_remove(1250);life.ex.wnd_table_set(1251,2);life.ex.wnd_table_set(1250,3);
  assert.equal(f.ex.find(0,0,f.put('Old'),0,0),0);f.host.set_window_class(1250,f.put('New'));
  assert.equal(f.ex.find(0,0,f.put('New'),0,0),1250);assert.equal(f.ex.find(0,0,f.put('Old'),0,0),0);
 });
 check('equal HWND foreign owner memory remains byte-identical after caller removal',()=>{
  const a=fixture(),b=fixture();a.add(1260,'Caller');b.add(1260,'Foreign');a.ctx.renderer.windows[1260]=b.ctx.renderer.windows[1260];
  const life=lifetimeFixture(false,(...args)=>a.host.set_window_class(...args));life.ex.wnd_table_set(1260,1);a.ctx.exports=life.ex;
  const before=Buffer.from(b.ctx.getMemory());life.ex.wnd_table_remove(1260);assert.deepEqual(Buffer.from(b.ctx.getMemory()),before);assert.equal(a.ex.find(0,0,a.put('Foreign'),0,0),1260);
 });
 return {checks,failures};
}
let submitted=object(candidate,'docs/reviews/iw-owner-registry-lifetime-fix-20261020.js');
assert(submitted.includes('independent +'));
submitted=submitted.replace('independent +', 'independent + '+JSON.stringify(String.fromCharCode(10)+independentFinal.toString())+' +');
submitted=submitted.replace('return accepted;', 'accepted.finalReview=independentFinal(); return accepted;');
const repaired=new Function('require','process',submitted+'\nreturn output;')(exactRequire(candidate),{...process,argv:['node','replay',repo]});
const oldText=object(prior,'docs/reviews/iw-lifecycle-repair-acceptance-20261020.js');
const old=new Function('require','process',oldText+'\nreturn output;')(exactRequire(baseline),{...process,argv:['node','baseline',repo]});
assert.equal(old.defects.length,6);assert.equal(repaired.defects.length,6);assert(repaired.defects.every(x=>x.corrected));
const out={candidate,baseline,repaired,baselineReplay:old,verdict:repaired.finalReview.failures.length?'REJECT':'ACCEPT_SOURCE_SLICES',limits:'Source and compiled-slice qualification only. Controlled table/allocator/callback boundaries. No fullVM, Worker RPC, CLI IPC, browser, game or concurrent lifecycle qualification.'};
if(process.argv[3]&&!process.argv[3].startsWith('--')){const s=fs.statfsSync(repo),available=s.bavail*s.bsize,required=2277507072;console.log(JSON.stringify({available,required}));if(available<required)process.exit(42);out.writeGate={available,required};fs.writeFileSync(process.argv[3],JSON.stringify(out,null,2)+'\n');}
console.log(JSON.stringify({verdict:out.verdict,finalReview:repaired.finalReview,baselineDefects:old.defects.length}));
if(process.argv.includes('--accept'))assert.equal(out.verdict,'ACCEPT_SOURCE_SLICES');
