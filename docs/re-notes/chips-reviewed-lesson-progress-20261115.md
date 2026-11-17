# Original WEP4 Chip’s Challenge: reviewed Lesson 1 partial

Exactly one registered `wep16_chips` original was launched, from untouched
Lesson 1, after publication of controller commit
`7461d0319f2b8d6f26bcb655c1309e18ddb7fdef`. I personally reviewed the complete
bootstrap before permanent binding. Ordinary Enter dismissed its overlay.
Two individually reviewed Left presses moved Chip toward a visible chip and
collected it: **Chips Left changed from 11 to 10**. The selected full scenes
show the adjacent chip before that second press and Chip on its former tile
afterward. The camera scrolled with Chip; no old board coordinates were used.

The native lesson countdown expired before a key or door consequence was
achieved. The visible result was “Ooops! Out of time!” No ordinary lesson exit
was reached. A single click on the visible Game menu was blocked by that native
modal: the input trace explicitly records the outside-modal drop, and the
complete scene stayed unchanged. Native Quit was **not achieved**. I left the
timeout dialog undismissed, did not restart, and requested supervised shutdown.
The native log records SIGTERM orderly shutdown. Its zero exit is a host
shutdown result, not proof of Game → Exit.

The complete result and evidence are in
`scratch/runs/20261115-chips-reviewed-lesson-progress/result.json`.
Only four selected, personally viewed PNGs remain:
`result-bootstrap.png`, `result-chip-before.png`, `result-chip-after.png`, and
`result-timeout.png`. Their original capture names and SHA-256 values are in
`selected-images.json`. Unselected captures were removed; no media, source-tree
archive or WASM copy was placed in the run directory.

The collection conclusion comes from native pixels plus the attributable
Left DOWN/UP trace, not a transport ACK. The optional live consequence receipt
was not admitted: its post-action scene was already more than five seconds old,
and its supplied before-description also differed from the exact prior review.
No Up intent was reserved or delivered. `play-observation.json` is explicitly
retrospective. Several earlier choices also expired before input. The extra
review-to-input round trips consumed most of the lesson's continuing countdown;
the limits were not relaxed and no game clock was changed. No runtime defect
warranting a causal source repair was established by this partial play.

`tools/chips-controller.py` is a self-contained finite controller. It binds the
actual PID/start token, exclusively owned loopback socket, native input owner,
window and canvas once. Complete board scenes expire after five seconds and
menu scenes after thirty. Keyboard movement requires the reviewed main-window
consumer and unchanged focus. No gameplay mouse click was used. Each physical
press reserves a unique nonce and prearms an independent UP child before DOWN,
with a 1,500 ms gesture deadline and 1,750 ms fallback. Late ACK or UNKNOWN closes
input without replay or rebind. Captures and durable response audits follow UP.
The four delivered gestures were Enter, Left, Left, and the Game-menu click;
each requested 100 ms and has an actual zero release-child wait with both EOFs.

The original used real ticks and the default batch size of 1,000, a fixed
1,200-second native deadline, an independently prearmed 1,220-second watchdog,
and an irreversible 180-second Quit reserve. It entered Quit phase early after
the timeout. No level selection, password, skip, reset, restart, second original,
solver, tile reader, private game-memory access, seed/config/clock write, box,
worker or public deployment was used.

Before play, all thirteen installed `CHIPS.HLP` topics were decoded through the
built native parser and personally read. They specify required chips, socket
and exit square, matching-color keys and doors, green-key reuse, arrow or mouse
movement, continuing time during hints, and Game → Exit. No level data was read
for routing. Earlier scripted fake-tick regressions remain transport fixtures
and supply no original-play evidence. The actual Help-parser wait was zero with
both EOFs; the old JavaScript parser's empty result supplied no rules evidence.

Qualification passed **28 policy tests, nine HTTP controls, eleven real CLI
controls, and the full locked build**. The CLI controls used a separate
Solitaire fixture and the actual compiled runtime and HTTP endpoint. Native
traces verify Right DOWN/UP dispatched to the reviewed HWND. Other controls cover
changed-focus refusal, native menu opening, late ACK, UNKNOWN after consumption,
cancellation, identity, release-child death before DOWN, independent fallback,
no capture while held and parent death. The qualification aggregate records
52 actual zero waits with both EOFs; the deliberately orphaned release-child
wait remains UNKNOWN separately. None of these fixtures claims original Chips
collection or completion.

TetraVex and cursor repair released source/runtime first; their actual terminal
waits and absent PIDs were verified. `flock /tmp/wine-build.lock bash tools/build.sh`
passed before commit and publication. Tested WASM SHA-256:
`f866c8a9247f51fabd296b012d5b963c51afb97fc29f786b22798c39d4e2cff0`;
compatible module:
`b01e44cb043acba2b8ed1109a806176760d277ae525e5eb4d955d26fd40190a4`.

All **491 launch pins matched after shutdown**, including the existing WEP4
EXE/DAT, registered MID/WAV files, WEP4UTIL, dependency candidates, source,
controller, run inputs, modules and actual host libraries. The original log
confirms WEP4UTIL loaded; all eight actually mapped host files match the
before-launch closure. These mappings are file metadata, not process-memory
reads. Exact paths, sizes and SHA-256 values are in `launch-pins.json` and
`release-pins.json`. Key existing media hashes are:

| File under `test/binaries/wep16/WEP4/` | SHA-256 |
| --- | --- |
| `CHIPS.EXE` | `8e26acd67cf120bd5b512de4b4e78b80aca1579413cd04f3b2b68909a375866c` |
| `CHIPS.DAT` | `b0a68f21642447385512e0ed9386a4a13a4f7e9a38f909da772104d8e6b5c1fb` |
| `WEP4UTIL.DLL` | `40a405813946caac1aa2ec3e31fa570de1c418f8db43182d614e0bac4e1978cb` |

Git supplies source recovery: the launch SHA is the published controller commit;
`relevant-uncommitted.patch` records relevant shared uncommitted hunks.
`prepublication-owned.patch` and its base SHA preserve the owned new files as a
binary Git patch. No source snapshot was made.

Native PID 70253, watchdog 70252, and supervisor 70249 have actual zero waits,
both EOFs, and are absent. The supervisor recorded heavy release; port 8641 is
closed. The ancillary invoking tool returned 143 without the launcher's own
outer-wait file; that outer wait remains UNKNOWN, separate from all three actual
waits. Runtime ownership was released to Rodent after pin verification. No box
was created: ID null, state NOT_CREATED, expiry null, stop receipt NOT_APPLICABLE.
The bounded task stops here with honest partial progress and no second attempt.
