# Dungeon Keeper measured recenter acquisition, 7 November 2026

The fresh original reached personally reviewed **Main Menu**. Acquisition is
blocked by a demonstrated timing mismatch in this guarded test path: its
guest warps were **533.99, 511.22 and 520.675 ms apart**, whereas production
automatic selection requires matching warps **strictly less than 500 ms
apart**. Each warp therefore reset to run 1. Automatic intent stayed false;
the command correctly sent **no acquisition DOWN** and closed its lane.
Pointer Lock, Start New Game, Eversmile and a visible dig/build action remain
unproven. This is a harness acquisition blocker, not a demonstrated emulator
cursor defect or a Pointer Lock rejection.

Evidence: `scratch/runs/20261107-dungeon-keeper-recenter-acquisition/`.
Predecessors read: corrected original `4a95f08d4`, capture gesture
`ee103ca06`, anchor conversion `9a0975685`, and the cursor commit path in
`dungeon-keeper-demo.md`. No accepted matrix was repeated.

## Exact path and local closure

The retained native driver, observer and numbered transport were derived into
small run-specific inputs. The driver still uses the corrected trusted
MouseEvent anchor conversion and unchanged
`tools/dungeon-keeper-native-motion.cjs`. The new `acquire.cjs` executes at most
four one-step calls through that helper, observes the actual production
selector and recenter state after each successful call, and stops sending
motion as soon as intent is true. Only a live run >=3 with an unexpired window
allows an ordinary trusted mouse DOWN/UP. It never directly requests capture.
UP uses the retained pulse, armed independently before DOWN. Refusals and
UNKNOWN outcomes close the outer driver/transport; no lane is reopened.

All existing owner/module/window/epoch/freshness gates, exact native anchor,
automatic profile, and identity comparisons remain. Observer installation
and observations compare all 22 identity fields before and after, including
executing module bytes. Acquisition adds another full live identity read
between successive helper admissions. No forced profile/capture, anchor
reset, guest write, private input handler, clock/config change or UNKNOWN
command replay occurred.

One actual local production `dx_ddex4` fixture qualified the exact derived
driver and observer with ordinary trusted native input. I personally viewed
its startup, gesture and motion PNGs: three red sprites over a blue
checkerboard. The neutral gesture and four `(2,0)` steps reached the normal
consumer at guest X321,323,325,327/Y52, receiving exact numbered ACKs 0 and 1.
The no-intent acquisition control then sent three guarded one-step motions,
with step ACK gaps 466 and 468 ms, but no DOWN. Its expected missing-window
failure closed command 2. Chrome exited zero, inputs released, queue empty,
browser/server PIDs absent, ports closed and profile/writer lock removed.
An initial background shell launch produced no fixture/browser evidence;
the subsequent retained foreground execution supplied this local closure.

`test-acquire.cjs` separately runs the production selector with the retained
motion helper and pulse in an offline model. Three matching warps stop the
fourth move and admit ordinary DOWN/UP. Absent/expired intent, a helper refusal
and an unknown dispatch all prevent DOWN. This positive model supplies no
actual browser Pointer Lock evidence. The actual local fixture never armed
capture intent. Its sub-500 ms timings did not predict the original's timing.

## One original and reviewed consequences

A separate watchdog process was explicitly delegated before allocation, with
a 25-minute cap. One persisted UUID Idempotency-Key POST created
`bx_xxzdzgs4`. No old box was resumed, no allocation POST was repeated, and
no other original ran. The registered `dungeon_keeper_demo` route retained
automatic capture selection. All **650** runtime pins were hashed/length
checked locally before allocation and remotely after execution.

I personally reviewed the immutable owner captures before each input command:

- `review/startup.png`: red rotating intro. Ordinary Escape DOWN/UP, ACK 0,
  led to `review/menu.png`, Main Menu.
- `review/menu.png`: Main Menu with Start New Game, Continue Game, Load Game,
  Multiplayer, Options, High Score Table and Quit. A neutral upper-title
  gesture at normalized `(0.5,0.11)`, ACK 1, established the trusted anchor.
- `review/anchor.png`: dim Main Menu, the same rows. This was the reviewed
  scene for the single bounded acquisition preparation, command 2.

The neutral-gesture review text mistakenly called Multiplayer “1 Player”.
The acquisition review explicitly corrects it; the original record is
preserved. No menu entry or gameplay success was inferred from that text.

