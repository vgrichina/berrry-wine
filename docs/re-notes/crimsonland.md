# Crimsonland

Reflexive wrapper-free fixture: `test/binaries/candidates/reflexive-crimsonland/game/crimsonland.exe`.
SHA-256 `93cdcdc872c836e75122e3a1d41312c74761cf4736181d3541521e82f6cb2031`.

## DirectX startup detection

The original `DirectX8.1 or newer not detected` message is at guest string
`0x474ec0`, used by the startup path around `0x42c700`. Version detection
`0x41cf90` tries COM DxDiag (`0x41d090`) then SDK-style component file
version checks (`0x41d2c0`). Registry DirectX Version overrides do not affect
that fallback. `0x41de30` performs GetFileVersionInfoSizeA,
GetFileVersionInfoA, and VerQueryValueA("\\") and reads VS_FIXEDFILEINFO.

The static system-module list omitted d3d8.dll and d3d9.dll despite runtime
implementation of their exports. Therefore named version queries failed.
The fix appends their identities after the existing Glide identities (no
existing pseudo handles shift), recognizes their version resources, and
reports component generations 4.8.1.901 and 4.9.0.904. Legacy DirectPlay
remains 4.6.3.518. This fixes the actual API chain without changing guest
code or bypassing its detection. Extended `test-static-dx-version.js`
passes all 23 assertions using the compiled canonical artifact.

## Launch and rendering

Seed `grim.dll`, `vorbis.dll`, `vorbisfile.dll`, `ogg.dll`; include the whole
asset tree. DLL DllMain calls return success. The launcher Play button is
control ID 1000 (normal mouse around312,134). Default screen mode is
800x600x32. Startup now reaches this real launcher and its D3D8 adapter.

The first asset load spends time in grim.dll JPEG decoding: relocated
`0x6215b2` is original `0x100425b2`, YCbCr-to-RGB table conversion.
`grim.dll` base in the observed run was0x5df000, original0x10000000.
Do not interpret an early black frame as a stopped guest.

A software CLI run ended by explicit quit after369batches/276seconds;
154759ms was spent waiting on just four software D3D requests, so software
rendering is impractical for this capture on the loaded local machine.
Native CLI reported that a GPU window was required. Browser GPU acceptance
is being pursued separately. No gameplay claim from these startup probes.

Browser verification on localhost58114 reached the renderer launcher and loading
artwork with two guest Workers; gameplay was not verified in the bounded run.
Latest capture: `/private/tmp/reflexive-probe/crimson-browser-live.png`.

## 2026-10-04: owning exit diagnostic, still no gameplay

All 61 declared fixture paths are present (hash inventory in
`scratch/new-game-crimsonland-20261004/static-audit.json`). Current direct launch
with ordinary visible Play at312,135 still exits to desktop. This was a diagnostic
with a private passive Worker import wrapper, not an uninstrumented baseline.
Run: `scratch/runs/20261004-crimsonland-startup-exit1`; canonical WASM f40d4ca3,
host f2139768, private Worker76c8a73c derived from canonical3665f7c9.
Browser/server session1512 closed cleanly02:20:05Z. GPU was enabled in browser
flags; actual WebGL rendering was not established before the exit.

The owning ExitProcess callback captures current_thread_id2 (1-based),
ESP0x31c7fb0, EBP0x31c7ff8, code0. Stack words at0x31c7fa8/0x31c7fb4/0x31c7fc4
are0x454e02/0x454d5b/0x454813. Exact mapped code around the first return matches
the pinned EXE at image base0x400000. This identifies CRT cleanup entered from
0x45480e in the thread wrapper's exception body0x454808, via0x454d4e/0x454d5f.
The wrapper's scope table0x46f838 contains{-1,filter0x4547f4,body0x454808}.

Do not infer original exception code0: current src/11-seh.wat's nontrivial-filter
shortcut skips executing the filter that normally writes the exception code to
[EBP-0x20], and that captured local is0. The original fault location/code remains
unobserved. A focused next diagnostic should capture existing host.log_i32
CAE8C000/code/EIP triples emitted by raise_exception_access before the SEH walk,
with bounded owning registers/live code/DLL mappings. It needs no breakpoints,
trace flag, guest writes or speculative exception-handler repair.

