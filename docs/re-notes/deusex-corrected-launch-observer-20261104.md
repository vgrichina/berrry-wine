# Corrected Deus Ex launch reaches original Engine; bounded observer sees no Draw entry

The corrected launch succeeds far enough to run the original demo and start
its real owning-Worker observer. The first missing native boundary is **Draw
entry**, not selector readiness or a generic HTTP 404. The single bounded
observation returns `expired-incomplete`, with zero events and
`observedReturnPair: false`. There is no Draw/Lock/Unlock/tail/saved-caller
trace, and no gameplay or blank-image acceptance claim. No second browser,
reload, or collector restart was attempted.

This follows published `35444392e` and owning observer
`95d489747cec3ce841170681e5db9819019b1d78`. Evidence is in
`scratch/runs/20261104-deusex-corrected-launch-observer/`.

## Corrected helpers and prerequisites

The exact checkout recorded at preparation is
`466b129a12d21af97d0244f7bde8d18acf265289`. The local corrected helpers from
`20261104-deusex-selected-launch-trace` were used; the recovered attempted
overly broad classifier was not substituted. The 327 retained pins were
verified unchanged. Seven small helper/fixture files were staged once in a
new `corrected-evidence` directory, producing 334 pins; no source tree,
game media, or module was copied. The retained native support-path recipe,
Puppeteer-core 25.7.0, current Worker graph, and WASM were reused.

