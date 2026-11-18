# Alice Demo: selected live game window and guest mouse capture

Result: the topology/capture repair is tested and published. The exact original
now accepts ordinary menu input and renders Pandemonium loading and an in-engine
3D fly-through. Player-controlled gameplay is **not verified**: no original W or
jump was sent. The final 15-second skip operation was refused before DOWN with
4.7 seconds left before the immutable gameplay cutoff. The evidence controller
made this known ReserveRejected terminal, so it also prevented an ordinary Quit
attempt through that helper. The owned run was cancelled and fully collected;
this is a controller/review-time limitation, not proof that Alice cannot play.

The first-created top-level is not a permanent input/presentation target.
Alice creates a console and a separate game window on the same process/thread,
naturally focuses the game, hides the console and calls SetCapture on the game.
The prior two originals remain closed; neither received input. The earlier
510-sample timeline is missing, with only its exact final two snapshots recovered.
See [the original investigation](alice-local-original-browser-gameplay-20261118.md).

`lib/cli-native-scene.js` now derives the selected top-level from native focus
when no modal exists. Both the original main and selected window must remain
live with valid generations; the selected window must be visible, top-level
and belong to the same process/thread. Any exclusive presentation mapping must
name that window. The hidden console is retained as the real native main;
no Win32 main/focus/capture state is written by this correction.

The exact selected game may own mouse capture while physical keys/buttons are
UP. Keyboard intent still requires the reviewed target to be the actual focus.
Mouse intent requires the reviewed target to be the exact capture owner when
capture exists and still passes reviewed pointer geometry. Foreign, stale,
hidden and modal capture fail. Every intent retains the complete reviewed
window/control context and generations, so a subsequent unrelated window,
focus switch, reuse, retirement or modal cannot inherit the prior review.
The input actor remains unique and registered. Alternative top-level admission
also validates and pins its actual renderer window and creator WASM instance.

These choices follow the separate Win32 contracts for
[SetCapture](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setcapture)
and [SetFocus](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setfocus).
No emulator USER API or original media/configuration changes are involved.

Evidence: `scratch/runs/20261118-alice-native-game-window-capture/`.
An authored PE calls RegisterClass/CreateWindowEx/SetFocus for a visible console,
creates and focuses a second game top-level, hides the console with ShowWindow
and calls genuine SetCapture on the game, then draws through ordinary OpenGL.
With normal Workers and the exact prior 46c9b8e4 module, the baseline contract
rejects this topology. The corrected contract captures it, consumes ordinary W
on the game HWND and acknowledges independent physical UP. Personally reviewed
whole PNGs show the yellow triangle background change from dark blue to red.
No original gameplay is implied by this authored result.

The first authored fixture construction overwrote its wndproc with padding;
the corrected generator bounds its actual startup code before the wndproc.
That failed preparation scope exited and was fully collected. A later inline
preview appeared blank although decoded PNG pixels and a subsequent exact-file
view show the same red triangle. The native scope was conservatively cancelled
before that preview discrepancy was resolved; no blind Escape was sent.

Focused checks cover selected-window capture, keyboard/mouse separation,
unrelated/reused targets, actor/creator/generation mismatch, duplicate actor,
modal conflict, hidden targets, exclusive mapping mismatch and independent UP.
Existing native scene/modal and CLI input-owner regressions also pass.
The locked full build passed after the concurrent host callback-review owner
reconciled its review chain. Runtime correction published as `c14f79478`.

The authored browser reproduces the same real Worker sequence: main 65537,
focus/capture 65538, hidden console and visible triangle. Actual guest and
renderer Worker bytecode both match 46c9b8e4. The whole browser screenshot was
personally reviewed. Its fixed personal-review wait expired before input;
zero browser W edges or browser input consequence is claimed. An earlier
controller preparation attempt incorrectly observed per-instance USER globals
from the host shadow; corrected observations use the actual guest Worker.
Both browser scopes were collected through native supervision, without leaks.

