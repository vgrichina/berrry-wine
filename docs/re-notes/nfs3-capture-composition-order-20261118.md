# NFS III capture composition and read ordering, 2026-11-18

Evidence: `scratch/runs/20261118-nfs3-capture-composition-order/`.
All predecessor UNKNOWN scopes remain closed.

The exact authored 64-draw Device2 control uses frozen c9 browser sources,
published host-step lifetime corrections, the b8c8 repaired module and normal
guest/render Workers. Its complete blue rectangle and white background were
personally reviewed. The actual connected logical canvas and retained native
layer have the same whole-pixel fingerprint (328607173), 76,800 nonwhite pixels
and 230,400 white pixels. Four actual owner module readbacks match b8c8.

The new read-only helper records wall and absolute monotonic clocks immediately
before and after every synchronous canvas read and every guard evaluation.
In the first native comparison, the connected logical read took 113.75 ms,
the presentation read 104.25 ms, the backing read 28.76 ms and retained-layer
read 20.82 ms. The initial guard was ready with a 50 ms-old producer. After
the synchronous reads the unchanged guard correctly refused the same producer
at age 320 ms. This is a measured observer-ordering failure, not evidence
that the screenshot itself returned with stale native context.

An ordinary timer turn permits queued metadata delivery within the original
fixed three-second operation. The first reevaluation still refused the old
producer. Ten milliseconds later a genuinely newer producer was 11 ms old,
and the existing guard passed with identical scene, process, thread, window
generation and target references. No old timestamp was renewed. No guest
poll, wake, clock write, focus change, input or graphics mutation was added.

The helper pins the owner, native endpoint, Worker, window object, instance,
process, renderer, source and output canvases, and render endpoint. It checks
the selected top-level target and native layer again after delivery. Regression
cases reject stale producers until the fixed deadline, retirement, endpoint
or Worker replacement, reused HWND objects, foreign process/instance, source
replacement, generation change, hiding and a target absent from the selected
composition. Physical input retains its separate existing guard, immutable
in-flight deadline and independently prearmed UP.

This corrects capture preparation only. It does not establish why the previous
original screenshot was white, or prove driving, throttle, steering, Pause,
Continue or Quit. Fresh original results and final custody receipts are added
after publication and review.

The first fresh page attempt stopped before registering or launching the
original: clicking the hidden debug-toolbar Launch button failed. Its actual
native/watchdog waits and browser EOF completed. The supported production
agent launch action in `lib/agent-remote.js` uses the registry select followed
by the public `launchApp()` function; it does not click that hidden button.
An authored heavy native control reproduced the hidden-button refusal and
passed through that supported route, with the same native module, scene,
composition pixels and normal Workers. Its normally selectable Notepad
catalog entry carries only the authored executable; Rock & Roll is absent
from the normal selector, as a separate prelaunch negative confirmed. Neither
prelaunch failure registered an original or sent physical game input. The
corrected driver follows the existing public shell launch route without
changing shell/runtime code, guest state, focus or scheduling.
