#!/usr/bin/env node
'use strict';
// Separate diagnostic grant: Next once, then five seconds without guest input.
// Allow licence initialization to finish; never answer the licence dialog.
const fs = require('node:fs'), path = require('node:path');
const cp = require('node:child_process'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = require('../docs/re-notes/army-men-child-manifest.json');
const pins = require('../docs/re-notes/army-men-setup-compile-pins.json');
function inspectExecutable(file) {
  const b=fs.readFileSync(file); assert(b.length>=64 && b.toString('ascii',0,2)==='MZ','MZ required');
  const offset=b.readUInt32LE(60); assert(offset+2<=b.length,'header outside file');
  const signature=b.toString('ascii',offset,offset+2);
  assert(['NE','PE'].includes(signature),'unsupported original setup format: '+signature);
  if(signature==='PE')assert(offset+24<=b.length && b.readUInt32LE(offset)===0x4550 && b.readUInt16LE(offset+4)===0x14c,'i386 PE required');
  return {size:b.length,sha256:sha(file),offset,signature};
}
function verifyPayload(root) {
  for (const f of [...manifest.files, ...manifest.duplicates]) {
    const p = path.join(root, f.path);
    assert(fs.lstatSync(p).isFile(), f.path);
    assert.equal(sha(p), f.sha256, f.path);
    if (f.size !== undefined) assert.equal(fs.statSync(p).size, f.size, f.path);
  }
}
async function main() {
  const [root, payload, out] = process.argv.slice(2).map(p => path.resolve(p));
  assert(root && payload && out, 'usage: ROOT PAYLOAD NEW_OUTPUT');
  const git = (...args) => cp.execFileSync('git', ['-C',root,...args], {encoding:'utf8'}).trim();
  const wasm = path.join(root,'build/wine-assembly.wasm');
  const verify = () => {
    assert.equal(sha(wasm),pins.moduleSha256,'canonical module');
    for (const f of pins.files) assert.equal(sha(path.join(root,f.path)),f.sha256,f.path);
    verifyPayload(payload);
    assert.equal(sha(path.resolve(payload,'../registry.json')),manifest.registrySha256,'captured registry');
  };
  verify();
  const header = inspectExecutable(path.join(payload,manifest.exe));
  // Hash physical bytes, not merely Git HEAD or index metadata.
  const sources = git('ls-files','-z').split('\0').filter(Boolean).map(p=>({path:p,sha256:sha(path.join(root,p))}));
  fs.mkdirSync(out);
  const save = (n,v) => fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n');
  save('source-before.json',sources);
  save('setup-header.json',header);
  save('identity.json',{startedAt:new Date().toISOString(),head:git('rev-parse','HEAD'),index:git('ls-files','-s'),compilePins:pins,manifest,node:process.version,note:'Compiler closure matches pinned reference; physical host JS identity is source-before.json, not a claim of current-main host equivalence.'});
  fs.copyFileSync(__filename,path.join(out,'controller.js'));
  const tree=path.join(out,'vfs'), dir=tree;
  fs.mkdirSync(dir,{recursive:true});
  for(const f of manifest.files) { const dst=path.join(dir,f.path); fs.mkdirSync(path.dirname(dst),{recursive:true}); fs.copyFileSync(path.join(payload,f.path),dst); }
  const args=['test/run.js','--exe='+path.join(dir,manifest.exe),'--exe-guest-path='+manifest.guestExe,'--cwd='+manifest.cwd,'--args='+manifest.args,'--reg-import='+path.resolve(payload,'../registry.json'),'--vfs-tree='+tree,'--no-build','--wasm='+wasm,'--quiet-api','--no-close','--no-threads','--batch-size=200000','--max-batches=10000000','--max-seconds=120','--control-stdin','--capture-launch='+path.join(out,'capture'),'--save-vfs='+path.join(out,'final-vfs'),'--reg-export='+path.join(out,'registry.json'),'--png='+path.join(out,'final.png')];
  args.push('--trace-api=CreateFileA,ReadFile,CloseHandle,_lopen,_lread,_llseek,_lclose,LocalAlloc,LocalLock,LocalUnlock,LocalFree,SendMessageA,SendDlgItemMessageA,SetWindowTextA,SetDlgItemTextA', '--trace-api-paused', '--trace-api-dedup');
  save('launch.json',{args,cwd:root,guestSeconds:120,controllerMilliseconds:150000,inputs:[],runtimeInput:'one Welcome Next click; input-event.json is authoritative',licenceSettleMilliseconds:5000});
  const log=fs.openSync(path.join(out,'output.log'),'wx');
  const child=cp.spawn(process.execPath,args,{cwd:root,stdio:['pipe','pipe','pipe'],detached:true});
  save('child.json',{pid:child.pid});
  let tail='', stopped=false, sample=0, nextScheduled=false, licenceSeen=false;
  let licenceTimer;
  const event={cmd:'click:415:394'}; // Center of reviewed Welcome Next button in 640x480 capture.
  const send=v=>{if(!child.stdin.destroyed) child.stdin.write(JSON.stringify(v)+'\n');};
  child.stdin.on('error',()=>{});
  const receive=b=>{
    fs.writeSync(log,b); tail=(tail+b.toString()).slice(-32768);
    if (!stopped && !nextScheduled && tail.includes('Welcome to the Army Men Demo Setup program.')) {
      nextScheduled=true;
      setTimeout(()=>{
        if(stopped) return;
        send({action:'png',path:path.join(out,'welcome-before-next.png')});
        send({action:'trace-api',on:true});
        save('input-event.json',{at:new Date().toISOString(),event,basis:'reviewed original Welcome screenshot; Next button center 415,394',count:1});
        send(event);
        setTimeout(()=>{if(!stopped && !licenceSeen){stopped=true;save('stop-reason.json',{at:new Date().toISOString(),reason:'licence not observed within ten seconds after Next'});send({action:'snapshot'});send({action:'png',path:path.join(out,'after-next.png')});send({action:'quit'});}},10000);
      },500);
    }
    if(!stopped && !licenceSeen && /license agreement|licence agreement|software license/i.test(tail)) {
      licenceSeen=true;
      save('licence-observed.json',{at:new Date().toISOString(),settleMilliseconds:5000,tail});
      send({action:'png',path:path.join(out,'licence-initial.png')});
      licenceTimer=setTimeout(()=>{
        if(stopped) return;
        stopped=true;
        save('stop-reason.json',{at:new Date().toISOString(),reason:'five seconds of licence initialization observed; no licence answer'});
        send({cmd:'dump-main-edit-state:licence-settled'});
        send({action:'snapshot'});
        send({action:'png',path:path.join(out,'licence-settled.png')});
        send({action:'quit'});
      },5000);
    }
    if(!stopped && /unimplemented|RuntimeError|\[CRASH\]/i.test(tail)) {
      stopped=true; save('stop-reason.json',{at:new Date().toISOString(),reason:'licence-or-crash-text',tail});
      send({action:'png',path:path.join(out,'stop.png')}); send({action:'quit'});
    }
  };
  child.stdout.on('data',receive); child.stderr.on('data',receive);
  const interval=setInterval(()=>{send({action:'snapshot'});send({action:'png',path:path.join(out,'sample-'+sample+++'.png')});},10000);
  const soft=setTimeout(()=>send({action:'quit'}),125000);
  const hard=setTimeout(()=>{save('watchdog.json',{at:new Date().toISOString()});try{process.kill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}},150000);
  const terminal=await new Promise(resolve=>{child.once('error',e=>resolve({error:e.stack}));child.once('close',(code,signal)=>resolve({code,signal}));});
  clearInterval(interval);clearTimeout(soft);clearTimeout(hard);clearTimeout(licenceTimer);fs.closeSync(log);
  save('terminal.json',{...terminal,finishedAt:new Date().toISOString()});
  verify();
  for(const f of sources)assert.equal(sha(path.join(root,f.path)),f.sha256,f.path);
  for(const f of manifest.files)assert.equal(sha(path.join(dir,f.path)),f.sha256,f.path);
  const processInventory=cp.execFileSync('ps',['-eo','pid,ppid,pgid,stat,comm'],{encoding:'utf8'});
  const survivors=processInventory.split('\n').filter(row=>{
    const columns=row.trim().split(/\s+/);
    return Number(columns[0])===child.pid || Number(columns[2])===child.pid;
  });
  save('postflight.json',{at:new Date().toISOString(),sourceAndFixturesUnchanged:true,ownedProcessGroup:child.pid,survivors,processInventory});
  assert.equal(survivors.length,0,'owned process group survives');
  if(terminal.code!==0 || terminal.signal || terminal.error)process.exitCode=1;
}
module.exports={verifyPayload,inspectExecutable,manifest,pins};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
