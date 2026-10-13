#!/usr/bin/env node
'use strict';
// Diagnostic-only frozen builds and Node preload. Never use these for timing.
// build: node tools/bench-mixed-census.js build FROZEN_SRC ARTIFACT_DIR OUT_DIR
// run: MIXED_CENSUS_OUT=out.json node --require=/abs/path/to/this.js test/run.js ...
const fs=require('fs'),path=require('path'),assert=require('assert');
function once(s,a,b){assert.equal(s.split(a).length,2,`unique seam ${a.slice(0,80)}`);return s.replace(a,b);}
function instrument(name,text){
  if(name==='01-header.wat') return text+'\n(import "host" "mixed_census" (func $mixed_census (param i32 i32 i32 i32 i32)))\n'+
    '(export "mixed_census_block_enabled" (global $block_exec_enabled))\n';
  if(name==='07b-loop-match.wat') {
    for(const fn of ['x87_island_generic','x87_island_fast']) {
      const a=text.indexOf('(func $'+fn),b=text.indexOf('(func ',a+6);assert(a>=0&&b>a);
      let s=text.slice(a,b);
      s=once(s,'(local $count i32) (local $i i32) (local $addr i32)',
        '(local $count i32) (local $i i32) (local $addr i32) (local $dc_ints i32) (local $dc_ip i32)');
      s=once(s,'(local.set $cursor (global.get $ip))',
        '(local.set $dc_ip (global.get $ip)) (local.set $cursor (global.get $ip))');
      s=once(s,'(block $done (loop $each',`(block $done (loop $each
        (if (i32.eq (local.get $fn) (i32.const 3)) (then (local.set $dc_ints (i32.add (local.get $dc_ints) (i32.const 1)))))
        (if (i32.eq (local.get $fn) (i32.const 64)) (then (local.set $dc_ints (i32.add (local.get $dc_ints) (i32.const 256)))))
        (if (i32.eq (local.get $fn) (i32.const 65)) (then (local.set $dc_ints (i32.add (local.get $dc_ints) (i32.const 65536)))))`);
      s=once(s,'(global.set $ip (local.get $cursor))',
        `(call $mixed_census (i32.const ${fn.endsWith('fast')?0:1}) (global.get $eip) (local.get $dc_ip) (local.get $count) (local.get $dc_ints))\n    (global.set $ip (local.get $cursor))`);
      text=text.slice(0,a)+s+text.slice(b);
    }
  }
  if(name==='07c-block-exec.wat') {
    // Count precisely the absorbed-record checks that reject an integer.
    const seam='(local.set $pe (i32.load (local.get $pe)))';
    assert.equal(text.split(seam).length,3);
    text=text.replaceAll(seam,seam+`
      (if (i32.or (i32.eq (local.get $pe) (i32.const 3))
            (i32.or (i32.eq (local.get $pe) (i32.const 64)) (i32.eq (local.get $pe) (i32.const 65))))
        (then (call $mixed_census (i32.const 2) (local.get $start_eip) (i32.const 0) (local.get $pe) (i32.const 0))))`);
  }
  return text;
}
function build(src,artifacts,out){
  const {compileClosure}=require('./watx-closure');
  const {layoutHash,appendSection}=require('./region-layout-hash');
  const {transform}=require('./bench-mw3-mixed-build');
  assert(!fs.existsSync(out),'fresh output directory required');fs.mkdirSync(out,{recursive:true});
  for(const arm of ['baseline','candidate']) {
    const raw=new Map(fs.readdirSync(src).filter(n=>/\.watx?$/.test(n)).map(n=>[n,fs.readFileSync(path.join(src,n),'utf8')]));
    for(const [n,s]of raw)if(arm==='candidate')raw.set(n,transform(n,s));
    const compile=diag=>{
      const vfs=new Map();for(const [n,s]of raw)for(const key of [n,'src/'+n,'./'+n])vfs.set(key,diag?instrument(n,s):s);
      const r=compileClosure({source:raw.get('main.watx'),vfs,entry:'src/main.watx'},{tailCalls:true});assert(r.success,r.error);
      const buf=appendSection(Buffer.from(r.wasmBinary),layoutHash(r.regions.regions));assert(WebAssembly.validate(buf));return buf;
    };
    assert(compile(false).equals(fs.readFileSync(path.join(artifacts,arm+'.wasm'))),arm+' must reproduce frozen artifact');
    fs.writeFileSync(path.join(out,arm+'.wasm'),compile(true));console.log('built diagnostic '+arm);
  }
}
function preload(){
  const spec=process.env.MIXED_CENSUS_OUT;if(!spec)return;
  const arg=n=>process.argv.find(a=>a.startsWith('--'+n+'='))?.split('=').slice(1).join('=');
  const output=spec.replace('%APP%',arg('app')||'kernel').replace('%ARM%',path.basename(arg('wasm')||'kernel','.wasm'));
  const instances=[],rows=new Map();
  function prepare(module,imports){
    if(!WebAssembly.Module.imports(module).some(i=>i.name==='mixed_census'))return null;
    const record={id:instances.length,instance:null};instances.push(record);
    imports.host.mixed_census=(kind,eip,ip,count,ints)=>{
      const add=ints&255,inc=(ints>>>8)&255,dec=(ints>>>16)&255;
      const key=[record.id,kind,eip>>>0,count,ints>>>0].join(':');
      let r=rows.get(key);if(!r){r={instance:record.id,kind,eip:'0x'+(eip>>>0).toString(16),firstStream:ip>>>0,ops:count,add,inc,dec,entries:0};rows.set(key,r);}
      r.entries++;
    };return record;
  }
  const original=WebAssembly.instantiate,OriginalInstance=WebAssembly.Instance;
  WebAssembly.instantiate=async function(source,imports){
    const module=source instanceof WebAssembly.Module?source:await WebAssembly.compile(source);
    const record=prepare(module,imports);const result=await original.call(WebAssembly,source,imports);
    if(record)record.instance=result.instance||result;return result;
  };
  WebAssembly.Instance=new Proxy(OriginalInstance,{construct(target,args){const record=prepare(...args);const instance=Reflect.construct(target,args);if(record)record.instance=instance;return instance;}});
  process.on('exit',()=>{
    if(!instances.length)return;
    const data={diagnosticOnly:true,argv:process.argv,node:process.version,
      instances:instances.map(r=>({id:r.id,blockExecutorEnabled:r.instance?.exports.mixed_census_block_enabled.value})),
      rows:[...rows.values()].sort((a,b)=>b.entries-a.entries)};
    // Read live unpacked guest bytes after the route, outside its execution.
    // Moorhuhn's on-disk EXE is packed, so static PE disassembly is unsuitable.
    if(process.env.MIXED_CENSUS_CODE==='1'){
      const seen=new Set();data.code=[];
      for(const r of data.rows){if(r.kind>1||seen.has(r.eip))continue;seen.add(r.eip);
        const e=instances[r.instance].instance.exports,bytes=Buffer.alloc(512),va=Number(r.eip);
        for(let i=0;i<bytes.length;i++)bytes[i]=e.guest_read8(va+i);
        data.code.push({eip:r.eip,hex:bytes.toString('hex')});if(data.code.length===32)break;
      }
    }
    fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');
  });
}
module.exports={instrument};
if(require.main===module){const [mode,...args]=process.argv.slice(2);assert.equal(mode,'build');assert.equal(args.length,3);build(...args.map(a=>path.resolve(a)));}else preload();
