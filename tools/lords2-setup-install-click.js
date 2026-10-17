#!/usr/bin/env node
'use strict';
// Run only under an explicit exclusive runtime grant: one reviewed Install click.
const fs = require('node:fs'), path = require('node:path');
const cp = require('node:child_process'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = {...require('../test/candidate-corpus/lords2-demo-files.json'),exe:'SETUP.EXE',guestExe:'c:\\l2setup\\SETUP.EXE',cwd:'c:\\l2setup'};
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
  for (const f of manifest.files) {
    const p = path.join(root, f.path);
    assert(fs.lstatSync(p).isFile(), f.path);
    assert.equal(sha(p), f.sha256, f.path);
    if (f.size !== undefined) assert.equal(fs.statSync(p).size, f.size, f.path);
  }
}
async function main() {
  assert.equal(process.argv.length,5,'usage: ROOT PAYLOAD NEW_OUTPUT');
  const [root,payload,out]=process.argv.slice(2).map(p=>path.resolve(p));
  const git = (...args) => cp.execFileSync('git', ['-C',root,...args], {encoding:'utf8',maxBuffer:32*1024*1024}).trim();
  const wasm = path.join(root,'build/wine-assembly.wasm');
  const verify = () => {
    assert.equal(sha(wasm),pins.moduleSha256,'canonical module');
    for (const f of pins.files) assert.equal(sha(path.join(root,f.path)),f.sha256,f.path);
    verifyPayload(payload);
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
  const tree=path.join(out,'vfs'), dir=path.join(tree,'L2SETUP');
  fs.mkdirSync(dir,{recursive:true});
  for(const f of manifest.files) { const dst=path.join(dir,f.path); fs.mkdirSync(path.dirname(dst),{recursive:true}); fs.copyFileSync(path.join(payload,f.path),dst); }
  const args=['test/run.js','--exe='+path.join(dir,manifest.exe),'--exe-guest-path='+manifest.guestExe,'--cwd='+manifest.cwd,'--args=','--vfs-tree='+tree,'--no-build','--wasm='+wasm,'--quiet-api','--no-close','--no-threads','--batch-size=200000','--max-batches=10000000','--max-seconds=90','--control-stdin','--capture-launch='+path.join(out,'capture'),'--save-vfs='+path.join(out,'final-vfs'),'--reg-export='+path.join(out,'registry.json'),'--png='+path.join(out,'final.png')];
  save('launch.json',{args,cwd:root,guestSeconds:90,controllerMilliseconds:120000,inputs:[],authorizedInput:"one Install click after exact reviewed menu hash; input-event.json authoritative"});
  const log=fs.openSync(path.join(out,'output.log'),'wx');
  const child=cp.spawn(process.execPath,args,{cwd:root,stdio:['pipe','pipe','pipe'],detached:true});
  save('child.json',{pid:child.pid});
  let tail='', stopped=false, sample=0, written=0, omitted=0, clicked=false, settle=null;
  const send=v=>{if(!child.stdin.destroyed) child.stdin.write(JSON.stringify(v)+'\n');};
  child.stdin.on('error',()=>{});
  const receive=b=>{
    const kept=b.subarray(0,Math.max(0,8*1024*1024-written));if(kept.length)fs.writeSync(log,kept);written+=kept.length;omitted+=b.length-kept.length; tail=(tail+b.toString()).slice(-32768);
    const before=path.join(out,'sample-0.png');
    if(!clicked && !stopped && b.toString().includes(before) && fs.existsSync(before)){
      clicked=true;
      if(sha(before)!=='7b30f3795a63c5e75f4d3fdd74abf6fb5c6f43addbd86844950f638e3c9a5bad'){
        stopped=true;save('stop-reason.json',{at:new Date().toISOString(),reason:'menu differs from reviewed image; no click'});send({action:'quit'});
      }else{
        const event={cmd:'click:509:147'};save('input-event.json',{at:new Date().toISOString(),beforeSha256:sha(before),event});send(event);
        settle=setTimeout(()=>{if(!stopped){stopped=true;send({action:'snapshot'});send({action:'png',path:path.join(out,'after-install.png')});send({action:'quit'});}},5000);
      }
    }
    if(!stopped && /license agreement|licence agreement|software license|restart your computer|restart windows|reboot|Error: DLL initializer did not return|unimplemented|RuntimeError|\[CRASH\]/i.test(tail)) {
      stopped=true; save('stop-reason.json',{at:new Date().toISOString(),reason:'licence-restart-or-crash-text',tail});
      send({action:'png',path:path.join(out,'stop.png')}); send({action:'quit'});
    }
  };
  child.stdout.on('data',receive); child.stderr.on('data',receive);
  const interval=setInterval(()=>{send({action:'snapshot'});send({action:'png',path:path.join(out,'sample-'+sample+++'.png')});},10000);
  const soft=setTimeout(()=>send({action:'quit'}),95000);
  const hard=setTimeout(()=>{save('watchdog.json',{at:new Date().toISOString()});try{process.kill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}},120000);
  const terminal=await new Promise(resolve=>{child.once('error',e=>resolve({error:e.stack}));child.once('close',(code,signal)=>resolve({code,signal}));});
  clearInterval(interval);clearTimeout(soft);clearTimeout(hard);clearTimeout(settle);fs.closeSync(log);
  save('terminal.json',{...terminal,finishedAt:new Date().toISOString(),logBytes:written,omittedLogBytes:omitted});
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
