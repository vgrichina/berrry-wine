'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), Module = require('node:module');
const zlib = require('node:zlib');
const {execFileSync} = require('node:child_process');
const readiness = require('../tools/mdk2-title-menu-readiness.cjs');
const root = path.resolve(__dirname, '..');
const prior = path.join(root, 'scratch/runs/20261104-mdk2-adequate-lifetime-menu/native-menu.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const value = (tag, value) => ({tag, value});
// Protocol fixtures, never original-game execution or capture classifications.
function main() {
  return {running:true, frozen:{frozen:true, hosts:1, steps:3072}, inputQueue:[],
    activeInput:null, mouseButtonsMask:0, observation:{inputs:[], events:[{kind:'instantiated',
      sha256:'cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee'}]},
    nativeSelection:{available:true, state:0x8400000, level:0x8410000,
      file:value(-2,'startscreen'), conscheme:value(-2,'title'), newconscheme:value(-6,null),
      freeze:value(-1,1), showmenu:value(-1,0), current:value(-2,'lang'),
      command:{binding:28,secondary:-1,flags:2,rise:2,raw:0,previous:0,active:0},
      opening:{version:'mdk2-title-opening-v1', cancelFunction:value(-4,0x8420000),
        buttonTimerFunction:value(-4,0x8430000), titleCancelHandler:value(-4,0x8440000),
        mumbotime:value(-6,null), cancel:{index:84,entry:6497452,binding:1,secondary:-1,
          flags:4,fall:4,previous:0,raw:0,active:0},inputList:{count:0,entries:[]}}}};
}
const down = {type:'keydown',key:'Escape',trusted:true,target:'screen'};
const up = {...down,type:'keyup'};
function positive() {
  const m = main();m.frozen.steps+=32;m.observation.inputs=[down];
  Object.assign(m.nativeSelection.opening.cancel,{raw:1,previous:1,active:1});
  m.nativeSelection.opening.inputList={count:1,entries:[{binding:1,value:1,extra:0}]};
  return m;
}
test('native positive consumption precedes release; no callback or freeze inference', () => {
  const a=main(),b=positive(),saved=JSON.stringify([a,b]);
  assert.equal(readiness.pressed(a,b,[down]),true);
  assert.equal(b.nativeSelection.freeze.value,1);
  assert.equal(JSON.stringify([a,b]),saved);
  const early=main();early.observation.inputs=[down];early.frozen.steps+=16;
  early.inputQueue=[{msg:256,wParam:27},{msg:258,wParam:27}];
  assert.equal(readiness.pressed(a,early,[down]),false);
  early.inputQueue=[];assert.equal(readiness.pressed(a,early,[down]),false,'draining alone is insufficient');
  const rest=main();rest.frozen.steps+=64;rest.observation.inputs=[down,up];
  assert.equal(readiness.released(a,rest,[down,up]),true);
  rest.inputQueue=[{msg:257,wParam:27}];assert.equal(readiness.released(a,rest,[down,up]),false);
});
const captured=path.join(root,'scratch/runs/20261104-mdk2-main-construction-observation');
test('sealed original Escape positive sample forbids release despite successful step16 ACK',
  {skip:!fs.existsSync(path.join(captured,'remote-recovery-inventory.json')) &&
    !fs.existsSync(path.join(captured,'remote-recovery-inventory.json.gz'))},()=>{
    const bytes=p=>fs.existsSync(p)?fs.readFileSync(p):zlib.gunzipSync(fs.readFileSync(p+'.gz'));
    const inventory=JSON.parse(bytes(path.join(captured,'remote-recovery-inventory.json')));
    function sealed(name){
      const rel='browser/'+name+'.json',b=bytes(path.join(captured,'recovered',rel));
      const pin=inventory.find(x=>x.path===rel);assert(pin);assert.equal(b.length,pin.bytes);
      assert.equal(sha(b),pin.sha256);return JSON.parse(b);
    }
    const a=sealed('native-selector-55-before').main,b=sealed('native-selector-55-escape-positive').main;
    assert.equal(b.frozen.steps-a.frozen.steps,16);
    assert.deepEqual(b.inputQueue.map(x=>[x.msg,x.wParam]),[[256,27],[258,27]]);
    assert.equal(b.nativeSelection.opening.cancel.raw,0);
    assert.equal(readiness.pressed(a,b,b.observation.inputs),false);
    const step=sealed('step-58');assert.equal(step.ran,step.requested);assert.equal(step.ran,16);
  });
for(const fault of ['file','scheme','pending','menu','host','Lua','level','entry','handler','events'])
  test('reject false title or changed owning sample: '+fault,()=>{
    const a=main(),b=positive(),n=b.nativeSelection;
    if(fault==='file')n.file=value(-2,'l1');
    if(fault==='scheme')n.conscheme=value(-2,'menu');
    if(fault==='pending')n.newconscheme=value(-2,'title');
    if(fault==='menu')n.showmenu=value(-1,1);
    if(fault==='host')b.frozen.hosts=2;
    if(fault==='Lua')n.state++;
    if(fault==='level')n.level++;
    if(fault==='entry')n.opening.cancel.entry++;
    if(fault==='handler')n.opening.titleCancelHandler.value++;
    if(fault==='events')b.observation.inputs.push(up);
    assert.throws(()=>readiness.pressed(a,b,[down]));
  });
for(const fault of ['raw','previous','list','extra','binding','queued','active'])
  test('withhold release without exact positive sample: '+fault,()=>{
    const a=main(),b=positive(),o=b.nativeSelection.opening;
    if(fault==='raw')o.cancel.raw=0;
    if(fault==='previous')o.cancel.previous=0;
    if(fault==='list')o.inputList={count:0,entries:[]};
    if(fault==='extra')o.inputList.entries[0].extra=1;
    if(fault==='binding')o.inputList.entries[0].binding=28;
    if(fault==='queued')b.inputQueue=[{msg:256,wParam:27}];
    if(fault==='active')b.activeInput={msg:256};
    assert.equal(readiness.pressed(a,b,[down]),false);
  });

// Execute the exact select implementation with an inert command peer. This
// proves helper ordering/caps, separately from the real Worker input test below.
function loadSelector(repaired) {
  const source=fs.readFileSync(prior,'utf8');
  const m=new Module(prior,module);m.filename=prior;m.paths=Module._nodeModulePaths(path.dirname(prior));
  m._compile(repaired?readiness.repairSource(source):source,prior);return m.exports;
}
async function protocol(repaired,{never=false,falseTitle=false,lateRest=false,failedAck=false,deadline=false,stale=false}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mdk2-readiness-'));
  const write=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v));
  const m=main(),sent=[];let presses=0,releases=0,held=false,steps=0;
  if(falseTitle)m.nativeSelection.file=value(-2,'l1');
  const pixels=Buffer.from('inert protocol fixture; no visual inspection');
  const review={capture:'fixture',sha256:sha(pixels),steps:3072,personallyInspected:true,
    inspector:'unit fixture',screen:'title',selection:'none',transitioning:false,
    legalOverlayVisible:true,controllerIconVisible:false};
  fs.mkdirSync(path.join(dir,'commands'));write('identity.json',{commit:'1329b1ba6eb00144ff77d4cd92a8513d4fc953ad'});
  write('selector.json',{app:'mdk2_demo',renderer:'webgl',isolated:true});
  write('fixture.json',{sha256:review.sha256,state:{main:m}});fs.writeFileSync(path.join(dir,'fixture.png'),pixels);
  write('commands/0.json',{action:'shot',name:'fixture'});
  if(stale)write('commands/0.json',{action:'state',name:'old'});
  let next=1;
  const spool={end:deadline?0:Infinity,commands:()=>[0],async send(c){
    assert(Date.now()<this.end,'selector/recovery reserve deadline');
    const i=next++;sent.push({...c});
    if(failedAck&&c.action==='step')throw Error('failed command ACK');
    if(c.action==='keydown'){held=true;m.observation.inputs.push(down);write(`input-${i}.json`,{main:m});}
    if(c.action==='keyup'){held=false;releases++;m.observation.inputs.push(up);write(`input-${i}.json`,{main:m});}
    if(c.action==='step'){
      steps+=c.n;m.frozen.steps+=c.n;
      if(held){
        presses++;
        if(!never&&presses>=2){const p=positive();m.nativeSelection=p.nativeSelection;m.inputQueue=[];}
        else m.inputQueue=[{msg:256,wParam:27},{msg:258,wParam:27}];
      }else{
        if(lateRest&&releases++===1)m.inputQueue=[{msg:257,wParam:27}];
        else{m.inputQueue=[];Object.assign(m.nativeSelection.opening.cancel,{raw:0,previous:0,active:0});}
      }
    }
    if(c.action==='tick')write(`tick-${i}.json`,{tickMs:c.ms});
    if(c.action==='state')write(c.name+'.json',{main:m});
    if(c.action==='shot'){write(c.name+'.json',{sha256:review.sha256,state:{main:m}});fs.writeFileSync(path.join(dir,c.name+'.png'),pixels);}
    return {i,ack:{i,ok:true}};
  }};
  let error,result;
  try{result=await loadSelector(repaired).select(dir,review,'open',{spool,maxCommands:113});}
  catch(e){error=String(e);}
  const ledger=fs.existsSync(path.join(dir,'native-selector-ledger.json'))?JSON.parse(fs.readFileSync(path.join(dir,'native-selector-ledger.json'))):null;
  const latched=fs.existsSync(path.join(dir,'native-selector-first-error.json'));
  fs.rmSync(dir,{recursive:true,force:true});
  return {sent,steps,error,result,ledger,latched};
}
test('exact original helper releases prematurely; repaired helper waits for second native poll',
  {skip:!fs.existsSync(prior)},async()=>{
    const old=await protocol(false),fixed=await protocol(true,{lateRest:true});
    assert(!old.error,old.error);assert(!fixed.error,fixed.error);
    assert.equal(old.sent.filter(c=>c.action==='step').findIndex(c=>c.n===32),1);
    const release=fixed.sent.findIndex(c=>c.action==='keyup');
    assert.equal(fixed.sent.slice(0,release).filter(c=>c.action==='step').length,2);
    assert.equal(fixed.sent.filter(c=>c.action==='keyup').length,1);
    assert.equal(fixed.steps,80);assert.equal(fixed.ledger.commandLimit,113);
    assert.equal(fixed.result.status,'STOP: inspect new pixels before any further selection');
  });
