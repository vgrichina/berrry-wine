# Native Peek / removal acknowledgement, 2026-11-20

Evidence: `scratch/runs/20261120-native-peek-get-confirmation-repair/`.
Code commit: `65a75893c1313ee9f0eec4bea4edb5e0f4c423fd`.

The production browser guard acknowledged PeekMessage(PM_NOREMOVE), then
rejected GetMessage removing the same cached MSG because the ticket was
already CONSUMED. Native `input_confirm_return` consequently changed EAX 1
to 0. Consumed-token validation also skipped the original ownership fences.

Only an observed, still-unremoved cached message can now continue through
validation and acknowledgement, under the original scene, actor, capture,
module, endpoint and deadline fences. Repeated nonremoving observations retain
the first receipt. A removing return records `nativeRemoval` separately; the
first `nativeMessage` remains the original Peek observation. Later validation
and acknowledgements reject that token. No DOWN is reapplied or dequeued,
and no lease or deadline is renewed. Neither field claims callback execution.

The focused test executes the production RPC encoder/broker in a real Worker,
real native USER handlers and an x86 wndproc. With identical module
`10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564`,
the old guard returns Peek 1 / Get 0 / zero callbacks; the repaired guard
returns Peek 1 / Get 1 / one callback. The current built module also passes.
Normal WM_QUIT GetMessage 0 behaviour remains identical. Guard controls cover
wrong MSG fields, actor/slot, endpoint, module/memory/window, generation,
focus, stale scene, original wall/monotonic deadlines, UNKNOWN and foreign or
ambiguous capture, plus post-removal replay. Capture 22, lifecycle 4, Hexen 42,
GLTron and legacy compatibility controls and the locked build pass.

The one affected original Quake II launcher refused the actual /home floor
before creating a scope, browser, supervisor, or input. The subsequent sample
was 1,499,578,368 bytes. There was no retry. Original guest removal/dispatch,
enemy consequence and ordinary Quit remain UNPROVED; the authored native
callback result is not evidence of original gameplay. The prepared original
references the unchanged 10bdae module and 67 verified media inputs plus the
tested JS overlay, without media copies. No WAT or shared guest/RPC path was
changed.

Immediate strict publication of the code commit failed at pull because the
held `src/00-regions.wat` and `lib/region-map.generated.js` would be overwritten.
No foreign conflict resolution or push followed. No box was created: ID null,
state NOT_CREATED, expiry null, stop receipt null; shutdown owner coordinator.
