# GLTron current native capture qualification, 2026-11-17

Evidence: `scratch/runs/20261117-gltron-current-native-capture-round/`.

No original has been launched. The continuous authored Win32/OpenGL fixture
has produced a bounded public current-display observation and a complete host
screenshot, but the retained source was entirely white. The later host image
shows the triangle. These observations have different timestamps; they do not
establish an incorrect readback of the same display publication. No production
capture/input repair, initialized-scene qualification, trusted guest input,
two turns, natural round outcome or native Quit is claimed.

`tools/gltron-current-native-capture.cjs` preserves the earlier authored PE
byte for byte (SHA-256
`a282fde427480359786e060285a52a0cb94517e2df9ab7a40a9b91bb90e43bbf`).
It continuously pumps native messages and issues GL clear/triangle/swap calls,
with native temporary display mode and unchanged 1,000-block slices. It uses
the current Git runtime and canonical WATX compiler in memory, with no foreign
worktree source, source archive, original media or shared build outputs.
The actual guest/render Wasm bytes are recovered with Debugger and checked
against the compiled module. Unique tested modules are retained once.

The browser uses the existing local Puppeteer/Chrome route, explicit ANGLE
SwiftShader launch options and real clocks. WebGL reports an Intel/Mesa string;
that string is not independent physical-device attribution. No physical GPU,
FPS, audio, parity or full-27 inference is made.

## Bounded observation

The diagnostic `native-bounded` used Git
`799439f0a8e508f22d760666438acba811147315`, with its recorded owned helper
patch. Runtime source/module and helper patch are separately identified; this
development run is not a published-helper qualification for an original.

The single current-display request armed during a real writer hold and pending
host presentation. It completed on ordinary publication 5 in **1,539 ms**:

- Request: `1794891302545`; display: `1794891302619`.
- Readback start: `1794891302620`; completion: `1794891303651`.
- Complete source: 480 by 360, all 172,800 pixels opaque white.
- Complete output: 940 by 649, white content and black side gutters.
- A later read after publication advanced to 7 had **zero byte mismatches**,
  identical original metadata/timestamps, terminal `complete`, and cancellation
  returned false. Retention success does not certify the initial scene.

The separate unchanged full-host request
`Page.captureScreenshot({format:'png',captureBeyondViewport:false})`
completed in **2,299 ms**. Personal review shows the ordinary fullscreen
consent strip, native yellow triangle/dark blue background, shell and runtime
log. Canvas-only input admission remains invalid: the real touch-cursor DOM
overlay intersects the output and is neither hidden nor exempted.

Current native GL uses the GPU stream route. The legacy GLTron binding's
`options.api === 'gl'` lookup reports no GL endpoint on the observed current
route, despite an actual render endpoint and device draws/transfers. This
source/observation mismatch is a further unqualified owner-binding boundary;
no legacy-GL identity is substituted for current GPS ownership.

## Earlier preparations and limits

Two browser preparations stopped before DevTools opened. The new harness's
initial direct-spawn startup check did not account for this installed browser's
own timezone probe. The existing Puppeteer launch preparation reaches the
native scene; capture/input deadlines were not increased.

`native-puppeteer` first awaited the ticket in a single CDP evaluation and
became permanently UNKNOWN. The diagnostic `native-final-poll` armed once
and observed pending publication 7 while slices advanced 22 to 32. A final
individual poll could outlive the total observation budget, so its 5,426 ms
failure is **diagnostic only, not a 3,000 ms qualification**. The final helper
adds an independent overall 3,000 ms close timer; an earlier preparation was
cancelled before browser acquisition to preserve permanent-close teardown.
No endpoint was rebound, queried after UNKNOWN, or reused for an original.

The final helper observes existing current-display tickets only. It never
forces idle, flushes, calls manual render, schedules a repaint, releases a
writer or changes a clock to obtain pixels. A completed ticket's historical
bytes are independent of current input authority. A full native input/focus/
owner/generation/readiness positive and cancellation, late paint, context loss
and retirement matrix have not passed here. The unchanged 500 ms confirmation,
independently prearmed 1,750 ms physical UP, 3,000 ms completion, and 5-second
game/30-second menu freshness remain prerequisites. The old controller's
2,000 ms UP assertions are not accepted as qualification.

The conditional original is withheld, so its fixed 1,200-second native guard,
1,220-second independent watchdog and 180-second Quit reserve are unconsumed.
All original media/defaults are untouched and no original endpoint was opened.

## Checks and shutdown

The canonical flock build passed; it is a separate shared-tree gate, not the
immutable native fixture module. Its post-build shared diff and module hashes
are retained. Fixture byte equality, JS syntax and the focused retained-image/
timing/actual-wait verifier passed. The verifier explicitly returns
`qualified:false` and does not turn a partial observation into gameplay proof.

The reused published Boids supervisor prearms independent preparation/runtime
watchdogs, uses pinned process identity, and retains actual subprocess waits
and observed pipe EOF separately from regular-file logs. Development nonzero
exits/signals remain recorded. Successful bounded observation has native,
both watchdogs and browser actual wait 0 and both pipe EOFs. Profiles and scoped
processes are removed. Browser teardown is not guest native Quit. Worker target
destruction is not inferred from an empty CDP closure-event list.

The next real boundary is an initialized native GL publication whose complete
retained pixels match an independent literal oracle, with actual current GPS
owner identity, followed by the full native input/fault qualifications. An
intermittently successful host screenshot alone does not satisfy that boundary.

No boxes, other workers or public deployment. Box ID null; state NOT_CREATED;
expiry null; stop receipt N/A. Git and recorded binary patches are the source
archive; only named selected images and unique tested modules are retained.
