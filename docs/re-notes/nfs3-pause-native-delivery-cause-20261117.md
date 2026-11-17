# NFS3 Pause: pre-handler delivery boundary, 2026-11-17

No production change or new original was made. The retained NFS3 Pause remains
terminal UNKNOWN. Authored native Device2 fixtures reproduce expiry before
handler application under synchronous D3DIM rendering, but the original lacks
the ingress/render timestamps needed to establish that this caused its failure.
There is no proved NFS3-specific repair to publish, so the conditional original
allowance was not exercised. Driving/Pause/Continue/Quit verification remains open.

Evidence: `scratch/runs/20261117-nfs3-pause-native-delivery-cause/`.
This follows [the inherited-timing run](nfs3-inherited-timing-visible-driving-20261117.md),
published as `c9ff5505236c34357b59829e5185523948445ea6`. Its released
0→3→4 MPH and steering observations remain intact. Its Escape deadline was
800 ms, release-bound, and returned CANCELLED, unconsumed, handlerApplied=false.
There was no native Escape receipt. The old endpoint was never queried or replayed.

The retained original counters distinguish two render paths. Its legacy
`d3dCommands` worker had zero submissions, waits and replay commands. The
D3DIM stream had 587 kicks, 73,769 records and 567 native presents. Thus an
explanation based on the legacy Encoder's one-second Atomics.wait is unsupported.
The published `host-imports.js` routes D3DIM stream kicks through
`gpu-stream-host.js`; the local bridge synchronously drains published records.
`test/run.js` services HTTP on event-loop turns between guest batches, and the
guard refuses an expired intention before invoking the physical handler.

The fixture executes an authored x86 PE, compiled from C using existing public
Device2 fixture recipes: RGB565 primary/backbuffer, D16, indexed geometry,
Flip, PeekMessageA, and ordinary Escape handling. It uses the original's exact
published source `013d916c64632243ff0aa768debbbc39870f04d5` and module SHA-256
`cf674e8d1780249498a3b9797142d5d9f01e9daedcf2089c8fc880f515c753c0`.
The sealed in-memory inventory hash matches the original across 4,681 files;
foreign WIP was excluded. A local resolver fallback permits already pinned Git
modules whose filenames have since disappeared from the shared tree. It changes
no runtime source body. No source archive or copied media was created.

Passive host wrappers measure existing D3DIM calls without additional native
calls, waits or yields. Existing transport and public-input diagnostics locate
request dispatch, guard preparation, physical handler and native-return phases.
The same 800 ms immutable deadline and prearmed independent release apply to all
input cases. Guest clocks, runtime flags and configuration remain unchanged.

The 32-draw fixture authored Escape at 1794957637147 ms, expiring at
1794957637947. Two synchronous render spans covered the ingress interval:
1173.129 ms starting at 1794957637040, then 1072.099 ms at 1794957638236.
HTTP dispatch occurred at 1794957639314, 2167 ms after authorship and already
1367 ms after expiry. Guard preparation immediately cancelled it without a
physical handler or native DOWN. The independent release completed; no game
query or replay followed terminal UNKNOWN. A second authored 32-draw case
reproduced pre-handler expiry and separately observed Escape=0, Up=0 and an
empty queue during the prearmed release, without an extra endpoint query.

A one-draw control consumed the exact native WM_KEYDOWN Escape through
PeekMessageA within 71 ms of authorship. The guest's own handler changed its
caption to `AUTHORED PAUSED Escape delivered`, inspected in the selected whole
PNG. A separate passive release observation recorded Escape=0, Up=0 and an
empty queue. Receipt, native application, visible caption and physical UP are
separate evidence. The whole image is grey with the authored caption; it is not
a raster-geometry oracle or evidence of game driving. This fixture proves its
own Pause only, not original Pause/Continue/Quit.

Preparation failures are retained honestly: the first uncached source launch
hit a desktop-helper startup timeout before input; restoring the inherited
sealed memfd cache resolved preparation. A 256-draw fixture measured 11–14 s
synchronous kicks but exceeded its readiness observation bound, so sent no
input. Neither is an original-game failure or a successful input test.

Focused guard/native-boundary and main/worker event-scope regressions pass.
There is no production edit, so no new canonical build is claimed; the exact
previously built module was reused. All 135 retained media pins were rehashed
unchanged. Native children, independent release helpers, supervisors and
watchdogs were actually waited with both pipe EOFs, including expected fixture
failure paths. Own shutdown was SIGTERM, not native Quit. No watchdog fired.
No box, worker, deployment, source/media archive or frame series was created.
Box ID null, state NOT_CREATED, expiry null, stop receipt N/A.

The concrete remaining boundary is original authorship→server ingress→guard
application. Its retained receipt cannot divide that interval into transport,
scheduling and rendering time. The authored reproduction establishes a causal
mechanism on the affected public path, not its occurrence in the original.
Changing timeouts or the guard would hide the boundary; a speculative scheduler
or render change would not meet the task's proved-cause requirement. Stop with
this evidence and keep the original allowance unused.
