const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const R='/tmp/generally-driving',root=R+'/runner',plan=JSON.parse(fs.readFileSync(R+'/ops/plan.json'));
const source=fs.readFileSync(root+'/test/run.js','utf8'),a=source.indexOf('const getArgs = name => {'),b=source.indexOf('const hasFlag =',a),args=plan.argv.slice(2);
const getArgs=new Function('args',source.slice(a,b)+';return getArgs;')(args);
assert.deepStrictEqual(getArgs('app'),['generally']);assert.deepStrictEqual(getArgs('vfs-tree'),[root+'/test/binaries/candidates/generally']);
const {APPS}=require(root+'/lib/apps'),entry=APPS.generally;assert.equal(entry.exe,'test/binaries/candidates/generally/GeneRally.exe');
const game=root+'/test/binaries/candidates/generally',manifest=JSON.parse(fs.readFileSync(root+'/'+entry.localFileManifest));
const files=require(root+'/lib/vfs-host-files').expandIncludePatterns(game,['**/*']);
for(const x of manifest.files){if(x.url)assert(fs.statSync(path.join(game,x.url)).isFile(),x.url)}
const required=require(root+'/lib/dll-loader').detectRequiredDlls(fs.readFileSync(root+'/'+entry.exe));
const api=JSON.parse(fs.readFileSync(root+'/src/api_table.json')),names=new Set(api.map(x=>x.name));
const imports=require(root+'/lib/dll-loader').importsByDll(fs.readFileSync(root+'/'+entry.exe));
for(const x of imports)for(const name of x.names)assert(names.has(name),'unregistered API '+x.dll+'!'+name);
// Read ordinal numbers with the production PE metadata parser. Only its
// diagnostic output changes from a count to a list; guest sources are intact.
const loader=fs.readFileSync(root+'/lib/dll-loader.js','utf8'),start=loader.indexOf('function importsByDll(bytes)'),end=loader.indexOf('\n// DLLs every Windows',start);
const diagnostic=loader.slice(start,end).replace('ordinals: 0','ordinals: []').replace('entry.ordinals++;','entry.ordinals.push(t & 0xFFFF);');
const details=new Function('readU32',diagnostic+';return importsByDll;')((b,o)=>b.readUInt32LE(o))(fs.readFileSync(root+'/'+entry.exe));
const memory=new ArrayBuffer(1024),ctx={getMemory:()=>memory,apiTable:api},host=require(root+'/lib/host-imports').createHostImports(ctx).host;
for(const x of details)for(const ordinal of x.ordinals){new Uint8Array(memory).fill(0);new Uint8Array(memory).set(Buffer.from(x.dll),16);assert(host.resolve_ordinal(16,ordinal)>=0,'unresolved '+x.dll+'#'+ordinal)}
console.log(JSON.stringify({ordinalDetails:details.filter(x=>x.ordinals.length),diagnosticTransformSHA256:crypto.createHash('sha256').update(diagnostic).digest('hex')}));
// Production resolves these named imports through the WAT API table when no
// optional real system DLL exists, matching the installed original route.
console.log(JSON.stringify({imports,apiEntries:api.length,registeredNamedImports:true}));
if(process.argv.includes('--module')){const wasm=fs.readFileSync(root+'/build/wine-assembly.wasm');assert(WebAssembly.validate(wasm));const mod=new WebAssembly.Module(wasm);console.log('module imports '+WebAssembly.Module.imports(mod).length)}
for(const f of ['src/api_table.json','lib/host-import-sigs.generated.json','lib/worker-imports.js','lib/guest-worker.js','lib/render-worker.js','test/run.js'])assert(fs.statSync(root+'/'+f).isFile(),f);
require(root+'/lib/canvas-compat');require(root+'/node_modules/pngjs');
console.log(JSON.stringify({pass:true,node:process.execPath,version:process.version,flags:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),environmentSHA256:crypto.createHash('sha256').update(JSON.stringify(Object.entries(process.env).sort())).digest('hex'),requiredDLLs:required,registeredFiles:manifest.files.length,treeFiles:files.length,commaFiles:files.filter(x=>x.hostPath.includes(',')).map(x=>x.hostPath),cwd:process.cwd()}));
