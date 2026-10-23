'use strict';
// Host-only checks. Never import test/run.js; no WebAssembly APIs or guest execution.
const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm'),crypto=require('crypto');
const H='/home/user/wine-assembly';
const D='/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023';
const root=D+'/original/penguin-command-1.6.11';
const out=__dirname;
const mem=Number(fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m)[1])*1024;
assert(mem>=805306368);
const source=fs.readFileSync(H+'/test/run.js','utf8');
const start=source.indexOf('const getArg = (name, def) => {');
const end=source.indexOf('const hasFlag = ',start);
assert(start>0 && end>start);
const excerpt=source.slice(start,end);
const cli=['--args=--windowed --nosound','--vfs-include=data/gfx/*.png','--vfs-include=data/gfx/*.jpg'];
const ctx={args:cli};vm.createContext(ctx);
vm.runInContext(excerpt+'; result={guest:getArg("args",null),patterns:getArgs("vfs-include")};',ctx);
assert.equal(ctx.result.guest,'--windowed --nosound');
const {expandIncludePatterns}=require(H+'/lib/vfs-host-files');
const files=expandIncludePatterns(root,Array.from(ctx.result.patterns));assert.equal(files.length,83);
assert(files.every(f=>f.guestPath.startsWith('data/gfx/')));
const {VirtualFS}=require(H+'/lib/filesystem');
const boot=require(H+'/lib/process-boot');
const vfs=new VirtualFS();
for(const f of files)vfs.files.set('c:\\'+f.guestPath.replaceAll('/','\\').toLowerCase(),{data:fs.readFileSync(f.hostPath),attrs:32});
assert(vfs.setCurrentDirectory('C:\\'));
assert.equal(vfs.getFullPathName('penguin-command.dat').toLowerCase(),'c:\\penguin-command.dat');
const fh=vfs.createFile('penguin-command.dat',0x40000000,2);assert(fh>0);
assert(vfs.writeFile(fh,new Uint8Array([1,2,3]),3).ok);
assert(vfs.files.has('c:\\penguin-command.dat'));
assert(!vfs.setCurrentDirectory('C:\\missing'));
assert(vfs.setCurrentDirectory('C:\\data\\gfx'));
assert.notEqual(vfs.getFullPathName('penguin-command.dat').toLowerCase(),'c:\\penguin-command.dat');
let reject=0;
for(const p of ['data/gfx/*.absent','/data/gfx/*.png','C:\\data\\gfx\\*.png']) {
 try{expandIncludePatterns(root,[p]);}catch(e){reject++;}
}
assert.equal(reject,3);
assert(expandIncludePatterns(root,['data/gfx/*.png']).length<83);
const bytes=new ArrayBuffer(256);let routed;
boot.setExtraCmdline({get_staging:()=>16,set_extra_cmdline:(off,len)=>{routed=Buffer.from(bytes,off,len).toString();}},bytes,ctx.result.guest);
assert.equal(routed,'--windowed --nosound');
const pe=JSON.parse(fs.readFileSync(out+'/independent-pe.json'));
const seeds=['msvcrt.dll','sdl.dll','zlib1.dll','libpng12-0.dll','jpeg.dll','sdl_image.dll','sdl_mixer.dll'];
const configs=seeds.map(name=>({name,bytes:fs.readFileSync(pe[name].path)}));
(async()=>{
 const graph=await boot.resolveDllGraph({exeBytes:fs.readFileSync(root+'/penguin-command.exe'),seeds:configs.map(c=>pe[c.name].path),isLoadable:()=>false,loadSpec:async spec=>configs.find(c=>pe[c.name].path===spec),detectRequiredDlls:()=>[]});
 assert.equal(graph.length,7);
 const vv=new VirtualFS();boot.mountLoadedDllFiles(vv,graph);
 for(const name of seeds)assert(vv.files.has('c:\\'+name)&&vv.files.has('c:\\windows\\system\\'+name));
 const result={result:'PASS',node:process.execPath,node_sha256:crypto.createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex'),MemAvailable:mem,parse_excerpt:{start_byte:start,end_byte:end,sha256:crypto.createHash('sha256').update(excerpt).digest('hex')},guest_argument_mock:routed,graphics:files.map(f=>f.guestPath),native_seeds:graph.map(c=>c.name),controls:['missing graphics glob rejected','absolute POSIX include rejected','absolute Windows include rejected','PNG-only manifest omits JPEG','nonexistent CWD rejected','existing wrong CWD changes config path'],config:'host VirtualFS create/write succeeded at c:\\penguin-command.dat; game save unexecuted',run_js_imported:false};
 fs.writeFileSync(out+'/harness-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:'PASS',graphics:files.length,seeds:graph.length,controls:result.controls,guestArgs:routed,MemAvailable:mem}));
})().catch(e=>{console.error(e);process.exitCode=1;});
