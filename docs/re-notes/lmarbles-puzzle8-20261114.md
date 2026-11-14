# Original Puzzle8 gameplay and ordinary Quit

Run evidence: `scratch/runs/20261114-lmarbles-puzzle8/`.
This task follows published SDL/modal repair `a56ebeec0` and the predecessor's
Puzzle7 clear, tally1750 and settled Puzzle8 Moves96. The predecessor's reversed
Puzzle7 target transcription is not reused.

The original `levels/Original` eighth level is read without modification.
Its target has six marble ID5 pieces and three movable gray ID0 pieces.
The map includes green left and down arrows, at zero-based (4,10) and (11,9).
Only one translated target fits the playable geometry. A separate offline model
checks both arrow redirection and the opposing-direction barrier behavior.
Solver output is advisory text only; it has no runtime or input connection.

Before launch, the exact reused production controller passed fresh 500ms mouse,
500ms key, and stale-review refusal fixtures against the actual production
transport and guard. The actual consumed edge followed independent release arm;
release timing and post-release batch progress were checked. The reused durable
supervisor passed normal exit, TERM to its persistent wait owner, and invoking
process loss, with actual native/watchdog/supervisor/additional outer waits and
separate stdout/stderr EOF.

The sole original ran 17:21:06–17:41:06 UTC after SuperTux and Forsaken, with a
fixed 1200-second native limit and independent prearmed 1220-second watchdog.
It used Normal/Original/Michael, real ticks, actual guest Workers1+2, unchanged
87 media files and the 86-entry SHA-pinned manifest. The exact launch source
commit was `be03ff8276e52fd1b32c6531adf3da716dea4246`; relevant dirty source is
recorded in Git patches. Module SHA-256 was
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
Postflight found no source/media drift and the module still matched.

The native eighth-level confirmation was viewed, accepted, and followed by a
fully settled board matching the original eighth-level geometry, asymmetric
target, nine marbles, two arrows and Moves96. Score began at zero; no previous
score, save, state or progress was imported. The first board press unexpectedly
reopened the eighth-level selector confirmation: SDL coordinates matched the
press, but the game's lastMotion still held the earlier selector position.
This does not reproduce a successful first direct selection from `a56ebeec0`.
Native N canceled the prompt; a fresh personally reviewed selection at a new
coordinate then worked. No runtime source fix or speculative attribution was
made, and there was no UNKNOWN replay or owner rebind.

Fifty-one individually chosen and reviewed slides settled, reducing Moves96
to Moves45. Gray marbles moved and both arrows affected the route. Long slides
24 and 29 required additional settled captures before proceeding. The final
scene shows six blue marbles at (5,8), (6,8), (7,8), (5,9), (6,10), (11,10),
and gray marbles at (6,9), (7,9), (8,9), with the latter selected. The offline
62-slide suggestion was independently replayed against the corrected original
geometry; its remaining eleven slides are suggestions, not native evidence.

The worker failed to stop gameplay for the required 150-second Quit reserve.
The last selection was captured at 17:39:12, with only about 114 seconds left.
After context recovery, a read-only capture attempt was refused by the immutable
deadline; no further input was sent. The native log explicitly records
`[max-seconds] stopping after 1200s`, with statistics at 1199.997 seconds.
**Puzzle8 clear, tally, Puzzle9 and actual native Quit were not achieved.**
Exit code zero is harness timeout termination, not evidence of ordinary Quit.
Full27 remains unproved. No second original was launched.

Both full heavy/build-locked builds and the focused production guard, owner and
SDL tests passed. Exact helper closure fixtures covered mouse/key release,
stale refusal and post-release progress; durable lifecycle fixtures covered
normal, owner TERM and invoker loss. A recovered exact supervisor also passed
the 40ms final-key fixture. One earlier verifier mode returned a legacy
85-entry manifest without hashes; it was corrected before launch to the accepted
86-entry SHA closure, preserving the failed preflight. The 86 actual actions
passed the audit of unique nonces, <=30-second capture/review ages, independent
prearmed UP and bounded release timing. No autoplay or runtime solver input
was used.

Native, watchdog, supervisor child and outer waits are actual waits with separate
stdout/stderr EOF; all returned zero. The watchdog did not fire, the heavy lock
was released and control port 8488 closed. The invoking tool returned zero, but
a separate tool stdout/stderr EOF receipt was not recorded and remains unknown.
Ten selected PNGs passed CRC, inflate and SHA checks; intermediate image series
were removed. Compact native logs, action records, source/media hashes and
roundtrip-checked operational Git patches remain in the run directory.
No box was created: box ID null, state NOT_CREATED, expiry null, stop receipt N/A.

Next work requires a newly authorized original run. It should enforce the Quit
reserve before any further slide and investigate the first-press stale native
lastMotion behavior. This task stops with verified Puzzle8 progress and the
timeout/ordinary-Quit distinction preserved.
