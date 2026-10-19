'use strict';
// Root-granted local CLI observation; sealed input VFS retained, no duplicate exports.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const http=require('http'),{PathWatchHandoff,DebuggerPromptQuit}=require('./army-men-debugger-handoff');
const [bundle,out,grant]=process.argv.slice(2);
assert(bundle&&out&&path.isAbsolute(bundle)&&path.isAbsolute(out)&&grant==='--root-runtime-granted');
assert(!fs.existsSync(out),'unique evidence directory required');
const pins=JSON.parse(fs.readFileSync(path.join(bundle,'transfer-manifest.json')));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const verify=()=>pins.filter(f=>!fs.existsSync(path.join(bundle,f.path))||fs.statSync(path.join(bundle,f.path)).size!==f.size||sha(path.join(bundle,f.path))!==f.sha256);
assert.equal(verify().length,0,'complete original/runtime bundle');
const runtime=path.join(bundle,'runtime'),vfs=path.join(bundle,'state/vfs');
const identity=JSON.parse(fs.readFileSync(path.join(bundle,'source-identity.json')));
// Coherent tested RTC source and primary module; original installed state unchanged.
assert.equal(identity.rootHead,'7c9434f1f202c00044f2edd6c7b3e331740b9960');
assert.equal(identity.debuggerSourceCommit,'21d473f999e170d5e97c39291fb2975f448b6697');
assert.equal(sha(path.join(runtime,'test/run.js')),'527d845ca17212367b6467d45d3b1f168f5d82b848fce6faf52d1947eada81ce');
const wasm=path.join(runtime,'build/wine-assembly.wasm');
assert.equal(sha(wasm),'7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33');
const link=require(path.join(runtime,'lib/shell-link.js')).parseShellLink(fs.readFileSync(path.join(vfs,'windows/start menu/programs/army men demo/army men demo.lnk')));
assert.equal(link.target,'C:\\Program Files\\The 3DO Company\\Army Men Demo\\ArmyMenDemo.exe');
assert.equal(link.workingDir,'C:\\Program Files\\The 3DO Company\\Army Men Demo');assert.equal(link.args,'');
const exe=path.join(vfs,link.target.replace(/^c:\\/i,'').replace(/\\/g,'/').toLowerCase());
assert.equal(sha(exe),'dea8303de872789553f3190ad64e80bf3c0528a5d9d3cb18ad85e0c40664078c');
const free=()=>{const s=fs.statfsSync(bundle);return s.bavail*s.bsize;};
const outputReserve=28*1024**2,transientReserve=512*1024**2,stopFloor=2214592512;
assert(free()-outputReserve-transientReserve>2281701376,'fresh disk admission');
fs.mkdirSync(out);const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n');
cp.execFileSync(process.execPath,[path.join(bundle,'source-preflight.js'),runtime,path.join(out,'source-preflight.json')],{timeout:30000,maxBuffer:1024**2});
cp.execFileSync(process.execPath,[path.join(bundle,'native-preflight.js'),bundle,path.join(out,'native-preflight.json')],{timeout:30000,maxBuffer:1024**2});
fs.copyFileSync(__filename,path.join(out,'controller.js'));save('pins.json',pins);
const helperPath=require.resolve('./army-men-debugger-handoff'),helperHash=sha(helperPath);
fs.copyFileSync(helperPath,path.join(out,'army-men-debugger-handoff.js'));save('helper-pin.json',{path:helperPath,sha256:helperHash});
save('preflight.json',{at:new Date().toISOString(),identity,freeBytes:free(),outputReserve,transientReserve,stopFloor,shortcut:link,finishClicked:false,installedVfsFiles:433});
const args=['test/run.js','--exe='+exe,'--exe-guest-path='+link.target,'--cwd='+link.workingDir,'--args='+link.args,'--vfs-tree='+vfs,'--reg-import='+path.join(bundle,'state/registry.json'),'--no-build','--wasm='+wasm,'--quiet-api','--no-close','--no-threads','--batch-size=200000','--max-batches=10000000','--max-seconds=60','--control=8143','--break=0x43c7ee','--break-once','--watch-byte=0','--watch-value=0','--watch-log','--watch-stack','--png='+path.join(out,'final.png'),'--reg-export='+path.join(out,'registry.json')];
save('launch.json',{runtime,args,inputs:'reviewed ordinary UI only; no preprogrammed menu coordinates'});
const fd=fs.openSync(path.join(out,'output.log'),'wx');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!(/^(WA_|WINE_)/.test(k)||['NODE_OPTIONS','NODE_PATH'].includes(k))));
assert(free()-outputReserve-transientReserve>2281701376,'fresh immediate pre-spawn disk admission');
const child=cp.spawn(process.execPath,args,{cwd:runtime,env,stdio:['pipe','pipe','pipe'],detached:true});save('child.json',{pid:child.pid,controllerPid:process.pid});console.log(JSON.stringify({pid:child.pid,out}));
let bytes=0,reason=null,minFree=free();const kill=()=>{try{process.kill(-child.pid,'SIGKILL')}catch(e){if(e.code!=='ESRCH')throw e}};
const handoff=new PathWatchHandoff(),promptQuit=new DebuggerPromptQuit();let watchTail='';
const quitAtPrompt=b=>{const command=promptQuit.feed(b.toString(),!!reason);if(command&&!child.stdin.destroyed){save('debugger-quit.json',{at:new Date().toISOString(),command,reason});child.stdin.write(command);}};
const stop=(why,hard=false)=>{if(!reason){reason=why;save('stop.json',{at:new Date().toISOString(),reason});
 if(handoff.phase!=='done'&&!child.stdin.destroyed)child.stdin.write('q\n');
 const req=http.request({host:'127.0.0.1',port:8143,path:'/ctl',method:'POST',headers:{'Content-Type':'application/json'}},r=>r.resume());req.on('error',()=>{});req.end(JSON.stringify({action:'quit'}));
 }if(hard)kill();};
