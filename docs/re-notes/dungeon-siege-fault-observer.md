# Reserved-page observer source candidate (2026-10-19)

This candidate descends from main6cfc0d936 (Surface and debugger watch fix)
through merge166f84855. The held Dungeon `reservedPageFaults` registration
remains a candidate, not a qualified startup fix. No original bytes changed.
The prior resolver-first capture found an intact SHFOLDER table; it did not
observe the later failing fault. Existing MSVC controls passed before this
new instrumentation, not after it.

## Hook and observation contract

`g2w_miss` adds a disabled-by-default per-instance observer inside mode5.
`set_reserved_fault_observer(1)` arms at most256 reserved-page misses;
`set_reserved_fault_observer(0)` disables it. It does not select fault mode,
flush/change JIT policy, modify reservations, or change exception disposition.
No guest address is hardcoded. Reservation membership releases its lock before
the synchronous host callback. Original eligibility/handler/translation/sentinel
paths remain; their successful early return emits its outcome first when armed.

The existing two-argument `unmapped_trace` import carries tagged observations;
`get_reserved_fault_observer(field)` exposes phase, ID, API depth, raising,
sync-active, sync epoch (fields0..5), and count (other fields). The host routes
tagged events to `ctx.reservedFaultObserver`; missing callbacks fail explicitly.
Ordinary untagged fault census behavior remains. No import/Win32 API ID changes.

Phase1 precedes the eligibility check and handler. Phase2 means mapped after
the synchronous handler returned true; phase3 means it returned false (including
its own sync/thunk eligibility refusal); phase4 means true but still unmapped;
phase5 means API-depth skip; phase6 means raise skip (takes precedence if both).
Pre-event gates and sync epoch disambiguate phase3; it must not be described as
proof that a guest filter ran. IDs/EIP are locals across nested handler calls.

`tools/reserved-fault-observer.js` reads registers, four64-byte contexts (fault,
stack, ESI, EDI), existing PTEs, at most16 FS frames with four candidate MSVC
scope levels each, and at most128 matching reservation records. Missing bytes
remain holes. It never calls `g2w`, guest execution, allocation or commit APIs.
Shared PTE reads use Atomics; reservation observations are not a global atomic
snapshot and report count changes. PTEs are reloaded per byte; page summaries
hold the last observed PTE, not a single stable mapping for all captured bytes.
Reservation replacement at the same count is undetected. Registers, bytes and
metadata need not represent one instant; outputs explicitly say `atomic:false`.
Scope interpretation is explicitly candidate. Reads continue beyond holes and
retain address/offset-tagged mapped fragments; incomplete reads have `bytes:null`
and exact missing spans, never a fabricated full buffer. Direct mappings below
GUEST_BASE, including wasm offset zero, match the production fast path.

The paired collector checkpoints pre-state before handling (so a nonreturning
handler leaves evidence), retains at most64 pending ancestors and16 successful
summaries, and stops on the first nonmapped outcome. Success does not consume
the observation. Reaching event256 successfully instead saves an explicit
budget-exhausted outcome. Saving then throws `RESERVED_FAULT_CAPTURED`; the
caller must terminate this instance, never catch-and-resume it. This applies to
**every** observer, snapshot, checkpoint, save or protocol exception, not just
the distinguished capture error: SEH globals can remain unrestored after any
host throw. The collector poisons itself on every exception and rejects later
events. IDs must increase without reuse and outcomes must follow LIFO nesting.
The future controller must unconditionally terminate the instance on any such
error; catching/logging and continuing is forbidden. Ordinary code
does not install or arm this hook. The collector is per instance; combining
multiple Workers would require separate identities and is not claimed here.

## Review and validation boundaries

Source tests: `node tools/check-reserved-fault-observer.js` exercises pairing,
successful retention, nested ancestors, all failure categories, exhaustion,
pending checkpoints, malformed protocol, byte-exact mapped reads, missing PTEs,
FS/scope cycles and reservation bounds, unchanged memory, and the extracted
production host import's ordinary/diagnostic/missing-callback routes.
WAT fragment, boolean operand and callback census gates also pass. The census
updates only the held app registration and new synchronous read-only host
boundary hashes; it does not claim guest nonlocal lifetime support. The merged
debugger watch regression passes and its runner was not edited.

Native fixture preparation adds `--observe` to the existing authentic MSVCRT
fixture. Planned commands (ONLY inside a separately granted bounded controller):

```
node tools/dungeon-siege-msvc-seh-fixture.js --root=COHERENT_ROOT --observe
node tools/dungeon-siege-msvc-seh-fixture.js --root=COHERENT_ROOT --observe --compat
```

These check real MSVC search/commit/file-read pre-hole to post-bytes, matched
IDs, declined-search result, explicit API/raise skips with no filter invocation,
and disabled-hook behavior. They are authored/syntax-checked, NOT run. Extend
native coverage for accepted-but-unmapped and genuinely nested faults before
claiming full hook qualification; protocol mocks alone do not prove WAT order.

No native/build/game execution is authorized by this checkpoint. Main ancestry
changed and WAT changed: existing7fd/a72 are invalid candidate pins. Required
next steps are independent source review, a normal coherent build and bounded
native controls in both dispatch modes, then review of narrow CLI/controller
installation and source/module pin updates. Old controls/preflight intentionally
refuse this mixed candidate. There is no ready original-game command yet.
Keep90/105/120-second original bounds,250ms hardfloor,32MiB aggregate output,
4MiB raw log,3MiB response and512MiB admission reserve. A capture must preserve
pre-checkpoints and terminal output and kill the instance after diagnostic stop;
it is not a gameplay retry or a mode workaround.
