'use strict';

// Default/light mode reads bytes only. It never imports a runtime helper,
// executes a guest, reads game state, or admits an original attempt.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const PREVIOUS = path.join(ROOT, 'scratch/runs/20261114-drakan-original-gameplay');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const PINS = Object.freeze({
  exe: '29ddccec4b073aaeeb998f0ce83d581ccf3e6a3e28791844f4434d661febecbe',
  rfl: 'b0ede61e43571f9ecead5e7637c585e1e3523ba70d7fd325ec39e99381807b1e',
  settings: '207f1bdaccfd50d9e739ec3c812a09806eb119af4638351155548e4f7e290f43',
  pe: '28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4',
  ne: '39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9',
});

function media() {
  const inventory = read(path.join(PREVIOUS, 'media-preflight.json')).paths;
  assert.equal(inventory.length, 64);
  assert.equal(new Set(inventory.map(row => row.path)).size, 64);
  for (const row of inventory) {
    const bytes = fs.readFileSync(path.join(ROOT, row.path));
    assert.equal(bytes.length, row.size, row.path);
    assert.equal(sha(bytes), row.sha256, row.path);
  }
  const exe = inventory.find(row => row.path.endsWith('/drakan.exe'));
  const rfl = inventory.find(row => row.path.endsWith('/dragon.rfl'));
  assert.deepEqual([exe.size, exe.sha256], [516096, PINS.exe]);
  assert.deepEqual([rfl.size, rfl.sha256], [1605632, PINS.rfl]);
  const registration = read(path.join(PREVIOUS, 'registration.json'));
  const manifest = read(path.join(ROOT, registration.localFileManifest));
  assert.equal(manifest.files.length, 62);
  const base = path.dirname(exe.path);
  for (const item of manifest.files) {
    assert(!item.url.includes('..') && !path.isAbsolute(item.url));
    const row = inventory.find(row => row.path === base + '/' + item.url);
    assert(row, item.url); assert.equal(row.size, item.size);
    assert.equal(item.vfsPath.toLowerCase(),
      registration.workingDirectory.toLowerCase() + '\\' + item.url.replaceAll('/', '\\').toLowerCase());
  }
  const source = fs.readFileSync(path.join(ROOT, 'lib/apps.js'), 'utf8');
  const entry = source.slice(source.indexOf('      drakan_demo: {'), source.indexOf('      drakan_demo: {') + 4500);
  const data = JSON.parse('[' + entry.match(/data:\s*\[([^\]]+)\]/)[1] + ']');
  assert.deepEqual(data, registration.startupRegistry[0].data);
  assert.equal(data.length, 92); assert.equal(sha(Buffer.from(data)), PINS.settings);
  for (const text of ['Settings100', 'workingDirectory:', 'exeGuestPath:', 'localFileManifest:'])
    assert(entry.includes(text));
  for (const [file, size, hash] of [
    ['test/binaries/dlls/comctl32.dll', 577808, PINS.pe],
    ['test/binaries/dlls/commctrl.dll', 155136, PINS.ne],
    ['test/binaries/sims-native-common-controls/kommctrl.dll', 155136, PINS.ne],
  ]) {
    const bytes = fs.readFileSync(path.join(ROOT, file));
    assert.equal(bytes.length, size); assert.equal(sha(bytes), hash);
  }
  return {paths: inventory.length, manifestEntries: manifest.files.length, settingsBytes: data.length,
    pins: PINS, runtimeExecuted: false, originalLaunched: false};
}

function currentRegistration() {
  assert.equal(process.env.DRAKAN_CURRENT_LANE_VERIFIED, '1', 'current predecessor/runtime release gate');
  const expected = read(path.join(PREVIOUS, 'registration.json'));
  const actual = require('../lib/apps.js').APPS?.drakan_demo;
  assert(actual, 'current registered drakan_demo');
  const normalized = JSON.parse(JSON.stringify(actual));
  for (const key of ['exe','localFileManifest']) {
    assert.equal(fs.realpathSync(path.join(ROOT, actual[key])),
      fs.realpathSync(path.join(ROOT, expected[key])), 'browser/native host-path alias ' + key);
    normalized[key] = expected[key];
  }
  assert.deepEqual(normalized, expected, 'complete original registration unchanged');
  return {registrationUnchanged:true,...media()};
}

