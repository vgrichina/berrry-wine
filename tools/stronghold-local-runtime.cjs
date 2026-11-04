'use strict';
// Explicit local-process contract for the retained original diagnostic only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const observer=require('./stronghold-owning-callback-observer.cjs');
const base=require('./stronghold-preset-driver-attachment.cjs');
const AUTH='stronghold-split-gesture-reviews user task';
const ASSIGNMENT='stronghold-portable-local-runtime user task';
const CHROME='/opt/google/chrome/chrome';
const CUTOFF=Date.parse('2026-11-04T17:40:00Z'),CLEANUP=Date.parse('2026-11-04T17:43:00Z');
function identity(){
 const stat=fs.readFileSync('/proc/self/stat','utf8');
 return {hostname:os.hostname(),bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),
  pid:process.pid,startTicks:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],uid:process.getuid(),
  root:fs.realpathSync(process.cwd()),executable:fs.realpathSync(process.execPath)};
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
    closeBy<=now||closeBy>issuedAt+360000||expiresAt!==cleanupBy||chromeCutoff>CUTOFF||cleanupBy>CLEANUP||
    issuedAt+360000>chromeCutoff||issuedAt+540000>cleanupBy||closeBy>chromeCutoff||expiresAt<=now)
  throw Error('fresh finite local deadline and cleanup reserve required');
 return release;
}
function createRelease({run,pins,nonce,now=Date.now()}){
 const release={version:1,kind:'local-process',authorization:AUTH,assignment:ASSIGNMENT,
  freshLocalDiagnosticAuthorized:true,shutdownOwner:'coordinator',nonce,identity:identity(),binding:binding(run,pins),
  issuedAt:now,closeBy:now+360000,expiresAt:CLEANUP,chromeCutoff:CUTOFF,cleanupBy:CLEANUP};
 return validateRelease(release,{run,pins,nonce,now});
}
function prepare(options){
 const p=observer.prepare(options),q=JSON.stringify;
 const old="  if(release.authorization!=='stronghold-split-gesture-reviews user task'||release.shutdownOwner!=='coordinator'||!release.boxId||!Number.isFinite(Date.parse(release.expiry))||Date.parse(release.expiry)<Date.now()+600000)throw Error('fresh authorized finite TTL required');\n  if(!Number.isFinite(Date.parse(release.closeBy))||Date.parse(release.closeBy)<=Date.now()||Date.parse(release.closeBy)>Date.parse(release.expiry)-300000)throw Error('fresh bounded closeBy required');";
 const nonce=crypto.randomBytes(32).toString('hex');
 p.source=base.replaceOnce(p.source,old,`  require(${q(__filename)}).validateRelease(release,{run:RUN,pins:${q(options.pins)},nonce:${q(nonce)}});`);
 p.source=base.replaceOnce(p.source,'Date.parse(release.closeBy)','release.closeBy');
 p.source=base.replaceOnce(p.source,"executablePath:'/usr/bin/google-chrome'",`executablePath:${q(CHROME)}`);
 p.source=base.replaceOnce(p.source,'let browser,page,server,closing=false,halted=false,number=0,timer,deadline;',
  'let browser,page,server,closing=false,halted=false,number=0,timer,deadline,bootstrapTimer;');
 p.source=base.replaceOnce(p.source,'if(closing)return;closing=true;clearTimeout(timer);','if(closing)return;closing=true;clearTimeout(timer);clearTimeout(bootstrapTimer);');
 p.source=base.replaceOnce(p.source,'deadline=Math.min(Date.now()+360000,release.closeBy);',
  'deadline=Math.min(Date.now()+360000,release.closeBy);const bootstrapDeadline=Math.min(Date.now()+60000,deadline);');
 p.source=base.replaceOnce(p.source,"  page=await browser.newPage();", "  bootstrapTimer=setTimeout(()=>boundary.close(()=>close('bounded 60s bootstrap deadline')),Math.max(0,bootstrapDeadline-Date.now()));\n  page=await browser.newPage();");
 p.source=base.replaceOnce(p.source,"  save('ready.json',await state());", "  clearTimeout(bootstrapTimer);\n  save('ready.json',await state());");
 p.source=base.replaceOnce(p.source,"  await page.screenshot({path:path.join(OUT,'selector-before-launch.png')});",
  "  const selectorPNG=await page.screenshot({path:path.join(OUT,'selector-before-launch.png')});\n  activeCommand='bootstrap-selector';activeReplyDeadline=Math.min(Date.now()+40000,bootstrapDeadline);\n  await personalReview({sha256:sha(selectorPNG),scene:'registered-selector',state:await state()});");
 p.evidence.localRuntime={kind:'local-process',contractPath:__filename,contractSHA256:base.hash(fs.readFileSync(__filename)),
  capsUnchanged:true,chrome:CHROME,chromeCutoff:CUTOFF,cleanupBy:CLEANUP};
 p.evidence.compositionSHA256=base.hash(p.source);
 return {...p,createRelease:()=>createRelease({run:options.run,pins:options.pins,nonce})};
}
module.exports={identity,binding,validateRelease,createRelease,prepare,AUTH,ASSIGNMENT,CUTOFF,CLEANUP};
