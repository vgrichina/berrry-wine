# Quake III: closed-log recovery and reviewed Major route, 2026-11-12 2135

Fresh original combat is blocked by actual local disk capacity after exhausting
the identified eligible closed Quake III worker raw logs. No new original was
started, no API operation or native input was submitted, and Major frag remains
**unearned**. This follows the [atomic command repair](quake3-command-ingestion-2130-20261112.md)
(`a68ab669f`) and [2055 encounter](quake3-major-frag-2055-20261112.md)
(`910a2607e`). Historical Quit 21's exact cause remains **UNKNOWN**, unreplayed.

Evidence is `scratch/runs/20261112-quake3-atomic-command-major-2135/`.
`unchanged-reuse.json` verifies exact inherited SHA/size for the three repaired
producers, regression, consumer, repair generator, inherited pins, 18-case
result and locked-build log, plus all 14 final capture/input proof references.
Those regressions and build are reused unchanged, not rerun or newly claimed.
Atomic closed/fsynced temporary publication with exclusive hard-link final
creation and strict `ok is True` semantic ACK remain the required producers.
No production upload helper or runtime file was edited.

## Full capture observations and next aim

All 26 recovered 2055 original full 1024×712 PNGs were individually viewed,
including the four held frames and host shell. Strict full PNG decode/CRC,
dimensions and SHA references are in `full-2055-capture-review.json`; no capture
or media copy was made. This is review of historical evidence, not a fresh
owner/pointer-lock qualification.

The courtyard route passes to the right of the large statue pedestal into
the yellow-lit right arch. The approach held frame still shows the courtyard;
its consequence reaches the arch. `enter-lit-hall-held` is at the entrance;
its consequence faces the interior wall, with a separate floating shotgun
visible at the right edge. `ordinary-shotgun-step` shows native Shotgun pickup.
The subsequent left turn initially leaves the crosshair on the near wall;
`face-open-hall` finally exposes the passage beyond the inner arch.

In that full frame, a distant humanoid has visible head, torso and legs near
x≈490–502, y≈350–414, slightly left of the crosshair at about (512,373).
The much larger foreground shotgun near x≈320–425, y≈435–495 is a separate
object in the near hall. Across later held/consequence frames it changes
orientation while remaining near that floor location, and the final forward
step produces another native Shotgun pickup. These observations support a
pickup interpretation for that foreground weapon; they do not prove the
identity of every weapon-shaped object in earlier frames. In particular,
the apparent weapon-only appearance on entering the hall does not establish
an opponent body-rendering defect.

The firing held frame no longer shows the same clearly exposed figure.
The consequence has smoke, ammo 8 and a small partly obscured figure farther
right near x≈530. The next corrected view shows an empty far passage; the
reacquisition held frame is also empty. The final forward consequence faces
the far wall and the opening on its left, with ammo 10 after pickup. Score
remains 0–0. Neither a weapon pose nor smoke/ammo consumption proves a hit.

For a fresh attempt, use the statue/right-arch route only as a visual guide,
with one finite move and independently released full consequence at a time.
At the pickup, turn until the inner arch and far passage are exposed; do not
fire while the crosshair is on the near wall. Reacquire an exposed humanoid
in a fresh complete frame before deciding a finite aim action. In the
historical `face-open-hall` geometry, the torso is left of the reticle, so a
small left correction would be indicated, followed by a complete settled
frame proving the correction. Historical coordinates are not input deltas
and cannot prescribe a fresh moving target's aim. If the figure leaves the
arch, clear the corner with a short reviewed movement and inspect the left
opening before choosing another action. Do not fire at the floating pickup
or an empty/smoke-obscured passage. Only a native kill message or player score
increase identifying Major can earn the frag.

## Lossless recovery and capacity blocker

`terminal-worker-proof.json` records actual start-worker result 0 for 2055 and
2130, the launcher implementation's actual Codex child `subprocess.run` join,
and the process listing with both corresponding launchers absent. Exact paths
are in `selected-closed-logs.json`. Existing archive journals were checked
before compression; `prior-journal-check.json` records no exact-path entries.

Only those two workers' raw events and raw Codex sessions were compressed:
13,376,028 raw bytes became 8,626,508 encoded bytes, saving 4,749,520 bytes.
Each gzip remains locally beside its former raw path. The recovery helper
uses exclusive creation, completed gzip/flush/fsync, encoded-directory fsync,
full decoded raw SHA/size verification, encoded SHA/size, mode and nanosecond
mtime recording, then recovery-journal fsync before raw unlink and directory
fsync. `recovery-journal.jsonl` supplies exact hashes and recovery instructions.
The completed encoded files were independently read back again afterward.

`closed-q3-inventory.json` covers eight terminal Quake III workers: the other
six already lack raw event/session files and were not reprocessed. Existing
offload markers are historical only; this worker performed no offload. Root,
live/current logs, other games including HL, captures, media, saves, modules
and source were untouched. No cache/reserve/RAM change or worker launch occurred.

Actual `/home` free space was 1,487,155,200 bytes on entry and remained below
1,500,000,000 after recovery (1,477,632,000 in the recorded post-recovery check).
Concurrent disk changes mean byte savings are not a promise of free capacity.
The final hold/recheck is in `final-floor.json`. No one-shot API, allocation,
upload, original launch or input is authorized by these subfloor observations.
This is a distinct evidenced capacity blocker with eligible Q3 recovery
exhausted, not a new gameplay failure or command-parser reproduction.

No box was created, so this task's box ID/state/expiry/stop receipt and runtime
parent waits are **not applicable**. Inherited `bx_xs7tuh8z` remains historical
archived/expiry null, receipt `stop_1db408bb4cf799fe`, untouched. Historical
Node/outer parent joins remain UNKNOWN; actual independent parent wait and
separate stdout/stderr EOF are still required on any new run.

Next requires actual free space strictly above the floor, a fresh private
two-hour observable independent watchdog before creation, bounded 1 MiB
provider-qualified transport, all remote chunk/whole SHAs, frozen helpers and
actual provisioning join before original launch. Reconfirm native I Can Win
white with cursor away before Fight, full-22 actual current04 CPU-owning WebGL,
full PNG and real pointer lock before input. Preserve independent UP and full
consequence for every reviewed finite action, then recover unique evidence
and promptly normally stop the new box. Exact Git identity, relevant binary
diff and owned new patches are retained; Git is the source archive. No
full-27, parity, FPS, audio or general crash claim is made; parent artifact
review remains pending.
