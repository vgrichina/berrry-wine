# GLTron current-browser input qualification, 2026-11-16

Evidence: `scratch/runs/20261116-gltron-current-browser-input-gameplay/`.

**No original was launched. No input/readiness repair is qualified.** A fresh
authored Win32/OpenGL program reached the production fullscreen-consent UI, but
the host screenshot required for personal consent review exceeded the unchanged
3,000 ms CDP deadline. Its connection became permanently UNKNOWN. This is the
new concrete prerequisite failure; it does not establish the cause of an older
GLTron or Quake II failure. The old endpoints remain closed.

## Native workload and observed boundary

The new diagnostic `test/test-gltron-browser-live-input.cjs` generates its own
PE from instructions and strings. It loads no GLTron executable, DLL, config,
media, seed or saved state. The program creates a native window and GL context,
pumps `PeekMessageA`, and continuously issues native GL clear/triangle/swap
calls. Its final variant also calls native `ChangeDisplaySettingsA` with a
480×360, 32-bit temporary display mode. There is no Sleep, synthetic Worker
frame producer, forced paint/end, clock change or deliberate idle interval.

The production browser shell, guest Worker, command bridge, GL render Worker
and compositor execute the workload. The registered fixture has its own name,
`live_input_fixture`; it is not presented as a GLTron original. The actual
recorded guest slice budget is 1,000 blocks. The fixture source/runtime is
independent of shared build outputs: Git blobs are held in memory, the canonical
WATX closure is compiled in memory, and an owned loopback HTTP port serves that
same immutable runtime. Foreign worktree WIP is not adopted. Neither sources
nor Wasm are persisted as a bundle.

Final native-v7 runtime:

- Git: `cf7b23d1129a47d709c3f32b2c3b955d7f650340`.
- Module: `83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`,
  2,279,037 bytes, freshly compiled from that Git closure.
- Recovered guest/render module hashes are retained in `workers.json`.
- Actual GL observation: one current native HWND/context, 79 frontend draws,
  79 presents/transfers, 158 device draw calls, and zero observed readPixels.
- Native display-mode handling produced a visible, enabled, hit-tested
  **Use browser fullscreen** button. Its observed bounds were
  `(351.515625,165,131.875,22)` in a 1024×757 CSS viewport.
- The subsequent `Page.captureScreenshot` failed with
  `UNKNOWN Page.captureScreenshot; never replay`. No PNG, personal host review,
  consent click, guest DOWN, independent guest UP prearm or gameplay followed.

There is no complete native image to review. DOM geometry and handler counts
are observations, not visual consent or game consequences. The observed host
touch-cursor overlay also makes pre-consent canvas-only admission invalid. It
was not exempted from occlusion checks or hidden with CSS.

The GL observer reports WebGL 2.0 and an ANGLE Intel/Mesa renderer string.
The installed Chrome launcher also adds SwiftShader options. A non-software
bridge flag identifies the WebGL route, not a physical GPU. This run has no
independent physical-device attribution and makes neither a hardware-rendering
claim nor an assertion that the reported Intel string proves physical execution.

## What was isolated, and what remains unproved

Source tracing confirms the earlier race remains plausible: the production
renderer holds publication over an executing guest slice, releases at ordinary
slice completion, and can begin another slice before asynchronous identity
reads, module-byte recovery, release-child prearm and final paint checks finish.
The old GLTron helper still performs these operations separately. Quake II's
older bounded passive approach additionally revalidates full identity after a
ready observation; its historical expiries do not qualify GLTron.

However, this task did **not** reach current valid input admission. The final
native fixture fails earlier, while obtaining pixels needed to review host
fullscreen consent. No claim is made that this capture timeout and the older
held-paint admission failure share a cause. No readiness condition, module
identity, complete-frame check or timestamp was weakened to get past either.

The published GL repair `769227f7555d3ff138685e9db86ca14f1eb2734a` was read.
Its 40 checks and all 26 browser cases are scoped fixture results. They do not
qualify all 27 apps, the original GLTron route, trusted native gameplay input,
two human-cycle turns, a natural round result or native Quit. That suite was
not rerun here.

Current qualification still requires fixed 3,000 ms observation, 500 ms
confirmation, independently prearmed physical UP within 1,750 ms, and unchanged
5-second play/30-second menu freshness. The released controller's older
2,000 ms UP assertions were identified and **not accepted as current
qualification**. The two owned helper files remain unchanged. A new positive
native continuous-producer/trusted-input check and the required held-paint,
occlusion, owner-change, late-ACK, stale-scene and no-post-UNKNOWN negatives
have not all passed. Consequently the single conditional original was withheld;
there was no 1,200/1,220-second original launch to consume.

## Development failures, evidence and closure

Earlier development variants are retained with actual process waits:

- v1: Git inventory exceeded Node's default output buffer, before compilation
  or browser launch. Restricting the Git query to relevant paths corrected it.
- v2: wrong browser-shell reference, before native launch.
- v3: production identity refused a host touch-cursor occlusion.
- v4: the windowed native producer's diagnostic screenshot hit the fixed
  3,000 ms UNKNOWN. This endpoint was closed permanently.
- v5: a proposed outside-pointer position did not exist for the full canvas;
  the fixture refused before sending that motion.
- v6: trusted negative-coordinate mouse motion did not move the host cursor;
  complete-output validation still refused. This is not a visibility repair.
- v7: the materially changed native temporary-display-mode variant reached
  ordinary fullscreen consent and encountered the screenshot UNKNOWN above.

These preparations are not seven originals or seven successful qualifications.
Earlier test revisions were not independently pinned at launch; their logs are
diagnostic only. The final new-file patch and owned helper pins are retained;
the diagnostic test remains **unqualified, uncommitted WIP**. This publication
contains the report only, not a code repair. No code commit/full-build PASS is
claimed. The worker cancelled its unused canonical-build queue and never held
shared source/build output readers or writers during a foreign build.

The separate bounded loopback negative exercises the unchanged real CDP
connection against a late screenshot reply, wrong response session and socket
closure. It checks permanent closure and zero later input, capture or rebind
requests. It is transport evidence only and supplies no native-input positive.
Syntax checking and all 92 existing GLTron media hashes were checked without
copying media. The final result records exact hashes and actual validation waits.

Seven native-test child waits and seven prearmed independent-watchdog waits,
plus six Chrome waits, have actual exit/EOF records. All recorded PIDs and all
seven native process groups are absent; loopback ports are closed and Chrome
profiles removed. Detached browser descendants were not individually inventoried
before exit; the final audit separately checks that no task-profile Chrome
process remains. That inventory limitation is explicit, not filled with assumed
PID receipts. Watchdogs did not fire. Browser teardown is not native Quit.

Selected screenshots: none; failed screenshots do not create image evidence.
Git and owned patches are the source archive. No source tree, Wasm, game media
or capture bundle was archived. `/home` stayed above the 1.5 GB free-space floor.
Box ID null, state `NOT_CREATED`, expiry null, stop receipt `N/A`.

The next prerequisite is a causally repaired, bounded complete-host-scene route
under an actual continuous native producer, followed by native input/fault
qualification at the unchanged limits. No original retry, full-27, FPS, audio,
parity, human win or game/native-Quit result is claimed. This worker stops.
