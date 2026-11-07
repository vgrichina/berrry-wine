# Motocross Madness: disk exhaustion recovery, 2026-11-07

The existing original run was recovered without launching another original or
creating another box. Steering remains unproved. Recovery sent no gameplay
input: only a current capture and ordinary lifecycle quit after transport checks.

Evidence lives in `scratch/runs/20261107-mcm-refresh-driving/` and
`scratch/runs/20261107-mcm-orphan-recovery/`. Dead worker PID 1683130 was absent;
its run/doc ownership was explicitly reclaimed on the append-only board.

## Dispatch boundary

The dead worker's events record command 26, `forward-baseline`, successfully
captured at 07:54:00.947Z. Its next `forward-pulse-a` attempt failed with ENOSPC
at `request.py` line 11 while writing the local review. That write precedes
request-file creation and the remote dispatch call. `scene-step.py` uses
`check=True`, so it cannot continue to retrieval after that failure.

Read-only remote observation at 07:57:57.538Z found precisely commands 0–26
and matching replies, latest capture `forward-baseline`, no path containing
`forward-pulse-a`, no writer lock, and no first-failure or transport-closed
marker. Thus this particular pulse was **never dispatched**, rather than
UNKNOWN. It was never replayed. All dependent gameplay actions stayed closed.
The local `forward-baseline-review.json` was truncated by ENOSPC; it is retained
as failure evidence and must not be used as a review.

Recovery used new IDs: command 27 `recovery-observe` (capture) and command 28
`recovery-quit`; both have matching successful ACKs. The original transport's
UNKNOWN and partial-input sticky closure was preserved. The recovered generated
browser proof records stale refusal with effects 0, capture-only refresh, a newly
reviewed accepted action, and UNKNOWN/partial closure. Those are prior generated
results, not a new runtime attempt during recovery.

## Actual identity and visual limits

The sole original launcher command began at 07:48:09.774Z; the browser helper
records runtime start 07:48:09.869Z and app navigation 07:48:11.453Z. It used
`index.html?debug&threads&d3d-renderer=webgl&app=mcm`, guest Worker mode, and an
owning legacy WebGL renderer. Recorded actual provider is
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`.
Do not relabel this run as hardware GPU evidence.

The captured guest module is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Recorded source commit is `958d2d11f0d91e3df22efc0befc929deb0921a0c`.
The existing `runtime-pins.json`, `all-tracked-dirty.patch`,
`new-lib_wininit-boot.js.patch`, fixture identity, and run helpers are preserved.
The terminal pin verification rehashed all 939 runtime files. The recorded HTTP
closure has 316 pins. Game media remain referenced by existing paths and hashes;
no source or media archive was made, and no emulator code was changed.

Personally inspected `throttle-fresh`, `left-immediate`, `right-clear-three`,
`forward-baseline`, and `recovery-observe` PNGs. They show the rear rider,
quarry terrain, HUD, and separately identifiable opponents. The reviewed pairs
do not establish a readable player/camera turn caused by steering. Throttle and
simultaneous Up+Left/Right ACKs establish completed harness commands, not guest
steering. Opponent movement is not player steering. No FPS, audio, parity, or
complete-gameplay claim follows from these captures.

## Retrieval and lifecycle

Initial state was `idle`, no recorded stop, with expiry 08:45:28.091Z. The
immutable browser deadline was 08:14:18.772Z. No stopped box was resumed.
`retrieval-verification.json` covers 356 pre-quit artifacts with full size/SHA-256
verification; 144 unique missing contents were downloaded. The terminal inventory
covers 364 artifacts, all verified in `terminal-retrieval-verification.json`,
with seven additional unique downloads. Identical existing contents are referenced
or deduplicated by hash, retaining a path-to-content mapping. Unique captures,
console/HTTP logs, module, pins, close receipts, worker events and stderr survive.

The existing ordinary key helper releases every attempted key in reverse order
in `finally`, including partial-dispatch failure. Its native combo preflight
records balanced trusted events and partial-failure release. Before quit,
read-only `key-observation.json` showed all recorded renderer physical and async
keys false (including Up/Left/Right), with mouse mask 0. This checks observable
host input state; it is not an independent guest steering measurement.

Quit used the existing close path; Chrome exit code 0 is recorded remotely.
The first terminal check ran while parent PID 9196 was still exiting and failed
its strict absence assertion. That failure remains recorded. The subsequent
read-only `postquit-diagnostic.json` confirmed all six Node/Chrome PIDs absent,
six ports refusing connections, all three profiles/writer locks absent, and
all commands matched by exact-ID replies (original 29, generated 4). The generic
cleanup field `pending: UNKNOWN; never replay` is a template warning, not evidence
of an unmatched command; the queue records establish the actual boundary.
The dead worker's orphan board watcher PID 1684403 was identity-checked and
terminated.

After retrieval and terminal checks, delegated normal nonforced stop completed:
box `bx_tevwnwhg`, state `archived`, stopped at 07:59:40.963Z, stop status
`completed`, `forced: false`, expiry cleared (`archiveAfter: null`). No box
delete or archive-delete was requested. Ownership returns to the coordinator
with no running assigned runtime.

The old launcher `scratch/usage-watch/mcm-refresh-driving-0744/result.json`
is zero bytes and remains untouched. Its OS exit code is unknown: worker events
show ENOSPC and panic, but do not supply a trustworthy launcher exit status.

## Recovery recipe and checks

For forensic reproduction, use the recorded Git commit plus the retained binary
diff and untracked-file patch, then verify `runtime-pins.json` and existing
fixture/media SHA-256s. The retained helpers describe the exact launch, 12-second
freshness guard, and 50–2000 ms bounded ordinary controls. This is a recipe for
source reconstruction, not authorization to launch or resume another original.

For this recovery, `access.py` reuses recorded authenticated access without
printing credentials. `observe.py` records queue/replies and inventory before
any action; `capture.py` uses the existing numbered transport for capture only;
`retrieve.py` verifies local content before fetching missing unique bytes;
`keys.py` observes input state; `quit.py` invokes the existing lifecycle quit;
the original terminal helpers plus `postquit.py` check shutdown; terminal retrieval
precedes one normal stop. Never replay an UNKNOWN action or repair a truncated
review and submit its old command ID.

Validation: artifact size/SHA-256 verification, runtime pin rehash, actual image
inspection, exact-ID queue audit, key-state observation, terminal lifecycle checks,
and doc diffcheck. This is a documentation/evidence recovery; no code build or
new browser regression was run. A future separately authorized investigation
must establish a readable player trajectory before closing the steering issue.
