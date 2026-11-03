# Jedi authentic binding qualification — first prerequisite failure

**Qualification stopped before WASM instantiation.** The first native adapter
attempt failed opening `test/binaries/notepad.exe` (`ENOENT`). That ignored PE
was omitted from the sealed committed source closure. This is a task harness
packaging error, not an original-game or interpreter defect. No native fixture
instruction or original game instruction executed. No authentic binding,
branch, listener, writer or stop integration qualified. `readyForCampaign=false`,
`runtimeIntegration=false`, `actualDamageProven=false` and
`usableDamageAttribution=false` remain mandatory.

Exact dispatched input: `a4c4dc54da2493b4ed3a33719b961af2e2a75c07`.
Evidence, attempted executable adapter, commands, logs, source seal, modules,
full hashes and recovery are in
`scratch/runs/20261103-jedi-authentic-binding-qualification/`.
Only this note is committed; no production paths changed.

## Executed prerequisites and first failure

The single boat received `git archive` of the exact dispatched commit, excluding
foreign working-tree changes and ignored binaries. Archive SHA256:
`fb1de04a62f2dc1c3445b58d4f700f6a8203674792ca16c7424382d6cf53e8b2`.
`committed-source-seal.json.gz` records all regular archive members with size
and SHA256. Boat-side archive identity and native JS import checks passed
before dependency installation and the locked full build. Those cheap checks
incorrectly omitted the fixture PE existence check.

`flock /tmp/wine-build.lock bash tools/build.sh` passed on the boat. Native
module: 2,089,591 bytes, SHA256
`0a58fd7b9ac82c5303048776f442b15e72528b55ddf85564e0df92fcb1aa384d`.
Build limits: API table had no Git HEAD history comparison in the extracted
closure; Big5 used the documented offline header/invariant check. Full output
is retained. No build gate was removed or bypassed.

The task-local `native-watch-adapter.cjs` attempts a bounded real-WASM fixture
using existing exported `set_watchpoint`, register, memory and `run` facilities.
Its planned x86 CALL leaves a native fixture handler pending while a shield-only
100→80 store is followed immediately by an `INC EAX` forbidden after loss.
One grant of 16 blocks was planned, with no resume, image request or retry.
The adapter would require EAX unchanged and EIP exactly after the store.
These are fixture instructions, not authentic script bytecode or runtime
provenance. The adapter is incomplete and unqualified.

Actual first attempt:

```sh
cd /home/user/wine-assembly
node /home/user/native-watch-adapter.cjs /home/user/jedi-evidence/first-fixture.json
```

It exited3 at the PE file read, before memory creation, host creation,
`WebAssembly.instantiate`, `load_pe`, fixture writes, watch arming or `run`.
`retrieved/first-fixture.log` preserves the complete stack. No
`first-fixture.json` was produced. The first failure was retained without
repair, substitution, repeat attempt or original campaign.

Source inspection additionally finds watchpoint sampling at the run loop's
decoded-block boundary in `src/13-exports.wat`. This is a reason to require the
native store-boundary fixture; it is **not** an observed watchpoint failure.
No store latch, input revocation, acknowledged key release, invocation nesting,
wrong thread/generation rejection, arbitrary writer coverage, persistence
failure or forbidden post-stop execution test reached execution. No focused
runtime test is reported as passing.

## Preserved evidence and remaining work

The accepted [binding contract](jedi-script-binding-capture-contract-20261103.md),
decoder, anchors, tests and recovery were read. Original PE/three GOB hashes
were rechecked from existing retained bytes; no assets were downloaded,
rediscovered or extracted again. Original member pins and accepted ancestry,
Coords, health, inventory and clock evidence are reused unchanged. Static
contract/arithmetic tests were not repeated as a runtime result.

The first next prerequisite is a complete pinned fixture input checked before
building or executing the adapter. A later authorized attempt must exercise
the committed-store boundary and all required stop/identity/nesting/failure
fixtures before original execution. All-path health/shield writer coverage and
host-only release/persistence acknowledgements remain open.

Authentic victim+29c at original `0x4dfe04` and taken branch at `0x4dfe0c`
remain unknown, including null/non-null, process/module/thread/generation,
template-instance allocation lineage, selected resource bytes/cache/compiled
definition and message10 resolution. No Kyle insertion, manufactured handler,
+2a0, linked or inventory listener is claimed. The prior8699ms interval remains
unattributed. No screenshot or gameplay progress was obtained.

The predeclared startup cap was300 guest/360 outer seconds, no retry or budget
increase, original native CLI/full startup/NewGame/Easy only. Zero original
launches occurred. No encounter steering, guest campaign writes, injected
engine calls, map loads, movement, health edits, browser, subworkers, foreign
process/box operations, public deployment or CACA003B work occurred.

## Recovery and lifecycle

Own boat `bx_cgu8x5q6`, finiteTTL3600, original expiry
`2026-11-03T17:22:53.090Z`. Delegated normal shutdown was recorded on the board
before use, as explicitly requested by this task. SSH/SCP returned403; the
existing authenticated private file/exec API was used instead, with no signed
URL or credentials retained.

Recovered archive SHA256
`3c905ec6b580d57575be4bcdd86722ce6dc4ba204d28f66b5c3324983a5e3e72`.
All9 payload sizes/fullSHA and exact archive membership were verified locally
before requesting normal shutdown. Own supervisorPID8863 was absent; no runtime
helpers remained. The archive retains both compiled modules, complete build and
failure logs, the exact attempted adapter and launcher. See local `RECOVERY.md`
for read-only verification; do not resume the boat to reproduce this failure.

Normal stop operation `stop_cf05281057d8bbc0` is recorded with final verified
state in `boat-final-info.json`. Custody returns to coordinator. Stopped
Alice/Jedi predecessors and Falling Leaves' boat were untouched. AUTHOR RELEASE,
then STOP; no successor.
