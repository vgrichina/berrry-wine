# LMarbles: native run after closed-event recovery

Puzzle 2 selection, CLEAR and next/tally remain unproved. After the assigned
resource phase completed, one fresh native run reached the Tutorial board.
The first intended motion onto the actual visible Puzzle 2 selector was
refused before input at **1,498,554,368 bytes available**. This was below the
strictly-above-1,500,000,000 requirement by 1,445,633 bytes. Normal quit followed
immediately; there was no relaunch, capacity polling or further cleanup.

Evidence: `scratch/runs/20261113-lmarbles-direct-puzzle2-0925/`.
The current registry identified resource launcher PID997016 and worker997025.
Its completed `recovery-result.json` reported 48 closed event streams and
19,243,008 net allocated bytes saved, with 1,502,613,504 bytes available.
This worker observed and hashed that specific resource outcome while the Pawn
worker remained live, without waiting for its later gameplay or terminal exit.
Recovery accounting belongs to that worker; shared free-space changes are not
attributed to LMarbles or to a particular other process.

The corrected parent0830 pointer-before-down/up helper and independent deadline
were prepared first. The actual published NFS0910 changes at
`418099fe9817deeb3a96d0f834d3a0ac9de765f0` were reviewed: guarded input is opt-in,
and the ordinary control path remains supported. Relevant tracked runtime diff
was empty. Exact source hashes were checked again by the launcher. The route
retained the current04 module, original 86 media references plus CRT, real ticks,
1024×712 canvas, cooperative threads and registered `lmarbles_108` launch.
No production source changed; no build was needed.

The fresh launch decision passed at 1,502,306,304 bytes. Guard PID1001547
acknowledged its independent 1,200-second deadline before native PID1001548
was created; the native maximum was 1,140 seconds. Personally reviewed captures
show the title menu, New Game menu and complete Tutorial board/target with
Moves18, Score0 and Tier1/Puzzle1. Two ordinary balanced clicks, each preceded
by pointer motion, selected New Game at (277,303) and Start at (278,267).
The planned selector motion at (530,402) failed the fresh capacity check before
any control subprocess or input event. No Puzzle 2 hover, selector click,
selection-label change or puzzle move occurred. No Tutorial clear or progress
is counted. The earlier click without motion still establishes no lock or
prerequisite; native Puzzle 2 availability remains unknown.

Whole stdout/stderr were streamed directly to lossless gzip, preserving every
byte without raw-log staging. Both streams reached EOF and decoded to their
live SHA-256 and byte counts (9,076 stdout bytes, zero stderr bytes).
Native1001548 and guard1001547 have separate actual parent wait0 receipts;
outer session50215 completed0. All 12 native/guard/control PIDs were absent in
postflight, and the deadline never fired. All 88 media/module hashes passed
both launch and postflight checks. Helper syntax, stream integrity and sealed
evidence rereads passed. The byte-identical automatic final capture was removed
in favor of the retained settled board capture, with its hash/reference recorded.

Git SHA, relevant binary diffs including the untracked runtime patch, owned
helper patches and media path/SHA references retain provenance without source
or media archives. No game, source, history, cache, recovery or protected-family
cleanup was performed. No children, external boxes or public deployment.
Box ID none; state NOT_CREATED; expiry null; stop receipt N/A.

Concrete blocker after the actual resource outcome: recovered headroom did not
remain above the required floor through native selection. Next requires a
distinct sustainable resource outcome, then pointer-first native Puzzle 2
hover/selection-label review and individually reviewed moves through earned
CLEAR and next/tally. Do not repeat this thin-headroom launch unchanged.
