# Stronghold render-sized observer, 2026-11-04

Input: `d371d379f11db7e4bba7c702d516976dae724800` and
[the prior drain investigation](stronghold-customgame-drain-cause-20261104.md).
Evidence: `scratch/runs/20261104-stronghold-render-sized-observer/`.

The helper capacity and first-fault repairs pass offline. The one authorized
original entry failed during bootstrap, before Chrome, because an ownership
receipt was written before its output directory existed. That ordering defect
is repaired and reproduced offline. No second original entry was made. No
fresh game scene, CustomGame callback, setup, preset, Start or world was reached.
The historical input-drain cause remains unknown; no production engine defect
is established.

## Fixed observation budget

The observer now chooses **50,000,000 native boundaries** before execution,
within the existing **360,000 ms** observation deadline and **720,000 ms**
browser deadline. The authorized upper validation ceiling is also 50,000,000.
Nothing resets or extends either deadline or the boundary count.

The original initialized 800×600 RGB565 render requires **1,441,804** native
entries. Retained actual successful 64-step host ACKs advanced the observer by
**64,000** entries while rendering. A 1M budget therefore cannot cover even one
valid complete render; a host ACK is neither a completed render nor guest
message dispatch. The fixed 50M capacity holds 34 measured full render passes
(49,021,336 entries), with 978,664 entries for message/return overhead. This is
conservative capacity sizing for a render/message sequence, not a claim that
the missing historical sequence contained 34 renders or those dimensions.
The runtime, route and command limits can stop earlier.

Each native block increments a counter. Only baseline, callback/branch,
scene/setup saved-return history and host annotations become records. The
2,048-record, 1 MiB byte, eight-frame nesting, exact owner/instance/memory,
thread, immutable-code, input binding and consecutive ACK guards remain.
Callback and return records are never sampled out or replaced by a suffix.

## Executed capability and first-fault checks

`render-composed.cjs` reads the existing unchanged native render fixture by
path/hash. It preserves its original native function and initialized caller,
surface and lookup data. Its observed arm runs the actual serialized owning
Worker installer, original pre-instantiation observer, exact owning-target
attachment, pre-advance check and successful ACK annotator. The offline CDP
adapter transports real attachment operations; it supplies no native callback
or scene evidence. The fixture has no game input queue.

For **both** retained normal and compatibility modules:

- The explicit old 1M budget throws at entry **1,000,001**, with only 1,000,000
  entries forwarded to the prior import. The enclosing native run aborts before
  returning from the render. No continuation runs after that first fault.
- The default new budget returns from the unmodified native render. Padding
  to complete 64,000-entry ACK quanta gives 1,472,000 total entries, including
  the caller and stop loop; the render itself still has 1,441,804 entries.
- All 512 MiB page hashes, general registers, PC, stack, lazy flags, native PC
  histogram, render output and every completed run-command result match the
  trace-armed control. No guest code/data writes are made by the observer.
- Boundary, record and expiry negatives stop the actual composed execution.
  Additional executable Worker tests exercise record failure at a real native
  callback and expiry before a native block executes.

Previously `wrapped()` recorded a fault, detached its observer, and returned to
the native run. It now rethrows after preserving the first fault and pending
frames. The driver also checks the original observer deadline **before** every
advance, including the first advance with zero prior block records. This closes
the interval in which an idle expiry could have disabled tracing before an
otherwise unobserved advance. Full-history callback/setup fixture tests retain
their explicitly synthetic dependency returns; they prove instrumentation
capability, not the unknown historical dispatch.

Actual successful ACK annotations now obtain a step-matched page snapshot and
include queue, active input, last input, held mask and input telemetry. Their
native rows include the last native PC and active saved-return frames. These
annotations pass through the composed driver in the capability fixture. No
successful ACK was reached in the fresh original entry, so there is no new live
ACK or dispatch claim. An empty host queue still cannot prove guest dispatch.

## Single authorized entry and offline repair

Full preflight verified 2,429 filesystem pins, 1,856 unchanged original media
pins, 30 retained helpers, both modules and 1,016 HTTP responses with content,
isolation and cache headers. Media and modules are referenced by existing
path/SHA only. The exact MDK `20:53:05` local-heavy release preceded acquisition
of the sole local runtime flock. Runtime/bootstrap/command/cleanup reserves
remain 720/60/40/180 seconds, with absolute cutoffs 23:50/23:53 UTC.

An earlier wrapper-only guard rejected a short-lived shell-FD flock owner
before preparation or an original entry. Its log is preserved separately. The
corrected wrapper uses the tested long-lived `flock ... bash ...` ancestor.

The sole authorized entry at `20:57:43Z` then failed with ENOENT writing
`browser/runtime-ownership.json.tmp` before the original fresh-directory
creation. This was an introduced helper defect. Cleanup ran and the entry was
not retried. The repair keeps release/lock validation before side effects and
writes the receipt immediately after the original output-directory creation.
The regression executes the actual composed main through its first real
filesystem writes: old ordering fails ENOENT, repaired ordering creates the
directories and receipt, and a second entry still rejects. No server or Chrome
is invoked by that regression. The earlier admission test had mocked `save`,
which is why it missed the ordering defect.

Node `1142062`, start ticks `187307189`, and wrapper `1141984`, start ticks
`187306734`, exited with status 1 and are absent. There was no Chrome, game
server, profile, scene or gameplay input. The preflight HTTP server is closed,
its port refuses connections, and the runtime flock was released. Box
ID/state/expiry are NA; the coordinator retains lifecycle ownership.

## Validation and evidence recovery

Focused local-runtime, owning-callback, original-bootstrap and route-recognition
tests pass, including actual old-order/new-order filesystem execution. Both
module native render/control checks and first-fault negatives pass.
`flock /tmp/wine-build.lock bash tools/build.sh` passes.

Normal module SHA-256:
`78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664`.
Compatibility module SHA-256:
`99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f`.
Original EXE SHA-256:
`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.

All 53, 554 and 523 artifacts in the directly relevant predecessor seals
remain unchanged. Source recovery uses exact Git SHA plus relevant binary
diffs and the owned new-note patch, without source/media/module snapshots or
tars. The launch candidate's old local-runtime diff is preserved separately
from the final offline repair. A future original requires a separate assignment;
this task stops after publishing the tested repair and the bootstrap failure.
