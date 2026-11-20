# Warcraft III passive trace safety, 2026-11-20

Run: `scratch/runs/20261120-warcraft3-safe-passive-trace-scheduling-repair/`.

The prior run's diagnostic serialized a circular renderer event inside the real
`check_input` import. That crash was diagnostic interference, not evidence of a
production scheduling defect. Its replacement is now an opt-in helper exported
by `tools/warcraft3-current-controller.cjs`: `createPassiveNativeTrace` and
`passiveNativeTraceBootstrap`. Existing controller exports and all production
input guards remain intact. The inherited shared bridge SHA-256 remains
`91069c0446876b6528c72db09517e45a1fe3a7122a1444bc3dc5408f8ed22c2b`.

The helper retains 256 records of eight numeric cells, plus fixed numeric method
counters. Records contain sequence, monotonic time, method index, entry/return/
throw phase, first-argument numeric/boolean scalar, result numeric/boolean scalar,
result type code and a reserved zero. Other arguments and return values become
zero without enumeration, coercion, property reads or serialization. Accessor
methods are skipped. There is no interval, heartbeat, console sink, status
refresh or producer invocation. Trace snapshots contain copied numeric arrays.
Methods call the original once with the same receiver and arguments and preserve
its exact return or thrown value, including when diagnostic clock reads fail.

Focused tests cover circular objects, throwing getters/proxies, huge objects,
bounded storage after wrap, primitive/object returns, exact thrown identity,
nesting, method accessors, factory semantics and diagnostic clock failure.
The run-local production Worker control executes native PeekMessage, the actual
RPC broker and browser native receipt bridge with tracing off/on. Both consumed
the same S edge at the native USER return, with identical callback counts and
receipt fields. Renderer objects and input are authored controls; this does not
qualify original-game progress. The fixture initially omitted the native main
HWND, preventing the ten-word scene; those setup failures are retained. The
corrected control passes, including the promoted tracked helper.

The prepared original-game scope closed at its first checkpoint with actual
`/home` free space **1,495,343,104 bytes**, below the required 1,500,000,000.
It created no browser/display/server and issued zero app/input/frame requests.
Its inherited `originalLaunched: true` fields merely reflect the requested mode;
`runtime-audit.json` corrects that label using the supervision and cleanup records.
The scope stays permanently closed; no retry or endpoint query followed.

Consequently CDP polling, frame lease and producer-callback starvation remain
untested hypotheses in the original. No scheduling fix is claimed. Single Player,
Prologue, Thrall movement, objectives and normal Quit remain unrun. The authentic
FDF S shortcut, module `10bdae…` and CRT `887eb5…` proofs are reused by checked
reference recipes. Freshness 250 ms, native delivery 500 ms, hold 1500 ms,
one-use/epoch/frozen/retired fences are unchanged. Hex remains independent.

Recovery uses the recorded Git commit, relevant binary diff, owned-new-file
patch, unique authored control module and hash-verified media references.
No media copies or source-tree archives are needed. The finite 245/260 second
native supervisor joined its only child with no leaks. Both authored Workers
were terminated and joined. No test box was created: ID null, state NOT_CREATED,
expiry null, stop receipt null. No Python, Wine, workers or public deployment.
