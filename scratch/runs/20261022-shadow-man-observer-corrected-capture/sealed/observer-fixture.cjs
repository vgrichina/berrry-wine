'use strict';
// Host-only gate. No original Setup or WASM execution; never guest acceptance.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const {makeObserver,quotaSink,bindAttribution,outputSnapshot,pngFallback,PCS}=require('./observer.cjs');
const runtime=process.argv[2],root=runtime||'/home/user/wine-assembly';
let filesystem,host;
if(runtime){filesystem=require(root+'/lib/filesystem');host=require(root+'/lib/host-imports');}
else {
  const source=fs.readFileSync('/home/user/wine-assembly-shadow-man-error112-cause-oct22/local/historical-filesystem.js','utf8');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e');
  const c={module:{exports:{}},require:n=>require(root+'/lib/'+n.replace('./','')),console,TextEncoder,TextDecoder};
  vm.runInNewContext(source,c);filesystem=c.module.exports;
  host={createHostImports:ctx=>filesystem.createFilesystemImports(ctx)};
}
const mu=require(root+'/lib/mem-utils'),memory={buffer:new ArrayBuffer(8*1024**2)},dv=new DataView(memory.buffer);
let eax=0,esp=0x420000,eip=0x7500000;
const ex={get_image_base:()=>0x400000,get_eax:()=>eax,get_esp:()=>esp,get_eip:()=>eip,get_ebp:()=>0};
const tr=a=>mu.g2w(a,0x400000,memory.buffer),put=(a,v)=>dv.setUint32(tr(a),v,true),get=a=>dv.getUint32(tr(a),true);
let bound=null,context=null;
bindAttribution(filesystem,host,v=>bound=v,c=>context=c);
const ctx={getMemory:()=>memory.buffer,exports:ex,log:null};
const base=host.createHostImports(ctx);assert.equal(context,ctx);assert.equal(bound,ctx.vfs);
// Actual direct-createFileResult open, bypassing createFile, as used by bridge.
let forbidden=0;ctx.vfs.createFile=()=>{forbidden++;throw Error('wrong open path');};
const opened=ctx.vfs.createFileResult('C:\\windows\\temp\\_istmp1.dir\\_ins5576._mp',0xc0000000,2);
assert(opened.handle);assert.equal(forbidden,0);assert.equal(bound,ctx.vfs);
const findFile=h=>{const f=bound.getOpenFile(h);return f?{handle:h,path:f.path,position:f.pos,length:bound.files.get(f.path).data.length}:{handle:h,invalid:true};};
const rows=[],stops=[];
const observer=makeObserver({memory,exports:ex,translate:tr,emit:r=>rows.push(r),stop:(...a)=>stops.push(a),findFile});
const call=(name,caller,args,run)=>{put(esp,caller);args.forEach((v,i)=>put(esp+4+i*4,v));observer.entry(name);run();observer.exit();return rows.at(-1);};
// Exact proven unrelated read size: full successful return, no buffer access/hash.
let translations=0;
const metadata=makeObserver({memory,exports:ex,translate:a=>{if(a>=0x500000&&a<0x500000+493016)translations++;return tr(a);},emit:r=>rows.push(r),stop:(...a)=>stops.push(a),findFile});
put(esp,0x401736);[opened.handle,0x500000,493016,0x4107e8,0].forEach((v,i)=>put(esp+4+i*4,v));metadata.entry('ReadFile');put(0x4107e8,493016);eax=1;metadata.exit();
assert.equal(rows.at(-1).actual,493016);assert.equal(rows.at(-1).eax,1);assert.equal(rows.at(-1).buffer,undefined);assert.equal(translations,0);assert.equal(metadata.errors().length,0);
const payload=Buffer.alloc(6192);for(let i=0;i<payload.length;i++)payload[i]=i%251;new Uint8Array(memory.buffer,tr(0x500000),payload.length).set(payload);
let r=call('ReadFile',0x404583,[opened.handle,0x500000,6192,0x4107e8,0],()=>{put(0x4107e8,6192);eax=1;});assert.equal(r.buffer.length,6192);assert.equal(r.buffer.sha256,crypto.createHash('sha256').update(payload).digest('hex'));
put(esp,0x404779);[opened.handle,0x500000,6192,0x4107e8,0].forEach((v,i)=>put(esp+4+i*4,v));observer.entry('WriteFile');const entry=rows.at(-1);
observer.entry('GetTickCount');observer.exit();assert.equal(rows.at(-1),entry);
const bridge=base.fs_write_file_result?base:base.host;assert(bridge&&bridge.fs_write_file_result,'actual filesystem bridge');
const error=bridge.fs_write_file_result(opened.handle,0x500000,6192,0x4107e8);assert.equal(error,0);eax=1;observer.exit();r=rows.at(-1);assert.equal(r.actual,6192);assert.equal(r.file.position,6192);assert.equal(r.firstMismatch,undefined);assert.equal(entry.buffer.sha256,crypto.createHash('sha256').update(payload).digest('hex'));
const saved=new Map();const outputs=outputSnapshot(bound,(n,b)=>saved.set(n,Buffer.from(b)));assert.equal(outputs.length,1);assert.equal(outputs[0].length,6192);assert.equal(outputs[0].sha256,entry.buffer.sha256);assert.deepEqual(saved.get('output-0.bin'),payload);
r=call('WriteFile',0x404779,[0x123456,0x500000,6192,0x4107e8,0],()=>{const err=bridge.fs_write_file_result(0x123456,0x500000,6192,0x4107e8);assert.equal(err,6);eax=0;});assert.equal(r.actual,0);assert.equal(r.firstMismatch,true);
r=call('WriteFile',0x404779,[opened.handle,0x500000,6192,0x4107e8,0],()=>{put(0x4107e8,100);eax=1;});assert.equal(r.firstMismatch,true);
// Fault/oversize relevant data invalidates capture but cannot escape callback.
r=call('WriteFile',0x404779,[opened.handle,0x500000,65537,0x4107e8,0],()=>{eax=1;});assert(observer.errors().length);assert(stops.some(x=>x[0]==='observer-fault'));
const expected=[0x404278,0x404334,0x40434b,0x40436b,0x4043b3,0x4046da,0x404739,0x40473e,0x404748,0x404750,0x404779,0x404789,0x40478e,0x404798,0x4051a2,0x4051a8,0x405ea1,0x40657c,0x4065b5,0x40626f,0x40636f,0x4065bc,0x4065f2];
put(0x4107f4,0xfffffff5);put(esp,0x406571);put(esp+4,1);put(esp+8,0);put(esp+12,0);
for(const pc of expected){assert(PCS.has(pc));observer.pc(pc);assert.equal(rows.at(-1).pc,pc);assert.equal(rows.at(-1).status,-11);}const n=rows.length;observer.pc(0x405000);assert.equal(rows.length,n);
for(const ret of [0x4051ad,0x406581]){put(esp,ret);put(esp+4,0x1b98);observer.pc(0x405ea1);assert.equal(rows.at(-1).resourceCall.return,ret);assert.equal(rows.at(-1).resourceCall.resource,0x1b98);}
let writes=0,quotas=0;const sink=quotaSink(()=>writes++,{maxEvents:2,maxBytes:1024,onQuota:()=>quotas++});assert(sink.emit({a:1}));assert(sink.emit({a:2}));assert.equal(sink.emit({a:3}),false);assert.equal(sink.emit({a:4}),false);assert.equal(writes,2);assert.equal(quotas,1);assert(sink.counts().exhausted);
const tiny=quotaSink(()=>assert.fail('overquota write'),{maxBytes:1,onQuota:()=>{}});assert.equal(tiny.emit({a:1}),false);
// Error-path snapshot remains usable after observer faults. Real pngjs remotely;
// local encoder is an explicit mechanism-only stand-in, never visual evidence.
const PNG=runtime?require('/home/user/shadow-man-original-oct22/runner/node_modules/pngjs').PNG:class {constructor({width,height}){this.data=new Uint8Array(width*height*4);}static sync={write:()=>Buffer.from('mechanism-only')};};
let repaints=0;ctx.renderer={repaint:()=>repaints++,canvas:{width:2,height:2,getContext:()=>({getImageData:()=>({data:new Uint8Array(16).fill(255)})})}};
const png=pngFallback(ctx,PNG,(n,b)=>saved.set(n,b));assert.equal(png.width,2);assert.equal(repaints,1);assert(saved.has('fallback.png'));if(runtime){assert.equal(saved.get('fallback.png').subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(PNG.sync.read(saved.get('fallback.png')).width,2);}
assert.throws(()=>pngFallback(null,PNG,()=>{}),/renderer missing/);assert.throws(()=>outputSnapshot(null,()=>{}),/attribution missing/);
assert.equal(outputSnapshot(bound,()=>{})[0].sha256,entry.buffer.sha256);
console.log(JSON.stringify({pass:true,scope:runtime?'offline authentic retained host bridge plus synthetic memory/renderer; NO guest acceptance':'offline authentic filesystem with current mem-utils and factory stand-in; NO guest acceptance',checks:['unrelated successful493016 metadata only','relevant read/write complete hash/count','direct-createFileResult attribution','actual bridge write/output snapshot','nested ownership','invalid-handle and short-write rejection','observer fault contained','selected extractor/status/resource/cancel PCs','event/byte quotas stop without throw','error-path output and PNG fallback','explicit missing renderer/attribution'],pngEncoder:runtime?'authentic retained pngjs':'local mechanism stand-in',events:rows.length}));
