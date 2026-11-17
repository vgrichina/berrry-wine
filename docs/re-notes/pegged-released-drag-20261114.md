# Original Win32 Pegged: released bounded drag

Run: `scratch/runs/20261114-pegged-released-drag/`.

The exact original is `test/binaries/entertainment-pack/pegged.exe`, 43,792
bytes, SHA-256
`bb5a4e90b71363cb7df5f818fc9a2de9841dbdfcb8a74498756b2c11438fe4c1`.
Its registry and media are unchanged. The earlier six-peg original remains
closed; its unchanged source-click image proves neither selection nor a jump.

Static original-handler evidence establishes left-button drag semantics:
WM_LBUTTONDOWN at `0x0100403b` accepts an occupied source, sets the active
flag at `0x01004268`, and calls SetCapture. WM_MOUSEMOVE at `0x010044ad`
handles that active drag. WM_LBUTTONUP at `0x01004b28` uses its destination,
releases capture, and validates an orthogonal distance-two jump, empty
destination and occupied midpoint through `0x01006680`. The active flag is
cleared at `0x010056df`. Board WM_KEYDOWN/WM_CHAR are not handled by this
wndproc. The referenced matching `pegged.hlp` is absent; no visible Help
contents are claimed. Focused static excerpts are retained in the run.

The adopted `tools/pegged-native-controller.py` and its two tests implement
one personally chosen fixed drag through existing public guarded pointer
edges. No public input or renderer change is needed. One fresh complete scene
must identify the occupied source, occupied neighbor, empty destination,
legal reason, exact centers and actual count before DOWN. An independent
child acknowledges its immutable 1750 ms fallback before DOWN; destination
UP requires identity-matched consumed DOWN and MOVE receipts. The complete
normal gesture is bounded by 1500 ms including movement. EOF, cancellation,
late ACK or uncertainty releases at the original source and closes input.
Physical cleanup precedes durable audit. No capture or model call occurs
while held. Every completed gesture requires a separate personal visual
removal review before another gameplay gesture. UNKNOWN remains terminal,
without retry or rebinding.

The coordinator's explicit prerequisite amendment permits this successor
after the predecessor's actual native, watchdog and supervisor-child waits
with both EOFs, supervisor heavy release and exact process absence. Those
records were personally checked. StarCraft's ancillary outer-wrapper wait
remains UNKNOWN; its independently proved native Quit is preserved. The
previous report `82d9d0ea` is read-only and retains its historical gate.

**Three personally verified removals, native Game Over with three pegs,
then native Game → Exit and actual exit code 0. No win is claimed.** The
fresh original opened directly on the actual six-peg default board. Binding
truthfully recorded the board phase, despite the first capture's historical
filename `bootstrap1.png`. No Start, pattern selection, reset, undo or second
puzzle was sent. There was no numeric remaining-count text; counts below
were personally established from complete native pixels.

| Gesture | Personally chosen jump | Count after visual review |
| --- | --- | --- |
| 1 | r3c4 over r2c4 into r1c4 | 6 → 5 |
| 2 | r5c4 over r4c4 into r3c4 | 5 → 4 |
| 3 | r3c4 over r3c5 into r3c6 | 4 → 3 |

Each review explicitly identifies the source and jumped neighbor now empty
and destination now occupied. The third drag produced an actual native
`Pegged` dialog with message `Game Over`. Because it obscured the source,
the third removal was withheld until a reviewed native OK dismissal exposed
the complete board. Its three remaining pegs at r1c4, r3c3 and r3c6 have no
occupied orthogonal neighbor, consistent with the actual native result.
Independent destination-UP receipts establish DOWN-to-UP intervals of 519,
514 and 512 ms; cleanup acknowledged all three gestures.

Two five-second admission attempts expired before any input. Subsequent
admission and drag reviews used a fresh complete capture, requiring exact
byte equality with the personally viewed complete scene before acting.
The review names both images and records their complete-image SHA-256.
Any mismatch would refuse the operation. This compares image identity only;
it reads no board or guest state and generates no coordinates or moves.
All chosen coordinates came from this fresh original's personally viewed
scene. No timestamp, visible selection or count was fabricated.

The actual result dialog also exposed a derivative-helper assumption: the
original title is `Pegged`, whereas `Game Over` is its message. Before OK,
the owned dismissal policy was corrected to check title and message
separately. The old policy failed the actual-title fixture; the correction
passed that fixture and refused incorrect titles/messages. Fifteen policy
tests and another full locked build passed before the correction was
published as `25a76f2a`. Public input and resident runtime code were untouched.
The two changed owned files are explicitly recorded as a second source phase,
with old/new hashes and `dialog-owned-change.patch`; they are not reported
as zero launch-pin drift.

The initial coherent controller was published as `af185f28` before original
launch: **14 policy, 9 HTTP and 8 actual CLI controls passed**, along with the
released **23 policy, 12 HTTP and 10 actual CLI controls**, and
`flock /tmp/wine-build.lock bash tools/build.sh`. Actual CLI fixtures test
the real public endpoint/renderer, cancellation, identity replacement, lost
ACK, parent death, late MOVE, independent fallback and persistence ordering;
they are not Pegged gameplay proof. No public endpoint extension or callback
change was needed.

The original recipe was bounded at 900 seconds, default batch size 1000 and
real ticks, with an independently prearmed 920-second watchdog and irreversible
final 180-second Quit reserve. Reviewed Game → Exit was consumed. The guest
logged `[Exit] code=0` at 367.790 CLI seconds; actual native wait followed
368.021 seconds after launch, before the reserve boundary. Native, watchdog,
supervisor-child and outer-wrapper actual waits all returned 0 with both
EOFs. Their exact PIDs were absent, port 8615 was closed and the heavy lock
was released. The watchdog exited unfired on actual native wait.

The final independent release found `OWNER_EXITED`: **physical UP was not
acknowledged**. That is retained separately from the reviewed Exit command,
consumed receipt and actual normal guest/process exit. One held main-owner
critical section was logged at exit; no all-thread-clean claim is made.

All 423 launch pins were checked immediately before releasing runtime
ownership: two explained owned title/message-policy changes, zero unexpected
drift. All ten read-only pins and registered media matched. Evidence contains
Git SHA plus relevant binary patches, compact logs and selected complete PNGs
named by `result.json`; no source tree, media or WASM copies or frame series.
No private board access, seed/clock/config writes, automated reader/solver,
browser, full-27, FPS, audio or new-title compatibility claim is involved.
No box or additional worker was created: box ID/expiry null, state
`NOT_CREATED`, stop receipt `NOT_APPLICABLE`.

This bounded task is complete. No further input or original launch is planned.
