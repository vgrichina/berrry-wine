# Jedi pinned native store fixture — unresolved first-store boundary

**Packaging fixed and real WASM fixtures executed; native first-loss stop is
not qualified.** The existing watchpoint executes the forbidden `INC EAX`.
A retained instruction-boundary candidate fixes that fixture, but an actual
two-iteration `REP MOVSD` commits a second vital store after the first loss.
The required all-writer first-store integration remains open.
`readyForCampaign=false`, `runtimeIntegration=false`,
`actualDamageProven=false`, `usableDamageAttribution=false`.

Exact input: `8365c62ee8f0f516210a2aafd3253425db5dd334`, main. Evidence:
`scratch/runs/20261103-jedi-pinned-native-store-fixture/`. Only this note is
published. The candidate decoder and patch are retained locally; its sole
production edit was reversed after preserving it and verifying exact baseline
bytes. No production repair is claimed ready.

## Complete packaging checked before building

The unchanged predecessor `native-watch-adapter.cjs` was reused. Its missing
ignored PE is explicitly pinned and packaged here:

| Input | Size | SHA256 |
| --- | ---: | --- |
| `test/binaries/notepad.exe` | 53,248 | `e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340` |
| `source.tar.gz` | 265,143,161 | `b47f732894cde30ba4978ffe5c27bba4edcd23bb85193239d6b6bd5859290e02` |
| `inputs.tar.gz` | 1,828,170 | `474915b6b3705d3d6a4bedd1c49b96712f18d524f5c180763d6ba2e3eb1f507c` |

The source archive comes from `git archive` of the exact input, excluding
foreign WIP. `source-pins.json` seals all15,790 regular committed files.
`input-pins.json` seals all43 ignored inputs: the PE and complete local
`node_modules/pngjs` and `node_modules/wabt` trees, explicitly archived without
installing or resolving new dependencies. Boat-side preflight verified every
member's existence, size and fullSHA, then loaded native host/compiler imports,
pngjs/wabt and the fixture PE **before** either heavy build. No missing input
was silently substituted. Post-build source verification found exactly the
candidate decoder difference; all other source and ignored inputs still matched.

The original Jedi PE/three GOB hashes and accepted source-note hashes were
rechecked from existing retained local bytes (`reused-pins.json`). The
[accepted binding contract](jedi-script-binding-capture-contract-20261103.md)
and [previous packaging failure](jedi-authentic-binding-qualification-20261103.md)
are unchanged. No asset recovery, COG compilation, original-game launch or
source synthetic contract rerun was represented as native proof.

## Actual boundary failure and candidate

Both exact baseline and candidate ran
`flock /tmp/wine-build.lock bash tools/build.sh` successfully on the sole own
boat. Build gates were retained. The extracted closure has no Git HEAD for
API-history comparison; Big5 used its documented offline header/invariant
check. These limitations appear in the complete logs.

| Actual module | Size | SHA256 |
| --- | ---: | --- |
| Exact baseline | 2,089,591 | `0a58fd7b9ac82c5303048776f442b15e72528b55ddf85564e0df92fcb1aa384d` |
| Candidate | 2,089,721 | `19cd53920ab7454ffebaf724400fa2fd9a44c9a15b55f956cbeb89fe198438b9` |

The fixture loads the pinned notepad PE into actual WASM, allocates native
guest code/vitals/stack, then executes an invented x86 `CALL` into a handler:
shield100→80 store, immediately `INC EAX`, then a self-loop. Health stays100.
These are **fixture bytes, not authentic Jedi execution**, script bytecode,
Kyle, an original victim or an original damage event.

One native `run(16)` call with existing watchpoint returned:

- Shield80, health100, EAX**1**, EIP`4249751` (`0x40d896 + 1`).
- Required EAX**0**, EIP`4249750` (`0x40d896`), immediately after the store.
- Stack return`4249713`; handler remained pending. Exit2, failure retained.

`first-fixture.json` preserves observed values and actual code bytes. The
unchanged adapter's old `sourceCommit` string names its predecessor revision;
this run's actual source is sealed above. Its legacy static `latch` object is
host metadata, **not an attested native stop receipt**. It is not used to
establish qualification.

After claiming only `src/07-decoder.wat`, a candidate added opt-in
`set_instruction_watchpoint(addr)`: clear decoded cache, inhibit cross-instruction
folds/whole-block substitutions, and publish each x86 instruction as a separate
block while the existing watchpoint disables chaining/tier bypasses. No
`test/run.js`, control-path or Alice-owned file was edited.

With only the arming API changed, the same native16-block fixture passed:
EAX0, EIP`4249750` exactly, shield80/health100, unchanged pending stack return.
No expected EIP/EAX was relaxed. The candidate source SHA256 is
`cca90864f3d284abe83f3ef841d409a426edf88dc113c662523a3546ca87815f`;
`candidate.patch` SHA256 is
`6ef13c6863b71d12f391b432ca06e06cb508dea90296046aa86f0b4c831da80e`.

