# Window ownership bound to immutable natural capture

The immutable endpoint now supports a window-scoped request. It binds an
existing live host window and its process/instance ownership to actual
top-level stack selection and the immutable source/output readback from that
same successful natural repaint. This is a concrete prerequisite for Deus Ex
capture provenance. Engine render completion and viewport-to-player ownership
are still unestablished; `engineRender`, `viewportPlayer` and `workerSlice`
remain explicitly `null`. No full capture-contract or gameplay claim follows.

Predecessors: [immutable endpoint](deusex-immutable-capture-endpoint-20261104.md),
[natural-frame obstruction](deusex-natural-frame-capture-20261104.md), and
[capture contract](deusex-capture-publication-contract-20261104.md).
The endpoint was published at `832e07766f58a117d98db556a2f63689ea6f012b`.
This run's exact pre-change main is
`6004e338eeecbdac153284cd363d499843bc68a4`; relevant endpoint code is unchanged
between those commits. Evidence is
`scratch/runs/20261104-deusex-engine-capture-binding/`.

## Source-backed dependency and API

Actual `host.js` `h.create_window` and `h.dialog_loaded` pass
`ctx.instance || self.instance` to renderer creation and assign
`win.processId = self.processId`. The renderer retains the window object and
its `wasm` reference. The existing process-send broker also uses live window
object identity to reject HWND reuse. These are existing ownership records,
not identities inferred from pixels, window titles, actor presence, or counters.

Previously, `requestImmutableCapture()` had no owner constraint. On the shared
renderer, any next selected stack could fulfill the ticket, including after
destruction/replacement of an intended window. The added API is:

```js
const ticket = wine.requestImmutableCapture({ hwnd });
// Ordinary execution/presentation continues. No repaint is requested here.
const capture = ticket.read(); // null until complete
// capture.metadata.captureOwner: { hwnd, processId }
```

The host derives process ID and instance from itself; caller-supplied owner
labels are ignored. The renderer validates those against a live window at
request time and privately pins its object, HWND, process and instance.
Missing/foreign/unmeasured ownership throws before occupying the pending slot.
The lower-level renderer API takes `{ hwnd, processId, instance }` and performs
the same live-window validation; the normal host API supplies those values.

At actual stack selection, the compositor records whether that very window
object, still with the matching identity, belongs to the selected stack.
Exclusive stack trimming updates this observation. After successful display,
before byte readback, it rechecks the live object and ownership. Replaced,
hidden, removed, excluded or changed-owner windows fail the ticket. Restoring
an old window only after selection cannot bless a different selected object.
An ownership failure does not interrupt ordinary display, retry composition,
or revive a prior capture. False/throwing display still propagates its original
error and fails the ticket before any capture completion.

Successful metadata includes frozen `captureOwner` and selected-window
`processId` values. Unscoped requests remain supported with `captureOwner:null`;
unknown selected-window processes are `null`. Window and WASM references stay
private and do not appear in metadata. Existing private RGBA copies, cancellation,
Worker holds, nonnested admission, size limits and display-only exclusion remain.

This identifies membership in the selected top-level stack, not exclusive
ownership of every output pixel. Other selected windows, children, overlays,
desktop and layers can contribute; a selected window can be occluded. It does
not establish that the window's engine finished a frame, that its actor is the
viewport player, or which Worker/thread/slice produced its bytes.

## Engine inspection and remaining boundary

The actual installed input is
`test/binaries/candidates/deus-ex-demo/installed/system/engine.dll`.
Its path, size and SHA-256 are recorded in `binary-inputs.json`; the binary was
not copied. `tools/pe-exports.js` identifies original preferred image base
`0x10300000` and export #898
`?Draw@UGameEngine@@UAEXPAVUViewport@@HPAEPAH@Z`, RVA `0x3aad`.
`tools/disasm_fn.js` at that exported VA shows a jump to original VA
`0x1038e9e0`; a separate body disassembly confirms actual x86 code at that
target. The viewport export inventory is also retained. These addresses are
derived from this original PE, not guessed runtime addresses.

An exported Draw entry and its prologue do not identify completed rendering,
all return/unwind routes, a validated live viewport-player relation, or a
relationship to host publication. The current host/renderer capture path
contains no such engine event. No executable hook or live engine observation
was installed. A trustworthy next dependency requires verifying those guest
semantics and correlating an actual owning completion to this selected source
without treating a Worker slice return or host repaint counter as an engine
frame. Layer provenance and browser/GPU/Chromium screenshot correspondence
also remain missing. The historical 735→736 capture remains rejected.

## Tests and evidence

`test/test-immutable-capture-endpoint.js` runs actual host, renderer,
PresentationFilter and RasterCanvas modules. All original six cases and four
new named cases pass. The new cases cover host owner derivation, frozen/copied
metadata and pixels, missing/foreign process or instance, no request-slot leak,
same-HWND/same-process/same-instance replacement, ownership changes, hidden and
removed windows, actual exclusive stack exclusion, stale selection restored
before readback, owner changes after display, Worker holds, and false/throwing
display. Software canvas fixtures establish these control-flow and pixel
properties; they are not real GPU/browser/Deus Ex runs.

`control-run.cjs baseline` loads the exact recorded pre-change host/renderer
from Git into memory and runs the final test file: original six pass, new four
fail. Mutation controls forwarding caller owner labels, removing selection
validation, removing post-display live-owner validation, and exposing retained
RGBA all fail the final suite. No production source is modified for controls.

Focused display, input, rAF, Worker repaint, filter and composition regressions,
callback census and test membership checks accompany the serialized locked
full build. The census update changes only reviewed host/renderer hashes and
appends this synchronous owner-check review; broader ownership remains pending.
The run retains exact Git SHA, relevant `git diff --binary`, new-file patches,
commands/results and a SHA-256 manifest. Git is the source archive; no source
snapshot, media copy or archive was made.

No assigned box: ID/state/expiry are not applicable. No runtime, browser,
allocation, lifecycle action, guest mutation, extra repaint, subworker,
successor, deployment or Heroes II work occurred. Coordinator runtime
ownership remains unchanged.
