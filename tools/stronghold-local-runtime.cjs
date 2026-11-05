'use strict';
// Explicit local-process contract for the authorized setup-transition attempt.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const observer=require('./stronghold-owning-callback-observer.cjs');
const base=require('./stronghold-preset-driver-attachment.cjs');
const AUTH='stronghold-observed-control-gameplay-0422 user task';
const ASSIGNMENT=AUTH;
const CHROME='/opt/google/chrome/chrome';
const CUTOFF=Date.parse('2026-11-05T11:57:00Z'),CLEANUP=Date.parse('2026-11-05T12:00:00Z');
const ROOT=path.resolve(__dirname,'..');
const ORIGINAL_PINS='scratch/runs/20261104-stronghold-setup-transition-onward/runtime-pins.json';
const ORIGINAL_PINS_SHA='812aadea4a2b23a899919dc95b40b4d628a3836cedc0ae1e1844c966b284b7ef';
// Run-specific named amendments to published changes only. Every other row
// remains byte-bound to the immutable historical manifest.
const ACCEPTED=Object.freeze({
 "src/09aa-handlers-d3dim.wat": "c673c21b2bb671903d2d78440a24e1a3bca832f513429d6b30081724ffe321b6",
 "src/09ab-handlers-d3dim-core.wat": "283add545fac3497e6c7bf936b1726542c23215d538970eb63a6228132fbce18",
 "build/wine-assembly.wasm": "3859c274df0233659eb10fe4d2784fff7d1553242b4ae2b3bf653e5d2ebdd95b",
 "build/wine-assembly.compat.wasm": "9f042b70d7e43d3947415e1de01e7a540b3c7f7fa6c7fbefabdbea17e9633e95",
 "tools/stronghold-owning-callback-observer.cjs": "8493f2dfd26090b3dc638c44e790822d3c540c90b002594a27133ad32ce32c04",
 "tools/stronghold-native-preset-observer.cjs": "b991df4dc48d3cfe08582002ec51ffa3dcb03fd701fcf9e009aae9ce1f981911"
});
const PROVENANCE=Object.freeze({
 "src/09aa-handlers-d3dim.wat": "f1d62b136d7e3b7d7bb1a108774f5c804533e483",
 "src/09ab-handlers-d3dim-core.wat": "f1d62b136d7e3b7d7bb1a108774f5c804533e483",
 "build/wine-assembly.wasm": "f1d62b136d7e3b7d7bb1a108774f5c804533e483",
 "build/wine-assembly.compat.wasm": "f1d62b136d7e3b7d7bb1a108774f5c804533e483",
 "tools/stronghold-owning-callback-observer.cjs": "89caed5d1deeec73ea1c8538e8eb50f996b29496",
 "tools/stronghold-native-preset-observer.cjs": "89caed5d1deeec73ea1c8538e8eb50f996b29496"
});
function acceptedRuntimePins(original=fs.readFileSync(path.join(ROOT,ORIGINAL_PINS))){
 if(base.hash(original)!==ORIGINAL_PINS_SHA)throw Error('stale original runtime manifest');
 const pins=JSON.parse(original),amendments=[];
 const named={...ACCEPTED,'tools/stronghold-local-runtime.cjs':base.hash(fs.readFileSync(__filename))};
 const seen=new Set();
 pins.files=pins.files.map(row=>{
  if(seen.has(row.path))throw Error('duplicate runtime dependency');seen.add(row.path);
  const bytes=fs.readFileSync(path.join(ROOT,row.path)),actual=base.hash(bytes),expected=named[row.path]||row.sha256;
  if(actual!==expected)throw Error('unknown runtime dependency mismatch '+row.path);
  if(!named[row.path])return row;
  amendments.push({path:row.path,oldSHA256:row.sha256,newSHA256:expected,
   publishedProvenance:PROVENANCE[row.path]||'current authorized run-specific local contract',
   reason:row.path==='tools/stronghold-local-runtime.cjs'?'current assignment, finite host deadlines, exact predecessor FINAL releases and named dependency bindings only; all gameplay/observer guards unchanged':row.path.includes('observer.cjs')?'published passive native control state; pending/hover/activation/application/draw/presentation remain distinct':'published selective D3D7 state-block repair and its corresponding existing module pair'});
  return {...row,bytes:bytes.length,sha256:expected};
 });
 if(pins.files.length!==2429||amendments.length!==7||Object.keys(named).some(p=>!seen.has(p)))throw Error('complete original closure required');
 return {...pins,candidate:'named published D3D7 and passive control-state binding',runtimeBinding:{originalPinsSHA256:ORIGINAL_PINS_SHA,assignment:ASSIGNMENT,amendments}};
}
function verifyAcceptedRuntimePins(pins){
 const expected=acceptedRuntimePins();
 if(JSON.stringify(pins)!==JSON.stringify(expected))throw Error('stale or changed accepted runtime closure');
 return expected;
}
// Image identity brackets the capture; only the complete owning transaction
// can describe setup progress. No screenshot identity grants classification.
function diagnosticScene(bytes,known,observation){
 if(known!=='unknown')return known;
 if(!observation||observation.status!=='proved-setup-in-progress'||
  observation.sha256!==base.hash(bytes)||observation.readinessGranted!==false||
  observation.pixelsAccepted!==false||observation.gameplay!==false)return known;
 const proof=observation.proof;
 if(!proof)return known;
 const joined=observer.joinCaptureTransaction(proof.nativeReport,proof.hostReport,proof.capture);
 if(joined.status!=='proved-setup-in-progress'||joined.sha256!==observation.sha256||
  joined.name!==observation.name||joined.steps!==observation.steps||joined.epoch!==observation.epoch||joined.command!==observation.command)return known;
 return 'setup-transition-observation';
}
const PREDECESSORS=Object.freeze([
 ['return-fire-browser-body-receipts','return-fire-browser-body-receipts-0345'],
 ['mdk2-actual-startup-seam','mdk2-actual-startup-seam-0405']
]);
function requireRuntimeRelease(board,now=Date.now()){
 const rows=board.split('\n'),dependencies=[];
 for(const [worker,assignment] of PREDECESSORS){
  const own=rows.filter(r=>r.split(/\s+/)[1]===worker&&r.split(/\s+/)[2]==='OWN').at(-1);
  const runtimeOwn=rows.filter(r=>r.includes(' '+worker+' LOCAL HEAVY OWN ')).at(-1);
  const fileRelease=rows.filter(r=>r.includes(' '+worker+' FINAL runtime AND file RELEASE ')&&r.includes('docs/re-notes/'+worker+'-20261105.md')&&r.includes('ALLBUILDSFINISHED')).at(-1);
  const ownedAt=Date.parse(own?.split(' ')[0]),runtimeOwnedAt=Date.parse((runtimeOwn||own)?.split(' ')[0]),releasedAt=Date.parse(fileRelease?.split(' ')[0]);
  if(!own||!fileRelease||![now,ownedAt,runtimeOwnedAt,releasedAt].every(Number.isFinite)||runtimeOwnedAt<Date.parse('2026-11-05T04:00:00Z')||releasedAt<ownedAt||releasedAt<runtimeOwnedAt||releasedAt>now||releasedAt>Date.parse('2026-11-05T11:30:00Z')||
     (dependencies.length&&(releasedAt<dependencies.at(-1).releasedAt||runtimeOwnedAt<dependencies.at(-1).releasedAt)))
   throw Error('exact '+assignment+' FINAL runtime and file release after current OWN, all builds finished required');
  dependencies.push({worker,assignment,own,ownedAt,runtimeOwn,runtimeOwnedAt,row:fileRelease,at:releasedAt,fileRelease,releasedAt});
 }
 return {dependencies,row:dependencies[0].row};
}
function requireLocalFlock(lockPath='/tmp/wine-local-runtime.lock'){
 const ancestors=new Set();
 for(let pid=process.pid;pid>1&&!ancestors.has(pid);){ancestors.add(pid);const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');pid=Number(s.slice(s.lastIndexOf(')')+2).split(' ')[1]);}
 const target=fs.statSync(lockPath),dev=BigInt(target.dev),major=((dev>>8n)&0xfffn)|((dev>>32n)&0xfffff000n),minor=(dev&0xffn)|((dev>>12n)&0xffffff00n);
 for(const row of fs.readFileSync('/proc/locks','utf8').trim().split('\n')){
  const p=row.trim().split(/\s+/),d=p[5]?.split(':'),pid=Number(p[4]);
  if(p[1]!=='FLOCK'||p[3]!=='WRITE'||!ancestors.has(pid)||d?.[2]!==String(target.ino)||BigInt('0x'+d[0])!==major||BigInt('0x'+d[1])!==minor)continue;
  for(const fd of fs.readdirSync('/proc/'+pid+'/fd')){try{const held=fs.statSync('/proc/'+pid+'/fd/'+fd);if(held.dev===target.dev&&held.ino===target.ino)return {pid,fd,path:lockPath};}catch{}}
 }
 throw Error('required local flock must be held by this process or its ancestor');
}
function requireBuildReleases(board,now=Date.now()){
 return requireRuntimeRelease(board,now).dependencies;
}
function assertRuntimeOwnership(){const board=fs.readFileSync('messageboard.txt','utf8');return {release:requireRuntimeRelease(board),buildReleases:requireBuildReleases(board),flock:requireLocalFlock()};}
function identity(){
 const stat=fs.readFileSync('/proc/self/stat','utf8');
 return {hostname:os.hostname(),bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),
  pid:process.pid,startTicks:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],uid:process.getuid(),
  root:fs.realpathSync(process.cwd()),executable:fs.realpathSync(process.execPath)};
}
const lifecycles=new Map();
function install(run){
 run=fs.realpathSync(run);
 if(lifecycles.has(run))throw Error('one installed lifecycle per run');
 const cp=require('node:child_process'),spawn=cp.spawn;
 const file=path.join(run,'chrome-lifecycle.jsonl');fs.writeFileSync(file,'',{flag:'wx'});
 const record=(kind,data={})=>fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),kind,...data})+'\n');
 const children=[];
 function observed(command,args,...rest){
  const child=Reflect.apply(spawn,this,[command,args,...rest]);
  if(command!==CHROME||!args?.includes('--user-data-dir='+path.join(run,'chrome-profile')))return child;
  let startTicks=null;try{const s=fs.readFileSync('/proc/'+child.pid+'/stat','utf8');startTicks=s.slice(s.lastIndexOf(')')+2).split(' ')[19];}catch{}
  children.push(child);record('spawn',{pid:child.pid,startTicks,command,args});
  child.once('exit',(code,signal)=>record('actual-exit',{pid:child.pid,startTicks,code,signal}));
  child.once('error',e=>record('spawn-error',{error:String(e)}));return child;
 }
 cp.spawn=observed;
 const tap={record,children,restore(){if(cp.spawn===observed)cp.spawn=spawn;lifecycles.delete(run);record('recorder-restored');}};
 lifecycles.set(run,tap);record('installed',{identity:identity()});return tap;
}
function lifecycleForRun(run){const tap=lifecycles.get(path.resolve(run));if(!tap)throw Error('owned lifecycle recorder not installed');return tap;}
async function launchOwned(puppeteer,tap,options){
 tap.record('launch-request',{executablePath:options.executablePath,profile:options.userDataDir});
 const browser=await puppeteer.launch(options);
 if(tap.children.length!==1||tap.children[0]!==browser.process())throw Error('exactly one owned Chrome child required');
 tap.record('launch-returned',{pid:browser.process().pid});return browser;
}
function binding(run,pins){
 const manifest=JSON.parse(fs.readFileSync(pins));
 if(manifest.runtimeBinding)verifyAcceptedRuntimePins(manifest);
 const modules=['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'].map(file=>{
  const rows=manifest.files.filter(x=>x.path===file);if(rows.length!==1)throw Error('both candidate module pins required');
  const sha256=base.hash(fs.readFileSync(file));if(sha256!==rows[0].sha256||sha256!==ACCEPTED[file])throw Error('candidate module mismatch');return {path:file,sha256};
 });
 return {run:path.resolve(run),pins:path.resolve(pins),pinsSHA256:base.hash(fs.readFileSync(pins)),modules};
}
function validateRelease(release,{run,pins,nonce,now=Date.now()}={}){
 if(release?.version!==1||release.kind!=='local-process'||release.boxId!==undefined||release.expiry!==undefined)
  throw Error('explicit local contract required; no leased box identity');
 if(release.authorization!==AUTH||release.assignment!==ASSIGNMENT||release.freshLocalDiagnosticAuthorized!==true||release.shutdownOwner!=='coordinator')
  throw Error('original and current local authorization required');
 if(!/^[a-f0-9]{64}$/.test(nonce||'')||release.nonce!==nonce)throw Error('fresh exact process nonce required');
 if(JSON.stringify(release.identity)!==JSON.stringify(identity()))throw Error('foreign host/process identity');
 if(JSON.stringify(release.binding)!==JSON.stringify(binding(run,pins)))throw Error('foreign/stale run or candidate binding');
 const {issuedAt,closeBy,expiresAt,chromeCutoff,cleanupBy}=release;
 if(![now,issuedAt,closeBy,expiresAt,chromeCutoff,cleanupBy].every(Number.isFinite)||issuedAt>now||now-issuedAt>60000||
    closeBy<=now||closeBy>issuedAt+720000||expiresAt!==cleanupBy||chromeCutoff>CUTOFF||cleanupBy>CLEANUP||
    issuedAt+720000>chromeCutoff||issuedAt+900000>cleanupBy||closeBy>chromeCutoff||expiresAt<=now)
  throw Error('fresh finite local deadline and cleanup reserve required');
 return release;
}
function createRelease({run,pins,nonce,now=Date.now()}){
 const release={version:1,kind:'local-process',authorization:AUTH,assignment:ASSIGNMENT,
  freshLocalDiagnosticAuthorized:true,shutdownOwner:'coordinator',nonce,identity:identity(),binding:binding(run,pins),
  issuedAt:now,closeBy:now+720000,expiresAt:CLEANUP,chromeCutoff:CUTOFF,cleanupBy:CLEANUP};
 return validateRelease(release,{run,pins,nonce,now});
}
// Request normal Chrome shutdown directly and observe the actual child exit.
// Puppeteer's browser.close may fall back to killing its process; that cannot
// establish normal closure. This helper sends no process signal.
async function normalClose(browser,{timeoutMs=60000,record=()=>{}}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000)throw Error('finite normal closure reserve required');
 const child=browser.process();if(!child)throw Error('owned Chrome process required');
 const stat=fs.readFileSync('/proc/'+child.pid+'/stat','utf8'),startTicks=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
 let timer,listener;
 const exit=new Promise((resolve,reject)=>{
  listener=(code,signal)=>resolve({pid:child.pid,code,signal});
  if(child.exitCode!==null||child.signalCode!==null)listener(child.exitCode,child.signalCode);
  else child.once('exit',listener);
  timer=setTimeout(()=>reject(Error('normal Chrome exit deadline; closure unproved')),timeoutMs);
 });
 try{
  record({kind:'normal-close-request',pid:child.pid,startTicks});
  const request=(async()=>{const session=await browser.target().createCDPSession();await session.send('Browser.close');})();
  // Closing the connection may reject the command before the process exits.
  request.catch(error=>record({kind:'normal-close-protocol-result',error:String(error)}));
  const result=await exit;record({kind:'actual-chrome-exit',...result,startTicks});
  if(result.code!==0||result.signal!==null)throw Error('abnormal Chrome exit '+JSON.stringify(result));
  return result;
 }finally{clearTimeout(timer);child.removeListener('exit',listener);browser.disconnect();}
}
// Operator-side status only. A capture/review request is never an acceptance
// receipt. Keep the next command out of the mailbox until the previous ACK;
// in particular title-enter requests both a title and a resulting-menu review.
function mailboxStatus(run,{now=Date.now()}={}){
 const out=path.join(path.resolve(run),'browser'),read=name=>{
  const file=path.join(out,name);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
 };
 const indices=fs.readdirSync(path.join(out,'commands')).filter(n=>/^\d+\.json$/.test(n)).map(n=>Number(n.slice(0,-5))).sort((a,b)=>a-b);
 if(indices.some((n,i)=>n!==i))throw Error('contiguous original mailbox required');
 const replies=indices.map(i=>({i,reply:read('reply-'+i+'.json')}));
 const pending=replies.filter(r=>!r.reply).map(r=>r.i),failed=replies.find(r=>r.reply?.ok!==true&&r.reply);
 const request=read('review-required.json');let review=null;
 if(request){
  if(!/^[a-f0-9]{64}$/.test(request.sha256||'')||!/^[a-zA-Z0-9-]+$/.test(request.requestId||''))throw Error('invalid original review request');
  const command=Number.isInteger(request.commandIndex)?read('commands/'+request.commandIndex+'.json'):null;
  // Frozen captures can be byte-identical across commands. Display the newest
  // matching capture, so an earlier startup image cannot hide the title review.
  const capture=fs.readdirSync(out).filter(n=>n.endsWith('.png'))
   .map(name=>({name,mtime:fs.statSync(path.join(out,name)).mtimeMs}))
   .sort((a,b)=>b.mtime-a.mtime||b.name.localeCompare(a.name))
   .find(({name})=>base.hash(fs.readFileSync(path.join(out,name)))===request.sha256)?.name||null;
  review={...request,capture,receiptPresent:fs.existsSync(path.join(run,'reviews',request.requestId+'.json')),
   remainingMs:command?Math.max(0,command.replyDeadline*1000-now):null};
 }
 return {nextIndex:indices.length,pending,review,ready:!!read('ready.json'),
  terminal:read('cleanup.json')||read('bootstrap-failure.json')||failed?.reply||null};
}
function validateCaptureCommand(command,out){
 if(!['observe','shot'].includes(command?.action))return;
 if(typeof command.name!=='string'||!/^[a-z0-9-]+$/.test(command.name)||fs.existsSync(path.join(out,command.name+'.png')))
  throw Error('fresh capture name required before execution');
}
function assertMailboxCommandReady(run,options){
 const status=mailboxStatus(run,options);
 const detail=status.review?'; review '+status.review.scene+' '+(status.review.capture||status.review.sha256)+' receiptPresent='+status.review.receiptPresent:'';
 if(status.terminal||status.pending.length||!status.ready)throw Error('original mailbox not ready: '+
  (status.terminal?'terminal':status.pending.length?'pending command '+status.pending.join(','):'bootstrap')+detail);
 if(options?.command)validateCaptureCommand(options.command,path.join(path.resolve(run),'browser'));
 return status.nextIndex;
}
// Operator plan only: no writes or game controls. A review receipt is not an
// ACK, and a rejected ACK is terminal even if its capture was reviewed.
function nextMailboxAction(status,command){
 if(status.terminal)return {kind:'stop',reason:'terminal'};
 if(status.review&&!status.review.receiptPresent)return {kind:'personally-view-and-review',capture:status.review.capture};
 if(status.pending.length)return {kind:'wait-for-ack',indices:status.pending};
 if(!status.ready)return {kind:'wait-for-bootstrap'};
 return {kind:'submit-existing-command',command};
}
function prepare(options){
 const manifest=JSON.parse(fs.readFileSync(options.pins));
 if(manifest.runtimeBinding)verifyAcceptedRuntimePins(manifest);
 const p=observer.prepare(options),q=JSON.stringify;
 p.source=base.replaceOnce(p.source,'const presetAttachment=attachmentAPI.createAttachment({sessions,save,log,pageState:state,validateAck:assertAck,',
  `const hostPresentation=require(${q(__filename)}).createHostPresentationController({page:()=>page,save,deadline:()=>deadline});\nconst presetAttachment=attachmentAPI.createAttachment({hostPresentation,sessions,save,log,pageState:state,validateAck:assertAck,`);
 p.source=base.replaceOnce(p.source,'const png=Buffer.from(await page.screenshot()),current=await state();',
  'const presentationBefore=await hostPresentation.captureToken();\n  const png=Buffer.from(await page.screenshot()),current=await state();\n  const hostCapture=await hostPresentation.capture(presentationBefore,sha(png),name);');
 p.source=base.replaceOnce(p.source,'await presetAttachment.capture(name,sha(png),current);return {png,state:current};',
  'const nativeObservation=await presetAttachment.capture(name,sha(png),current,hostCapture);return {png,state:current,nativeObservation};');
 // Check the passive page observer before any later command, step or mouse
 // delivery. The synchronous latch also covers reviews and commandLive calls.
 p.source=base.replaceOnce(p.source,'function commandLive(){presetAttachment.assertLive();',
  'function commandLive(){hostPresentation.assertLive();presetAttachment.assertLive();');
 p.source=base.replaceOnce(p.source,'await presetAttachment.begin(c,i);',
  "if(c.action!=='quit')await hostPresentation.check();await presetAttachment.begin(c,i);");
 p.source=base.replaceOnce(p.source,'if(stepping)await presetAttachment.beforeStep();',
  'if(stepping){await hostPresentation.check();await presetAttachment.beforeStep();}');
 p.source=base.replaceOnce(p.source,'p.mouse[action]=async(...args)=>{const result=await original(...args);',
  'p.mouse[action]=async(...args)=>{await hostPresentation.check();const result=await original(...args);');
 p.route=base.replaceOnce(p.route,'scene:scene(c.png)',`scene:require(${q(__filename)}).diagnosticScene(c.png,scene(c.png),c.nativeObservation)`);
 p.route=base.replaceOnce(p.route,"['choose-type-custom-hover','actual-scene20-earlier','actual-scene20-intermediate']",
  "['choose-type-custom-hover','actual-scene20-earlier','actual-scene20-intermediate','setup-transition-observation']");
 p.evidence.setupTransitionDiagnostic={basis:'continuous Stronghold owner/cycle/selected-copy/publication/capture transaction',
  exactPixels:false,observationOnly:true,readinessGranted:false,pixelsAccepted:false,gameplay:false,arrivalAndObserverCapsUnchanged:true};
 p.source=base.replaceOnce(p.source,"  if(c.action==='observe'){",
  `  if(c.action==='observe'){\n    require(${q(__filename)}).validateCaptureCommand(c,OUT);`);
 p.source=base.replaceOnce(p.source,"  if(c.action==='shot'){",
  `  if(c.action==='shot'){\n    require(${q(__filename)}).validateCaptureCommand(c,OUT);`);
 const old="  if(release.authorization!=='stronghold-split-gesture-reviews user task'||release.shutdownOwner!=='coordinator'||!release.boxId||!Number.isFinite(Date.parse(release.expiry))||Date.parse(release.expiry)<Date.now()+600000)throw Error('fresh authorized finite TTL required');\n  if(!Number.isFinite(Date.parse(release.closeBy))||Date.parse(release.closeBy)<=Date.now()||Date.parse(release.closeBy)>Date.parse(release.expiry)-300000)throw Error('fresh bounded closeBy required');";
 const nonce=crypto.randomBytes(32).toString('hex');
 p.source=base.replaceOnce(p.source,old,`  require(${q(__filename)}).validateRelease(release,{run:RUN,pins:${q(options.pins)},nonce:${q(nonce)}});\n  const runtimeOwnership=require(${q(__filename)}).assertRuntimeOwnership();`);
 p.source=base.replaceOnce(p.source,"fs.mkdirSync(OUT);fs.mkdirSync(path.join(OUT,'commands'));",
  `fs.mkdirSync(OUT);fs.mkdirSync(path.join(OUT,'commands'));\n  save('runtime-ownership.json',runtimeOwnership);\n  require(${q(__filename)}).install(RUN);`);
 p.source=base.replaceOnce(p.source,'browser=await puppeteer.launch(',`browser=await require(${q(__filename)}).launchOwned(puppeteer,require(${q(__filename)}).lifecycleForRun(RUN),`);
 p.source=base.replaceOnce(p.source,'Date.parse(release.closeBy)','release.closeBy');
 p.source=base.replaceOnce(p.source,"executablePath:'/usr/bin/google-chrome'",`executablePath:${q(CHROME)}`);
 p.source=base.replaceOnce(p.source,'let browser,page,server,closing=false,halted=false,number=0,timer,deadline;',
  'let browser,page,server,closing=false,halted=false,number=0,timer,deadline,bootstrapTimer;');
 p.source=base.replaceOnce(p.source,'if(closing)return;closing=true;clearTimeout(timer);','if(closing)return;closing=true;clearTimeout(timer);clearTimeout(bootstrapTimer);');
 p.source=base.replaceOnce(p.source,"if(browser)await browser.close().catch(e=>log('cleanup-errors.jsonl',{error:String(e)}));",
  `if(browser)await require(${q(__filename)}).normalClose(browser,{record:r=>log('chrome-normal-closure.jsonl',r)}).catch(e=>log('cleanup-errors.jsonl',{error:String(e)}));`);
 p.source=base.replaceOnce(p.source,'deadline=Math.min(Date.now()+360000,release.closeBy);',
  'deadline=Math.min(Date.now()+720000,release.closeBy);const bootstrapDeadline=Math.min(Date.now()+60000,deadline);');
 p.source=base.replaceOnce(p.source,"  page=await browser.newPage();", "  bootstrapTimer=setTimeout(()=>boundary.close(()=>close('bounded 60s bootstrap deadline')),Math.max(0,bootstrapDeadline-Date.now()));\n  page=await browser.newPage();");
 p.source=base.replaceOnce(p.source,"  save('ready.json',await state());", "  clearTimeout(bootstrapTimer);\n  save('ready.json',await state());");
 p.source=base.replaceOnce(p.source,"  await page.screenshot({path:path.join(OUT,'selector-before-launch.png')});",
  "  const selectorPNG=await page.screenshot({path:path.join(OUT,'selector-before-launch.png')});\n  activeCommand='bootstrap-selector';activeReplyDeadline=Math.min(Date.now()+40000,bootstrapDeadline);\n  await personalReview({sha256:sha(selectorPNG),scene:'registered-selector',state:await state()});");
 p.evidence.bounds.chromeMs=720000;
 p.evidence.localRuntime={kind:'local-process',contractPath:__filename,contractSHA256:base.hash(fs.readFileSync(__filename)),
  navigationAndCommandCapsUnchanged:true,chrome:CHROME,chromeCutoff:CUTOFF,cleanupBy:CLEANUP};
 p.evidence.hostPresentation={passive:true,normalCallsOnly:true,endpointSlot:0,maxRecords:2048,maxBytes:1048576,
  operationToUpload:'unknown without unique cross-realm RPC identity',readinessGranted:false,pixelsAccepted:false};
 p.evidence.compositionSHA256=base.hash(p.source);
 p.evidence.routeCompositionSHA256=base.hash(p.route);
 return {...p,createRelease:()=>createRelease({run:options.run,pins:options.pins,nonce})};
}
function createHostPresentationController({page,save,deadline}){
 let active=false,sequence=0,fatal=null;
 const persist=r=>{save('host-presentation-'+sequence+++'.json',r);return r;};
 const assertLive=()=>{if(fatal)throw fatal;};
 const evaluate=source=>page().evaluate(source);
 function reject(report){
  if(!fatal){fatal=Error('host presentation terminal: '+(report?.fault||report?.status||'missing report'));persist(report||{status:'unsupported-or-unobservable',fault:'missing host presentation report',readinessGranted:false,pixelsAccepted:false});}
  throw fatal;
 }
 function running(report){if(!report||report.status!=='running'||report.fault)reject(report);return report;}
 async function read(source,token=false){
  assertLive();
  try{const value=await evaluate(source);running(token?value.report:value);return value;}
  catch(e){if(fatal)throw fatal;reject({status:'unsupported-or-unobservable',fault:String(e.message||e),history:'unknown; retain last host reports',readinessGranted:false,pixelsAccepted:false});}
 }
 const check=async()=>{assertLive();return active?read('globalThis.__strongholdHostPresentation.check()'):null;};
 const token=async()=>{
  assertLive();if(!active)return null;
  const value=await read('(()=>{const h=globalThis.__strongholdHostPresentation;const token=h.token();return {token,report:h.check()};})()',true);
  return value.token;
 };
 return {
  assertLive,check,token,
  async start(epoch,nativeBinding){
   assertLive();if(active)throw Error('occupied host presentation');
   const source='('+observer.hostPresentationFactory.toString()+')()';
   await read(`(()=>{if(globalThis.__strongholdHostPresentation)throw Error('occupied host presentation');
    globalThis.__strongholdHostPresentation=${source}.attach({getHost:()=>typeof wine==='undefined'?null:wine,
     nativeBinding:${JSON.stringify(nativeBinding)},epoch:${JSON.stringify(epoch)},deadline:performance.now()+${JSON.stringify(deadline())}-Date.now()});return globalThis.__strongholdHostPresentation.check();})()`);
   active=true;
  },
  // Before an ordinary produced frame, screenshots remain unbracketed. The
  // factory still rejects any direct frame-zero capture and every stale token.
  async captureToken(){const before=await token();return before?.frame?before:null;},
  async capture(before,sha256,name){
   assertLive();if(!active)return;
   if(before===null){const report=await check();persist({...report,captureDeferred:true,name,sha256,reason:'no ordinary produced frame before screenshot'});return;}
   return persist(await read(`globalThis.__strongholdHostPresentation.capture(${JSON.stringify(before)},${JSON.stringify(sha256)},${JSON.stringify(name)})`));
  },
  async link(nativeReport,capture){assertLive();if(!active)return null;const host=await check();
   const joined=observer.joinCaptureTransaction(nativeReport,host,capture);
   persist({nativeEpoch:nativeReport?.epoch,host,link:joined});return joined;
  },
  // Cleanup preserves the earliest latched fault. It cannot revive or replace
  // the terminal report, and it must still release any remaining page hooks.
  async finish(reason='terminal'){
   if(!active)return;active=false;let value;
   try{value=await evaluate(`(()=>{const h=globalThis.__strongholdHostPresentation;const before={...h.check()};return {before,report:h.finish(${JSON.stringify(reason)})};})()`);}
   catch(e){if(fatal)throw fatal;reject({status:'unsupported-or-unobservable',fault:String(e.message||e),history:'unknown; retain last host reports',readinessGranted:false,pixelsAccepted:false});}
   if(!fatal)running(value.before);
   persist(value.report);
  }
 };
}
module.exports={acceptedRuntimePins,verifyAcceptedRuntimePins,ACCEPTED,ORIGINAL_PINS_SHA,identity,install,lifecycleForRun,launchOwned,binding,validateRelease,createRelease,requireRuntimeRelease,requireBuildReleases,requireLocalFlock,assertRuntimeOwnership,validateCaptureCommand,normalClose,mailboxStatus,assertMailboxCommandReady,nextMailboxAction,diagnosticScene,prepare,createHostPresentationController,AUTH,ASSIGNMENT,CUTOFF,CLEANUP};
