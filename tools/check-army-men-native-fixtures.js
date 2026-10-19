'use strict';
// Production dependency discovery only; no PE execution or wasm instantiation.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const bundle=path.resolve(process.argv[2]),report=process.argv[3],root=path.join(bundle,'runtime');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixtures=JSON.parse(fs.readFileSync(path.join(bundle,'native-fixtures.json')));
for(const f of fixtures){const b=fs.readFileSync(path.join(bundle,f.path));assert.equal(b.length,f.size);assert.equal(sha(b),f.sha256);}
const {detectRequiredDlls}=require(path.join(root,'lib/dll-loader.js'));
const {resolveDllGraph}=require(path.join(root,'lib/process-boot.js'));
const exeDir=path.join(bundle,'state/vfs/program files/the 3do company/army men demo');
const dirs=[path.join(exeDir,'dlls'),exeDir,path.join(exeDir,'..','Shared_DLLs'),path.join(exeDir,'..','shared_dlls'),path.join(root,'test/binaries/dlls')];
function find(name){for(const dir of dirs){if(!fs.existsSync(dir))continue;const match=fs.readdirSync(dir).find(n=>n.toLowerCase()===name.toLowerCase());if(match)return path.join(dir,match);}return null;}
(async()=>{
 const missing=[];
 const graph=await resolveDllGraph({exeBytes:fs.readFileSync(path.join(exeDir,'armymendemo.exe')),detectRequiredDlls,onMissing:(name,spec)=>missing.push({name,spec}),loadSpec:spec=>{const p=find(spec);return p?{name:spec,bytes:fs.readFileSync(p),path:p}:null;}});
 const files=graph.map(f=>({name:f.name,path:path.relative(bundle,f.path),size:f.bytes.length,sha256:sha(f.bytes),imports:detectRequiredDlls(f.bytes)}));
 const mfc=graph.find(f=>f.name.toLowerCase()==='mfc42.dll');assert(mfc);
 assert.equal(sha(mfc.bytes),sha(fs.readFileSync(path.join(bundle,'state/vfs/windows/system/mfc42.dll'))),'original app MFC');
 const crt=graph.find(f=>f.name.toLowerCase()==='msvcrt.dll');assert(crt);
 assert.equal(sha(crt.bytes),sha(fs.readFileSync(path.join(bundle,'state/vfs/windows/system/msvcrt.dll'))),'original app CRT');
 const b=mfc.bytes,pe=b.readUInt32LE(60),section=pe+24+b.readUInt16LE(pe+20);
 function off(rva){for(let i=0;i<b.readUInt16LE(pe+6);i++){const s=section+i*40,va=b.readUInt32LE(s+12),size=b.readUInt32LE(s+16);if(rva>=va&&rva<va+size)return b.readUInt32LE(s+20)+rva-va;}throw Error('RVA outside file');}
 const exp=off(b.readUInt32LE(pe+120)),base=b.readUInt32LE(exp+16),count=b.readUInt32LE(exp+20);
 assert(1168>=base&&1168<base+count);const ordinalRva=b.readUInt32LE(off(b.readUInt32LE(exp+28))+4*(1168-base));assert(ordinalRva!==0);
 const result={at:new Date().toISOString(),files,missing,mfcOrdinal1168:{base,count,rva:ordinalRva},productionSearchDirs:dirs,guestExecuted:false};
 if(report)fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));assert.equal(missing.length,0,'complete native DLL graph');
})().catch(error=>{console.error(error);process.exitCode=1;});
