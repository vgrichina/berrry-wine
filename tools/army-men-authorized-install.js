'use strict';
// One root-granted original installation stage; normal input only through reviewed HTTP controls.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const root='/tmp/wa-recovery-20261014',shared='/home/user/wine-assembly';
const out=shared+'/scratch/runs/20261019-army-men-authorized-install';
const bootstrap=shared+'/scratch/runs/20261019-army-men-authorized-bootstrap';
const review=JSON.parse(fs.readFileSync(bootstrap+'/capture-review.json'));
const launch=JSON.parse(fs.readFileSync(bootstrap+'/capture/launch.json'));
assert.equal(launch.args,'');assert.equal(launch.directory,'c:\\armymen');
for(const f of review.capture)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(bootstrap,'capture',f.path))).digest('hex'),f.sha256);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(bootstrap+'/registry.json')).digest('hex'),review.registrySha256);
const payload=shared+'/scratch/runs/20261019-army-men-authorized-recovery/payload';
const manifest=JSON.parse(fs.readFileSync(shared+'/scratch/runs/20261015-army-men-original-setup/docs/re-notes/army-men-setup-manifest.json'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const free=()=>{const s=fs.statfsSync(root);return s.bavail*s.bsize;};
const reserve=256*1024**2,stopFloor=2*1024**3+64*1024**2;
const wasm=root+'/build/wine-assembly.wasm',wasmPin='93818216116a49fbc2b52074a80254d5f8aebdef753b7f22b34d90be84c323c6';
assert.equal(sha(wasm),wasmPin);
assert(free()-reserve>2*1024**3+128*1024**2,'disk admission');
const originals=[...manifest.files,...manifest.duplicates];
for(const f of originals){assert.equal(sha(path.join(payload,f.path)),f.sha256);assert.equal(fs.statSync(path.join(payload,f.path)).size,f.size);}
const names=new Set();for(const f of manifest.files){assert(!names.has(f.path.toLowerCase()));names.add(f.path.toLowerCase());}
for(const f of manifest.duplicates){const retained=manifest.files.find(g=>g.path.toLowerCase()===f.path.toLowerCase());assert(retained);assert.equal(retained.sha256,f.sha256);}
const setup=fs.readFileSync(payload+'/SETUP.EXE'),offset=setup.readUInt32LE(60);assert.equal(setup.toString('ascii',offset,offset+2),'NE');
fs.mkdirSync(out);
const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n');
const sourceFiles=cp.execFileSync('git',['-C',root,'ls-files','-z'],{encoding:'utf8'}).split('\0').filter(f=>f&&(/^(src|lib|tools|test)\//.test(f)||['host.js','package.json','package-lock.json'].includes(f))&&fs.existsSync(path.join(root,f))&&fs.lstatSync(path.join(root,f)).isFile());
const pins=sourceFiles.map(f=>({path:f,sha256:sha(path.join(root,f))}));
save('source-before.json',pins);save('original-manifest.json',manifest);fs.copyFileSync(__filename,out+'/controller.js');
const tree=out+'/vfs';fs.mkdirSync(tree,{recursive:true});
// Hardlinks avoid a second original copy; all mounts are rehashed on exit.
for(const f of review.capture.filter(f=>f.path!=='launch.json')){const dst=path.join(tree,f.path);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.linkSync(path.join(bootstrap,'capture',f.path),dst);}
save('preflight.json',{at:new Date().toISOString(),head:cp.execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),wasmSha256:sha(wasm),sourceFiles:pins.length,originalFiles:originals.length,mountFiles:review.capture.length-1,bootstrapSetupHeader:{offset,signature:'NE'},child:review.child,freeBytes:free(),reserve,acceptedInGuest:false});
const args=['test/run.js','--exe='+path.join(tree,launch.exe),'--exe-guest-path='+launch.guestExe,'--cwd='+launch.directory,'--args='+launch.args,'--reg-import='+bootstrap+'/registry.json','--vfs-tree='+tree,'--no-build','--wasm='+wasm,'--quiet-api','--no-close','--no-threads','--batch-size=200000','--max-batches=10000000','--max-seconds=90','--control=8142','--control-stdin','--capture-launch='+out+'/capture','--save-vfs='+out+'/final-vfs','--reg-export='+out+'/registry.json','--png='+out+'/final.png'];
save('launch.json',{root,args,inputs:'only separately reviewed ordinary clicks via port8142',childReplay:true,registryTiming:'end-of-bootstrap, not launch-time'});
const fd=fs.openSync(out+'/output.log','wx');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!(/^(WA_|WINE_)/.test(k)||['NODE_OPTIONS','NODE_PATH'].includes(k))));
const child=cp.spawn(process.execPath,args,{cwd:root,env,stdio:['pipe','pipe','pipe'],detached:true});
save('child.json',{pid:child.pid,controllerPid:process.pid});
let bytes=0,reason=null,minFree=free();
const kill=()=>{try{process.kill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}};
const quit=why=>{if(reason)return;reason=why;save('stop.json',{at:new Date().toISOString(),reason});if(!child.stdin.destroyed)child.stdin.write('{"action":"quit"}\n');};
child.stdin.on('error',()=>{});
const receive=b=>{bytes+=b.length;if(bytes<=4*1024**2)fs.writeSync(fd,b);else{quit('log-cap');kill();}};
child.stdout.on('data',receive);child.stderr.on('data',receive);
const allocated=p=>{let n=0;for(const d of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,d.name);n+=d.isDirectory()?allocated(q):fs.lstatSync(q).blocks*512;}return n;};
const check=setInterval(()=>{minFree=Math.min(minFree,free());if(minFree<stopFloor){quit('disk-floor');kill();}if(allocated(out)>reserve){quit('output-reserve');kill();}},250);
const soft=setTimeout(()=>quit('soft-deadline'),105000);
const hard=setTimeout(()=>{quit('hard-deadline');kill();},120000);
child.once('close',(code,signal)=>{
clearInterval(check);clearTimeout(soft);clearTimeout(hard);fs.closeSync(fd);
const changed=pins.filter(f=>!fs.existsSync(path.join(root,f.path))||sha(path.join(root,f.path))!==f.sha256);
const originalChanged=originals.filter(f=>sha(path.join(payload,f.path))!==f.sha256);
const mountChanged=review.capture.filter(f=>f.path!=='launch.json'&&sha(path.join(tree,f.path))!==f.sha256);
const captureChanged=review.capture.filter(f=>sha(path.join(bootstrap,'capture',f.path))!==f.sha256);
minFree=Math.min(minFree,free());
const inventory=cp.execFileSync('ps',['-eo','pid,ppid,pgid,stat,comm'],{encoding:'utf8'});
const survivors=inventory.split('\n').filter(r=>{const c=r.trim().split(/\s+/);return +c[0]===child.pid||+c[2]===child.pid;});
const result={at:new Date().toISOString(),code,signal,reason,bytes,minFree,changed,originalChanged,mountChanged,captureChanged,wasmSha256:sha(wasm),survivors,inventory,acceptedInGuest:null,acceptanceRequiresReview:true};
save('postflight.json',result);console.log(JSON.stringify({...result,inventory:undefined}));
process.exitCode=code||signal||reason||changed.length||originalChanged.length||mountChanged.length||captureChanged.length||sha(wasm)!==wasmPin||survivors.length?1:0;
});