test('original scheme-only gate admits false title; repair rejects it before commands',
  {skip:!fs.existsSync(prior)},async()=>{
    const old=await protocol(false,{falseTitle:true}),fixed=await protocol(true,{falseTitle:true});
    assert(!old.error,old.error);assert(old.sent.some(c=>c.action==='keydown'));
    assert.match(fixed.error,/original title required: file/);assert.equal(fixed.sent.length,0);
    assert.throws(()=>readiness.repairSource(fs.readFileSync(prior,'utf8')+'\n'),/unexpected original/);
  });
for(const fault of ['never','falseTitle','failedAck','deadline','stale'])
  test('actual repaired select contains '+fault,{skip:!fs.existsSync(prior)},async()=>{
    const r=await protocol(true,{[fault]:true});assert(r.error);assert(r.latched);
    assert.equal(r.sent.filter(c=>c.action==='keyup').length,0);
    assert(r.steps<=512);assert(!r.ledger||r.ledger.commands<=113);
    if(fault==='falseTitle'||fault==='stale')assert.equal(r.sent.length,0);
  });

test('same real OS Worker: ordinary production DirectInput state distinguishes early tap from held input',()=>{
  const challenge=String.raw`
  (async()=>{
    const {Worker,threadId}=require('worker_threads'),RPC=require('../lib/guest-rpc');
    const sigs=require('../lib/host-import-sigs.generated.json').sigs;
    const selected=Object.fromEntries(WebAssembly.Module.imports(module_).filter(x=>x.kind==='function').map(x=>[x.name,sigs[x.name]]));
    const broker=RPC.createMainBroker(memory,imports.host,selected,{});
    const worker=new Worker(\`
      const {parentPort,workerData,threadId}=require('worker_threads');
      const RPC=require(workerData.rpc);
      const rpc=RPC.createWorkerImports(workerData.memory,workerData.selected,m=>parentPort.postMessage({rpc:m}),{slot:1});
      const e=new WebAssembly.Instance(workerData.module,{host:{memory:workerData.memory,...rpc.imports.host}}).exports;
      parentPort.on('message',()=>{
        const d=new DataView(workerData.memory.buffer);d.setUint32(e.reg()+16,0x30000,true);
        e.getState(workerData.obj,256,workerData.buf);
        parentPort.postMessage({hr:d.getUint32(e.reg(),true),key:d.getUint8(e.g2w(workerData.buf)+1),threadId});
      });parentPort.postMessage({ready:threadId});
    \`,{eval:true,workerData:{rpc:path.join(ROOT,'lib/guest-rpc.js'),memory,selected,module:module_,obj,buf}});
    let resolve,reject,identity;const next=()=>new Promise((a,b)=>{resolve=a;reject=b;});
    const ready=next();worker.on('error',e=>reject(e));worker.on('message',m=>{
      if(m.rpc){assert(broker.serveRpc(m.rpc.slot));return;}resolve(m);
    });
    const timer=setTimeout(()=>{reject(Error('Worker deadline'));worker.terminate();},15000);
    try{
      identity=(await ready).ready;assert.notEqual(identity,threadId);
      async function sample(){const p=next();worker.postMessage('poll');const r=await p;assert.equal(r.hr,0);assert.equal(r.threadId,identity);return r.key;}
      function key(down){renderer[down?'handleKeyDown':'handleKeyUp'](27);while(renderer.checkInput()){};broker.publish({});}
      key(true);key(false);assert.equal(await sample(),0,'balanced early input is no positive state sample');
      key(true);assert.equal(await sample(),128,'hold through native state polling');
      assert.equal(await sample(),128,'same held state and same Worker');
      key(false);assert.equal(await sample(),0,'ordinary release');
      console.log('PASS same Worker '+identity+' early tap0 held128 held128 release0; production renderer/host/RPC/WAT, fixture object only');
    }finally{clearTimeout(timer);await worker.terminate();}
  })().catch(e=>{console.error(e.stack);process.exitCode=1});`;
  // The existing pinned runner extracts production WAT forms; it does not run a game.
  const code="require('./test/helpers/directinput-independent-accept-oct27')("+JSON.stringify(challenge.replaceAll('\\`','`'))+")";
  const output=execFileSync(process.execPath,['-e',code],{cwd:root,timeout:30000,encoding:'utf8',maxBuffer:4*1024*1024});
  assert.match(output,/PASS same Worker/);console.log(output.trim());
});
