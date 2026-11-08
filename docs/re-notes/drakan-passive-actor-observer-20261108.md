# Drakan passive actor/state1 completion observer, 2026-11-08

Implemented and locally qualified a bounded observer in production source. It observes an actual buffered-drain call and return, this owner's event4 dispatch, actor call, state1 call and completed return, and the enclosing actor/event/simulation returns. This removes the earlier local implementation blocker. **No original was run; sustained flight is still open.**

The accepted [separate-drain ascent](drakan-buffered-ascent-20261108.md) at `cc6a14236` remains valid. The [same-drain cancellation](drakan-sustained-flight-20261108.md) remains an observation plus an integration inference for that historical original. This task does not retrospectively trace either original or repeat T. The [actor boundary preparation](drakan-actor-update-flight-20261108.md) supplies the installed-code candidates; those addresses alone never count as execution.

Evidence: `scratch/runs/20261108-drakan-passive-actor-observer-2041/`. Source base is Git `0b12ac15352dd9289814289215fffaa00c139ebc`, plus the small owned binary patch retained in that run. The source commit containing this note is the final recovery authority.

## Cause reproduced and exact new module

`reproduce-old.cjs`, under `wine-runtime.lock`, reads the existing retained module at `scratch/runs/20261108-drakan-sustained-flight/published.wasm`. Its SHA256 remains `6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`, size 2,182,663. Empty EIP tracing still changes the exported tier guard **0 → 1 → 0**. The cause is `dbg_recompute`: tracing sets the desk and tier guards. No guest is loaded or executed in this reproduction. The retained module has no new observer exports; **new source does not fix those retained bytes**.

The final locked build compiles the current `src/main.watx` closure into:

| Existing output path | Bytes | SHA256 |
| --- | ---: | --- |
| `build/wine-assembly.wasm` | 2,184,500 | `4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3` |
| `build/wine-assembly.compat.wasm` | 2,187,146 | `c3a4a1d9cd6cd6a630f6145c472d3a7d1ab6c2818dba618f2a1b82d8292d7f5a` |

No module, media or source-tree copy/archive was made. Recover by Git plus the owned patch and the ordinary locked build; hashes refer to the existing outputs. The only modified WAT closure files are the two owned files below.

## What the implementation observes

`src/05-alu.wat` adds an instance-local finite-state observer to the existing `pending_push/pending_pop` seams. These already cover ordinary relative/register/memory calls, fused push/call and pop/return operations, and compiler-produced micro-op calls/returns. It uses bounded globals, pure direct-window reads and shared native ownership reads. It adds no host import, guest store, breakpoint, clock/input poll, cache flush, forced progression or execution-tier switch.

`src/07e-uop-compiler.wat` emits the existing call/return service operations 79/80 unconditionally. Consequently programs compiled **before** arming contain the seams. No observer-dependent compilation decision, debug flag or cache replacement is needed. This adds instruction/service overhead; whole-game timing and code-size/admission effects outside the tested fixtures are unmeasured.

The observer arms once per instance with fresh RFL base, object, actor, expected down timestamp and a transfer bound of at most 100,000. It binds image base, thread, local process/root lifetime and their actual shared-memory ownership. Root `0x47b490+0x270`, object `+0xa0`, actor `+0x58` and relocated actor vtable must retain the exact owner link. Sparse/DIB/out-of-window observer reads become UNKNOWN rather than entering translator faults/readback/services.

The accepted route is:

1. CALL `0x405770` returning to `0x407a9a`, followed by RET from the identical entry ESP.
2. The owner's retained down timestamp and actor state1/ascent bit are active at that drain return.
3. Simulation CALL `0x40a090` returning to `0x407abf`, with root receiver.
4. Event4 handler `rfl+0x4b320` from either `0x40a127` or `0x40a172`, with this exact object and event4 stack arguments. Another actor sharing that handler is ignored.
5. Actor CALL `rfl+0x4c310` returning to `rfl+0x4b370`, with this actor in ECX.
6. State1 CALL `rfl+0x4da10` returning to `rfl+0x4c4ae`, with this actor in ECX and its down timestamp/state/ascent bit active.
7. Matching state1 RET with identical call-entry ESP and active timestamp/state/ascent bit, then matching actor, event and simulation RETs.

A frame/counter, event entry, outer actor early return or state1 entry alone cannot complete this observer. A return to the right address from the wrong stack slot fails. Unsupported/nonlocal/raw diagnostic paths, ownership loss, exhausted bounds and rearm are sticky UNKNOWN. Pending observations expire through the adapter's existing owner/action deadline sample.

`lib/drakan-passive-actor-observer.js` is the Node adapter. It verifies supplied actual module bytes against an expected SHA and the exact owner tuple, copies expected relocated code pins, and checks live drain/frame/dispatch/actor/state1 bytes. The pins must come from independently verified installed PE/RFL bytes, never from blindly trusting the live guest. Its fresh identity/action sample is supplied by the existing controller; it does not collect another clock/input sample.

