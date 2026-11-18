'use strict';
// NFS frozen-source preload. Git is the archive; Workers inherit the pinned
// inventory in memory rather than reading every Git blob during desktop hello.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const {getEnvironmentData,setEnvironmentData,isMainThread}=require('node:worker_threads');
const root=path.resolve(__dirname,'..'),base=process.env.NFS_SOURCE_BASE;
if(!/^[a-f0-9]{40}$/.test(base||''))throw Error('exact published base required');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=fs.readFileSync.bind(fs);
const key='nfs-source-inventory:'+base;
let inventory=getEnvironmentData(key), inventoryRoute='inherited';
if(!inventory){
 if(!isMainThread)throw Error('missing inherited source inventory');
 const names=cp.execFileSync('git',['ls-tree','-r','--name-only',base,'--','src','lib','tools','test','host.js','package.json','fonts'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(n=>(/\.(js|cjs|json|wat|watx)$/.test(n)||n.startsWith('fonts/'))&&!n.startsWith('test/binaries/'));
 const packed=cp.execFileSync('git',['cat-file','--batch'],{cwd:root,input:names.map(n=>base+':'+n+'\n').join(''),maxBuffer:100*1024*1024});
 inventory={base,names,packed};setEnvironmentData(key,inventory);inventoryRoute='git';
}
if(inventory.base!==base)throw Error('inherited source identity differs');
const {names}=inventory,packed=Buffer.from(inventory.packed),files=new Map();let at=0;
for(const n of names){const end=packed.indexOf(10,at),h=packed.subarray(at,end).toString().split(' '),size=Number(h[2]);if(h[1]!=='blob'||!Number.isSafeInteger(size)||size<0||end+size+2>packed.length)throw Error('invalid Git framing');files.set(n,Buffer.from(packed.subarray(end+1,end+1+size)));at=end+size+2;}
if(at!==packed.length)throw Error('Git trailing bytes');
const pins=[...files].map(([file,body])=>({file,sha256:sha(body)}));
const observer=read(root+'/tools/nfs-public-timing.cjs');
if(sha(observer)!==process.env.NFS_OBSERVER_SHA256)throw Error('observer pin differs');
files.set('tools/nfs-public-timing.cjs',observer);
if(process.env.NFS_MODULE){const b=read(process.env.NFS_MODULE);if(sha(b)!==process.env.NFS_MODULE_SHA256)throw Error('module differs');files.set('build/wine-assembly.wasm',b);}
function select(file){if(file instanceof URL)file=require('node:url').fileURLToPath(file);if(typeof file!=='string')return null;const n=path.relative(root,path.resolve(file));if(files.has(n))return files.get(n);if(/^(src|lib|tools|test)\//.test(n)&&!n.startsWith('test/binaries/')&&(/\.(js|cjs|json|wat|watx)$/.test(n)||n.startsWith('fonts/')))throw Error('unpublished source refused '+n);return null;}
const decode=(b,opts)=>{const encoding=typeof opts==='string'?opts:opts?.encoding;return encoding?b.toString(encoding):Buffer.from(b);};
fs.readFileSync=function(file,opts){const b=select(file);return b?decode(b,opts):read(file,opts);};
const asyncRead=fs.readFile.bind(fs),promiseRead=fs.promises.readFile.bind(fs.promises);
fs.readFile=function(file,opts,callback){if(typeof opts==='function'){callback=opts;opts=undefined;}const b=select(file);if(!b)return asyncRead(file,opts,callback);queueMicrotask(()=>callback(null,decode(b,opts)));};
fs.promises.readFile=async(file,opts)=>{const b=select(file);return b?decode(b,opts):promiseRead(file,opts);};
// Resolve sealed Git modules even when their published filename was removed
// from the shared worktree. Only names in the already hashed inventory qualify.
const resolveFilename=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...rest){
 try{return resolveFilename.call(this,request,parent,...rest);}
 catch(error){
  if(error.code!=='MODULE_NOT_FOUND'||!request.startsWith('.'))throw error;
  const absolute=path.resolve(path.dirname(parent.filename),request);
  for(const suffix of ['', '.js', '.cjs', '.json', '/index.js']){
   const file=absolute+suffix,n=path.relative(root,file);
   if(files.has(n))return file;
  }
  throw error;
 }
};
for(const ext of ['.js','.cjs','.json']){const prior=Module._extensions[ext]||Module._extensions['.js'];Module._extensions[ext]=(mod,file)=>{const b=select(file);if(!b)return prior(mod,file);if(ext==='.json')mod.exports=JSON.parse(b);else mod._compile(b.toString(),file);};}
function compile(output,receipt){
 const vfs=new Map();for(const [n,b]of files)if(/^src\/.*\.(wat|watx)$/.test(n)){const text=require(root+'/tools/watx').sourceTextFromBytes(b);for(const key of [n,n.slice(4),'./'+n.slice(4)])vfs.set(key,text);}
 const r=require(root+'/tools/watx-closure').compileClosure({entry:'src/main.watx',source:vfs.get('main.watx'),vfs},{tailCalls:true});if(!r.success)throw Error(r.error);
 const h=require(root+'/tools/region-layout-hash'),bytes=h.appendSection(Buffer.from(r.wasmBinary),h.layoutHash(r.regions.regions));
 fs.writeFileSync(output,bytes,{flag:'wx'});fs.writeFileSync(receipt,JSON.stringify({base,output,bytes:bytes.length,sha256:sha(bytes),pins},null,2),{flag:'wx'});
}
module.exports={compile,pins,base};

const readdir=fs.readdirSync.bind(fs), exists=fs.existsSync.bind(fs);
fs.readdirSync=function(dir,opts){if(path.resolve(String(dir))===root+'/src'){if(opts?.withFileTypes)throw Error('unsupported Dirent');return [...files.keys()].filter(n=>path.dirname(n)==='src').map(n=>path.basename(n)).sort();}return readdir(dir,opts);};
fs.existsSync=function(file){const full=path.resolve(String(file));if(full.startsWith(root+'/src/'))return files.has(path.relative(root,full));return exists(file);};

if(process.env.NFS_SOURCE_OBSERVE)fs.appendFileSync(process.env.NFS_SOURCE_OBSERVE,JSON.stringify({at:Date.now(),pid:process.pid,thread:require('node:worker_threads').threadId,base,moduleSHA256:process.env.NFS_MODULE_SHA256||null,sourceCount:pins.length,inventoryRoute})+'\n');
