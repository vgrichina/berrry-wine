# Compiled COM token boundaries — 2026-10-20

Base: fetched `origin/main` verified as
`bc4e1436eeeb02f9063d75066436b20ce2f54eff`.
Branch: `task/com-token-real-boundaries-oct20`. No main integration.

## Existing coverage and precise addition

Read `test/test-callback-invocation-tokens.js`,
`test/test-js-com-callback-ownership.js`,
`docs/re-notes/js-com-owner-review-20261020.md`, and
`scratch/runs/20261020-js-com-native-run/report.md` before implementation.

The invocation test already compiles actual ownership helpers and sync hooks:
63 children, over-capacity unchanged-state rejection, stale slot/root and
process epoch, wrong thread, retained primitive tokens, and serial exhaustion.
It does not compile COM wrappers. The JS COM ownership suite interprets wrapper
ASTs but models primitive admission, identity and capacity. The native report
qualifies positive lifetime/nested and separately labeled direct activation
callbacks plus malformed-ret rejection, not these boundary cases.

The new test adds only their missing composition: production COM enter/check/
leave bodies compiled with the actual invocation helpers and sync-depth bodies.
It uses the existing `parseSource`/`compileClosure` lightweight convention, a
single shared 64-KiB memory and the existing private ownership layout. The
ownership block is copied directly from source; selected functions are rendered
from their production ASTs without changing their bodies. No token primitive
or rejection implementation is modeled.

Audio lifecycle notifications return zero and debug recomputation is inert;
neither supplies token decisions. Fixture setters initialize thread IDs and
spill globals. Production process/thread initialization performs all epoch,
root and slot publication. Invalid thread testing changes the instance thread
ID; retained expected tokens are supplied through the compiled i64 interface.

## Results

`node test/test-com-token-real-boundaries.js`: six groups PASS:

- Capacity: 63 actual nested COM children with distinct BigInt tokens, exact
  invocation/sync depths, rejection of child 64, reverse valid unwinding and
  subsequent valid acquisition. Actual ABI has 64 stack entries including root.
- Retained expected token: parent while child is active, retired parent/child
  against a new sibling, and a token differing only above bit 31, rejected by
  both compiled COM check and leave. Valid child/parent/sibling controls pass.
- Epoch retirement: production process restart invalidates an older instance
  holding a child; enter/check/leave reject.
- Thread-slot/root replacement: a new instance publishes a new root in the
  same slot; old instance enter/check/leave reject, replacement remains valid.
- Wrong thread ID: enter/check/leave reject; restoring the correct ID allows
  the original valid child to be checked and left.
- Uninitialized alias of a live slot: enter/check/leave reject without stealing
  the slot. The initialized main owner remains valid in all stale cases.

Every rejected operation snapshots and compares the entire shared memory and
all fixture instances' ownership, sync-depth, pin, spill and control globals.
Thus the shared serial, stack, parent root and replacement owner are protected,
not merely the returned exception. Spill bookkeeping is exercised with a
suspended IP inside a fixture spill range; this is not reclamation coverage.

Eight independently compiled mutations are rejected by their targeted
behavioral assertions: capacity off by one; pin corruption before capacity
trap; omitted epoch, root or thread validation; unchecked COM leave;
32-bit-truncated token comparison; sync-depth mutation before COM validation.
Each mutant must compile and instantiate successfully first. Mutation compilation
failures cannot count as successful negative controls. The first corruption
control still traps, proving unchanged-state checks detect more than acceptance.

Existing primitive test PASS; new script syntax and scoped diff checks PASS.
The first primitive rerun exposed missing sparse read dependencies
`region-map.generated.js` and `audio-worklet-host.js`; checking out those exact
base files resolved it without installs or production edits.

## Evidence and limits

Self-contained evidence: `scratch/runs/20261020-com-token-real-boundaries/`.
`snapshot/` contains exact test, production source and compiler dependencies;
`replay.js` verifies SHA-256 pins and reruns both tests from that snapshot.
`result.json` records source Git blob IDs, environment, checks, resource limits
and preservation observations. `test.log` and `primitive.log` retain output.
The native report is copied solely as prior qualification context.

This closes compiled helper/COM-wrapper capacity and stale/retained-owner
composition coverage. It does not execute storage.js callbacks, x86 guest code,
a full VM, public activation, browser or Boat runtime. Existing native results
are not rerun or expanded by this test. Serial exhaustion remains covered by
the existing primitive suite, not newly claimed at the COM wrapper boundary.
Concurrent retirement/atomic races, actual spill pressure/reclamation, native
capacity/stale rejection, abort/yield/exit/budget behavior, public activation
through the JS carrier, and whole nonlocal-jump readiness remain unqualified.
No locks, production, setjmp/longjmp, audio, API or host files were edited.

Only this note and the new JS test are committed. Evidence is separately
retained because Git does not preserve ignored run artifacts. Fresh sparse
worktree, no installs, an 8-MiB own-expansion cap and the 2,210,398,208-byte free
floor apply; measured receipts are in `result.json`. Shared HEAD/index and
unrelated work are not modified.
