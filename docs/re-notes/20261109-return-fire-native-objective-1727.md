# Return Fire native objective: unmet; lifecycle qualification failed

Run: `scratch/runs/20261109-return-fire-native-objective-1727/`.

**No enemy objective or new objective consequence was established.** I personally
reviewed the current raw bunker map and helicopter reconnaissance screenshots.
They show the home bunker, a green-roof roadside building, coastline, palm-only
islets and open water. The building's enemy identity was not established. No
pickup, target destruction or flag consequence is claimed. This is a failed
objective search, not another accepted movement outcome or evidence that the
demo lacks enemies. No demonstrated emulator defect justified a code change.

## Retained prerequisites and actual identity

All 700 paths in the accepted November 8 ledger existed locally. All seven
retained qualified-control references and three inherited helper references
matched their hashes. The accepted selector, actual consumer observer, bound
input and numbered ACK path were reused; cancellation research was not repeated.
Current source/build differed from the historical ledger in 34 paths. Before
allocation, the new run recorded current hashes and executed the actual driver
with `DRIVER_PREFLIGHT=1`: 698 pins passed, without Chrome or an original launch.
The spent historical run and its pins were not overwritten. The owner disk floor
of 1.5 GB replaced inherited 5 GB checks; input, deadline and identity guards
were retained.

Tested source is `49066461ef486cb8393c3b896354f7d2006a131e` plus the retained
`relevant-source.patch`; Git and small helper patches are the source archive.
The actual recovered guest module is
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`, matching
the staged module pin. All 58 original consumers completed their exact EOF/hash
receipts, totaling 5,304,439 bytes; all 64 selected consumers completed. The
registration metadata completed separately with no binary-consumer invocation.

The unchanged route was `index.html?candidates&no-log&app=return_fire_demo`.
Original media, registered configuration and guest clock were unchanged. Actual
presentation was `Win98Renderer` / `CanvasRenderingContext2D`, with no owning
GL/D3D renderer. This remains separate from GL/D3D coverage.

## Reviewed search and its limits

Read-only decoding of shipped `RFIRE.HLP` established bunker J/map, A/left
selection, H/deploy, field WASD movement, and the distinction between flag
buildings, exposed flags and jeep retrieval. The current map's small central
markers did not establish an enemy identity. A selected the helicopter bay;
H deployed it, followed by a bounded passive wait. Reviewed movement reached
the roadside building, western/southern/eastern home coasts and southeast
islets. Later captures show open water. Read-only WRL header/tile inspection
helped interpret occupied map extents; it did not establish a target or prove
which world was active. The final reverse movement over uniform water has no
landmark-based displacement claim.

All 29 requests, including ordinary completion, had successful exact ACKs.
Each dispatched input used a matching reviewed capture and live identity;
bounded holds retained their independent release records. The audit verified
29 capture bindings, 58 PNG CRC/IDAT checks and the original-consumer joins.
These transport/capture checks do not turn the unsuccessful search into an
objective result. `first-objective-failure.json` preserves the unmet boundary.

## Cleanup and concrete lifecycle failure

Redline1702's final published release and normal stop/watchdog join preceded
allocation; Pawn1723 had also published its offline completion without a box.
One fresh box, `bx_pvye6uwx`, was created using UUID
`d859d5b2-ae4b-434d-95db-a7b7da626974`, retained in
`watchdog-config.json` and `boat-created.json`.

The normal/watchdog processes were armed and observable before allocation, with
an immutable 25-minute deadline. However, I launched their supervisor inside a
tool session rather than detaching it. That session returned **143**, and all
three processes disappeared without terminal or join records. The terminating
actor is unknown. **Independent watchdog survival and successful join are not
established.** The strict audit fails on missing `supervisor-terminal.json`;
`validation.json` records `passed:false`. No replacement runtime or relaxed
qualification was attempted.

Chrome closed ordinarily at 17:38:06.354Z, code 0/signal null. The immediate
census failed because the Node controller was still alive; its ports were
closed and profile/writer lock absent. A later separate read-only observation
confirmed both controller and Chrome absent. The initial census failure is
preserved rather than rewritten.

All 400 remote artifact references, 343 unique hashes, were retrieved and
independently reread for size/SHA-256 before stop. Since the delegate had died
before making any stop API attempt, I executed the explicitly delegated normal
stop directly. `stop_55f2286b5ccd0f58` completed at 17:40:07.350Z, forced=false.
Final API state: **archived**, `archiveAfter:null`; `expiresAt` was not returned.
Initial `archiveAfter` was 17:54:19.014Z. Local lifecycle processes are absent,
but no successful watchdog join is claimed. No box reuse/resume/delete, local
Chrome, second allocation, public deployment or source/media archive occurred.

Next requires a separately assigned task: establish a readable enemy-target
route and a supervisor that survives its tool session before another runtime.
This worker stops with objective and lifecycle qualification failed.
