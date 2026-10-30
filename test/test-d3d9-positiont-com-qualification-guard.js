#!/usr/bin/env node
'use strict';
// Offline guard/oracle/transport tests. These do NOT qualify COM or native heap.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const Input=require('./support/positiont-com-module');
const Fixture=require('./test-d3d9-positiont-com-qualification');
const {CommandQueue,OPCODES}=require('../lib/d3d-command-stream');
const {classifyTest}=require('../tools/test-tiers');
async function run() {
  let checks=0;
  const pass=name=>{checks++;console.log(`PASS ${name}`);};
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'positiont-com-guard-'));
  try {
    const rejectImport=path.join(temporary,'reject-import.js');
    fs.writeFileSync(rejectImport,`const M=require('module'),load=M._load;
      M._load=function(id,...args){if(/(?:compile-src|render-helper|watx|canvas|host-imports)/.test(id))
        throw Error('FORBIDDEN DEFAULT COMPILER/HOST IMPORT '+id);return load.call(this,id,...args);};`);
    for(const [script,args,pattern] of [
      ['test-d3d9-positiont-com-qualification.js',[],/NO COMPILE/],
      ['test-d3d9-positiont-com-qualification.js',['--qualify'],/NO COMPILE/],
      ['test-d3d9-positiont-com-qualification.js',['--compile'],/unknown argument/],
      ['support/positiont-com-module.js',[],/no default compilation/],
    ]) {
      const r=spawnSync(process.execPath,['--require',rejectImport,path.join(__dirname,script),...args],
        {encoding:'utf8',timeout:10000,maxBuffer:65536});
      assert.strictEqual(r.status,1,`${script}: fail closed`);assert.match(r.stderr,pattern);
      assert(!r.stderr.includes('FORBIDDEN DEFAULT'),r.stderr);
    }
    pass('default CLI and incomplete/build flags fail before compiler/host imports');
    assert.throws(()=>Fixture.options(['--qualify','--allow-512m','--module=x','--provenance=y','--negative-control=unknown']),/unknown negative/);
    assert.throws(()=>Fixture.options(['--qualify','--allow-512m','--module=x','--module=z','--provenance=y']),/duplicate/);
    pass('unknown control/duplicate module rejected');
    // A minimal WASM envelope tests metadata/export refusal with no memory.
    const bytes=Buffer.from([0,97,115,109,1,0,0,0]),p=Input.provenance(bytes);
    Input.validateProvenance(p,bytes);
    for(const key of ['schema','candidate','acceptance','sourcePinsSha256','extraWatSha256',
      'moduleSha256','moduleBytes','sourceEntry','transform','tailCalls','initialPages','maximumPages','shared']) {
      const changed={...p,[key]:null};assert.throws(()=>Input.validateProvenance(changed,bytes),/provenance mismatch/);
    }
    assert.throws(()=>Input.validateProvenance(p,Buffer.concat([bytes,Buffer.from([0])])),/provenance mismatch/);
    pass('13 provenance fields plus changed module bytes reject; metadata positive control passes');
    assert.throws(()=>Input.validateExports(new WebAssembly.Module(bytes)),/missing diagnostic\/native export/);
    pass('export-incompatible native module rejected without instantiation');
    // Exercise ONLY the helper's prebuilt entry branch with a real empty module
    // and a 64 KiB memory. Canvas/host stand-ins do not qualify COM or heap.
    const vm=require('vm'),exports={},memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true});
    let compilerImports=0;
    const context={module:{exports},exports,__dirname:path.join(__dirname),WebAssembly,Uint8Array,Map,
      require(id) {
        if(id==='./compile-src'){compilerImports++;throw Error('compiler forbidden in prebuilt helper');}
        if(id==='../lib/canvas-compat')return {createCanvas:()=>({})};
        if(id==='../lib/host-imports')return {createHostImports:()=>({host:{}})};
        if(id==='../lib/renderer')return {Win98Renderer:class {}};
        if(id==='../lib/font-substitutions')return {};
        return require(id);
      }};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'render-helper.js'),'utf8'),context);
    const boot=context.module.exports.bootRenderHarness,emptyModule=new WebAssembly.Module(bytes);
    const harness=await boot({prebuiltModule:emptyModule,memory,fonts:'none'});
    assert(harness.instance instanceof WebAssembly.Instance);assert.strictEqual(harness.module,emptyModule);
    await assert.rejects(boot({prebuiltModule:emptyModule,extraWat:'(func)',memory,fonts:'none'}),/prebuiltModule requires/);
    await assert.rejects(boot({prebuiltModule:{},memory,fonts:'none'}),/prebuiltModule requires/);
    assert.strictEqual(compilerImports,0);
    pass(`prebuilt render-helper branch: real empty module SHA256=${Input.sha256(bytes)}, memory=65536, compiler imports=0; host/canvas stand-ins ONLY`);
    const modulePath=path.join(temporary,'empty.wasm'),provenancePath=path.join(temporary,'input.json');
    fs.writeFileSync(modulePath,bytes);fs.writeFileSync(provenancePath,JSON.stringify({...p,candidate:'main'}));
    const r=spawnSync(process.execPath,['--require',rejectImport,path.join(__dirname,'test-d3d9-positiont-com-qualification.js'),
      '--qualify','--allow-512m',`--module=${modulePath}`,`--provenance=${provenancePath}`],
      {encoding:'utf8',timeout:10000,maxBuffer:65536});
    assert.strictEqual(r.status,1);assert.match(r.stderr,/provenance mismatch: candidate/);
    assert(!r.stderr.includes('FORBIDDEN DEFAULT'),r.stderr);
    fs.writeFileSync(provenancePath,JSON.stringify(p));
    assert.throws(()=>Input.loadPrebuilt(modulePath,provenancePath),/missing diagnostic\/native export/);
    assert.throws(()=>Input.loadPrebuilt('',provenancePath),/compilation is disabled/);
    assert.throws(()=>Input.verifySources(temporary),/ENOENT/);
    const first=Object.keys(require('./support/positiont-com-source-pins.json'))[0];
    fs.mkdirSync(path.dirname(path.join(temporary,first)),{recursive:true});
    fs.writeFileSync(path.join(temporary,first),'wrong source');
    assert.throws(()=>Input.verifySources(temporary),/candidate source mismatch/);
    pass('CLI wrong-candidate provenance, missing module and missing source fail before host import');
    const good=Fixture.expectedFrame();Fixture.frameOracle(good,true,'positive oracle');
    assert.strictEqual(Array.from(good).filter((n,i)=>i%4===2&&n===255).length,10);
    assert.throws(()=>Fixture.frameOracle(Fixture.expectedFrame(false),true,'black-frame negative'),assert.AssertionError);
    const broken=good.slice();broken[0]=255;
    assert.throws(()=>Fixture.frameOracle(broken,true,'single-pixel negative'),assert.AssertionError);
    assert.throws(()=>Fixture.frameOracle(good,false,'depth-negative'),assert.AssertionError);
    pass('analytic full-frame oracle rejects black, wrong pixel and wrong depth outcome');
    assert.throws(()=>Fixture.routeOracle({},true,'disabled shared route'),assert.AssertionError);
    assert.throws(()=>Fixture.routeOracle({nativeFixed:{}},false,'unsafe RHW wrongly admitted'),assert.AssertionError);
    pass('disabled route and unsafe reciprocal false-admission controls reject descriptors');
    // Actual queue implementation (no guest/heap claim). The intentional
    // alias control must fail the same byte oracle the copying case passes.
    for(const alias of [false,true]) {
      let release,observed;const gate=new Promise(resolve=>release=resolve);
      const q=new CommandQueue({deviceId:1,capacityBytes:65536,consumer:{execute(c){
        if(c.payload.gate)return {value:1,completion:gate};observed=c.payload;return {value:1,complete:true};
      }}});
      q.submit(OPCODES.FENCE,{gate:true});
      const original={vertices:Uint8Array.from([1,2,3]),indices:Uint16Array.from([2,1,0]),
        nativeFixed:{vertex:{nativeBytes:Uint8Array.from([4,5])}}};
      const t=q.submit(OPCODES.DRAW,original,alias?{owned:true}:undefined);
      original.vertices.fill(99);original.indices.fill(99);original.nativeFixed.vertex.nativeBytes.fill(99);
      release();await q.fence(t.sequence);
      const oracle=()=>{
        assert.deepStrictEqual(Array.from(observed.vertices),[1,2,3]);
        assert.deepStrictEqual(Array.from(observed.indices),[2,1,0]);
        assert.deepStrictEqual(Array.from(observed.nativeFixed.vertex.nativeBytes),[4,5]);
      };
      if(alias)assert.throws(oracle,assert.AssertionError);else oracle();
    }
    pass('real CommandQueue copies vertex/index/IR bytes; intentional alias fails byte oracle (offline only)');
    // Catch nonexistent COM handler aliases without compiling any closure.
    const handlers=['09ad-handlers-d3d9.wat','09ae-d3d9-resources.wat']
      .map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
    const targets=[...Input.extraWat.matchAll(/\(call \$(handle_[^\s()]+)/g)].map(m=>m[1]);
    for(const target of targets)assert(handlers.includes(`(func $${target} `),`absent handler ${target}`);
    assert(!Input.extraWat.includes('(func $heap_alloc'),'no test allocator');
    pass(`${targets.length} diagnostic COM wrappers resolve to production handlers, including shared Release aliases`);
    assert.strictEqual(classifyTest('test/test-d3d9-positiont-com-qualification.js'),'e2e');
    assert.strictEqual(classifyTest('test/test-d3d9-positiont-com-qualification-guard.js'),'unit');
    pass('qualification requires explicit e2e invocation; offline guards in unit tier');
    console.log(`${checks} offline control groups PASS; full COM/native heap NOT EXECUTED; qualification memory=0 pages; helper entry memory=65536; source compiler calls=0`);
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}
run().catch(error=>{console.error(error.stack);process.exitCode=1;});
