# Disciples II: first ordinary combat, 2026-11-07

**Reviewed first combat and a deliberate attack consequence are evidenced.**
Run: `scratch/runs/20261107-disciples2-first-combat/`.
Prior accepted browser movement (`609351224`) remains accepted; this run adds
combat rather than repairing the historical menu, mouse high-bit or logger work.
No production code, engine, backend or game media was changed.

The registered direct route used the original installation and manifest:
Timmoria → Undead Hordes → default Warrior Lord/Average → day 1. Enter cleared
income and accepted the displayed default Huunreh. Five story panels were
personally reviewed before their individual Enter confirmations. Tab selected
the leader with Move 20/20. A plotted and confirmed eastward path displaced him
from the capital, recentered the camera and changed Move to 16/20.

A nearby dark object produced a red route but no movement or encounter after
confirmation and a separate settle capture. Its identity remains unknown. A
new route toward the visible pale creature northeast produced blue then red
flags. Confirmation moved the leader northeast. `northeast-movement.png`
caught the approach with Move 0/20; battle appeared before the next capture.
The intended sidebar day-control click crossed that transition. It must not be
represented as an accepted end-day action or as a deliberate battle action.
Document/owner binding does not prevent a running scene changing between capture
and dispatch. No observed health loss or kill preceded the deliberate attack.

`battle-before.png` was then captured and personally inspected before choosing
an actual attack. It shows Huunreh at **150/150 HP**, opponents with roster
**40/40, 65/65, 40/40**, and Huunreh's active ring. One ordinary trusted click
on the visible upper-right club-bearing opponent produced the attack animation.
`battle-action-after.png` shows that opponent's portrait replaced by a skull
and **0/40**, reducing the living opposing roster from three to two; the current
unit text changed to Peasant. The input-free `battle-action-settled.png` shows
**Huunreh 123/150 HP**, the dead opponent still **0/40**, the other opponents
**65/65 and 40/40**, and Huunreh active again. Thus a full action/response cycle,
health loss and one defeated unit are visible. The battle was not completed;
no victory, reward, campaign completion, FPS, audio or cross-device parity claim.

## Runtime and helper evidence

Tested source commit: `c04cc7024910f91746a88d423d5b4ccb61abcea7`.
`runtime-pins.json`, `relevant-source.patch`, `new-files.patch` and
`final-run-inputs.patch` record exact source and run-local helper changes;
Git remains the source archive. All **763** staged pins matched remotely before
launch and after browser completion. All **127** support files plus the
executable and manifest matched the retained expected hashes before launch.
Original EXE SHA-256:
`adba242a0a3563651baffa6ec7d9a6c0978b7ae844a1cccedb2a1f4e8eb7b1f8`.
Actual live Worker module recovered through CDP:
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.

Chrome **151.0.7922.108**, V8 **15.1.206.16**, Linux headless Chromium,
1024×768 document, 800×600 game canvas, Threads. Actual owner: guest process
1000, main Worker slot0/endpoint1, target
`7757273DD75AE540496AFC2B7491683F`, instance
`ce6ea22c-c343-4cb0-89c3-85cc9d73cd94:1`. Document epoch
`4fe0c77d-67a3-4e03-a6a1-e785d3656172`; per-capture bindings include process,
link, Worker, module, page-renderer and canvas object tokens. The actual page
renderer is **Win98Renderer / CanvasRenderingContext2D**, with no D3D render
ports and empty D3D stats (`passive-final.json`). The WebGL selector does not
establish an accelerated backend for this DirectDraw run.

Before the original, the final run-local helper passed actual Chromium controls
for live app/module/Worker/renderer/document binding, five owner replacements
with zero admitted effects, stale and slow-capture rejection, balanced trusted
native keys, physical key-state and execution progress during a hold,
independent release under a slow sampler, partial-delivery release and sticky
UNKNOWN/late-ACK rejection. The generated fixture is explicitly synthetic,
not original gameplay. Its captures were inspected; observation timing is not
logical FPS or guest input-consumption coverage. No API logger was installed.
The attack's reviewed capture age at admission was 14.045 seconds.

Two definite pre-browser wrapper failures are retained: an incorrectly named
deadline environment variable, then an overly strict empty-directory guard
(the directory contained only an empty commands folder). Process/directory
inspection proved no browser/game had started before correction. Exactly one
heavy original browser ran; no unknown input was replayed. All 27 numbered
commands, including quit, have exact successful acknowledgments.

## Retrieval and shutdown

One UUID-idempotent fresh box: **bx_t6g4fnjr**, created 08:45:33 UTC, initial
expiry 09:20:33.766 UTC. Browser ran approximately 08:47:07–08:54:00; ordinary
Browser.close returned Chrome exit0, signal null. Final key bitmap was clear;
12 owned PIDs disappeared, both local ports refused, profile and writer lock
were absent. **314 remote artifacts, 18,977,103 bytes**, were retrieved and
SHA-256 verified before the delegated normal, nonforced stop request at
08:54:25.498. Final stopped state is retained in the run's boat-state record.
No box was resumed, no public deployment or source/media archive was made,
and local free space remained above 2 GB.

Next optional work is finishing the already demonstrated battle in a separate
authorized run, with fresh scene review across transitions. It is not needed
to establish the first-combat/action consequence recorded here.
