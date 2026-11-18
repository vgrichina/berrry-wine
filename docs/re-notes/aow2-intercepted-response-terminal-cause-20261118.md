# AoWII intercepted response terminal, 2026-11-18

Evidence: `scratch/runs/20261118-aow2-intercepted-response-terminal-cause/`.

The exact genuine `Ml42ND50.bpl` discrepancy is reproduced outside game
execution. The unchanged older coherent shell and its actual
`WineAssembly.fetchAssetBytes` streaming reader consume 468,992 bytes, SHA256
`c503b230760bfc9f3c315f91911c3b90471368115fabf227e4e95d0e34a30993`.
The existing response-stage interceptor captures, verifies and continues that
same request. Its owning Network session then reports canceled `ERR_ABORTED`
without loadingFinished. The old adapter closes UNKNOWN on the second read.
No abort, reader cancellation or earlier cleanup command initiates that failure.
Historical scopes, including request `2346097.272`, remain closed and failed.

The AoWII correction opts this route into the existing actual-consumer contract
in `browser-consumer-completion.cjs` and `browser-response-body-collector.cjs`.
It observes application-requested reads without cloning, teeing, read-ahead,
replacement responses or refetch. An unpredictable invocation name in the
native fetch initiator binds the exact Network ID to the default script context,
unique context, document, frame and timeOrigin. Copied *consumed* chunks are
hashed independently and must equal the immutable intercepted bytes. Binary
selection excludes JSON, script and image consumers; unsupported child owners
fail closed. Consumer completion remains mandatory for every selected invocation,
even when Network finishes normally.

The separate terminal assessment retains every failed Network terminal. It
accepts authenticated consumer completion only with one exact GET/200 request
and response, verified server finish, a resolved earlier Fetch continuation,
and exactly one eligible canceled `ERR_ABORTED`. A missing Network terminal
still fails. Other transport errors, partial bytes, wrong hashes, cancellation,
stale contexts, duplicate/unmatched owners and delayed completion remain failures.
The whole browser is disposed on UNKNOWN without in-page restoration commands.
No emulator, DLL, registry, game-state, clock or rendering behavior changes.

Real controls include the old failure, 32 corrected genuine package reads
(six failed Network terminals retained), the packaged native VariantInit control
and real abort, reader-cancel-before-EOF, truncated response, wrong-pin,
unsupported Worker owner, timeout and replaced-document failures. The generated
native control actually instantiates module `87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009`
and reaches `Native VariantInit returned vt=0`; it is not original game output.
The synthetic collector suite retains its 129 cases, including race ordering.
Focused AoWII tests reject 22 malformed or insufficient terminal receipts.

A separate native trace of repeated genuine package reads records four
`ResponseBodyLoader::DidCancelLoadingBody` callbacks and request-bound failed
ResourceFinish events. This demonstrates a Chromium renderer body-loader
cancellation boundary despite authenticated consumption. The internal C++
bookkeeping/reentrancy mechanism is not proved. No upstream browser repair is
claimed. The earlier shorter startup trace did not cover the package requests
and is not used to identify that boundary.

In a separate browser lifetime with **no Fetch interception**, the exact pinned
host `_readBody` method consumes the same genuine package with strongly retained
response/controller/bytes, an un-aborted signal and normal loadingFinished.
That single comparison does not prove an interception-independent recurrence
or isolate an internal cause. The real traced intercepted cases establish the
boundary relevant to this correction. Independent receipt audits bind all 32
consumer invocations and the four native callback intervals to their exact
failed ResourceFinish request IDs; all four consumer hash completions arrive
after the failed Network event. The first corrected 32-read case similarly
authenticates its six post-failure completions, with no synthetic terminal.

The source is explicitly the **older** coherent `0a823095c` plus recorded patch,
published `81ad6c802` manager and `87ef39648` module, with the same 435 media pins.
It is not current main. Text recovery checks the immutable expected hash; media
uses the existing files without substitution or copies. Qualified passive
Device7/native raster controls and independent UP remain unchanged.

## Single original and concrete remaining blocker

Correction `46f8ea1d5` was committed and immediately published with strict
pull/push after focused tests and a passing locked build. Intermediate builds
failed on another owner's changing callback census and region declaration;
those files were left with their owner. The final build passed. Four additional
production-collector synthetic races cover completion before/after failure,
wrong hash and owner loss. An actual reader cancellation was repeated after
the no-restoration teardown correction. The fresh independent UP control passed.

One registered original then launched through the personally reviewed whole
launcher image. The actual main Worker ownership read binds slot0, endpoint1
and the exact older `87ef39648` module. The new original's required package is
Network ID `2394660.272`, not historical `2346097.272`; its complete owning chain,
server UUID and actual consumer hash are retained. The last and final transport
snapshots have 759 required bodies, 465 independently authenticated binary
consumers, no required failed terminals, no missing receipts and no first fault.
The independent audit passes all 759. Normal Network completion also passes
for these requests; no original canceled transfer is silently cleared.

The main menu and default Inioch's Legacy setup were personally reviewed.
Ordinary Scenario, Single and Start clicks each retain trusted DOWN/UP evidence,
prearmed independent release, normal acknowledgement and actual release-process
wait/EOF. No game settings, media, registry, clock or guest state were substituted.
There is no recorded application fault before termination. The control fixture's
VariantInit result is not substituted for original execution.

At 03:38:48 UTC, the native supervisor received SIGTERM about 179.5 seconds
after starting, **before** its configured 900-second deadline. The independent
watchdog recorded no deadline/disk trigger and minimum /home free space
1,933,516,800 bytes. Its cancellation followed the supervisor's exit. The driver
labels every incoming SIGTERM `independent watchdog SIGTERM`; that literal label
does not identify the sender. The sender and reason remain UNKNOWN. The run
ended during the natural 15-second wait after the acknowledged Start click,
before `world-first.png` or its command completion. A command-tool lifetime
limit is a hypothesis, not a demonstrated initiating cause.

No endpoint request, observation, input, replay or second original followed
recognition of closure. Actual completed Device7 ground draws, effective raster
coverage/last writer, terrain, army consequence and ordinary Quit are **not
reached**. The qualified observer's retained native fixture and historical
terrain images remain controls/reference only. No rendering defect or rendering
repair follows from this attempt. The remaining concrete blocker is the
premature native-supervisor termination; the transport prerequisite passed.

## Custody and retained evidence

Every browser control and the original used native-supervise plus a prearmed
independent finite disk/deadline watchdog, without a RAM gate. Actual original
waits are driver124/null, Chrome null/SIGTERM and watchdog0/null, all with both
pipe EOFs. Native-supervise records exit124/null, `supervisor SIGTERM`, no poll
error and `leaked:false`. The external invoking command actually waited124.
Profiles were removed only after retaining/hashing unique wait/EOF records.
The no-interception control and native callback trace are preserved separately.
Earlier reusable-adapter controls performed restoration during cleanup; the
published whole-browser teardown avoids those in-page commands after UNKNOWN.

Evidence retains exact Git, owned new-file/helper patches, immutable source and
media identities, one unique module, selected named whole PNGs and recovery
recipes. No command-stream capture, frame series, media copy or source archive
was written. There is no candidate-corpus entry for AoWII, so candidateId stays
null rather than using another application's card; global historical evidence
checker failures are reported separately. Final `result.json` is written last.
No boxes: ID null, state NOT_CREATED, expiry null, stop receipt null. No workers,
Python, Wine, foreign edits or deployment. Ownership is released when finalized.
