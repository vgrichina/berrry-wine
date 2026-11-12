'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { compileSrcWasm } = require('../compile-src');
const { WorkerLink } = require('../../lib/guest-thread-host');
const { createHostImports } = require('../../lib/host-imports');
const RPC = require('../../lib/guest-rpc');
const R = require('../../lib/render-worker');
const { Win98Renderer } = require('../../lib/renderer');
const { createCanvas } = require('../../lib/raster-canvas');
const { BASE } = require('../../lib/region-map.generated');

module.exports = async function synchronousFlipControl() {
  const extra = `
    (global $sync_fixture_front (mut i32) (i32.const 0))
    (func (export "sync_fixture_init") (result i32)
      (local $back i32) (local $f i32) (local $b i32)
      (global.set $image_base (i32.const 0x400000))
      (global.set $DX_VTBL_DDSURF2 (i32.const 0x52000000))
      (global.set $sync_fixture_front (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF2)))
      (local.set $back (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF2)))
      (local.set $f (call $dx_from_this (global.get $sync_fixture_front)))
      (local.set $b (call $dx_from_this (local.get $back)))
      (store.field DxObject misc0 (local.get $f) (local.get $back))
      (i32.store (call $dx_surf_meta_ptr (local.get $f)) (i32.const 0x30))
      (i32.store (call $dx_surf_meta_ptr (local.get $b)) (i32.const 0x14))
      (store.field DxObject flags (local.get $f) (i32.const 1))
      (store.field DxObject flags (local.get $b) (i32.const 2))
      (i32.store offset=12 (local.get $f) (i32.const 0x00020002))
      (i32.store offset=12 (local.get $b) (i32.const 0x00020002))
      (i32.store offset=16 (local.get $f) (i32.const 0x00040010))
      (i32.store offset=16 (local.get $b) (i32.const 0x00040010))
      (store.field DxObject misc1 (local.get $f) (global.get $DIB_BACKING_BASE))
      (store.field DxObject misc1 (local.get $b) (i32.add (global.get $DIB_BACKING_BASE) (i32.const 4096)))
      (call $dx_coop_hwnd_set (i32.const 0x77))
      (call $dx_exclusive_set (i32.const 1))
      (local.get $f))
    (func (export "sync_fixture_flip") (result i32)
      (call $handle_IDirectDrawSurface_Flip (global.get $sync_fixture_front)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "sync_fixture_hud")
      (local $front i32) (local $dib i32)
      (local.set $front (call $dx_from_this (global.get $sync_fixture_front)))
      (local.set $dib (load.field DxObject misc1 (local.get $front)))
      (call $page_watch_write (local.get $dib) (i32.const 2))
      (i32.store16 (local.get $dib) (i32.const 0xf800))
      (drop (call $host_gdi_surface_upload
        (i32.add (i32.const 0x200000) (call $dx_slot_of (local.get $front)))
        (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 1))))
  `;
  const module = new WebAssembly.Module(compileSrcWasm((file, source) => {
    if (process.env.D3DIM_SYNC_BASELINE && ['09a8-handlers-directx.wat','09ab-handlers-d3dim-core.wat'].includes(file))
      source = execFileSync('git', ['show', '29f6295a2:src/' + file], { encoding:'utf8', maxBuffer: 4*1024*1024 });
    return file === '13-exports.wat' ? source + extra : source;
  }));
  const memory = new WebAssembly.Memory({ initial:8192, maximum:32768, shared:true });
  const imports = {host:{memory}};
  const sigs = require('../../lib/host-import-sigs.generated.json').sigs;
  const renderer = new Win98Renderer(createCanvas(2,2)); renderer.scheduleRepaint=()=>{};
  renderer.createWindow(0x77,0x90000000,0,0,2,2,'',0);
  const ctx = { getMemory:()=>memory.buffer, renderer };
  const { host, gdi } = createHostImports(ctx);
  for (const entry of WebAssembly.Module.imports(module))
    if (entry.kind === 'function') imports.host[entry.name] = host[entry.name] || (()=>0);
  ctx.exports = new WebAssembly.Instance(module, imports).exports;
  const broker = RPC.createMainBroker(memory, imports.host, sigs);
  const link = new WorkerLink({slot:9,memory,module,sigs,broker,dxTraceLocal:true,
    workerUrl:require.resolve('../../lib/guest-worker')});
  const epoch = new R.WriterEpoch();
  const journal = new R.SurfaceVersionJournal(new SharedArrayBuffer(8 * 65536),
    new SharedArrayBuffer(4 * (16 + 2*1024*1024)));
  try {
    await link.start();
    const front = await link.callExport('sync_fixture_init');
    const dv = new DataView(memory.buffer);
    dv.setUint16(BASE.DIB_BACKING_BASE, 0xf800, true);
    dv.setUint16(BASE.DIB_BACKING_BASE + 4096, 0x07e0, true);
    link.setWriterObservation(epoch);
    const owner = {scope:'native-sync-test',endpointId:link.endpointIdentity,generation:link.endpointIdentity};
    await link._ask({t:'synchronousFlipObservation',action:'arm',endpointIdentity:link.endpointIdentity,
      owner,maxRecords:8,journalBuffer:journal.buffer,retainedBuffer:journal.retainedBuffer});
    const join = new R.SurfacePublicationJoin({epoch,journal,memory,renderer,owner,
      ownerScope:owner.scope,workerSlot:9,endpointId:link.endpointIdentity,observationGeneration:1});
    ctx.d3dimPublicationJoin = join;
    assert.equal(await link.callExport('sync_fixture_flip'), 0);
    const record = journal.records()[0];
    assert(record, 'real synchronous native Flip must produce a source witness');
    assert(!record.versionRejected, JSON.stringify(record));
    assert.equal(record.front, front); assert.equal(record.sourceKind,'synchronous-native-flip');
    assert.equal(record.layout.dib, BASE.DIB_BACKING_BASE + 4096);
    assert.equal(new DataView(journal.readRetained(record).buffer).getUint16(0,true),0x07e0);
    assert.equal(record.sourceWriter.beforeRotation.epoch,record.sourceWriter.sealExit.epoch);
    assert(record.request.serial > 0); assert(record.batch > 0);
    assert(epoch.snapshot());
    renderer.repaint();
    assert.equal(join.rows.length,1,'actual synchronous request must join canonical decode and compositor');
    assert.equal(join.rows[0].request.serial,record.request.serial);
    if (process.env.D3DIM_SYNC_EVIDENCE) console.log('SYNC_COMPLETED_SOURCE ' + JSON.stringify({record,
      retainedHex:Buffer.from(journal.readRetained(record)).toString('hex'), rows:join.rows}));
    renderer.repaint(); assert.equal(join.rows.length,1,'duplicate publication is not another completed frame');
    await link.callExport('sync_fixture_hud');
    const presentation = gdi.surfacePresentations.get(0x200000+(front-BASE.DX_OBJECTS)/32);
    assert.equal(presentation.owedPresentRequest,null,'partial HUD has no completed producer request');
    renderer.repaint();
    assert.equal(join.rows.length,1,'partial HUD cannot inherit the old retained source');
    assert.equal(renderer.canvas.getContext('2d').getImageData(0,0,1,1).data[0],255,
      'ordinary HUD pixels remain current rather than selecting the retained older image');
    assert.equal(await link.callExport('sync_fixture_flip'), 0);
    const next = journal.records()[1];
    assert(!next.versionRejected,JSON.stringify(next)); assert(next.request.serial > record.request.serial);
    assert(next.batch > record.batch); assert(journal.records()[0].superseded);
    const pending = epoch.begin();
    await link.callExport('sync_fixture_flip');
    assert.match(journal.records()[2].versionRejected,/not-sole/);
    if (process.env.D3DIM_SYNC_EVIDENCE) console.log('SYNC_CONCURRENT_REFUSAL '+JSON.stringify(journal.records()[2]));
    epoch.end(pending);
    await link.callExport('sync_fixture_flip');
    assert(!journal.records()[3].versionRejected, 'a rejected concurrent boundary does not gain retroactive coverage');
    await link._ask({t:'synchronousFlipObservation',action:'close'});
    await link.callExport('sync_fixture_flip');
    assert.equal(journal.records().length,4,'closed observer never relabels a later raw Flip');
    const negatives = new R.SurfaceVersionJournal(new SharedArrayBuffer(4*65536));
    let current;
    const negativeEpoch = new R.WriterEpoch();
    const negativeProducer = new R.SynchronousFlipProducer({memory,journal:negatives,
      getExports:()=>ctx.exports,getHandoff:()=>current,owner,generation:1,maxRecords:4});
    for (const [i,cause] of ['epoch','host','owner','stale'].entries()) {
      const ticket = negativeEpoch.begin();
      current = R.CommandWriterHandoff.create(negativeEpoch,ticket,link.endpointIdentity,100+i);
      negativeProducer.begin(record.front,record.back);
      if (cause==='epoch') { const peer=negativeEpoch.begin();negativeEpoch.end(peer); }
      if (cause==='host') negativeEpoch.invalidateVersions();
      if (cause==='owner') current={};
      if (cause==='stale') negativeProducer.lastSerial=0xffffffff;
      negativeProducer.complete(record.request.descriptor,16);
      assert(negatives.records()[i].versionRejected, cause+' must fail closed');
      negativeProducer.complete(record.request.descriptor,16);
      assert.equal(negatives.records().length,i+1,'duplicate completion cannot allocate another source');
      negativeEpoch.end(ticket);
    }
    negativeProducer.close();
    console.log('actual owning Worker synchronous native Flip source/retained-copy/concurrent rejection PASS');
  } finally { await link.stop(); }
};
