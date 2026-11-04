'use strict';
// Reuse the existing instruction fixture IN MEMORY, including its real queued
// Worker commands and loader. No source copies, browser, game boot or box API.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { isMainThread } = require('node:worker_threads');
const tool = require('../tools/deusex-black-frame-binding.cjs');
const ROOT = path.resolve(__dirname, '..');
const Module = require('node:module');
function compile(filename, body) {
  const entry = new Module(filename, module); entry.filename = filename;
  entry.paths = Module._nodeModulePaths(path.dirname(filename)); entry._compile(body, filename);
}
if (!isMainThread) {
  const filename = path.join(ROOT, 'lib/guest-worker.js');
  // Test-only bootstrap visibility, exactly as Worker.evaluate in Chromium.
  // The shipped init/queue/Draw start/slice/status/stop handlers are untouched.
  compile(filename, fs.readFileSync(filename, 'utf8') + `
    globalThis.DeusExDrawObserver=DrawObserver;
    const fixtureBase=DrawObserver.OwningDrawObserver.prototype.captureIdentity;
    const probeInstaller=eval('('+${JSON.stringify(tool.installPixelBinding.toString())}+')');
    let fixtureOwner=null, fixtureProbe=null;
    function dispatchProbe(point) {
      const P=DrawObserver.OwningDrawObserver.prototype;
      if(fixtureOwner!==this) {
        fixtureOwner=this; P.captureIdentity=fixtureBase; delete P.__pixelBinding;
        const before=new Uint8Array(memory.buffer).slice();
        for(const bad of [{endpoint:endpointIdentity+1,slot:0},{endpoint:endpointIdentity,slot:1}]) {
          require('node:assert/strict').throws(()=>probeInstaller(bad),/owning/);
        }
        const fixtureMemory=memory;memory=null;
        require('node:assert/strict').throws(()=>probeInstaller({endpoint:endpointIdentity,slot:0}),/owning/);memory=fixtureMemory;
        instance.exports.set_current_thread_id(2);
        require('node:assert/strict').throws(()=>probeInstaller({endpoint:endpointIdentity,slot:0}),/owning/);
        instance.exports.set_current_thread_id(1);
        probeInstaller({endpoint:endpointIdentity,slot:0});
        require('node:assert/strict').throws(()=>probeInstaller({endpoint:endpointIdentity,slot:0}),/already/);
        require('node:assert/strict').deepEqual(new Uint8Array(memory.buffer),before);
        fixtureProbe=P.captureIdentity; P.captureIdentity=dispatchProbe;
      }
      return fixtureProbe.apply(this,arguments);
    }
    DrawObserver.OwningDrawObserver.prototype.captureIdentity=dispatchProbe;
  `);
} else {
  const report = tool.analyze();
  assert.equal(report.raw.nonzeroBytes, 0);
  assert.equal(report.checkpoints.find(s => s.point === 'lock').pixelsWa, 475484160);
  assert.equal(report.checkpoints.find(s => s.point === 'unlock').candidates[0].bitsWa, 474206208);
  const upload = report.presentationEvents.find(e => e.serial === 13);
  assert.equal(upload.surfaces[0].bitsWa, 475484160);
  assert.equal(upload.surfaces[0].canonical.nonzero, 0);
  assert.equal(report.publicationLimitReached, false);
  assert.deepEqual(report.publicationErrors, []);
  const ready = require('../tools/deusex-owning-readiness-driver.cjs');
  const source = ready.read(tool.BASELINE).toString();
  const body = tool.transform(source), old = ready.transform(source);
  new vm.Script(body);
  assert.throws(() => tool.transform(source + '\n'), /actual driver SHA/);
  assert.equal(body.slice(body.indexOf("write('producer-installed.json'")),
    old.slice(old.indexOf("write('producer-installed.json'")), 'unchanged producer, limits, collection, raw-before-PNG and cleanup');
  assert(body.includes('await bounded(owner.evaluate(require(process.cwd()'));
  // The exact accepted adapter is compiled rather than the incompatible current
  // checkout adapter. No recovery file overwrites a released production path.
  const adapter = new Module(path.join(ROOT, 'lib/deusex-ordered-producer-observer.js'), module);
  adapter.filename = path.join(ROOT, 'lib/deusex-ordered-producer-observer.js');
  adapter._compile(tool.originalAdapter().toString(), adapter.filename);
  assert.equal(typeof adapter.exports.attach, 'function');
  assert(ready.read(path.join(path.dirname(tool.BASELINE), 'producer.cjs')).includes(tool.originalAdapter()),
    'the actual retained producer embeds the byte-exact original adapter');
  let fixture = fs.readFileSync(path.join(ROOT, 'test/test-deusex-owning-draw-observer.js'), 'utf8');
  const replace = (before, after) => {
    assert.equal(fixture.split(before).length, 2, 'fixture anchor: ' + before);
    fixture = fixture.replace(before, after);
  };
  replace("workerUrl: path.resolve('lib/guest-worker.js')", 'workerUrl: ' + JSON.stringify(__filename));
  replace('await exercise(module, false); await exercise(module, true);', 'await exercise(module, true);');
  replace("'foreign-viewport-vtable', 'retired-core', 'same-address-aba', 'mismatched-window']",
    "'foreign-viewport-vtable', 'retired-core', 'same-address-aba', 'mismatched-window', 'probe-size', 'probe-depth', 'probe-stride', 'probe-stale-pointer', 'probe-rgb565']");
  replace("const fixtureWrite = (a, value) => v.setUint32(fixtureWas.get(a), value, true);",
    `const fixtureWrite = (a, value) => v.setUint32(fixtureWas.get(a), value, true);
      // Three discriminating RGB colors; opaque alpha alone must stay black.
      v.setUint32(bitsWa,0xff0000ff,true);v.setUint32(bitsWa+4,0xff00ff00,true);
      v.setUint32(bitsWa+128*31+31*4,0xffff0000,true);
      const vpWa=await call('guest_to_wasm',viewport);
      if(negative==='probe-size')v.setUint32(vpWa+0x70,2049,true);
      if(negative==='probe-depth')v.setUint32(vpWa+0x78,1,true);
      if(negative==='probe-stride')v.setUint32(vpWa+0xb4,1,true);
      if(negative==='probe-stale-pointer')v.setUint32(vpWa+0xb0,bits+4,true);
      if(negative==='probe-rgb565') {
        new Uint8Array(memory.buffer,bitsWa,4096).fill(0);
        v.setUint16(bitsWa,0xf800,true);v.setUint16(bitsWa+2,0x07e0,true);v.setUint16(bitsWa+31*64+62,0x001f,true);
        v.setUint32(vpWa+0x78,2,true);v.setUint32(bitmapRecord+16,16,true);v.setUint32(bitmapRecord+28,64,true);
      }
    `);
  replace("const unlockCall = result.identityObservations.find(s => s.point === 'unlockCall');",
    `const unlockCall = result.identityObservations.find(s => s.point === 'unlockCall');
      const probe=observed.pixelBinding;
      if(['matching','same-address-aba','mismatched-surface','mismatched-window','probe-stale-pointer','probe-rgb565'].includes(negative)) {
        assert.equal(probe.status,'checkpoint-read',JSON.stringify(probe));
        assert.equal(probe.coverage.lifetime,'unknown; identical-address ABA is unobservable');
        const rgb=probe.storages.find(s=>s.role==='viewport');
        assert.equal(rgb.nonzeroPixels,negative==='probe-stale-pointer'?2:3);
        assert(rgb.samples.length>0);assert.equal(rgb.atomic,false);
        if(negative==='matching')assert.equal(probe.candidates[0].sameStorage,true);
        if(['probe-stale-pointer','mismatched-surface'].includes(negative))assert.equal(probe.candidates[0].sameStorage,false);
        if(negative==='probe-rgb565')assert.deepEqual(rgb.samples.map(s=>s.rgb),[0xf800,0x07e0,0x001f]);
      }
      if(['probe-size','probe-depth','probe-stride'].includes(negative)) {
        assert.equal(probe.status,'unavailable');assert.match(probe.error,/invalid storage/);assert.equal(probe.storages.length,0);
      }
    `);
  replace("    if (inWorker) {\n      // Teardown is terminal for this endpoint; check it after all PE fixtures.", `
    console.log('PASS checkpoint probe in actual queued Worker: nonzero RGB565/RGB32, stale-pointer/layout, depth/size/stride, foreign endpoint/slot/thread/memory, lifetime unknown controls');
    // Recovered original-input replay in the production queued Worker, with an
    // independent integer oracle. These are retained instructions, not a boot.
    await stage(exeBytes);assert(await call('load_pe',exeBytes.length));
    const retained=JSON.parse(require('../tools/deusex-owning-readiness-driver.cjs').read(
      '${tool.RECOVERED}/producer.json'));
    const samples=retained.pixelInputs.samples;
    const sb=fs.readFileSync(system+'softdrv.dll');
    assert.equal(crypto.createHash('sha256').update(sb).digest('hex'),'25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18');await stage(sb);
    await call('load_dll',sb.length,samples[0].soft.base);
    const si=await call('get_last_loaded_dll_index');
    const sd=new DataView(memory.buffer),st=await call('get_dll_table'),sl=await call('get_dll_lifecycle_table'),ss=await call('get_dll_lifecycle_stride');
    assert(await call('complete_dll_initialize',si,sd.getUint32(sl+si*ss+4,true),3));
    assert.equal(sd.getUint32(st+si*32,true),samples[0].soft.base);
    const mmxBase=regions.UOP_CSCRATCH.base+0x139800;
    const map=async(ga,n)=>{let wa=await call('guest_to_wasm',ga);if(wa===0xf0){
      assert(await call('test_virtual_map_commit',ga&0xfffff000,Math.ceil(((ga&4095)+n)/4096)*4096));wa=await call('guest_to_wasm',ga);
    }assert.notEqual(wa,0xf0);return wa;};
    const put=async(ga,b)=>new Uint8Array(memory.buffer).set(b,await map(ga,b.length));
    // Warm the landing independently, so run(1) ends at the captured successor.
    for(const [n,val]of Object.entries({eip:samples[0].soft.base+0x36577,esi:0,esp:0}))await call('set_'+n,val);
    await call('clear_yield');await host.slice(1);
    const oracle=require(path.resolve('scratch/runs/20261104-deusex-complete-driver-input-preflight/oracle.cjs')).oracle;
    const replayRows=[];
    const replay=async(sample,label,overrides={})=>{
      assert.deepEqual(Array.from(new Uint8Array(memory.buffer,await call('guest_to_wasm',sample.eip),sample.code.bytes.length)),sample.code.bytes);
      for(const x of Object.values(sample.globals))await put(x.ga,x.bytes);
      for(const [k,val]of Object.entries(overrides.globals||{}))sd.setBigUint64(await map(sample.globals[k].ga,8),val,true);
      await put(sample.palette.ga,sample.palette.bytes);await put(sample.light.ga,sample.light.bytes);await put(sample.texel.ga,sample.texel.bytes);
      const reference=oracle(sample,overrides);await put((sample.regs.ebx+reference.ecx)>>>0,[sample.texel.bytes[0]]);
      if(overrides.palette!==undefined)sd.setBigUint64(await map(sample.paletteEntry.ga,8),overrides.palette,true);
      await put(sample.store.ga,[0x34,0x12]);
      for(const [n,val]of Object.entries(sample.regs))await call('set_'+n,val);
      for(let j=0;j<8;j++)sd.setBigUint64(mmxBase+j*8,overrides.mmx?.[j]??BigInt('0x'+sample.mmx[j]),true);
      await call('set_eip',sample.eip);await call('clear_yield');await host.slice(1);
      assert.equal(await call('get_eip'),sample.soft.base+0x36577);
      const pixel=sd.getUint16(await map(sample.store.ga,2),true);assert.equal(pixel,reference.pixel,label);
      if(label==='retained-original') {
        assert.equal(pixel,sample.after.store.bytes[0]+sample.after.store.bytes[1]*256);
        assert.deepEqual(reference.mmx,sample.after.mmx);
      }
      assert.equal(await call('get_ecx'),reference.ecx);
      assert.deepEqual(Array.from(new BigUint64Array(memory.buffer,mmxBase,8),x=>x.toString(16).padStart(16,'0')),reference.mmx);
      replayRows.push({label,pixel,index:reference.ecx,store:sample.store.ga});return pixel;
    };
    for(const s of samples)await replay(s,'retained-original');
    const s=samples[0],positive=0x4000400040004000n;
    assert.deepEqual([await replay(s,'palette-only',{palette:positive}),await replay(s,'light-only',{mmx:{4:positive}}),
      await replay(s,'palette-and-light',{palette:positive,mmx:{4:positive}})],[0,0,65535]);
    await replay(s,'index-mask',{palette:positive,mmx:{4:positive},globals:{'7d3e0':255n}});
    await replay(s,'changed-shift',{palette:positive,mmx:{4:positive},globals:{'7d3e0':255n,'7d3e8':31n}});
    await replay(s,'large-shift',{palette:positive,mmx:{4:positive},globals:{'7d3e0':255n,'7d3e8':64n}});
    await replay(s,'negative-light',{palette:positive,mmx:{4:0xc000c000c000c000n}});
    if(process.env.DEUSEX_BINDING_EVIDENCE)fs.writeFileSync(path.join(process.env.DEUSEX_BINDING_EVIDENCE,'queued-retained-replay-'+path.basename(process.env.WINE_ASSEMBLY_WASM||'normal')+'.json'),JSON.stringify({fixtureOnly:true,originalGameplay:false,rows:replayRows},null,2));
    console.log('PASS '+samples.length+' recovered exact-address original SoftDrv samples and seven nonzero/shift/light controls: actual shipped queued Worker/WASM and independent integer oracle, all MMX registers');
    if (inWorker) {
      // Teardown is terminal for this endpoint; check it after all PE fixtures.`);
  compile(path.join(ROOT, 'test/test-deusex-owning-draw-observer.js'), fixture);
}
