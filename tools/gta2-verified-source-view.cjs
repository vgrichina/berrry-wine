'use strict';
// Run-specific audit preload. Git blobs live only in the sealed inherited memfd.
// Mutable owned files always use current IO. Verified immutable Git bodies
// cannot change in this view; each final check can compare their sealed digest
// after proving this exact preload's current and executed source bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
const originalSync=fs.readFileSync.bind(fs),originalAsync=fs.readFile.bind(fs),originalPromise=fs.promises.readFile.bind(fs.promises);
const head=process.env.GTA2_PIN_VIEW_HEAD,pool=originalSync(process.env.GTA2_PIN_VIEW_FD);
if(!/^[a-f0-9]{40}$/.test(head||''))throw Error('exact Git HEAD required');
const length=pool.readUInt32BE(0),manifest=JSON.parse(pool.subarray(4,4+length));
if(manifest.head!==head)throw Error('sealed source HEAD mismatch');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const owned=new Set(manifest.owned),tracked=new Set(manifest.trackedSource),immutable=new Map(),ledger=new Map();
let cursor=4+length;
for(const item of manifest.files){
  if(path.isAbsolute(item.path)||item.path.split('/').includes('..')||owned.has(item.path)||immutable.has(item.path))throw Error('invalid Git source path');
  if(!Number.isSafeInteger(item.size)||item.size<0||cursor+item.size>pool.length)throw Error('invalid Git source size');
  const bytes=pool.subarray(cursor,cursor+item.size);cursor+=item.size;
  const oid=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(oid!==item.oid)throw Error('Git object bytes changed '+item.path);
  immutable.set(item.path,Object.freeze({bytes,sha256:sha(bytes)}));
}
if(cursor!==pool.length)throw Error('trailing Git view bytes');
const immutableFinalChecks=new Map();
Object.defineProperty(globalThis,'__gta2ImmutableVerifiedViewV1',{value:Object.freeze({
  version:1,head,sourcePath:__filename,executedSHA256:globalThis.__gta2VerifiedViewExecutedSHA256??null,
  immutableDigest(relative){
    if(process.env.GTA2_PIN_VIEW_HEAD!==head||process.env.GTA2_VIEW_HEAD!==head)throw Error('current immutable view identity changed');
    if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split('/').includes('..'))throw Error('invalid immutable predicate path');
    if(owned.has(relative))return null;
    const entry=immutable.get(relative);if(!entry)return null;
    immutableFinalChecks.set(relative,(immutableFinalChecks.get(relative)??0)+1);note({rel:relative,owned:false},entry.sha256);
    return entry.sha256;
  }
})});
function select(file){
  if(typeof file!=='string')return null;
  const rel=path.relative(root,path.resolve(file));if(rel.startsWith('..')||path.isAbsolute(rel))return null;
  if(owned.has(rel))return {rel,owned:true};
  if(immutable.has(rel))return {rel,...immutable.get(rel)};
  if(tracked.has(rel))throw Error('tracked source omitted from sealed Git view '+rel);
  return null;
}
function note(s,digest){ledger.set(s.rel,{path:s.rel,view:s.owned?'fresh-owned':'sealed-Git-HEAD',sha256:digest});}
function decode(bytes,options){const encoding=typeof options==='string'?options:options?.encoding;return encoding?bytes.toString(encoding):Buffer.from(bytes);}
function syncSelected(s,file,options){
  const bytes=s.owned?originalSync(file):s.bytes;
  if(s.owned||!ledger.has(s.rel))note(s,s.owned?sha(bytes):s.sha256);
  return decode(bytes,options);
}
async function asyncSelected(s,file,options){
  if(!s.owned){if(!ledger.has(s.rel))note(s,s.sha256);return decode(s.bytes,options);}
  // Actual owned IO and audit hashing run asynchronously. Each invocation gets
  // new bytes; no stat shortcut, content cache or audit digest answers a check.
  const readOptions=typeof options==='object'&&options?{...options,encoding:null}:undefined;
  const bytes=await originalPromise(file,readOptions);
  const digest=Buffer.from(await crypto.webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
  note(s,digest);return decode(bytes,options);
}
fs.readFileSync=function(file,options){const s=select(file);return s?syncSelected(s,file,options):originalSync(file,options);};
fs.readFile=function(file,options,callback){
  if(typeof options==='function'){callback=options;options=undefined;}
  let s;try{s=select(file);}catch(error){queueMicrotask(()=>callback(error));return;}
  if(!s)return originalAsync(file,options,callback);
  asyncSelected(s,file,options).then(bytes=>callback(null,bytes),error=>callback(error));
};
fs.promises.readFile=async function(file,options){const s=select(file);return s?asyncSelected(s,file,options):originalPromise(file,options);};
for(const ext of ['.js','.json']){
  const previous=Module._extensions[ext];
  Module._extensions[ext]=(mod,file)=>{const s=select(file);if(!s)return previous(mod,file);
    const text=syncSelected(s,file,'utf8');
    if(ext==='.json')mod.exports=JSON.parse(text);else mod._compile(text,file);
  };
}
process.once('exit',code=>{
  const dir=process.env.GTA2_PIN_VIEW_OUT;if(!dir)return;
  const threadId=require('node:worker_threads').threadId;
  fs.writeFileSync(path.join(dir,'view-pins-'+process.pid+'-'+threadId+'.json'),JSON.stringify({head,pid:process.pid,threadId,code,
    manifestSHA256:sha(pool.subarray(0,4+length)),pins:[...ledger.values()],
    executedPreloadSHA256:globalThis.__gta2VerifiedViewExecutedSHA256??null,
    immutableAuditDigestReuseOnly:true,ownedAsyncIO:true,admissionChecksUnchanged:true,
    immutableFinalChecks:Object.fromEntries(immutableFinalChecks)})+'\n',{flag:'wx'});
});
