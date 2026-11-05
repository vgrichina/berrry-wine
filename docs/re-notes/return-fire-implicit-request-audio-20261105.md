# Return Fire implicit requests, terminal persistence and audio, 2026-11-05

The tested harness remedy worked in the single original: implicit favicon and
optional build-info 404s were accepted, and every terminal result/final-pin file
was persisted. The attempt then stopped at a new mandatory-status boundary,
the static server's HTTP 404 for dynamic `/__bundle` font prefetch, before guest
audio startup. No second original ran.

This run-specific harness accepts only the specifically absent browser favicon
and optional local build-info HTTP 404s. Mandatory resources still require their
expected status, pin and matching response body. It persists the immutable first
failure before starting normal browser close, bounds response-body settlement,
and writes truthful terminal results and final pin audits through rejection or
cancellation. No audio engine defect or engine change is established.

Inputs are the preserved published `94d1d6236caa5bf7bb822a349f81446acf026271`
request-closure note and its `driver.cjs`, `full-entry-mock.cjs`,
`favicon-boundary-fixture.cjs`, `pending-receipt-fixture.cjs` and `discovery.cjs`.
The prior audio-cause and playback-observation notes were also read. The previous
sole original proved manifest 200 and stopped at implicit favicon 404 before
guest/audio observation. Its missing result/final-pin artifacts remain absent;
the deliberately unresolved-body fixture is a sufficient causal model, not
identification of that original's actual pending promise.

New small executable amendments and evidence are in
`scratch/runs/20261105-return-fire-implicit-request-audio/`. Existing original
drivers, pins, results and media are referenced in place and hash checked.
`used-composed-driver.cjs` and `driver-amendment.patch` preserve this run's exact
small executable composition. Git SHA, relevant binary diffs and new-file patches
provide source recovery; no source-tree snapshots, archives, media/module copies,
npm changes, worktrees, agents, boats or deployments are made.

The absent `/favicon.ico` is a browser-generated request: the navigation HTML
does not declare it. Its explicitly accepted absence is distinct from the
optional absent `/build-info.js`. Acceptance requires exact pathname, status 404,
no pin and no existing file. A present favicon/build-info file must satisfy the
same pinned 200/body requirements as other existing resources. Every other
non-200 status fails. HTML/dependency discovery still rejects missing required
resources, including a declared missing icon; response hash, absent-pin and
served-file hash guards remain enforced.

Each required 200 receipt has a two-second settlement bound. Rejected bodies
fail; timed-out or cancelled bodies remain explicitly unverified. They are never
relabeled successful hashes. Final receipt completeness distinguishes accepted
optional absence from verified required bodies. A still-pending required body at
otherwise normal completion becomes a failure before close. The first-failure
record is synchronously written once and deeply frozen; later errors preserve it.
The operation races against that failure signal, so a pending navigation,
observer or body wait cannot prevent terminal finalization. Local receipt waits
are cancelled before normal Chrome close. Browser-close settlement retains a
60-second bound; the owned HTTP server cancels remaining connections after a
250ms grace. Cleanup failure stays explicit and never claims a verified normal
exit. Final pin read failures are recorded rather than suppressing final output.

All terminal paths write `runtime/result.json`, `runtime/terminal-result.json`,
`runtime/receipts-final.json`, `runtime/driver-final.json` and
`runtime/final-pins.json`; the original entry also writes `driver-result.json` or
`driver-error.json`. An observed failure exits nonzero. These are actual final
artifact assertions in the offline tests, not an inference from outer exit 0.

Offline validation reuses unchanged eight boundary scenarios, four
identity/source/clock/peak negatives, serialized page/Worker preload, all 58
original payloads, 37 PCM spans/table entries and nine loaded instruction pins.
The changed real-filesystem/HTTP composition uses the public plain Puppeteer
injection boundary; public launch and native ChildProcess spawn prohibitions are
independently exercised, with zero Chrome. The prior favicon rejection is red;
the new complete entry accepts both specific optional absences, verifies mandatory
bodies and reaches the mocked running-host-delivery classification. Mandatory
404/500, wrong hash, unpinned 200, rejected/unresolved body, cancellation,
unresolved navigation, rejected/unresolved close and incomplete-at-normal-close
cases assert the actual immutable failure and terminal/final-pin files. These
are harness fixtures, not execution of original guest audio or listening evidence.
Existing worklet routing, mixer and original recovery tests also pass.

No production source/helper/test/module change is needed, so this lane has no
production full-build requirement. MDK and Stronghold files are not edited.
Runtime and any shared production/build work wait for Stronghold0130 FINAL
runtime AND file RELEASE with all builds finished and independent exact normal
cleanup. The source-only MDK0145 note does not block. One original is authorized
only under the exclusive `/tmp/wine-local-runtime.lock`, with no other local
Chrome/heavy runtime. Hard cutoff is 03:40Z and cleanup 03:43Z; existing relative
readiness/overall caps and maximum 30 seconds after readiness are unchanged.
The route keeps `defaultViewport:null`, indexed8, default audio and trusted
ordinary Play/H/W. The first post-Chrome fault stops the attempt; diagnosis then
remains offline, with no second original or live driver changes.