Its transparent keyboard-buffer wrapper captures the real existing import calls. A T-down record must have the exact timestamp and sequence and be consumed by that device **inside the selected native drain**, with its entry ESP attached. Peek-only evidence, no consume, stale/outside-drain evidence, overflow, repeated down or same-drain release cannot qualify. Snapshot completion additionally requires that same drain ESP. Host down-active/deadline evidence is independently required before notification.

Both the run wrapper and import wrapper call their original function exactly once using its receiver and every argument, preserve the returned value, and rethrow the identical original exception. Observer problems produce sticky UNKNOWN while ordinary execution continues. Completion notification is emitted at most once across wrappers.

## Causal qualification and retained failures

`test/test-drakan-passive-actor-observer.js` runs synthetic x86 in the **complete production module**, calling its real initialized GetDeviceData COM thunk and handler. Fixture-only construction provides an acquired keyboard object, a bounded host FIFO and synthetic guest callback/control bodies at the candidate addresses. These are not original Drakan actor bodies or native browser input.

Each final module passes 54 focused checks. The ordinary/chaining/fusion combinations compare armed and unarmed architectural registers, lazy flags, EIP, ESP, run budgets/halt state and exact host import calls at every run boundary. The compiled test compiles before arming, proves real micro-op CALL/RET execution with handler histograms, and compares native entries/cache generation and architectural output against the disabled observer. A shared-handler foreign actor precedes the selected owner in another positive fixture. The optional retained-module comparison adds two checks: ordinary and compiled disabled execution match the unchanged 6cf module. It does not claim original-game parity.

Negatives include same-drain cancellation, absent drain/simulation, actor early return, wrong event/actor, release during state1, timestamp change, forged return ESP, absent consumption/overflow/import exception, each owner-tuple mismatch, wrong module, stale/future/deadline samples, upstream UNKNOWN, changed code, exhausted bound, thread/link/rearm/raw-uop/reload and foreign shared process/root lifetime. Return/receiver/argument/exception preservation and notification deduplication pass.

Additional final checks:

- `flock /tmp/wine-build.lock bash tools/build.sh`: PASS, including both module outputs and all build gates.
- `test/test-uop-compiler.js`: PASS; 673 compiled cases, zero mismatches reported, compiler flushes0.
- `test/test-block-chain.js`: 62 PASS.
- Existing pending-context **native subset**: 58 PASS across canonical and compat modules. The complete existing file fails at its missing ignored `20261104-mdk2-fresh-pending-scene/runtime-pins.json.gz`; no full-file PASS is claimed. The run helper executes its unchanged native prefix in memory, recording the source hash and exact cutoff, without copying source.

Initial fixture failures are retained: an uninitialized guessed API thunk entered zeros; changing to the real initialized COM thunk fixed the fixture. A notification assertion initially expected delivery to a second wrapper after the first had already delivered; it was corrected to require global exact-once behavior. Early fragment parenthesis/whitespace corrections were implementation work before the passing locked builds. Neither failure allocated a runtime or repeated gameplay input.

Run output is gzip from its first byte, with original SHA256/size, compressed hashes and an independent decompression/CRC/SHA reread. Local command watchdogs were prearmed before commands; each completed watchdog has its own compressed heartbeat and terminal wait metadata. The board watcher is stopped and drained before final handoff. Evidence uses Git identity and small owned patches; peer WIP and the native-custody owner's paths are untouched.

## Handoff and limits

This is qualified local causal code, not a browser/original flight result. The Node adapter still needs integration with the future owning Worker's existing import and ordinary execution driver, binding exports to the same verified module bytes and obtaining current code pins, device and object identity. Its supplied clock/action samples must be independently refreshed by that controller and coupled to an independent release deadline; a stale cached sample is not a new time observation. Direct-window coverage and the tested compiler transfer paths are explicit limits. Active-bit samples establish the selected completed invocation under the consumed-down/deadline contract; they do not measure every intermediate physics operation.

A later separately authorized original must actually serve the rebuilt module, establish fresh owner/base/relocated-byte identity, prearm this observer, and retain the existing independent **T <= 2000ms** release. Require an exact down-active completion before release and review takeoff before any separate Up/heading action. A timeout/UNKNOWN ends that attempt without replay or lengthening. No ineffective T-only action was performed here.

Full27, original parity, audio, FPS, worldZ and sustained controlled flight remain open. Backend/configuration/binding/clock/seed changes and public deployment were not performed.

Box ID/state/expiry/stop receipt: **none / NOT_CREATED / null / not applicable**. No newbox, local Chrome, original, gameplay input, subworker, old-box operation or billable runtime was used. Local native fixtures and watchers drain normally. Final disk samples remain above 1,500,000,000 bytes; no continuous-floor measurement or RAM gate is claimed.
