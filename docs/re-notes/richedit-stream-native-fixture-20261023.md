# RichEdit EDITSTREAM native ownership fixture — 2026-10-23

**Source fixture delivered; native qualification UNEXECUTED.** Offline checks
pass on exact main `bb9c496ed13095cc832fdf607f0937fb9c14b7de`. No production
WAT/JS, census, TODO or shared ledger changed. No compilation, VM, Boat,
browser, lifecycle or deployment operation occurred.

## Gap checked against main

Main already contains the ownership contract accepted as
`3c01665cdeb65ca7aebfdae7aec8dba4c3499884`:
`src/09c3-wndprocs5-edit.wat` blob
`6e07d34aedf6199a419fcbe0bd79b7b6a409dd8f`, SHA-256
`074c173009da12fc49eed8c01c3a7d6d8274ad567fea2250c71511d78edb352b`.
The callback acquires before guest frame writes, retains child/root/depth,
checks them before leaving on completion or timeout, and restores interrupted
registers and control state. The source fix was not reapplied.

`test/test-edit-stream-ownership.js` executes a modeled AST.
`test/test-richedit-stream-callback.js` includes real x86 callback bytes but
compiles the module itself and tests stream contents/errors; it lacks the
nested ownership, capacity-before-write and timeout restoration scenarios.
Neither is equivalent to this fixture. The new test is
`test/test-richedit-stream-ownership-native.js`.

The PE writer/emitter and sibling/timeout/capacity structure follow
`test/test-icm-callback-ownership-native.js`. Qualified ICM evidence at
`f36a60d3684fd5ee994632c969981f9a3e163fe1` was read as precedent only;
its build/module/runtime result does not qualify RichEdit. In particular,
this fixture does not depend on the default discarded host debug-log sink.

## Native acceptance implemented, pending execution

Each generated PE32/i386 image imports ordinary `CreateWindowExA` and
`SendMessageA`. Its bootstrap creates a STATIC parent and two RichEdit20A
children, then returns. No RichEdit DLL is supplied: this exercises Wine
Assembly's normal WAT RichEdit fallback (class 25). A DLL-backed RichEdit or
unknown HWND can take a different path and cannot qualify this wrapper.

The harness loads the PE through existing `get_staging`/`load_pe` exports and
executes its bootstrap with `run`. It invokes outer `EM_STREAMIN` through the
supported `send_message` export; nested x86 callbacks use the PE's normally
resolved `SendMessageA` IAT. It uses the ordinary host imports. There are no
new exports, fabricated thunk/token records, compiler transforms, private
wrapper calls, patched modules or guard changes. A missing API/routing
prerequisite fails the suite; the harness never substitutes a test window.

| Scenario | Required observations |
| --- | --- |
| ordinary | One `OWN` chunk plus EOF: two callbacks, result 3, dwError 0, exact visible text and callback ABI |
| nested | Outer callback streams `in` into the second control; two inner callbacks/result 2, nested register/ESP snapshots and stack canary preserved, then outer data/EOF completes |
| sliced | 1,000,100 decrement/conditional-branch iterations per callback cross the wrapper's 1,000,000-block slice budget; completion marker and ordinary result |
| timeout | Infinite real x86 loop reaches the existing 64-round limit; result 0/dwError 1 and interrupted state restored |
| nested-timeout | Inner infinite callback times out once, returns result 0/dwError 1 to outer x86 code with its registers/ESP/canary restored; outer stream completes |
| capacity | Exactly 63 callback entries, recursive call 64 traps `unreachable`, zero recursive returns, failed acquisition preserves ESP and all five prospective callback-frame canaries |
| error | Real callback writes a chunk then returns 37; result 0/dwError 37 and empty document reject accidental success/data inclusion |

Every nonterminal scenario seeds and checks all eight guest registers, EIP,
steps, handler_set_eip and carried yield_reason/yield_flag using supported
getters/setters. Callbacks deliberately clobber nonvolatile registers to
exercise this wrapper's full interrupted-context contract. Nested snapshots
check the guest stdcall return and six seeded non-EAX/non-ESP registers.
EAX there is the public SendMessage result. A guest stack canary survives.
Seventy independent data/EOF siblings in the same instance must return 210
total with exactly 140 callbacks and restore state after every call. A fresh
ordinary instance follows the terminal capacity scenario.

