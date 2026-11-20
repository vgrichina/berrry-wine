# MCM owner published before first PRESENT

Evidence: `scratch/runs/20261120-mcm-owner-first-present-loading-repair/`.

The earlier original scope remains permanently closed. Its post-Start capture
failed in `PAGE_READ`, but the exact failed predicate was not retained. This
task does not infer that predicate or repeat the original to diagnose it.

The adapter now reports nine boolean refusal predicates from the same page
read: missing layer, missing window, GPU alias mismatch, stale layer, zero
presents, null stamp, zero write sequence, WASM owner mismatch, and process
mismatch. It requests no later diagnostic object after a refusal.

Before capture, a bounded readiness path permits only the pristine Presenter
state: layer/window/stamp null and presents zero, with the live bound GPS
endpoint and registered process. It checks actual guest and renderer identities,
module inventories, executor and context on each observation. Process, main
instance, renderer, Presenter, endpoint, Worker, module, executor, context and
epoch remain pinned while waiting. Only the initial absent window/layer may
become a completed publication. The wait lasts at most 10 seconds and admits
neither capture nor intent while pending. An unknown read, changed owner,
retirement, stale or incomplete publication closes the chain. Input admission
and the post-screenshot read still require a complete publication.

The focused native fixture uses the real compiled D3DIM producer's PRESENT,
native HWND publication, software ring executor and production Presenter. The
qualified `8e7989e5c` chain rejects the pristine owner before capture. The new
chain waits, then captures only after the real native output arrives; green
pixels, native HWND publication and both production layer aliases are checked.
Worker/CDP transport in this fixture is simulated; this is not an original-game
or actual browser-Worker qualification. Negative controls cover timeout,
renderer/Presenter/main-instance replacement, wrong owner, lost context,
executor generation, retirement, incomplete and stale frames. Closed chains
make zero subsequent reads. The existing actual owning Worker CPU Flip,
retained-copy, decoder, filtered compositor and native replacement controls also
pass on the frozen qualified graph.

Run helpers reconstruct the qualified source graph in memory from Git plus the
retained runtime diff, with the owned MCM adapter overlay. The exact retained
module is 2420767 bytes, SHA-256
`f5ae1ac84e3d5e13bb093aca53b8aa2fe18c000cc891587a5d75b46eb559b2ba`.
All 311 original media references were verified without copying media. The
prepared original driver would arm synchronous source observation on the
startup owner before its first reviewed capture or producing input command.
This preparation was not executed against an original process.

The guarded `flock /tmp/wine-build.lock bash tools/build.sh` fails at
`tools/callback-ownership-census.js`: host-file SHA/lifetime reviews disagree for
tracked-clean `lib/dll-loader.js`, `lib/guest-thread-host.js`,
`lib/guest-worker.js`, `lib/ne-guest-bridge.js`, `lib/ne-lifecycle.js` and
`lib/render-worker.js`. Those producer files and the common Hex browser-input
WIP were not edited. This required gate blocks committing, strict publication
and the conditional affected original. Adapter, test and this note remain
uncommitted WIP. Escape/current-display/ordinary Quit are unproved. No original
was launched and no endpoint request was made to any previous closed scope.

Localhost box ID null, state NOT_CREATED, expiry null, stop receipt null. Root
owns shutdown; this task joins its own supervisors and finite watchdogs.

The follow-up evidence is
`scratch/runs/20261120-mcm-tested-first-present-affected-original/`. It adopted
the exact tested adapter/test patch SHA-256
`1fc6dc5291c979d71813f7b673bcbc696f1a7b9792954312ea10946f936a3896`,
reusing the unchanged 29-test and native CPU qualification. Preflight verified
the retained module, all 311 media paths, imports, and qualified arm/producer
contracts before the fixed runtime budget. No archived required input was
missing. The browser served the recovered frozen graph, not current producer
or common Hex WIP.

One affected original was explicitly authorized before commit. The inherited
driver called source arming before capture, which would bypass the new pending
capture readiness. The executed run-local driver instead called the new startup
capture first, then attempted source arming before any input. It recovered and
matched the actual guest Worker's CDP module bytes once. The reviewed screenshot
shows the real hardware-change startup dialog, not quarry loading. Its capture
identity has no render endpoint; it does not exercise a pending GPS publication.

Automatic source arming at that startup checkpoint was premature. The actual
host call threw `live shared legacy render endpoint required`, permanently
closing the runtime scope before any input or successful source arm. The
same-read exception proves the host guard
`!endpoint || endpoint.closed || !this.threadManager`; it did not serialize
those three individual values. No later request was made to fill that gap, and
no individual missing value is asserted. This is a run-driver prerequisite
blocker, not evidence that the first-PRESENT repair failed. The automatic
startup-arm order is not qualified for future use. No replay occurred.

Quarry loading, owning begin/completed source copy, publication binding, Escape,
current-display qualification, ordinary Quit/ExitProcess and guest retirement
remain unproved. Browser shutdown and physical process joins are cleanup only.
The callback census now passes. The first locked full build failed because
the foreign-owned region-map mirror was stale. After the coordinator refreshed
that mirror, this task reran the full guarded locked build and passed with the
exact adopted adapter/test hashes. This worker changed no foreign file, hash
or gate. The passing build permits the conditional own-path source commit and
strict publication, recorded in the follow-up run's publication receipt.
All owned native supervisors, browser, board
watcher and independent watchdog joined with EOF and no recorded process leak;
the temporary profile was removed. Box ID/state/expiry/stop remain
null/NOT_CREATED/null/null; root retains shutdown ownership.
