'use strict';
const fs = require('fs'), assert = require('assert'), path = require('path');
const root = path.resolve(__dirname, '../repo');
const {scanWat} = require(root + '/tools/callback-ownership-census');
const file = root + '/tools/callback-ownership-census.json';
const census = JSON.parse(fs.readFileSync(file));
const reasons = {
  '$th_ret': ['src/05-alu.wat', 'guest-control', 'RET reads guest ESP/return word into locals once after guard16, snapshots kind2 before EIP assignment from that same local and ESP+=4; cs_pop is diagnostic depth only. No invocation enter/leave or retained callback owner. Guest return word origin/writer and lifetime remain unproven.'],
  '$th_ret_imm': ['src/05-alu.wat', 'guest-control', 'RET imm reads guest ESP/return word into locals once after guard16, snapshots kind3 before EIP from that same local and ESP+=4+op. No callback owner acquired or released; return word provenance/lifetime remain unproven.'],
  '$th_pop_run_ret': ['src/05-alu.wat', 'guest-control', 'Fused POP/RET preserves stack_run_pop early return and guard16; loads return local via existing sr_fast/sr_delta or gl32 path, snapshots kind4 before EIP from same local and ESP=cur+4+imm. No retained callback ownership; guest word origin remains unproven.'],
  '$win32_dispatch': ['src/09b-dispatch.wat', 'mixed-dispatch', 'Dispatcher retains existing resource-pin save/restore and callback-continuation redirects. Only added operation clears diagnostic kind before deferred DLL unload can redirect after inner handler. No new owner or EIP target; existing callback/continuation lifetimes remain pending.'],
  '$win32_dispatch_inner': ['src/09b-dispatch.wat', 'mixed-dispatch', 'CACA0005 remains intentional EIP=0 nested-run completion with handler_set_eip=1, no ESP pop here. Added kind1 snapshot precedes zero assignment, requires run thunk-entry route and matching current EIP/thunk in helper. Other EIP targets and lifetime boundaries unchanged; sender context restoration still belongs to enclosing synchronous caller, not this diagnostic record.'],
  '$null_transfer_record': ['src/13-exports.wat', 'context-restore', 'Diagnostic snapshot only, instance-local and overwriteable: mode2 guard; clear kind, reject nonzero target; kind1 requires explicit run thunk-entry and matching EIP/thunk. Copies already-read return word/address and predicted post-ESP, modal fields, validated invocation_current token and root without retaining or changing them; publishes kind last. No EIP/ESP or invocation ownership write, run/host call or callback. Reads may trap on invalid context; no proof of return-word writer or global retained lifetime.'],
  '$null_transfer_check': ['src/13-exports.wat', 'context-restore', 'Diagnostic invalidator before first-zero event: mode2 guard; count/depth/current-token/root/post-ESP mismatch clears kind. invocation_current validates and reads, never retains. No EIP/ESP or ownership write, run/host call or callback; a matching record is bounded diagnostic correlation, not proof of original writer or callback lifetime.'],
  '$run': ['src/13-exports.wat', 'host-entry', 'Reentrant host entry retains existing budget/API-depth save/restore and thunk auto-pop target. Clears kind/thunk-entry at fresh run and each nonzero loop boundary; brackets explicit thunk dispatch with entry flag; zero branch checks record before null_diag_event increments count and notifies synchronous host observer (return traps). Nested run or deferred unload invalidates attribution; diagnostic globals are not a retained per-invocation stack. No new EIP target/ownership retain; source inventory only, reentry/runtime and original writer remain unqualified.'],
};
const changes = [];
for (const [name, [src, kind, reason]] of Object.entries(reasons)) {
  const actual = scanWat(fs.readFileSync(root + '/' + src, 'utf8'), src).find(e => e.name === name);
  assert(actual, name);
  const i = census.entries.findIndex(e => e.file === src && e.name === name);
  const before = i < 0 ? null : census.entries[i];
  const after = {...actual, kind, reason: 'Shadow Man exact-candidate source review 2026-10-28: ' + reason + ' Ownership remains pending.', ownership: 'pending'};
  if (i < 0) census.entries.push(after); else census.entries[i] = after;
  changes.push({name, before, after});
}
fs.writeFileSync(file, JSON.stringify(census, null, 2) + '\n');
fs.writeFileSync(path.resolve(__dirname, '../evidence/eight-producer-review.json'), JSON.stringify(changes, null, 2) + '\n');
console.log('Reviewed exactly eight producers; six renewed, two added; all ownership pending.');