function release(directory, expectedSHA256) {
  directory = path.resolve(directory);
  function sealedBytes(ref) {
    const file = path.resolve(directory, ref.path);
    assert(file.startsWith(directory + path.sep), 'contained reference');
    const bytes = fs.readFileSync(file); assert.equal(sha(bytes), ref.sha256, ref.path);
    return bytes;
  }
  const sealed=ref=>JSON.parse(sealedBytes(ref));
  const bytes = fs.readFileSync(path.join(directory, 'runtime-release.json'));
  assert.equal(sha(bytes), expectedSHA256, 'current explicit release identity');
  const released = JSON.parse(bytes);
  assert.equal(released.sourceBuildRuntimeReleased, true);
  assert.equal(released.branch,'main'); assert.equal(released.published,true);
  assert.equal(released.strictPullPush,true); assert.equal(released.ownedPathsClean,true);
  let artifactsVerified=0;
  for (const ref of [released.result, ...(released.evidence || [])]) {
    const value=sealed(ref);
    if (ref.path === 'artifact-index.json')
      for(const artifact of value.artifacts) {sealedBytes(artifact);artifactsVerified++;}
  }
  const closure = sealed(released.directClosure);
  assert.equal(closure.receipts.length, closure.actualWaitReceiptCount ?? closure.actualWaitBothEOF);
  for (const ref of closure.receipts) {
    const receipt = sealed(ref);
    for (const key of ['actualWait', 'stdoutEOF', 'stderrEOF']) assert.equal(receipt[key], true, ref.path + ':' + key);
    if ('exit' in ref) assert.equal(receipt.exit ?? receipt.code, ref.exit);
  }
  for (const ref of closure.additionalLifecycleRefs || []) sealed(ref);
  for (const row of closure.pids) {
    const recordedPID=typeof row==='number'?row:row.pid;
    assert(Number.isSafeInteger(recordedPID) && recordedPID > 1);
    for (const pid of [recordedPID, -recordedPID])
      assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH', 'live PID/group ' + pid);
  }
  return {main: released.main, releaseSHA256: expectedSHA256,
    actualWaitBothEOF: closure.receipts.length, pidsAndGroupsAbsent: closure.pids.length,artifactsVerified,
    ancillaryUnknown: closure.ancillaryUnknown ?? closure.historicalUNKNOWN, locksRechecked: false};
}

function warningFixture() {
  // New authored x86 public USER program: NULL-owner MB_OK|EXCLAMATION,
  // then a distinct native modal generation, then ordinary ExitProcess.
  // No original code, private-memory oracle or existing fixture helper.
  const b = Buffer.alloc(0x2200), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
  const raw = rva => rva - 0x1000 + 0x200;
  const w16 = (a, n) => b.writeUInt16LE(n, a), w32 = (a, n) => b.writeUInt32LE(n >>> 0, a);
  w16(0, 0x5a4d); w32(0x3c, pe); w32(pe, 0x4550); w16(pe + 4, 0x14c);
  w16(pe + 6, 1); w16(pe + 20, 0xe0); w16(pe + 22, 0x10e);
  w16(opt, 0x10b);
  for (const [offset, n] of [[16,0x2000],[28,0x400000],[32,0x1000],[36,0x200],
    [56,0x3000],[60,0x200],[72,0x100000],[76,0x1000],[92,16],[104,0x1800],[108,60]]) w32(opt + offset,n);
  w16(opt + 68, 2); b.write('.text', section);
  for (const [offset,n] of [[8,0x2000],[12,0x1000],[16,0x2000],[20,0x200],[36,0xe0000060]]) w32(section+offset,n);
  for (const [index,dll,name,iat,hint] of [[0,'user32.dll','MessageBoxA',0x1900,0x1a00],
    [1,'kernel32.dll','ExitProcess',0x1920,0x1a40]]) {
    const desc=raw(0x1800+index*20), dllRva=0x1880+index*32;
    w32(desc,iat); w32(desc+12,dllRva); w32(desc+16,iat);
    b.write(dll+'\0',raw(dllRva)); w32(raw(iat),hint); b.write(name+'\0',raw(hint+2));
  }
  b.write('Authored beta warning route\0',raw(0x1b00));
  b.write('Authored fixture: ordinary native Enter dismisses this warning.\0',raw(0x1b80));
  b.write('Authored next generation: OK exits the fixture.\0',raw(0x1c00));
  const code=[];
  const push=n=>{code.push(0x68,n&255,n>>>8&255,n>>>16&255,n>>>24&255);};
  const call=n=>{code.push(0xff,0x15,n&255,n>>>8&255,n>>>16&255,n>>>24&255);};
  for (const text of [0x401b80,0x401c00]) {push(0x30);push(0x401b00);push(text);push(0);call(0x401900);}
  push(0);call(0x401920);code.push(0xcc);b.set(code,raw(0x2000));
  return b;
}

