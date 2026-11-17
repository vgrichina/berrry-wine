# GTA2 final pin prearm scheduling: actual remaining blocker

Run: `scratch/runs/20261116-gta2-final-pin-prearm-scheduling-repair/`.
Source baseline: main `7481c6a7477fa7b1d2b82e6dd4072a069e9e97e4`, containing
Sims implementation `ecfee3bf175c01e7830a891bd89eb376d12cfa53`.

**Unqualified. No scheduling implementation is published by this report.**
The candidate reaches native ARM at 466 ms but does not finish the necessary
post-arm independent confirmation before its separate watchdog expires at
507 ms. The exact release PID is signaled at 508 ms and observed quiescent at
509 ms. There are zero actual Input.dispatchKeyEvent requests. The parent
then joins both children and records permanent UNKNOWN. That endpoint receives
no later commands, input, rebind, replay or retry. The independent process and
the parent both reject completion after 500 ms; a delayed timer cannot turn
late completion into admission. OS timer dispatch itself is not claimed exact.

## Current reproduction

Both ordered predecessors explicitly released source, build and runtime.
Their selected hashes, recorded actual waits with both EOFs, PID/group absence,
current live commands and free locks were personally checked before this
worker entered the shared heavy lane. Historical missing receipts remain
UNKNOWN and are excluded, not newly required. No workers or boxes were created.

A complete current HEAD build passed under `/tmp/wine-build.lock`, using a
sealed transient Git audit view. Every selected Git blob was validated before
runtime, while the owned binding/controller/build/test paths remained fresh.
Sync reads, promise/callback reads, module loads and HTTP responses used the
same verified bytes. There was no per-import Git invocation. Existing foreign
WIP was neither changed nor adopted. This audit setup is separate from the
runtime scheduling cause.

The unchanged main controller completed two visible native modals, a Space
DOWN/UP, and Escape through actual native ExitProcess. Confirmations were
335/422/379/383 ms. Fresh final synchronous pins took 24/27/23/25 ms respectively.
Thus this main reproduction did not reproduce the predecessor's 545 ms failure.
The unchanged Worker controller failed before arm with all 193 source pins:
current target attachment 46 ms, debugger inventory 319 ms, current function
proof 327 ms, then module recovery still incomplete at the 500 ms refusal.
It dispatched zero input. This establishes a current complete-workload failure,
not a synthetic static admission result.

The first authored fixture attempt correctly failed the stronger every-capture
pixel witness after its key paint erased the swatch while retaining an old
GetPixel title. The new authored PE restores that swatch during the real paint
lifecycle and obtains GetPixel again on that paint HDC before ReleaseDC. It
retains genuine COMCTL32/COMMCTRL installed-name native lifecycle behavior.
Every subsequent reviewed preinput capture independently checks raw PNG,
public native GetPixel, backing/logical pixels, display ownership and physical
UP. The main native ExitProcess is recorded separately from subsequent host stop.
The terminal capture is not misrepresented as a new preinput pixel witness.

## Tested, uncommitted candidate

The binding/controller candidate prepares only transport and target attachment
before the immutable intent start. Fresh target inventory, debugger source
inventory, actual page/Worker module wire bytes, native state and nonce-bound
confirmation remain within 500 ms. It starts debugger inventory earlier and
uses parallel fresh asynchronous reads plus WebCrypto hashes for all pins,
joining every completion, including failures. The final fresh mutable-file
reads remain after source recovery. No source/module/native cache, skipped
predicate, deadline waiver or arm-before-check substitution is introduced.

A separate builtin-only process receives the immutable current start, nonce
and exact release PID/start identity. Its actual executed `node -e` source hash
is verified before starting the interval. It observes expiry independently,
stops the exact unqualified release child, observes quiescence before publishing
UNKNOWN, and is then actually waited with both EOFs. Successful qualification
would require its positive completion acknowledgment after child confirmation
and fresh parent pins, before DOWN; it must preserve the separate finite UP
child. The actual native candidate did not reach that acknowledgment.

Candidate evidence: `candidate-v1/worker/control/first-enter-release-wait.json`
contains ARM at 466 ms; `first-enter-prearm-watchdog-UNKNOWN.json` contains the
507/508/509 ms expiry/signal/quiescence times. The attestation recovered both
actual page and Worker module byte arrays (2,250,691 bytes each). The last
unresolved stage is complete post-arm confirmation within the original 500 ms.
Per-stage traces were buffered in the killed child and were therefore not
recovered for this candidate. No finer candidate stage timing is asserted.

Nineteen standalone authored controls passed, including fresh reads/hashes,
mutation/replacement, joining failed work, EOF/nonce/PID/start refusals, blocked
caller expiry and positive qualification preserving finite UP. They are
prototype controls, not native qualification. A separate control of the actual
compiled candidate watchdog expired at 501 ms, signaled at 502 ms, and observed
the blocked Node victim quiescent at 503 ms before the unavailable caller resumed.
Actual waits and both EOFs are retained. The earlier configuration-flush control
failure is retained; its correction requires acknowledgment before blocking.

The necessary final published main+Worker positive controls, full actual refusal
matrix and original gameplay remain UNRUN. Original attempts: zero. No software
or WebGL game arm is authorized by these partial positives. The first next task
is to reduce the measured current source/module/confirmation critical path while
preserving every predicate, then rerun the complete published qualification.
The candidate binding/controller and new test remain explicitly uncommitted WIP;
this documentation commit does not publish them. Exact baseline Git SHA and
binary patches, pins, selected full screenshots, logs and sealed closure are
listed by `result.json` and `runtime-release.json` in the run directory. No source
snapshot, media copy, WASM bundle, frame bundle or capture archive is retained.
