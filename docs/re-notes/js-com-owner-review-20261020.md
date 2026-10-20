# Independent JS COM ownership review — 2026-10-20

Candidate: `eda54d326474e79f5ed39cb8e223b3ff652c3361`,
`task/js-com-callback-owner-oct20`. Review starts from fetched main
`1d58b6c5497d6315976ca9d506f66c84612681cc` in an isolated sparse
`task/js-com-owner-review-oct20` worktree. Candidate cherry-picked as
`845cd18934cf4fed57b062ed545a9dcde08e0bf8`. No main integration.

## Finding and correction

The candidate restores architectural EIP but omits the decoded stream `$ip`
and `$current_thunk_eip`. These are distinct interpreter control state.
`$sync_depth_enter` in `src/04-cache.wat` inspects `$ip` to decide whether the
suspended frame needs a spill pin. Its comment explicitly requires consecutive
nested runs to put the suspended stream's IP back before entering again.
`$run` changes `$ip`; restoring EIP does not restore it. In the sequential
DllGetClassObject → CreateInstance path, the second enter could therefore pin
according to the previous callback's stream instead of the suspended caller.
This is a source-demonstrated missing precondition, not a reproduced native
spill corruption. `$win32_dispatch` also overwrites `$current_thunk_eip`;
`$icm_drv_call` documents and restores that same parking-related control value.

The correction adds four dedicated i32 accessors and retains both values in
the JS activation. They are restored only after the completed callback's
expected-child leave succeeds, alongside existing parent restoration. Trap,
stale, capacity, incomplete and instance/memory-replacement paths still do
not pop or restore. No jump API, primitive ownership algorithm, or spill
algorithm changed.

The regression interprets the actual accessor ASTs, changes both control
values during completion, checks nested restoration and sequential entry IP,
and rejects independent omissions of either restoration. The original
candidate fails the enhanced suite with the changed IP/thunk still visible.

## ABI and ownership assessment

- Actual WAT exports return/accept i64 tokens. JS keeps the BigInt opaque;
  there is no Number conversion. `$invocation_current` validates thread id,
  process epoch and slot root before returning the active stack token.
  `$invocation_enter` checks depth 63 before allocating a child; serial
  exhaustion traps instead of wrapping. `$sync_depth_enter` acquires the
  identity before changing depth/pins. The leave wrapper checks the expected
  child before the generic pop can consume it.
- The JS closure retains its own token, exports, memory and parent state.
  Every run slice is bracketed by identity checks; completed return is
  exactly EIP zero with no blocking yield. Nested calls get separate closures.
  An abandoned extra child, sibling substitution or stale owner cannot
  authorize restoring the old parent. No catch converts a trap into HRESULT.
- Stack writes are right-to-left followed by zero return: CreateInstance
  receives `{this, outer, riid, ppv}`, AddRef/Release receive `{this}`, and
  DllGetClassObject receives `{rclsid, riid, ppv}`. A completed HRESULT is
  retained even when the out pointer is nonzero. Allocation and temporary
  writes occur after acquisition. Allocation failure retains the abandoned
  child and propagates.
- Successful return restores all eight GPRs, EIP, stream IP, thunk EIP,
  handler redirection flag, steps, yield reason/flag and the saved FS:[0]
  SEH link. `$run` separately banks/restores its block budget and API depth.
  Guest flags, x87 state and segment-base changes are not asserted preserved
  by this review; the synchronous COM ABI and actual calling route must
  determine their requirements.

## Verification and census reconciliation

Self-contained evidence:
`scratch/runs/20261020-js-com-owner-review/`.
Run `node scratch/runs/20261020-js-com-owner-review/replay.js`.
It requires Node only and does not build or execute the full VM.

- Original evidence hashes verified before copying; original 26 cases and
  10 mutation rejections replayed, including the old-main negative.
- Corrected 30 cases and 12 mutation rejections pass. Extra cases check all
  CreateInstance argument words with a distinct outer pointer, reject EIP 1
  and 2 through budget exhaustion, and reject a zero temporary allocation.
- Both the original candidate and pre-candidate JS fail the corrected suite.
  Registry tests and JS syntax pass.
- Complete 266-file scanner produces 399 entries. The candidate's four own
  records match even when its old inventory reports the four inherited
  edit/WinHelp mismatches. Corrected combined inventory passes with no errors.
  All 395 non-COM rows exactly equal main `1d58b6c54`; only the storage hash
  changes relative to the candidate's four COM records. Added accessor
  bodies do not inject execution or create new census boundary records.
  Nonlocal API review lock remains enforced; ownership stays `pending`.

## Readiness and remaining evidence

Ready for subsequent integration review as a source correction, not native
qualification or whole jump-system readiness. The fresh branch contains the
candidate plus the narrow correction on census-fixed main. The shared
worktree, HEAD/index, laptop Heroes II/Warcraft III work and unrelated changes
are not part of this task.

The fixture models CPU run, memory translation, allocation and token
primitives. Capacity/stale cases simulate primitive rejection; they do not
exercise atomic serial exhaustion, 63 real children, retired-instance races,
actual spill pins or reclamation. The wrapper interpreter is not proof of
compiled i64↔BigInt ABI validity. Simulated completion overwrites ESP and
then observes parent restoration, so it does not validate guest `ret N`
cleanup or detect a callee with a wrong calling convention.

Required native qualification: canonical gated combined build; real x86
on all three JS COM routes (including sequential DLL/factory and nested
registered factories); exact argument/return stack behavior and HRESULTs;
parent control/SEH preservation; real stale epoch/thread-slot/root and token
rejection; abort/yield/exit/budget behavior without parent resumption; genuine
capacity and serial exhaustion controls; repeated callbacks with a suspended
spill stream plus pressure/reclamation. Verify the host route actually uses
the JS bridge rather than only the owner-side COM continuation path.
Existing edit/WinHelp native runs on census-fixed main do not qualify these
new JS paths. No runtime, full build, Boat, browser or additional worker was
used for this review.
