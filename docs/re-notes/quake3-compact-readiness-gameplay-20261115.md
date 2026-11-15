# Quake III bounded readiness operands, 2026-11-15

This task follows diagnostic `dfd7a8935` and report `b22c360b3`. The closed
original's snapshot 728 measured 2383.853 ms total, 2361.780 ms before entry,
0.025 ms body and 2347.189 ms overlap with observed synchronous GL calls.
That is neither a driver root cause nor attribution of old request 808.
The full 30,000-event overflow remains preserved and refused; only the separate
immutable prefix of 325 snapshots has valid narrower attribution.

The later page readiness request 1113 exceeded its unchanged three-second
operation deadline. Its 590,905-byte expression has SHA-256
`80d3a42e85dd4d08558f618014f815a071d35cf954627708124e5fb085d5662b`.
No later requests or game DOWN, menu, arena, enemy consequence or native Quit
occurred. The cause remains UNKNOWN; this task does not replay that run.

## Light inspection and candidate

The plain binding and Quake III binding have identical 5,535-byte `PAGE_READ`
and 6,897-byte readiness expressions for an empty identity. The actual diagnostic
composition adds public visibility operands and binding emission: `PAGE_READ`
is 8,550 bytes and empty-identity readiness is 9,912 bytes. Composition alone
therefore does not explain a 590,905-byte request.

`createChain.readLive()` constructs identity with `{...a, workerTarget, ...}`.
Here `a` includes the entire diagnostic output visibility observation, slice and
physical state, as well as identity tokens. `readinessExpression()` serializes
this entire identity, although its comparison loop consumes only named fields
from `FIELDS`. Capture and queued-input expressions likewise serialize it.
The final retained page observation's outputVisibility alone serializes to
578,581 bytes. This directly demonstrates diagnostic operand inflation; it does
not measure transport, V8 compile or page execution delay in request 1113.

The new focused test prepares an in-memory candidate that serializes only
`FIELDS`, with a 256-character maximum per string, finite scalar operands and an
8,192-byte encoded operand limit.
It retains the full page read and every comparison, owner generation token,
output visibility check, held-paint/damage check and current-display validator.
It retains rich diagnostic identity outside expression serialization, including
publication used by the independent capture publication comparison. No new
page helper, installation lifecycle or source-reuse exception is necessary for
this minimal reduction. The emitted readiness size has a fixed bound independent
of diagnostic DOM size. Invalid oversized or structured identity fields refuse
before any request. Production renderer, WASM, native limits and input/capture
admission are unchanged in the candidate.

Six prepared Node/VM tests pass: large unused operands, ready/pending/held-paint/
damage/missing/error combinations, every compared identity and selection exception,
replacement/overlay/visibility refusal, exact guard-source preservation and
one-call propagation of UNKNOWN, plus bounded nested capture expressions and
passive deadline refusal without a ticket or input. These are preparation fixtures, not real Chrome
semantic or delay qualification. Candidate implementation edits remain in the new test only. The additional new
fixture helper prepares atomic real Chrome comparisons and separate
`Runtime.compileScript`/`Runtime.runScript` roundtrips. Body samples use the page
monotonic clock; compilation roundtrip includes transport and inspector cost,
so pure V8 compilation and transport remain separately unresolved.

## Required continuation

Heavy order is TIM663766, Sims677879, then this task. Shared source, helper,
controller, build, native, browser and original work await explicit releases
and personal verification of direct native/watchdog/supervisor-child actual waits
with both EOF and absent PIDs/groups. Expected waiting is normal. Foreign WIP
must be preserved.

After release, apply only necessary owned serialization changes and qualify
real Chrome semantic equivalence, timing boundaries, source identity, native
finite key/Mouse1 independent UP, immutable capture, visibility and permanent
UNKNOWN. Run the full locked build and publish coherent owned files on main
before the single newly authorized materially changed original. Retain fixed
1800/1820 deadlines, 180-second Quit reserve and three-second operations. This
note makes no claim that reducing bytes solves the historical timeout.

Evidence destination: `scratch/runs/20261115-quake3-compact-readiness-gameplay/`.
Use Git SHA plus binary patches and compact logs/pins; reference existing media
by path/hash. No source/media/WASM/capture bundles. No box or worker created.

## Implementation after release

TIM release `f21ba441` and closure `82e717d8`, and Sims release `b508c54e`,
were personally checked against direct actual waits with both EOF and absent
PIDs/groups. All indexed hashes matched. Additional final wait/process records
were read too; historical ancillary EOF gaps remain UNKNOWN. Both locks were
free before heavy work. Thirteen foreign modified code paths were pinned.

The actual controller now adds one bounded scalar serializer and changes four
identity serialization sites. The focused tests assert its entire composed
source equals the prepared serialization-only candidate. Rich observations and
publication metadata remain available outside emitted request operands.
The new task entry point composes the released diagnostic implementation with
fresh destinations and adds the real Chrome semantic/timing qualification gate.
It leaves the predecessor entry point and run untouched. Renderer, WASM,
source inventory and native gesture implementation are unchanged.

Current qualification results and, only after publication, the single ordinary
original outcome will be recorded in this run's final result. Pure transport
and compiler-internal duration are not separately observable from a CDP compile
roundtrip. Body timing is independently sampled; no historical timeout cause is
claimed solved by either fewer request bytes or fixture timings.
