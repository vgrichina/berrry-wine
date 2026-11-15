# StarCraft rebel-base combat follow-through (2026-11-15)

This task follows the existing registered STRONGARM mission and its visible
rebel-base objective. It does not claim a new title. The preceding worker
production original is closed and supplies no combat or objective credit.

The released finite mission controller already supports manual selection,
minimap navigation, Move, Attack, separate command/target reviews and native
Quit. This change adds a distinct `enemy-consequence` result: the actual
consumed Attack target's before scene, a freshly attested after scene, and a
separate current persistent scene must describe the same visible damage or
destruction. Selected-unit identity, native kill-counter/HP consequence and
other-shooter review are required. Consumed orders and animation alone prove
nothing. Enemy consequence remains separate from objective progress and the
native mission-completion review.

Light preparation passed 48 policy and 16 actual HTTP controls, including
Attack followed by its separately reviewed target, foreign ACK terminal
handling, and independent release after parent death with actual wait/EOF.
Initial synthetic fixture failures were corrected and retained. The route
continues to refuse 1500 ms because inherited handling captures while held;
permitted pulses remain 80–1499 ms with prearmed independent 1750 ms UP.

Sims USER281 released source/build/runtime at 04:17:39Z and Q3 visibility at
04:29:24Z. Their 29 and 34 actual wait files, both EOFs and respectively 87 and
50 absent PIDs were personally verified before heavy qualification. The full
locked build and ten actual CLI controls passed on the then-current shared
module (2,203,481 bytes), including separately consumed Attack/target and
Move/target gestures, independent UP, consumer dequeue and real-tick progress.
No older module or foreign work was adopted as a fix.

The tested route is published before the single authorized original. No
original outcome, enemy damage, objective completion or native Quit is asserted
by preparation. Evidence belongs in
`scratch/runs/20261115-starcraft-rebel-base-combat/`.
