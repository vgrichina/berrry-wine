'use strict';
// Explicit local-process contract for the authorized setup-transition attempt.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const observer=require('./stronghold-owning-callback-observer.cjs');
const base=require('./stronghold-preset-driver-attachment.cjs');
const AUTH='stronghold-setup-transition-onward-2248 user task';
const ASSIGNMENT='stronghold-setup-transition-onward-2248 user task';
const CHROME='/opt/google/chrome/chrome';
const CUTOFF=Date.parse('2026-11-04T23:35:00Z'),CLEANUP=Date.parse('2026-11-04T23:38:00Z');
// Personally inspected partial setup frames after the original callback
// returned. Exact identities only: no complete-layout or input-ready grant.
const SETUP_TRANSITION='741b136a33e205825f23e70af83059d82dfe3b625bd869c321198ba16dec2e5c';
const SETUP_TRANSITIONS=Object.freeze([SETUP_TRANSITION,
 '5cf84f22b5e0e11ba4b5a945b1bd031febd8be322cffa382f9c02670c6df237f']);
function diagnosticScene(bytes,known){
 if(known!=='unknown')return known;
 const {PNG}=require('pngjs'),p=PNG.sync.read(bytes);
 if(p.width!==1200||p.height!==900)throw Error('setup diagnostic geometry required');
 const pixels=Buffer.alloc(860*668*4);
 for(let y=0;y<668;y++)p.data.copy(pixels,y*860*4,((y+194)*1200+10)*4,((y+194)*1200+870)*4);
 for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)throw Error('opaque setup diagnostic required');
 return SETUP_TRANSITIONS.includes(base.hash(pixels))?'setup-transition-observation':known;
}
function requireRuntimeRelease(board,now=Date.now()){
 const assignment='stronghold-quiet-rpc-original-gameplay-2230';
 const rows=board.split('\n');
 const own=rows.filter(row=>/^\S+ stronghold-quiet-rpc OWN\b/.test(row)&&row.includes('stronghold-quiet-rpc-original-gameplay-20261104')).at(-1);
 const ownedAt=Date.parse(own?.split(' ')[0]);
 const row=rows.filter(row=>/^\S+ stronghold-quiet-rpc LOCAL HEAVY RELEASE\b/.test(row)&&row.split(/\s+/).includes(assignment)).at(-1);
 const at=Date.parse(row?.split(' ')[0]);
 const fileRelease=rows.filter(row=>/^\S+ stronghold-quiet-rpc RELEASE\b/.test(row)&&row.includes('docs/re-notes/stronghold-quiet-rpc-original-gameplay-20261104.md')).at(-1);
 const releasedAt=Date.parse(fileRelease?.split(' ')[0]);
 if(!own||!row||!fileRelease||!Number.isFinite(ownedAt)||!Number.isFinite(at)||!Number.isFinite(releasedAt)||ownedAt<Date.parse('2026-11-04T22:30:00Z')||at<Date.parse('2026-11-04T22:39:17Z')||releasedAt<Date.parse('2026-11-04T22:45:12Z')||at<ownedAt||releasedAt<at||releasedAt>now||at>now||ownedAt>now)
  throw Error('exact '+assignment+' assignment-bound local heavy release after current OWN required');
 return {row,at,own,ownedAt,fileRelease,releasedAt,assignment};
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
function assertRuntimeOwnership(){return {release:requireRuntimeRelease(fs.readFileSync('messageboard.txt','utf8')),flock:requireLocalFlock()};}
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
 const modules=['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'].map(file=>{
  const rows=manifest.files.filter(x=>x.path===file);if(rows.length!==1)throw Error('both candidate module pins required');
  const sha256=base.hash(fs.readFileSync(file));if(sha256!==rows[0].sha256)throw Error('candidate module mismatch');return {path:file,sha256};
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
function prepare(options){
 const p=observer.prepare(options),q=JSON.stringify;
 p.route=base.replaceOnce(p.route,'scene:scene(c.png)',`scene:require(${q(__filename)}).diagnosticScene(c.png,scene(c.png))`);
 p.route=base.replaceOnce(p.route,"['choose-type-custom-hover','actual-scene20-earlier','actual-scene20-intermediate']",
  "['choose-type-custom-hover','actual-scene20-earlier','actual-scene20-intermediate','setup-transition-observation']");
 p.evidence.setupTransitionDiagnostic={gameRGBAsha256:SETUP_TRANSITION,gameRGBAsha256s:SETUP_TRANSITIONS,gameBox:[10,194,860,668],
  exactPixels:true,observationOnly:true,readinessGranted:false,arrivalAndObserverCapsUnchanged:true};
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
 p.evidence.compositionSHA256=base.hash(p.source);
 p.evidence.routeCompositionSHA256=base.hash(p.route);
 return {...p,createRelease:()=>createRelease({run:options.run,pins:options.pins,nonce})};
}
module.exports={identity,install,lifecycleForRun,launchOwned,binding,validateRelease,createRelease,requireRuntimeRelease,requireLocalFlock,assertRuntimeOwnership,validateCaptureCommand,normalClose,mailboxStatus,assertMailboxCommandReady,diagnosticScene,SETUP_TRANSITION,SETUP_TRANSITIONS,prepare,AUTH,ASSIGNMENT,CUTOFF,CLEANUP};
