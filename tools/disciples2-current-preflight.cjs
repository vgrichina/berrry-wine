'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {APPS}=require('../lib/apps');
const {resolveDllGraph}=require('../lib/process-boot');
const {detectRequiredDlls,importsByDll}=require('../lib/dll-loader');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function verify(){
 const app=APPS.disciples2_demo, base=path.dirname(app.localFileManifest);
 const manifest=JSON.parse(fs.readFileSync(app.localFileManifest));
 assert.equal(manifest.files.length,127);assert.equal(new Set(manifest.files.map(r=>r.url)).size,127);
 const old=JSON.parse(fs.readFileSync('scratch/runs/20261112-disciples2-postbattle-native-load-cause-0836/runtime-pins.json'));
 const historical=new Map(old.files.map(r=>[r.path,r]));const rows=[];
 function pin(p,size){const b=fs.readFileSync(p);if(size!==undefined)assert.equal(b.length,size,p);
  const row={path:p,size:b.length,sha256:sha(b)};const prior=historical.get(p);
  assert(prior,'original media historical hash missing: '+p);assert.equal(row.sha256,prior.sha256,p);
  assert.equal(row.size,prior.size,p);rows.push(row);return b;}
 const exe=pin(app.exe,4192256);assert.equal(sha(exe),'adba242a0a3563651baffa6ec7d9a6c0978b7ae844a1cccedb2a1f4e8eb7b1f8');
 for(const r of manifest.files){assert(!r.url.includes('..'));pin(path.join(base,r.url),r.size);}
 const missing=[];
 const dlls=await resolveDllGraph({exeBytes:exe,seeds:app.dlls,detectRequiredDlls,
  onMissing:(...v)=>missing.push(v),loadSpec:spec=>{const name=path.basename(spec);
   const p=spec.includes('/')?spec:[path.join(path.dirname(app.exe),name),path.join('test/binaries/dlls',name)].find(p=>fs.existsSync(p));
   if(!p||!fs.existsSync(p))return null;
   if(!rows.some(r=>r.path===p))pin(p);return {name,bytes:fs.readFileSync(p)};}});
 // The historical/default route resolves these three OLE32 imports to native
 // emulator handlers. Do not introduce an unrelated Explorer OLE32 binary.
 const fallback=[];const table=JSON.parse(fs.readFileSync('src/api_table.json'));
 for(const [name,spec,flags] of missing){
  assert.equal(name,'ole32.dll');assert.equal(flags.seed,false);
  const imports=importsByDll(exe).find(r=>r.dll==='ole32.dll');assert.equal(imports.ordinals,0);
  assert.deepEqual([...imports.names].sort(),['CoCreateInstance','CoInitialize','CoUninitialize']);
  for(const name of imports.names){const row=table.find(r=>r.name===name);assert(row,name);
   const handler=row.handler||row.name;const sources=fs.readdirSync('src').filter(p=>p.endsWith('.wat')).map(p=>fs.readFileSync('src/'+p,'utf8')).join('\n');
   const body=sources.split('(func $handle_'+handler)[1];assert(body,name);
   assert(!body.split('(func ')[0].includes('$crash_unimplemented'),name);}
  fallback.push({dll:name,source:'native emulator OLE handlers',imports:imports.names});
 }
 assert(dlls.length>=5);
 return {at:new Date().toISOString(),exe:rows[0],media:rows,manifestRows:127,dlls:dlls.map(d=>({name:d.name,sha256:sha(d.bytes)})),missingRealDLLWarnings:missing,nativeFallback:fallback,missing:[]};
}
module.exports={verify};
if(require.main===module)verify().then(v=>console.log(JSON.stringify(v,null,2))).catch(e=>{console.error(e);process.exitCode=1;});
