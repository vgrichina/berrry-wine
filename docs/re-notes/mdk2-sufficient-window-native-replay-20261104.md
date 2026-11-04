# MDK2 sufficient-window replay: candidate dependency mismatch before launch

Run `scratch/runs/20261104-mdk2-sufficient-window-native-replay/` stopped at
its first unexpected candidate-dependency failure. No Chrome launched, no game
input was sent, and no fresh capture or menu/tutorial progress was established.
The available allocation had sufficient time for the unchanged 350-second
browser interval before the 11:43Z cutoff; this was not another budget stop.

Verified every size/SHA in both predecessor seals: published
`46449a90c0c7faeb6cfd892c13862b4838c0c784`, 53 files / 187540 bytes, and latest
input `f5c1966e5269342691082d513e86c4b04b2bd63d`, 37 files / 105854 bytes.
Reused the sealed 85 passing controls: 26 unhighlighted/wrapper, 30 pending,
18 scene, 5 predecessor routes and 6 adapter routes. No unchanged control was
rerun or forced guest callback fixture invoked.

Personally VIEWED historical step-3200 `native-selector-76.png` in a separate
image tool call, SHA-256
`52066472b64a5e63e650195bf842ec3221534336121acd7762254c84ccea989e`.
The pixels show readable New Game and a white controller. They authorize only
bounded input-free observation, not highlighted New Game, Medium, pending or
playable readiness. Those stronger predicates remain unchanged.

Fresh small assignment-bound runtime_io/release/wrapper inputs target only
`bx_ejf8j8yx`. The corrected actual wrapper explicitly binds predecessor
`observe-browser.js`. Remote top-level compilation with main disabled passed
all requires and preload execution, assignment RUN and browser OUT, pinned
driver SHA and exact preload bytes; Chrome/main were not invoked. Qualification
at 11:20:17Z passed exact 37/40 sibling input sizes and hashes, all 432 runtime
pins, actual Puppeteer 24.31.0 CJS/ESM imports, isolated HTTP full hashes and
98-page/12-worker cache graph with zero errors. Its private HTTP server closed.
No latest-main module was substituted: original source remains
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, canonical module
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`,
and the pinned companion beginning `580f49f3` remains covered by the runtime
seal. TTL admission 600000ms, shared 540-second anchor, 512 slices and 96 commands
were retained. The launch script was prepared but never executed.

The next candidate-dependency comparison failed at 11:20:36Z. The inherited
remote `20261104-mdk2-unhighlighted-menu-onward/unhighlighted-control.cjs` hashes
`b115459478dfd761fceb568c2125ed8aa6c66c3aecea387a5fe7a93f908c9981`;
the sealed local helper hashes
`b116e469f472a79affd4757850cfc509b618f7c665a3707c1a282b403821a6c7`.
The remote helper lacks the final `showmenu=0` native guard, requires
`transitioning=true` instead of an honest boolean classification, and retains
unused skip-branch code. Exact 37/40 and runtime-pin checks do not cover this
newer candidate helper. The local SHA-equality assertion is the first failure;
it is a preparation failure, not a guest/runtime failure. No helper was replaced,
no failure cleared and no replay retried. There was no browser or command spool
to receive a quit command. Remaining candidate qualification was not claimed.

Recovered all seven unique closed remote files, including the inherited helper,
by complete size/SHA comparison; `recovery-result.json` records custody.
At 11:21:01Z process inventory was empty for Chrome/Node and the new browser
directory was absent. No fresh capture review/input sequencing was reached.
Evidence includes exact Git SHA, relevant binary diff of existing shared-tree
hunks, small owned input patches, the helper difference and first-failure JSON.
No source archives, module binaries or media were copied. Only this note is
committed; no production change, local heavy run or build was needed.

`bx_ejf8j8yx` is left RUNNING, API state idle, health ok, hydrated, expiry
2026-11-04T11:58:35.973Z. Custody returned to the coordinator at 11:21Z; the
coordinator owns shutdown at 11:52Z. No lifecycle action occurred. Recovery
finished before 11:48Z. Publication details are recorded in the run and
messageboard. A separately authorized replay must stage and qualify the exact
sealed candidate helper before launch, preserving the corrected actual wrapper
and fresh VIEW-first review sequence. This single assignment stops here.