The full-identity passive reads retain an actual software-cursor consequence:
before Escape/gesture, software cursor `(320,240)` and last native `(0,0)`;
after the neutral gesture, software cursor **`(639,292)`** and last native
**`(320,52)`**, relative-mode flag 1. Thus this original did not reproduce a
universally immobile software cursor. The result is consistent with the
documented delta-from-last-position commit and clamping, but no API/commit
trace establishes that causal interpretation here. Divergence alone is not
an emulator defect. Useful continuous steering remains unproven.

Acquisition command 2 completed four successful one-step helper calls. Native
CSS Y values were 242,238,234,230 at X352; consumed guest positions were
`(320,48)`, `(320,44)`, `(320,40)`, `(320,36)`, with warp serials 0,1,2,3.
The four post-step observations recorded center warps `(320,240)` at
performance timestamps 54732.690,55266.680,55777.900,56298.575 ms, each run 1.
Every selector result was false; no recenter deadline was armed. Repeated
full admission plus full observation between one-step calls consumed the
available 500 ms interval. The recorded predicate explains the reset without
assuming a browser capture failure or semaphore starvation.

At 15:46:16.989Z the bounded command failed
`measured automatic recenter window absent; no DOWN`. Exact successful
outer ACKs are 0 and 1; command 2 has no ACK and became sticky UNKNOWN.
All four move ACKs are retained inside its acquisition receipt. No additional
motion, gesture or input was attempted. The acquisition DOWN was never sent.
The installed observer recorded no Pointer Lock request/change/error before
the acquisition command; its final rows after that command were not recovered
before browser closure. Actual lock is absent in every acquisition observation
and terminal input state. No request/rejection is claimed from missing rows.
Final software cursor after these four moves is **unknown**, because failure
closed the browser before another full cursor observation/capture. Queue
consumption is not substituted for that missing consequence. There is no
post-acquisition screenshot and no qualified locked steering.

## Executable next diagnostic

```sh
node scratch/runs/20261107-dungeon-keeper-recenter-acquisition/next-timing-diagnostic.cjs
```

This offline diagnostic passed. It checks the production threshold predicate,
reconstructs the four run-1 resets from the immutable observations, checks
consumed points, no DOWN, exact failure number, missing ACK 2 and sticky
transport closure. It opens no browser, changes no clock and replays no native
command. Its JSON output records the next local qualification: batch passive
selector/warp observations with a bounded retained-helper group at the edge,
preserving full owner/module reads before and after and the existing per-step
progress gates. Demonstrate all actual guest warp gaps below 500 ms, stop
without an extra move when intent changes, then observe an ordinary trusted
DOWN during true intent. That local path must qualify before another original.
This archived box and command 2 cannot be reused.

No concrete emulator cause was demonstrated, so there is no production fix,
fail-before/pass-after emulator regression or new build claim. The mandatory
locked-build requirement would apply to a justified code repair. The prior
anchor correction's built module remains the executing module here.

## Recovery, checks and lifecycle closure

Source SHA: `ecf85c4d92346f277f02d7142be3d3ef0b0f394a`.
Executing page/guest WASM, recovered through CDP:
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
2,182,493 bytes. Browser: Chrome 151.0.7922.108 / V8 15.1.206.16.
`source.json`, `runtime-pins.json`, relevant tracked/new binary patches and
`owned-inputs.patch` supply recovery. All 168 existing media paths have
length/SHA references in `mediarefs.json`; no source/media archive was made.

Focused acquisition controls, syntax, timing reproduction, exact ACK/pulse
assertions, own evidence custody/hashes and whitespace checks passed. The
global evidence checker still reports unrelated Alice/Tunnel-Twist containment
errors and historical missing files. This app has no candidate-manifest run
registration; evidence remains in this investigation note.

All **64** retrieved unique artifacts, **3,015,475 bytes**, match remote length
and SHA. Chrome exited zero; browser/server PIDs 6342/6349 are absent; ports
40415/39623 closed; profile/writer lock absent; no matching runtime processes,
held input or queued input remain. Local fixture resources, own board watcher
and delegated lifecycle process ended. Closing the pages destroyed observers.
Sampled free /home remained above 2 GB.

Initial box expiry was **16:24:30.419Z**; browser deadline was 24 minutes after
allocation, inside the delegated 25-minute cap. After verified retrieval,
normal stop **`stop_b1829bbee455cd99`** completed **15:46:34.372Z**,
forced=false, error null. Box **`bx_xxzdzgs4` is archived**, stoppedAt
15:46:34.346Z. Current archiveAfter is null; retained-data expiry is unknown.
Shutdown was explicitly delegated by this task; no assigned running box
remains. No MW3 or graphics-worker path was modified.
