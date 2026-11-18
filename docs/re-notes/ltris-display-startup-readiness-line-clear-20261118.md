# LTris SDL startup readiness, 2026-11-18

The startup admission repair is published as `6fe4afd9e`. The sole original
attempt reached the real main menu, then closed on shared disk preemption at
1,599,664,128 free bytes. Controls, gameplay, line clear, score consequence and
ordinary original Quit remain unproved. There was no retry or closed-scope
endpoint request.

Evidence: `scratch/runs/20261118-ltris-display-startup-readiness-line-clear/`.
The final `result.json` describes the bounded failure, not gameplay success.

The production compound owner check can reject `!selected` and the visible
window-count comparison when SDL has exposed its native window but the retained
receipt is still the preceding empty desktop. Fresh actual SDL and original
startup observations show publication 4 with zero window pins, then HWND 65537
at (20,20), 646x507, then publication 5 containing that same window/instance.
The earlier reviewed run also stopped at publication 4, but did not retain its
pin list. Its exact historical predicate cannot be recovered independently;
the fresh causal reproduction identifies the missing selected owner and count
mismatch, rather than a hidden or clipped output. Writer-held samples separately
reject at the earlier unheld-publication check.

`tools/ltris-display-readiness.cjs` handles only this startup interval. A live,
single, fully contained SDL owner may wait for its first ordinary publication
when the old receipt is an internally consistent empty desktop. Replacement,
hidden/shaped/clipped windows, changed geometry, resized/replaced output,
readback errors and expiry fail closed. The production validator still admits
the completed publication. No compound exception is swallowed. The common
renderer and frozen `cf132e191` disk guard were not modified. The run-local
controller also waits within its declared bound for known pre-ticket NOT_READY;
it never retries a ticket or an UNKNOWN scope.

The native test reproduces the actual renderer's old compound failure, then
checks NOT_READY, natural repaint, complete readback and negative cases. Fresh
browser controls show empty-desktop to owner-publication readiness and personally
viewed black menu, green board, red Pause, green resume, blue Left, green Right
and native SDL Quit/ExitProcess(0). Authored4 completed actual process/document
replacement negatives. Authored5 tested the final helper and all display/stale
negatives, then completed native Quit; disk preemption interrupted its later
replacement test. Each of twelve authored key gestures had an independent
matching UP, physical zero and actual release-process close/EOF receipt.
Focused native checks, all 20 immutable-capture regressions and the locked build
passed before publication. Browser evidence is a real startup-to-ready pass;
the exact old compound failure was reproduced natively, not observed as an
uncaught exception in these fresh browser scopes.

Qualification history is retained: two diagnostic scopes, a capture-only
authored setup, an authored setup closed on a wrongly terminal pre-ticket
NOT_READY, and an authored setup preempted at the initial 1.7 GB margin. Fresh
later scopes declared 1.6 GB preemption, above the unchanged 1.5 GB floor. No
closed scope was reopened. There were no timeout extensions.

The sole original used unchanged registration `ltris_128`, `C:\LTRIS`, `-w`, all
43 media/manifest/CRT/ZIP pins and the pinned `cf132e191` source graph. Compiled
and served module SHA-256 is
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`.
Independent executing child module and roles remain unknown; optional child
Runtime/Debugger probing was omitted. No busy-worker probe was made.

Personally viewed whole original frames show the initial black native window
and real menu. A normal Controls click did not produce a Controls screen in the
subsequent reviewed frame. A subsequent Down and its independent UP completed,
but disk closure interrupted the next capture. Both original physical releases
were zero. No game defect or input cause is inferred from this short attempt.

The audit additionally found a controller freshness defect: review was checked
before identity/release preparation, and the Down reached the wire at 15,013 ms
after the saved observation / 15,493 ms after readback. This fails the required
15-second final admission bound. The exact used controller is retained as
`ui-used.cjs.patch` and matched against the original source pin. A post-closure
run-local wire hook now repeats the guard synchronously before DOWN; offline
old-fail/new-refusal and fresh-pass checks use the actual recorded request.
That revision has not been browser-qualified and was not used to retry the
original. The published startup helper's review check itself correctly refuses
the stale request.

Original bounds were startup 180 seconds, total 1200 seconds with a final
180-second Quit reserve, cleanup 20 seconds, transport 3000 ms, independent
release fallback 5000 ms, maximum hold 1200 ms and at most 80 captures. Every
scope has zero ordinary requests after shared closure, no leaked supervised
processes, and browser/direct-controller/supervisor/watchdog/board close waits
with both EOFs. Authored5 and original also retain the outer master's actual
close and both EOFs. Earlier tool-managed outer EOF flags are unavailable, not
inferred. Profiles are removed; the seal checks all recorded PIDs absent.

Selected whole frames, exact source/module recovery, Git binary diffs, owned
new-file patches, media hashes and limits are retained in the run. No source
snapshot or media copy was made. Foreign owners, UT payloads and BloodII hold
were preserved. No workers, boxes, Python, Wine, deployment, solver, OCR,
board-memory reads, autoplay, settings, save or clock edits were used. Box ID,
expiry and stop receipt are null; state is NOT_CREATED.
