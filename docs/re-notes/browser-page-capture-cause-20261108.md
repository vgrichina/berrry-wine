# Browser page capture investigation — 2026-11-08

**Actual blocker remains unresolved.** Removing supplemental state passes the
controlled composition test but fails again on the fresh original. Current
Warcraft progress is reviewed Prologue loading, not Thrall control or tutorial
progress. The new evidence excludes the optional state read as a necessary
cause of this fresh failure; it does not identify the blocking operation.

Run: `scratch/runs/20261108-browser-page-capture-cause/`. This investigation
preserves the released Warcraft and Q3 failures without replaying either ID.
Production emulator code and command deadlines are unchanged.

The released `browser-run.cjs` capture composition awaited `stateImpl()` before
calling the strict `bound-input.cjs` capture chain. The first read scanned VFS
entries for Q3 configuration, collected input history, log text, canvas layout,
application/thread statistics and broad renderer diagnostics. Those supplemental
results did not authorize input. The strict chain separately requires the live
registered process/document, exact object identities, guest target/instance,
render endpoint/context/target, independently reread CPU/render module bytes,
completed owning backend work and presentation. It checks ownership before and
after the screenshot, records the screenshot's original timestamp/hash, and
rechecks live identity and review freshness immediately before dispatch.

The run-local candidate requests only the strict chain during command capture.
Its state JSON derives from that chain's verified page/producer/worker result;
it explicitly marks supplemental diagnostics as unrequested. Broad periodic
page polling is also omitted. Neither cached identity nor broad diagnostics
can admit input. Screenshot freshness, independent release, exact ACKs, all
immutable deadlines and sticky UNKNOWN remain intact.

The original composition fails through actual production guest/render Workers
when its optional page-state read awaits a controlled 21-second page timer.
The unchanged 20-second command-work deadline leaves no final capture or ACK;
a subsequent request is refused by sticky closure. The candidate succeeds
with that same optional delay armed, because it never requests the optional
read. Both fixtures use the qualified producer helper and actual production
Worker composition. This proves an avoidable dependency in the composition,
not the cause of either historical stall.

SoftwareGL and WebGL candidate controls exercise the actual driver, strict
capture, numbered request/consume/ACK, native Enter, right-button input, typing
and final capture. Missing context, wrong guest, renderer replacement, stale
review, module mismatch, UNKNOWN, nonowner counters, missing producer and
missing endpoint all dispatch zero input. Software's real endpoint transition
before binding remains allowed; replacement after binding remains rejected.
The delayed-DOWN independent release controls also pass. Both red-triangle
images were personally reviewed. An initial candidate test incorrectly
expected the ACK client to omit its added command number; that assertion
failure is retained, corrected and excluded from qualification.

The historical traces limit causal claims. Warcraft's periodic page evaluations
were already pending before the final optional-state request; their deadlines
fire while that final request is still only a few seconds old. Q3 finishes its
supplemental state read and stalls at the strict page-owner read. Neither trace
records page-side field execution or main-thread stacks. Removing optional
diagnostics cannot by itself explain these observations. The new driver logs
page evaluation entry/return, page heartbeat and long tasks, samples the page
CPU, and attempts a bounded diagnostic stack/profile collection after UNKNOWN
has closed input. No diagnostic deadline extends command admission.

## Fresh original: failure before page evaluation entry

One UUID-idempotent no-environment box, `bx_sm6qd9fd`, was created at
04:07:18.554 UTC. The detached supervisor, normal-stop worker and independent
watchdog were all observable before allocation. Its immutable 25-minute
allocation expiry was 04:32:18.407 UTC. The browser's separate immutable stop
was 04:20:01.553 UTC; no deadline was enlarged.

The actual native viewport was **945×889**, Chrome **151.0.7922.71**. Ordinary
reviewed navigation followed Single Player → focus New Profile → type ABC →
Create → Select → Campaign → the distinct blue Prologue arrow. Initial clicks
and typing were sometimes visible only in a later passive capture. The created
profile is visibly **ABC**. Native Chapter One **Chasing Visions** loading and
an advancing bar were reviewed; even `loading-finish.png` is still loading.
`loading-next2.png` is the last completed image. No continue key, Escape,
Thrall selection or movement input was sent.

