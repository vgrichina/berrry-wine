# Protected compiler contract and original scalar PUSH

Run: `scratch/runs/20261103-jedi-scalar-preflight-compiler-contract/`.
Input: `605b84efb9c78d7aee3d67b9e00cdf93a98e7f33` plus the complete,
released fourteen-path candidate retained by `20261103-jedi-run-entry-apc-repair`.
The predecessor investigation was read once; its recorded original scalar
failure is reused as the failing control, without restarting its stopped boat.

## Compiler contract

`compileClosure` continues accepting standalone inline-source/empty-VFS
modules without `$rep_store_step`. Canonical runtime identity is recognized
from its entry point, runtime declarations/exports, or manifest, including
when callers copy the object and omit its entry metadata. Runtime closures
still require the arming global and undergo export protection. There is no
opt-out option. A flattened or augmented runtime root, nested includes and
unreviewed nonfunction exports reject rather than silently escaping wrapping.
An include-only root may have the compiler's ordinary `(module ...)` wrapper.

An ordinary standalone export named `run` remains valid. The focused compiler
regression executes an actual small protected export,
checks unarmed operation, and rejects canonical missing-global and root-shape
bypass attempts. Existing MCI, callback-token and NE-arena standalone consumers
pass, as do the real frontend-reuse and render artifact/cache fixtures. The
NE-arena test initially reached an unrelated stale fixture dependency:
its extracted lock helper now reads `$lock_identity`. Adding the ordinary
zero identity to that fixture restores its real publication/concurrency checks;
the initial failing log is retained.

## Scalar boundary

The original notepad PE entry at `0x4010cc` is `PUSH EBP` (`0x55`). The
retained old canonical module
`c81c34d8e5580b84f4c1378b2ade9fbb96f93aa766c07356bf394acad7d9b14c`
committed ESP `0x40000004 -> 0x40000000` before its mode-2 unmapped-store
trap. The new protected `$th_push_r` checks every destination byte using the
side-effect-free mapping predicate before changing ESP or entering `$gs32`.
It rejects sentinel, trap and SEH miss paths before architectural effects.
The ordinary unarmed helper retains its fault behavior.

The new canonical-artifact regression uses the unchanged original instruction,
with no WAT transformation or manufactured guest code/handler. It checks CPU,
lazy flags, stack and vitals on cold rejection; retries without host repair
and checks the SHA256 of all 512 MiB; repairs the missing mapping while
disarmed and checks restart at the same EIP. An unaligned two-page stack
operand checks absence of a partial low-byte write. Ordinary instruction-watch
stepping checks an unarmed successful original PUSH.

Cold decoding populates emulator-private cache memory. Whole-memory equality
is consequently checked on the cached rejected retry, not asserted for the
initial cold decode. This change establishes a bounded register-PUSH boundary;
it does not qualify every scalar writer, memory protection permissions,
concurrent page-table mutation, an exclusive controller or original Jedi
gameplay. The retained REP element, ABI/export and asynchronous-service guards
remain included, and Alice's landed host seals are preserved.

## Validation and lifecycle

Two locked full builds pass, the allowed maximum. The final compiler contract
and fixture correction do not alter canonical generated code: both modules
are byte-identical, SHA256
`c523ed9fa266253b5635bf0b1c1d98940367efd713c73d7097d04b3d2c91b749`.
All13 focused suites pass: compiler contract, actual standalone MCI/token/NE
consumers,68 frontend-reuse checks, original scalar PUSH,9 production service
states,1632 rejected native exports (all2277 mutable globals and whole memory),
19 REP cases, scalar CALL, fault restart, ordinary animation and35 render
protocol/10 executable cache controls. The prior old-PUSH failure is reused
by recorded payload/module hash; no predecessor runtime is repeated for
acceptance. Matching predecessor ABI/bulk/decoder evidence remains retained;
the affected compiler, export, REP, service and scalar boundaries are rerun.

The final canonical-artifact probe executes the unchanged original notepad
entry. `PUSH EBP` and `MOV EBP,ESP` pass. The next real instruction,
`SUB ESP,0x44` (`83 ec 44`) at`0x4010cf`, remains outside the protected
decoder's explicit admission set and rejects before changing CPU, lazy flags
or vitals. That is the first remaining actual failure, not an established
new writer defect. Native work stops there; no guest code or handler is
manufactured to get past it. Further scalar writers and original Jedi
attribution remain unqualified. The separately complete compiler compatibility
and bounded PUSH component is ready to publish with the retained protections.

Alice released heavy runtime at `18:24:56Z`. The one fresh execution boat is
`bx_2swkjm7e`, TTL3600, original expiry `2026-11-03T19:25:18.578Z`;
actual ID/expiry were recorded before use. All15862 effective input files and
57 actual loaded imports passed size/fullSHA checks before the first locked
full build. Final inputs and loaded imports were reverified after the compiler
correction and final build. Native suites have a300-second outer timeout.
Heavy runtime ends at`18:30:35.169Z`, release at`18:30:57Z`.

Complete local recovery verifies all133 payload sizes/fullSHA (16396724 bytes)
and all17 owned code/test sources byte-for-byte against the tested boat.
Archive:5537396 bytes, SHA256
`a2760e1caacb9bdf026c8b671040527af72fbd1089353456b91bda8903ce90af`.
Only then is the explicitly delegated normal STOP requested for this own boat.
Actual state is **stopped** at`18:31:43.167Z`;
`stop_6eb6f539385db398` is completed, error:null, forced:false, snapshot
completed/verified at`18:31:33.577Z`. Original expiry is now inactive.
All three owned supervisors are absent. `RECOVERY.md` in the ignored run
directory records reconstruction. Custody returns to the coordinator.
No subworker, foreign boat, deployment, original game run or successor is used.
