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

The implemented route, checked against an in-memory candidate, serializes only
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
admission are unchanged.

Seven focused Node/VM tests cover large unused operands, ready/pending/held-paint/
damage/missing/error combinations, every compared identity and selection exception,
replacement/overlay/visibility refusal, exact guard-source preservation, one-call
UNKNOWN propagation, bounded nested capture expressions, passive deadline refusal
without a ticket or input, and the fresh-run admission gate. The broader focused
suite passed 67 tests with one expected opt-in skip. The helper suite and exact
`flock /tmp/wine-build.lock bash tools/build.sh` passed. The resulting WASM stayed
2,217,109 bytes; no renderer or WASM change was made.

Evidence: `scratch/runs/20261115-quake3-compact-readiness-gameplay/`.
Git commits plus binary patches preserve source; existing media is pinned by
path and hash. No source/media/WASM bundles, workers or boxes were created.

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

## Qualified and published route

Feature `ec4644fddbafd2d332905daa73ff933fc22791a2` was committed on main and
immediately strict-pulled/pushed before the original. The final qualification
used 1,031 source/media/dependency pins and 1,398 host pins. Incomplete dependency
manifests and a subsequently discovered Vulkan mapping gap were refused and
retained. A partial DevTools port read and a partial PID-file read in separate
causal fixtures were also retained as rejected attempts. The final complete
source, native and five-case causal qualifications passed without changing the
controller after the full build.

Real Chrome compared legacy and compact expressions atomically across ready,
held paint, pending publication, damage, owner replacement, overlay, validator
error and output selection. All eight results/errors matched, with no changes
to publication, capture or held-paint state. Native current-source inventory,
independent key/Mouse1 UP, immutable capture, visibility transitions and permanent
UNKNOWN checks passed. Arm-to-UP upper bounds were 137 and 132 ms respectively.

The final fixture emitted 667,961 versus 10,630 expression bytes. Legacy/compact
JSON serialization took 0.627/0.017 ms, compile roundtrip 8.059/1.056 ms,
run roundtrip 6.102/4.917 ms and sampled body 3.865/3.230 ms. Compile roundtrip
includes transport and inspector work; pure compile and pure transport remain
unresolved. These fixture observations do not solve historical request 1113.

## One original and exact next boundary

The one newly authorized ordinary original used unchanged registered media,
arguments, real clocks, cooperative 10,000 scheduling, 1800-second native and
1820-second independent deadlines, 180-second Quit reserve and three-second
operations. Before host consent I personally viewed the complete native textured
Quake III startup background and actual host fullscreen strip/button. Host
consent remained distinct from game binding; its independent mouse UP was
acknowledged 139 ms after DOWN.

Host fullscreen was observed active at 09:43:23.886Z, with viewport 1920×996 and
fully visible output. The later public observation at 09:43:27.444Z had
`fullscreen: null`, viewport 1024×757 and output `(0,34,1920,962)`, so the
unchanged guard correctly refused `output outside viewport`. The cause of the
fullscreen exit/layout mismatch is not established. No resize/reentry/input
recovery was attempted.

Page `Runtime.evaluate` 753 emitted 10,654 bytes, SHA-256
`63c4e9f5b1f8bc7840a675bc48ab110de712447380bbc8da9d097722dafb03a1`,
and returned a visibility exception in 58.241 ms. It did not time out. The
ordinary failure-capture request 754 then reached its fixed three-second
`Page.captureScreenshot` UNKNOWN boundary. There were zero requests after
terminal. No permanent game binding, game DOWN, ready menu, arena, enemy
consequence or native Quit occurred. Host shutdown is separate from native Quit.
The authorization is consumed: no retry, replay or old-run rebind is allowed.

The new full latency trace contains an overflow marker and all 324 snapshot
attributions are refused. No cap was increased, overflow removed, or bounded
prefix substituted to imply full attribution. The predecessor's separately
valid immutable prefix of 325 snapshots retains only its original narrower
meaning. No production shader/renderer rewrite follows from these traces.

Next work must qualify the fullscreen-exit/viewport/layout convergence boundary
while retaining exact current owner/output and visibility guards. Any further
ordinary original requires fresh authorization after a material qualified fix.

## Closure

Release receipt SHA-256
`66bff2972b41eeab2e8058442c2fb3c94482f6239a41fe161c49bb68e71906c0`
indexes 103 actual wait records with both EOF and 340 absent PIDs/groups.
Direct native/watchdog/supervisor-child/launcher exits were 1/0/0/0.
All 2,429 original source/media/host pins and 13 foreign WIP code paths were
unchanged at closure, both locks were free, the browser profile was absent,
and shared source/build/runtime was explicitly released at 09:45:24Z.
The ancillary board watcher parent returned 143 through the terminal tool;
its parent and child are absent, but EOF flags were unavailable and remain
UNKNOWN. This does not reclassify any direct runtime wait.

Box ID null; state NOT_CREATED; expiry null; stop receipt NOT_APPLICABLE.