The bound renderer was actual SoftwareGL: owning `FixedFunctionGL` context,
GL endpoint 1, software transport 2, positive CPU triangles, completed software
work and advancing presentation/write sequence. Both executing Worker modules
independently match `f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
All completed captures retain the original before/after identity, module-byte
proofs and image timestamp/hash. The final failed command has none of those
completed artifacts and cannot authorize input.

`final-cause-audit.json` establishes these boundaries:

- Last page evaluation probe: **04:16:05.811**; last page heartbeat:
  **04:16:11.633**.
- Passive command `s-ready-wait` entered at **04:16:18.990**, then settled
  for ten seconds. Its strict page-owner evaluation was sent at
  **04:16:29.000**. No page-side entry probe was observed for that request.
- The unchanged command-work deadline fired at **04:16:48.943**. No final
  screenshot, state or ACK exists. Eighteen preceding commands have exact ACKs.
- After input closed, bounded `Debugger.pause` and `Profiler.stop` attempts
  returned neither a stack nor a profile before shutdown. Browser-level
  `Browser.close` responded immediately; Chrome exited zero at
  **04:16:51.210**. No command was replayed and original WebGL was skipped.

The page stopped emitting activity before the final owner evaluation was
requested. Its body was not observed entering; the evidence cannot distinguish
a blocked page thread from failed page-side CDP delivery or name an active
operation. The inherited console handler also reduced object arguments to
`"Object"`, losing probe tag/phase and long-task duration, although event names
and timestamps survive. The page profiler's result depended on a page command
after the stall and could not be retrieved. These diagnostic limitations are
explicit, rather than attributing latency to a getter, serialization, CPU,
graphics driver or emulator defect. No production remedy is promoted.

The next required diagnostic is a locally qualified browser/process-level
sample trace streamed durably **before** the page becomes unavailable, with
probe payloads encoded as strings. It must distinguish evaluation entry,
execution and return serialization without depending on a final page response.
Locate the active blocking operation before another original gameplay attempt.

## Source, evidence and shutdown

Staged Git SHA: `8532bf78091bf9c49b1bf7ac98d5e27b92663dfa`.
`runtime-pins.json`, `relevant-source.patch`, the boot-file patch and
`owned-helper-patches.patch` retain the source reference and relevant changed
or new inputs. The original delayed-composition control additionally retains
its exact tested driver patch and pins. Git remains the source archive.
The existing twelve registered Warcraft files were reused by path and SHA;
the four recorded historical hashes match, while independent historical hashes
for the other eight remain unavailable. No reinstall or media/source archive
was made.

All **627 remote pins** remained unchanged. Validation matches **399 completed
HTTP/range response hashes**, checks **30 PNG CRC/IDAT decodes and capture
hashes**, and verifies module bytes, exact ACKs and historical failure pins.
One early read-only image retrieval preceded the failed command's completion
and found no image; that failure is retained, with no command replay. Local
candidate assertion and audit-script iteration failures are also retained.

All **208 remote evidence references / 188 unique hashes** were retrieved and
independently reread for size/SHA at **04:18:02.214 UTC**, before requesting
normal stop. Both runtime processes were absent, both ports closed, and the
profile/writer lock removed. The box was normally stopped at
**04:18:04.161 UTC**, state **archived**, final expiry **null**. Stop receipt
**`stop_65745ef4731e5d53`** completed at **04:18:04.186**, `forced: false`.
Both lifecycle children exited zero and the supervisor has no remaining
children. Local and remote disk stayed above 5,000,000,000 free bytes.

No emulator change/build, nested worker, RAM gate, old-box resume/delete,
public deployment or source archive. Thrall selection/displacement, visible
native tutorial/objective consequence, original WebGL, full27, parity, FPS,
audio and campaign completion remain open. `RECOVERY.md` identifies the exact
helpers and preserved failure evidence.
