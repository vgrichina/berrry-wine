# NFS3 ProcessDesktop startup cause, 2026-11-18

Published helper repair: `0888e0e4c`. This is a loader-only repair; no emulator
repair, original driving, Pause, Continue, or ordinary Quit is claimed.
Evidence: `scratch/runs/20261118-nfs3-process-desktop-startup-cause-gameplay/`.

The previous original remains closed at its ProcessDesktop client `hello`
timeout. This task made **zero original-game launches**. Its required authored
manual-control gate is **UNKNOWN_CLOSED**, so the conditional original
authorization was not exercised. There were no DOWNs or independent-UP helpers
in that scope, no later endpoint requests, and no replay.

## Measured startup cause and repair

The retained original used source `9191d4afb`, the Git-memory preload
`20261117-nfs3-original-public-ingress-render-attribution/source.cjs`, and module
`7d347a6a631ab77335a14935a533feb896be71aa2508fc5aa19b1e5df8f096ce`.
Its stdout was empty; stderr identifies a client `hello` timeout. The authority
completed its preload; the client never completed its preload observation.

A real authored ProcessDesktop using the same Git-memory preload reproduced
`hello` ETIMEDOUT, native exit 1. Its authority reached listening about
2,958 ms after creation. Client hello timed out after about 3,008 ms, with
response words `[0,0]` and no client bootstrap identity or authority hello
receipt. Native supervision actually waited and reports `leaked:false`.

A separate diagnostic authored scope wrapped `execFileSync` before that same
preload. Each Worker performed a fresh `git ls-tree` and full `git cat-file
--batch` before entering the production desktop module. The authority and
client batch reads took 2,241 and 2,290 ms; that diagnostic run passed in
4,936 ms total. These are variable startup costs near the unchanged 3,000 ms
per-operation timeout. The passing same-loader diagnostic rules out a
consistently missing desktop module. No worker/module error was observed;
the measured failure is bootstrap latency from repeatedly materializing the
entire Git inventory, rather than gameplay or raster starvation.

`tools/nfs-source-loader.cjs` reads the exact Git inventory once in the main
thread and gives native Workers the same inventory through Node environment
data. Workers reconstruct their local read-only source map in memory. They
fail explicitly if the inherited inventory is absent. Missing source and
module/observer hash checks remain fail-fast. No timeout, transport guard,
input deadline, or application polling behavior changes.

The fixed native scope completed authority/client hello and snapshot in
663.677 ms total; tracing shows Git commands only in the main thread and
inherited inventories in both Workers. This measures this run, not a new
startup-time guarantee. Recovery is the published helper commit plus the
recorded exact source base, observer hash, and retained module; no source-tree
archive or sealed-source cache file is required.

The self-contained tracked loader test passes real hello/snapshot, authenticated
failure, prepared-client cancellation, Worker bootstrap error, actual Worker
exit, and finite directory cleanup. The existing constructor-retirement test
passes stalled authority and client startup at the unchanged production timeout
and healthy transport controls. The locked canonical build passed. The previous
12 focused suites and native old-event-turn 2642.46 ms to 0.876 ms,
equal-pixels/order/sequence-73/arena-tail-12292 proof are reused from
`20261118-d3dim-async-execution-boundary-nfs3`; they were not broadly rerun.

## Authored manual gate and remaining limitation

The dispatch-time source is `eef2cebdb19014a38da7ac88d6162bdef82ba1c2`.
Its relevant desktop/async-owner/CLI runtime paths match `9191d4afb` exactly.
The gate used that immutable Git source, the published repaired loader,
unchanged retained module, passive observer, and unchanged fixture32 executable
`e9379deb67fa67fa16525f072c0d315327f797de124d67d9f7e5380620baf763`.
The fixture polls USER once per 32-draw frame; no extra polling was introduced.
Main and four Workers record the expected source/module identity, with inherited
Worker inventory. Native execution reached the Device2 caption, 4,210 draws,
131 presents, zero D3DIM fallbacks, and normal finite exit 0 at 105 seconds.

The worker missed that finite control window: the first capture request was
made after native exit and received ECONNREFUSED. The harness recorded UNKNOWN
and closed. A following local bind invocation was refused by its closed-scope
check before sending any endpoint request. There was no captured/reviewed frame,
guard binding, DOWN, Pause, Continue, or Quit in this gate. This is an operator
timing failure, **not evidence of application polling failure** in this run.
It does not satisfy the whole manual-control prerequisite for the original.

The earlier 32-draw fixture's UNKNOWN is preserved separately: host application
was prompt, but native consumption missed 800 ms because USER was polled only
once per 32 draws. Host responsiveness cannot promise application consumption
within that deadline. Neither that scope nor this gate is replayed or queried
after closure. No stale input is delivered and no new original is launched.

## Cleanup and evidence limits

All four supervised authored scopes have native receipts and all tracked PIDs
are absent. The manual scope has actual supervisor and independent finite/disk
watchdog waits, separate stdout/stderr EOFs, `leaked:false`, and no watchdog
firing. Its minimum sampled free home space was 2,101,018,624 bytes, above the
1.5 GB floor. Earlier startup scopes used native-supervise's independent finite
guard; their outer tool completion is recorded separately, without inventing
separate EOF observations for the tool's combined stream.

There are no selected new PNGs because capture failed. Module/media/chooser
identities and recovery provenance are retained as metadata, with no media
copies, frame series, source archives, Wine, Python, public deployment, boxes,
or delegated workers. Box ID null, state NOT_CREATED, expiry null, stop receipt
null. Foreign WIP was preserved. Ownership is released after final publication;
`result.json` is written last.
