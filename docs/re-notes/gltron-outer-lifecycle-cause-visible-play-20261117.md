# GLTron outer lifecycle repair, 2026-11-17

Evidence: `scratch/runs/20261117-gltron-outer-lifecycle-cause-visible-play/result.json`.

The former outer exit 143 was an actual SIGTERM, not normal shutdown. A faithful
run of the predecessor outer wrapper under strace records `SI_USER`, sender
PID 467945 (the live parent Codex process), before the native child subsequently
returns 0 with both pipe EOFs. The retained trace, outer timestamps and native
wait remain separate evidence. No native deadline had expired.

Linux's inherited `PR_SET_PDEATHSIG=SIGTERM` is tied to the particular thread
that created a subprocess. A transient command-spawning thread can retire while
the parent process remains alive. The kernel reports the parent's process ID
as the signal sender. Controlled actual thread retirement reproduces this:
the unchanged policy dies by signal 15; the repaired supervisor finishes 0,
with that thread gone and the parent process alive. A separate control kills
the actual parent process: the repaired supervisor detects its pidfd, requests
termination, waits for its native child and both EOFs, and returns 143.
The historical failing wrapper did not retain its spawning TID. Its trace
proves the sender process but cannot by itself distinguish this kernel
notification from a userspace kill by the same parent. The thread mechanism is
causally demonstrated by the controlled before/after tests; no historical
parent kill syscall or particular retired historical TID is invented.

`tools/gltron-current-supervise.py` replaces only that unsafe inherited policy
with a pinned parent-process pidfd, armed before clearing the thread policy.
It preserves the existing Boids supervisor's signal handlers, independent
preparation/runtime deadlines, acquired-child cleanup, actual waits and separate
stdout/stderr EOF observations. It rejects an unrelated inherited signal policy.
The existing supervisor is imported without editing Jazz's files.

The actual native watchdog control also exposed an environment-only cleanup
gap. Chrome removes the inherited ownership token from its environment. After
the watchdog killed the harness, Chrome could survive despite an empty token
census. Puppeteer also detaches Chrome into a new session and Chrome rewrites
its argv. The GL supervisor pins the actual direct native Chrome child by
kernel parent relation, exact executable and unique run profile before any
signal, then records its exclusive browser session. Both the
supervisor and independently armed watchdog pin and verify each process before
signalling it. They never broadcast a process-group signal. Same-session foreign
pipe holders and unrelated sibling processes remain outside this browser scope.
An empty final census is recorded as absence, never as an actual child wait.
The earlier exposed orphan was explicitly stopped and its cleanup recorded.

`test/test-gltron-outer-lifecycle.py` reuses the real OS fixture matrix rather
than copying its simulated expectations: normal/noisy completion, actual exit
143, native signal, descendant, foreign pipe, direct/repeated TERM, pending
startup, startup watchdog, exception, preparation/runtime timeout, late exit,
watchdog prearm failures, failed native spawn, capture-open failure, independent
watchdog, cleanup deadline and missing EOF. Its additional controls exercise
real spawning-thread retirement and actual parent-process death. Native checks
use the real authored x86 guest, guest Worker and render Worker, with normal,
external TERM and independent-watchdog outcomes retained separately.

`tools/gltron-current-original.cjs` observes the registered GLTron application
without input dispatch. It first supports an authored same-path GL fixture at
default clocks. The runtime is served from exact Git blobs, its module compiled
and retained before runtime clocks, and actual Worker module bytecode checked.
Original operation requires every relevant helper to match the published Git
revision. The full registered recursive game directory and normal registry,
configuration and media remain unchanged; media is referenced and hashed.

Each selected observation retains complete source, output and host images
under one 3,000 ms deadline. It joins the public initialized GL producer receipt
and current-display ticket without forcing idle, flush, repaint or render.
UNKNOWN permanently closes transport. Human-reviewed local observation intents
permit finite further natural-progress observations; they cannot send inputs.
Host stop is explicitly distinguished from native Quit.

The legacy browser input controller still admits CDP acknowledgements as delivery
and uses a 2,000 ms release assertion. Its legacy GL endpoint binding also does
not establish current GPS ownership. Those paths do not satisfy this task's
native API-return/500 ms confirmation and 1,750 ms physical release requirements.
Published raw Get/Peek actor proof is valid independently of BUTTON, but is not
substituted for an end-to-end browser/native input qualification. Accordingly
this observer can pursue rendered natural progress with zero DOWNs, and cannot
claim two input turns or native Quit. The result records the exact final visible
boundary and publication hashes; successful fixture pixels are not gameplay.

No boxes, workers or deployment are created. Git plus recorded binary patches
is the source archive; tested modules and only result-named selected images are
retained as evidence.

## Published boundary

Repair publication `5df4bcb0f9ed85dc970421e025a1470b5f1b1ebf` passed the
canonical build and focused lifecycle controls. The default-clock candidate
observation completed in 935 ms, with zero literal source/output mismatches and
actual guest/render Worker module inheritance. Its complete images were
personally inspected. This candidate success is not substituted for the later
published check.

The exact published check retained module
`f1dd81b43b94bdab0783e0de2a4616d7b19bb0dd7165c43b295b3068b763e831`
before execution and confirmed both actual Worker modules. Its complete capture
hit permanent `DISPLAY_UNKNOWN` at the unchanged 3,000 ms deadline. No complete
fresh capture was saved, and the helper does not retain enough intermediate
capture phases to attribute this timeout to ticket service versus host pixels.
There were no later endpoint queries, rebinds or replay. The native harness
returned 1, both watchdogs returned 0, all three had actual waits and both EOFs,
and the browser had actual wait 0 with both EOFs. The parent remained alive and
no owned live processes remained. This was a capture refusal, not outer SIGTERM.

No original GLTron invocation or input was attempted. The single original
allowance remains unused. Two visible turns, round outcome and native Quit are
unproved. The next work is causal localization of the bounded complete-capture
timeout on a fresh authored endpoint; unchanged qualification is not repeated.
