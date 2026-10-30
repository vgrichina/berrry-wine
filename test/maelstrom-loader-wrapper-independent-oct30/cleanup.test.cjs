#!/usr/bin/env node
'use strict';
// A synthetic descendant retains stdout/stderr after its parent exits.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..');
const wrapper=require('../maelstrom-pinned-full-loader-oct30/qualify.cjs');
const pins=require('../maelstrom-pinned-full-loader-oct30/pins.json');
const root=fs.mkdtempSync(path.join(path.dirname(repo),'independent-cleanup-'));
const pidFile=path.join(root,'descendant.pid');
function write(p,b){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);return p;}
function pin(p){const b=fs.readFileSync(p);return {bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};}
const child=write(path.join(root,'parent.cjs'),`
const fs=require('node:fs'),{spawn}=require('node:child_process');
const c=spawn('/usr/bin/node',['--max-old-space-size=192','-e','setInterval(()=>{},1000)'],{stdio:['ignore',1,2]});
fs.writeFileSync(${JSON.stringify(pidFile)},String(c.pid));
process.exit(0);
`);
const executable=write(path.join(root,'node-control'),`#!/bin/sh\nexec /usr/bin/node --max-old-space-size=192 '${child}' "$@"\n`);
fs.chmodSync(executable,0o700);
const c={node:executable,runner:path.join(repo,'test/run.js'),wasm:write(path.join(root,'fake.wasm'),'synthetic uncompiled module'),exe:write(path.join(root,'game.exe'),'synthetic PE'),sdl:write(path.join(root,'SDL.dll'),'synthetic DLL'),'sdl-net':write(path.join(root,'SDL_net.dll'),'synthetic DLL'),msvcrt:write(path.join(root,'msvcrt.dll'),'synthetic DLL'),tree:path.join(root,'tree'),manifest:path.join(root,'manifest.json'),out:path.join(root,'out'),'max-seconds':1,'wall-seconds':3};
fs.mkdirSync(c.tree);
write(c.manifest,JSON.stringify({schema:'maelstrom-loader-inputs/v1',inputs:Object.fromEntries(['node','runner','wasm','exe','sdl','sdl-net','msvcrt'].map(k=>[k,{path:c[k],...pin(c[k])}])),tree:{path:c.tree,files:[]}}));
function gone(pid){try{return /\) Z /.test(fs.readFileSync('/proc/'+pid+'/stat','utf8'));}catch(e){if(e.code==='ENOENT')return true;throw e;}}
async function test(){
 const started=Date.now();
 const r=await wrapper.main(Object.entries(c).map(([k,v])=>`--${k}=${v}`),{pins:{wasm:pin(c.wasm),sources:pins.sources}});
 assert.equal(r.child.code,0);assert.equal(r.child.signal,null);assert.equal(r.child.reason,null);assert.equal(r.child.error,null);
 assert.equal(r.status,'runtime_observations_unqualified');assert.equal(r.guestAcceptance,false);
 const pid=Number(fs.readFileSync(pidFile));assert.ok(Number.isSafeInteger(pid)&&pid>1);
 const deadline=Date.now()+500;
 while(!gone(pid)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
 assert.ok(gone(pid),'descendant holding pipes must no longer execute');
 assert.ok(Date.now()-started<2500,'exit cleanup must close pipes before 3-second wall guard');
 console.log(JSON.stringify({status:'PASS_INHERITED_PIPE_CLEANUP',parentExit:r.child.code,reason:r.child.reason,descendant:pid,descendantGoneOrZombie:gone(pid),elapsedMs:Date.now()-started,guestExecuted:false,runtimeQualification:'OPEN'}));
}
test().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{
 // Emergency fixture cleanup only; never operate on task boxes.
 if(fs.existsSync(pidFile)){const pid=Number(fs.readFileSync(pidFile));if(Number.isSafeInteger(pid)&&pid>1&&!gone(pid)){try{process.kill(pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}}}
 fs.rmSync(root,{recursive:true,force:true});
});
