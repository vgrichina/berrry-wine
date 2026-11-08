# TR2 native OK attempt — 2026-11-08

**Native OK was not activated. This attempt failed because the worker repeated
the image-review error explicitly identified in the handoff. No emulator defect
or persistent Graphics absence is established. Current Venice controls and all
presentation rates remain unqualified.**

Evidence is in `scratch/runs/20261108-tr2-native-ok-current-control/`.
No emulator code changed. Only this note is committed.

The released prior-run correction was checked against original-resolution
images and hashes: startup, fresh-graphics and refresh-graphics are byte-identical
and contain Graphics; only final native-after-idle differs. The same pattern
occurred in this new run. Its `startup.png`, `fresh-graphics.png` and
`refresh-native.png` are all SHA-256
`964fd8396fb7b73def05796add7c09a02f01dc0f65feb1930d87f8315b8bf133`.
They contain the Graphics sheet and visible OK. The worker nevertheless
described fresh/refresh as desktop-only in intermediate commentary. Those
descriptions are invalid. This is an operator review failure, not evidence of
an image decoder, capture tool, renderer or emulator defect. Final
`native-after-idle.png`, SHA-256
`e9bfc73f3e7e375dbb5479c85403403bb2e63f8906eb0a8f70da6e44b670691e`,
shows the desktop. Read-only metadata reports the dialog visible at publication
sequence 5; its metadata does not settle why final composition differs.

The first three captures were at 05:55:34.495, 05:55:40.210 and 05:55:48.489 UTC;
final idle was at 05:56:52.462. The 12-second admission window was not used to
activate OK. No native guest mouse/key request was sent, no stale image was
used for input, and there was no original replay or transport UNKNOWN. Four
exact successful ACKs cover three passive captures and normal quit. Browser
preflight independently delivered five balanced trusted key pairs on about:blank.

The actual reused mouse driver's local mocked-CDP test passes: normalized
canvas point `[0.6, 495/691]` with canvas rectangle `(10,160,605,691)` produces
native viewport `(373,655)`, the visible OK center on these images. A pixel-valued
point is rejected with zero send effects. Balanced independent release, strict
owner/module/freshness checks and atomic ACK/sticky-UNKNOWN controls pass their
local tests. These checks do not constitute native OK activation or gameplay.

The unchanged production route was
`index.html?debug&threads&app=tomb_raider_2_demo&gl-renderer=webgl&d3d-renderer=webgl`.
Published source commit was `957b861cd7c930f842f89504f87512ce36ea93f3`.
The actual guest Worker module is SHA-256
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`;
no owning WebGL endpoint or context was created. The registered media and guest,
config, clocks and seed were unchanged. Runtime pins, Git SHA, relevant worktree
diff, helper patches and media path/hash references are retained; no source or
media archive was made. PNG CRC/inflation, module identity, successful served
response hashes and exact ACKs were checked locally.

No control acceptance or frame collector was reached. Persistent terrain-relative
Up displacement, separate heading and weapon response are unproved on this run.
Queue, rAF, publication and content-change counts were not reported as logical
game FPS. Collector identity association, overhead, three warmed ten-second
windows, median/p95 pacing, software comparison, full27, parity, audio and
unmeasured FPS remain open. No repair or locked-build claim is made.

One fresh UUID-idempotent box, **bx_crvykarg**, was allocated after observable
independent normal/watchdog delegates were prearmed. Its immutable 25-minute
deadline was approximately 06:20:11 UTC; initial expiry was 06:20:11.191 UTC.
One heavy runtime ran. Local disk samples remained above 6.3 GB; no RAM gate,
resume, delete, deployment or nested worker occurred.

Chrome closed normally at 05:57:01.663 UTC, exit0/signal null. The immediate
drain assertion retained a still-live controller PID; a later read-only check
at 05:57:17.189 verified both PIDs absent, both ports refusing, no profile,
writer or matching processes, and all 598 input pins unchanged. The initial
retrieved `full-drain.json` preserves the failed early check; the settled check
is retained in `settled-drain-remote-result.json`. A second inventory invocation
was refused locally by its exclusive attempt filename before any remote action;
the already retrieved evidence was independently verified before stopping.

All 62 original inventory references, 55 unique hashes, were retrieved and
independently reread for size/SHA-256 at 05:57:17.381 UTC. Final box state is
**archived**, active expiry null, stopped 05:57:18.610 UTC. Normal-stop receipt
**stop_cd90714028f1cf59** completed 05:57:18.630 UTC, forced=false, error=null.
Both delegates exited normally and supervisor children are empty.

Next work needs immediate original-resolution **and hash-correlated** review
of fresh visible Graphics followed by the validated normalized OK activation
within the unchanged freshness deadline. The present run supplies no technical
blocker to that activation; it supplies a documented operator failure. Controls
must work before any presentation-rate qualification.