function prearmBoundary() {
  const directory=path.join(ROOT,'scratch/runs/20261115-gta2-independent-release-prearm-repair');
  const identity='b786ea7c396a8ddab027d8a374fea8f6fe9b33da797c0ad6db44d76e76df19df';
  const checked=release(directory,identity),published=read(path.join(directory,'runtime-release.json'));
  const result=read(path.join(directory,'result.json'));
  assert.equal(published.outcome,'NECESSARY_PREARM_REPAIR_UNPROVED');
  assert.equal(published.productionRepairProved,false);
  assert.equal(result.productionSourceChanged,false);
  assert.equal(result.remainingQualification.browserWorkerQualified,false);
  assert.equal(result.remainingQualification.visibleSecondModal,'UNQUALIFIED blank retained screenshot');
  assert.deepEqual([result.remainingQualification.browserOriginalPrearmSourceMS,
    result.remainingQualification.browserControlPrearmSourceMS],[1000,1500]);
  assert.equal(result.original.attempts,0);
  const source=fs.readFileSync(path.join(ROOT,'tools/gta2-paired-controller.cjs'),'utf8');
  assert(/release prearm timeout'\)\),1000/.test(source),'current original prearm still above500ms');
  assert(/native release arm timeout'\)\),1500/.test(source),'current controls prearm still above500ms');
  return {firstCausalBlocker:'CURRENT_PREARM_PREREQUISITE_UNQUALIFIED',originalAuthorized:false,
    originalAttemptConsumed:false,productionRepairProved:false,
    browserWorkerQualified:false,visibleSecondModalQualified:false,
    predecessor:checked,originalLaunched:false,input:0};
}

module.exports = {media,currentRegistration,release,prearmBoundary,warningFixture,PINS};
if (require.main === module) {
  const [mode='--light',directory,pin] = process.argv.slice(2);
  if(mode==='--light')console.log(JSON.stringify(media(),null,2));
  else if(mode==='--registered')console.log(JSON.stringify(currentRegistration(),null,2));
  else if(mode==='--prearm')console.log(JSON.stringify(prearmBoundary(),null,2));
  else if(mode==='--release')console.log(JSON.stringify(release(directory,pin),null,2));
  else if(mode==='--fixture') {
    assert(path.isAbsolute(directory)&&!fs.existsSync(directory),'unique absolute fixture output');
    const bytes=warningFixture();fs.writeFileSync(directory,bytes,{flag:'wx'});
    console.log(JSON.stringify({path:directory,size:bytes.length,sha256:sha(bytes),executed:false}));
  }else throw Error('use --light, --registered, --prearm, --release DIRECTORY SHA256, or --fixture NEW_ABSOLUTE_PATH');
}
