# Shared disk closure repaired; Caesar III reached Aventine, growth unproved

Evidence: `scratch/runs/20261118-browser-disk-closure-caesar-growth/result.json`.

Published guard **cf132e191** adds `tools/browser-disk-admission.cjs` and its
focused tests. A run-scoped, non-stealable filesystem mutex serializes actual
`statfs` observations with ordinary CDP wire issues. LOW or UNKNOWN atomically
latches permanent shared closure before releasing that mutex. The actual child
checks the launcher token, optional parent tokens, finite deadline and shared
closure; its transport rejects queued, unresolved and late requests. Lifecycle
hooks close the boundary before forwarding signals or IPC failure. No lock is
stolen and no scope is reopened. Callers retain responsibility for finite host
cleanup and real child/EOF waits. This is sampled admission ordering, with the
unchanged **1,500,000,000-byte floor**, not a guarantee about other disk writers.

The fresh run-local launcher, watchdog, browser driver and intermediate
custodian use this common boundary. Native supervision itself needed no edit.
The independently prearmed exact process/document release remains separate;
closure permits that matching release and host cleanup, never new ordinary
input or diagnostics. Release receipts establish physical neutral state, not
fabricated native consumption acknowledgements.

Eight focused tests and the required locked build passed before the code
commit and immediate strict pull/push. Tests cover real healthy `/home` statfs,
startup LOW, queued diagnostics, a real second process observing injected LOW
with an unresolved request, late input, statfs error, stale scope/parent tokens,
signals and IPC error/disconnect ordering. Normal Chrome authored controls
separately prove startup LOW before the first diagnostic and injected LOW/EIO
while a request is unresolved: **zero ordinary CDP requests after closure**.
Prearmed C UP and pointer UP finish with physical state zero. Final published
LOW-in-flight confirmation uses the exact Git helper closure in memory.
Injected observations allocate no disk filler and make no real-capacity claim.
Actual sampled free space in these scopes remained above the floor.

The retained prior actual failure remains the baseline: 1,446,531,072 bytes
sampled at 09:47:18.499, followed by 13 inadmissible ordinary requests. No old
endpoint was queried or replayed. The first new LOW control predates the final
metadata/lifecycle additions; its injected observation incorrectly labels
`injected:false` in the closure JSON. Its companion injection receipt records
the actual healthy space. Final published LOW correctly records
`injected:true`. No capacity claim is derived from either injected value.

ReVolt coordination preceded use. Its b12b90091 helper was published and its
live bytes matched the selected Git pin during the initial runs. No foreign
helper was modified or adopted as unpublished provenance. When the new ReVolt
owner changed that body, a fresh diagnostic refused **before importing it or
opening an endpoint**; the final diagnostic then evaluated only cf132e191's
published helper closure from Git in memory.

After publication, the immutable cf132e191 production graph compiled to module
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`.
Actual main Worker bytes match. All **114 recursive Caesar media files** were
hashed before the original and verified unchanged afterward. Normal 2D browser
controls show printable C, paired pointer input, a drawn menu, ordinary Escape
Quit and observed native process exit 0. Two preparation scopes closed on
strict display-age/readback validation; they were not resumed. A subsequent
fresh control checks passive writer readiness in the same JavaScript turn as
the readback request, without forcing guest polling or publication.

Exactly one unchanged registered `caesar3_demo` original ran. Bounds were
180 seconds startup, 1,200 total, 180 Quit reserve and 20 cleanup; none increased.
Personally reviewed whole browser images show the title, Start new game,
printable name C, Assignment 1 — Aventine and the initial city at **Dn 2000,
Pop 0, January 500 BC**. An initial menu click used the wrong browser-chrome
offset; a bounded passive geometry read corrected it before the next click.
Transport completion alone was never treated as game consumption.

At 10:08:54.773 the first housing-selection request was refused locally before
DOWN: the reviewed city image was **23,273 ms** old, beyond the fixed 15-second
gameplay freshness limit. Shared closure followed immediately and all later
ordinary attempts were refused locally. A subsequent capture command also
refused locally before any endpoint access. No housing, new road, occupied
dwelling, positive population, natural city consequence, Save or native Quit
was achieved. This is a bounded harness preparation failure, not a demonstrated
game/runtime defect. There was no second original, replay or extension.

Guard controls retain actual browser, driver, intermediate supervisor,
launcher, watchdog and release waits with both EOFs. The original retains
browser, actual driver, native supervisor and watchdog waits with both EOFs,
and native supervision reports no leak. Its outer invocation returned tool
status 143; the enclosing launcher's separate close/EOF receipt is **missing**.
That gap is not inferred from PID absence or from the native receipt. Owned
PID/listener absence and profile/Xauthority cleanup are audited independently.
The initial board watcher also returned tool status 143 without a separate
EOF receipt; a later finite board watcher has its own actual close/EOF receipt.

Evidence retains exact Git pins, relevant initial/final binary diffs, owned
patches, selected whole PNGs, tested module, actual waits and recovery recipes.
Concurrent foreign edits are preserved and are not claimed byte-identical
across the task. No guest/config/registry/save/media/state edits, forced focus,
clock/speed/money/population changes, agents, workers, boxes, Python, Wine,
deployment or held-title actions occurred. UT overlays/ISO and Blood II's
timer hold remain untouched. Box ID null, state NOT_CREATED, expiry null,
stop receipt null.
