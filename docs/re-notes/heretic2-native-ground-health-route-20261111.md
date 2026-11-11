# Heretic II: covered ground checkpoint and blocked health approach

Native `save gate1810` retained the covered ground position near
`(1681,361,34)`. Normal native `load gate1810`, ordinary unpaused backward
and forward movement, and a subsequent standing observation passed. This
checkpoint records ground navigation, not a health pickup or encounter
milestone. The original four gate1640 files remain byte-exact and remain
the established fallback. Do not substitute the unsafe upper1730 or
gate1730 checkpoints described in the platform-route note.

The nearby health at `(1664,432,32)` and `(1664,464,32)` cannot be approached
directly from the west at ground level: native movement reached
`(1585,462,34)` and stopped at the solid platform-side wall. The covered
side entry farther south is usable. Shipped floor faces put the narrow
side passage at y296–384, while the northern west wall bounds that route.
The shipped breakable brushes at y384–408 remain a possible approach from
inside the shelter; native staff input was exercised, but neither their
destruction nor access to the health compartment was established.

Two exposed ground attempts ended in explicit native `Corvus died`
messages. A later sequence with bounded native Pause assistance returned
alive through the covered side entry and produced gate1810. No health
pickup, platform Action trigger activation, threat defeat or west-door
passage is claimed. The exact source of the green projectiles remains
uncertain. Health access remains the next task before exposed platform work.

Use the shipped bindings: Control is Attack, Space is Action, `a` is Jump,
comma/period are left/right sidestep, and the arrows turn or move forward
and backward. An early claim that ArrowRight+Control strafed was corrected
by native coordinates and the read-only configuration inspection. Host
hold duration does not establish a guest turn angle; several attempted
bearings were corrected from subsequent native readouts. Keep those
corrections when interpreting the raw image-review history.

Evidence is in ignored run
`scratch/runs/20261111-heretic2-ground-health-west-door-1810/`: see
`RESULT.md`, `RECOVERY.md`, `checkpoint-manifest.json`,
`validation-final.json`, and `software2/finalstanding.png`. The run restored
original gate1640 bytes only after initializing a native session. Guest
code, map, scripts and configuration were unchanged; new save contents
were written by the original engine. The tested module is
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`
from source pin `0db20330ccd6761a705eea70c5dd9bfc7704c147`, with the retained
matching locked-build proof. No shared runtime repair was needed.
