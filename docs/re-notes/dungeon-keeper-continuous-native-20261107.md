# Dungeon Keeper bounded native motion, 7 November 2026

The native Pointer Lock path passed locally through the production renderer and
guest input consumer. The single fresh original attempt stopped at its first
blocker: **the ordinary trusted capture click did not acquire Pointer Lock**.
The motion command refused before sending any movement. I reviewed the original
intro and Main Menu only; no Eversmile dungeon, digging, building, action
consequence, FPS, audio or parity was demonstrated.

Evidence and the retained browser adaptations are in
`scratch/runs/20261107-dungeon-keeper-continuous-native/`. Predecessor
`caae9bb35` was published and released before this assignment started. Its
published note and the Gameplay route/relative-cursor sections of
`dungeon-keeper-demo.md` informed this test; its accepted PNG/capture fixture
matrices were not repeated.

`tools/dungeon-keeper-native-motion.cjs` adds bounded ordinary CDP movement behind
the existing Canvas2D chain's immutable reviewed-pixel admission. Commands allow
1–32 nonzero integer steps, each axis at most eight counts, intervals of
20–100 ms, and nominal movement duration at most three seconds. A five-second
command deadline prevents further dispatch after slow diagnostics. Every step
checks live process/window/document/module-object continuity, released buttons,
the owning canvas's Pointer Lock and unchanged geometry; physical coordinates
must remain inside the canvas. Full executing-module hashes are checked during
admission. A failed/UNKNOWN dispatch closes the chain and is never replayed.
There are no programmatic renderer movement calls or guest-memory writes.

The retained browser tracks physical CDP coordinates across commands: locked
DOM `clientX/Y` stay frozen and cannot be the next command's origin. Locked
clicks preserve that physical point and use the production input bridge's
virtual guest cursor. The run-only transport now verifies the exact command
number in both the returned and retained ACK, as well as its ID. Existing
timestamp-before-readback freshness, 22 identity comparisons, natural publication,
independent UP scheduling and sticky terminal behavior remain in place.

Local qualification used the normal production index route with the installed
`dx_ddex4` sample, Win98Renderer, Canvas2D and an actual guest Worker. Only this
local sample's app profile was set to `relativeMouse: true` to exercise Pointer
Lock. The original registry/configuration was unchanged. A passive wrapper of
the real `renderer.takeInput` recorded the events returned to host `check_input`;
it called the original exactly once and returned the same event unchanged.
This is evidence of the guest input consumer, not a claim about game simulation
or DirectInput (Dungeon Keeper's documented path uses WM_MOUSEMOVE).

I personally reviewed the fresh immutable sample captures: red sprites on a
blue checkerboard with the F12 caption. In `qualification/`, two consecutive
commands delivered eight trusted locked DOM mousemoves, each `(2,0)`, with no
spurious jump between commands. The actual consumer returned all eight
WM_MOUSEMOVE events, HWND 65537, with coordinates 322, 324, …, 336 at Y=240;
the queue drained. The preliminary `local/` pass also delivered four such moves.
Both browsers exited normally with code zero and removed their profiles.

Focused actual-chain controls in `qualification/native-controls.json` passed:
stale and wrong-window-owner admission had zero effects; wrong numbered ACK and
UNKNOWN movement lanes became sticky and rejected a further command. An actual
mouse pulse armed UP before DOWN and attempted UP after 60 ms; UP completed
before the deliberately delayed DOWN acknowledgement. These are new native
motion/transport controls, not the accepted capture fixture matrix.
`test/test-dungeon-keeper-native-motion.js` additionally checks invalid bounds,
physical-coordinate continuity across commands, and terminal mid-command lock
loss with no remaining sends. It and the required locked build passed. No
emulator/renderer implementation was changed or defect asserted.

One UUID Idempotency-Key POST created **bx_mp72p7pt**. The isolated deployment
retained the complete 644-pin predecessor PNG closure and added the motion
helper, for **645 pins**. All pins passed SHA/length verification before launch
and after shutdown; `stage.cjs --verify` resolved the complete pngjs closure
inside the deployed root. All 168 original media/support pins stayed unchanged.
The registered `dungeon_keeper_demo` route, original media and configuration
were preserved. Source identity is Git SHA
`0029a47340d527ff1d65c8470ef16bb0781cd8ac` plus the retained relevant binary
patches, including new files. Existing media is referenced by path/hash, not
archived. Small helper recovery patches are retained; no source/media archive
was created. Page and guest executing module SHA-256 was
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.

Fresh reviewed original captures are `review/startup.png` (Bullfrog vortex),
`review/menu.png` (Main Menu, imp near Multiplayer), and
`review/locked-menu.png` (still Main Menu; the acquisition click moved the
software cursor to the lower-right edge). The last filename names the intended
checkpoint; it does **not** establish that Pointer Lock succeeded.
The owner-checked read at **14:43:04.664Z**, recovered as `passive-lock.json`,
reports software cursor `(639,479)`, last native position `(320,240)`, relative
mode 1, no held buttons, an empty input queue, two active guest threads, and
`pointerLockElement: null`.

Command 0's Escape and command 1's acquisition click have exact numbered ACKs
and balanced trusted DOWN/UP events. The mouse UP was independently armed
before DOWN and attempted exactly 100 ms later. Command 2 requested four
two-count upward movements against the fresh reviewed menu. At
**14:43:34.570Z** the helper failed `own released Pointer Lock required`, before
the first mouseMoved dispatch. The final native log contains only five events:
Escape DOWN/UP and the acquisition move/DOWN/UP. There was no motion replay,
substitute handler call, guest-memory write, configuration change or second
original runtime. Browser/transport failure is terminal. The exact reason why
the original did not acquire lock was not instrumented. Static code shows its
unchanged registry uses automatic detection, unlike the explicit local sample
profile; that difference is context, not proof of a browser or emulator defect.

The immutable 25-minute cap was fixed from allocation at **14:41:26.256Z** to
**15:06:26.256Z**. Chrome exited normally at **14:43:35.165Z**, code zero.
Recovery verified **61 artifact paths / 2,937,384 bytes** by SHA/length before
normal stop. Custody verifies both owned PIDs absent, no matching live runtime,
server/debug ports closed, profile/writer absent and held input empty. Delegated
normal stop completed **14:44:19.214Z**, `forced: false`; final state is
**ARCHIVED**, current expiry none, original running expiry **15:21:26.108Z**.
No old boat was touched and no lifecycle ownership remains.

The local one-second monitor recorded minimum free disk **2,593,013,760 bytes**;
the remote browser's 2 GB guard recorded no floor event. Monitoring has sampling
gaps, so this is not a continuous disk guarantee. Native qualification, unit
tests, locked build, pin/media checks, retrieval/custody, owned evidence checks
and documentation whitespace passed. There is no candidate manifest entry for
this original, so evidence stays in these notes rather than attaching menu
screenshots to an unrelated dashboard candidate or a gameplay badge.
The global evidence checker still reports the preexisting unrelated Alice
containment error and historical missing artifacts; none belongs to this run.
The local recovery helper was amended to persist individual cleanup predicates
before asserting them; this did not change the deployed runtime pins.

Next work is to qualify bounded trusted continuous motion when the unchanged
original route does not acquire Pointer Lock, or establish the native capture
prerequisite without changing its configuration. This assignment stops at that
exact first blocker; another original runtime requires separate authorization.
