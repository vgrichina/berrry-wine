# Caesar III bound intent, connected roads and housing, 2026-11-17

Evidence: `scratch/runs/20261117-caesar3-bound-intent-hover-city-growth/`.

The local run caller now chooses `intent` or `hover-intent` when the scene
already has an immutable personal review. It uses `review-intent` or
`review-hover-intent` only for a newly captured scene without a review. It
checks the existing review's kind, target and image hash, and refuses reused
operation artifact names before dispatch. The correction is in the ignored
run-specific `control.py`, with its patch and zero-dispatch regression retained.
The regression covers bound review/bind/hover/press arguments, a fresh reviewed
press, printable input and operation-name reuse. The existing separate native
control proof is reused; no broad qualification or compilation was repeated.

One newly authorized original used exactly the retained c993 base graph,
1e585 source adapter/loader, d112 host imports and module
`9099bb3f694d5ec6dac2886b70c1920fa33f39ad9258b1e662d1ebe05dc2da0a`.
All retained source hashes matched before launch. All 114 media files were
verified before the native clock and remained unchanged after shutdown.
An early readiness check preceded the listening socket and refused before
dispatch; subsequent checks waited for the ordinary native USER poll.

The actual original exercised the corrected bound-scene `hover-intent`, then
fresh reviewed presses, without duplicating a review. Normal title, New Game,
name C, Assignment 1 and city entry completed. Twenty-two finite actions
completed with native USER-return receipts, independently joined release and
the unchanged 500/1750/3000 ms limits. Receipt success alone is not a city effect.

Personally reviewed whole scenes show the following actual city changes:

- Initial Aventine city: Dn 2000, population 0, January 500 BC.
- Two new road tiles form a connected northwest spur from the existing entry
  road; funds fell to Dn 1992. The retained `roadtilefresh3.png` shows the first
  spur and valid green preview for the second tile. The later housing scenes
  show the completed connected spur. The initially planned half-step overlapped
  the first road tile, so it was not pressed; the full visible grid step was used.
- Two housing plots were placed beside the spur for 10 Dn each. Funds reached
  Dn 1972. A lot sign and the red preview over the second placed plot are visible
  in `homesettled2.png` / `homeresult2.png`; these are empty housing plots,
  not occupied dwellings. Time advanced normally to February 500 BC.

Population remained 0. Immigrants, occupied dwellings, growth, food/services,
Save and native Quit are unproved.

The next separate housing hover, `arrive-home3`, became terminal UNKNOWN.
Its scene age was 11289 ms, within the unchanged 15-second game guard.
MOVE object 45 entered the host queue at approximately 227.6 ms and remained
there until deadline purge at 502.6 ms. The next observed renderer poll was
594.2 ms after intent. The receipt was CANCELLED, consumed false, with no
native message. This establishes a host-queue expiry for this MOVE, not a
native consumption, callback failure or demonstrated product defect.
The independent release completed at 1466.9 ms. No HTTP request followed
permanent UNKNOWN; the shell's already scheduled capture was refused by the
local guard before HTTP. There was no replay, rebind or second original.

The native process shut down promptly through host cancellation. Native,
outer, persistent-owner and watchdog waits have both EOFs; the runtime scope
is empty, known runtime PIDs are absent and the listening port is gone.
Host cleanup is not native Quit. No box was created: ID/expiry null,
state NOT_CREATED, stop receipt NOT_APPLICABLE.

No production code changed, no product fix is claimed and no new canonical
build was run. Git pins, relevant foreign-WIP exclusion patches, caller input
patches, selected named whole screenshots and artifact hashes are retained.
Foreign files were preserved. The remaining blocker is the immutable native
MOVE deadline on the closed sole original. Any further original needs renewed
authorization; a targeted investigation can use the retained actual trace.
