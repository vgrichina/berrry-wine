# GL gesture final socket ordering — 2026-11-20

The strict GL group now takes its pre-DOWN whole-frame capture before native
prepare. Its transport owns the single final socket comparison. The strict
controller supplies a synchronous publication callback: after that comparison
and its synchronous evidence writes, the callback checks cancellation, the
original native deadline and the independent release window, then schedules UP
relative to actual DOWN publication. The group no longer performs a duplicate
socket capture. Four distinct independent UP participants remain READY and armed
before the first DOWN; their original finite fallback is unchanged.

The strict controller requires `native-whole-frame-equivalence-v1`. It does not
select the Hex manual-context branch. The caller must pass the publication
callback through `dispatch(edge, publish)` to `equivalence.fence(handle, edge,
image, publish)` at the actual socket send, without an intervening await. Omitting
that callback closes the controller. Private proof validation, one-use retirement,
identity checks and complete exact RGBA comparisons remain in force. Source 30s,
review 15s, fresh 5s, native 500ms and maximum hold 1500ms remain unchanged.

Run: `scratch/runs/20261120-gltron-final-socket-release-order-native-round/`.
The exact loader retained Git-pinned `7bca66241` common equivalence and Hex
bootstrap helpers, with the owned GL strict-controller overlay. It served the
same `10bdae2c…` 2,418,815-byte module and `34c794d5…` graph with committed
`72dc77da` / `cf181231` capture overlays. Preflight validated the actual dynamic
controller/socket joins, 26 helper closure, five compiled export signatures,
actual bootstrap lazy body and 92 media pins before browser launch. Current Hex,
GPS and held-region changes were not served.

Actual native partial result: Space DOWN socket at **1795175065640**, native USER
return CONSUMED at **1795175065655**, UP due **1795175065710**, trusted UP at
**1795175065713**, ACK at **1795175065716**. Exactly one final socket comparison
preceded that DOWN. This repairs the previous run's UP-before-DOWN ordering.
The next pre-DOWN comparison refused `whole-frame RGBA differs` at
**1795175065879**, before a second prepare or DOWN. The scope closed with one of
four edges completed, zero subsequent ordinary requests or socket sends, no
replay and no conditional original launch. Four-edge native qualification,
visible trail/heading, pause/resume, round and ordinary Quit remain unproved.
The unchanged strict whole-frame contract cannot authorize later edges after
resume changes the reviewed image.

Evidence limitation: the inherited run adapter did not install the optional
synchronous capture evidence sink. It retained the reviewed complete PNG and
fresh capture digests, but not the actual final-capture PNG or the rejected
pixels. No post-UNKNOWN capture was requested. The precise changed pixels cannot
be diagnosed from this run. This is partial ordering evidence, not complete
native/game qualification.

Focused tests exercise publication-relative UP, delayed final capture,
release race, finite fallback, cancellation, wrong target and mixed prepare ACK
refusal, four private proofs, one-use retirement, complete-frame mismatch,
actual child cancellation and independent UP joins. Authored endpoint tests do
not substitute for native USER qualification. Required full build and publication
receipts are retained in the run. All owned runtime participants joined and were
nonlive before verified evidence retention and tmpfs cleanup. No remote box was
created: ID null, state NOT_CREATED, expiry null, stop receipt null.
