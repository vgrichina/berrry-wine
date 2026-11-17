'use strict';
// Immutable Git-backed, memory-only runtime. No checkout or source archive.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
function gitFiles(commit){
  const names=cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','src','lib','tools','index.html','host.js'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(n=>/\.(js|cjs|json|wat|watx|html)$/.test(n));
  const packed=cp.execFileSync('git',['cat-file','--batch'],{cwd:ROOT,input:names.map(n=>commit+':'+n+'\n').join(''),maxBuffer:100*1024*1024});let at=0;const files=new Map();
  for(const n of names){const end=packed.indexOf(10,at),h=packed.subarray(at,end).toString().split(' '),size=Number(h[2]);if(h[1]!=='blob'||!Number.isSafeInteger(size))throw Error('invalid Git blob');files.set(n,Buffer.from(packed.subarray(end+1,end+1+size)));at=end+size+2;}if(at!==packed.length)throw Error('Git framing');return files;
}
function compile(files){
  const read=fs.readFileSync,Module=require('node:module'),extensions={...Module._extensions};
  fs.readFileSync=function(file,options){const b=typeof file==='string'&&files.get(path.relative(ROOT,path.resolve(file)));if(!b)return read.apply(this,arguments);const enc=typeof options==='string'?options:options?.encoding;return enc?b.toString(enc):Buffer.from(b);};
  for(const ext of ['.js','.cjs','.json'])Module._extensions[ext]=(m,file)=>{const b=files.get(path.relative(ROOT,file));if(!b)return extensions[ext](m,file);if(ext==='.json')m.exports=JSON.parse(b);else m._compile(b.toString(),file);};
  try{const {sourceTextFromBytes}=require('./watx.js'),vfs=new Map();for(const [n,b]of files)if(/^src\/.*\.(wat|watx)$/.test(n)){const t=sourceTextFromBytes(b),f=n.slice(4);for(const k of [f,n,'./'+f])vfs.set(k,t);}
    const r=require('./watx-closure.js').compileClosure({entry:'src/main.watx',source:vfs.get('main.watx'),vfs},{tailCalls:true});if(!r.success)throw Error(r.error);const h=require('./region-layout-hash.js');return h.appendSection(Buffer.from(r.wasmBinary),h.layoutHash(r.regions.regions));
  }finally{fs.readFileSync=read;for(const e of ['.js','.cjs','.json'])if(extensions[e])Module._extensions[e]=extensions[e];else delete Module._extensions[e];}
}
// Passive observer of public decoded GPU records. Preserves returns/errors,
// makes no guest call, and retains bounded complete PRESENT-delimited windows.
function installObserver(root,name){
  const api=root[name];if(!api?.Executor||api.Executor.prototype.__boidsObserved)return;
  const p=api.Executor.prototype,original=p.execute;p.__boidsObserved=true;
  const trace=root.__boidsPublicTrace={kind:'public-gpu-stream-records',executor:name,counts:{},frames:[],pending:[],dropped:0,bytes:0};
  p.execute=function(rec){
    try{trace.counts[rec.name]=(trace.counts[rec.name]||0)+1;
      if(trace.pending.length<512&&trace.bytes<2097152){const row={name:rec.name,seq:rec.seq,fields:{...rec.fields},inputs:[]};for(const r of rec.refs||[])if(r.input){const b=rec.arena(r.pos,r.len);if(b.length+trace.bytes>2097152){trace.dropped++;continue;}row.inputs.push({pos:r.pos,bytes:Array.from(b)});trace.bytes+=b.length;}trace.pending.push(row);}else trace.dropped++;
    }catch(e){trace.error=String(e);}
    const result=original.call(this,rec);
    if(rec.name==='PRESENT'){trace.frames.push({at:Date.now(),records:trace.pending,stats:this.stats?.()});if(trace.frames.length>2)trace.frames.shift();trace.pending=[];trace.bytes=0;}
    return result;
  };
}
function selectWindow(w){
  const wins=Object.values(w.renderer?.windows||{}).filter(v=>v.visible&&!v.isChild&&v.w>0&&v.h>0&&v.processId===w.processId&&v.wasm===w.instance);
  if(wins.length!==1)throw Error('ambiguous or missing live app window');return wins[0];
}
function installSoftwareObserver(root){
  const api=root.D3DIMRenderWorker,create=api.create;
  api.create=function(options){const adapter=create.call(this,options),execute=adapter.execute;
    const trace=root.__boidsPublicTrace={kind:'public-d3dim-raster-arguments',records:[],completed:0,dropped:0};
    adapter.execute=function(message){let row;
      try{if(message.opcode===0x20000){const d=new DataView(options.memory.buffer),a=Array.from({length:6},(_,i)=>d.getUint32(message.wa+i*4,true)),e=options.instance.exports;
        const state=e.guest_to_wasm(a[5])>>>0,vertices=e.guest_to_wasm(a[3])>>>0;
        row={at:Date.now(),args:a,state:Array.from(new Uint8Array(options.memory.buffer,state,4096)),vertices:Array.from(new Uint8Array(options.memory.buffer,vertices,Math.min(a[4]*32,262144))),complete:false};
        if(trace.records.length===32){trace.records.shift();trace.dropped++;}trace.records.push(row);
      }}catch(error){trace.error=String(error);}
      const result=execute.call(this,message);if(row){row.complete=true;trace.completed++;}return result;
    };return adapter;
  };
}
module.exports={gitFiles,compile,installObserver,selectWindow,installSoftwareObserver};
