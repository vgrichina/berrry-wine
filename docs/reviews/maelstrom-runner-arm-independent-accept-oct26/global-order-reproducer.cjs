'use strict';
// Byte-exact archived execution excerpts; exports.run is a mock, never a guest.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const data = JSON.parse(fs.readFileSync(__dirname + '/loader-excerpts.json'));
for (const e of Object.values(data.excerpts)) {
  assert.equal(Buffer.byteLength(e.text), e.bytes); assert.equal(sha(e.text), e.sha256);
}
function reproduce({validationFails = false} = {}) {
  const events = []; let armed = false, eip = 0x401000, esp = 4096;
  const exports = {memory: {buffer: new ArrayBuffer(8192)},
    get_image_base: () => 0x400000, get_eip: () => eip, get_esp: () => esp,
    get_fs_base: () => 0, get_eax: () => 1,
    set_eip: x => { eip = x; }, set_esp: x => { esp = x; },
    run: () => { events.push({event:'dll-run', armed}); eip = 0; esp = 4096; }};
  const ctx = vm.createContext({events, exports, instance: {exports}, memory: exports.memory,
    dlls: [{name:'fixture.dll'}], results: [{name:'fixture.dll',loadAddr:0x500000,dllMain:0x501000}],
    console: {log() {}}, ctx: {vfs: {}}, exeBytes: Buffer.alloc(0), EXE_PATH:'fixture.exe', EXTRA_ARGS:'',
    path: require('node:path'), threadManager: {setLoadedDlls() {}}, moduleBases: {},
    onLoadLibraryYield() { throw Error('unexpected nested DLL'); },
    mountLoadedDllFiles() {}, orderDllInitializers: (dlls, results) => results,
    finishDllInitialization() {}, releaseTemporaryDllReference() {},
    _memUtilsDll: {guestToWasm: addr => addr},
    requireDllCallbackGate: () => ({release() { events.push({event:'gate-release'}); }}),
    dllMainToken: () => null, finishDllMain: (ex, token, base, options, value) => value,
  });
  const e = data.excerpts;
  // Mapping, callback ownership and token bookkeeping are explicit seams. The
  // real initializer loop, wrapper, owned call and entire generator are unchanged.
  vm.runInContext(e.steps.text + e.owned.text + e.wrapper.text +
    '\nfunction loadDlls(exports,memory,exe,dlls,log,options){\n' + e.initializerLoop.text + '\nreturn results;}\n' +
    e.runnerLoad.text, ctx, {timeout:1000});
  events.push({event:'validation'});
  if (!validationFails) { events.push({event:'main-initialize'}); armed = true; events.push({event:'arm'}); }
  assert.equal(events[0].event, 'dll-run'); assert.equal(events[0].armed, false);
  assert(events.findIndex(x => x.event === 'dll-run') < events.findIndex(x => x.event === 'validation'));
  return events;
}
if (require.main === module) {
  const ordinary = reproduce(), failedValidation = reproduce({validationFails:true});
  assert(!failedValidation.some(x => x.event === 'arm'));
  console.log(JSON.stringify({reproduced:true,globalContractSatisfied:false,ordinary,failedValidation,
    qualification:'source-backed mocked call ordering only; no guest instructions executed'}));
}
module.exports = {reproduce};
