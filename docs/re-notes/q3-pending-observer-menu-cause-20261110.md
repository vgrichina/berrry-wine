# Q3 pending observer: reviewed main menu, first point command refused by outcome

Run `scratch/runs/20261110-q3-pending-observer-arena-1422/` used the one
authorized original. The published `a75392fff` observer returned three pending
polls and then a ready, hash-verified full startup image. Its actual capture
completed at 14:24:39.967Z, within the unchanged startup deadline
14:25:32.446Z. The image clearly shows the original Quake III main menu.
Both the startup and resulting command images were personally reviewed.
Arena, movement and firing were not reached or accepted.

The worker substituted an absolute click for the prepared Enter command.
Command0 requested SINGLE PLAYER at normalized canvas `[0.5,0.34]`, held
150ms, settled 2000ms, and returned a successful transport ACK. The resulting
full image still shows the main menu. Input stopped at that first unsuccessful
visible transition; no second action, later capture, replay or second original
was made. The ready-image pending fix itself worked.

## Actual causal boundary

The capture-bound input observer and command-begin record both report
`pending-relative`, not an absolute pointer profile. No `handleMouseMove`
reached the renderer before DOWN. DirectInput dx/dy remained zero and its
two FIFO entries were button DOWN/UP only. The browser acquired Pointer Lock
during the click. The renderer's virtual point changed from `(319,239)` to
`(319,145)` on DOWN, but that absolute point update did not supply relative
motion to the guest UI cursor. This is a caller protocol mismatch, not proof
of a production renderer defect.

All three native mouse CDP requests received raw matching replies without
protocol errors. The guest consumed key178 DOWN and UP; DOWN reached the
original UI VM command3 and returned zero. Win32 mouse messages were also
dequeued. Those observations establish delivery, not selection. The exact
later UI decision is unknown; the screenshots prove only that this command
did not visibly open SINGLE PLAYER. Historical sync causes were not reopened.

## Caller repair

`tools/q3-original-image-observer.py` now includes the existing label-scoped
input observer snapshot with a ready image, or null if it was not published.
It performs no new browser request or guest operation. The new
`tools/q3-original-command-admission.py` prepares a numbered request locally:
absolute point commands require captured absolute mode; explicit relative
clicks require captured Pointer Lock. Missing/inactive mode refuses point
commands. Ordinary keys retain their exact request and review text.

This check does not infer relative counts, choose a menu, move a cursor, write
guest state, change runtime admission, reset deadlines or relax the 120-second
image bound. The runtime still rereads the latest image and owner before input.
Pinned mouse/host/native providers were left unchanged. The replacement local
recipe `reviewed-send.py` calls this check before the retained sender and was
prepared without using another original. A future run should retain the
prepared ordinary Enter at this first menu, with a fresh personal review.

Six focused command controls passed, including the authenticated actual
command/capture/observer refusal and actual CLI zero-output failure. Eight
observer controls passed, including delayed-ready startup, immutable owning
deadlines and subprocess cancellation. The existing composed DOM/renderer/
host input-observer controls passed for absolute, pending-relative, locked and
ordinary Enter routes. These are offline delivery controls, not gameplay
acceptance. The required locked build passed; see the run's `build.log`.

The actual game's saved configuration binds CTRL to `+movedown` and MOUSE1
to `+attack`. The inherited Control fire plan would not establish firing in
this original; any future arena attempt must choose the ordinary attack
input from its current reviewed configuration and mode without rebinding it.

## Prerequisite reuse and lifecycle

All 951 common providers exactly matched the accepted repaired full-launcher
prerequisite in `20261110-q3-inner-fsync-causal-repair-1332/repaired` before
allocation. Five local manifest rereads, changed-run-path preflight, seven
then-current observer controls, transfer checks and fresh remote prelaunch
passed. Exact CPU SHA256 is `e587a07b7cbb9410fd52ec374c71f6c87a81e9f4bbd7404c3c64c7bb77253edd`;
the passive module is `b29e6163f2ecfdca471f74444f35df99e1c18f6378215c4175a7ab611d46dd63`.
Git commit and relevant binary diff are retained; no source or media archive
was made. MW3, Zuma and native custody code remained read-only.

Only new private box `bx_f6f8mwyx`, UUID
`c464e91e-0b7b-4892-a37d-40de2c93e129`, was allocated with a prearmed,
observably alive independent watchdog. Initial expiry was
2026-11-10T14:47:23.124Z. Before delegated normal stop, all 72 unique artifacts
(5,046,488 bytes) were retrieved, SHA/size checked, independently reopened and
compared with a separate unchanged remote inventory. Both PNGs passed CRC and
decode checks. One empty gzip is explicitly preserved as invalid. All unique
artifacts were rehashed again after stop.

Generated, prelaunch, runtime and local controller parents have actual waits
and separate stdout/stderr EOF records. Native custody reaped 347/347 owned
processes with no remaining/unreaped/unresolved lineage or ptrace entries and
command-log EOF. Node6519 was actually reaped with signal15; Chrome6562 with
signal9. Each has WNOWAIT-before-waitpid evidence. Ordinary Browser.close is
unknown on this cancellation path; a successful normal browser quit is not
claimed. This is separate from the completed normal box stop.

Normal box stop `stop_3eea51d6726bf172` completed
2026-11-10T14:26:02.282Z, forced:false, error:null. Final observed state is
ARCHIVED, archiveAfter:null. The watchdog observed normal-stop confirmation
and its allocation parent actually waited with both EOF and status0. No
inherited box was resumed; no workers, deployment or local heavy runtime ran.
Free /home remained above 1.5 billion bytes.
