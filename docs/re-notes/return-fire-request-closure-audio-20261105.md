# Return Fire request closure and audio observation, 2026-11-05

The HTML manifest discovery correction is tested and worked in the sole original:
`manifest.webmanifest` returned HTTP 200 with its pinned hash. The attempt then
stopped at its first new harness boundary: Chromium's implicit `/favicon.ico`
request returned HTTP 404 and the strict status guard closed the browser before
guest startup. Startup, populated Play and host delivery remain **unobserved**.
No audio defect or audible-output claim is demonstrated. No second original ran.

This assignment corrects the run-specific observation harness's HTML discovery.
The previous sole original stopped before guest startup because its pin collector
omitted HTML-declared `manifest.webmanifest`; the server returned HTTP 500 with
`served-pin-mismatch`. That actual failure, used driver, pin inventory and results
remain intact in `scratch/runs/20261105-return-fire-playback-observation/` and
published note `533e8faad7bee6f29e123acf3e9febe5b1b40b84`. That attempt demonstrated
no audio defect. Read `return-fire-playback-observation-20261105.md` and
`return-fire-audio-cause-20261105.md` alongside this note.

Accepted launcher `5d014a0e` and movement/presentation `9f695796c` remain unchanged.

New evidence and small executable inputs are in
`scratch/runs/20261105-return-fire-request-closure-audio/`. The amended driver
executes the prior driver as an input with explicit, reviewable substitutions;
`driver-amendment.patch` records them. It adds discovery and HTTP preflight,
redirects evidence to this run, renews the absolute cutoff to 02:40Z, distinguishes
the optional local `build-info.js` 404, and closes the sole actual browser on the
first observed fault. Relative readiness/overall caps, the maximum 30-second
post-readiness observation, default audio, `defaultViewport:null`, indexed8,
trusted Play/H/W route, passive observer, receiver/argument/result preservation,
loaded instruction pins and original guest/media inputs are retained.

Discovery starts at the actual navigation HTML, using Python's HTML parser to
extract resource declarations without treating hyperlinks or strings inside
scripts as resource tags. The actual parser-time versioned-script loader executes
in a restricted VM and its generated script tags are parsed. Discovery follows
local literal JS dependencies, manifest icons, CSS URLs and WAT includes. The
prior original's actual HTTP ledger supplies additional executed dependency
seeds, explicitly labeled with that provenance. A broad existing path/hash
inventory remains an additional serving guard. The mock navigation fetches the
actual HTML over HTTP and independently derives and fetches the discovered
requests, instead of selecting three known responses. Each required discovered
file must exist and have a matching pin and HTTP body. Only the specifically
absent `build-info.js` is allowed HTTP 404; missing required resources reject.
Dynamic/conditional execution beyond these discovered edges remains subject to
the actual response and served-body guards; offline discovery is not a claim
that every possible application request was executed.

Offline validation includes the exact prior driver's omitted-manifest HTTP 500
reproduction, unchanged eight boundary scenarios and four identity/source/clock/
peak negatives, serialized page/Worker preload checks, original 58-file and 37-PCM
span hashes, actual amended-driver real-FS/HTTP composition, and discovery/pin
wrong/missing/hash/required-404/body-corruption negatives. The post-launch
first-fault fixture also prevents review/input and closes once. Public plain
Puppeteer launch and native ChildProcess spawn are independently forbidden and exercised;
these tests launch zero Chrome instances. Existing owning-API observer, host
worklet routing, mixer and Return Fire recovery tests pass. Initial negative-test
harness expectation failures remain in separate logs; they did not launch Chrome
or mutate originals.

No production source/helper/test, module or media changes are made by this lane.
There is no production code change requiring a full build. Shared MDK/Stronghold
files are not edited. Git SHA plus relevant binary diffs and new-file patches,
and existing input path/size/SHA256 inventories, provide recovery evidence;
there are no source/media/module snapshots, tarballs or npm copies.

The single original ran only after Stronghold0104 final publication/file release
`7c73cca30` and MDK0120 final runtime/file release `3c0035701`, with their builds
finished. `releases-verified.json` independently rechecks actual normal exits,
exact PID/startticks, refused ports, actual launch profiles, absence of other
Chrome/heavy runtime and both runtime/build locks. The first verifier used a
`launch-request` record that MDK does not emit; it failed offline before Chrome.
The corrected verifier derives the exact profile from the actual spawn arguments.
That initial failure log is retained. The parent flock held the exclusive
`/tmp/wine-local-runtime.lock` inode 141907 during this sole attempt.

