# Owning readiness selection before inherited inspection

The offline repair composes the actual original driver with the published cache
integration and selects its initialized owning target before executing the
unchanged `owner-inspect.cjs`. Production Node Workers and both shipped modules
pass the focused tests. Browser target discovery and a natural game attempt have
not run. The failed evaluation in `126f106e4` still has **unknown identity**;
the later foreign Worker console message does not identify it.

Evidence: `scratch/runs/20261104-deusex-owning-readiness-repair/`.
Background and retained dependency recipe:
[natural boot](deusex-natural-bound-cache-20261104.md) and
[complete original input preflight](deusex-complete-driver-input-preflight-20261104.md).

The retained inspector checks `instance` before checking slot/thread. Production
`lib/guest-thread-host.js` creates the page-side `WorkerLink`, assigns its unique
numeric endpoint, and posts the module/memory/slot in `init`.
`lib/guest-worker.js` assigns `endpointIdentity` before awaiting instantiation;
its `ready` response follows instantiation, cache binding and initialization.
The response itself has neither endpoint nor sequence: its provenance is the
exact Worker object receiving it. Treating an arbitrary Worker's absent instance
as an owning failure was therefore unsupported.

`tools/deusex-owning-readiness-driver.cjs` installs its constructor interceptor
after the existing cache interceptor and before the first `launchApp()` click.
Every guest Worker gets a unique `__deusex_readiness=SESSION:COUNTER` URL query
parameter **before construction/startup**. The original origin, pathname, `v`
parameter and constructor options remain bound. The retained actual pinned
server selects by pathname; the actual Worker derives nested import versions
only from `v`. Tests execute those exact server/version expressions, without
opening a socket. A premarked or cross-origin target is rejected.

The page retains references to the actual init message, module, memory and
Worker, and observes its original ready/error events without changing them.
Repeated init, duplicate endpoint or multiple slot-0 identities are terminal.
Selection checks the current link's object, module, memory, endpoint and slot
against those retained references and rejects stopped/replaced links. Until its
ready event arrives, the existing boot loop continues under its existing bound.
After ready, exactly one browser Worker URL must match the marked owner URL.
**Foreign targets receive no evaluation at all**, including during startup.
Only the matching target receives a read-only provenance check of endpoint,
slot, initialized instance and imported/exported memory identity, followed by
the unchanged inspector. Target object and session are retained across samples;
missing, ambiguous, detached/replaced or inconsistent targets fail. There is no
catch/retry around selection, inspection or readiness. The first owning Worker
transport error is retained, including an error during init before ready.

The transformed loop treats a selected inspector's wrong slot/thread as terminal.
The original `GIsRunning`, Engine mapping, visible window and Draw predicates are
unchanged. The natural tail from `readiness-met.json` onward is byte-identical to
the published cache composition: status/stop still use its original queued
`_ask`, preserving command/response objects and sequences. The cache preinit
option is still added exactly once, with 1,000,000 boundaries / 256 records /
10,000 ms per source. Eight minutes, the original readiness reserve, first
failure, output caps and raw-before-PNG ordering remain intact. Selection adds
no guest run, slice, step, Draw, input, configuration or register writes.

## Offline qualification and limits

The focused test executes the actual transformed boot-loop source, unchanged
inspector and production Worker command queue over both module variants. The
page facade, finite test clock and host observations are explicitly synthetic.
Production init runs on Node Workers; no game is loaded. Controlled fixture
thread-ID/instance changes exercise rejection paths and are absent from the
repair. Browser-style global publication of the exact production Draw helper is
provided for the Node inspector fixture.

Covered paths include initial owning startup before ready; actual foreign init
scheduled during inspection; absent and initialized foreign instances whose
evaluation would throw a test failure; missing/ambiguous targets; wrong endpoint,
thread, slot or memory; stale module/link/target/session/URL; duplicate identities
and replacement init; exact inspector exception propagation; and actual failed
production init before ready. Real queued cache status and stop responses retain
object identity and sequences 91/92. The only owning commands are init, status
and stop; the only foreign command is init. The separate synthetic constructor
fixture checks message/transfer/return identity and rejection before posting.
These are transport/inspection tests, **not game readiness or browser proof**.

Commands passed:

