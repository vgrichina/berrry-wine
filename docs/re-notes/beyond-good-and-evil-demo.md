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

## Rectangular StretchRect and nested copies

API tracing identifies IDirect3DDevice9_StretchRect with non-null source and
destination rectangles, filter NONE. The whole-surface-only implementation
traps before copying. Archived rectangle/filter support is restored narrowly,
retaining the newer standalone LockRect semantics and backbuffer coverage.

Copy packets now belong to the guest stack frame. A different ESP starts a
child packet and saves the parent phase; completion or validation failure
frees that child and restores its parent. The existing host token snapshot
continues to own the suspended backend request. Same-frame re-entry resumes
the captured rectangles rather than reading mutable caller arguments again.

Direct/Worker pixel tests cover filtering, exterior preservation, scaling,
implicit backbuffers and suspend/resume. The nested regression exercises both
readback and upload parks with distinct source colors, invalid children before
and after allocation, restored parent phase and empty packet stack at the end.
The old shared-packet control fails by returning S_OK for the invalid child;
the fix passes. Canonical build plus color-target/alias suites pass. This is a
handler-level nested-frame test, not an original-game cross-thread callback
reproduction. Evidence: scratch/runs/20261010T0816Z-bge-rect-nested.

The original configured game now reaches a visible starfield intro instead
of the StretchRect trap (45-second bounded replay, clean terminal0). This
is startup progress, not player-controlled gameplay or a performance claim.

## New Game: archive/decoder mismatch (October 10)

Ordinary Escape at batch60000 reaches the menu; click240,255 at72500 and
Enter73000 reach an original Decode error. No gameplay qualification.
Run20261010T0827Z-bge-newgame; original decoder is0x492370, wrapper0x4911d0,
little-endian word reader0x4911b0. Wrapper compares actual output against
expected at0x49124a; error branch0x49124e. At failure84570: expectedEBX
0x016ffc00 (24116224), actualEAX0x7cfab (511915), compressedESI0xd00,
inputEBP0x9aa508, outputEDI0x7da8e984.

Run0855 captures the header/input after decoding. It starts
00fc6f01000d000000ff0300b3000000 and occurs twice in sally_clean.bf:
0x6c17ff and0x8217ff. The first search result alone does not establish a
wrong seek. Run0903 logs real ReadFile positions0x8217f7/fb/ff into0x9aa500,
2048 bytes each. The latter occurrence agrees with those reads.

Independent archive-table inspection: 1025 entries starting at0x44.
FF00631B starts8095744, stored padded size430076. Its two compressed blocks
at0x7b8804 and0x7e8b86 describe (output,input)=(512000,197498) and
(403650,232105), ending0x821637. The next entry FF40631B starts0x821800,
size94204, with uncompressed sound-bank data. The failing read starts one
byte before that entry. The format reference treats FF4 keys as uncompressed:
https://github.com/4g3v/JadeStudio/blob/master/JadeStudio.Core/FileFormats/Bigfile/FATFile.cs
This is a lead about selection/stream position, not proof of a seek API bug.

A standalone original-decoder probe supplied only the declared3328 input
bytes: neither uop mode terminated within100M blocks. Inconclusive because
the original decoder may read beyond the declared buffer. Do not attribute
the game failure to optimization from that probe. Re-armed break49124e
needed the310s controller guard; prefer trace-only for capture. Mid-block
trace49123e emitted no hits; next target is function entry492370.
Evidence: scratch/runs/20261010T0855Z-bge-decode-block,
20261010T0903Z-bge-decode-entry,20261010T0910Z-bge-callsite-trace.

Trace setup caution: --trace-from/--trace-to gates console.log globally,
including TRACE-AT diagnostics (test/run.js traceWindowOpen). API windows
can hide decoder hits after breakpoint-induced batch shifts. A dedicated
unwindowed492370 trace is needed; absence in the windowed logs is inconclusive.

### Delayed entry capture and native decoder parity

Run20261010T0929Z-bge-late-decoder-entry delayed the function trace until
batch84000, after the ordinary menu inputs, without a global log window.
At84556 the original decoder receives the valid final block: expected403650,
input232105, source0x9da88e. At84588 it receives the malformed next header:
expected24116224, input3328, source0x9aa508, prefix
00ff0300b300000000c70800870000000050060087000000.
The bad input is therefore present before decompression begins.

Run20261010T0948Z-bge-native-lzo-parity compares the original game's decoder
against the boat's native liblzo2 lzo1x_decompress_safe, called from JavaScript
through Koffi. Both valid archive blocks match byte-for-byte in both
interpreter and uop modes (four cases), with EAX0, normal return, and exact
output lengths. Output SHA-256 values:

- Block0x7b8804,512000 bytes:
  3f19cef3d23f1a838e01b275ce79ae794824674e22d88a2fe0752b8d6d08146d
- Block0x7e8b86,403650 bytes:
  96ae4078c094b4a7643dabcab8ed65c36f40e2c7977bed6fddd31babe8edec98

Tested WASM: e74c9b0dcff250158282ece0406096d6b55bbb9eac514c0622852a73de3fe0dd.
This verifies those two isolated blocks, not every decoder input or the live
loader's destination state. Investigate loader selection and refill next.
Helper0x491300 checks compressed bytes available against input length+8;
0x491390 checks decoded space against the output length; both branch on
compression flag0x96a108. Stream counters/cursors occupy0x98f988..0x98f9b0.

Frozen-control stepping changed the route to the promotional Coming Soon
screen, as did an earlier startup-armed trace. Those captures are not evidence
for the New Game failure. Keep the ordinary run and delay tracing until84000;
the next capture targets wrapper0x4911d0 and its caller/descriptor/globals.
