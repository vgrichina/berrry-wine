# Nox reviewed physical cursor anchoring

The single authorized original observation reached Multiplay, Network, Host
Game and the Conjurer selection screen. Default Jack and the bunker staff were
not reached. A Worker `Runtime.evaluate` timeout ended the run; no second
native attempt was made.

Evidence is in `scratch/runs/20261110-nox-reviewed-pointer-anchor-0300/`.
The original used published anchoring change `b35771df0`. Its recovery base is
`703fe8732`, with exact `owned.patch`, explicit plans, generated provenance and
module pins retained. `offline-base.txt` and `offline-repair.patch` describe
the subsequent offline repair. Git holds the source archive. No source
archives or media copies were added to evidence. Shared renderer, startup,
CRT, Q3 and LBreakout providers remained read-only.

## Explicit anchoring and visible progress

The Nox-only observation driver preserves the `befbafc5b` button synchrony
guard. An unprimed ordinary move now requires an explicit
`anchorOriginalCursor` declaration. Admission checks the observed original
cursor, the requested physical point through the observed canvas/viewport,
and the absence of button effects. An existing unequal reference refuses.
The command issues one ordinary native move, returns its own image, and checks
that the original cursor stayed unchanged while the renderer reference became
equal to it. The normal image review gate precedes dependent input. There is
no inserted motion or guest write.

All nine images were individually model reviewed. Ordinary Escape advanced
the splash to the main menu. Passive original calls showed cursor `(0,0)` and
the pointer observer showed a null reference. The separately reviewed move
at that original cursor established reference `(0,0)` without returning any
axis or button data. Its returned image was reviewed before the Multiplay
click. That click visibly changed the menu; original cursor and hit tests
reached `(300,195)`.

A capture-only observation showed the settled Westwood Online/Network menu.
Network opened the map browser, and Host Game produced the native flag
placement prompt. Host Game also repositioned the original cursor to
`(408,239)` while the renderer reference remained `(115,62)`. No button was
sent while those positions differed. A separately reviewed ordinary move to
the lower-right canvas edge returned original DI axis records `(0,524)` and
`(4,417)`. Original cursor, hit tests and renderer reference then agreed at
the native bounded corner `(639,479)`. Its image was reviewed before map
placement.

Map placement reached a legible Conjurer selection image with Accept visible
and the other two classes marked unavailable in the demo. This image was
saved before the terminal failure and reviewed from retrieved evidence after
shutdown. No input followed it.

`native-consumption-analysis.json` binds seven input commands to their prior
image hashes and actual Worker identity, with 8,150 retained passive records.
Every input interval includes original DI returns, cursor observations and
natural hit-test calls. The capture-only `settle-multiplay` command had pointer
and image binding but did not freshly arm an original passive interval. That
is a concrete evidence gap, repaired offline below; this run does not claim
complete per-command passive coverage.

## Terminal failure and offline repair

After the final PNG, capture binding, state and pointer snapshot were saved,
the cumulative passive `finish` evaluation did not return. The driver recorded
`CDP UNKNOWN Runtime.evaluate; no replay` at `03:13:07.536Z`. The independent
owning watcher sent SIGTERM at `03:13:07.552Z`. Custody reaped 356 of 356 owned
descendants with complete fork lineage, actual parent return 1 and separate
stdout/stderr EOF. Owned processes and ports were absent. No later game
protocol, input, capture, retry, quit or extension occurred.

A file-only evidence fetch was started before the map-placement ACK returned;
it found the missing final consumption file and failed. It did not issue game
protocol or create a capture, and was not retried. Future operation should
wait for a successful ACK before fetching a completed image bundle.

The retained passive records serialize to 19,675,640 compact JSON bytes for
the session, versus 3,358,163 for the final input interval. The timeout's root
cause is not proven. The same-worker offline repair makes `finish` return
only its command interval, with global sequence/count metadata; full retained
history and the original global record/event/time bounds remain unchanged.
Capture-only commands now arm their own original passive interval before
waiting. Neither repair has a second native validation in this task.

## Validation

Before allocation, the generated original real Worker handler/installer and
actual host initialization passed canonical-plus-observation installed-instance
admission. Sixteen emitted move/click/anchor controls included firstMove,
refMismatch, wrong anchor, anchor nonresponse and sticky refusal with no later
effects. All eighteen identity mutations refused. Four production pointer
controls passed, including the original first-move failure and an explicit
anchor followed by actual compiled relative-axis drain. The locked build
passed. Accepted fixture `682f77655` and readiness repair `bce2b316f` were
reused unchanged, without a native fixture repeat.

The legacy generated driver sweep passed all 27 controls. The subsequent
offline repair adds capture-only success/refusal and compiled command-interval
isolation controls. Its focused controls and another locked build pass; final
emitted controls cover the repaired source closure. Production primary module
remains SHA-256
`4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`,
2,186,099 bytes. The installed native observation module was
`716d28c256b2d204e83a3e73a3bcd843e1afab9d62c957f868b762faacef19f5`,
2,186,872 bytes.

## Lifecycle

Only `bx_8jfc36ud` was created, UUID
`893794fa-b8cd-4843-8ffe-8164fea88cd9`. An observable independent watchdog was
prearmed before allocation with immutable deadline
`2026-11-10T03:32:07.743Z`; API expiry was `03:32:08.248Z`.

Before the sole delegated normal stop, independent local rereads verified
145 artifact references, 126 unique contents, 137,805,708 unique bytes, four
finalized gzip streams and nine PNGs. PNG checks include chunk CRCs, complete
zlib inflation, dimensions and scanline bounds. Actual owning parent wait and
separate EOF were verified before stop authorization.

Unforced receipt `stop_c1e6380d748451dc` completed at
`2026-11-10T03:14:08.819Z`. Independent API and receipt lookups confirm archived,
expiry null and forced false. The watchdog supervisor actually waited, return
0, with separate stdout/stderr EOF; both watchdog processes are absent.
No box was resumed or deleted, and preexisting boxes were untouched. There
was no local Chrome, nested worker or deadline change. Home free space stayed
above 1.5 GB.

Next work requires separate authorization for an original observation with
the smaller command-scoped passive return, then Conjurer Accept, default Jack
and bunker staff. This task releases ownership and stops.