The one original followed Stronghold0130 final publication/file release
`60c888e0492b08bdaac640fae3a900a35eb6fe6a` and all builds finished.
`releases-verified.json` independently checked actual normal Chrome exit,
exact Chrome/Node/flock identities and startticks, refused HTTP/DevTools ports,
removed exact launch profile, no other Chrome/heavy runtime, and free runtime/build
locks. The composition was resealed against that final source before launch.
Actual source identity is the same Git SHA, with zero relevant tracked
uncommitted hunks and the existing untracked runtime-dependency patch. The
1,529 existing path/size/hash pins include unchanged canonical modules
`e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412`
and `66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8`.

At 02:02:44.142Z the immutable first failure was written for HTTP 404 on
`/__bundle?f=fonts%2FSystem.fon&f=fonts%2FMSSansSerif.fon&f=fonts%2FFixedsys.fon&f=fonts%2FCourier.fon&f=fonts%2FTerminal.fon`.
The unchanged strict status policy rejects this unclassified dynamic endpoint;
it is neither designated optional pathname. No live policy, server, observer,
closure or audio change was made. Normal close followed immediately. Both
specific optional 404s had already been recorded with distinct accepted-absence
policies. Manifest 200 was verified at 598 bytes and SHA256
`f44557ea85c2a47ea82fec369c92b1c4d6c2d431a9aa3e46e7aeb4118b5e6821`.

There are 114 actual response receipts: 106 verified 200 bodies, two accepted
optional absences, one rejected dynamic-bundle 404 and five cancelled 200 font
body receipts. Cancellation is explicitly unverified; final receipt completeness
is **false**. Server successful sends total 369, including preflight and sends
whose browser body verification was interrupted. These counts are not the
2,032-send offline composition. All 1,529 final file pins remain unchanged, with
no read errors; that separate file audit does not verify cancelled HTTP bodies.

`driver-result.json`, `runtime/first-failure.json`, `runtime/result.json`,
`runtime/terminal-result.json`, `runtime/receipts-final.json`,
`runtime/driver-final.json` and `runtime/final-pins.json` all exist and agree.
The failure record's filesystem timestamp precedes or equals the normal-close
request timestamp; offline close callbacks also assert it exists before close.
Node and its parent flock truthfully exited 1 for the observed fault. Chrome and
all adopted Chrome children exited normally with 0/null. This is actual terminal
persistence through first-fault closure, unlike the prior outer-exit-0 gap.

The last observation contains page preload and canonical-module compilation,
zero owning Worker bindings and zero audio/API events. There was no native Play
readiness, trusted control, screenshot or post-readiness window. No fresh capture
exists to view. Timer/acmMetrics50, device/primary HRESULTs, original PCM
load/Lock/Unlock, sound-enable/device gates, Duplicate/ordinary Play returns,
owning host voice/source, AudioContext time, gains/mute and analysers remain
**unobserved**. Peaks alone would not prove audible output.

Offline source inspection identifies the new boundary: `test/static-server.js`
serves files and has no dynamic bundle endpoint; `tools/dev-server.js` implements
`/__bundle` through `lib/file-bundle.js`. `host.js` `_prefetchBundled` deliberately
falls back to individual file requests on static hosts when the bundle request
is refused. Thus this 404 is not proof of missing font assets or an audio defect.
The original's five individual font response bodies were cancelled during close,
so their completed fallback is not claimed. `bundle-boundary-fixture.cjs` replays
the exact used driver's rejected URL through real FS/HTTP, changing only mock
evidence destination, with public/native spawn forbidden and zero Chrome. It
also independently verifies all five individual pinned font bodies return 200.
This replay does not execute the guest or change the used original driver.

Normal Chrome close completed at 02:02:45.859Z: PID 1670078, startticks
189136599, exit 0/null. Node 1670036/startticks189136294 and parent flock
1670035/startticks189136293 disappeared. Independent cleanup at 02:03:04.161Z
finds HTTP 35257 and DevTools 33395 refused, no Chrome/profile users, exact own
profile removed and external runtime flock free. No kill fallback or second
original occurred. Box lifecycle remains with the coordinator.

Only this note is committed. The tested run-specific remedy and all used inputs,
pins, results and explicit incomplete receipts remain in the evidence run. The
next separately authorized observation needs an offline-qualified dynamic-bundle
serving/fallback policy while preserving actual file/body/pin and required-status
guards; it must not infer successful original fallback or audio from this run.

Box ID/state/expiry: N/A. Coordinator retains shutdown ownership.
