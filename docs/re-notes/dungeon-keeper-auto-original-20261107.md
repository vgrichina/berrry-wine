# Dungeon Keeper original automatic capture recovery, 7 November 2026

Recovered the interrupted original worker without reusing its session or
launching another game. The original reached the main menu, then credits.
Eversmile, useful continuous cursor steering, digging and building remain
unproven. The first unresolved input gate is **automatic capture intent true
with Pointer Lock absent after a native anchor**. No motion command was sent;
this is an observed task prerequisite failure, not a recorded helper refusal.

Evidence remains in `scratch/runs/20261107-dungeon-keeper-auto-original/`.
I personally inspected `review/startup.png` (red rotating startup image),
`review/menu.png` (Main Menu with Start New Game and other entries), and
`review/anchored-menu.png` (credits over the menu background). The last label
does not mean the menu remained interactive. The evidence does not establish
whether the anchor caused the credits transition or encountered an idle
transition already underway.

`recovered/passive-anchor.json` establishes the actual production path:

- No explicit relativeMouse profile; unchanged automatic selection.
- At 15:04:12.936Z and 15:04:12.944Z, move/DOWN selection was false,
  capture hint false, no recorded recenter run. Native events were trusted,
  at CSS (625,626). The normal consumer received mouse (592,432), HWND 98305,
  with MOVE, hit test, DOWN and UP. This was an absolute anchor jump.
- By 15:04:14.695Z, automatic selection was true, with three guest warps to
  (320,240) and `recentringUntil=76243.76`, two seconds after the last warp
  at performance time 74243.76. Pointer Lock remained null; cached hint was
  false. That cached hint was not freshly polled because recentering wins
  first in `_autoRelativeMouse`. The guest cursor read (639,479), its last
  mouse reference (320,240), relative-mode flag 1, and renderer (320,240).

The private flag alone is not the capture evidence: the actual automatic
decision and recenter run establish it. The recorded request-time decisions
were false, so the ordinary click had no capture intent at that instant.
There is no recorded requestPointerLock call or rejection. A browser capture
failure is therefore unproven. The recenter window is transient; do not assume
it persists into a later gesture. `native-input.json` contains exactly five
events (Escape DOWN/UP and anchor MOVE/DOWN/UP), and commands 0–2 are Escape,
anchor click and quit. All received their exact numbered ACKs. Anchor UP was
armed before DOWN, attempted independently at +100 ms, and acknowledged.
No motion, fixture matrix, held retry or UNKNOWN replay occurred.

The next native step is to observe the capture transition and qualify one
ordinary trusted capture gesture before trying to steer toward Start New
Game. `next-capture-observer.cjs` prints an executable page expression for the
existing identity-qualified CDP lane. It transparently records native capture
requests/results, pointerlockchange/error, trusted DOWN/UP, and recenter/hint
state, preserving the original method return/throw and providing restoration:

```sh
node scratch/runs/20261107-dungeon-keeper-auto-original/next-capture-observer.cjs
```

This command only prints the expression. A separately authorized original
successor must install it through the existing full-identity observer lane,
retain the existing selector/consumer diagnostics, and inspect fresh immutable
owner-scoped pixels before a deliberate input. If current pixels are credits,
qualify a bounded ordinary dismissal first. Record automatic selection at the
actual trusted gesture: if intent is true, require lock and retain the precise
request/change/error sequence; stop motion if lock is absent. If intent is
false, only the already qualified bounded unlocked path applies. Do not call
requestPointerLock directly, force a profile, or reset the physical anchor.
Only after qualifying useful consumed motion should the successor steer to
Start New Game, select Eversmile and attempt a visible dig/build action.
All owner/module/freshness, exact ACK, independent UP and sticky UNKNOWN gates
remain required. This recovery authorizes no such launch or input.

The source closure is preserved by `source.json`: preflight HEAD
`b6a1ede7b0196d3f09f477dee647b5bf32e5356d`, published helper `eab99452e`,
pin-source commit `34384c0938832cc8d32a26c061b41947ad30c490`, plus
`relevant-tracked.patch` and `relevant-new.patch`. `runtime-pins.json` records
646 files; terminal remote verification found all unchanged. Existing media
are referenced by path/URL, size and SHA-256; no media/source archives were
created. The retained executing module is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Browser was Chrome 151.0.7922.108 / V8 15.1.206.16. Recovery rehashed all 61
retrieved artifacts (2,810,481 bytes), including the three PNG identity hashes.

`recovered/terminal-custody.json` confirms remote browser/server PIDs
6335/6346 absent, no matching live runtime processes, ports 38221/33487 closed,
profile and writer lock absent, inputs released, empty final queue and Chrome
exit zero. An earlier inventory raced the exiting wrapper; the later attempted
SIGTERM found `/proc/6335` absent and sent no signal. Preserve those failures
as cleanup history, not gameplay blockers. Local predecessor launcher2286097
and child2286101 were also checked absent. Recovery opened no browser, port or
profile. Sampled free disk stayed above 2 GB.

Lifecycle was explicitly delegated. Read-only GET of exact box
`bx_7bpr43pr` confirmed exact normal stop `stop_a7dd0d294c8387c3` **completed**,
`forced=false`, error null, stopped at **15:05:42.148Z**, operation ended
15:05:42.167Z, box **archived**. Original expiry/archive deadline was
15:42:07.841Z; archived GET now returns archiveAfter null. Data-retention
expiry is not exposed by the sanitized response and remains unknown.
`recovery-lifecycle-poll-1.json` preserves this result. No repeated stop,
resume, deletion or allocation occurred. Lifecycle ownership returns with the
box archived; no running box remains assigned to this worker.

This is documentation and retained diagnostic preparation only. Hash/custody
assertions, observer syntax/transparency checks and documentation whitespace
checks passed; no production code changed or build was required. The run has
no candidate-manifest registration, so evidence stays in this investigation
note rather than attaching a dashboard result to an unrelated candidate.
