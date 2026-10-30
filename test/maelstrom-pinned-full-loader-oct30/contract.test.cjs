'use strict';
// Tiny contract controls only. No WebAssembly compilation, instantiation, guest
// code, or production runner execution occurs in this suite.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync, spawn } = require('node:child_process');
const wrapper = require('./qualify.cjs'), production = require('./pins.json');
const taskRoot = path.resolve(__dirname, '../../..');
const temp = fs.mkdtempSync(path.join(taskRoot, 'contract-controls-'));
let cases = 0;
function pin(p) { const b = fs.readFileSync(p); return { bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }; }
function write(p, text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return p; }
const fixtureRoot = path.join(temp, 'fixture');
const control = write(path.join(temp, 'mode.json'), '"quiet"');
const marker = path.join(temp, 'spawned.json');
const childJS = write(path.join(temp, 'child.cjs'), `
const fs = require('node:fs'), {spawn} = require('node:child_process');
const mode = JSON.parse(fs.readFileSync(${JSON.stringify(control)}));
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(marker)}, JSON.stringify(args));
if(!args.includes('--no-build') || !args.some(a=>a.startsWith('--wasm='))) process.exit(71);
if(mode==='failure'){console.error('loader Error: deliberate contract control');process.exit(7)}
if(mode==='diagnostic') console.error('frozen-record adapter initialization error; adapter disabled');
if(mode==='event') console.log('{"schema":"maelstrom-select-frozen-record/v1"}');
if(mode==='flood'){setInterval(()=>process.stdout.write(Buffer.alloc(8192,255)),1)}
if(mode==='hang' || mode==='orphan') {
  const c=spawn(process.execPath,['--max-old-space-size=192','-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  fs.writeFileSync(${JSON.stringify(path.join(temp, 'descendant'))},String(c.pid));
  if(mode==='orphan') process.exit(0);
  setInterval(()=>{},1000);
}
`);
// This executable is intentionally injected instead of Node. It receives the
// genuine wrapper's production argv and records it without executing run.js.
const childExecutable = write(path.join(temp, 'child-executable'), `#!/bin/sh\nexec '${process.execPath}' --max-old-space-size=192 '${childJS}' "$@"\n`);
fs.chmodSync(childExecutable, 0o700);
const paths = {
  node: childExecutable, runner: write(path.join(fixtureRoot, 'test/run.js'), '// contract runner bytes only\n'),
  wasm: write(path.join(temp, 'full.wasm'), 'contract wasm bytes only'), exe: write(path.join(temp, 'Maelstrom.exe'), 'contract exe'),
  sdl: write(path.join(temp, 'SDL.dll'), 'contract SDL'), 'sdl-net': write(path.join(temp, 'SDL_net.dll'), 'contract net'),
  msvcrt: write(path.join(temp, 'msvcrt.dll'), 'contract CRT'), tree: path.join(temp, 'game'), manifest: path.join(temp, 'inputs.json'),
};
write(path.join(paths.tree, 'data/comma,name.dat'), 'contract tree data');
const fixturePins = { wasm: pin(paths.wasm), sources: { 'test/run.js': pin(paths.runner) } };
let manifest;
function resetManifest() {
  manifest = { schema: 'maelstrom-loader-inputs/v1', inputs: Object.fromEntries(Object.keys(paths).filter(k=>!['tree','manifest'].includes(k)).map(k=>[k,{path:paths[k],...pin(paths[k])}])),
    tree: { path: paths.tree, files: [{path:'data/comma,name.dat',...pin(path.join(paths.tree,'data/comma,name.dat'))}] } };
  fs.writeFileSync(paths.manifest, JSON.stringify(manifest));
}
function argv(overrides = {}) {
  return Object.entries({...paths, out:path.join(temp, 'out-' + cases), 'max-seconds':1, 'wall-seconds':1, 'max-batches':3, ...overrides}).map(([k,v])=>`--${k}=${v}`);
}
function absent() { assert.equal(fs.existsSync(marker), false, 'preflight must precede spawn'); }
async function run(overrides={}, mode='quiet', pins=fixturePins, impl=wrapper) {
  cases++; fs.rmSync(marker,{force:true}); fs.writeFileSync(control,JSON.stringify(mode));
  return impl.main(argv(overrides), {pins});
}
async function reject(overrides, pattern, pins=fixturePins) {
  const r = await run(overrides, 'quiet', pins);
  assert.equal(r.status,'invocation_failure'); assert.match(r.error,pattern); absent();
}
function gone(pid) {
  // A reparented zombie cannot execute, but may await PID1's reaper.
  try { const s=fs.readFileSync('/proc/'+pid+'/stat','utf8'); return /\) Z /.test(s); }
  catch(e) { if(e.code==='ENOENT') return true; throw e; }
}
async function tests() {
  resetManifest();
  // Earliest authorized boundary: validate the exact current production source
  // closure, and deliver its unchanged argv to the injected executable. This is
  // expressly NOT a loader execution; only the Wasm is a tiny contract control.
  const fixtureRunner=paths.runner;
  paths.runner=path.resolve(__dirname,'../run.js'); resetManifest();
  const productionBoundary=await run({},'quiet',{wasm:fixturePins.wasm,sources:production.sources});
  assert.equal(productionBoundary.status,'runtime_observations_unqualified');
  assert.equal(JSON.parse(fs.readFileSync(marker))[1],paths.runner);
  paths.runner=fixtureRunner; resetManifest();
  await reject({wasm:'relative.wasm'},/absolute/);
  await reject({wasm:path.join(temp,'missing.wasm')},/manifest path mismatch/);
  const saved = fs.readFileSync(paths.wasm); fs.unlinkSync(paths.wasm);
  await reject({},/ENOENT/); fs.writeFileSync(paths.wasm,saved);
  fs.writeFileSync(paths.wasm,'x'.repeat(saved.length));
  await reject({},/SHA256/); fs.writeFileSync(paths.wasm,saved);
  await reject({},/file size\/type\/manifest mismatch/, production);
  fs.appendFileSync(paths.runner,'stale'); resetManifest();
  await reject({},/mismatch/); fs.writeFileSync(paths.runner,'// contract runner bytes only\n'); resetManifest();
  await reject({tree:paths.tree+',bad'},/ambiguous/);
  await reject({'sdl-net':paths['sdl-net']+',bad'},/ambiguous/);
  await reject({'max-seconds':0},/invalid bound/);
  await reject({'wall-seconds':91},/invalid bound/);
  await reject({'memory-mb':511},/invalid bound/);
  await reject({'no-build':'false'},/unknown/);
  await reject({out:paths.tree+'/output'},/overlaps/);
  write(path.join(paths.tree,'extra'),'extra'); await reject({},/unlisted/); fs.unlinkSync(path.join(paths.tree,'extra'));
  fs.symlinkSync(paths.exe,path.join(paths.tree,'link')); await reject({},/non-file/); fs.unlinkSync(path.join(paths.tree,'link'));
  manifest.tree.files[0].sha256='0'.repeat(64); fs.writeFileSync(paths.manifest,JSON.stringify(manifest)); await reject({},/SHA256/); resetManifest();
  const r=await run();
  assert.equal(r.executionKind,'contract-control-only'); assert.equal(r.status,'runtime_observations_unqualified');
  assert.equal(r.guestAcceptance,false); assert.equal(r.select,'unqualified'); assert.deepEqual(r.observerSchemaTextPresent,[]);
  const a=JSON.parse(fs.readFileSync(marker));
  assert.equal(a[0],'--max-old-space-size=192'); assert.equal(a[1],paths.runner);
  for(const v of ['--no-build',`--wasm=${paths.wasm}`,`--exe=${paths.exe}`,`--dlls=${paths.sdl},${paths['sdl-net']},${paths.msvcrt}`,`--vfs-tree=${paths.tree}`,'--max-seconds=1','--max-batches=3','--memory-mb=512']) assert.ok(a.includes(v),v);
  assert.equal(r.inputs.treeFiles,1); // comma-bearing member survives the tree mount.
  const fail=await run({},'failure'); assert.equal(fail.child.code,7); assert.equal(fail.status,'loader_or_diagnostic_rejection');
  assert.equal(wrapper.exitCode(fail),7);
  const diagnostic=await run({},'diagnostic'); assert.equal(diagnostic.child.code,0); assert.equal(diagnostic.status,'loader_or_diagnostic_rejection');
  assert.ok(fs.readFileSync(path.join(temp,'out-'+cases,'child.log'),'utf8').includes('adapter disabled'));
  const event=await run({},'event'); assert.equal(event.select,'unqualified'); assert.equal(event.status,'runtime_observations_unqualified');
  assert.equal(event.observerSchemaTextPresent.length,1);
  const flood=await run({'output-bytes':1024},'flood'); assert.equal(flood.child.reason,'output_limit'); assert.equal(flood.status,'invocation_failure');
  assert.equal(fs.statSync(path.join(temp,'out-'+cases,'child.log')).size,1024);
  const hang=await run({},'hang'); assert.equal(hang.child.reason,'wall_limit'); assert.equal(hang.child.signal,'SIGKILL');
  await new Promise(r=>setTimeout(r,80)); assert.ok(gone(Number(fs.readFileSync(path.join(temp,'descendant')))));
  const orphan=await run({},'orphan'); assert.equal(orphan.child.code,0);
  await new Promise(r=>setTimeout(r,80)); assert.ok(gone(Number(fs.readFileSync(path.join(temp,'descendant')))));
  // Exercise a signal delivered to the live wrapper, not only child timeout.
  cases++; fs.rmSync(marker,{force:true}); fs.rmSync(path.join(temp,'descendant'),{force:true}); fs.writeFileSync(control,'"hang"');
  const driver=write(path.join(temp,'driver.cjs'), `const w=require(${JSON.stringify(path.join(__dirname,'qualify.cjs'))}); w.main(${JSON.stringify(argv({'wall-seconds':5}))},{pins:${JSON.stringify(fixturePins)}}).then(r=>{console.log(JSON.stringify(r));process.exitCode=w.exitCode(r)});`);
  const signaled=spawn(process.execPath,['--max-old-space-size=192',driver],{stdio:['ignore','pipe','pipe']});
  let signalOutput=''; signaled.stdout.on('data',b=>{signalOutput+=b; assert.ok(signalOutput.length<32768)});
  const exited=new Promise(resolve=>signaled.on('close',(code,signal)=>resolve({code,signal})));
  const until=Date.now()+2000;
  while(!fs.existsSync(path.join(temp,'descendant')) && Date.now()<until) await new Promise(r=>setTimeout(r,10));
  assert.ok(fs.existsSync(path.join(temp,'descendant'))); signaled.kill('SIGTERM');
  const signalExit=await exited; assert.equal(signalExit.code,2);
  assert.equal(JSON.parse(signalOutput).child.reason,'SIGTERM');
  await new Promise(r=>setTimeout(r,80)); assert.ok(gone(Number(fs.readFileSync(path.join(temp,'descendant')))));
  fs.chmodSync(childExecutable,0o600); const spawnFailure=await run(); assert.equal(spawnFailure.status,'invocation_failure'); assert.match(spawnFailure.child.error,/EACCES/); fs.chmodSync(childExecutable,0o700);
  // Public executable CLI uses immutable production pins; fixtures cannot
  // qualify by providing a manifest which pins their own tiny Wasm.
  cases++; fs.rmSync(marker,{force:true});
  const cli=spawnSync(process.execPath,['--max-old-space-size=192',path.join(__dirname,'qualify.cjs'),...argv()],{encoding:'utf8',timeout:5000,maxBuffer:32768});
  assert.equal(cli.status,2); assert.equal(JSON.parse(cli.stdout).status,'invocation_failure'); absent();
  // Mutation checks run actual mutated wrapper modules, then run the same
  // acceptance probes. The hardcoded Wasm identity and no-build are essential.
  const original=fs.readFileSync(path.join(__dirname,'qualify.cjs'),'utf8');
  function mutant(name,from,to) {
    assert.ok(original.includes(from));
    const dir=path.join(temp,name); write(path.join(dir,'pins.json'),JSON.stringify(production));
    write(path.join(dir,'qualify.cjs'),original.replace(from,to)); return require(path.join(dir,'qualify.cjs'));
  }
  const noBuild=mutant('no-build-mutant',"c.runner, '--no-build',",'c.runner,');
  const mutationResult=await run({},'quiet',fixturePins,noBuild);
  assert.equal(mutationResult.status,'invocation_failure'); assert.match(mutationResult.error,/no-build/); absent();
  const noIdentity=mutant('identity-mutant','hashFile(c.wasm, pins.wasm);','/* mutation: Wasm identity removed */');
  // Fixture source pin stays valid; production-sized Wasm pin is deliberately
  // incompatible. A removed identity check reaches the injected child.
  const identityPolicy={...fixturePins,wasm:production.wasm};
  const baseline=await run({},'quiet',identityPolicy); assert.equal(baseline.status,'invocation_failure'); absent();
  const identityMutation=await run({},'quiet',identityPolicy,noIdentity);
  assert.equal(identityMutation.status,'runtime_observations_unqualified'); assert.ok(fs.existsSync(marker));
  console.log(JSON.stringify({status:'PASS_CONTRACT_ONLY',cases,mutations:['identity removal detected by pre-spawn rejection probe','no-build removal rejected'],runtime:'OPEN',guestExecuted:false}));
}
tests().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>fs.rmSync(temp,{recursive:true,force:true}));