```sh
DEUSEX_READINESS_TEST_OUTPUT=scratch/runs/20261104-deusex-owning-readiness-repair/focused.json node test/test-deusex-owning-readiness-driver.js
node tools/deusex-owning-readiness-driver.cjs --check scratch/runs/20261104-deusex-complete-driver-input-preflight/next-driver-fixed.cjs
node test/test-deusex-natural-bound-cache-driver.js
node test/test-worker-bootstrap-progress.js
node test/test-worker-bootstrap-retirement.js
node test/test-worker-wasm-globals.js
node scratch/runs/20261104-deusex-worker-observer-integration/transport.cjs
node test/test-deusex-cache-loader-binding.js
flock /tmp/wine-build.lock bash tools/build.sh
```

The relevant queued transport regressions check real Worker slice/whole-state
parity and loader/cache opt-in parity. They do not qualify natural Draw. Module
paths/hashes, referenced without copying:

| Path | SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `4417305d70322467441aef51e888b0fe66451d9c60da0c734eeb23f5a22c0a6b` |
| `build/wine-assembly.compat.wasm` | `07fb4e75d05177271097dcd67d84e2629272b50073074bbdea8825ce10b4ed34` |

## Runnable future entry and exact prerequisite boundary

`--check` authenticates the original prepared driver SHA
`fcfe9b91543e28046fe098b703458ea820471d6757e9280881224b0c6753bb21`,
unchanged inspector SHA
`83b48f6e23b80f92af6e078c2c17a3879cf3d0a69c43518002248b119a849949`,
and **20 original helper pins** from retained manifest SHA
`648115ab5604e24070534b6270a99ba64218f6b540e6aae9021ec8899130dfa0`.
Released `.gz` evidence is decoded read-only in memory. The published cache
composition must still match its original helper pin. No helper source snapshot
or archive is made.

The runnable entry uses the original natural run's exact staged helpers and
manifests. `--run` compiles the composed body in memory with their original module
filename, then calls its original main; no archived driver is overwritten.
On a **separately allocated, coordinator-owned future runtime**, reconstruct the
original input recipe from the linked notes and recorded Git/diff, verify every
transfer/reference, run the original twelve prerequisite/HTTP/served controls,
and qualify this entry before its single authorized launch:

```sh
export DEUSEX_OUTPUT="$PWD/scratch/runs/20261104-deusex-natural-bound-cache"
export DEUSEX_PIXEL_INPUT="$DEUSEX_OUTPUT/archived-producer.json"
# BASE is the retained prepared original, not the already cache-transformed driver.
BASE=scratch/runs/20261104-deusex-complete-driver-input-preflight/next-driver-fixed.cjs
node tools/deusex-owning-readiness-driver.cjs --check "$BASE"
node tools/deusex-owning-readiness-driver.cjs --preflight "$BASE" "$DEUSEX_OUTPUT"
# Only the coordinator's future assignment supplies DEUSEX_CLOSE_AT and launch.
node tools/deusex-owning-readiness-driver.cjs --run "$BASE" "$DEUSEX_OUTPUT"
```

Record the new Git commit, both tool hashes and all original helper pins as launch
inputs. Existing original input preflight still runs before server/browser
construction and again inside main; no pin is relaxed. The existing supervisor's
single launch should invoke this `--run` command instead of the archived driver.
The original full eight-minute window plus recovery reserve must fit. The code
does not extend a deadline, retry a browser or allocate anything.

The local `--preflight` was exercised and **correctly failed before any server or
browser** at the first differing dependency:
`lib/deusex-ordered-producer-observer.js`, expected 9,057 bytes /
`c33adc61c76406e896e9a0cb2dc373fdffd4c3c330ed758121bc48a63b017092`,
actual 11,085 bytes /
`835d15befc348faff4b50d88d5e7f6878f4238f091d76b9bf34f3c6f7877d2a7`.
The original is recoverable at Git `36661cb71b738cf08d91ad51edf55e97084423af`;
the inherited runtime recipe deliberately retained it. Do not silently substitute
the newer shared-checkout adapter or repin this original composition. No original
runtime qualification is claimed from the local refusal.

Evidence records Git SHA, relevant binary diff and owned new-file patches,
helper/media/module path/size/hash references, test logs and results. No source
tree, media or module copies were made. No Chrome, game, external API, allocation,
box access, lifecycle action, subworker or deployment occurred. No box was
assigned to this worker. Prior `bx_t2kna5qz` remains closed: normal STOP at
2026-11-04T15:36:28.043Z, snapshot verified 15:36:27.997Z, former expiry
16:03:07.608Z; never resume. The coordinator owns all future runtime allocation
and shutdown. This task ends with the tested repair and precise preflight
boundary; there is no new readiness, Draw, pixel or gameplay claim.
