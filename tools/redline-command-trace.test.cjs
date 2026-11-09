'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const publication=require('./redline-current-publication.cjs');
const source=publication.prebrowserSource(require('./redline-current-startup.cjs').integrate(require('./redline-startup-boundary.cjs').integrate()));
new vm.Script(source);
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const consumer=slice('async function traceSnapshot(','\nfunction close(')+'\n'+slice('async function execute(','\n(async()=>{');
const root=path.resolve(__dirname,'..'),transport=require(root+'/scratch/runs/20261109-redline-distinct-label-training-1235/transport.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function lane(mode){
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'redline-command-trace-'));fs.mkdirSync(out+'/commands');
 fs.writeFileSync(out+'/execution-window.json',JSON.stringify({browserStop:new Date(Date.now()+120000).toISOString()}));
 let release,protocol=0,images=0;
 const held=new Promise(r=>release=r),saved=[];
 const scope={assert,fs,root,out,run:root+'/scratch/runs/20261109-redline-distinct-label-training-1235',require,Date,JSON,
  console:{log(){}},deadline:Date.now()+60000,closing:false,latest:null,fixture:null,pageSession:'page',cdpMousePoint:null,
  workers:new Map([['worker',{targetId:'target',sessionId:'worker',closed:false}]]),
  sha:b=>require('node:crypto').createHash('sha256').update(b).digest('hex'),
  save:(n,v)=>{saved.push(n);fs.writeFileSync(out+'/'+n,JSON.stringify(v));},wait:async()=>{},state:async()=>({}),
  evaluate:async expression=>{
   protocol++;if(expression.includes('__inputConsumption')){if(mode==='held'||mode==='terminal')return held;return {rows:['actual simulated observer']};}
   if(expression.includes('events:globalThis.__nativeMouseEvents'))return {events:[],locked:false};
   return false;
  },
  chain:{capture:async label=>{images++;if(mode==='late')await held;if(mode==='refusal')throw Error('required capture identity refusal');const png=Buffer.from(label);return {capture:{label,sha256:scope.sha(png)},png,before:{},after:{}};}}
 };
 const originalTrace=fs.readFileSync(__dirname+'/redline-browser-run.cjs','utf8').split('\n').find(l=>l.startsWith('async function traceSnapshot('));
 const actual=mode==='legacy-held'?consumer.replace(consumer.slice(0,consumer.indexOf('\nasync function capture(')),originalTrace):consumer;
 if(mode==='legacy-held')scope.evaluate=async expression=>{protocol++;if(expression.includes('__inputConsumption'))return held;if(expression.includes('events:globalThis.__nativeMouseEvents'))return {events:[],locked:false};return false;};
 vm.createContext(scope);vm.runInContext(actual,scope);
 const c={id:'capture',action:'capture',waitMs:0,label:'image'};
 c.timing=transport.budget(out,c);c.timing.workEnd=Date.now()+(mode==='success'?2000:250);c.timing.ackEnd=c.timing.workEnd+2000;
 fs.writeFileSync(out+'/commands/0.json',JSON.stringify(c));
 try{
  const execution=transport.consume(out,0,scope.execute);
  if(mode==='terminal'){await delay(20);scope.closing=true;release({rows:['late']});}
  if(['success','held'].includes(mode)){
   await execution;assert(fs.existsSync(out+'/reply-0.json'));assert.equal(scope.latest.label,'image');
   const trace=JSON.parse(fs.readFileSync(out+'/image-trace-service.json'));
   assert.equal(trace.complete,mode==='success');
   if(mode==='held'){
    assert.equal(trace.workers[0].status,'bounded-wait-incomplete');
    const before=protocol;await scope.traceSnapshot('second',Date.now()+1000);assert.equal(protocol,before,'no duplicate read to held worker');
    scope.closing=true;const count=saved.length;release({rows:['late']});await delay(10);assert.equal(saved.length,count,'late trace cannot publish');
    await assert.rejects(scope.traceSnapshot('terminal',Date.now()+1000),/terminal/);assert.equal(protocol,before);
   }
  }else{
   await assert.rejects(execution,/deadline|refusal|terminal/);scope.closing=true;
   const before=protocol;release({rows:['late']});await delay(10);
   assert(!fs.existsSync(out+'/reply-0.json'));
   if(mode==='late')assert(!fs.existsSync(out+'/image.png'),'late image never published');
   fs.writeFileSync(out+'/commands/1.json',JSON.stringify({...c,id:'later'}));
   await assert.rejects(transport.consume(out,1,scope.execute),/sticky/);assert.equal(protocol,before);assert.equal(images,1);
  }
 }finally{scope.closing=true;release();fs.rmSync(out,{recursive:true,force:true});}
}
(async()=>{
 for(const mode of ['legacy-held','success','held','late','refusal','terminal'])await lane(mode);
 console.log('PASS actual generated execute/capture/trace + deployed transport: held diagnostic bounded; complete image ACK; late image/refusal/terminal no ACK, sticky no later protocol, late trace no publication');
})().catch(e=>{console.error(e);process.exitCode=1;});
