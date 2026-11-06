# Aranna actual wrapper/member and input routing — 2026-11-06

Run: `scratch/runs/20261106-aranna-wrapper-action/`.
Candidate: `NEW-GAME-ARANNA-DEMO-20261010`.
Result: precise new emulator boundary; original remains at Main Menu.
Gameplay movement and another gameplay response are **not proved**. No production
repair, guest/media changes, memory increase, error suppression, allocator sweep,
or second original attempt. FPS/audio are unknown. No boxes were assigned.

This extends reviewed predecessor `36b8c13a6927bb2752a16677921bf376716bb792`
and `aranna-inner-transition-20261106.md`. Frontend object acceptance does not
identify a semantic SinglePlayer action.

## Actual original boundary

The personally inspected Main Menu received one ordinary trusted balanced click
at canvas fractions `(0.5,0.2852)`, page approximately `(340,355.9936)`. A later
balanced Enter also left the menu unchanged. Captures, command files, DOM events,
Win32 input callbacks and owning observations are retained under `original/`.
`after-intro.png`, `after-single-player.png`, `after-enter.png`, and `terminal.png`
were personally inspected. No gameplay or visual displacement claim.

The down callback is invocation190, `WM_LBUTTONDOWN` at `(400,151)`; up is214,
`WM_LBUTTONUP` at `(400,300)`. Selection consumer context is `074ffd1c` and the
accepted object is the frontend `08609d40`.

For actual inner invocation210, query `074ffab0+0xc` points to `0a5441de`,
containing `left_down`. Lower-bound return at `0043b39e` is `09c7b168`; upper-bound
return at `0043b3aa` is `09c7b1c0`. The lower node key is `left_down` at `09e0fad2`;
the upper node key is `middle_down` at `09e0faee`. The actual unequal-range branch
selects `0043b3b3`. Dispatcher invocation211 is object `0868cec8`, selection_down.

Actual indirect invocation212 calls wrapper `004c47c3` using binding `0868ced8`:

```
[004bccac, 00000000, 090b2bcc, 004c47c3]
```

New wrapper-entry78 and evaluated indirect-jump72 observations agree that the
actual tail target is `004bccac`, evaluated address `0868ced8`, ECX receiver
`090b2bcc`, EDX adjustment `090b2bcc`, and return PC `0043b4af`. This is observed
execution, beyond the predecessor's wrapper-only return.

At actual member entry73:

- `[007acefc] = 08ce4094`; the first dword there is `00000100`, hence its **byte**
  at offset0 is zero.
- `[007ace3c] = 08af0f54`; dword at `+0x20` is **5**.
- Actual selected first branch is `004bccbf`; selected second branch is
  `004bcccf`, captured through the fused memory-compare/Jcc handler.

Thus the executed instruction path skips calls `004c8ca7` and `004bf1bb`, sets
AL=1 and returns. Final EAX is `08af0f01`; actual return is PC `0043b4af`,
SP `074ffa34`, matching the admitted endpoint. AL1 is a return from this state-
gated member, not evidence of launching SinglePlayer. Neither the state5 meaning
nor its writer is established.

For release inner invocation218 on the same frontend object, query
`074ffaf4+0xc -> 0a543f92` contains `left_up`. Both actual bounds are `09c7b1c0`,
whose next key is `middle_down`. The equality edge selects `0043b3eb`, so the
inner loop has no matching dispatcher; it returns EAX `09c7b100`, AL0, at
`0043a562`, SP `074ffab8`. Predicate/consumer then clear the selected frontend
slot, consistent with predecessor evidence. This empty query range is now
measured directly, rather than inferred from missing member observations.

## Coordinate path and documented behavior

Passive host wrappers call each real method once with its original arguments;
they copy results, queue metadata, and host cursor state. They neither invoke
extra getters/mappers nor read/write guest state for observation.

At 07:11:44.433 the trusted down enters `handleMouseDown(400,170,0)`;
`_mapExclusiveInputPoint(400,170)` returns `(400,151)`. Queue metadata and actual
Win32 lParam agree. Pointer lock activates at 07:11:44.434. At 07:11:44.438,
actual `setMousePosition(400,300)` changes the host point from `(400,151)` to
`(400,300)` while the down callback is active. Before up, inverse mapping of
`(400,300)` gives `(400,299.4718309859155)`; mapping that point returns exactly
`(400,300)`. `handleMouseUp` receives that inverse point and queues the actual
up at `(400,300)`. The presentation has output660x568 and a native800x600 image
at destination `(0,36,660,495)`.

