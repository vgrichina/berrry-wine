# Current native GL/GPS publication boundary, 2026-11-17

Evidence: `scratch/runs/20261117-gl-gps-initialized-publication-capture-repair/result.json`.

The browser binding now recognizes the actual `gl-gps` render endpoint and
pins its bridge object and generation. It rejects a mismatched, closing or
failed GPS bridge and ambiguous GL endpoints. The controller uses that API
identity in backend validation and the independent release owner check.
The observed touch-cursor overlay remains a refusal; no CSS, visibility or
focus exemptions were added.

The authored capture helper now waits for a passive object/sequence join
from the real GPS layer through the compositor's ordinary publication hook.
An initial GDI desktop record alone cannot pass this prerequisite. The final
observer performs no pixel reads, guest calls, repaint or scheduling. An
optional authored GetMessage fixture and an independent literal triangle
oracle support further investigation; neither is qualified native input.

The continuous native development run joined publication 7 to endpoint 1,
generation 1, layer write 325 / producer stamp 323 after six earlier desktop
publications. Actual guest and render Worker modules matched the recorded
Git-only module `cff5da9a64e3df960918df28ae7e06bd1db7cfae49d189f4281d82ea09e7f274`.
The updated binding reported the GPS owner instead of `none`, and refused
canvas-only authority because the real touch-cursor canvas intersected it.
The single current-display request then became permanently UNKNOWN at its
unchanged 3,000 ms deadline. No input or later request was sent.

Development observer revisions did extra synchronous readbacks; these may
perturb timing and were removed. Their failures cannot establish a production
capture timing defect. The message-driven development fixture delivered seven
native GPU frames, but its ordinary initialized-publication join did not pass
startup before expiry (the last retained observations show publication 6 and
slice 576). No retained initialized pixels, same-publication host comparison,
or source/compositor corruption is claimed. Initial-white and later-triangle
historical captures are not substituted for that missing comparison.

The five focused tests cover actual GPS selection/generation, owner failures
and ambiguity, generation substitution, initial/unrelated publication refusal,
and opaque-white literal-oracle refusal. These are focused helper checks, not
the native input/fault matrix. All development processes have actual native,
watchdog, browser and outer waits recorded separately from pipe EOF. Empty
target-closure events do not prove Worker retirement.

No original GLTron was launched. Native input positives, context loss,
retirement/late capture, Worker closure, initialized literal pixels and bounded
complete-host review remain prerequisites. The next task must resolve that
concrete boundary before any original. All old UNKNOWN endpoints remain closed.
No boxes, other workers or public deployment were created.
