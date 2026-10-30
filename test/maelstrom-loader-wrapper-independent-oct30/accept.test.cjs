#!/usr/bin/env node
'use strict';
// Independent contract probes. All child diagnostics/media are synthetic.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const vm = require('node:vm'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../..');
const task = path.dirname(repo);
const wrapperPath = path.join(repo, 'test/maelstrom-pinned-full-loader-oct30/qualify.cjs');
const wrapper = require(wrapperPath), pins = require('../maelstrom-pinned-full-loader-oct30/pins.json');
const candidateSHA = 'c92c4eebc5d7730fdf8356016d1252532a372695b39e74bea9c48925ffe54162';
function pin(p) { const b=fs.readFileSync(p); return {bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}; }
assert.equal(pin(wrapperPath).sha256,candidateSHA);
assert.deepEqual(pin(path.join(repo,'test/run.js')),pins.sources['test/run.js']);
const root = fs.mkdtempSync(path.join(task,'independent-'));
let count=0, reached=0;
function write(p,b) {fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);return p;}
const mode=write(path.join(root,'mode.json'),'"quiet"'), marker=path.join(root,'marker.json');
const child=write(path.join(root,'child.cjs'), `
const fs=require('node:fs');
const mode=JSON.parse(fs.readFileSync(${JSON.stringify(mode)}));
fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({argv:process.argv.slice(2),env:process.env,cwd:process.cwd()}));
if(mode==='diagnostic') {process.stderr.write('synthetic loader unreachable\\n');}
if(mode==='signal') {process.kill(process.pid,'SIGTERM');}
`);
const executable=write(path.join(root,'node-control'),`#!/bin/sh\nexec /usr/bin/node --max-old-space-size=192 '${child}' "$@"\n`);
fs.chmodSync(executable,0o700);
const paths={node:executable,runner:path.join(repo,'test/run.js'),wasm:write(path.join(root,'fake.wasm'),'synthetic bytes; never compiled'),exe:write(path.join(root,'game,entry.exe'),'synthetic PE'),sdl:write(path.join(root,'SDL.dll'),'synthetic DLL'),'sdl-net':write(path.join(root,'SDL_net.dll'),'synthetic DLL'),msvcrt:write(path.join(root,'msvcrt.dll'),'synthetic DLL'),tree:path.join(root,'tree'),manifest:path.join(root,'manifest.json')};
const member=write(path.join(paths.tree,'data/comma,name.dat'),'synthetic mounted data');
const policy={wasm:pin(paths.wasm),sources:pins.sources};
let manifest;
function reset(){manifest={schema:'maelstrom-loader-inputs/v1',inputs:Object.fromEntries(['node','runner','wasm','exe','sdl','sdl-net','msvcrt'].map(k=>[k,{path:paths[k],...pin(paths[k])}])),tree:{path:paths.tree,files:[{path:'data/comma,name.dat',...pin(member)}]}};save();}
function save(){fs.writeFileSync(paths.manifest,JSON.stringify(manifest));}
function args(){return Object.entries({...paths,out:path.join(root,'out-'+(++count)),'max-seconds':1,'wall-seconds':2}).map(([k,v])=>`--${k}=${v}`);}
async function run(impl=wrapper,which='quiet',supplied=policy){fs.rmSync(marker,{force:true});fs.writeFileSync(mode,JSON.stringify(which));return impl.main(args(),{pins:supplied});}
function unqualified(r){assert.equal(r.guestAcceptance,false);assert.equal(r.runtimeQualification,'OPEN');assert.equal(r.loaderAcceptance,'unqualified');}
async function reject(pattern,supplied=policy){const r=await run(wrapper,'quiet',supplied);assert.equal(r.status,'invocation_failure');assert.match(r.error,pattern);assert.equal(fs.existsSync(marker),false);return r;}
async function tests(){
 reset();
 // Exact pinned runner's canonical parser, extracted verbatim without executing
 // runner imports or any Wasm. Validate the actual filename-bearing mount argv.
 const source=fs.readFileSync(paths.runner,'utf8');
 const begin=source.indexOf('const getArg ='), end=source.indexOf('const hasFlag =',begin);
 assert.ok(begin>=0&&end>begin);
 const parser=source.slice(begin,end);
 const actual=wrapper.buildArgv(wrapper.parse(args()));
 const parsed=vm.runInNewContext(parser+'; ({tree:getArgs("vfs-tree"),dlls:getArgs("dlls"),exe:getArg("exe"),wasm:getArg("wasm")})',{args:actual});
 assert.deepEqual(Array.from(parsed.tree),[paths.tree]);
 assert.deepEqual(Array.from(parsed.dlls),[paths.sdl,paths['sdl-net'],paths.msvcrt]);
 assert.equal(parsed.exe,paths.exe);assert.equal(parsed.wasm,paths.wasm);
 assert.deepEqual(fs.readdirSync(path.join(parsed.tree[0],'data')),['comma,name.dat']);
 console.log('PASS canonical pinned-runner parser: exact tree/DLL/exe/Wasm filenames including comma member');
 // Earliest behavioral boundary: exact candidate + entire pinned production
 // source closure, but an injected recorder executable and synthetic Wasm.
 const first=await run();assert.equal(first.status,'runtime_observations_unqualified');unqualified(first);
 const recorded=JSON.parse(fs.readFileSync(marker));reached++;
 assert.deepEqual(recorded.argv,wrapper.buildArgv(wrapper.parse(Object.entries({...paths,out:path.join(root,'unused')}).map(([k,v])=>`--${k}=${v}`))).map(a=>a==='--max-seconds=10'?'--max-seconds=1':a));
 assert.equal(recorded.cwd,repo);assert.deepEqual(Object.keys(recorded.env).sort(),['LANG','PATH','PWD','TZ']);
 assert.equal(recorded.env.TZ,'UTC');assert.equal(recorded.env.LANG,'C');
 console.log('PASS pinned source/dispatch boundary and child environment allowlist (synthetic child)');
 // Uncovered preflight paths, each checked before any recorder spawn.
 manifest.tree.files.push({...manifest.tree.files[0]});save();await reject(/invalid tree member/);reset();
 manifest.tree.files.push({path:'missing.dat',bytes:1,sha256:'0'.repeat(64)});save();await reject(/missing tree member/);reset();
 manifest.tree.files[0].path='../escape';save();await reject(/invalid tree member/);reset();
 manifest.tree.files[0].bytes=-1;save();await reject(/invalid tree bytes/);reset();
 const directory=path.join(root,'json-directory');fs.mkdirSync(directory);
 fs.renameSync(paths.manifest,paths.manifest+'.saved');fs.symlinkSync(directory,paths.manifest);
 await reject(/oversized\/non-file JSON/);fs.unlinkSync(paths.manifest);fs.renameSync(paths.manifest+'.saved',paths.manifest);
 fs.writeFileSync(paths.manifest,'null');await reject(/null/);reset();
 const deep=path.join(paths.tree,...Array(33).fill('d'));fs.mkdirSync(deep,{recursive:true});
 await reject(/tree directory\/depth/);fs.rmSync(path.join(paths.tree,'d'),{recursive:true});
 // Same-size source-policy mismatch tests the closure loop, not media identity.
 const stale={...policy,sources:{...pins.sources,'lib/dll-loader.js':{...pins.sources['lib/dll-loader.js'],sha256:'0'.repeat(64)}}};
 await reject(/SHA256 mismatch: .*lib\/dll-loader.js/,stale);
 console.log('PASS 8 independent fail-closed preflight probes, zero child spawns');
 const signal=await run(wrapper,'signal');reached++;assert.equal(signal.status,'loader_or_diagnostic_rejection');assert.equal(signal.child.signal,'SIGTERM');assert.equal(signal.child.reason,null);assert.equal(wrapper.exitCode(signal),2);unqualified(signal);
 console.log('PASS spontaneous child signal is rejection, never clean unqualified exit');
 // Mutation reaches real child execution and specifically disables diagnostics.
 const diagnostic=await run(wrapper,'diagnostic');reached++;
 function diagnosticOracle(r){assert.equal(r.child.code,0);assert.equal(r.child.signal,null);assert.equal(r.child.error,null);assert.equal(r.child.reason,null);assert.equal(r.status,'loader_or_diagnostic_rejection');assert.equal(r.diagnosticMarkerPresent,true);assert.equal(wrapper.exitCode(r),2);unqualified(r);}
 diagnosticOracle(diagnostic);
 const original=fs.readFileSync(wrapperPath,'utf8');
 const needle='const diagnostic = /';assert.equal(original.split(needle).length,2);
 const changed=original.replace(needle,'const diagnostic = false && /');
 const mutantDir=path.join(root,'mutant');write(path.join(mutantDir,'pins.json'),JSON.stringify(pins));
 const mutant=require(write(path.join(mutantDir,'qualify.cjs'),changed));
 const mutated=await run(mutant,'diagnostic');reached++;
 assert.equal(fs.existsSync(marker),true);assert.equal(mutated.child.code,0);assert.equal(mutated.child.error,null);assert.equal(mutated.child.reason,null);
 assert.equal(mutated.status,'runtime_observations_unqualified');assert.equal(mutated.diagnosticMarkerPresent,false);
 assert.throws(()=>diagnosticOracle(mutated),{code:'ERR_ASSERTION'});
 console.log('PASS diagnostic oracle rejects source-derived mutant after successful child dispatch');
 console.log(JSON.stringify({status:'SCOPED_CONTRACT_ACCEPTANCE',preflightProbes:8,executedSyntheticChildren:reached,mutation:'diagnostic regex disabled; oracle rejects reached defect',candidateSHA,guestExecuted:false,wasmCompiledOrInstantiated:false,runtimeQualification:'OPEN'}));
}
tests().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
