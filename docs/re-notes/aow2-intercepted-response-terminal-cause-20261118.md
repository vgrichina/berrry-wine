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

The single original is conditional on publication after the final locked build.
Its actual rendering or concrete blocker will be recorded here.
