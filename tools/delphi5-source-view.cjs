'use strict';
// Transient sealed runtime; recovery is Git plus the separately recorded patch.
const fs=require('node:fs'), path=require('node:path'), Module=require('node:module');
const crypto=require('node:crypto');
const read=fs.readFileSync.bind(fs), hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const spec=JSON.parse(read(process.env.DELPHI5_SOURCE_FD));
const files=new Map(Object.entries(spec.files).map(([name,body])=>[path.join(spec.root,name),Buffer.from(body,'base64')]));
const wasm=read(process.env.DELPHI5_MODULE_FD);
if(hash(wasm)!==process.env.DELPHI5_MODULE_SHA256) throw Error('sealed module digest differs');
files.set(path.join(spec.root,'build/wine-assembly.wasm'),wasm);
function select(file) {
  if(typeof file!=='string') return null;
  const full=path.resolve(file), bytes=files.get(full);
  if(bytes) return bytes;
  if(full.startsWith(spec.root+'/') && /\.(js|cjs|json|wasm)$/.test(full) &&
      !full.startsWith(spec.root+'/node_modules/') && !full.startsWith(spec.root+'/scratch/') &&
      !full.startsWith(spec.root+'/test/binaries/')) throw Error('unsealed runtime dependency: '+full);
  return null;
}
const decode=(b,o)=>typeof o==='string'?b.toString(o):o?.encoding?b.toString(o.encoding):Buffer.from(b);
fs.readFileSync=(file,opts)=>{const b=select(file);return b?decode(b,opts):read(file,opts);};
const asyncRead=fs.readFile.bind(fs), promiseRead=fs.promises.readFile.bind(fs.promises);
fs.readFile=(file,opts,callback)=>{
  if(typeof opts==='function'){callback=opts;opts=undefined;}
  let b;try{b=select(file);}catch(e){queueMicrotask(()=>callback(e));return;}
  if(!b)return asyncRead(file,opts,callback);
  queueMicrotask(()=>callback(null,decode(b,opts)));
};
fs.promises.readFile=async(file,opts)=>{const b=select(file);return b?decode(b,opts):promiseRead(file,opts);};
const stream=fs.createReadStream.bind(fs);
fs.createReadStream=(file,opts)=>{
  const b=select(file);if(!b)return stream(file,opts);
  return require('node:stream').Readable.from([b.subarray(opts?.start||0,opts?.end===undefined?b.length:opts.end+1)]);
};
for(const ext of ['.js','.cjs','.json']) {
  const original=Module._extensions[ext]||Module._extensions['.js'];
  Module._extensions[ext]=(mod,file)=>{
    const b=select(file);if(!b)return original(mod,file);
    if(ext==='.json')mod.exports=JSON.parse(b.toString().replace(/^\uFEFF/,''));
    else mod._compile(b.toString(),file);
  };
}