child.stdin.on('error',()=>{});const receive=b=>{bytes+=b.length;if(bytes<=4*1024**2)fs.writeSync(fd,b);else stop('log-cap',true);};
child.stdout.on('data',b=>{receive(b);if(reason){quitAtPrompt(b);return;}try{
 if(handoff.phase!=='done'){
  for(const command of handoff.feed(b.toString())){save('handoff.json',{phase:handoff.phase,object:handoff.object,pointer:handoff.pointer,path:handoff.path,receipts:handoff.receipts});child.stdin.write(command);}
 }
 watchTail=(watchTail+b.toString()).slice(-16384);
 const hit=watchTail.match(/WATCHPOINT hit at batch (\d+): \[0x([0-9a-f]+)\] changed\s+Old: 0x([0-9a-f]+)\s+New: 0x([0-9a-f]+)/i);
 if(hit&&handoff.phase==='done'){
  assert.equal(parseInt(hit[2],16),handoff.pointer);assert.equal(parseInt(hit[3],16),0x43);assert.equal(parseInt(hit[4],16),0);
  save('qualified-transition.json',{batch:+hit[1],pointer:handoff.pointer,proofPath:handoff.path,record:watchTail});stop('qualified-watch-transition');
 }
 }catch(error){save('handoff-error.json',{error:error.stack,phase:handoff.phase});stop('debugger-handoff-failure');}quitAtPrompt(b);});child.stderr.on('data',receive);
const handoffDeadline=setTimeout(()=>{if(handoff.phase!=='done')stop('debugger-handoff-unavailable');},30000);
const allocated=p=>fs.readdirSync(p,{withFileTypes:true}).reduce((n,d)=>n+(d.isDirectory()?allocated(path.join(p,d.name)):fs.lstatSync(path.join(p,d.name)).blocks*512),0);
const poll=setInterval(()=>{minFree=Math.min(minFree,free());if(minFree<stopFloor)stop('disk-floor',true);if(allocated(out)>outputReserve)stop('output-cap',true);},250);
const soft=setTimeout(()=>stop('soft-deadline'),75000),hard=setTimeout(()=>stop('hard-deadline',true),90000);
child.once('close',(code,signal)=>{clearInterval(poll);clearTimeout(soft);clearTimeout(hard);clearTimeout(handoffDeadline);fs.closeSync(fd);minFree=Math.min(minFree,free());const changed=verify();if(sha(helperPath)!==helperHash)changed.push({path:helperPath});const inventory=cp.execFileSync('ps',['-eo','pid,ppid,pgid,stat,comm'],{encoding:'utf8'});const survivors=inventory.split('\n').filter(r=>{const c=r.trim().split(/\s+/);return +c[0]===child.pid||+c[2]===child.pid});save('postflight.json',{at:new Date().toISOString(),code,signal,reason,bytes,minFree,changed,survivors,inventory,finishClicked:false,gameplayRequiresReview:true});console.log(JSON.stringify({code,signal,reason,minFree,changed:changed.length,survivors}));process.exitCode=code||signal||(reason&&reason!=='qualified-watch-transition')||changed.length||survivors.length?1:0;});
