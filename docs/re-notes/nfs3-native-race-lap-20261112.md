# NFS3 native lap attempt: timer abort before race

The single Software-route attempt stops at the original game's native startup
abort: **“getcpuspeed - INITTIMER MUST BE INITIALIZED TO MEASURE CPU PERFORMANCE.”**
No race, road/corner progress, lap transition or result was reached. There were
zero driving inputs and no original-game retry. The accepted
[current paired driving](nfs3-current-paired-driving-20261112.md) remains intact;
this failure does not replace its successful current04 evidence.

Evidence: `scratch/runs/20261112-nfs3-native-race-lap-1705/`.
Source anchor: main `8c4ab88de4c50c4b0668bc59f41d48569ceb1e66`, with relevant
binary diff and untracked dependency patches. The original EXE remains
1,577,984 bytes, SHA-256
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`.
The executing main guest module is 2,189,863 bytes, SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

## Observed boundary

The coordinator launch record confirmed actual dispatch before allocation.
The registered catalogue installer and first native setup invocation exited.
After reload, the native chooser offered Software Renderer and Direct3D
Device 1. Selecting Direct3D Device 1, acknowledging the original unsupported
card warning and clicking setup OK wrote the selection natively and exited.
After another reload, `nfs3_chosen_renderer` launched the original EXE.
Every dependent setup action followed a separately reviewed complete frame.

The first completed original-game frame, `recovered/software/race-start.png`,
shows the native Abort message instead of a race. Its paired state/log records
133 mounted data files, `mmTimerThread=true`, `asyncMultimediaTimer=false`,
main guest endpoint 1/slot 0, and no emulator trap. Main guest target
`1530522462BA5C16A4219A6FDD692046` has captured executing bytecode matching the
module hash above. No owning D3D render endpoint was created; no render
module/generation, completed Software draw, gameplay or backend acceptance is
claimed for this attempt. The requested page route was Software.

The log records secondary thread creation and later exited/active states, but
contains no timer-initializer entry/API-return/counter/clearing-branch trace.
The abort's cause therefore remains UNKNOWN. This is recurrence of the
[historical native timer symptom](nfs3-native-timer-cause-0724-20261109.md), not
proof of an emulator defect, a timer-policy failure or debugger causation.
The earlier isolated timer fixture is not replayed or promoted into this
original-game failure. No production fix, regression/build or repaired-original
retest is justified by this evidence alone.

The shipped README says the demo randomly chooses Single Race or Hot Pursuit,
AI aggression and weather. No race-mode menu appeared before the abort. No RNG,
clock, readiness, physics, guest-state or configuration override was supplied;
setup alone wrote its native selection. The inherited early Worker/module
observer was retained. BetterChromium still appends fingerprint/timezone flags;
there is no uninstrumented-timing claim.

## Gates, verification and disposal

Before allocation, the final caller's actual data/import branch passed against
the current registered manifest and current WASM. Missing mandatory static-server
and app-registry imports were rejected. The observed independent watchdog was
armed before the single fresh private box, with immutable deadline
**2026-11-12 19:01:58.430 UTC**. Initial provider expiry was 19:01:57.907 UTC.
Actual `/home` samples stayed above 1.5 billion bytes; no RAM gate was used.

Provisioning was actually joined exit 0 with stdout/stderr EOF. A short remote
manifest verifier checked all 604 inputs and executed the same data/import
branch before the box/manifest/deadline/parent-wait-bound pass permitted Chrome.
All 602 pinned runtime/media/helper files passed unchanged final reread.
Source recovery uses Git plus patches, with no source or media archive.

The checker verifies 90 retrieved run paths, 11 complete PNGs with chunk CRC and
full IDAT inflation, 11 exact native-command ACKs, setup review/hash/freshness
chains, captured guest module bytes, and 52 provider logs. Each recovered path
was independently retrieved twice before stop. Large logs and the one executing
module were compressed losslessly; recovery maps preserve raw hashes.
There were no timed-out/UNKNOWN commands or replayed inputs.

After reviewing the abort, the browser was closed without dismissing/restarting
the original. Chrome and controller exited 0; the runtime owner actually waited
for its controller and both stdout/stderr EOFs. An independent remote check
found owner/controller/Chrome PIDs absent, the profile removed and server port
closed. This is browser/runtime disposal, not native game ExitProcess evidence.

After hash-verified recovery, normal delegated stop completed at
**17:06:52.726 UTC**, forced=false, error=null. Final box **bx_2ys3tt6n** is
independently **ARCHIVED**, expiry **null**, receipt
**stop_77ff66aefe80656b**. The local manager and independent watchdog both have
actual successful parent waits and stdout/stderr EOFs. No owned box remains
billing. No workers, deployment, resume or deletion occurred.

Next work is a separately authorized, bounded trace of the actual original's
timer initializer, native API returns, callback/counter progress and clearing
branch, with a matched observer control. Purposeful corner/lap work remains
blocked until an original reaches a race. No lap, parity, FPS, audio, full27 or
broad crash-freedom claim follows from this attempt.
