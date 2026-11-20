# Warcraft III producer scheduling investigation, 20 November 2026

Run `scratch/runs/20261120-warcraft3-producer-observation-scheduling-cause`
did **not** establish or repair the post-DOWN freshness cause. No production
source changed. Single Player, Prologue, Thrall movement, objectives and normal
Quit remain unproved. Do not use this run as scheduling qualification.

The preceding authentic-keyboard run established S from the original
MainMenu.fdf and recorded applied DOWN followed by fresh=false at 253 ms,
with fourteen other predicates true. Its status trace also held presentation
sequence 113 throughout the pending interval. That observation alone cannot
distinguish delayed callback delivery from a producer blocked elsewhere.

The bridge and adapter were read alongside the actual pinned guest-rpc,
guest-worker and guest-thread-host paths. The adapter polls status after socket
publication with a 5 ms delay between replies. The Worker sends check_input
context synchronously; native-message-wait samples carry their producer clocks
and endpoint identity asynchronously. Neither path justifies refreshing cached
timestamps or weakening freshness. No proposed asynchronous status change was
installed: callback starvation remained a hypothesis.

A first setup scope stopped before any browser or endpoint request. Its
inherited board watcher incorrectly began at recipe preparation and included a
shared disk-floor sample preceding launch. The run-local watcher was corrected
to the actual process-launch timestamp for a separate scope, original2. The
first scope stayed closed. Existing live filesystem checks were retained.

Original2 loaded the original with both CPU/render modules SHA-256
`10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564`
and CRT `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`,
software GL GPS and a private 800 by 600 display. Whole host-consent pixels
were personally reviewed. The prearmed independent trusted host UP returned.
No guest gesture was prepared or dispatched.

The author's run-local passive diagnostic wrapper was faulty: after calling
the original dequeued callback, it tried to JSON-serialize the renderer event,
whose references include a circular wine/process object. At 16:07:41.163 UTC
the real check_input import reported that diagnostic TypeError. The guest
stopped. Native bootstrap then observed running=false/stopped=true and closed
at .281. This is an author instrumentation failure, **not** evidence of the
requested production scheduling defect. There were 73 ordinary requests and
zero after closure. No replay, later endpoint inspection, or S/hold retry ran.

The retained startup-only scalar trace shows USER observations separated by
539, 950, 544, 799 and 1796 ms, while its page heartbeat continued. This is
limited to startup before binding; it does not identify the previous post-DOWN
cause. Console records were capped at 4000 characters, truncating timing tails;
`trace-prefix-analysis.json` explicitly retains only complete scalar prefixes.

All 31 existing focused checks passed and 36 historical media/module/native
proof references were hash checked before browser creation. No unchanged
fixture calibration was repeated. Three run-local offline controls reproduce
the diagnostic circular-event failure and verify its corrected scalar-only,
exception-isolated wrapper, including logger failure, original exception
identity and heartbeat cleanup. That corrected wrapper was **not** executed
against the original and is not a production fix. The initial offline syntax
and close-logger failures are retained with the final passing log.

Both scopes are permanently closed. All 19 supervised original2 processes and
the setup process are nonlive; browser/display/host-helper actual waits and EOF
are retained. Independent finite runtime/cleanup limits were 245/260 seconds.
No test box was created. No Python, Wine, workers or deployment was used.
The inherited shared bridge WIP and frozen Hex baseline remain unchanged.
Only this note is committed; no production change warrants a new full build.
Recovery, exact Git/diffs, source hashes, media references and final result.json
record these limits. A future scheduling repair still needs a nonintrusive
actual post-DOWN trace, a named production cause, old-fail/new-pass controls,
and affected-original verification; this attempt supplies none of that credit.
