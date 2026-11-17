'use strict';
// Local diagnostic ablations of the rejected observer. No original launch is
// exposed here. Read historical helper inputs without rewriting their evidence.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const PRIOR = path.join(ROOT, 'scratch/runs/20261106-conan-zero-world-origin');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const modes = ['baseline', 'full', 'no-resident-scan', 'no-store-hit', 'no-snapshots', 'no-native-markers', 'single-resident', 'single-live-resident'];

function specializeSingleResident(source, reuse = false) {
  // Exact specialization of the existing first epoch. No cached translations,
  // narrowed watch ranges, omitted stores or changed completeness guards.
  const start = source.indexOf('(func $cww_hit');
  assert(start >= 0);
  const begin = source.indexOf('(local.set $owner (call $cfl_get_owner (local.get $i)))',start);
  const end = source.indexOf('(local.set $i (i32.add (local.get $i) (i32.const 1)))',begin);
  assert(begin >= start && end > begin);
  let body = source.slice(begin,end);
  for (const field of ['owner','dead']) body = body.replaceAll('(call $cfl_get_'+field+' (local.get $i))','(global.get $cfl_'+field+'_1)');
  body = body.replaceAll('(call $cfl_set_invalid (local.get $i) (i32.const 1))','(global.set $cfl_invalid_1 (i32.const 1))');
  assert(!body.includes('(local.get $i)'));
  const anchor = '(global.set $cfl_hitowner (i32.const 0)) (local.set $i (i32.const 1))';
  assert.equal(source.slice(start).split(anchor).length-1,1);
  const condition = reuse ? '(global.get $cfl_single)' : '(i32.eq (global.get $cfl_next) (i32.const 1))';
  let result = source.slice(0,start) + source.slice(start).replace(anchor,
    '(if '+condition+' (then\n'+
    '(global.set $cfl_hitowner (i32.const 0))\n'+body+'\n(return (i32.const 0))))\n'+anchor);
  if (reuse) {
    // Reuse of slot 1 keeps the specialization; allocating any other slot
    // permanently returns to the generic path. Generation counters stay intact.
    const birth = '(call $cfl_note (local.get $i) (i32.const 1)) (local.get $i))';
    assert.equal(result.split(birth).length-1,1);
    result = result.replace(birth,
      '(global.set $cfl_single (i32.and (i32.eq (local.get $i) (i32.const 1)) '+
      '(i32.or (global.get $cfl_single) (i32.eq (global.get $cfl_next) (i32.const 1)))))\n'+birth);
    result += '\n(global $cfl_single (mut i32) (i32.const 0))\n';
  }
  return result;
}

function historicalLoader(out) {
  const cache = new Map(), inputs = [], writes = [];
  function load(name) {
    assert(/^[a-z-]+\.cjs$/.test(name));
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(PRIOR, name);
    let source = fs.readFileSync(filename, 'utf8');
    inputs.push({path: path.relative(ROOT, filename), sha256: sha(source)});
    if (name === 'lifetime-transform.cjs') {
      // Current compiler already emits CALL/RET seams unconditionally. Only
      // ENTRY retains the old pending_armed gate; do not duplicate seams.
      const compiler = fs.readFileSync(path.join(ROOT,'src/07e-uop-compiler.wat'),'utf8');
      assert.equal(compiler.split('(if (global.get $pending_armed) (then').length - 1, 1);
      for (const marker of [79,80]) assert.equal(compiler.split('(call $uc_o' + (marker===79?'3':'2') + ' (i32.const ' + marker + ')').length-1,1);
      const old = 'source.split(anchor).length!==4';
      assert.equal(source.split(old).length-1,1);
      source = source.replace(old,'source.split(anchor).length!==2');
    }
    const module = {exports: {}};
    cache.set(name, module);
    const localFs = Object.create(fs);
    localFs.writeFileSync = (target, bytes) => {
      assert.equal(path.resolve(target), path.join(PRIOR, 'store-sites.json'));
      writes.push({originalPath: target, output: 'store-sites.json', sha256: sha(bytes)});
      fs.writeFileSync(path.join(out, 'store-sites.json'), bytes);
    };
    const localRequire = request => request === 'node:fs' ? localFs :
      request.startsWith('./') ? load(path.basename(request)) : require(request);
    new vm.Script('(function(require,module,exports,__dirname){\n' + source + '\n})', {filename})
      .runInThisContext()(localRequire, module, module.exports, PRIOR);
    return module.exports;
  }
  return {load, inputs, writes};
}

