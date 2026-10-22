'use strict';
// Call the canonical JS dependency planner, never load or execute a guest PE.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const boot = require(path.join(root, 'lib/process-boot'));
const loader = require(path.join(root, 'lib/dll-loader'));
const registry = require(path.join(root, 'lib/dll-registry'));
const native = '/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-input-oct22';
const exeBytes = fs.readFileSync(path.join(native, 'd3dconfigutility.exe'));
const dllBytes = fs.readFileSync(path.join(native, 'dsetup.dll'));

async function plan(isLoadable, present = true) {
  const requests = [], missing = [];
  const configs = await boot.resolveDllGraph({ exeBytes,
    detectRequiredDlls: loader.detectRequiredDlls,
    ...(isLoadable ? { isLoadable } : {}),
    loadSpec(name) {
      requests.push(name.toLowerCase());
      return present && name.toLowerCase() === 'dsetup.dll'
        ? { name: 'dsetup.dll', bytes: dllBytes } : null;
    },
    onMissing: name => missing.push(name.toLowerCase()),
  });
  return { requests, missing, loaded: configs.map(c => c.name) };
}

(async () => {
  assert(loader.detectRequiredDlls(exeBytes).includes('dsetup.dll'));
  assert(!registry.isLoadableDll('DSETUP.DLL'));
  assert(!loader.isWindowsSystemDll('dsetup.dll'));
  const baseline = await plan();
  assert(!baseline.requests.includes('dsetup.dll'), 'default graph skips before disk/VFS lookup');
  assert(!baseline.loaded.includes('dsetup.dll'));
  // Diagnostic override only: shows the actual graph gate, without modifying its registry.
  const candidatePolicy = n => n.toLowerCase() === 'dsetup.dll' || registry.isLoadableDll(n);
  const candidate = await plan(candidatePolicy);
  assert(candidate.requests.includes('dsetup.dll'));
  assert(candidate.loaded.includes('dsetup.dll'));
  const absent = await plan(candidatePolicy, false);
  assert(absent.missing.includes('dsetup.dll'));
  assert(!absent.loaded.includes('dsetup.dll'));
  const wrongName = await plan(n => n === 'dsetup32.dll');
  assert(!wrongName.loaded.includes('dsetup.dll'));

  // This is existing synthesized metadata, not an authentic installed native runtime.
  const bytes = Buffer.from(boot.directXModuleStub('DDRAW.DLL'));
  const signature = Buffer.from([0xbd, 0x04, 0xef, 0xfe]);
  const fixed = bytes.indexOf(signature);
  assert(fixed >= 0);
  const synthesizedVersion = [bytes.readUInt32LE(fixed + 8), bytes.readUInt32LE(fixed + 12)];
  assert.deepStrictEqual(synthesizedVersion, [0x00040006, 0x00030206]);
  assert.strictEqual(registry.dllPath('dsetup.dll'), null);
  const result = { baseline, diagnosticAllowlistOverride: candidate, missingFileControl: absent,
    wrongNameControl: wrongName, synthesizedDdrawVersion: synthesizedVersion,
    actuallySupportedDirectXVersion: null, nativeExecution: false,
    allowlistOnlyCandidateQualified: false,
    reason: 'Native version reader reaches existing synthesized VERSION metadata; no measured runtime qualification backs this version claim.' };
  if (process.argv.includes('--write')) fs.writeFileSync(path.join(__dirname, 'loader-analysis.json'), JSON.stringify(result, null, 2) + '\n');
  else assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(__dirname, 'loader-analysis.json'))), result);
  console.log('PASS canonical dependency graph skips DSETUP before lookup; diagnostic override isolates gate; missing/wrong-name controls; synthesized version detected. No PE mapped/executed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
