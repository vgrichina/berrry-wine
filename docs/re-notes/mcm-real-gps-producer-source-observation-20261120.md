# Genuine MCM GPS producer observation

Run: `scratch/runs/20261120-mcm-real-gps-producer-source-observation/`.

MCM D3DIM opens its real `d3dim-gps` endpoint through the process host. It
does not create a legacy software-GL endpoint. The new explicit
`prepareD3dimGpsPublicationObservation` installs guest writer participation
and the synchronous native Flip observer at an ordinary scheduler boundary.
The returned registration is PREPARED, with no endpoint or publication join.

The actual endpoint factory awaits the separate `gps-producer-observation`
handshake before returning its real port to the bridge's first kick. That
handshake requires D3DIM GPS, a shared writer epoch, a bounded source journal
and retained-source storage. The legacy protocol still rejects GPS. No
surrogate endpoint is created. Message dispatch, doorbell drains and native
transient resets participate in installed render writer coverage.

Preparation requires an idle writer boundary. Binding occurs inside an
already observed guest command and validates its captured participants and
unpoisoned epoch; it does not demand that this command has already returned.
This is installation, not permission to read source pixels. The existing
sole-writer native Flip seal, page leases, retained copy, complete decoder,
compositor and publication checks remain authoritative.

ARMED requires the real endpoint acknowledgment and owner generation.
PUBLISHED requires a qualified synchronous publication row. GPS ready,
commands, frames and endpoint acknowledgment alone create no CPU source
authority. Replacement, cancellation, timeout, endpoint error and process or
guest retirement invalidate the epoch, retire joins, clear timers, remove
owned subscriptions and settle cleanup outcomes. Reinitialization awaits
only an existing registration, preserving ordinary unarmed startup timing.

`mcm-bound-input.cjs` selects this path only with the explicit
`gpsSourcePreparation` option. Its default legacy behavior remains covered.
The final offline guard also closes a chain on a CLOSED preparation before
any further Worker reads or dispatch. It was not replayed on the original.

The actual browser fixture uses the qualified graph plus the owned overlay,
real CPU and render Workers, and compiled native code. The first D3DIM GPS
command installs coverage and creates no legacy endpoint; the following
native CPU Flip produces a retained RGB565 source. Full fallback decoding,
composition and display publication reach PUBLISHED. Both actual Worker
modules are recovered and hashed once. An earlier fixture configuration
mistake selected the local executor; a subsequent implementation test exposed
the erroneous idle-at-bind requirement. Neither failed attempt is accepted
proof. The corrected fixture and exact final-source fixture pass.

Eight actual render Worker controls cover normal installation, wrong owner,
replacement, cancellation, invalid journal, endpoint retirement, the preserved
legacy-wire refusal followed by the new GPS protocol, and malformed legacy
control. Ten lifecycle/admission controls, ten unchanged menu-stage controls
and 32 existing render-manager cleanup checks pass. The owned host/render
callback review remains anchored to the preceding reviewed hashes. The full
flock build passes; retained older native29/CPU proofs are reused only where
the exact input/source hashes match, never as qualification of the removed
legacy hook.

The sole affected original used exact module
`f5ae1ac84e3d5e13bb093aca53b8aa2fe18c000cc891587a5d75b46eb559b2ba`
(2,420,767 bytes), 311 verified media references and the qualified 183-file
graph plus the owned overlay. It passed ordinary hardware/name dialogs and
quarry setup. Preparation returned PREPARED with endpoint null. The fresh
post-prepare capture visibly reached rider/bike selection. The submitted
Start review was 17.8 seconds old, exceeding the unchanged 12-second limit;
admission refused it before any Start effects. The scope was permanently
closed without replay or later ordinary endpoint requests. The pre-arm
review text incorrectly described rider/bike selection while its capture
still showed the preceding track-selection transition; only the subsequent
post-prepare capture proves the rider/bike screen.

Quarry gameplay, original source publication, Escape, current display and
ordinary Quit remain unproved. This is the precise first original blocker,
not a successful gameplay claim. Final offline admission/reset review changes
have native/focused coverage but no second original run. All owned runtime
processes were joined by native-supervise and independent finite watchdogs;
no remote box was created. Evidence records exact runtime and final source
recovery separately, module/media references, diffs and cleanup receipts.
