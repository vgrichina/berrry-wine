# Public JS COM activation ownership — 2026-10-20

Base: `72fc79100d7fe68476667ee4d8ed54a60163b396`, verified remote main.
Test: `test/test-com-public-activation-ownership.js` (automatic unit tier).
No production changes or defect found. No main integration.

## Exact gap and execution

The existing JS COM suite executes public storage activation with modeled
ownership primitives and interpreted COM wrappers. The real-boundary suite
compiles production helpers/wrappers but never executes storage activation.
The accepted native 126-callback run covers public registration/revocation,
not activation. Those results are reused, not rerun or extended.

The new test loads the whole actual `lib/storage.js` and calls its returned
`com_create_instance` import. Registered factories are installed through the
public registration import with no lifetime method in the fixture vtable.
DLL activation uses the actual registry lookup, loaded-DLL/export-table
resolution, DllGetClassObject carrier and subsequent CreateInstance carrier.
The class-only flag exercises the factory-return branch.

The production ownership block, sync-depth functions and seven COM
wrappers/accessors are compiled unchanged with the existing lightweight WATX
closure convention. Tokens, validation, pushes/pops and pin bookkeeping run
as real wasm against shared memory. Forwarding observers record tokens without
implementing ownership decisions. Initial serial values above 32 bits make
truncation observable. CPU execution, allocation and identity guest translation
remain explicit fixtures; audio notifications/debug recomputation are inert.

## Acceptance

`node test/test-com-public-activation-ownership.js`: **32 cases PASS**:

- Registered CreateInstance, DLL-to-CreateInstance and class-only success;
  completed CreateInstance failure preserves its HRESULT and published output.
- Nested activation restores the live parent child; sequential carriers issue
  distinct tokens. Six runner slices retain one token per DLL/CreateInstance
  carrier. Factory failure clears output and never runs CreateInstance.
- At each of four route/stage combinations (registered CreateInstance, DLL
  factory, DLL CreateInstance, class-only factory): exception, exception with
  zero EIP, blocking yield, exit with zero EIP, eight-slice budget exhaustion,
  and real retirement/replacement by an equal-depth sibling reject.
- Nested exception leaves both abandoned children intact.

Completion checks all integer registers, EIP, dispatcher IP/thunk,
handler/steps/yield state, SEH head, invocation/sync depths, root/current token,
and spill bookkeeping, plus exact argument frames, IID bytes and outputs.
Real final pin release sets `spill_desk_forced`; nested pin release does not
set it while the outer pin remains. Retired stack bytes/serials are deliberately
not required to revert.

Abort checks compare the entire 64-KiB shared memory and all observed
CPU/ownership/sync/spill globals against the state at the scripted stop.
There must be no parent restore, child pop, extra run, or transition from
failed factory to CreateInstance. Early nonzero output cannot imply completion.
“Cleanup” on abort means preserving failfast abandoned state, not unwinding it.

Eight syntactically valid in-memory JS mutations fail targeted behavioral
assertions: skipped acquisition, 32-bit retained token, skipped checked leave,
missing register/SEH/stream restoration, accepting incomplete return, and
popping ownership on exception. Syntax/initialization errors alone do not
count as detections. No production file is modified by controls.

Script syntax, unit-tier classification, and scoped diff checks PASS.
The initial fixture expectation that nested leave sets `spill_desk_forced`
was corrected against the actual sync-depth source; this was not a production
failure. Existing primitive/helper/native suites were not duplicated.

## Evidence, recovery and limits

Evidence: `scratch/runs/20261020-com-public-activation-tests/`.
`preflight.json`, `test.log`, `validation.json`, `SHA256SUMS.json`,
`snapshot/`, and `replay.js` retain the exact tested sources, compiler closure,
hashes and bounded replay recipe. `remote.json` records the pushed commit.
Run `node replay.js` inside that evidence directory to verify saved hashes and
repeat only this source/wasm-helper test. No module build or install is needed.

This closes the public **JS carrier + compiled ownership** composition gap.
It is not native x86 ABI, full-VM, browser, gameplay, allocator, concurrent
retirement, spill pressure/reclamation or whole nonlocal-system qualification.
It does not qualify every stale/capacity case through activation; existing
helper/native bounds remain as documented in their own reports.
No API/census/review locks, `_setjmp`/`longjmp`, runtime or production files
were touched. Worktree/evidence/own metadata stay within the assigned 8-MiB
cap and floor + 32-MiB reserve + 26-MiB aggregate admission.
