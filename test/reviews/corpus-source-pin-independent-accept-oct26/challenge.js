'use strict';
// Independent probes of unchanged CLI bytes. No acquisition, compiler or guest.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const cli = path.resolve(__dirname, '../../test-cli-candidate-corpus.js');
const suppliedPath = process.env.CORPUS_READONLY_FIXTURE || '/home/user/wine-assembly/test/candidate-corpus/manifest.json';
const outputRoot = process.env.CORPUS_REVIEW_OUTPUT || '/tmp/corpus-source-pin-independent-accept-oct26/ops';
const bgId = 'baldurs-gate-interactive-demo';
if (process.argv[2] === '--probe') {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const deny = () => { throw Error('FORBIDDEN compiler, acquisition or guest invocation'); };
  const assetRoot = path.resolve(input.assetRoot);
  const selectedRoot = path.join(assetRoot, 'thps2-demo');
  function guarded(name) {
    return (filename, ...args) => {
      if (typeof filename === 'string') {
        const resolved = path.resolve(filename);
        if (resolved.startsWith(assetRoot + path.sep) && resolved !== selectedRoot && !resolved.startsWith(selectedRoot + path.sep)) {
          throw Error('FORBIDDEN unselected fixture traversal: ' + resolved);
        }
      }
      return fs[name](filename, ...args);
    };
  }
  const probeFs = {...fs};
  for (const method of ['existsSync', 'readdirSync', 'statSync', 'openSync']) probeFs[method] = guarded(method);
  probeFs.readFileSync = (filename, ...args) => path.resolve(filename) === path.resolve(path.dirname(cli), 'candidate-corpus/manifest.json')
    ? JSON.stringify(input) : guarded('readFileSync')(filename, ...args);
  for (const method of ['writeFileSync', 'mkdirSync', 'mkdtempSync', 'copyFileSync', 'rmSync', 'unlinkSync']) probeFs[method] = deny;
  process.argv = [process.execPath, cli, ...process.argv.slice(3)];
  vm.runInNewContext(fs.readFileSync(cli, 'utf8'), {
    __dirname:path.dirname(cli), process, console, Buffer, Set, Map,
    require(name) {
      if (name === './compile-src') return {compileSrcWasm:deny};
      if (name === 'child_process') return {spawnSync:deny};
      if (name === 'fs') return probeFs;
      if (['assert', 'os', 'path'].includes(name)) return require(name);
      throw Error('LOADER unexpected module: ' + name);
    },
  }, {filename:cli, timeout:2000});
} else {
  const suppliedBytes = fs.readFileSync(suppliedPath);
  const committedBytes = fs.readFileSync(path.resolve(path.dirname(cli), 'candidate-corpus/manifest.json'));
  assert.strictEqual(sha(fs.readFileSync(cli)), 'e8046f77b7fad166c81d48f43fe3b2ea5f2e3643e8dd905de364ac53081206b0');
  assert.strictEqual(sha(suppliedBytes), '212be4a27b33cbd8f675fdef80d13bbea45d3d81aa8e3e643a26edbde6e924bd');
  assert.strictEqual(sha(committedBytes), '25d9dc55241ad3e80b42d71986c4cf147e4e09c2c1370190d14fd0402b4cf4eb');
  const supplied = JSON.parse(suppliedBytes), committed = JSON.parse(committedBytes);
  const temporary = fs.mkdtempSync(path.join(process.env.TMPDIR, 'independent-pin-'));
  const thps = supplied.candidates.find(c=>c.id==='thps2-demo');
  const pePath = path.join(temporary, thps.fixture || thps.id, thps.executables[0]);
  fs.mkdirSync(path.dirname(pePath), {recursive:true});
  const pe = Buffer.alloc(90); pe.write('MZ'); pe.writeUInt32LE(64,60); pe.write('PE\0\0',64,'binary'); pe.writeUInt16LE(0x14c,68); pe.writeUInt16LE(0x10b,88); fs.writeFileSync(pePath,pe);
  const cases = [];
  const standardArgs = ['--id=thps2-demo','--dry-run','--strict'];
  function probe(name, base, mutate, expected, args=standardArgs) {
    const manifest = JSON.parse(JSON.stringify(base)); manifest.assetRoot=temporary;
    mutate(manifest.candidates.find(c=>c.id===bgId),manifest);
    const child = spawnSync(process.execPath,['--max-old-space-size=192',__filename,'--probe',...args],{input:JSON.stringify(manifest),encoding:'utf8',timeout:5000,maxBuffer:1024*1024});
    const output = (child.stdout || '') + (child.stderr || '');
    let category = child.error || child.signal ? 'PROCESS_ERROR'
      : /FORBIDDEN|LOADER|Cannot find module|SyntaxError|TypeError|ENOENT/.test(output) ? 'FIXTURE_OR_LOADER_ERROR'
      : /AssertionError/.test(output) ? 'CONTRACT_ASSERTION' : child.status===0 ? 'ACCEPTED' : child.status===2 ? 'USAGE' : 'OTHER_FAILURE';
    let error = null;
    try {
      assert.ifError(child.error); assert.strictEqual(child.signal,null);
      if (expected==='CONTRACT_ASSERTION') {assert.strictEqual(child.status,1,output); assert.strictEqual(category,expected,output); assert.doesNotMatch(output,/LOCAL   thps2-demo:/);}
      else if (expected==='ACCEPTED') {assert.strictEqual(child.status,0,output); assert.strictEqual(category,expected,output); assert.match(output,args.includes('--list')?/^LOCAL  thps2-demo\t/:/1 ready\/local, 0 blocked, 0 skipped, 0 harness failures/);}
      else {assert.strictEqual(child.status,2,output);assert.strictEqual(category,expected,output);assert.match(output,/unknown candidate IDs/);}
    } catch (e) {error=String(e);}
    const r={name,expected,category,exitCode:child.status,signal:child.signal,processError:child.error?.message||null,pass:!error,assertionFailure:error,output};
    cases.push(r); console.log(JSON.stringify(r)); return r;
  }
  let report;
  try {
    probe('committed manifest standalone selected dry-run',committed,()=>{},'ACCEPTED');
    // The supplied-fixture baseline and original 22 checks are reused; these target previously untested edges.
    probe('committed manifest selection isolation list',committed,()=>{},'ACCEPTED',['--id= thps2-demo,thps2-demo, ','--list']);
    probe('changed URL rejected in list mode',supplied,c=>{c.packages[0].url+='?identity-challenge';},'CONTRACT_ASSERTION',['--id=thps2-demo','--list']);
    probe('changed hash rejected before unknown ID usage',supplied,c=>{c.packages[0].sha1='f'.repeat(40);},'CONTRACT_ASSERTION',['--id=unknown-independent-id','--dry-run']);
    probe('valid contract retains unknown ID usage',committed,()=>{},'USAGE',['--id=unknown-independent-id','--dry-run']);
    probe('absent package type',supplied,c=>{delete c.packages[0].type;},'CONTRACT_ASSERTION');
    probe('added executable alternative',supplied,c=>{c.executables.push('cd/DATA1.CAB');},'CONTRACT_ASSERTION');
    probe('extra property on pinned raw-CD step',supplied,c=>{c.postExtract[0].group='Other';},'CONTRACT_ASSERTION');
    probe('cabinet step type changed',supplied,c=>{c.postExtract[1].type='extractCab';},'CONTRACT_ASSERTION');
    probe('preserved executable copy type changed',supplied,c=>{c.postExtract[2].type='copyTree';},'CONTRACT_ASSERTION');
    probe('missing preserved executable step',supplied,c=>{c.postExtract.splice(2,1);},'CONTRACT_ASSERTION');
    probe('append late executable overwrite',supplied,c=>{c.postExtract.push({type:'copyFile',from:'cd/DATA1.CAB',into:c.executables[0]});},'CONTRACT_ASSERTION');
    probe('redirect existing suffix copy over executable',supplied,c=>{c.postExtract[3]={type:'copyFile',from:'cd/DATA1.CAB',into:c.executables[0]};},'CONTRACT_ASSERTION');
    probe('append late overwrite with committed manifest',committed,c=>{c.postExtract.push({type:'copyFile',from:'cd/DATA1.CAB',into:c.executables[0]});},'CONTRACT_ASSERTION');
    const sameContractIds=['baldurs-gate-noninteractive-demo',bgId,'baldurs-gate-chapters-1-2-demo','civilization-2-win16','civilization-2-mge-win32','thps2-demo'];
    const equalRelevantCandidates=sameContractIds.map(id=>({id,equal:JSON.stringify(supplied.candidates.find(c=>c.id===id))===JSON.stringify(committed.candidates.find(c=>c.id===id))}));
    assert(equalRelevantCandidates.every(c=>c.equal),'required source-contract/THPS2 records differ');
    report={candidate:'1bc85c5d8e7513cb30ddd796cef6d93de0a0415b',sourceSHA256:sha(fs.readFileSync(cli)),suppliedFixtureSHA256:sha(suppliedBytes),committedManifestSHA256:sha(committedBytes),equalRelevantCandidates,cases,total:cases.length,passed:cases.filter(c=>c.pass).length,counterexamples:cases.filter(c=>!c.pass&&c.category==='ACCEPTED').length,infrastructureFailures:cases.filter(c=>/ERROR|OTHER_FAILURE/.test(c.category)).length,fixtureUnchanged:sha(fs.readFileSync(suppliedPath))===sha(suppliedBytes),scope:'pure contract probes; synthetic 90-byte PE; no actual extraction, acquisition, compiler or guest; unselected fixture filesystem accesses forbidden'};
    fs.writeFileSync(path.join(outputRoot,'independent-results.json'),JSON.stringify(report,null,2)+'\n');
    console.log('RESULT '+JSON.stringify({total:report.total,passed:report.passed,counterexamples:report.counterexamples,infrastructureFailures:report.infrastructureFailures}));
    process.exitCode=cases.some(c=>!c.pass)?1:0;
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}
