'use strict';
// Independent, deliberately limited source-form evaluator. No compiler, Wasm,
// x86, guest, module bytes, or native fixture is executed here.
const fs=require('node:fs'),assert=require('node:assert/strict');
const D='/home/user/wine-assembly-shadow-man-zero-transfer-provenance-oct23';
function parse(s){const t=s.replace(/;;[^\n]*/g,'').match(/"(?:\\.|[^"\\])*"|[()]|[^\s()]+/g);let i=0;function one(){const a=t[i++];if(a!=='(')return a;const x=[];while(t[i]!==')'){assert.ok(i<t.length);x.push(one());}i++;return x;}const out=[];while(i<t.length)out.push(one());return out;}
const exportsTree=parse(fs.readFileSync(D+'/src/13-exports.wat','utf8'));
const dispatchTree=parse(fs.readFileSync(D+'/src/09b-dispatch.wat','utf8'));
const all=[...exportsTree,...dispatchTree];
const fn=n=>all.find(x=>x[0]==='func'&&x[1]===n);
const walk=(x,p)=>Array.isArray(x)&&(p(x)?x:x.map(y=>walk(y,p)).find(Boolean));
const run=fn('$run'),loop=walk(run,x=>x[0]==='loop'&&x[1]==='$main');
const isClear=x=>x[0]==='global.set'&&['$null_transfer_kind','$null_transfer_thunk_entry'].includes(x[1]);
const entry=run.filter(isClear),desk=loop.slice(2,5);
assert.equal(entry.length,2);assert.equal(desk[0][0],'if');assert.ok(isClear(desk[1])&&isClear(desk[2]));
const thunk=walk(run,x=>x[0]==='if'&&x[1]?.[0]==='thunk-contains');
const caca=walk(fn('$win32_dispatch_inner'),x=>x[0]==='if'&&JSON.stringify(x[1])==='["i32.eq",["local.get","$name_rva"],["i32.const","0xCACA0005"]]');
const drain=walk(fn('$win32_dispatch'),x=>x[0]==='if'&&JSON.stringify(x[1]).includes('$dll_drain_pending'));
class Ret{} class Halt{} class Main{}
function machine({noEntryClear=false,noIterationClear=false,noInlineGate=false}={}){
 const g=new Map(),mem=new Map([[0x110,0x74fff50],[0x200,0x1001c],[0x204,1]]),events=[];
 for(const x of exportsTree)if(x[0]==='global'&&String(x[1]).startsWith('$null_'))g.set(x[1],x.at(-1)[0]==='i64.const'?0n:0);
 Object.entries({eip:0x7500218,reg_base:0x100,ip:0x1234,sync_msg_depth:1,token:13n,invocation_root:2n,dlg_pump_hwnd:0x1001c,dlg_ret_addr:0x4015d4,dlg_ended:1,SHARED_DLG_PUMP_HWND:0x200,SHARED_DLG_ENDED:0x204,sync_msg_ret_thunk:0x7500218,dlg_loop_thunk:0x7500208,current_thunk_eip:0x7500218,thunk_guest_base:0x7500000,handler_set_eip:0}).forEach(([k,v])=>g.set('$'+k,v));
 const get=n=>{assert.ok(g.has(n),n);return g.get(n);};
 function invoke(name,values){
  if(name==='$invocation_current')return get('$token');
  if(name==='$null_diag_event'){events.push({kind:values[0],writer:get('$null_transfer_kind')});return;}
  if(name==='$win32_dispatch'){try{ev(caca,new Map([['$name_rva',0xcaca0005]]));}catch(e){if(!(e instanceof Ret))throw e;}return;}
  const f=fn(name);assert.ok(f,name);let k=0;const locals=new Map();
  for(const x of f.slice(2))if(x[0]==='param')locals.set(x[1],values[k++]);
  try{for(const x of f.slice(2))if(!['param','local','result'].includes(x[0])){
   if(noInlineGate&&name==='$null_transfer_record'&&JSON.stringify(x).includes('$null_transfer_thunk_entry'))continue;
   ev(x,locals);
  }}catch(e){if(!(e instanceof Ret))throw e;}
 }
 function ev(x,l=new Map()){
  const [op,...a]=x,V=y=>ev(y,l);
  if(op==='i32.const')return Number(a[0])>>>0;
  if(op==='global.get')return get(a[0]);
  if(op==='global.set'){g.set(a[0],V(a[1]));return;}
  if(op==='local.get'){assert.ok(l.has(a[0]),a[0]);return l.get(a[0]);}
  if(op==='local.set'){l.set(a[0],V(a[1]));return;}
  if(op==='i32.load'){const off=typeof a[0]==='string'?Number(a.shift().split('=')[1]):0;const address=(V(a[0])+off)>>>0;assert.ok(mem.has(address),'no fabricated read '+address);return mem.get(address);}
  if(op==='if'){const b=x.find(y=>Array.isArray(y)&&y[0]===(V(a[0])?'then':'else'));if(b)for(const s of b.slice(1))V(s);return;}
  if(op==='return')throw new Ret();
  if(op==='br'){if(a[0]==='$halt')throw new Halt();if(a[0]==='$main')throw new Main();throw Error(a[0]);}
  if(op==='call')return invoke(a[0],a.slice(1).map(V));
  if(op==='thunk-contains')return 1; // probe enters only known selected thunk
  const [u,v]=a.map(V);
  if(op==='i32.eqz')return Number(u===0);
  if(op==='i32.eq')return Number(u===v);
  if(op==='i32.ne'||op==='i64.ne')return Number(u!==v);
  if(op==='i32.and')return (u&v)>>>0;
  if(op==='i32.sub')return (u-v)>>>0;
  if(op==='i32.div_u')return Math.floor(u/v)>>>0;
  throw Error('unmodeled '+op);
 }
 function iteration(){try{for(const x of desk){if(noIterationClear&&isClear(x))continue;ev(x);}}catch(e){if(!(e instanceof Halt))throw e;return true;}return false;}
 return {g,mem,events,invoke,ev,entry(){if(!noEntryClear)for(const x of entry)ev(x);},iteration,thunk(){try{ev(thunk);}catch(e){if(!(e instanceof Main))throw e;}},inline(){g.set('$null_transfer_thunk_entry',0);g.set('$eip',0x7500218);invoke('$win32_dispatch',[]);},drain(){ev(drain[2][1]);}};
}
function setup(opts){const m=machine(opts);m.g.set('$null_transfer_on',1);m.entry();return m;}
function seed(m){assert.equal(m.iteration(),false);m.thunk();assert.equal(m.g.get('$null_transfer_kind'),1);assert.equal(m.g.get('$null_transfer_thunk_entry'),0);}
function expectUnknown(m){assert.equal(m.iteration(),true);assert.equal(m.events.at(-1).writer,0,'false writer inherited');}
function staleRun(opts){const m=setup(opts);seed(m);m.entry();expectUnknown(m);}
function staleIteration(opts){const m=setup(opts);seed(m);m.g.set('$eip',0x401000);assert.equal(m.iteration(),false);m.g.set('$eip',0);expectUnknown(m);}
function inline(opts){const m=setup(opts);m.inline();expectUnknown(m);}
let passed=0;function test(n,f){f();passed++;console.log('PASS '+n);}
test('actual explicit thunk route preserves immediate CACA writer into zero desk',()=>{const m=setup();seed(m);assert.equal(m.iteration(),true);assert.deepEqual(m.events,[{kind:5,writer:1}]);});
test('fresh/reentrant run entry cannot donate preceding writer',()=>staleRun());
test('nonzero loop iteration cannot donate preceding writer',()=>staleIteration());
test('inline dispatch with even matching EIP remains unknown',()=>inline());
test('deferred unload invalidates immediate record',()=>{const m=setup();seed(m);m.drain();expectUnknown(m);});
test('token/root/depth/count/ESP mismatch cannot name a writer',()=>{for(const k of ['$token','$invocation_root','$sync_msg_depth','$null_diag_count','esp']){const m=setup();seed(m);if(k==='esp')m.mem.set(0x110,0x74fff54);else m.g.set(k,m.g.get(k)+(typeof m.g.get(k)==='bigint'?1n:1));expectUnknown(m);}});
test('negative controls reject removed run/iteration invalidation and inline gate',()=>{assert.throws(()=>staleRun({noEntryClear:true}),/false writer/);assert.throws(()=>staleIteration({noIterationClear:true}),/false writer/);assert.throws(()=>inline({noInlineGate:true}),/false writer/);});
console.log(JSON.stringify({passed,scope:'independent source-form lifecycle probe; NO native execution',unmodeled:'run service prefix, wrapper resource helpers, thunk metadata read, native engine'}));
