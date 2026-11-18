# AoWII durable native lifetime, 2026-11-18

Evidence: `scratch/runs/20261118-aow2-durable-native-lifetime-terrain/`.

The prior original's actual outer command was `exec_command` running
`bash -lc` and `node lifecycle.cjs run original`, with an initial 1000ms
yield and no explicit timeout argument. That Node process directly owned
native-supervise and its independent watchdog. Native-supervise used
`setpriv --pdeathsig KILL` and a detached process group for the native
controller, which owned Chrome and the driver. The configured native deadline
was 900 seconds and cleanup was 920 seconds. The command completed with 124
at 179.53 seconds; the supervisor recorded incoming SIGTERM before its own
deadline, while the watchdog recorded no trigger. These facts do not identify
the historical first sender. The driver label claiming watchdog SIGTERM is
not sender evidence. The old scope remains closed.

The AoWII launcher now detaches the receipt custodian from the submitter,
using the already established FoxBear/BloodII custody pattern. It retains
native-supervise containment, real PID/start-token/PGID identities, native
waits, both Chrome/driver pipe EOFs and the independent watchdog's actual wait.
The original's native deadline remains 900 seconds, independent cleanup
backstop 920 seconds, with 180 seconds reserved for ordinary reviewed Quit.
No native supervisor or kernel containment code is changed.

An authored browser/native WASM control reproduces loss when TERM reaches
the old supervisor-owning submitter: execution after the gate is lost, the
driver exits 124, and native-supervise records supervisor SIGTERM. In the
corrected controls both submitter TERM and KILL precede successful renderer
WASM execution and pixel readback. Separate controls kill the submitter before
the real authored x86 PE executes with genuine AoWII packages; both then
reach `Native VariantInit returned vt=0`, bind the exact older module and pass
their required transfer assessment. These controls prove protection against
the tested parent-signal mode, without claiming the unknown historical sender.

Transport oldfail/new32, retained ERR_ABORTED, native191, collector129 and
real negative controls are reused unchanged. The older coherent source graph
is `0a823095c` plus its retained patch, `81ad6c802` manager, `87ef39648` module
and 435 media pins; it is explicitly different from current main. The passive
Device7 observer, covering-red/narrow-strip and unchanged-memory controls are
also reused. No DLL, media, clock, registry or guest-state substitution occurs.

## Fresh original and actual consequence

Correction `58dd247c7` passed focused tests and the locked build, then immediate
strict pull/push, before the single fresh registered original. Its submitting
command returned normally while the detached custodian continued. The real
main Worker binds slot0/endpoint1 and the exact `87ef39648` module. The final
transport assessment passes 798 required bodies, with a complete collector
and no transport first fault. No second original was launched.

Personally reviewed whole images cover Scenario, Single, unchanged default
Inioch's Legacy, Start, Julia's opening dialog and the actual map. Startup and
map loading progressed naturally past the former 179.5-second boundary.
Mountains, trees and the tower are visible; much of the ground remains black.
The next-unit arrow selects a six-unit Party with 20/20 movement. An ordinary
destination click plots a path southeast of the tower; a separately reviewed
confirmation spends movement to 14/20 and leaves five selected units, with
the hero at the tower. This is one fresh army consequence, not two moves or
full gameplay/terrain parity. All actual input edges retain trusted browser
events, prearmed independent release and actual release-child waits/EOFs.

## Device7 inputs, completed raster and limits

The unchanged qualified CPU observer records a real Device7 call at return
PC `0x4459fe`, device slot19, target slot65/generation1, 1024x525 RGB565.
Its four raw vertices span x605.5–887.5/y118.5–218.5, z0.99, rhw1, white
diffuse, with texture68 (512x128). Raw and packed vertices, the full 4096-byte
state, texture samples, render/stage states and viewport are retained.
Both strip triangles exclude [600,300]. A subsequent actual target transfer
also observes that CPU surface's point as zero RGB565.

A separate bounded natural executor interval contains 2,476 records and 1,355
completed POSITIONT draws, all with known bounds excluding [600,300]. It ends
at natural READBACK sequence348035, target9, with opaque black at that point.
UPLOAD345560 supplied that same opaque black before execution; its exact
2,097,152-byte input hashes to
`5a57c68da9ce7aaeb23da0a56e808c647be08d3a699420887fad5e24200b4872`.
The following target upload starts at y512 and excludes the point. There is
no CLEAR or COPY in the interval. Thus345560 is the last captured writer of
the point before READBACK, with no effective draw coverage there. Selected
completed DRAW_UP345596 retains its six packed vertices. Only selected inputs
and metadata were retrieved; no stream bundle or frame series was retained.

The CPU snapshot occurs during Device7 target preparation, not a demonstrated
return from that exact call. The later completed executor interval is separate;
an exact same-invocation join to that first CPU strip is **not proved**.
Nor is the earlier CPU DIB writer/reason for black. The later browser whole
image is not asserted to be the exact READBACK frame. No intended-color
inference, valid-case API error, rendering repair or Windows parity claim is
made from these observations.

## Quit blocker and final custody

Gameplay stopped before the 180-second reserve. Ordinary Escape opened the
save prompt; the reviewed No click has both native-facing input edges and an
independent release wait. During that transition, thread3 reports `Process
send callback exceeded drive limit`, followed by the program-exited log and
callback-owner retirement. The narrow passive fault predicate did not classify
this row as its first fault. Inspection of retained logs closed the scope
manually as UNKNOWN; no further endpoint request, input, replay, Quit/Next/Exit
or additional original followed recognition. Ordinary Quit is **not proved**.
The observed shutdown boundary is a concrete blocker, not an established
underlying emulator cause or a reproduced shutdown repair.

Owned cancellation ended native custody after804.6 seconds, still before its
900-second deadline. This final supervisor SIGTERM is explicitly caused by
the task's cancellation request, unlike the unknown historical signal. The
reused driver's literal watchdog label still does not identify a sender.
Actual waits are driver124/null, Chrome null/SIGTERM and watchdog0/null, each
with both EOFs; native-supervise reports exit124/null, no poll error and
`leaked:false`. The independent watchdog has no trigger and minimum /home free
1,531,838,464 bytes. Profiles were removed after retaining/hashing custody
receipts; known native processes are checked nonlive during final sealing.

Evidence records exact Git and own patches, runtime/module/media identities
and recovery recipes, and selected named PNGs. `result.json` is written last.
No workers, agents, Wine, Python, media copies, source archives or deployment.
No boxes: IDnull, stateNOT_CREATED, expirynull, stop receipt null. Ownership
is released after sealing the final evidence.
