'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const z=require('node:zlib'),crypto=require('node:crypto'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),run=process.env.MENU_FAILURE_RUN;
assert(run&&path.isAbsolute(run),'explicit evidence directory; no browser fixture');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const originalRead=fs.readFileSync;
const read=p=>originalRead(p),json=p=>JSON.parse(z.gunzipSync(read(p)));
const pins=JSON.parse(read(run+'/runtime-pins.json'));
const manifest=json(run+'/composition-pins.json.gz');
const compositionPath='tools/supertux-native-driver-composition.cjs';
const current=read(root+'/'+compositionPath);
manifest.files=manifest.files.map(p=>p.path===compositionPath?{...p,size:current.length,sha256:sha(current)}:p);
// The production canonical resolver uses accepted published blobs in place.
fs.readFileSync=function(p,options){
 const pin=pins.files.find(x=>path.resolve(root,x.path)===path.resolve(String(p)));
 if(pin?.source.kind==='published-git-blob'&&pin.path!==compositionPath){
  const b=cp.execFileSync('git',['show',pin.source.commit+':'+pin.path],{maxBuffer:32*1024*1024});
  return typeof options==='string'?b.toString(options):b;
 }
 return originalRead(p,options);
};
const composition=require('./supertux-native-driver-composition.cjs');
const composed=composition.compose({root,manifest});
fs.readFileSync=originalRead;
const start=composed.source.indexOf('async function execute(c,markDispatch){'),end=composed.source.indexOf('\n(async()=>',start);
assert(start>0&&end>start);
const input=require('../scratch/runs/20261108-supertux-short-step-progression-2236/input.cjs');
const transport=require('../scratch/runs/20261108-supertux-short-step-progression-2236/transport.cjs');
const image=Buffer.from('offline menu fixture; never a native gameplay frame');
const review={label:'menu',sha256:sha(image),identity:{offline:true},review:'Offline stale menu reproduction'};
let effects=0,stale=true;
const cause=Object.assign(Error('stale scene refused'),{code:'STALE_SCENE_BEFORE_DISPATCH'});
const context={root,assert,Date,Number,JSON,Promise,Buffer,deadline:Date.now()+30000,latest:review,out:'/offline',sha,
 fs:{readFileSync:p=>p.endsWith('.png')?image:JSON.stringify(review)},
 require:require('node:module').createRequire(composed.filename),
 chain:{admit:async(r,fn)=>{if(stale)throw cause;return fn({offline:true});}},
 save:()=>{},send:async()=>{effects++;},pageSession:'offline',pulse:input.pulse,wait:async()=>{},capture:async()=>{effects++;}};
const execute=vm.runInNewContext('('+composed.source.slice(start,end)+')',context);
const command={id:'map-down',action:'key',label:'map-down',waitMs:100,keys:['ArrowDown'],holdMs:100,reviewRef:'menu'};
(async()=>{
 const fixture=run+'/menu-failure-fixture-'+process.pid;fs.mkdirSync(fixture);fs.mkdirSync(fixture+'/commands');
 fs.writeFileSync(fixture+'/commands/0.json.gz',z.gzipSync(JSON.stringify(command)),{flag:'wx'});
 await assert.rejects(transport.consume(fixture,0,execute),e=>e.cause===cause&&!e.code&&/native menu action UNKNOWN/.test(e.message));
 assert.equal(effects,0);assert(fs.existsSync(fixture+'/first-failure.json'));
 assert(!fs.existsSync(fixture+'/reply-0.json'),'no success or refresh ACK after first UNKNOWN');
 fs.writeFileSync(fixture+'/commands/1.json.gz',z.gzipSync(JSON.stringify({...command,id:'later'})),{flag:'wx'});
 await assert.rejects(transport.consume(fixture,1,execute),/UNKNOWN\/partial closure/);
 assert.equal(effects,0,'no later input after failed owned menu command');
 stale=false;let marked=0;await execute({...command,id:'normal'},()=>marked++);
 assert.equal(marked,1);assert.equal(effects,3,'normal ArrowDown pair plus fresh capture unchanged');
 assert.equal(input.physical.size,0);
 const generic=Error('identity changed');await assert.rejects(composition.runBoundAction({admit:async()=>{throw generic;}},review,()=>{}),e=>e.cause===generic&&!e.code);
 const report={passed:true,actualComposedExecute:true,actualNumberedConsumer:true,staleMenuEffects:0,firstFailureSticky:true,noSuccessOrRefreshAck:true,laterInputEffects:0,normalKeyPairAndCapture:true,physicalPending:0,noBrowserOrOriginal:true,composedSha256:composed.sha256};
 fs.writeFileSync(run+'/menu-failure-focused.json.gz',z.gzipSync(JSON.stringify(report)),{flag:'wx'});console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
