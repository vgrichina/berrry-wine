'use strict';
// Git-backed in-memory source view: no checkout, source archive or foreign WIP.
// Use NODE_OPTIONS=--require=... with NEVERHOOD_SETUPX_BASE pinned to a SHA.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=process.env.NEVERHOOD_SETUPX_BASE;
if(!/^[a-f0-9]{40}$/.test(base||''))throw Error('exact NEVERHOOD_SETUPX_BASE required');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=fs.readFileSync.bind(fs);
const names=cp.execFileSync('git',['ls-tree','-r','--name-only',base,'--','src','lib','tools','test','host.js'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(n=>/\.(js|cjs|json|wat|watx)$/.test(n));
const packed=cp.execFileSync('git',['cat-file','--batch'],{cwd:root,input:names.map(n=>base+':'+n+'\n').join(''),maxBuffer:100*1024*1024}),files=new Map();let at=0;
for(const n of names){const end=packed.indexOf(10,at),h=packed.subarray(at,end).toString().split(' '),size=Number(h[2]);if(h[1]!=='blob'||!Number.isSafeInteger(size))throw Error('invalid Git framing');files.set(n,Buffer.from(packed.subarray(end+1,end+1+size)));at=end+size+2;}
if(at!==packed.length)throw Error('Git trailing bytes');
const owned=['lib/ne-image.js','test/test-ne-image.js','test/test-ne-win4-dllentrypoint.js','tools/neverhood-setupx-source.cjs','tools/neverhood-setupx-qualify.cjs'];
for(const n of owned)files.set(n,read(path.join(root,n)));
const neFile='src/08c-ne-loader.wat',old=files.get(neFile).toString(),current=read(path.join(root,neFile),'utf8');
const start='  ;; Win4\'s six-argument FAR PASCAL export',end='  ;; The enclosing scope owns the process execution lease.';
function span(text){const a=text.indexOf(start),b=text.indexOf(end,a);if(a<0||b<a)throw Error('notification source markers absent');return [a,b];}
const [a,b]=span(old),[c,d]=span(current);files.set(neFile,Buffer.from(old.slice(0,a)+current.slice(c,d)+old.slice(b)));
const oldWithNotify=files.get(neFile).toString(),systemStart='  (func $win16_system_module_id ',systemEnd='  (func $win16_module_id ';
const x=oldWithNotify.indexOf(systemStart),y=oldWithNotify.indexOf(systemEnd,x),u=current.indexOf(systemStart),v=current.indexOf(systemEnd,u);
if([x,y,u,v].some(n=>n<0))throw Error('system identity source markers absent');
files.set(neFile,Buffer.from(oldWithNotify.slice(0,x)+current.slice(u,v)+oldWithNotify.slice(y)));
const pins=[...files].map(([file,body])=>({file,sha256:sha(body)}));
const select=file=>typeof file==='string'?files.get(path.relative(root,path.resolve(file))):null;
const decode=(b,opts)=>{const encoding=typeof opts==='string'?opts:opts?.encoding;return encoding?b.toString(encoding):Buffer.from(b);};
fs.readFileSync=function(file,opts){const b=select(file);return b?decode(b,opts):read(file,opts);};
const asyncRead=fs.readFile.bind(fs),promiseRead=fs.promises.readFile.bind(fs);
fs.readFile=function(file,opts,callback){if(typeof opts==='function'){callback=opts;opts=undefined;}const b=select(file);if(!b)return asyncRead(file,opts,callback);queueMicrotask(()=>callback(null,decode(b,opts)));};
fs.promises.readFile=async(file,opts)=>{const b=select(file);return b?decode(b,opts):promiseRead(file,opts);};
for(const ext of ['.js','.cjs','.json']){const prior=Module._extensions[ext]||Module._extensions['.js'];Module._extensions[ext]=(mod,file)=>{const b=select(file);if(!b)return prior(mod,file);if(ext==='.json')mod.exports=JSON.parse(b);else mod._compile(b.toString(),file);};}
function compile(output,receipt){
  const vfs=new Map();for(const [n,b]of files)if(/^src\/.*\.(wat|watx)$/.test(n)){const text=require('./watx').sourceTextFromBytes(b);for(const key of [n,n.slice(4),'./'+n.slice(4)])vfs.set(key,text);}
  const r=require('./watx-closure').compileClosure({entry:'src/main.watx',source:vfs.get('main.watx'),vfs},{tailCalls:true});if(!r.success)throw Error(r.error);
  const h=require('./region-layout-hash'),bytes=h.appendSection(Buffer.from(r.wasmBinary),h.layoutHash(r.regions.regions));
  fs.writeFileSync(output,bytes,{flag:'wx'});fs.writeFileSync(receipt,JSON.stringify({base,output,bytes:bytes.length,sha256:sha(bytes),pins},null,2),{flag:'wx'});
}
module.exports={compile,pins,base};
