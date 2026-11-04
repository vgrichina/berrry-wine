# Stronghold Custom Game drain capability, 2026-11-04

No new original was launched and no causal repair is claimed. The offline
capability gate fails: a valid execution of the original renderer can exceed
the unchanged observer boundary cap before returning. The exact cause of the
historical DOWN drain remains unknown because its intermediate queue state
and native render arguments were not retained. Repeating that original would
not meet this assignment's prerequisite.

Input commit: `9707f95251b9ba1c1d25cee3bf22a8d2085c8792`. See the
[preceding original result](stronghold-first-script-cause-onward-20261104.md).
Evidence: `scratch/runs/20261104-stronghold-customgame-drain-cause/`.

## Actual producer and retained execution

`audit.cjs` reads the sealed route and applies the production `composeRoute`,
then executes its actual `PhysicalRoute.drain` method with the actual readiness
and ownership predicates. An empty queue with the owned active/last DOWN event
still waits. After the next fixture poll supplies explicit null/null, it
returns with held mask 1. Missing telemetry, foreign input and wrong mask
reject before another step. There is no demonstrated mask/default-argument
or return-value defect in this producer.

The production `host.js` input body is also executed with the exact retained
DOWN entries. It dequeues 132 then 513, retains the last/active 513 after the
queue empties, and clears both on an empty poll. The fixture dequeue is a
minimal queue adapter, not an original guest message pump. It proves this host
receipt lifecycle, not WndProc dispatch or callback completion. In the actual
Worker transport, per-slot event save/restore also preserves follow-up message
arguments; a host empty queue cannot certify guest dispatch.

The retained observer's 14 successful post-DOWN ACKs sample these PCs:

| Steps | Observer blocks | Native PC |
| --- | --- | --- |
| 7872 | 163000 | `0x4554a5` |
| 7936–8128 | 227000–419000 | `0x4554d7`, `0x45550a`, `0x4554bf` |
| 8192–8384 | 483000–675000 | `0x44fd80`, `0x44fe0c`, `0x44fe38`, `0x44fd88` |
| 8448–8704 | 739000–995000 | `0x44f7d8`, `0x44f7e6`, `0x44f7dd`, `0x44f810` |

These are native rendering loops, not callback `0x430e10`. No native callback
entry or pending saved-return interval was recorded. ACK annotations contain
no queue/active/last fields. The final queue was sampled after cleanup UP;
it cannot establish when DOWN first became eligible for the drain predicate.
The next frozen advance to 8768 failed its observer check and is not a
successful ACK.

`set_trace_esp(1,0,0)` arms all native block entries. In `src/13-exports.wat`,
`dbg_recompute` sets both chain and tier guards for that flag, requiring blocks
to return through the run loop and preventing micro-op loops from hiding
entries. A host 64-step ACK is therefore neither 64 native blocks nor a
completed message/frame. The retained increments of 64000 boundaries per ACK
are consistent with this distinction; they do not prove input dispatch.

## Executed capacity counterexample

`native-render-capability.cjs` loads the exact original EXE in each existing
normal/compatibility module and executes the unmodified function `0x44f6e0`.
Only fixture caller bytes, stack and initialized data are supplied. The
800×600 RGB565 surface contains nonzero pixels; arguments are
`(0,0,799,599,32)`, with deterministic lookup data. No native function is
patched, no callback is invoked or fabricated, and no scene is synthesized.
These fixture writes are offline setup, never writes to an original runtime.

Both modules execute **1,441,804 entries inside the original render function**.
The complete fixture has 1,441,856 entries including its caller and stop-loop
padding. The actual observer is attached before instantiation and started
before execution. It fails at **1,000,001**, while the function is still in its
pixel loop. The fixture sees that fault after its enclosing 64-block run
returns, at total 1,000,064 and PC `0x44f7d8`.

The remaining execution is continued only in this offline parity experiment;
the production driver still stops on the first fault. Full 512 MB page hashes,
all sampled general registers and lazy flags, surface output, native PC
histogram and every run-command result exactly match the trace-armed control.
Neither arm has an input queue or game command stream: this is an isolated
renderer capacity proof, not input-to-callback or gameplay evidence.

The loop compares X at `0x44f7d8`, tests a pixel at `0x44f7dd`, converts a
nonzero pixel at `0x44f7e6`, increments at `0x44f810` and advances rows at
`0x44f818`. Its static caller at `0x469a43` passes runtime rectangle fields
after clipping. Those fields were not captured in the failed original.
Consequently this counterexample proves that the current capability contract
can reject valid rendering; it does **not** prove that the historical call used
the fixture rectangle or fully explain its DOWN-drain failure.

## Validation and stopping condition

Both-module executable owning-Worker callback/branch/scene/setup fixtures,
pre-instantiation binding negatives, actual attached-driver composition,
local command/review contracts and route recognition checks pass. Test output
roots are redirected in memory to this run; retained helper inputs remain at
their original paths. An initial test-output adapter mistakenly redirected
the command-client input too; correcting that adapter restored the passing
local tests. This was an offline harness error, not a product repair.

`flock /tmp/wine-build.lock bash tools/build.sh` passes. Normal and compatibility
module hashes remain respectively
`78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664` and
`99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f`.
EXE SHA remains
`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
All 554, 418 and 523 predecessor sealed artifacts match their existing seals.
Source recovery uses Git SHA plus relevant binary diff/new-note patch;
media/modules are existing-path/hash references, with no source/media copies.

No old-fail/new-pass causal repair exists here. A complete genuine
input/control-flow capability within the original bounds has not been
demonstrated. Resetting, enlarging or dropping boundary history, skipping
drainage, changing pacing or granting callback/scene readiness would not repair
that missing proof and was not done. No engine change is justified by the
missing historical native state. The task stops on this concrete capability
blocker, with setup/preset/Start/world/gameplay unreached.

There is no new Chrome, server, profile, local-runtime flock or assigned box.
Box ID/state/expiry are NA; the coordinator retains lifecycle ownership.