## Original fault and DirectSound mapping hypothesis (2026-10-04)

Run scratch/runs/20261004-crimsonland-original-fault2 captures the existing
CAE8C000 / C0000005 / 43c544 owning log triple before SEH cleanup. Exact live
code matches the pinned EXE. At43c544 the EXE copies an audio buffer following
IDirectSoundBuffer::Lock (vtable+2c), then would call Unlock (+4c). Captured
source03c63d3c, destination08616004, byte count542ba, ECX150ae; app sound object
4c84e8 has PCM mono44100/16-bit format and DSBuffer wrapper08009298. This is
not proof of either operand's missing mapping, and the observer lacks DF/fault
address. No gameplay scene or FPS was obtained; browser/server closed cleanly.

Source candidate: Lock converts stored backing WA to a guest pointer using only
linear arithmetic, whereas CreateSoundBuffer allocates through heap_alloc and
stores g2w(buffer). Sparse heap allocations need the existing w2g inverse. The
observed destination corresponds to backing08228004 under the current formula,
inside the virtual backing arena. Actual backing/PTE/heap records remain needed
before assigning the failure to this candidate. See scratch/new-game-crimsonland-20261004/
mapping-plan.md. No shared engine edits or REP/SEH experiments were made.

### Mapping proof, attempt4

Immutable run scratch/runs/20261004-crimsonland-dsound-mapping4 confirms the
DirectSound pointer-contract error. Slot83/type5 stores344762bytes at WASM
0x08228004. Lock returns0x08616004, whose entire85-page span and endpoint map
to0xF0 with no PTE. Unique virtual record6 maps guest0x7e600000,size1MiB to
backing0x08228000, so the actual allocation payload is0x7e600004. All85 corrected
pages and endpoint map contiguously; source span is valid direct memory. Wrapper,
DX entry, map count and heap count rereads agree. Original fault remainsC0000005
at43c544; no fault-address/DF capture or REP implementation claim. Session17727
closed cleanly02:38:52.188Z, no gameplay. Attempt3's mapping observer failed on a
nonexistent NULL_SENTINEL region key; preserved as harness-limited, corrected and
tested against the actual region map before attempt4.

Parent authorized only Lock's backing-to-guest conversion to existing w2g, plus
real-handler allocator/offset/wrap regressions. Before-source09a8 SHAa39018fd
preserved. Canonical WASM stillf40; private compile qualification pending.

### Repaired production-shaped candidate reaches interactive tutorial

Run scratch/runs/20261004-crimsonland-gameplay-candidate1 uses isolated ordinary
production modulefa783563 (1664773bytes), compiled by tools/build-compile-wat.js
from exact current include closure, with no test exports or private Worker hooks.
Canonical f40 artifact remains unchanged. DirectSound Lock now uses existing w2g.
The actual-handler regression covers20cases over two instances, linear/sparse
allocations, offsets, ring wrap and ENTIREBUFFER. Before-source control fails
specifically on the sparse returned pointer after direct cases pass.

Visible Play opens loading screen and main menu, rather than prior immediate
thread exception/exit. PLAY GAME -> Tutorial reaches rendered terrain/player.
Ordinary ArrowRight1000ms then ArrowDown800ms scrolls terrain and bonuses around
the centered player, and advances the tutorial movement instruction to bonus
pickup. Three reviewed gameplay images are in the published run. FPS remainsnull;
no combat/level completion or audio-quality qualification was performed.

Later Escape opens pause menu, and visible Back click instead leaves the game
cursor over Options. This is a separate unresolved pointer/menu alignment
observation, not proof of a specific coordinate-transform cause. Result remains
unknown with reviewed tutorial gameplay, not broad release readiness. Session7885
closed at predeclared300sec deadline03:51:53.999Z; browser/server closed and PID
gone. No game exit inferred from guard. Root owns integration/build decisions.