The first fresh original after publication passes the corrected runtime
readiness contract on the live focused game. Its launcher nevertheless wrongly
required capture to become nonzero before taking the first frame. This caused
an avoidable preparation timeout: 457 of 542 retained samples already qualify
as a selected live game without capture. That scope is closed, fully collected,
with no capture, binding or input. `waitGameWindow` now accepts the qualified
selected game with either no capture or valid self capture; it keeps the same
finite 60-second passive deadline. Tracked predicate tests and the retained
original observations demonstrate old-fail/new-pass without reopening a scope.
An affected fresh original follows publication of that preparation correction.

Preparation correction published as `4af0d4ba5`. Its affected original captures
the genuine game top-level while the console is still visible, then after the
console hides and the game owns SetCapture. Both captures pass the reviewed
runtime contract; the first whole frame is gray and the second black, not a
gameplay claim. Console text reports client/common/sound initialization.
A read-only diagnostic mistakenly referenced `threadManager`, which is absent
from controlEval's explicit parameters. The known ReferenceError was recorded
and the helper closed; that scope was cancelled with zero binding/input and
actual native/watchdog/EOF collection, without later endpoint calls.
The corrected diagnostic uses only documented evaluator parameters and passes
both an exact-parameter regression and a real authored native endpoint. Its
authored observation records six genuine GL presentations. A subsequent
authored bind independently rejects an expired reviewed image; zero extra W
edges were sent in that scope.

The input helper also separates the fixed ACK deadline from pulse duration:
a 400ms ACK for an 80ms requested pulse is permitted by a 500ms confirmation
policy, while a 501ms ACK and the operation deadline remain rejected. Independent
physical UP keeps its original prearmed deadline. The earlier authored W
actually acknowledged in about six milliseconds, with whole-frame capture
about 119ms; no original input latency has yet been measured.

The owner's 05:31 timing clarification permits calibrated finite personal
review allowances before fresh captures. Actual authored operations expired
the old 15s game/30s browser review allowances before input. New native captures
therefore pin game60s/menu90s review limits at original capture time, with
strict expiry, unchanged original timestamps, exact retained bytes and full
live process/thread/window/control verification immediately before consumption.
Tests accept a 20s review and reject the exact 60s boundary. The original
3000ms observation/operation, 500ms confirmation and independent physical-UP
deadlines remain separate. No expired scope or image is reused.

The next original reaches a genuine fully rendered Alice main menu, personally
reviewed as a whole frame. Its ordinary Enter is consumed on hwnd65543/tid1
through PeekMessage PM_NOREMOVE in 908ms, with independent UP acknowledged.
The evidence controller incorrectly borrowed Drakan's stronger removal check;
it closes this scope without any subsequent endpoint request or visual-effect
claim. The corrected Alice receipt validator matches the production USER-return
contract: kind2 permits PM_NOREMOVE, while kinds1/3 require removal. Exact owner,
epoch, nonce, message, window/thread, consumption boundary and immutable deadline
remain mandatory. Focused negatives cover foreign target/thread/nonce and invalid
non-removing API kinds. Fresh operation policy allows 2000ms confirmation,
3000ms independent fallback, 5500ms physical-UP and 8000ms total operation,
chosen before dispatch from measured 908ms original consumption latency.

The fresh authored browser-production control subsequently completes ordinary
Chrome Input -> DOM -> production renderer W DOWN and independently armed UP.
Its personally reviewed before/after whole-page PNGs show the same yellow
triangle changing from blue to red. Exact guest USER main/focus/capture,
PID/TID/generation/liveness and renderer/window/creator/queue/manager/port/bridge
identities are verified immediately before input. Both actual guest and renderer
Worker bytecode hashes equal 46c9b8e4. Browser and supervisor actually wait to EOF
and retain leaked=false; earlier expired browser scopes remain closed.
The corrected finite native controller independently reproduces the same W
visual effect in authored-policy with its calibrated deadlines.

