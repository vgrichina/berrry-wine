#!/usr/bin/env node
'use strict';
// Run in a repository containing the exact reviewed commits. No source checkout
// or production modification: all executable source is read from Git blobs.
const fs = require('node:fs'), cp = require('node:child_process');
const vm = require('node:vm'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const FIX = '53b4132878e86fc5afdf5f4fd6c64cd60925c9af';
const PARENT = '659a2c6d6974c447a21dd2905cd7a2c2c1e23382';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const seals = {};
function read(p, rev=FIX) {
  const s=cp.execFileSync('git',['show',`${rev}:${p}`],{encoding:'utf8',maxBuffer:8e6});
  seals[`${rev}:${p}`]=sha(s); return s;
}
const helper=read('docs/reviews/process-alias-boundary-fix-20261020.js');
// Preserve the submitted assertions and fixtures. Replace only its working-file
// loader with exact Git blobs so this sparse review cannot use ambient files.
const loaded=helper.slice(0,helper.indexOf('function blob('))+
  'function blob(p,rev){return readExact(p,rev);}\n'+helper.slice(helper.indexOf('function cut('));
async function execute(source, rev=FIX, filter='') {
  let result, error;
  const processFixture={env:{ALIAS_FILTER:filter},exitCode:0};
  const context={require,readExact:(p,r)=>read(p,r||rev),process:processFixture,
    console:{log:s=>{result=JSON.parse(s);},error:e=>{error=String(e.stack||e);}},
    WebAssembly,SharedArrayBuffer,TextEncoder,TextDecoder,Float32Array,Float64Array,
    Uint8Array,ArrayBuffer,Map,Set,RegExp,Array,Object,String,Number,Math,Promise,Date,
    setTimeout,clearTimeout,setImmediate,parseInt,parseFloat,isNaN};
  await vm.runInNewContext(source,context);
  return {result,error,exitCode:processFixture.exitCode};
}
const independent=`
(async()=>{
  const outcomes=[];
  // Three std entries exercise both unique attach and shared-port set_std.
  function piped(p) {
    const v=new DataView(p.memory.buffer);
    [[0,0,7,11],[1,1,8,12],[2,1,8,12]].flat().forEach((n,i)=>v.setInt32(1024+i*4,n,true));
    const pid=p.h.process_spawn(0,0,123,1024,3);
    return {pid,handle:0xe40000|pid,rec:p._children.get(pid),opts:p.launches.at(-1)[4]};
  }
  const sequence=['set_vlan_local_ip','pipe_detach_console','pipe_attach_std','pipe_attach_std','pipe_set_std'];
  for(let boundary=0;boundary<sequence.length;boundary++)for(const reject of [false,true]){
    const p=make(),s=piped(p),c=make({fullStop:true});
    const a=dup(p,s.handle),object=s.rec.object;
    let eof=0,calls=[],release,arrived;
    const reached=new Promise(r=>arrived=r);
    p.vlanWire.peerGone=()=>eof++;
    c.onStopped=s.opts.onExit;
    c.callGuest=(name,...args)=>{
      calls.push(name);
      if(calls.length===boundary+1){arrived();return new Promise((r,j)=>release=()=>reject?j(Error('guest interrupted')):r(91));}
      return Promise.resolve(91);
    };
    const boot=s.opts.beforeRun(c);
    await reached;
    assert.equal(object,c._processObject);
    assert.equal(p.ctl(7,s.handle,0),1);
    assert.equal(p.ctl(5,a,0xffffffff),1);
    assert.equal(p.ctl(8,a,0),0);
    release();
    await assert.rejects(boot,reject?/guest interrupted/:/terminated during attachment/);
    const failure=failLaunch(s.opts,c);
    failure(Error('outer'));failure(Error('outer again'));c.stop();s.opts.onExit(c);
    assert.equal(p.ctl(4,a,0),0xffffffff);
    assert.equal(s.rec.exitCode,0xffffffff);
    assert.equal(s.rec.object,object);
    assert.equal(object.wine,null);assert.equal(object.complete,undefined);
    assert.equal(c._processAliases.size,0);assert.equal(p._children.has(s.pid),false);
    assert.equal(eof,1);
    assert.deepEqual(calls,sequence.slice(0,boundary+1));
    outcomes.push('cancel at '+boundary+' '+sequence[boundary]+' '+(reject?'reject':'resolve'));
  }
  // Complete VFS implementation, including actual create/write/delete/close.
  const mod={exports:{}};
  vm.runInNewContext(blob('lib/filesystem.js'),{module:mod,console:quiet,TextEncoder,TextDecoder,Uint8Array,Map,Set,Date});
  const VFS=mod.exports.VirtualFS;
  for(const close of [false,true])for(const throws of [false,true]){
    const p=make(),vfs=new VFS();
    p._helpCtx.vfs=vfs;
    function write(v,path,text){const h=v.createFile(path,0x40000000,2);assert(h);const bytes=new TextEncoder().encode(text);v.writeFile(h,bytes,bytes.length);v.closeHandle(h);}
    write(vfs,'C:\\\\keep.txt','original');write(vfs,'C:\\\\delete.txt','delete');
    const s=spawn(p),c=make({fullStop:true}),childVfs=new VFS();
    childVfs.files=new Map(vfs.files);childVfs.dirs=new Set(vfs.dirs);c._helpCtx.vfs=childVfs;
    write(childVfs,'C:\\\\keep.txt','changed');childVfs.deleteFile('C:\\\\delete.txt');
    const alias=dup(p,s.handle);let merges=0;
    const real=vfs.mergeChildFrom;
    vfs.mergeChildFrom=function(...args){merges++;const result=real.apply(this,args);if(throws)throw Error('journal observation failure');return result;};
    await s.opts.beforeRun(c);c.onStopped=s.opts.onExit;
    if(close)p.ctl(7,s.handle,0);
    c._exitCode=259;c.stop();s.opts.onExit(c);failLaunch(s.opts,c)(Error('late notification'));c.stop();
    assert.equal(merges,1);assert.equal(p.ctl(4,alias,0),259);assert.equal(p.ctl(8,alias,0),0);
    assert.equal(new TextDecoder().decode(vfs.files.get(vfs._resolvePath('C:\\\\keep.txt')).data),'changed');
    assert.equal(vfs.files.has(vfs._resolvePath('C:\\\\delete.txt')),false);
    assert.equal(s.rec.object.complete,undefined);assert.equal(s.rec.object.wine,null);
    outcomes.push('real VFS merge once close='+close+' throwing observer='+throws);
  }
  // Pending cancellation must not merge an unrun child's preboot files.
  for(const code of [0,259,0xffffffff]){
    const p=make(),s=spawn(p),c=make({fullStop:true}),a=dup(p,s.handle);
    p._helpCtx.vfs.mergeChildFrom=()=>{throw Error('unexpected unrun VFS merge');};
    c.onStopped=s.opts.onExit;
    assert.equal(p.ctl(5,a,code),1);
    await assert.rejects(s.opts.beforeRun(c),/terminated before attachment/);
    failLaunch(s.opts,c)(Error('cancelled'));
    assert.equal(p.ctl(4,a,0),code);assert.equal(c._stopped,true);
    outcomes.push('pre-attach nonpipe cancellation '+code);
  }
  console.log(JSON.stringify({outcomes,passed:outcomes.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
`;
(async()=>{
  const replay=await execute(loaded);
  assert.equal(replay.exitCode,0,replay.error);
  assert.equal(replay.result.passed,14);
  assert.equal(replay.result.observations.submittedReplay.groups,17);
  const controls=[];
  for(const filter of ['A1 actual beforeRun','A2 compiled pending','A3 complete actual']){
    const old=await execute(loaded,PARENT,filter);
    assert.equal(old.exitCode,1,filter);
    assert.match(old.error,/AssertionError/);
    controls.push({filter,error:old.error});
  }
  const prefix=loaded.slice(0,loaded.indexOf('(async()=>'));
  const extra=await execute(prefix+independent);
  assert.equal(extra.exitCode,0,extra.error);
  // Reject removing the cancellation post-await guard, and the once-only hook.
  const mutations=[];
  for(const [name,from,to] of [
    ['post-await cancellation',"if (rec.object.exited) throw new Error('process_spawn: process terminated during attachment');\n          return result;",'return result;'],
    ['completion guard','if (rec.exited) return;','/* mutation removes once-only guard */'],
  ]){
    const altered=prefix.replace('return readExact(p,rev);',
      `let s=readExact(p,rev);if(p==='host.js'){if(!s.includes(${JSON.stringify(from)}))throw Error('mutation absent');s=s.replace(${JSON.stringify(from)},${JSON.stringify(to)});}return s;`);
    const r=await execute(altered+independent);
    assert.equal(r.exitCode,1,name);assert.match(r.error,/AssertionError/);
    mutations.push({name,error:r.error});
  }
  console.log(JSON.stringify({tested:FIX,parent:PARENT,replay:replay.result,controls,
    independent:extra.result,additionalMutationControls:mutations,seals},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