The down/up difference therefore follows actual pointer-lock virtual-cursor
routing and the guest cursor warp, not a demonstrated broken affine inverse.
[SetCursorPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setcursorpos)
moves the current screen cursor, while
[WM_LBUTTONUP](https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-lbuttonup)
reports client coordinates at release. No native Aranna comparison establishes
that this path violates those contracts or causes the semantic action failure.

The retained generated GetCursorPos active-event/current-cursor discrepancy is
still separate: the reused control expects the existing result398,152 after
physical movement to421,182. [GetCursorPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getcursorpos)
and [GetMessagePos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getmessagepos)
distinguish current cursor from last retrieved message position. This task does
not newly tie that retained issue to menu action routing and makes no repair.
The observed CMP/Jcc decisions agree with their captured operands. No newly
demonstrated documented CPU/Win32 divergence warrants a production change.

## Controls and identity

`flock /tmp/wine-build.lock bash tools/build.sh` passed. Both generated baselines
are byte-identical to the shipped standard/compat modules. Observer imports,
exports, canonical closure, and fixed512MiB memory are unchanged.

Eight cells exercise standard/compat × ordinaryAPI/actual owningWorker ×
baseline/observer. All new events72–79 execute. Generated fixture state covers
both byte-gate outcomes, state4/state3, empty/nonempty keyed ranges, actual
wrapper tail target/adjusted ECX, nested inner calls, and AL1 actual PC+SP ends.
Existing trusted input/public Win32/DirectInput/Draw, DLL, reserve/SEH controls
are reused. Nonzero GPR, lazy EFLAGS, live FLD1+FLDPI payload/environment,
thread/yield and fault/SEH results match the disabled observer. Missing-end,
wrong-return-PC and wrong-return-SP captures are rejected. The old256-detail
quota is saturated with reserved starts/ends intact. Baseline faults are not
suppressed. Generated guests are test fixtures, not original guest modifications.

Three retained renderer/input regressions passed: `test-renderer-input-cursor`,
`test-browser-relative-mouse-lock-gate`, `test-browser-relative-mouse-latch`.

Preparation failures are retained: attempt1 JavaScript interpolation syntax;
attempt2 inherited transform whitespace anchor; attempt3 coverage exposed a
missing fused memory CMP/Jcc observation. The hook was added after that handler's
own condition evaluation; modules and all eight controls were regenerated and
rerun. No production defect was inferred from observer omission.

Actual HTTP hashes cover source, modules, helpers and all28 existing media paths,
with COOP/COEP assertions and injection disabled; media is streamed and hashed,
not copied. Isolation was enabled. Actual selected Wine runtime module identity
was checked in controls and original screenshot state. Original module SHA256:
`d3b1fea932c3622b97c97b0c1008d50c2cac76237977417a95ad320503c23bee`,2198529bytes.
`original-http-identity.json`, `controls-http-identity.json`, `tested-inputs.json`,
module metadata and `media-references.json` hold exact hashes/paths.

Original source commit: `52810e34bf2903577fd8e82181ac641e38bb8469`.
`preoriginal-source.json/.binarydiff` and run-specific `.new.patch` files preserve
all relevant uncommitted hunks and new helpers. Git is the source archive; no
source archives, media copies or binary test archives were created.

## Lifecycle, limits and recovery

Exact ordered Conan0510 -> KKnD0535 -> AoW0545 FINAL releases preceded the
independent cleanup gate:323absentPIDs,28refusedports,17absentprofiles,4freelocks,
no heavy processes and disk above1.5GB. Immutable runtime window:
07:03:46.148954–07:48:46.148954UTC. Original started only after all controls and
identities; ordinary Chrome and driver exited0 at07:12:25.850/888. Drain has3265
copied records plus one separately emitted module-selection record,3266 total.
There are245 complete actual PC+SP transactions and zero incomplete. Old detail
quota256 is saturated; none of the new independent512-event caps is reached.
No OOM notifications were observed; this is not a broad allocation/free claim.

`measured-boundary.json` provides the compact selected transactions and host
input sequence; `wrapper-action-report.json` and `original/observations.jsonl`
retain the full review. `personal-review.json`, `final-cleanup.json`, publication
source manifests and `artifact-hashes.json` record closure/cleanup. `result.json`
is published last, failed for gameplay while preserving the diagnostic result.

Next bounded investigation should trace the semantic menu query/action route
and the writer/meaning of `[08af0f54+0x20]`, starting from these actual witnesses.
Do not force state4, rename files, retry this unchanged original, or identify the
frontend selection_down callback as SinglePlayer. A new original requires a
materially improved, controlled observation and a fresh assignment.
