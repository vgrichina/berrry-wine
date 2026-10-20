#!/usr/bin/env node
'use strict';
// Run from repository root. Production inputs are sealed exact assembled blobs.
// The corrected helper is read from this checkout so this also works precommit.
const fs=require('node:fs'), cp=require('node:child_process'), vm=require('node:vm');
const assert=require('node:assert/strict'), crypto=require('node:crypto');
const source=process.env.SOURCE_REV || '7f31dd6f5970fb0b0b58325bf20e3624f4006401';
const seals={};
function seal(key,s){seals[key]=crypto.createHash('sha256').update(s).digest('hex');return s;}
const helper=seal('fixture:process-alias-boundary-fix',
  fs.readFileSync('docs/reviews/process-alias-boundary-fix-20261020.js','utf8'));
function fixture(mutation) {
  let replacements=0;
  const ctx={require,process:{env:{}},WebAssembly,SharedArrayBuffer,
    TextEncoder,TextDecoder,setTimeout,clearTimeout,
    readSource:p=>{
      let s=seal(`${source}:${p}`,cp.execFileSync('git',['show',`${source}:${p}`],
        {encoding:'utf8',maxBuffer:8e6}));
      if(mutation && p==='host.js') {
        const target='if (childWire) childWire.close();';
        assert.equal(s.split(target).length,2,'mutation must hit exactly once');
        s=s.replace(target,'');replacements++;
      }
      return s;
    }};
  const prefix=helper.slice(0,helper.indexOf('function blob('))
    +'function blob(p){return readSource(p);}\n'
    +helper.slice(helper.indexOf('function cut('),helper.indexOf('\n(async()=>'));
  vm.runInNewContext(prefix+'\nglobalThis.f={make,spawn,cut,shell};',ctx);
  assert.equal(replacements,mutation?1:0);
  return ctx.f;
}
async function lifecycle(mutation=false) {
  const f=fixture(mutation), outcomes=[];
  for(const mode of ['skip','normal','cancel','failure']) {
    let wire;
    const launch=vm.runInNewContext(f.cut(f.shell,'    function launchVfsExe(',
      '\n    // A program that lives only')+'\nlaunchVfsExe;',
      {Map,appendDebugLog(){}});
    const p=f.make(mode==='skip'?{launcher:(file,parent,dir,args,opts)=>{
      wire=opts.lanLink.wire;
      seed(wire);
      return launch('dxsetup.exe',parent,dir,args,opts);
    }}:{});
    const s=f.spawn(p,1),seg=p._childSegment,caller=p.vlanWire;
    if(mode!=='skip'){wire=s.opts.lanLink.wire;seed(wire);}
    // A separately attached receiver makes accidental shared/caller retirement
    // observable as well as proving that later traffic cannot reach the dead wire.
    const sibling=seg.attach();
    if(mode==='normal') {
      const child=f.make({fullStop:true});await s.opts.beforeRun(child);
      child.onStopped=s.opts.onExit;child._exitCode=19;child.stop();
    } else if(mode==='cancel') assert.equal(p.ctl(5,s.handle,77),1);
    else if(mode==='failure') s.opts.onExit(null);
    assert(!seg.endpoints.includes(wire),'completed child endpoint must leave segment');
    assert.equal(wire.segment,null);
    assert.equal(wire.pending,0,'retirement clears queued frames');
    assert.equal(wire.onFrame,null,'retirement releases frame callback');
    assert.equal(wire.onDeliver,null,'retirement releases delivery callback');
    assert.deepEqual(Array.from(seg.endpoints),[caller,sibling]);
    assert.equal(caller.pending,1,'one real GONE frame');
    const gone=caller.peek(),view=new DataView(gone.buffer,gone.byteOffset,gone.byteLength);
    assert.equal(view.getUint32(4,true),7);assert.equal(view.getUint32(8,true),123);
    caller.commit();
    const frame=new Uint8Array([1,2,3]);
    assert.equal(caller.send(frame),true);assert.equal(sibling.peek(),frame);
    assert.equal(wire.pending,0);
    wire.deliver(frame);wire.peerGone(123);assert.equal(wire.send(frame),false);
    wire.close();assert.equal(wire.pending,0);
    if(s.opts)s.opts.onExit(null);
    assert.equal(caller.pending,0,'duplicate notification cannot repeat GONE');
    assert.equal(s.rec.object.exitCode,{skip:0,normal:19,cancel:77,failure:1}[mode]);
    outcomes.push(mode);
  }
  return outcomes;
}
function seed(wire) {
  wire.deliver(new Uint8Array([9]));
  assert.equal(wire.pending,1,'real queue populated before retirement');
  wire.onFrame=()=>assert.fail('retired wire delivered callback');
  wire.onDeliver=()=>assert.fail('retired wire queued callback');
}
(async()=>{
  if(process.argv.includes('--retain-child')) {await lifecycle(true);throw Error('mutation survived');}
  const outcomes=await lifecycle();
  await assert.rejects(lifecycle(true),e=>e instanceof assert.AssertionError
    && /completed child endpoint must leave segment/.test(e.message));
  console.log(JSON.stringify({source,passed:outcomes.length,outcomes,
    rejectingControl:'exactly one host close removed; endpoint membership assertion rejects',
    seals,limits:'Production JS source slices and complete wire; environmental launch/guest resources. No game/runtime qualification.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
