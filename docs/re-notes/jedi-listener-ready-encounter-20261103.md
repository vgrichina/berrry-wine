# Jedi listener-ready encounter: first observed damage in sector 265

The sole original demo campaign reached sector265 alive with health/shield100.
The next neutral capture rejected **first observed damage: health30.828529,
shield0, ammo100**. No further gameplay input followed. No shot, player attack,
target effect, death, restart or positive armed-hostile identification is claimed.
The exact final PNG was personally reviewed: yellow damage tint, HUD30/0/100
and a distant biped whose weapon cannot be positively resolved. The damage
source remains unidentified; no emulator defect is established.

Evidence, executable helpers, tests, fullSHA and recovery are retained in
ignored `scratch/runs/20261103-jedi-listener-ready-encounter/`.
`outcome-analysis.json` checks all approvals and actual key delivery.
`retrieved/session/corridor01-pair-1-sample.json` records the rejected sample;
`retrieved/session/child-8274-final.png` is the reviewed final image.

## Listener readiness and preserved controls

The [previous startup blocker](jedi-reviewed-neutral-encounter-20261103.md)
was addressed in task-owned orchestration only. Before the first application
RPC, the supervisor awaited both the explicit control-listener ready log and
a LISTEN socket inode held by a process in the sole launcher's process group.
The gate uses passive `/proc` inspection, never failed HTTP requests as polling.
It remains bounded by the existing immutable outer deadline with cleanup time
reserved. Process exit or readiness timeout stops the attempt without restart.
The actual controller independently refuses RPC before its port's ready receipt.
The first actual RPC error would write a stop request immediately; none occurred.

The gate recorded launcherPID11208/port8273 ready at14:15:54.845806Z and
gamePID11312/port8274 at14:16:11.610084Z, before their first RPCs. The first
launcher capture succeeded. One reviewed Play click followed, then the full
unskipped movie and original Player/Medium → Single Player → New Game menus.
No availability was fabricated or guard widened.

Local and boat synthetic controls pass: a genuinely delayed socket listener,
process exit before readiness, finite readiness timeout without restart, and
the actual controller's zero-network pre-readiness guard. The delayed control
requires the logged listener and socket ownership; application work begins
only after readiness. Timeout/exit paths perform zero application RPCs.

The accepted `neutral_reference.py` and all11 reference unittest methods remain
byte-exact. Four unchanged original controller controls and eight retained
final-authorization cases pass, including delayed PNG, drift, damage, changed
identity/code, stale sample/review and failed PNG zero-keydown cases. The adapter
still completes pre-control PNG **before** the final fresh sample/authorization.

All28 gameplay actions used a newly captured memory-PNG-memory neutral pair,
personal exact-image/state-digest review, one-use approval, fresh alive
health/shield100, matching original code/world/player identity, both reference
comparisons within0.08 distance/4°, and a bracket within1second. There was no
automatic review/rebaseline or historical approval. Timed/finally release was
retained. All31 actual down/up pairs match GetMessageA delivery:5Left,21Up,
2Right and3C. Ctrl/fire was never sent. The failed29th pair rejected its first
memory sample before producing another image, review, authorization or keydown.

## Reviewed route and timing limits

Actual sampled sectors were **874 → 266 → 276 → 256 → 277 → 280 → 265**.
Sector267 falls between sampled passage states and is not claimed as an observed
sample. Personally reviewed views supported the western lane, south turn,
visible stairs, upper landing, pipe approach, C duck clearance and short
corridor emergence. Static placement was never used as hostile identification;
no civilian was targeted. Accepted route evidence was reused without repeating
static route diagnosis. Original Coords/code pins and pointers were checked
afresh in this process.

The last Up action requested0.3 host seconds; down/up intent separation was
0.319333497s, with both messages actually delivered. Its immediate post sample
at14:33:50.067Z and later neutral sample at14:33:58.382Z still had health/shield100.
The post-to-neutral interval was8.315 host seconds because capture work intervened;
this was not a paused game. At the next capture,14:34:07.081Z, health was30.828529
and shield0 in sector265, XYZ(0.33500728,3.28499389,-0.12988901), yaw214.62903°.

The last healthy-to-damaged observation gap is8.699 host seconds; the original
simulation accumulator advanced8681ms. These samples do not identify the onset
or cause of damage within that gap, or prove the final0.3s press caused it.
Host intent, renderer dispatch, GetMessage delivery, guest wall tick and original
simulation time remain distinct. The final image shows damage rather than a
player attack or target effect. No additional observation RPC followed rejection.

The original launcher began14:15:54.642906Z with immutable1200s guest/1260s outer
limits and outer deadline14:36:54.642918Z. It stopped after1098.917034416 host
seconds, exitCode-9: TERM requested orderly shutdown, then the own process group
required KILL after5s grace. That host cleanup is distinct from the boat's normal
stop. There was one campaign, with no retry or second launch.

## Source, evidence and lifecycle

Fresh locked boat-side build used exact published input
`8ac536314dfdb59ff01501f23d55a4259c5199a1`. All5827 sealed Git-blob inputs stayed
unchanged and were independently verified recoverable locally; shared WIP was
excluded. Wasm2088037 bytes, SHA256
`1f39572325be5251c4b9a923e83d4ea9ff33962d4d3e7911a4835df20cf0ae7e`.
Actual launcher and two ordinary child compile/completed-instantiation receipts
match. The duplicate original child exited through ordinary duplicate detection.

Source-derived staging produced178 runtime members and passed strict preflight
on the final boat before launch. Nine fresh focused tests, seven omission
controls, five unmodified staged input/clock tests including five clock mutation
rejections, and four no-guest observer controls pass. Two prelaunch orchestration
errors are preserved: focused-result write before the session directory existed,
and a runpy import-path failure for readiness tests. Both were corrected and
rerun before the sole guest launch; neither was an application RPC error.
Known unrelated input-state/source trace-marker limitations remain unresolved.

Before/after verification preserves28 originals/39900850 bytes, genuine
DSOUND.VXD/DDHELP,178 runtime files and76 parent registry entries. All38 captured
states preserve original pins;37 child captures have only allowed Version0.1.
The original package remains21195858 bytes, SHA256
`8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.

All514 remote payloads were retrieved and verified by stored/decompressed
length/fullSHA before shutdown. Archive12722996 bytes, SHA256
`dadae04fccc137a6e227b04509c993a141c96bb163dea3282654dbf116cbaf11`.
Recovery was uploaded and independently retrieved byte-for-byte before normal
STOP; the pre-stop local fullSHA seal covers1690 files. Scoped helpers and
ports8272–8289 were absent before stopping.

Only fresh boat **bx_zqdxvgxr** was operated; original expiry
**2026-11-03T16:11:37.264Z**, shutdownOwner `jedi-listener-ready-encounter`,
recorded before use. Explicitly delegated normal stop
**stop_4be7162faae1b10f** completed at**14:37:25.780Z**:
**STOPPED/completed/error:null/forced:false**, snapshot available and normal
snapshots retained. No assigned boat remains running. Local home stayed above2GB.
No production change, browser, subworker, predecessor boat action, foreign cleanup
or public deployment occurred. This single task ends at its first observed
damage blocker; any further campaign needs separate authorization and review of
the unresolved damage interval and occluded corridor view.