## Meaningful fixture coverage and limits

`test-native-stop.cjs` instantiates real WASM/PE fixtures. Its fixture-local
`native-stop-adapter.cjs` accepts16 credits, executes one instruction-sized
block per entry, compares both vitals, and freezes the earliest observed stop.
The retained suite records **29 passing cases**, followed by one unmet native
acceptance case (overall exit2). The passing cases cover:

- Shield-only and health loss with chain setting0/1; native absolute,
  register-indirect, SIB, register-value, x87, overlapping byte and STOSD writers.
- Real nested CALL frames/pending handlers, health loss before a forbidden
  shield store, and a healing store followed by loss.
- Real native UD2 error before a forbidden loss store; earliest latch retention
  when a later error is offered; no later native entry/instruction through the
  adapter, including repeated grants after stop.
- Actual pid/native thread/native guest-generation reads checked against
  deliberately mismatched process/thread/generation bindings. Each mismatch
  rejects before the first native entry; no foreign process/thread was run.
- Credit/input revocation, host-only held-key release, injected release
  transport failure and actual filesystem open failure. Both failure cases keep
  controls revoked and preserve the earliest native observation.
- Repeated read-only native snapshots remain identical after stop. Guest eval
  is refused. Release/persistence callbacks do not call WASM run.

These key acknowledgements concern the adapter's own host fixture key state;
they do **not** prove production CLI/browser key release or persistence. The
adapter is not installed in those controllers, does not own original gameplay
inputs, and does not protect an independent caller directly invoking WASM
exports. The thread-negative test checks binding rejection, not concurrent
scheduler isolation. The writer tests establish these actual native shapes,
not exhaustive store/API coverage. No claim about a real script invocation,
message10, engine error, listener order or allocation provenance follows.

The candidate also passed the committed `test/test-dispatch-macro.js` (6 checks)
and actual native `test/test-fused-entry-overlap.js` on the boat. These focused
checks do not turn the unmet store acceptance into a pass.

## Reproducible unresolved prerequisite

`retrieved/rep-first-store.json` and the last case in the native suite execute:

```text
CALL handler
handler: REP MOVSD       ; ECX=2, source floats [80,90]
         INC EAX         ; forbidden
```

Destination is adjacent shield/health, initially[100,100]. The first iteration
commits shield80; the required stop must prevent the next iteration's health
store. Actual candidate result: shield80, **health90**, ECX0, EAX0,
EIP`4249742`, after the entire REP instruction. The forbidden INC does not run,
but the second store already committed. A post-instruction snapshot cannot
recover the first committed-store state or timestamp.

Thus instruction-level sampling is insufficient for the required arbitrary
writer/first-loss stop. Next work needs an actual per-store/REP-iteration stop
integration, including bulk/native writer paths and production host control
release/persistence, with the failing case's health100 expectation preserved.
The candidate remains evidence rather than a published production repair.
No unchanged repeat or budget increase was used: baseline1×16blocks/30s,
at most2 repair builds and60 custom native cases, each suite capped300s were
declared before execution; actual use was baseline plus1 candidate build,
two16-block boundary runs and30 suite cases. No original campaign was allowed.

Original victim+29c/load branch/compiled handler remain a later task after
native stop qualifies. No manufactured handler/Kyle insertion, original guest
edits, campaign steering, screenshot advance, original interpreter invocation,
encounter attribution or explanation of the retained8699ms gap was obtained.

## Recovery and lifecycle

Own fresh boat `bx_bwg4xxtq`, TTL3600, original expiry
`2026-11-03T17:37:28.157Z`; original task explicitly delegated normal STOP.
ID/expiry/delegation were recorded before use. All heavy builds/native tests
ran there. No subworkers, predecessor/foreign boat/process operations, browser,
HeroesII/font lane, CACA003B or deployment occurred.

Recovered `evidence.tar.gz`, 2,543,822 bytes, SHA256
`72daa9ccbbee513e0e01f170660e49e11a09a73401fe0dd86f33796d9cf33dc3`.
All56 archived payload sizes/fullSHA, complete source/input archive membership
and local recovery hashes were verified **before** delegated normal STOP.
Modules, every build/failure/test log, native readbacks, code bytes, controller,
adapters, candidate source/patch and pins remain local. Baseline modules were
copied from byte-identical retained local predecessor modules; their hashes
match this run's native baseline observation. No predecessor boat was queried.

Normal operation `stop_8d5312b74040c611` completed with `error:null`,
`forced:false`; boat **STOPPED** at`2026-11-03T16:48:26.381Z`, snapshot completed
and verified at`2026-11-03T16:48:26.347Z`. All four own supervisor PIDs and native
helpers were absent before stop. Custody returns to coordinator.

See `RECOVERY.md`, `recovery-verification.json`, `helpers-before-stop.json`,
`boat-final-info.json`, `result.json`, `final.txt` and `SHA256SUMS` in the run.
Publication is recorded there and on the append-only board. AUTHOR RELEASE,
then terminal STOP; no successor.