// Balanced forms, with strings and nested comments excluded from structure.
function replaceFunction(source, name, replacement) {
  let i = 0, start = -1, depth = 0, comment = 0, string = false;
  const matches = [];
  while (i < source.length) {
    if (comment) {
      if (source.startsWith('(;', i)) { comment++; i += 2; }
      else if (source.startsWith(';)', i)) { comment--; i += 2; }
      else i++;
      continue;
    }
    if (string) {
      if (source[i] === '\\') i += 2;
      else if (source[i++] === '"') string = false;
      continue;
    }
    if (source.startsWith(';;', i)) { const e = source.indexOf('\n', i); i = e < 0 ? source.length : e; continue; }
    if (source.startsWith('(;', i)) { comment++; i += 2; continue; }
    if (source[i] === '"') { string = true; i++; continue; }
    if (source[i] === '(') {
      if (source.slice(i).startsWith('(func ' + name) && /[\s(]/.test(source[i + 6 + name.length] || '')) {
        assert.equal(start, -1); start = i; depth = 0;
      }
      if (start >= 0) depth++;
    } else if (source[i] === ')' && start >= 0 && --depth === 0) {
      matches.push([start, i + 1]); start = -1;
    }
    i++;
  }
  assert.equal(comment, 0); assert.equal(string, false); assert.equal(matches.length, 1, name);
  const [a,b] = matches[0];
  return source.slice(0,a) + replacement + source.slice(b);
}

function compile(mode, out, compat = false, mapOnly = false) {
  assert(modes.includes(mode));
  fs.mkdirSync(out, {recursive: true});
  const historical = historicalLoader(out);
  const observer = mode === 'baseline' ? null : historical.load('lifetime-transform.cjs');
  const {watxSourceClosure, compileClosure} = require('./watx-closure');
  const closure = watxSourceClosure();
  const closureSha256 = sha(JSON.stringify([...closure.vfs].sort(([a],[b]) => a.localeCompare(b))));
  const changes = [];
  for (const file of [...closure.vfs.keys()].filter(k => !k.includes('/'))) {
    const before = closure.vfs.get(file);
    let after = observer ? observer.transform(file, before) : before;
    if (file === '13-exports.wat') {
      if (mode === 'single-resident') after = specializeSingleResident(after);
      if (mode === 'single-live-resident') after = specializeSingleResident(after,true);
      if (mode === 'no-resident-scan') after = replaceFunction(after, '$cww_hit', '(func $cww_hit (param $wa i32) (param $n i32) (result i32) (i32.const 0))');
      if (mode === 'no-store-hit') after = replaceFunction(after, '$cmw_hit', '(func $cmw_hit (param $wa i32) (param $n i32) (result i32) (i32.const 0))');
      if (mode === 'no-snapshots') after = replaceFunction(after, '$cupw_snapshot', '(func $cupw_snapshot)');
    }
    if (file === '07e-uop-compiler.wat' && mode === 'no-native-markers') {
      const anchor = '(if (i32.const 1) (then';
      assert.equal(after.split(anchor).length - 1, 1);
      after = after.split(anchor).join('(if (global.get $pending_armed) (then');
    }
    if (after !== before) changes.push({file: 'src/' + file, before, after});
    for (const alias of [file, 'src/' + file, './' + file]) closure.vfs.set(alias, after);
  }
  const sourcePatch = Buffer.from(require('./unified-diff.js').patchOf(changes));
  fs.writeFileSync(path.join(out, 'observer.patch'), sourcePatch);
  let vfs = closure.vfs;
  if (compat) vfs = require('../lib/dispatch-trampoline').applyToVfs(new Map(vfs));
  const {protectClosure,parse} = require('./protected-writer-entries');
  const protectedSource = protectClosure({...closure,vfs});
  const imports = [], functions = [];
  for (const file of require('../lib/wat-manifest').WAT_FILES) {
    for (const form of parse(protectedSource.vfs.get(file))) {
      const head = form.items?.[0]?.atom;
      if (head === 'import' && form.items[3]?.items?.[0]?.atom === 'func')
        imports.push({name:form.items[3].items[1].atom,file});
      if (head === 'func') functions.push({name:form.items[1].atom,file});
    }
  }
  const functionMap = [...imports,...functions].map((f,index)=>({...f,index}));
  fs.writeFileSync(path.join(out,'function-map.json'),JSON.stringify({closureSha256,mode,compat,functions:functionMap},null,2)+'\n');
  if (mapOnly) return {mode,compat,closureSha256,functionCount:functionMap.length};
  const r = compileClosure({...closure, vfs}, {tailCalls: !compat});
  assert(r.success, JSON.stringify(r));
  const {appendSection,hashOfLayout} = require('./region-layout-hash');
  const bytes = appendSection(Buffer.from(r.wasmBinary), hashOfLayout());
  assert(WebAssembly.validate(bytes));
  fs.writeFileSync(path.join(out, 'module.wasm'), bytes);
  const identity = {mode, compat, diagnosticOnly: true, originalLaunchPermitted: false,
    qualificationPass: false, commit: cp.execFileSync('git', ['rev-parse','HEAD'], {cwd: ROOT, encoding:'utf8'}).trim(),
    closureSha256, moduleSha256: sha(bytes), moduleBytes: bytes.length,
    patchSha256: sha(sourcePatch), helperInputs: historical.inputs, redirectedWrites: historical.writes,
    engine: process.version, v8: process.versions.v8};
  fs.writeFileSync(path.join(out, 'identity.json'), JSON.stringify(identity, null, 2) + '\n');
  return identity;
}

function lifetimeFixture(fixture) {
  // Generated PE only: exercise reuse, two resident slots and destruction.
  const image = Buffer.from(fixture), raw = va => va-0x400000-0x1000+0x200;
  image.copy(image,raw(0x40c000),raw(0x409000),raw(0x409000)+0x26c);
  const b = [], u32 = n => [n&255,n>>>8&255,n>>>16&255,n>>>24&255];
  const emit = (...v) => b.push(...v.flat());
  const call = (target,owner,args=[]) => {
    for (const value of args) emit(0x68,u32(value));
    emit(0xb9,u32(owner)); emit(0xe8,u32(target-(0x403000+b.length+5)));
  };
  emit(0x60);
  call(0x431950,0x409000,[0x409800]); call(0x4310a0,0x409000,[0,0x40000000]);
  call(0x431950,0x40c000,[0x409800]); call(0x4310a0,0x40c000,[0,0x40000000]);
  call(0x430fa0,0x409000);
  call(0x431950,0x409000,[0x409800]); call(0x4310a0,0x409000,[0,0x40000000]);
  call(0x430fa0,0x40c000); call(0x430fa0,0x409000);
  emit(0xb9,u32(15000000),0x31,0xc0); const loop = b.length;
  emit(0x83,0xc0,3,0xa3,u32(0x409710),0x49);
  emit(0x0f,0x85,u32(loop-(b.length+6)));
  emit(0x61,0xc3); Buffer.from(b).copy(image,raw(0x403000));
  Buffer.from([0x56,0x8b,0xf1,0x33,0xc0,0x89,0x46,4,0x89,0x46,0x38,0x89,0x46,0x68,0x5e,0xc3]).copy(image,raw(0x430fa0));
  return image;
}

async function workload(moduleFile, repetitions = 5, capture = false, lifetimes = false) {
  assert(Number.isInteger(repetitions)&&repetitions>=0&&repetitions<=16,'bounded repetitions');
  // Exact generated native callback body, fixed 15M add/store iterations.
  // This microbenchmark has no browser/input qualification claim.
  const initialFixture = require(path.join(PRIOR, 'native-control-fixture.cjs'))();
  const fixture = lifetimes ? lifetimeFixture(initialFixture) : initialFixture;
  const moduleBytes = fs.readFileSync(moduleFile);
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx = {exports:null,getMemory:()=>memory.buffer};
  const host = require('../lib/host-imports').createHostImports(ctx).host;
  host.memory = memory;
  let traceCalls = 0;
  const streamHash = crypto.createHash('sha256'), eventBytes = Buffer.alloc(20);
  const firstPackets = [], packetInstructions = [], lifecycles = [];
  const codeMap = new Map(), pendingMap = new Map();
  let pendingMove = null, mapEvictions = 0;
  let packet = null, lifecycle = null, incomplete = 0;
  for (const name of ['exit','log','log_i32','crash_unimplemented']) host[name] = () => {};
  host.dx_trace = (kind,tag,index,a,b) => {
    traceCalls++;
    if (!capture) return;
    [kind,tag,index,a,b].forEach((value,i)=>eventBytes.writeUInt32LE(value>>>0,i*4));
    streamHash.update(eventBytes);
    if (kind !== 30) return;
    if ((tag>>>0) === 0x43504d50) {
      a >>>= 0; b >>>= 0;
      if (index === 0) { if (pendingMap.has(a)) incomplete++; pendingMap.set(a,{pc:b}); }
      else if (index === 1) { const row=pendingMap.get(a); if (!row) incomplete++; else row.handler=b; }
      else if (index === 2) {
        const row=pendingMap.get(a);
        if (!row || row.handler===undefined) incomplete++;
        else { pendingMap.delete(a); codeMap.delete(a); codeMap.set(a,{...row,operand:b}); }
      } else if (index === 3) codeMap.clear();
      else if (index === 4) { if (pendingMove) incomplete++; pendingMove={destination:a,source:b}; }
      else if (index === 5) {
        if (!pendingMove || b!==0) incomplete++;
        else for (const [address,row] of [...codeMap])
          if (address>=pendingMove.source && address<pendingMove.source+a)
            codeMap.set(pendingMove.destination+address-pendingMove.source,row);
        pendingMove=null;
      }
      while (codeMap.size>262144) { codeMap.delete(codeMap.keys().next().value); mapEvictions++; }
      return;
    }
    if ((tag>>>0) === 0x43464c46) {
      if (index === 0) { if (lifecycle) incomplete++; lifecycle = []; }
      if (!lifecycle) { incomplete++; return; }
      lifecycle.push([index,a>>>0,b>>>0]);
      if (index === 3) { if (lifecycles.length<64) lifecycles.push(lifecycle); lifecycle = null; }
    }
    if ((tag>>>0) !== 0x43555057) return;
    if (index === 0) { if (packet) incomplete++; packet = []; }
    if (!packet) { incomplete++; return; }
    packet.push([index,a>>>0,b>>>0]);
    if (index === 255) {
      if (firstPackets.length<32) {
        firstPackets.push(packet);
        const f = new Map(packet.map(([i,a,b])=>[i,[a,b]]));
        packetInstructions.push(codeMap.get(f.get(126)?.[0]||f.get(113)?.[0])||null);
      }
      packet = null;
    }
  };
  const {instance} = await WebAssembly.instantiate(moduleBytes, {host});
  const e = instance.exports; ctx.exports = e;
  const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  mem.set(fixture,e.get_staging()); assert(e.load_pe(fixture.length));
  const translate = a => require('../lib/region-map.generated').g2w(a,e.get_image_base());
  const times = [];
  for (let rep = 0; rep < repetitions + 1; rep++) {
    const sp = 0x074ff000;
    dv.setUint32(translate(sp),0,true);
    e.set_esp(sp); e.set_eip(0x403000);
    const cpuStart = process.cpuUsage(), start = performance.now(), beforeTrace = traceCalls;
    e.run(100000000);
    const wallMs = performance.now() - start, cpu = process.cpuUsage(cpuStart);
    const value = dv.getUint32(translate(0x409710),true);
    assert.equal(value,45000000,'fixed native guest computation');
    times.push({rep,warmup:rep===0,wallMs,cpuMicros:cpu.user+cpu.system,value,traceCalls:traceCalls-beforeTrace,
      uopStats:e.uop_stats?Array.from({length:16},(_,i)=>e.uop_stats(i)):null});
  }
  const architecture = {};
  for (const name of ['get_eip','get_esp','get_eax','get_ecx','get_edx','get_ebx','get_ebp','get_esi','get_edi',
    'get_flag_res','get_flag_op','get_flag_a','get_flag_b','get_flag_sign_shift','get_fpu_top','get_fpu_sw','get_fpu_tags'])
    if (e[name]) architecture[name] = e[name]();
  return {diagnosticOnly:true,qualificationPass:false,originalLaunchPermitted:false,
    route:'direct generated native callback; no browser input',lifetimes,moduleSha256:sha(moduleBytes),fixtureSha256:sha(fixture),times,
    capture: capture ? {streamSha256:streamHash.digest('hex'),firstPackets,packetInstructions,lifecycles,mapEvictions,
      incomplete:incomplete+Number(!!packet)+Number(!!lifecycle)+pendingMap.size+Number(!!pendingMove)} : null,
    architecture,guestDataSha256:sha(mem.subarray(translate(0x409000),translate(0x409c00)))};
}

function captureNative(out, mode, engine) {
  assert(modes.includes(mode)); assert(['v8','sm'].includes(engine));
  const {extract,extractV8,disassemble} = require('./wasm-native');
  const map = JSON.parse(fs.readFileSync(path.join(out,mode,'function-map.json')));
  const identity = JSON.parse(fs.readFileSync(path.join(out,mode,'identity.json')));
  assert.equal(map.closureSha256,identity.closureSha256,'current matching source map');
  const moduleFile = path.join(out,mode,'module.wasm');
  assert.equal(sha(fs.readFileSync(moduleFile)),identity.moduleSha256);
  const shell = path.join(require('node:os').homedir(),'.jsvu/bin',engine);
  const nativeDir = path.join(out,'native'); fs.mkdirSync(nativeDir,{recursive:true});
  const bin = path.join(require('node:os').tmpdir(),'conan-first-store-native-'+process.pid+'.bin');
  try {
    const segments = engine === 'v8' ? extractV8(shell,moduleFile,bin) : extract(shell,moduleFile,'ion',bin);
    const selected = [];
    for (const name of ['$th_store32','$th_add_r_i32','$uop_fast','$cmw_store14','$cww_hit','$cmw_hit','$cpp_translate','$cfl_get_dead','$cfl_get_owner']) {
      const fn = map.functions.find(f=>f.name===name); if (!fn) continue;
      const segment = segments.find(s=>s[0]===fn.index); assert(segment,'missing native '+name);
      const file = mode+'-'+engine+'-'+name.slice(1)+'.txt';
      fs.writeFileSync(path.join(nativeDir,file),disassemble(process.env.OBJDUMP||'/usr/bin/objdump',bin,segment[1],segment[2]));
      selected.push({...fn,begin:segment[1],end:segment[2],file});
    }
    const version = cp.execFileSync(shell,['--version'],{encoding:'utf8'}).trim();
    const result = {mode,engine,version,tier:engine==='v8'?'turbofan':'ion',architecture:process.arch,
      moduleSha256:identity.moduleSha256,functionMapClosure:map.closureSha256,segmentCount:segments.length,selected};
    fs.writeFileSync(path.join(nativeDir,mode+'-'+engine+'.json'),JSON.stringify(result,null,2)+'\n');
    return result;
  } finally { if (fs.existsSync(bin)) fs.unlinkSync(bin); }
}

module.exports = {compile,workload,replaceFunction,historicalLoader,specializeSingleResident,captureNative,lifetimeFixture};
if (require.main === module) (async () => {
  const [command,arg,out,extra] = process.argv.slice(2);
  if (command === 'compile' || command === 'map') console.log(JSON.stringify(compile(arg,path.resolve(out),extra==='compat',command==='map')));
  else if (command === 'native') console.log(JSON.stringify(captureNative(path.resolve(arg),out,extra)));
  else if (['workload','verify','verify-lifetimes'].includes(command)) {
    const verify = command.startsWith('verify');
    const result = await workload(path.resolve(arg),verify?0:Number(extra||5),verify,command==='verify-lifetimes');
    fs.writeFileSync(path.resolve(out),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({moduleSha256:result.moduleSha256,fixtureSha256:result.fixtureSha256,
      times:result.times,streamSha256:result.capture?.streamSha256,qualificationPass:false,originalLaunchPermitted:false}));
  } else throw Error('compile|map MODE OUT [compat] | workload MODULE RESULT [REPETITIONS]');
})().catch(error => {console.error(error.stack);process.exitCode=1;});
