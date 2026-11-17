# NFS3 public ingress/render timing, 2026-11-17

The passive observer works, but the one authorized fresh original ended on host
SIGTERM before input. The actual original pre-handler delay remains unknown.
No scheduling repair is established, and no second original was run. The
retained c9ff55052 released 0→3→4 MPH and steering evidence is unchanged;
Pause/Continue/native Quit remain open.

Evidence: `scratch/runs/20261117-nfs3-original-public-ingress-render-attribution/`.
This follows [the authored native delivery reproduction](nfs3-pause-native-delivery-cause-20261117.md).

`tools/nfs-public-timing.cjs` is an opt-in preload, enabled only with
`NFS_PUBLIC_TIMING=OUTPUT`. It retains at most 2,048 samples and aggregates
synchronous GPU stream kick counts, total duration and maximum duration. Samples
include HTTP request entry, guard preparation/application spans, nonce identity,
and public renderer key state at the existing independent release. It reads no
request bodies or guest memory. Samples stay in memory until process exit; it
adds no timers, yields, native calls, input effects or guard decisions. Physical
UP uses renderer references captured from existing guard snapshots and pinned
by the existing binding, rather than invoking another snapshot. External
controller intent/HTTP-authorship timestamps establish the other end of the
interval; existing native receipts establish consumption separately.

Focused tests compare observer off/on for expiry, duplicate nonce rejection,
effect count, return values, thrown render errors, release and ownership-snapshot
counts. They exercise bounded rollover and measure seven interleaved warmed
100,000-call controls. Median additional cost was approximately 0.15 microseconds
per wrapped call on this host. This is a measured wrapper cost, not a claim
about every game frame. Canonical locked builds and the native guard regression
pass. Only owned paths were committed and immediately strictly pulled/pushed.

Native controls reuse the predecessor's exact authored Device2 RGB565+D16 PEs,
published source `013d916c64632243ff0aa768debbbc39870f04d5` and module SHA-256
`cf674e8d1780249498a3b9797142d5d9f01e9daedcf2089c8fc880f515c753c0`.
The one-draw control consumes Escape and reaches its own `AUTHORED PAUSED`
caption with observation off and on. The 32-draw control still expires before
handler application at the same immutable 800 ms deadline. Independent release
is prearmed; observer-on records Escape/arrows UP and an empty queue separately.
The selected whole fixture images show a grey surface and native caption, not
a geometry oracle or original-game Pause. An initial fixture binding refusal
occurred before input; subsequent readiness waits for the completed fixture.

The original used the same sealed 4,681-file Git inventory and matching module,
plus only the published timing preload at `1cfa40550`. Its 135 media pins were
rehash-verified unchanged. It imported the genuine successful chooser export
with SHA-256 `c08b656b3718682a3a1f4324a08ab689c9444c1daf868c40f4a991cb9f1b9108`;
no failed selection, guest configuration or save was edited. The selected whole
image shows the original NFS III loading screen. Before any controller intent,
the supervisor recorded SIGTERM at `1794958323.3830805`; the native child exited
0 at `1794958323.5085526`, about 35 seconds after launch. The independently
prearmed 420-second watchdog did not fire. Signal sender/cause is unknown.
The next capture's first request got connection refused, setting the terminal
latch. No later query, rebind, input, endpoint replay or original launch followed.

Original observation retained 328 synchronous render calls, totaling about
3,692 ms, with maximum about 385 ms. No original guard preparation/application
or native input consumption occurred. These loading measurements cannot explain
the retained driving Pause expiry, and no original input delay can be reported.
No acceleration/steering/Pause sequence was completed in this new original.
The final observer revision eliminates an extra ownership snapshot present in
the first preload; it was verified only with authored controls, not presented
as an affected original retest.

Native/helper/supervisor/watchdog processes were actually waited with both pipe
EOFs. The board watcher also returned SIGTERM/143. Shutdown was host shutdown,
not native Quit. No boxes, workers, source archives, media copies, bundles,
frame series or deployments were created. Only selected named whole images
remain. Git commits plus binary patches are source recovery; result.json is
written last. Home free space remained above 1.5 GB; no RAM gate was used.

The concrete blocker is the exhausted diagnostic sequence without original
input timing. A further original requires new explicit authorization and a
supervision lifetime that survives through gameplay; it cannot be represented
as the conditional affected-original run because no scheduling fix was proved.
