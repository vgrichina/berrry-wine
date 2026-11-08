# Darkstone: reconcile CONT/ESRCH with terminal wait receipts

The offline repair in `tools/native_kernel_custody.py` keeps an ESRCH task in
custody until a real terminal wait is consumed. It no longer kills every
surviving recorded task merely because a ptrace operation raced with exit.
The next original's **548-provider / 42-helper** closure is prepared in
`scratch/runs/20261108-darkstone-cont-esrch-1832/` (R). No original, Chrome or
box was allocated for this task.

## Captured failure and causal repair

The [1810 run](darkstone-container-room-20261108.md) selected Git kernel
`275dd018aad23b8e2988a78033cddaa2e25d8df3`, SHA-256
`e5331081845bba9875f4e47fcb17f815945cc0c4455b5657f0678cd3626d5b7c`.
Its journal sequences 3715–3717 show task **18349**, start **36620**, TGID
**18271**, at a consumed `PTRACE_EVENT_EXIT` stop, followed by CONT/ESRCH and
exception cleanup. The exact underlying kernel timing is unavailable. The
captured stop establishes an exit transition; ESRCH itself establishes neither
exit nor a reap. Both that selected helper and the then-current shared kernel
`2486507db075ef7d350c83666fd098cb31a5191e` had the same fatal CONT handling.

R/diagnosis.json references and hashes the original kernel.stdout and full
custody.ndjson without copying them. The historical **358 owned / 305 reaped /
53 remaining / exit null** failure remains a failure. Chrome normal exit is
**UNPROVEN**. Later independent absence and the archived box do not repair it.

The repair journals ESRCH from CONT, event-message reads or option setting as
pending against the durable PID/start registration. It returns to WNOWAIT
selection without inferring death, inventing lineage, retrying an old signal
or removing custody. A later stop is handled as a new kernel observation;
only a consumed terminal wait clears pending state and links it to the durable
reap receipt. If /proc disappears before consumption, the registered identity
is retained and the actual wait result remains necessary. Observed identity
reuse and unsupported nonleader exec identity transitions still refuse.

ECHILD is accepted only after every registered PID/start has a terminal receipt.
The drain explicitly retains `unreaped` and `unresolvedPtrace`, even when /proc
is absent. Cleanup deadlines apply on every iteration, including continuous
statuses. Unresolved kernel lineage now also refuses successful completion;
real exits and their statuses remain recorded. The two existing lost-clone
signal fixtures therefore still drain/reap completely, but exit nonzero with
explicit unresolved lineage. Untraced clone flags remain unaudited.

## Validation

- **16 custody tests passed**. A deterministic schedule uses captured PID/TGID
  and EXIT-stop shape, imports the exact historical selected helper from Git
  and reproduces CONT/ESRCH causing survivor kills; it reproduces the same
  failure in the pre-repair shared helper. The repaired helper records real
  terminal receipts, exit zero, complete lineage and no survivor kill calls.
- Controls cover signal and exec-message ESRCH, a superseding stop, missing
  /proc with a real terminal wait, non-exit ESRCH deadline, missing wait receipts,
  identity reuse, unsupported exec transitions, and continuously busy deadlines.
  Actual nonzero exit 7 and fatal signal statuses remain retained and refused
  where completion cannot be proved.
- A finite native fixture returns a **real ptrace ESRCH** after an actual EXIT
  continuation and observes the actual terminal status with WNOWAIT. A scheduling
  shim completes that continuation at the CONT boundary; it does not reproduce
  the unknown original kernel timing. The helper then reaps normally. A second
  fixture drains nine concurrent native processes with nine receipts.
- **2 actual startup/bootstrap tests**, **13 helper-closure tests**, and **8
  runtime-generation tests** passed. The startup fixture retains three complete
  receipts, including the nested parent-reaped intermediate. All recorded native
  fixture identities and the startup kernel supervisor are absent.
- `flock /tmp/wine-build.lock bash tools/build.sh` passed. Actual startup ran
  under `/tmp/wine-runtime.lock`; finite subprocess timeouts bounded fixtures.
  Build and focused logs are in R. Full27, parity, audio and FPS remain open.

## Gameplay-ready pinned closure

R/runtime-pins-selected.json SHA-256 is
`9a933e718cff01505b93f8d567f37c37d50b2de3edab3a310602b392c51e938c`.
All **548** targets resolve and all **42** relocated physical helpers validate.
Only `tools/native_kernel_custody.py` changes among the **506 nonhelpers**;
its new SHA-256 is
`f778d0e4d05959c0bd35850533faaf0cfaa4983acee0d5718c50dbc576066429`.
The inherited runtime commit `90c1fcfee91c4680877083e80498afcb73c9384d`, module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`,
endpoint and other 505 nonhelpers stay pinned. Historical manifests are untouched.

The helper closure changes paths, checkpoint provenance, exact kernel Git-object
fallback resolution in bootstrap/provision, and explicit drain assertions.
R/prepare.py reconstructs it. The actual production provisioner passes with a
recording transport, checking every upload byte before invoking its content
barrier. Injected changed shared-kernel bytes exercise the actual provisioner
and bootstrap fallback to the exact new Git object. This is offline transport
validation; no remote publication or runtime receipt is asserted. **68 accepted
proofs** were independently reread and hashed unchanged, without fixture churn.

The selected continuation is **1810/new-save-recovery.json**, hard-linked as
run-specific checkpoint inputs without duplicating game media:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| characters.lpl | 1,342,284 | `bebc7fcd564603a3d79ecf54c3fb0ae8a15b080d5c0fd4db7c615bf15cb3be85` |
| game641d_6af0bd5d.sav | 3,204,341 | `d1ed6d70a78c2ab3ef13291fc36081daeca58240f58034c5458e0b48ffce528f` |

The newly derived provision.bytes manifest is 1,242 bytes, SHA-256
`a570253b21c7071dc2db14e3003f451dec30a26b143d82a116633bf4714baa66`.
This pair is **not reloaded**. Next original must restore only it, verify fresh
HTTP/loadFiles/VFS/native preview, then review current hover targets before
interaction. Gameplay continues on wider floor beyond the narrow opening:
**Gold 1713, Food 38, LIFE 19/35, MANA 25/25, AC 14, victories 9+0**, with
helmet/cape and red/blue vials. No gameplay occurred during preparation.

R/source-recovery.json records exact Git provenance, relevant binary diff,
small owned helper patches, existing media/module PATH/HASH references and
provider fallbacks. No source archive, media copies, peer WIP, old-box action,
resume, delete, public deployment or subworker occurred. Free /home stayed above
1.5 GB. Box ID/state/expiry/stop receipt: **N/A; no box created**.

Next: separately assigned original using this pinned continuation and closure.
RELEASE and single-task STOP after authenticated publication.
