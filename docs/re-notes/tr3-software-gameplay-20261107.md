# Tomb Raider III software Jungle movement and weapon draw — 2026-11-07

**Personally reviewed settled Jungle translation and a separate weapon draw in
original TR3 on the supported production software renderer.** This advances
`GLD3D-CORPUS-27-20261006` beyond the WebGL-only `d5c39cdf2` result. No emulator
defect was demonstrated; this publication changes findings only.

Evidence: `scratch/runs/20261107-tr3-software-gameplay/`. One fresh boat, one
original executable launch, ordinary native browser input, no local runtime,
source or build lane, no nested worker, deployment or source/media archive.
Original media, config and saves were not directly edited or substituted.

## Personally reviewed route and result

The demo welcome OK and setup OK were selected from fresh captures. Setup showed
Direct3D HAL, Hardware Acceleration, 640×480 High Colour (16 Bit), and ZBuffer;
the host GPU selector showed Software. The guest's Hardware Acceleration option
selects its Direct3D API, while the supported host query selects software replay.
The red Game passport was opened with balanced Enter300; a fresh capture visibly
said New Game before a second Enter300 selected it. Jungle's Controls overlay
documented Up Run and Space Arm.

The first Up2000 moved Lara to the spike-lined lower clearing. The next idle
capture returned to the title. The cause of that return was not instrumented;
this segment is **not** accepted as settled movement and does not establish a
software defect. From the personally reviewed title, ordinary Game → New Game
was selected again inside the same running original process. No EXE relaunch,
unknown-command replay, memory reset or save/config edit occurred.

The successful bounded sequence is retained separately:

- `review/jungle-before-arm.png`: empty hands and holstered pistols at the
  starting ledge, viewed side-on with the Controls overlay.
- Balanced Space300, then 4000 ms without input:
  `review/jungle-armed.png` shows both pistols raised and the overlay removed.
  Another 4000 ms without input produces `jungle-armed-persistent.png`, retaining
  the stationary weapon-ready pose. This is weapon draw, without firing.
- From that freshly reviewed armed scene, balanced Up100, then 3000 ms without
  input: `review/jungle-short-forward.png` shows Lara farther down the starting
  slope with the camera behind her looking downhill. The right wall, foreground
  rock and downhill corridor differ from the starting side view.
- Another 6000 ms without input produces `review/jungle-forward-persistent.png`:
  the changed terrain/camera position persists with Lara stationary and pistols
  raised. This establishes translation beyond an isolated running animation.

Eighteen numbered commands have complete ACKs. Two expired requests (welcome OK
and the first proposed Up) were refused before dispatch with zero effects.
Fresh captures and new IDs continued on the same queue; consumed IDs were never
replayed. No partial or UNKNOWN action occurred. Each ordinary input followed
personal inspection and passed the current-app and 12-second scene guards.

## Actual software owner and execution identities

The ordinary URL is `?d3d-renderer=software`. A direct live page probe confirms
`WINE_D3DIM_GPU=false`, `WineD3D.renderer=software`, and selector `software`.
The actual process render factory owner is Worker target
`169A9316F2274904A1B1C547FE3C9220`, session
`FFDEEC2F9B9FDF790CB4829F7C833696`, endpoint 1, `legacy/software`.
Production replay calls `ex.d3dim_worker_draw` and only then increments
`evidence.d3dimSoftwareDrawCallsCompleted`.

| Reviewed checkpoint | Direct owner software completions | Completed sequence | Guest-reported software completions |
|---|---:|---:|---:|
| Before Space | 307,416 | 18,054 | 307,158 |
| After Space | 386,010 | 20,568 | 385,969 |
| Persistent weapons / before short Up | 401,103 | 22,808 | 401,057 |
| After short Up | 419,721 | 25,489 | 419,702 |
| Persistent translated position | 444,610 | 28,822 | 444,558 |

Samples are sequential, not atomic pairs. At every reviewed gameplay checkpoint,
the owner has no GPU adapter, failed=null, ready=1 and error=0. Guest endpoint
statistics report GL triangles=0, GL renderer/version=null, fallbacks=0 and
GPU-fallback software completions=0. The actual software owner, absence of an
adapter and advancing native completions establish software execution with no
WebGL draws on this route. No separate GL-call instrumentation was installed.

Source staging commit is `0e37d2fd73ee8a03c843e803d461e6a81f723ff5`, with relevant
uncommitted and new-source binary patches retained. All 581 provisioned runtime
file pins match remotely before and after execution. Actual guest and render
Worker bytecode SHA-256 is
`762e723515df6ce8c197fd0d23e0b84869657b0b49e673ad4ac2c48f78b8991f`
(2,181,062 bytes), matching the provisioned existing standard module. Source
identity and reused module identity are recorded separately; no rebuild or
source-to-module equivalence claim is made.

A direct CDP debugger probe records actual parsed script sources, identities and
hashes: all 111 external executing scripts match pinned bytes; four inline
scripts have separate hashes. All 169 successful original HTTP responses match
pinned bytes; five non-200 responses are retained. Chrome is 151.0.7922.108,
isolated guest Workers, 1024×768 viewport and 640×480 game buffer.

## Preflight, provenance and closeout

Before the original, nine transport, seven actual-executor/recovery, balanced
production-renderer keyboard and invalid-duration controls passed. Holds 0, 49,
2001, 3500, -1, NaN and 100.5 fail before locks, command publication, admission,
state reads or key effects. Allowed holds are 50–2000 ms.

A generated PE with separate ILT/IAT and ordinary property-sheet flags loads the
exact retained native COMCTL32 through its dependency URL. The served DLL hash
is `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`;
DllMain returns EAX=1. Its explanatory tabbed sheet, OK, Cancel and disabled Apply
were personally reviewed before normal close and clean process/port/profile/lock
checks. TR3 itself resolves its eight imports through built-ins and does not use
native COMCTL32 on this route.

All ten TR3 media pins exactly match the retained current-browser fixture record.
The 920064-byte executable SHA-256 is
`8c7b25460f62c180ae675c2696ac66c8f97948a16458d0598ba72794ddcc7814`.
`provenance.json`, complete upstream attribution and historical native evidence
remain absent. Exact retained local identity does not recover upstream provenance.
No download, repeated media in evidence, replacement fixture or guest-byte edit
occurred.

All 193 terminal inventory files were retrieved or matched locally with exact
size/SHA-256. Original Chrome exited zero at 01:52:25.447 UTC. The immediate
inventory still saw the controller; the later independent check at 01:53:00.781
found both generated/original controllers and Chrome absent, all four ports
refusing, both profiles absent and no profile processes or writer locks.
An initial cleanup assertion accidentally matched its own Python command text;
the retained diagnostic fixes the read-only search to compare individual argv
entries. This was a run-helper assertion, not an emulator defect or risk flag.
The generic cleanup `pending:UNKNOWN` text is a template, not an action outcome;
the eighteen complete ACKs establish the actual command outcomes.

The UUID Idempotency-Key was persisted and fsynced before creation of
`bx_9h56d6hu` at 01:46:50. Initial expiry was 02:46:50.021 UTC.
Explicitly delegated normal stop `stop_fd8c5b9c1c3a3483` completed at
01:53:05.408 UTC, forced=false, error=null. State is archived, active expiry null.
Allocation through completed stop took about 375 seconds, within 35 minutes.
Disk remained above 2 GB. No automated risk flag, held-risk retry, HTTP403,
resume or original relaunch occurred.

Artifacts and publication records precede `result.json`, written last. No code
repair or build was needed. Combat, audio, FPS, parity and full27 remain untested.
The bounded software movement/action task requires no further execution.