The affected original visibly advances from main menu to Easy/Medium/Hard/
Nightmare after ordinary Enter. The next Enter is also consumed and physically
released, but an evidence-controller save wrongly treats the mutable
last-intent index as write-once. This scope closes without a later endpoint,
so no level-loading or gameplay consequence is claimed. The fix preserves all
per-operation immutable files and replaces only the last-intent index after
successful consumption and independent UP, as the established Alice helper
already does. A fresh authored test executes two consecutive finite reviewed W
operations successfully. Its attempted Quit is refused before DOWN by a
separate review-write ordering error; the initial reserve check now precedes
the review without demanding the not-yet-written review file, and the complete
review-dependent policy is still enforced immediately before DOWN.
The fresh authored Quit test subsequently consumes ordinary Escape, acknowledges
independent physical UP and exits through the fixture's normal key-UP handler.
No post-exit capture is requested. The controller records completion separately
from actual native/watchdog/EOF collection. All these preparation errors and
closed scopes remain explicit; the next original uses the tested sequence.
The PM_NOREMOVE distinction is also explicit in Microsoft's
[PeekMessage contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-peekmessagea):
retrieval can leave the message queued. The runtime's confirmed owner-return
receipt therefore does not by itself claim later dispatch or a visual effect;
those claims require the retained post-input frame.

Final affected original `original-sequence` uses the same exact 16 media pins,
46c9b8e4 module and recorded immutable source closure. Its launch records the
2000ms ACK / 3000ms fallback / 5500ms physical-UP / 8000ms operation policy before
startup, alongside native900/watch920 and the 180-second Quit reserve. Two
ordinary reviewed Enter gestures consume on hwnd65543/tid1 with independent UP;
whole frames verify New Game -> difficulty -> Pandemonium loading. A later
reviewed Alice title-logo frame receives one ordinary Escape, also consumed
and physically released. Subsequent whole frames show a letterboxed 3D corridor
and a later corridor camera position without any movement input: autonomous
fly-through, not evidence of user-controlled gameplay.

Before any proposed gameplay gesture, a separate finite slower policy is
validated and recorded (5000ms confirmation, 6500ms independent fallback,
12000ms physical-UP, 15000ms total). No in-flight deadline is changed. The next
reviewed cinematic skip is refused at 1794981899.335 because its full operation
would cross the fixed 1794981904.023 gameplay cutoff; there is no dispatch file.
The controller's catch-all closes the scope even for this known pre-DOWN
ReserveRejected. No endpoint is called afterwards, no guard is erased and no
ordinary original Quit is claimed. Owned cancellation completes at
1794981949.287, with native/watchdog actual waits, both EOFs and no leaks.
No player W/jump or scene consequence is inferred from the moving cinematic.
This bounded task therefore stops at a concrete admission/controller-time
blocker rather than retrying the same original unchanged.

The loading observation plan's first selected capture completed inside its
recorded allowance. The subsequent independently bounded captures are fresh
observations with no input pending; they do not extend that old plan or retime
any input operation. Manual review/controller preparation time materially
contributes to the final cutoff and must not be attributed solely to native
performance.

Final collection verifies 12 owned native scopes with actual native and
watchdog waits plus both EOFs, and all five browser processes with actual wait
and both EOFs. Every containment receipt reports leaked=false. Four early
files named browser `*-supervision-wait.json` contain containment receipts,
not explicit outer EOF fields; only the final browser outer wait records those
fields. Their direct browser EOF receipts are retained separately. The early
passive observer also received an external SIGTERM; its last read completed,
no endpoint failed, and a detached observer continued under the same original
startup deadline. No missing timeline or unrecorded wait is invented.
All 16 media pins and every observed native source/module read pass exact-byte
verification. Selected PNGs and the recovered module remain declared in active
retention metadata. No box was created: ID/state/expiry/stop receipt are
null/NOT_CREATED/null/null.
