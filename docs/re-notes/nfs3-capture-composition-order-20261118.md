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

This corrects capture preparation only. It does not repair the remaining
display-publication discrepancy or prove driving or game input consequences.

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

After the helper (`6423f80a4`) and tested launch correction (`5592ad310`) were
published, one original was actually registered and launched. It retained the
genuine chooser, all 135 verified media files, frozen c9 source plus recorded
published patches and b8c8 module. All eight live owner modules were read back
as b8c8. The whole initial Corvette loading artwork was personally reviewed.
Logical canvas, compositor source and retained layer had equal whole-pixel
fingerprints. Initial diagnostic reads made the old native producer 432 ms
old; the unchanged guard refused it. Ordinary delivery supplied a new native
producer, accepted at age 14 ms with the same owner and generation.

At 236 presents the one post-loading screenshot took 370 ms and was again
white beneath the host strip. Exact PNG CRC/decode counts 1,143,910 white
pixels out of 1,228,800; its SHA-256 is the same `3c8f82d3` as the predecessor
white page. A whole lossless re-encode was also retained for review. Preview
transport remains unreliable; pixel counts and live canvas readbacks are
independent evidence, not a MIME-based inference.

The diagnostic now isolates where those pixels differ. Both the connected
640x480 logical canvas and exclusive compositor source contain 307,200 opaque
white pixels, zero nonwhite pixels, with matching fingerprint 2596822469.
The connected visible 1280x926 presentation contains 1,143,610 white pixels.
The retained 640x480 GPU layer instead contains 307,178 nonwhite pixels and
22 white pixels, fingerprint 200337884. The selected top-level window is
98305 in process 1000 with the actual instance; it is the presenter's exact
window, its current layer remains selected, RT is 3 and layer sequence 21530.
The recorded display backend is canvas-nearest, using the exclusive source
and connected presentation output. Publication is 113, guest slice depth is
1, GDI depth 0, repaint is scheduled and Worker repaint is deferred. These
observations identify a displayed-source/retained-layer discrepancy while
publication is pending; they do not establish the causal producer or justify
changing the compositor's publication fences. The earlier native association
observation had matching DIB, creator, positive window/RT sequence and CPU
stamp 1; no separate native DIB table read was taken at the final capture.

The guard immediately before diagnostic reads was ready with a 44 ms-old
producer. After the reads it correctly refused that producer at age 294 ms.
After ordinary delivery it accepted a new producer at age 34 ms, with the
same selected scene and owner. One retained receipt had 318 ms transport
delay through readback; it was not relabeled fresh. The 250 ms producer fence
and exact target checks remain intact. Thus admissible native context alone
does not certify that the current display contains the retained GPU frame.

The white image supplies no reviewable cockpit. The scope was closed UNKNOWN
without binding or sending any physical input, and with zero later owner
endpoint requests. No unchanged retry followed. Throttle, steering, Pause,
Continue and ordinary game Quit remain unverified; browser cleanup is not
Quit. No speculative graphics repair was made.

Focused ordering/identity negatives, passive scene preparation and existing
native input/deadline/release regressions passed, and the locked full build
passed. The final helper control and supported-shell control retained exact
module readbacks and byte-identical authored pixels. Six supervised scopes
completed six actual native waits and six actual watchdog waits, all with
both EOF streams, leaked=false and pollError=null. The two nonzero native
exits were the documented prelaunch negatives. The actual original retained
900/920-second custody and 180-second Quit reserve. No box was created:
ID/state/expiry/stop receipt are null/NOT_CREATED/null/null. No external loss
of this task's owned evidence was found.