Capacity inspection uses the live instance after the expected trap. Before
each recursive x86 SendMessage, the callback plants five DWORD canaries at
ESP-40 through ESP-24 and records the prospective frame and API ESP. The
SendMessage argument/return frame uses ESP-20 through ESP-4. Thus a late
`sync_depth_enter` that writes any EDITSTREAM frame slot or changes ESP is
observable after the trap. The instance is discarded afterward; recovery
within a terminally trapped instance is not claimed. This is why the harness
keeps its own instance rather than using `test/run.js`, which exits on a
trap before printing its final `--dump` regions.

The accepted wrapper does not save EFLAGS/CF. No carry-flag or Windows ABI
parity claim is made. Carried yield/control state is checked. Private
child/root/depth mismatch injection, epoch races, spill exhaustion, guest
SEH, DLL RichEdit and Windows behavior remain outside this fixture.

## Executed offline checks

Run from a checkout of this task revision:

```sh
node --check test/test-richedit-stream-ownership-native.js
node test/test-richedit-stream-ownership-native.js --offline
git diff --check
```

All exited 0. The offline suite generates seven PE fixtures and separately
decodes bootstrap, callback and leaf x86 with GNU `objdump`. It checks PE32
machine/header/entry/image bounds, imports, embedded byte equality,
stdcall `ret 16`, callback buffer/pcb writes, capacity probe locations and
relative branch targets at independently decoded instruction boundaries.
Supplementary source checks validate the actual main edit wrapper ordering,
restore fields, budget, EM_STREAMIN read/call wiring and fallback class/control
routing. They do not execute a WAT AST or model the VM.

**59 rejecting controls pass:** deleted acquisition/retained guards/source
edges, wrong i386 machine/ret cleanup/pcb ABI/probe displacement, branch into
an instruction, and corrupted acceptance observations (counts, LRESULT,
dwError, ESP/registers, yield flag and canaries). Synthetic observations test
the assertion oracle only; they are not reported as guest results. The
provided pre-fix `scratch/runs/20261020-edit-stream-ownership/baseline.wat`
also rejects explicitly on acquisition-before-write. Default invocation
without module provenance exits 1 before loading host imports or creating
memory. These negative checks do not qualify native runtime behavior.

Evidence and the bounded verification record are under
`scratch/runs/20261023-richedit-stream-native-fixture/`:
`admission.json`, `checks.json`, logs, `generated/offline-receipt.json`,
seven generated PEs, raw x86 and disassembly, and `SHA256SUMS.json`.
Generated artifacts are reproducible from the tracked test; Git-ignored
artifacts are explicitly included in this task's publication.

## Recovery and future native qualification

The root has no `build/wine-assembly.wasm`; no exact-main compatible module
was supplied in this task. Historical ICM/Shadow Man modules have different
source provenance and are not used. The native harness needs a full matching
checkout (including normal host import dependencies) and 512 MiB guest
memory, beyond this source task's 64 MiB total local allocation. No module
build, download or runtime admission was attempted.

In a separately authorized runtime allocation, restore this branch and a
preserved normal full-module build whose complete source closure matches the
chosen revision. Verify its build receipt, source identity, region layout
and SHA-256 before invoking the suite. Do not reuse the historical ICM hash.

```sh
export WINE_ASSEMBLY_WASM=/absolute/path/to/preserved/wine-assembly.wasm
export WA_RICHEDIT_WASM_SHA256=VERIFIED_64_HEX_SHA256
export WA_RICHEDIT_SOURCE_REV=VERIFIED_40_HEX_SOURCE_REVISION
node test/test-richedit-stream-ownership-native.js \
  --artifacts=scratch/runs/20261023-richedit-stream-native-fixture/native
```

The script checks the module hash, never builds automatically, runs each
scenario in a separate child with a 150-second watchdog, and records logs,
raw observations and a native receipt. Source revision provenance is an
operator assertion backed by the external normalbuild receipt, as with the
existing ICM convention; a hash alone cannot prove source compatibility.
Only an overall native PASS with all eight runs and inspected observations
can replace **UNEXECUTED**. Retain the first failure and fix its precise
prerequisite before another authorized attempt. No runtime was assigned to
this worker; `bx_fn7pn7yg` and all lifecycle decisions remain with the
Shadow Man lane/coordinator.
