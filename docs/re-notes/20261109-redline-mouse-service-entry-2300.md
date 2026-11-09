# Redline mouse service boundary: retained timing and concrete blocker

Evidence: `scratch/runs/20261109-redline-mouse-service-entry-2300/`.

The retained command-23 failure can be narrowed further than the preceding
handoff. Exhaustion affected the raw-frame ring, but **nine timed input events
survived** in `native-input-wire.jsonl.gz`. The exact deployed mouse wrapper,
menu adapter and ordinary helper match their original manifest SHA-256/size
pins. Their sequential call order identifies request 1340 as mouse move, 1341
as press, and 1342 as the independently scheduled release. No intervening mouse
request exists.

The move send-to-reply interval is 50.833 ms. Press socket-send entry is Node
monotonic 978052.132466 ms; socket-send return follows 0.076253 ms later.
Release socket-send entry is 978203.550686 ms, **151.418220 ms after press**.
The press raw matching reply arrives at 978217.711440 ms, **165.578974 ms after
press send and 14.160754 ms after release invocation**. The release raw reply
arrives 46.743839 ms after its invocation. Both replies precede the first
terminal observation at 978252.229681 ms.

This excludes a delayed local promise continuation as the explanation for the
press missing release: the press reply itself was not observed before release.
It locates the delay before Node receive. A short socket-send call proves
neither delivery to Chrome nor browser handling. The two remaining contributions
(request/reply transport and browser service) cannot be separated from these
records. The native trace was configured for the first ten startup seconds,
long before this click; its cleanup receipt also refuses complete trace proof.
No failed-command image or browser DOM handling marker survives. The original
20-second command work guard was not the failing guard.

`tools/redline-mouse-service.cjs` adds an explicit, manifest-sealed observation
mode to the Redline current-publication route. Preparation and both prelaunch
paths bind `REDLINE_MOUSE_SERVICE=1` to the known observation version. The
generated caller refuses a missing/mismatched mode before browser work.
The default route remains without observation. Shared providers and the actual
mouse/menu helpers remain byte-identical.

Each mouse command has its own 128-record cap, independent of the global raw
ring. Records bind request IDs, mouse types/coordinates, socket entry/return,
raw reply time/session matching and helper promise settlement. An initial
browser clock sample is bracketed by Node timestamps; browser capture/bubble
markers have command IDs, timestamps and native trusted-event flags. Browser
binding emissions stop after 64 markers per command. These are DOM handling
observations, not guest consumption or exact browser request-arrival proof.
Clock uncertainty and missing markers remain explicit. Sealing happens once
on helper return/refusal or terminal interruption; late callbacks cannot append,
publish or trigger protocol. Diagnostic sink failures preserve the original
terminal cause. No input timer, hold, CDP/work deadline, capture proof or ACK
rule was changed.

Offline tests run the actual composed `execute`, `send` and WebSocket receive
functions with the deployed mouse/menu helper and numbered transport. They
cover successful current-geometry click, press reply delayed beyond independent
release (still refused), delayed release exceeding the command deadline,
terminal interruption, sticky refusal of later commands, no later protocol or
capture, bounded pressure, page marker caps and diagnostic sink failure. A
separate preparation/prelaunch/generated-caller test passes full closure checks
with the sealed mode, refuses missing mode, then exits through DRIVER_PREFLIGHT
with no server or Chrome. Current-lock/menu, capture-trace, terminal-close and
menu-selection regressions pass. The locked repository build passes.

The coordinator's correction on the board was independently checked by viewing
the retained `car-side-view.png` and `car-corner.png`: these show brick walls,
cabinets, a ramp and the on-foot health100/ammo200 HUD. They do **not** establish
a visible car. The filenames and earlier summary cannot supply a car/door
target. No entry or driving outcome is claimed.

Concrete blocker: there is no demonstrated production browser service cause to
repair. The records establish a pre-receive delay but cannot locate it further.
A speculative timing change would violate the unchanged input proof, and a
fresh run whose only change is this observer would be the trace-only replay
the task excludes. Therefore neither native fixture nor conditional original
was admitted. No runtime was allocated, resumed, stopped or left billing; box
ID, UUID, expiry and stop receipt are all not applicable. This is instrumentation
and a narrower failure finding, **not a mouse timing repair or reviewed entry**.

Next work requires an explicitly permitted causal native experiment (using the
bounded records) or other browser-side evidence that demonstrates a repairable
cause. Any later entry attempt must first establish an actual visible vehicle
from its fresh reviewed image and retain current lock/geometry proof.

Source recovery uses the exact Git SHA plus the run's small owned-file patch;
no source/media archive was created. Retained referenced evidence was reread for
SHA-256/size, and compressed inputs were fully decompressed for CRC/EOF. No
previous runtime was contacted. Free `/home` remained above 1.5 GB.
