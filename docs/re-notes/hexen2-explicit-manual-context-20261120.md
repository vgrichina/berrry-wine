# Hexen II explicit manual context, 2026-11-20

WIP implementation and initial evidence:
`scratch/runs/20261120-hexen2-explicit-manual-context-implementation/`.
Continuation: `scratch/runs/20261120-main-callback-lifetime-hex-context-finish/`.

`createNativeManualContext()` issues a separate `native-manual-context-v1`
signed capability. Hexen enables it explicitly through `manualContextKey` on
the session and `manualContext` on the controller. The retained personally
reviewed image remains context for one exact intent; changing pixels are
permitted without asserting whole-frame equivalence. Evidence reports actual
pixel equality separately from authorization. Existing direct five-second and
exact RGBA paths retain their defaults.

The mode preserves source/review/fresh age bounds, private captures, HMAC intent
binding, all identity comparisons, fresh USER observation after fresh capture,
native consumption deadline and independent physical release. The qualified
Quake II implementation is reused without editing its source. GL/MCM must
continue to pin their qualified common graph rather than borrow this WIP.

Focused controls passed: changing actual native root pixels rejected by strict
equivalence and accepted by the explicit capability at all three capture
fences; cross-capability verification, forged signature, changed intent, reused
handle, identity changes, wrong review hash and expired review rejected. Legacy
Hexen and strict frame-equivalence suites also passed. These checks do not prove
real native USER consumption or a game consequence for the new capability.

Continuation repaired the callback gate after recovering and hash-verifying all
six exact reviewed baselines. Real host/render lifecycle regressions were fixed,
with 152 focused controls and actual native DLL/Worker NE checks. The remaining
four producer changes received bounded lifetime reviews, with no unnecessary
behavior changes. See `main-host-callback-lifetimes-20261120.md`.

The first full guarded build then failed on a stale generated region map relative
to foreign-held `src/00-regions.wat`. Root regenerated its owned local mirror;
the final full guarded build passed. Neither file was edited by this author.
The main host repair is committed as `5918d102502b3f4c34d087bf41fe811ec34c6c92`.
Immediate strict pull aborted because the merge would overwrite both foreign-held
region files; no push was attempted. The manual-context implementation remains
uncommitted because native USER qualification failed before input.

The manual capability now requires its explicit controller option and rejects
empty or ambiguous session keys. Its capture events say manual context, without
claiming equivalence. New offline production-session/guard controls pass 23 cases
plus explicit-option/key checks: signed post-fresh USER bounds, forged/borrowed/
wrong-kind/stale/mutable proofs, changed owner/module/memory/endpoint/focus/modal,
retirement, cancellation, observer errors and one-use nonce. These controlled
observations establish zero-DOWN refusals, not native execution qualification.
The real native capture, legacy 42 and strict Hex suites also passed before the
runtime failure; the later event-label-only change was not recaptured.

One fresh authored animated x86 receiver was launched with the pinned
`10bdae2c...` 2418815-byte module and qualified runtime overlays. Its normal
timer-driven guest draw toggles clear color; no original is modified. Actual
Worker bytes were hashed once. The first native bind refused because the browser
document was not focused/visible. The retained whole-host image visibly has the
address bar selected. Zero ARM and zero DOWN occurred. This UNKNOWN permanently
closed the scope; no retry, replacement receiver, later endpoint request or
original was attempted. Strict animated-receiver refusal, manual native USER
consumption, independent gesture UP and original movement/enemy/Quit remain
unproved. The idle independent release process joined without arming.

No old scope was resumed. No test box was created: ID=null,
state=NOT_CREATED, expiry=null, stopReceipt=null. Root owns shutdown; local test
browser/display cleanup completed. Media is referenced through prior manifests,
never copied. Git plus the relevant diff and owned new-file patch preserve WIP.

Document-focus continuation evidence:
`scratch/runs/20261120-hexen2-native-document-focus-manual-finish/`.
`tools/hexen2-native-host-focus.cjs` retains the exact host app, native HWND
focus, process/endpoint/slot, owner and consent geometry checks. It also gates
native binding on a completed trusted host-button click and one synchronous read
of document focus, visibility, fullscreen and the actual trusted click event.
The run-local browser driver invokes this gate before its first native bind.
It never calls document.focus(), changes guest focus, or bypasses the native
session's subsequent focus/modal/owner checks. Nine focused regressions cover
the inherited bind-before-click order and zero-DOWN refusals.

Before fresh runtime, 38 helper sources (including literal lazy imports and
explicit ROOT imports), release participant entrypoints, the exact 2418815-byte
10bdae2c module and all 18 media references were checked. Existing capture,
legacy 42, strict and 23 offline proofs were reused unchanged; the main lifetime
repair was not repeated.

The one fresh animated receiver proves the focus-order repair: personally
reviewed whole-host consent, trusted host click, independent host mouse UP,
focused visible fullscreen document, then native bind all passed in that order.
The actual CPUWorker module hash was recovered once. A separate personally
reviewed whole image authorized exactly one C edge through the explicit manual
capability. Its signed fresh CURRENT image differed from the retained source;
it was correctly marked personallyReviewed=false. A subsequent native USER
observation after that fresh capture allowed PREPARED. These are authorization
and preparation proofs, not native delivery qualification.

The fixed 500ms delivery deadline then returned UNKNOWN. Retained timing shows
prepare at 1795173403136, pre-DOWN capture through 3403461, and socket capture
through 3403661, before UNKNOWN at 3403671. The independent release fired at
3403581 and obtained a transport ACK at 3403591, before the main socket fence
finished. No trusted physical-UP receipt was observed, so neither native
consumption nor independent gesture UP is qualified. No timing bound was
widened. The first UNKNOWN permanently closed the task: zero later ordinary
endpoint requests, no new receiver, no strict animated runtime retry, and no
original game. Movement, living enemy and Quit remain unproved. The separate
focus helper is ready; the inherited manual-context implementation remains WIP.
