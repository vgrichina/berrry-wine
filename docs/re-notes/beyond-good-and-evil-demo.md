# Beyond Good and Evil Windows demo

Original installer:
`test/binaries/win98-games-a-d/BeyondGood&Evil-DX9-D3D/EnglishOfficialDemoBGE_WIN.exe`.
The installed executable on temporary box `bx_hx8msa33` is
`/home/user/bge-game-20261010/BGE.exe`, entry 0x0090df19. The extracted original
tree is mounted as its VFS. The original settings utility's saved registry is
`/home/user/bge-settings-save-20261010/registry.json` (77 imported entries).
These are temporary investigation paths, not a registered desktop route.

## Startup and message polling, 2026-10-10

With software D3D9, programmable shaders, cooperative threads and the saved
settings, the original previously stopped on
`MsgWaitForMultipleObjectsEx(0, NULL, 0, 0xff, 6)` at 0x4027c3.
It needs an immediate all-input queue poll with INPUTAVAILABLE and ALERTABLE.

Implemented this mode using actual queued work, a retained host-input event,
non-consuming timer inspection, and the existing APC callback continuation.
Empty polls return WAIT_TIMEOUT. Repeated polls retain unread input. No
synthetic message wake is used. Currently supported shapes are zero handles,
zero timeout, all-input masks 0xff/0x4ff and INPUTAVAILABLE (optionally ALERTABLE
or WAITALL, which has no additional objects to wait on). Other Ex modes remain
explicitly unimplemented: masked host-queue inspection, the new/old queue-bit
latch, and object/timed parking need separate work. Do not describe this as
complete MsgWaitForMultipleObjectsEx support.

Contract reference:
https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-msgwaitformultipleobjectsex

Canonical build, `test-msgwait-ex-poll`, `test-msgwait-infinite`, and
`test-queue-user-apc` pass on the temporary box. The new test covers queue and
input retention, preserved input fields, timers, actual APC execution/return
and stack cleanup, and fail-fast unsupported modes. Evidence:
`scratch/runs/20261010T0743Z-bge-poll-tests-20261010`.

## Next blocker: MOVNTPS

A 30,000-batch run ends after only 0.719 seconds with a blank window and is
too short to diagnose a hang. Raising the batch budget exposes the next real
stop at batch45179: `MOVNTPS` (0F 2B) at EIP **0x0048e692**, with aligned
destination storage rooted at EAX 0x7d799b80. Nearby code performs several
non-temporal XMM stores to consecutive 16-byte slots. Inspect the exact
instruction and existing SSE store/exception handling before implementation.

The original run exits with an unsupported-instruction trap, not gameplay.
Evidence: `scratch/runs/20261010T0743Z-bge-million-batches-20261010` (full crash,
identity and cleanup). A trace-window-only replay hid the useful late
diagnostic; prefer the unfiltered crash receipt.

## MOVNTPS implemented; next COM failure

SSE1 memory MOVNTPS now preserves all 128 source bits through guest translation
and code-cache invalidation; misalignment raises an access violation before any
write at the instruction address. Register and unsupported prefix forms remain
fail-fast. Canonical build and MOVNTPS, scalar SSE (144 cases), and MsgWaitEx
tests pass on bx_hx8msa33. The initial test attempt lacked notepad.exe; staging
the original fixture resolved that setup failure.

The original executable now passes the old batch45179 instruction stop and
reaches batch56150. Next failure is a COM vtable call at 0x004aaa42
(`[edx+0x88]`, return0x004aaa48), with EAX0x8876086c after the preceding
call. The generic ordinal diagnostic does not identify this method; resolve
the object/vtable before changing APIs. No gameplay yet. Evidence:
`scratch/runs/20261010T0758Z-bge-movntps`.
