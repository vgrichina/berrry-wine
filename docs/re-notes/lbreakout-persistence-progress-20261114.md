# LBreakout persistence and original brick progress

Evidence belongs to `scratch/runs/20261114-lbreakout-persistence-progress/`.
The shared persistence release defect is repaired and tested. The one fresh
original reached the first board and completed **native Quit, guest exit 0,
at 562.363 seconds**. Four reviewed serves produced life loss and darkened
bottom-row tiles, but score stayed **0**. **Brick destruction, positive score
and level advancement remain unproved.** No darkening is called destruction.
The predecessor stays closed without replay or rebind; its 112.127-second
host SIGTERM remains distinct from this run's actual native Quit.

The new negative regression uses the actual production HTTP server, guarded
input implementation, permanent PID/socket owner and independent Python
release child. It invokes the real `os.fsync` syscall and injects 220 ms of
latency at each of four parent durability boundaries and 350 ms at the release
child's fired-record boundary. It injects no transport or handler delay.
The unchanged 120 ms pulse receives its ACK in **1.930 ms**, but physical
fixture DOWN-to-UP lasts **1,315 ms**. The assertion still incorrectly says
“ACK arrived too late for complete pulse”. Both that failure and its complete
audit are retained in `red/`; this is a reproduced timely-ACK/slow-durability
failure, not an actual late-ACK negative relabelled as this case.

After Forsaken's actual 18:03:43 release and publication `6379df65a`, the shared
controller now communicates consumed-time release through a prearmed pipe
before audit persistence. The short message uses one atomic nonblocking
write; a failed write remains terminal and the independent immutable fallback
remains armed. Pipe EOF does not remove that fallback. The release child sends
UP before persisting its fired record. Complete durable timing, receipts, DOWN
and schedule evidence follows release; successful ACK timing is evaluated
from the actual return timestamp rather than the time auditing finishes.
Actual late ACK, unresolved UNKNOWN, busy-server physical bounds, pre-DOWN
expiry and permanent-owner rules remain in force. A final consumed receipt
also travels through the pipe, preserving the distinct OWNER_EXITED path
without inventing an UP ACK or waiting for a postrelease receipt file.

The three new light controls pass. With the same injected fsync delays, the
unchanged 120 ms pulse receives ACK in **1.686 ms** and physical DOWN-to-UP
is **142 ms**; every injected parent durability boundary starts after UP.
The release child's 350 ms fired-record durability delay also follows UP.
Actual parent SIGKILL after receiving ACK but before communicating its schedule
closes the pipe; the independent cap still releases input within two seconds.
That killed parent has no release-child wait receipt, explicitly retained as
missing. A separate deliberate pipe-EOF control retains the same fallback.

The LBreakout phase adapter derives an immutable cutoff 150 seconds before
the launch deadline and makes Quit phase irreversible. It checks before the
shared pulse arms, checks again before every guarded input, and clips gameplay
guard expiry to the cutoff. Quit choices require a fresh review bound to an
ordinary Escape/Y/submenu/main-menu route. Five reserve checks pass, including
cutoff crossing before an edge, irreversible Quit, expiry clipping and restart
refusal. No gameplay occurred after the cutoff or after entering Quit phase.

The actual `test/run.js` HTTP endpoint, renderer DOWN/UP and independent release
child also pass **seven** regressions using isolated Solitaire. The unchanged
120 ms slow-durability case has **0.811 ms ACK / 138 ms physical hold**. These
checks cover actual parent KILL before schedule, pipe EOF, ordinary finite
pulse, true late ACK, dropped ACK/UNKNOWN and a synchronous server blocking
physical release beyond two seconds. The latter remains a failure, regardless
of when the child requests UP. Test-only preload/renderer observers inject
these endpoint faults; no preload, observer, relay or delay runs in LBreakout.

Final validation passes **29** adjacent controller tests, **6** terminal tests,
the **3** new library-endpoint persistence tests, **7** actual CLI endpoint
tests, **5** reserve checks, four production guard/owner/transport/SDL test
files, four additional durable-wait controls and the full heavy/build-locked
build. Initial terminal-test failures are retained: an intent existed before
its nonce was registered, so the new consumption poll queried too early.
Bounded polling now tolerates only that positively unregistered nonce. The
failed fixtures' independent watchdogs completed their native/supervisor
waits; their missing test-parent wait receipts are explicitly preserved in
`initial-terminal-failure.json`. They are not promoted as passing cases.

The sole original starts at **18:23:52 UTC**, after the already active Forsaken
validation and reserved LM8's actual outer wait. Registered `lbreakout2_251`
uses unchanged original **220 client files / 219 companion mappings**, authentic
CRT, 800×600 host screen, real ticks and default 1000-block cooperative slices.
PID **3794708**, start token **272784169**, exclusively owns production listener
**8549**. The independent 920-second watchdog is observable before native
launch; the runtime remains fixed at 900 seconds, without extension.

Fresh Local Game explicitly reports no game to resume. Resume is never
activated. Reviewed Start Original Set opens **Late At Night (1/25)** with
score 0 and an attached ball. Separate Right inputs move the paddle; separate
Space inputs detach the ball. Native P produces a personally reviewed Pause
overlay and another P resumes. Four consumed serves are followed by lost lives,
darkened bottom rectangles and score 0. No successful live-ball correction or
removed brick is established. This is the precise bounded progress limitation;
no causal SDL, physics, score or guest defect is proved from it.

There are **19 consumed actions**, **7 positively unsent** stale-review intents,
unique nonces, one permanent owner and **no UNKNOWN/replay/rebind/restart**.
Every consumed action has actual release-child wait 0 with separate EOFs and
postrelease progress, except the final choice which instead awaits native exit.
All four serve scenes are **2.944–4.302 seconds** old at consumption. The two
paddle scenes are 4.842 and 3.408 seconds old. A native P inspection uses a
12.895-second scene, so this is not a claim that every gameplay choice met the
preferred five-second aim window. All scenes remain within the enforced
applicable window. Measured ACKs are at most **2.925 ms**; consumption-to-UP
completion is at most **472.965 ms**, including the 450 ms paddle pulse.

Quit phase begins **389.840 seconds before the deadline**. Separately reviewed
Escape → actual Quit Game prompt → Y → settled Local Game submenu → Escape →
two reviewed Up choices → actual main-menu Quit → Enter yields **`[Exit] code=0`**.
Final UP is genuinely acknowledged before native exit. Native, watchdog,
supervisor, outer-child and additional outer waits are all actual **0** with
separate stdout/stderr EOF. The short launcher also has an actual child wait
and separate EOFs; the external invoking tool reports 0 with combined output,
so its separate EOF status remains **unknown**. The watchdog is unfired,
heavy lock released, all 24 recorded runtime/release PIDs absent and port 8549
closed. This is neither timeout nor host SIGTERM shutdown.

Launch, immediate postflight and final checks match **332 runtime/helper/test
pins**, **222 media/manifest/CRT pins** and module SHA256
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
Tested Git source is recorded in `source-pins.json`, with relevant binary Git
patches for dirty/new files. Git and the patches preserve source; no source
tree, module or media copy is archived. Eleven named full PNGs are personally
reviewed and CRC/inflate/SHA verified. Other observations are removed with
compact hash/selection metadata. No autoplay, tracking, solver delivery,
guest/config/media/clock/physics/score write, new original or public deployment
is used. Full27 remains unproved.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **not
applicable**. No box, network fetch, dependency installation or worker was
created. The remaining work is genuine sustained brick/score progress; this
worker stops after publishing this tested fix and bounded native-Quit result.
