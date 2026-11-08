# Recoil original gate provisioning repair, 2026-11-08

Run: `scratch/runs/20261108-recoil-original-gate/`.

Completed the **first new tested generic integration repair before allocation**.
The actual native provisioner did not invoke the physical helper dependency
checker. A content-valid manifest could therefore upload a helper requiring an
unprovisioned relative dependency and publish a valid staging barrier. This is
separate from the repaired checker's exact-call exemption behavior: the checker
was absent from this actual side-effect path.

`provision-before.test.py` invokes the predecessor's actual provision function,
with small local upload transport substitutes and the real production staging
barrier. A pinned `driver.cjs` requiring missing `absent.cjs` is uploaded; the
barrier publishes and its require check accepts the incomplete physical closure.
`provision-before.log` retains this causal failure. No browser or remote request
is involved.

`tools/native-runtime-provision.py` now binds the current exact-call checker from
`0099373b4` before the first remote lock check, upload or staging publication. It
requires the explicit startup contract, verifies its declared targets, validates
all physical helper hashes, syntax and relative dependencies, then rereads and
hashes every selected source/media provider before any remote effect. Each
upload resolves and verifies its provider again. The existing upload pool still
joins all transfers before publishing; a failed transfer never publishes.
The queue and parent retain their content-verified staging checks. The repaired
actual run's `provision.py` delegates to this production helper.

Eight focused tests pass: unconditional missing dependency; a valid inactive
call followed by an unconditional missing call; supported inactive call;
unsupported OR guard; complete present dependency with joined uploads; stale
physical bytes; unprovisioned startup-contract target; and upload failure with
no publication. These exercise the provisioning function rather than only a
standalone checker. The full locked build passes.

## Exact integrated runtime and retained evidence

The actual integrated `browser-position.cjs` and its other28 physical helpers
were relocated into this owned run. The inherited886-pin manifest is preserved
verbatim as a prefix;29 exact relocated targets and the production provisioner
extend the selected manifest to916 pins. Every selected provider passed the
actual provision entry with mocked remote effects, followed by the exact
hermetic Software gate/HUD import. There were917 mock uploads including the
manifest, no real upload, queue, original launch or allocation. This establishes
local closure, not remote staging verification.

Original JavaScript pins remain unchanged:

| Role | UTF-8 bytes | SHA256 |
| --- | ---: | --- |
| Decoder | 204938 | `f468ffce84da0f517df009682c111bbcb955b67f8b5a122350abbe5abc49e1d8` |
| Compositor | 227919 | `cb21daaf7c0ce2b2cf80436c192bda4ed78930b1b07eaf21a20eb9adb7ce7b51` |

The integrated explicit Software gate, native motion, current execution-context
handling, lifecycle/final-save fences, complete uncached response retention,
250ms freshness, changed-timer pair, immutable transition, independent native
releases and sticky UNKNOWN/no replay are unchanged. No renderer WASM is
invented, and the hardware gate is unchanged. Accepted19 lifecycle/46 gate/
28 owner/41 HTTP/197 kernel-task and inherited reviewed-point/custodian evidence
were independently reread and hash-verified in place, without fixture reruns.

The task ends on this new causal repair. No current Resume screenshot was
produced or reviewed, no M was dispatched, and no new movement or power-control
progress is claimed. The Software gate remains **not original-validated**.
The launch-specific independent clock/process producer and observable25-minute
watchdog still need completion before the separately assigned single original
attempt. Preserve current process/endpoint/profile identities, independent
same-host clock verification, remote startup/runtime lock and kernel custody;
then personally review CURRENT Resume, qualify the gate, review ordinary M's
consequence and attempt bounded movement. Full27/parity/audio/FPS remain open.

New box ID/state/expiry/stop receipt: **N/A — none created**. No watchdog or
local heavy-runtime lock was needed for these non-runtime checks. Old boxes
were untouched; no resume/delete, deployment, subworker, source/media archive
or peer WIP was used. Recovery records the exact checkout SHA, relevant owned
binary diff, small owned new-file/runtime patches and existing provider/media
paths and hashes. All new artifacts are independently reread before publication.