The retained WASM is 2,143,712 bytes, SHA-256
`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
The current Git versions of index, host, app registry, browser shell, Worker,
observer, and owning-observer test match their retained pins. This is the
requested retained binary, not a claim that a new build was performed.

Before Chrome, the exact staged classifier passed the recorded ordinary
404 negatives and recorded actual `ERROR launching notepad` positive.
Explicit launch failures, system-data failures, Worker/runtime errors,
`unreachable`, and crashes remain terminal. Actual-index selector fixtures
reject missing candidates, `prod`, remote origin, absent actual option,
selection fallback, wrong executable, and executable-bytes override.
Remote actual imports, all 334 SHA/size pins, pinned HTTP isolation and
missing/mutated-input negatives, real WorkerLink command integration, and
actual-WASM local-export/owning-Worker observer fixtures passed. Synthetic
x86 in these fixtures tests the mechanism; it is not native-game evidence.

The helper additionally requires measured `_exeUrl` to equal the original
executable before starting the observer. No production file was changed.

## One actual browser and measured module

Chrome/151.0.7922.71 ran **06:34:34.367Z–06:34:38.765Z** on 2026-11-04.
The actual URL was `index.html?debug&candidates&no-log`; the actual selector
contained `deus_ex_demo`, Puppeteer selected it, and the pre-Launch registry
executable and post-Launch `_exeUrl` both matched
`test/binaries/candidates/deus-ex-demo/installed/system/deusex.exe`.
The HTTP server served that executable with SHA-256
`2ed115d9dc93582273830d9ae38f92ab4379842459e24eaec11390f312d5af5f`.

Original Engine.dll was served at **06:34:36.285Z**, 1,736,704 bytes, SHA-256
`3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0`.
Actual Worker inspection resolved its LIVE mapping using the actual
instance exports, module lifecycle generation, export-directory name,
preferred-image-base guard, and original Draw prologue. Before and after:

| Measurement | Observed value |
| --- | --- |
| Owning Worker slot / observer thread | 0 / 1 |
| WorkerLink endpoint identity | 1 |
| Engine module table index | 2 |
| Engine load address | `0x10f82000` |
| Engine generation | 1 |
| Engine mapped size | 2,859,008 bytes |
| Actual instance exports | 2,262 names; `instance.exports === ex` |
| Actual instance memory | 536,870,912 bytes |
| Relocated Draw entry | `0x110109e0` |

The observer retains that actual exports object and checks it on its ordinary
slice path; the prebrowser actual-WASM fixtures also reject a foreign
instance. The served file hash and loaded mapping/prologue observations are
separate evidence: this does not assert a full relocated-memory image hash.
A secondary Worker in slot 1 was logged during startup; collection targeted
the real slot-0 WorkerLink only.

Generic build-info/auth/favicon 404s did not terminate launch. An optional
font `__bundle` request also returned 404; all five requested FON files were
then served individually, matching the host's fallback path. There were
217 served requests and 91 console messages, with no recorded page error,
pinned-server error, terminal classifier match, or `first-failure.json`.
These ordinary resource messages are not launch failures.

## Tested first missing boundary and diagnostic limit

At **06:34:36.839Z**, the running slot-0 Worker had EIP `0x10d12ccc`, yield 0,
and 19 loaded DLLs. At **06:34:36.847Z**, the real WorkerLink acknowledged
`drawObserver` start, `active: true`, `result: null`, with exactly
`maxBlocks: 50000` and `maxMs: 1000`. The helper then sent status requests;
ordinary host scheduling alone executed the guest. Ten status replies were
active before the terminal reply at **06:34:37.328Z**:

```json
{"status":"expired-incomplete","events":[],"observedReturnPair":false}
```

The tested blocker is **no natural Draw entry within this bounded early
startup observation**. With no entry, Lock, Unlock, tail, epilogue and saved
caller are also unobserved. Engine mapping and generation remained equal in
the post-observation inspection. Its EIP was `0x125b35e7`, yield 0; that is a
later event-boundary read, not the collector's terminal PC. Once the observer
finishes, ordinary execution may continue.

The helper armed at the first `running` plus LIVE-Engine predicate, immediately
after startup. That predicate does not establish readiness for the first
natural Draw. The 481 ms acknowledgement-to-terminal interval is consistent
with exhausting the block bound before the 1,000 ms time bound, but the
result does not persist remaining block count, elapsed monotonic time, or
terminal PC. Exact exhaustion cause and native startup location therefore
remain unmeasured. This is a sampling/readiness limitation, not evidence
that the game cannot reach Draw or that a particular native function failed.

The offline evidence analyzer verifies exact staged helper hashes, every
recovered SHA/size, selected executable, original Engine response, generation,
actual exports observations, status sequence, empty native result, absence of
recorded terminal errors, font fallback, and browser cleanup. The prebrowser
actual-WASM fixtures cover incomplete/no-entry and bounded routes. No
synthetic native success is substituted for the empty original-demo result.

`engineRender` and `viewportPlayer` remain NULL. Lifetime and viewport-to-host
surface remain UNKNOWN. No screenshot was taken. No forced Draw, repaint,
guest writes/calls, breakpoint retargeting, gameplay pulse, save/configuration
or geometry change, historical Worker, or gameplay input was used. The
inherited native support-path recipe is the only launch registry adjustment.

The next separately authorized attempt needs an evidence-based read-only
native readiness predicate before this same bounded collector, and better
terminal budget/PC reporting if needed. It must preserve natural execution;
this task does not retry or infer a readiness delay from the empty result.

## Recovery and handoff

Twenty unique closed artifacts, **407,466 bytes**, were recovered with full
SHA-256 and size checks before 06:35:01Z. All 334 remote pins were verified
unchanged after closure; actual process inspection found no Chrome or Node
driver. Exact Git SHA, relevant tracked binary diff, and owned new helpers
and note patches provide source recovery; no source archive or repeated
media/module evidence copy was made. Only this note is committed, so no
production build is required.

**bx_9ffuymfg remains RUNNING** (API `idle`, healthy/hydrated), expiry
**2026-11-04T07:19:23.841Z**. Shutdown ownership returns to the coordinator.
No box lifecycle, allocation, resume, local heavy run, subworker, successor,
Heroes II action, or public deployment occurred. This single-task worker
stops after publishing the precise tested first missing boundary.
