'use strict';
// Exercise the actual loader drivers without building or running a guest.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require.resolve('../lib/dll-loader.js'), 'utf8');
const begin = source.indexOf('function callDllMain(');
const end = source.indexOf('function orderDllInitializers(', begin);
const ctx = vm.createContext({ _memUtilsDll: { guestToWasm: x => x } });
vm.runInContext(source.slice(begin, end), ctx);
function fixture() {
  const state = { eip: 100, esp: 4096, eax: 7, yield: 0, halt: 0, runs: 0 };
  const ex = { memory: { buffer: new ArrayBuffer(8192) }, get_image_base: () => 0,
    get_fs_base: () => 0, get_eip: () => state.eip, set_eip: v => state.eip = v,
    get_esp: () => state.esp, set_esp: v => state.esp = v,
    get_eax: () => state.eax, get_yield_reason: () => state.yield,
    get_last_run_halt: () => state.halt,
    run() {
      if (++state.runs === 1) Object.assign(state, { eip: 210, yield: 5, halt: 4 });
      else { assert.equal(state.yield, 0, 'nested load must finish before resuming');
        Object.assign(state, { eip: 0, eax: 1, halt: 2 }); }
    } };
  return { state, ex };
}
(async () => {
  let { state, ex } = fixture();
  let release;
  const pending = new Promise(resolve => release = resolve);
  const work = ctx.callDllMainAsync(ex, 200, 205, null, {
    onLoadLibraryYield: async owner => {
      assert.strictEqual(owner, ex);
      assert.equal(state.eip, 210);
      assert.equal(state.esp, 4080, 'owning initializer stack remains installed');
      await pending;
      state.yield = 0;
      return true;
    },
  });
  await Promise.resolve();
  assert.equal(state.runs, 1);
  assert.equal(state.eip, 210, 'caller cannot resume during fetch');
  release(); await work;
  assert.equal(state.runs, 2); assert.equal(state.eip, 100); assert.equal(state.esp, 4096);

  ({ state, ex } = fixture());
  await assert.rejects(ctx.callDllMainAsync(ex, 200, 205, null, {
    onLoadLibraryYield: async () => { throw Error('fetch failed'); },
  }), /fetch failed/);
  assert.equal(state.runs, 1); assert.equal(state.eip, 100); assert.equal(state.esp, 4096);

  ({ state, ex } = fixture());
  await assert.rejects(ctx.callDllMainAsync(ex, 200, 205, null, {
    onLoadLibraryYield: async () => false,
  }), /did not complete/);
  assert.equal(state.runs, 1); assert.equal(state.eip, 100); assert.equal(state.esp, 4096);

  ({ state, ex } = fixture());
  ctx.callDllMain(ex, 200, 205, null, { onLoadLibraryYield: () => {
    state.yield = 0; return true;
  } });
  assert.equal(state.runs, 2, 'synchronous nested load also services halt 4');
  assert.equal(state.eip, 100); assert.equal(state.esp, 4096);

  ({ state, ex } = fixture());
  ex.run = () => { state.runs++; state.eip = 0; state.eax = 0; };
  await assert.rejects(ctx.callDllMainAsync(ex, 200, 205, null), /did not complete/);
  assert.equal(state.eip, 100); assert.equal(state.esp, 4096);
  console.log('PASS DLL initializer async suspension, failure, rejection and synchronous nested halt4');
})().catch(error => { console.error(error); process.exitCode = 1; });
