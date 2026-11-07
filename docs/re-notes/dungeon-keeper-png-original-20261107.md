# Dungeon Keeper original PNG runtime, 7 November 2026

PNG staging and actual Canvas2D presentation now work on the original demo.
I reviewed the intro and authentic Main Menu. The first gameplay blocker is
**native menu input does not move the game's software cursor to Start New Game**:
the acknowledged click leaves the menu unchanged. No dungeon, digging, building,
persistent consequence, FPS, audio or parity was demonstrated.

Evidence is in `scratch/runs/20261107-dungeon-keeper-png-original/`.
Published/released prerequisites `c790ca544` and `7f4486b53` preceded allocation.
The retained original driver imports the accepted Canvas2D binding and uses
the unchanged registered `dungeon_keeper_demo` route. The fresh base manifest
was augmented with the retained `stage.cjs` complete pngjs closure before
upload: **644 files**, including the staging verifier. Every SHA/length was
checked before transfer and remotely; isolated `stage.cjs --verify` passed
before Chrome. No sample adaptations or accepted fixture matrices ran.

I personally reviewed these fresh owner-scoped immutable captures:

- `review/startup.png`: red circular intro vortex on black.
- `review/after-intro.png`: Main Menu with Start New Game, Continue Game,
  Load Game, Multiplayer, Options, High Score Table and Quit; imp cursor near
  Multiplayer. Ordinary Escape successfully reached this menu.
- `review/after-start-new.png` and `review/after-menu-enter.png`: the same
  menu and imp position after the click and Enter respectively. All three
  menu captures have SHA-256
  `f1cd5f82862e641363e1af66a55a3d7b444827b3b6878f5d8465b3e13464a88d`.

Command 1 clicked the reviewed Start New Game location at normalized
`(0.5,0.265)`. Trusted Chromium movement/DOWN/UP events were recorded; both
input ACKs succeeded, with UP independently armed before DOWN and attempted
101 ms later. Renderer coordinates became `(320,127)`, buttons returned to
zero, and the queue drained. The screenshot at **14:30:25.606Z** remained
unchanged. Command 2's ordinary Enter also completed with balanced trusted
events and no menu transition. Commands 0–3 have exact numbered ACKs; command
3 closed the browser. No input outcome was UNKNOWN and none was replayed.

The passive owner-checked snapshot at **14:31:26.340Z** in
`recovered/passive-cursor.json` reads the original game's documented variables:
software cursor `(320,240)`, last mouse position `(320,127)`, relative-mode
flag `1`. Both guest threads were active and natural publication advanced.
Thus this is a specific game-cursor versus native-position mismatch, not a
capture failure or an assertion that the guest crashed. The existing
`dungeon-keeper-demo.md` documents dropped single-position moves and continuous
small-motion steering. That is a plausible explanation here; semaphore timing
was not instrumented, so the exact internal drop cause remains unproven.
No handler, guest memory, clock, installed asset or configuration was edited.

Staging records main source SHA
`0c71c5a625fad675e61ddda0942616a9fe6aa7fd`, relevant binary patches and
run-helper recovery patches. Relevant retained source/media pins showed zero
drift, and all **168 media/support pins** and all **644 deployed pins** remained
unchanged. Media stays at its existing paths with SHA/length references.
Chrome 151.0.7922.108 executed page and guest module SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
recovered from CDP. This identifies the executing module without claiming a
fresh build. The actual backend was page-owned Win98Renderer/Canvas2D,
process 1000, HWND 98305, with no D3D endpoint. Strict 22-field continuity,
publication, immutable-hash review, freshness and sticky failure gates stayed
intact. Source recovery uses Git and patches; no source/media archive is retained.

One UUID-idempotent POST created **bx_6g45252h**. The immutable runtime deadline
was **14:54:38.631Z**, fixed at 14:29:38.631Z. Chrome exited normally at
14:31:35.655Z, code 0. Initial custody validation failed before preserving its
individual predicate values; a subsequent passive observation and completed
inventory verified both owned PIDs absent, no matching live processes, both
ports closed, profile/writer absent and held input empty. No runtime or input
was restarted. SHA/length recovery verifies **68 artifact paths / 3,210,537
bytes**, including captures, logs, module and passive observation.

Under the explicit shutdown delegation, normal stop followed recovery at
14:32:37.118Z. Final state is **ARCHIVED**, stop completed at
14:32:37.505Z, `forced: false`, current expiry none; original running expiry
was **15:09:15.538Z**. No old box was touched and no lifecycle ownership remains.
The one-second local monitor observed minimum free disk **2,775,019,520 bytes**;
the remote 2 GB guard also remained active. Neither recorded a floor event.

Checks cover driver syntax, augmented deployment verification, unchanged
media/source pins, recovered SHA/length, balanced input and exact ACKs, cleanup,
owned JSON/evidence containment and documentation whitespace. No production
code changed, so no new emulator regression or build was warranted.

Next: separately qualify bounded native continuous mouse motion in the retained
driver, preserving review/identity gates and independently scheduled releases,
before another authorized original runtime. This single attempt stops at the
menu cursor blocker; gameplay success remains unclaimed.