Actual input identity is Git `3c003570163ff597451548fada77bf3b6a098625`, plus the
recorded relevant uncommitted/new-file patches. `runtime/pins.json` contains 1,529
existing path/size/SHA256 records. `served-closure-delta.json` compares this list
with the preserved prior list; no old path is removed. The actual retained prior
`runtime/pins.json` has 1,527 files; its mock's 1,530 successful sends included
three navigation fetches. The prior note called 1,530 entries pins; this new audit
uses the actual retained list without altering that note or its used inputs.
`manifest.webmanifest` and the existing `build/nfs2se-browser.json`
dependency discovered in runtime code are newly included.
The canonical modules remain `e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412`
and `66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8`.
The new run does not copy either module or any media.

The 252 discovered requests passed real HTTP preflight, with only `build-info.js`
returning the explicitly allowed 404. The sealed composed mock recorded 2,032
successful sends across pin checks, discovery preflight and mock navigation.
These are distinct counts from the actual browser's 104 response receipts:
102 matching 200 bodies and two 404s (`build-info.js` and `favicon.ico`). The server
recorded 356 successful sends including 251 successful preflight sends and requests
whose body receipt was interrupted by closure. Actual matching manifest body:
598 bytes, SHA256 `f44557ea85c2a47ea82fec369c92b1c4d6c2d431a9aa3e46e7aeb4118b5e6821`.

The original's last observation snapshot predates the favicon fault: it contains
one page preload event, zero owning Worker bindings and zero API/audio events.
It reports no failure at that earlier timestamp. The favicon 404 is established
by the actual HTTP receipt at 01:41:29.311Z and the exact used driver's strict
status branch, followed by normal close. `post-original-audit.json` explicitly
labels this inference rather than fabricating a completed driver result.
`favicon-boundary-fixture.cjs` reproduces manifest 200, accepted build-info 404,
and rejected implicit favicon 404 through the exact used amended driver and real
FS/HTTP, with public/native spawn forbidden and zero Chrome/controls.

The corrected discovery follows HTML declarations and relevant static dependency
edges; it did **not** model Chromium's implicit favicon lookup. The favicon file
is absent and the root HTML has no favicon declaration. Its 404 alone is not an
audio or application defect. This run's new strict non-200 policy treated that
browser request as mandatory. The offline proof therefore establishes the
manifest correction and its declared/dependency scope, not a complete model of
browser-generated requests. A future separately authorized harness would need
an explicit policy and tests for such implicit optional requests before another
original. This assignment does not change that policy after the used attempt.

| Boundary | Actual observation |
| --- | --- |
| Timer/acmMetrics50 and format allocation | Unobserved |
| DirectSound device/primary and HRESULTs | Unobserved |
| Original 37 effect opens/PCM load/Lock/Unlock | Unobserved; existing input hashes/spans verified offline |
| Sound-enable/device gates, Duplicate and Play returns | Unobserved |
| Owning page voice/source schedule and AudioContext clock | Unobserved |
| Gains/mute and wave/master analyser | Unobserved |

Native Play readiness was not reached, so the 30-second post-readiness window
never began. No trusted control or capture was issued. There are no fresh game
captures to review. Analyser peaks would not prove audible output in any case.

Normal protocol `Browser.close` completed with actual Chrome 1644974,
startticks 189009696, exit 0/null at 01:41:29.621Z. Node 1644924 and flock 1644923,
both startticks 189009546, exited 0 and disappeared; all adopted waits exited 0/null.
Independent cleanup at 01:42:09.975Z verifies HTTP 42257 and DevTools 33255 refused,
no Chrome/profile users, the exact own profile removed, and external flock free.
There was no kill fallback. This was before cutoff 02:40Z and cleanup 02:43Z.

The outer driver exited 0 without writing `driver-result.json`, `driver-error.json`,
`runtime/driver-final.json` or `runtime/final-pins.json`. Those artifacts remain
absent. Immediate closure produced a later response-body TargetClose error; a
pending asynchronous receipt is a plausible completion-gap cause.
`pending-receipt-fixture.cjs` shows that a deliberately unresolved body promise is
sufficient to leave the driver's main/finally pending after mock closure and
prevent final artifact writes. It is a causal model, not identification of the
specific pending original promise. No original has been repeated to diagnose it.
The separate offline audit rehashes all 1,529 actual pins and finds zero changes;
it does not relabel that check as an actual driver-final receipt.

Only this note is committed. Evidence includes used-input hashes and the actual
failure/cleanup records, plus the separate post-original audit and offline
replays. The next work requires separately authorized handling of implicit
optional requests and reliable result persistence through closure; there is no
justified audio engine change from either original attempt.

Box ID/state/expiry: N/A. Coordinator retains shutdown ownership.
