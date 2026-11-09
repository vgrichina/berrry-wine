'use strict';
// Exercise real preparation, gate and Python observer together, without Chrome.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=path.resolve(process.argv[2]);
assert(base.startsWith(root+'/scratch/runs/')&&!fs.existsSync(base));fs.mkdirSync(base,{recursive:true});
cp.execFileSync('python3',['-B','tools/q3-native-phase-inputs.py',base],{cwd:root});
const inputs=['control.py','phase-input.py','physical_gate.py','cancellation_gate.py'].map(n=>path.relative(root,path.join(base,n)));
const seal=require('./q3-current-module.cjs').prepare(base+'/prepared',{inputs,caller:inputs[1],foreignClosureVersion:'q3-current-foreign-a16fc87d4-44fc9a134-v1',checkpointObserverVersion:'q3-checkpoint-b993419a5-v1',nativeLifecycleVersion:'q3-native-lifecycle-foreign-v1'});
const original=JSON.parse(JSON.stringify(seal));
process.env.Q3_INPUT_SERVICE_REVIEW='1';
for(const plan of Object.values(seal.phaseLayout)){
 const consumer=require('./q3-current-foreign-closure-v1.cjs').composition('q3-current-foreign-a16fc87d4-44fc9a134-v1',base+'/prepared',path.join(root,plan.output)).compose({root});
 assert(consumer.source.includes('out='+JSON.stringify(path.join(root,plan.output))),'actual generated consumer output');
 assert(consumer.source.includes("tools/q3-input-phase-service.cjs"),'actual consumer review gate');
}

const {run}=require('./q3-input-phase-service.cjs');
const python=(prepared,mode,review)=>cp.spawnSync('python3',['-B','-c',`import runpy,time,json,sys
m=runpy.run_path('tools/q3-phase-observer.py')
if sys.argv[2]=='observe':v=m['observe'](sys.argv[1],sys.argv[3],'cancellation',time.monotonic()+.05)
else:v=m['publish_review'](sys.argv[1],sys.argv[3],'cancellation',json.loads(sys.argv[4]))
print(json.dumps(v))`,root,mode,prepared,JSON.stringify(review??{})],{cwd:root,encoding:'utf8'});
(async()=>{
 for(const mode of ['positive','wrong-sha','wrong-identity','ambiguous','terminal','wrong-image']){
  const trial=base+'/'+mode;fs.mkdirSync(trial);const prepared=trial+'/prepared',phase=trial+'/cancellation/prepared',out=phase+'/runtime';fs.mkdirSync(out,{recursive:true});fs.mkdirSync(prepared);
  // Relocate sealed generated layout, preserving its actual relative structure.
  const pins={phaseLayout:Object.fromEntries(Object.entries(original.phaseLayout).map(([phase,p])=>[phase,Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v.replace(path.relative(root,base),path.relative(root,trial))]))]))};
  const raw=Buffer.from(JSON.stringify(pins)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  fs.writeFileSync(prepared+'/runtime-pins.json.gz',require('node:zlib').gzipSync(raw));fs.writeFileSync(prepared+'/replacement-pinset-seal.json',JSON.stringify({phaseLayout:pins.phaseLayout,manifestSHA256:sha(raw)}));
  process.env.Q3_INPUT_SERVICE_REVIEW='1';process.env.Q3_EXECUTION_BOUNDARY_OUT=phase+'/execution-boundary.jsonl.gz';
  let input=0,polled=0;const png=Buffer.from('offline captured fixture'),capture={label:'fixture-startup',sha256:sha(png),identity:{worker:'fixture-worker',module:'fixture-module'}};
  const options={out,capture:async label=>{fs.writeFileSync(out+'/'+label+'.png',png);fs.writeFileSync(out+'/'+label+'-capture.json',JSON.stringify(capture));},wait:async()=>{
   assert.equal(input,0);assert(!fs.existsSync(phase+'/input-service-arm.json'));assert.equal(polled++,0);
   if(mode==='terminal')fs.writeFileSync(out+'/first-browser-failure.json','{}');
   if(mode==='wrong-image')fs.appendFileSync(out+'/fixture-startup.png','changed');
   const seen=python(prepared,'observe');
   if(['terminal','wrong-image'].includes(mode)){assert.notEqual(seen.status,0);throw Error('observer refuses '+mode);}
   assert.equal(seen.status,0,seen.stderr);assert.equal(JSON.parse(seen.stdout).image,out+'/fixture-startup.png');
   const review={...capture,clear:mode!=='ambiguous',review:'Separate model reviewed the returned fixture image'};
   if(mode==='wrong-sha')review.sha256='b'.repeat(64);
   if(mode==='wrong-identity')review.identity={worker:'other'};
   const result=python(prepared,'publish',review);
   if(mode==='positive')assert.equal(result.status,0,result.stderr);
   else {assert.notEqual(result.status,0);throw Error('review refused '+mode);}
  }};
  const controls={run:async opts=>{await opts.capture('fixture-startup');input++;assert(fs.existsSync(phase+'/input-service-arm.json'));}};
  if(mode==='positive'){await run(controls,options);assert.equal(input,1);}
  else {await assert.rejects(()=>run(controls,options));assert.equal(input,0);assert(!fs.existsSync(phase+'/input-service-arm.json'));}
 }
 // Obsolete output/ready publications cannot satisfy the generated phase plan.
 const phase=base+'/cancellation/prepared';fs.mkdirSync(phase,{recursive:true});fs.writeFileSync(phase+'/runtime-input-service-review-ready.json','{}');
 assert.notEqual(python(base+'/prepared','observe').status,0);
 console.log(JSON.stringify({passed:true,actualPreparation:true,actualConsumerGate:true,reviewControls:6,obsoletePathsRefused:true,browserStarted:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
