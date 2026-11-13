# LMarbles Tier 1 Puzzle 2: new local move, 2026-11-13

The original registered LMarbles game made a **new Puzzle 2 move** under ordinary
input. The lower-right red marble slid upward from canvas (354,378) to (354,186);
the settled full-board capture shows **Moves 28 → 27, Score 1350, Tier 1 Puzzle 2**.
Puzzle 2 was not cleared. The preceding Tutorial replay (eleven moves, 18 → 7,
Total Score 1350) was only the permitted prerequisite and adds no new achievement.

Evidence: `scratch/runs/20261113-lmarbles-recovered-puzzle2-0540/`.
The personally reviewed before/after frames are
[p2-selected.png](../../scratch/runs/20261113-lmarbles-recovered-puzzle2-0540/p2-selected.png)
and [puzzle2-consequence.png](../../scratch/runs/20261113-lmarbles-recovered-puzzle2-0540/puzzle2-consequence.png).
The intermediate `p2-move1.png` catches the actual upward animation. Each finite
move followed a fresh full-board review. Pointer motion preceded selection;
button and arrow presses had separate releases and actual command-parent waits
with both output EOFs. No solver, automatic move chain, profile/config patch,
guest state/clock edit or forced call was used.

The prepared b883f6240 local route was reused with registered `lmarbles_108`,
1024×712 canvas, real ticks, cooperative threads, port 8430 and the unchanged
module `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Launch source SHA and exact command are in `route.json`; relevant binary diff
and owned helper patches are retained. All 86 original media references and the
separate CRT passed SHA-256 checks before and after. Existing paths were used;
no media copy or source archive was made. No production file changed, so no
production repair or build was warranted. Helper syntax and balanced-action,
media/module, process-exit and evidence-hash checks passed.

Dense0340's actual completed local archive replacement/reclamation was observed
on the board before launch preparation finished. Its subsequent live NFS work
was left alone. Offload0500 was already terminal at 82241341c; its stopped
snapshot and all recovery bytes/mappings were untouched. One fresh launch
check measured 1,514,840,064 bytes free on `/home`, above 1,500,000,000.
The supervisor/input ownership was prepared first. The independent 1,200-second
deadline guard acknowledged and was observed alive before native creation;
there was no RAM gate or disk polling/cleanup loop. The initial decision's
`nativeLaunched:false` is the precreation value; actual lifecycle is established
by `guard-observed.json`, `target-pid` and `native-wait.json`.

After the new consequence was retrieved, ordinary host quit ended native PID
911145 with actual parent wait 0 and stdout/stderr EOF. Independent guard PID
911144 also joined with return 0 and both EOFs. Both owned processes were absent
in postflight; the outer supervisor completed 0. No guard fired.
Box ID/state/expiry: none / NOT_CREATED / null. Box stop receipt: not applicable.

Next: an earned Puzzle 2 clear remains unproved; continue only with another
freshly guarded runtime and personally reviewed ordinary moves.
