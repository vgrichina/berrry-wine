# Heretic II: tested passive park/completion observer; original held by disk

2026-11-12. Evidence and run-local implementation:
`scratch/runs/20261112-heretic2-park-completion-2140/`.
**The missing observer is implemented and tested. Original ExitProcess(8)
cause remains UNKNOWN.** This implements the distinct observation proposed by
[the API audit](heretic2-exit-api-2130-20261112.md) (`a4420f289`), without a
production runtime change.

## Implemented boundary

`observer.cjs` emits `observer-emitted.js`, tested verbatim in a VM context.
Its instantiate wrapper instruments each host import object once, forwards
the original instantiate result, and binds observations to that instance's
exports. Each event identifies the observer, sequence, thread, EIP, ESP,
EAX, exported `get_api_calls`, `get_yield_reason` and `get_yield_flag`.
Entry records retain the public return address and five API stack arguments;
post-handler records retain the entry and exit runtime API counters and
observer call/attempt/retry identities. Correlation requires the same thread,
stack frame, return address, API name and arguments. Separate threads,
frames and return addresses cannot be merged solely because arguments match.

The existing `fs_read_file_result` import is wrapped once. Its exact original
return value or thrown object is retained; the wrapper preserves receiver,
arguments and call count. The observer reads no file payload. It calls no
GetLastError, GL query, additional guest API, clock, timer, setter or guest
writer. It changes no timing policy. Getter/sink failures remain inside the
observer; retained-row eviction and observer errors have explicit counters.

At `log_api_exit`, events are named **`post-handler`**. For ordinary ReadFile,
status 997 plus actual yield12/flag1 and the unchanged frame/EIP identifies
`internal-read-park`. A non-997 status, reason0/flag0 and the completed
24-byte stdcall frame identifies `completed-handler-frame`. Missing or
inconsistent state stays UNKNOWN. Both records still label guest return
UNKNOWN: the hook precedes runtime thunk return-address handling.

An optional read-only `boundary()` must be invoked after an existing runtime
invocation returns. It can separately observe the same thread/API counter,
completed ESP and EIP at the saved caller continuation. It neither invokes
the runtime nor resumes the guest. This extra boundary was exercised in the
synthetic fixture; integration into a future original driver remains required
if that additional observation is wanted. Import-hook state is captured
synchronously regardless of whether this optional boundary is used.

## Implementation tests

`node scratch/runs/20261112-heretic2-park-completion-2140/test.cjs` passes.
The fixture compiles the exact Git source closure at
`8a834a3dc7affc8c6e53245beab56e87a32b81e8` in memory, adding only synthetic
fixture exports. It runs the actual dispatcher and exported `run` thunk path
against the real filesystem import and lazy VFS with four synthetic bytes.
No source tree copy or guest executable/media is used. `fixture-identity.json`
records source and module hashes; this altered **synthetic fixture module is
not original module04**. `test-events.json` retains emitted outcomes:

| Synthetic case | Expected and observed result |
| --- | --- |
| Lazy read | Status997, yield12/flag1, unchanged frame: internal park; no guest-return assertion. |
| Fill and retry | Same call, new attempt, runtime API counter 1→2, status0/EAX1, exactly four bytes and two import calls. Post-handler completes the frame; a later actual runtime boundary observes the caller continuation. |
| Clear reason only | Next bounded invocation consumes the retained yield flag without another handler entry. Boundary remains UNKNOWN. |
| Cancellation on retry | Injected import status995 after a real park; same call, EAX0, completed frame and caller boundary. This tests the cancellation-status contract, not a real provider cancellation or any original cancellation. |
| Throw on retry | Original import throws the identical object on its second call. No completion hook is invented. |
| Failing sink | Same final runtime registers, yield state, output and import count as the successful observer run. |

Additional tests execute the same emitted script with synthetic exports:
once-only installation; exact receiver/arguments/return-object/throw-object
preservation for every wrapped import; getter and sink failure isolation;
absent yield exports UNKNOWN; thread/frame/return-address separation; exact
retry correlation; yield12 without flag UNKNOWN; pending calls at host exit
remain uncompleted/UNKNOWN. Host exit does not manufacture completed return.
These are implementation regressions, not original gameplay evidence.

The first fixture attempt exposed a test assumption that clearing yield reason
also consumed its flag. The corrected test explicitly checks the intervening
runtime boundary. No runtime defect or production repair follows from that
fixture correction. The locked build
`flock /tmp/wine-build.lock bash tools/build.sh` also passed.

## Original run hold and recovery

Actual `/home` available space was 1,477,222,400 bytes at entry and remained
below the strict 1,500,000,000-byte floor during local tests. Closing measurements
are in `capacity.jsonl` and `result.json`. No fresh original load, remote API,
allocation, upload, native input, watchdog or box was started. New box ID,
state, expiry and stop receipt are not applicable; there is no task box to
shut down. Inherited `bx_42896ath` was untouched (parent's last recorded state:
archived, expiry null, stop `stop_620e557b0869ed60`).

Original controls remain the frozen baseline above, renderer
`4235d20d7fc2404b38f6e4f7f80c92d5f94f1513b4d6d7dcf04be34162a4b087`
and original CPU/owning module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Existing [SoftwareGL HUD31 evidence](heretic2-runtime-boundary-20261112.md)
is reused by reference/SHA; no new pair is claimed. The final original owning
640×480 pixels were already achieved by
[2055](heretic2-exit-witness-2055-20261112.md), not repeated here.

Recover source from recorded Git objects plus `owned-helpers.patch` and
`relevant-source.patch`; the evidence manifest hashes retained helpers,
emitted script, unique fixture module and logs. There is no source/media
archive, media copy, guest RE/disassembly/private-structure examination,
extraction, guest patch, substitute DLL, speculative production patch,
cache/reserve change or child worker.

Next: after actual disk permits, freeze this tested helper with the unchanged
original controls and existing containment/identity/release/lifecycle controls,
then observe one fresh ordinary `load crate0400`. The prior 54 historical
zero-EAX post-handler classifications remain **UNKNOWN**; synthetic qualification
cannot supply their missing actual state. No ReadFile defect or concrete exit
cause is proved. Full27/parity/FPS/audio/general crash claims remain open.
