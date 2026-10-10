# Hype: The Time Quest demo

App: `hype_glide_demo` (experimental). Original executable:
`test/binaries/candidates/hype-time-quest-demo/launch-game/MaiDFXvr_bleu.exe`.
The executable directly imports 50 Glide 3 entry points. Static extraction,
English installer mappings, package provenance and generated Windows INI are
documented in [the Glide 3 corpus report](../glide3-corpus.md).

## Startup DebugBreak: missing main-image export lookup

The 2026-09-29 remote CLI smoke stopped in the original sound plugin before
establishing Glide gameplay. The relevant log is
`~/nfs-movsd/build/hype-glide-smoke.log` on the reserved test box. It loaded:

| Image | Original base | Observed loaded base |
| --- | --- | --- |
| `MaiDFXvr_bleu.exe` | `0x00400000` | `0x00400000` |
| `dll/WAVx2BVR.dll` | `0x10000000` | `0x04301000` |

Thread 1 stopped at runtime `0x04302129`, preferred DLL VA `0x10001129`.
The preceding instruction reads the callback cell at preferred
`0x10024b9c`; if it is zero, the plugin calls `DebugBreak`. After the break,
the wrapper would call that same pointer, so ignoring the break would enter
address zero rather than repair startup.

The plugin initializer at `0x10003fb0` first resolves
`_SND_fn_vDisplayError@8` from the main executable handle. Its lookup helper
at `0x10003f40` calls `GetProcAddress`. If that returns zero, it constructs
the message `Function cannot be loaded dynamically` and invokes the error
callback that it has not yet initialized. Thus the visible break is the
error-reporting path for the failed export lookup.

The original executable **does** export the requested callback:

| Name | Ordinal | Original function VA |
| --- | ---: | --- |
| `_SND_fn_vDisplayError@8` | 2229 | `0x004d5430` |
| `_SND_fn_vDisplayErrorEx@12` | 2230 | `0x004d5490` |

The executable has 2,739 export-address entries, no zero holes and no
forwarders. Its export directory is RVA `0x194d70`, size 115,602 bytes.
This was checked against the original file, not inferred from strings.

`handle_GetProcAddress` previously searched `DLL_TABLE`, then known native
API names. The executable is not a member of `DLL_TABLE`, so it could not
answer this lookup. The fix resolves exports from the main image before
that existing path, using the shared mapped DOS/PE headers to obtain the
export directory. It must not rely on the loader instance's
`exe_export_rva` global: Hype makes the call on a secondary guest thread.
No sound configuration, executable bytes, or `DebugBreak` behavior changed.

The existing `test/test-getprocaddress-sparse-name.js` now checks the callback
name and ordinal, out-of-range ordinals, a zero address-table slot, an absent
name, stdcall stack cleanup and operation with the loader-global RVA zero.
Its original sparse-heap Win32 lookup still passes. The focused test passed
remotely on 2026-09-29 after correcting the synthetic fixture's name pointers
to lie above the 16-bit ordinal range. The post-fix remote CLI run reached a
visible main menu without the startup `DebugBreak`; evidence is
`build/hype-fixed-startup.log` and `build/hype-fixed-startup.png` on the test
box. The screenshot was opened for review. Browser Glide identity, entry into
the playable world and input-driven movement remain pending; menu acceptance
alone does not establish gameplay.

## Reproduction

Prepare the original extracted corpus, then use a current compiled artifact
on the remote test machine:

```sh
node tools/prepare-glide3-corpus.js --check
node test/test-getprocaddress-sparse-name.js
node test/run.js --app=hype_glide_demo --threads --no-build \
  --wasm=build/wine-assembly.wasm --quiet-api --max-batches=2000 \
  --png=build/hype-fixed-startup.png
```

Static evidence can be reproduced without executing the game:

```sh
node tools/pe-exports.js test/binaries/candidates/hype-time-quest-demo/launch-game/MaiDFXvr_bleu.exe
node tools/disasm.js test/binaries/candidates/hype-time-quest-demo/launch-game/dll/WAVx2BVR.dll 0x10001120 0x10001142
node tools/disasm.js test/binaries/candidates/hype-time-quest-demo/launch-game/dll/WAVx2BVR.dll 0x10003f40 0x10003fe7
```

## Export lookup limits

Native KERNEL32 currently aliases the main image handle. A missing EXE export
therefore retains the existing native-API fallback; removing it would break
callers looking up Win32 functions through that alias. An unknown callback
still returns zero. This is compatibility with the current handle model,
not evidence that distinct Windows module handles are interchangeable.

The reused `resolve_image_export` helper validates ordinal bounds and empty
address entries. It assumes valid name-to-ordinal indices and does not follow
PE export forwarders. The new dynamic main-image path guards the export
directory's RVA/size range: a resolved address inside it logs marker
`0x46574452` (`FWDR`) and the address, then traps. It therefore cannot return
a forwarder string as callable code. Named and ordinal forwarder cases have
focused regressions, which also passed remotely. Hype has no
such entries. This is an explicit unsupported case, not general forwarded-export
support; malformed PE export tables remain outside this investigation.

## Normal-input gameplay probe

The original `launch-game/Readme.txt`, section IX, documents the default
QWERTY bindings: arrows control the character, left Shift runs, Ctrl jumps,
Space performs an action, and Enter uses magic. Up/Down navigate menus;
Left/Right turn in the world. Do not assume a held Enter key moves the player.
`Gamedata/Options/Default.cfg` is binary data, not a text configuration to edit.

The existing investigation probe `build/glide-app-probe.js` can launch
`hype_glide_demo webgl 120 build/hype-gameplay-webgl`. It records desktop and
actual Glide drawable screenshots every five seconds, plus API version,
endpoint/backend and draw/present counters in `states.jsonl`. Its screenshots
are observations, not automatic world acceptance. A normal New Game menu
selection must be verified visually before calling a changed image gameplay.
After reaching the world, compare a stationary frame against a held ArrowUp
interval and a turn, while confirming API version 3, a `glide` endpoint and
advancing geometry/presents. The probe accepts investigator input through
`input.json`, for example `[{"hold":"ArrowUp","ms":3000}]`; this drives
ordinary browser input and does not modify the guest state directly.

### Menu input, viewport and FIFO polling (2026-09-30)

The menu initially ignored held keys despite correct host physical-key state.
Original code at `0x48e3bd` checks `DIDEVCAPS.dwFlags & DIDC_ATTACHED` before
enabling its keyboard. Our capabilities omitted that flag. Correct attached
keyboard/mouse reporting, plus the correct `dwButtons` offset 16, passes the
remote DirectInput regression for both 24-byte and 44-byte structures. Normal
Enter now loads the level. Keyboard flags change from `0x12` to `0x13`, and
the guest poll counter advances. No focus or input-transport workaround was
needed.

The resulting level capture still occupies only part of the 640×480 drawable.
A read-only snapshot confirms the top window has a 640×480 client, while its
three nested children retain 388×268 clients. Hype initializes its logical
resolution globals `0x5d8108/0x5d810c` to 640/480 and correctly selects Glide
resolution enum 7. Its viewport creation (`0x49a730`) uses the parent's client
rectangle, and `DEV_Device::OnSize` (`0x499250`) resizes the child. The Glide
fullscreen path changed geometry without the normal resize notification.
A candidate delivered `WM_WINDOWPOSCHANGED` after releasing the Glide lock,
allowing normal `DefWindowProc` processing to produce `WM_SIZE`. The subsequent
`build/hype-full-world-webgl.log` snapshot still had 388×268 child clients.
The candidate and its callback fixture were removed: it did not improve the
layout and its internal synchronous dispatcher bypassed window-owner thread
routing. A subsequent owner-thread fix is described below.

The matched `hype-capture3-webgl` / `hype-no-notify-webgl` captures also exclude
notification as a necessary cause of the observed bad geometry. Both capture
three triangles with nine vertices: five X values are NaN and all finite X
values are zero. Their draw state and non-finite field patterns match; all
eight drawable PNGs in both runs share SHA-256
`d38b77b951118e53418317ab5ab5fea654c449b3dc757ede3c171383b4902ceb`.

Static inspection narrows the next trace: `CPA_MainFrame::OnSize` at
`0x499fe0` calls helper `0x477a70`, which always returns zero. It therefore
takes the branch that conditionally waits on the application's semaphore
before calling native MFC42 ordinal 5030 through thunk `0x4f442c`. That MFC
handler (preferred address `0x5f40df89`) invokes its default handler and then
virtual method `+0xd0` (frame layout) unless the size type is minimized.
Counting entries to `0x499fe0` and `0x499250`, alongside child creation and
Glide open, will distinguish missing dispatch from notification timing or
layout suppression. No compositor scaling workaround is justified by this
evidence.

For upstream geometry diagnosis, original polygon clipper `0x483670` takes
the vertex count in ECX, a 60-byte-stride vertex buffer in EDX, and the renderer
context at `[ESP+4]`. Float clip bounds in that context are top `+0x3daa8`,
bottom `+0x3daac`, left `+0x3dab0`, and right `+0x3dab4`. Screen-quad producers
`0x486a30` and `0x486d20` use staging buffer `0x835ae0` (four vertices), but
which produced the captured frame remains unverified.

The Y-edge interpolator at `0x483bf0` is a specific candidate for the NaNs:
it calculates `(boundary-yA)/(yB-yA)`, interpolates X and attributes, and writes
the boundary directly as Y. This can produce the captured finite-Y / NaN-X
and attribute pattern. At its entry ECX is the output vertex, EDX is vertex A,
and stack offsets `+4,+8,+12,+16,+20` hold vertex B, yA, yB, boundary, and
context respectively. Capturing these inputs and the pre-clip staging buffer
will distinguish invalid source geometry or bounds from arithmetic failure;
the instruction sequence alone does not establish which occurred.

The subsequent world stall is a separate query bug. The rendering thread
repeatedly reaches `0x4f1626`, the `grGet` import thunk. Calls at `0x482427`,
`0x482442` and related sites ask for `GR_FIFO_FULLNESS` (3), length 8, and loop
while the first output word exceeds 2,000,000. The unimplemented query returned
zero without writing the output, leaving a stale stack value to drive an
infinite polling loop. The query now drains pending commands and waits for
backend completion (WebGL `finish`, synchronous native software), then writes
the SDK's free-entry count and status words. This adds no pixel readback.
ABI ordering, invalid-length and output-boundary tests pass remotely, as do
software and WebGL 1/2 completion tests. The render loop now progresses.

A subsequent captured frame still cannot change the picture: it clears only
depth, then submits three invalid/degenerate triangles. Five of nine vertices
have NaN X; the other four have X=0. Both software and WebGL retain the menu.
This first post-load frame was not enough to characterize steady gameplay.
The later matched notification comparison and frame captures below narrow
the observation without establishing a CPU arithmetic bug.

Evidence on the remote machine: `build/hype-attached-webgl/` contains the
first world capture; `build/hype-world-diagnostics.log` and its corresponding
`states.jsonl` record the window tree and stalled thread. These captures do
not yet demonstrate movement.

### Later frame comparison

Matched runs `build/hype-steady-default/` and
`build/hype-steady-interpreter/` use the same no-notification WASM and normal
Enter, Space, ArrowUp and ArrowRight route. The second disables both the
micro-op tier and x87 folding. A frame captured after 800 presents contains
no geometry in the default run, versus 390 triangles with 1,170 finite
vertices in the interpreter run. This comparison does not isolate either
optimization or prove a CPU bug: the captured frames can represent different
points in the application's execution.

Interpreter screenshot `006-drawable.png` shows the character in a blue
corridor, still restricted to 388×268 pixels. It was opened in Preview.
The other 15 drawable captures retain the exact earlier menu hash. LFB
read/write counts stop at 238 and remain unchanged through the later capture
interval, so repeated LFB uploads do not explain that return to the menu
image. Later actual-presentation captures below identify the alternating
guest swaps; this was not dropped delivery by the shared render worker.

### Owner-thread resize and movement

Glide fullscreen open now posts `WM_MOVE` and `WM_SIZE` through the existing
owner-routed USER queue, matching DirectDraw's mode-change path. It does not
call the window procedure on the rendering thread or while holding the Glide
lock. The focused ABI regression opens from one instance with a window owned
by another, verifies the ordered payloads and absence of inline callbacks,
and checks that a failed open posts nothing.

On the trusted fallback server, `build/hype-post-size-webgl/` captures a
636×476 child viewport inside the 640×480 drawable, replacing the earlier
388×268 viewport. Actual presentation frames in `build/hype-swap-callers/`
show normal ArrowUp movement and ArrowRight turning; `world-present-661.png`
and `world-present-1047.png` were compared visually and opened in Preview.
Default CPU settings in `build/hype-default-callers/` also produce four
captured world frames with 403–406 triangles and no nonfinite fields.
The earlier single-frame optimized/interpreter comparison sampled opposite
halves of the UI/world alternation and does not establish a CPU bug.
The remaining empty UI swap still prevents stable visible presentation.

### Alternating world and UI swaps

The eight adjacent swaps in `build/hype-swap-callers/frame-capture.json`
all originate from thread 1, return to `0x4671d4`, and use interval 1.
World frames have higher caller `0x43f631`; empty frames have caller
`0x42252b`. Device `0x03f012d8` has field `+0x38 == 0`, and both globals
`0x77728c` and `0x5da054` are zero throughout this sample.

Static disassembly explains the pair: frame-finish callback `0x43f610`
(installed at `0x5b2290`, paired with render callback `0x43f180` at
`0x5b228c`) finalizes descriptor `0x71cd04`, swaps surface ID
`short[0x71cd02]`, then directly calls `0x422260` at `0x43f678` before
releasing semaphore `[0x71cd6c]`. That second function acquires surface
`short[0x71cd70]` into descriptor `0x71cd74`, visits UI objects from
`[0x7136e0]` through links at `+0xd8` using `0x41f300`, finalizes the
descriptor, and unconditionally calls the same swap wrapper. These are
nested guest paths, not two independently scheduled windows or threads.

Wrapper `0x467180` decodes its second argument as device index `/16` and
surface index `%16`, clears the surface's acquired flag at `+0x64`, and
calls Glide swap when `[0x77728c] == 0`. Acquisition `0x467070` sets that
global from whether device field `+0x38` is nonzero. No renderer suppression
is justified by this evidence. The follow-up capture records world surface
ID 0 and UI surface ID 1 on device 0, an empty UI-list head at `0x7136e0`,
mode byte 9 at `0x71c620`, and zero flags at `0x5d9680/84`. The unresolved
question is why this device/surface configuration requests a second flip
without intervening color drawing.

Device field `+0x38` is not populated by a Glide capability query. Constructor
`0x466810` allocates a 0x10c-byte device and copies the caller's first
0x6c configuration bytes into it at `0x466b9e–0x466ba5`. The normal MFC
creation path at `0x499450` explicitly sets configuration `+0x38` to zero
at `0x49949e`, then calls this constructor at `0x49950d`. An alternate
path at `0x499320` sets it to one, but its entry checks `0x477a70`, whose
original implementation is exactly `xor eax,eax; ret`; consequently that
alternate path is disabled in this executable. The constructor can also
clear a nonzero value if an existing device already has it set. The observed
zero therefore matches the original executable's selection, and changing
Glide query results or forcing this field would not be a supported fix.

The pinned Glide 3 SDK's `gglide.c` implementation of `grBufferSwap`
unconditionally cycles current/front/back indices modulo the configured
buffer count, queues the swap command, and selects the new drawing buffer.
It has no exception for an empty frame. Its fast clear also respects the
RGB write mask, so a depth-only clear correctly preserves the older menu
color. These rules agree with the observed alternating buffer contents.
One concrete difference remains: our `handle_grBufferSwap` does not pass
the guest's swap interval to the host; it flips and publishes immediately.
The SDK encodes interval 1 as a retrace-synchronized swap and bounds pending
swaps. Browser compositing may therefore repeatedly sample the second UI
presentation when our two swaps happen close together. Correct pacing
would preserve both requested flips; it is not evidence that the retained
menu pixels should be discarded or that pacing alone fixes gameplay.

Buffer initialization does not explain the alternation either. All four
original `grSstWinOpen` call sites request two color buffers and one auxiliary
buffer. The executable imports no `grRenderBuffer`, `grGlideGetState`, or
`grGlideSetState`; it keeps the default back-buffer target. The SDK's initial
physical buffer numbering differs from ours, but the logical front/back
rotation is equivalent. Initial parity cannot account for menu pixels retained
after the later LFB uploads.

An isolated 120-second default-CPU replay then tested an interval-1 wait
before each swap using the existing virtual-vblank scheduler. It preserved
every requested flip and left canonical WASM and production source unchanged.
`build/hype-vsync-default/frame-capture.json` still alternates four finite
world frames (403–406 triangles) with the same old menu. Device and main-thread
present counts agree; the run ends without errors. World visibility between
actual publications was about 32–38 ms, versus 36–47 ms in the unpaced sample.
These are diagnostic observations, not controlled performance measurements.
Pacing alone did not fix stable presentation and was not promoted to production.

## 2026-10-05: authenticated UI clipping starts with nonfinite inputs

The corrected owning-Worker trace armed only after the successful world swap (EIP4f1644, returns4671d4/43f631), before nested UI422260. It retained four entry483bf0/post483c35 pairs, zero observer errors, then disabled its exact owned trace at the cap. Original EXE spans and actual served module/source are pinned in the immutable run.

The first UI pair already has yA=NaN (`ffc00000`), yB=0; its A vertex is (635,NaN). The second enters with yA=+Infinity (`7f800000`), yB=NaN. Later pairs also contain infinity. Therefore this observation does not establish Y interpolation as the first corruption and does not justify patching its arithmetic. Next trace the incoming quad and earlier X clipping to locate the first nonfinite value. Preserve raw float bits; JSON null is not a sufficient numeric description.

Evidence: `scratch/runs/20261005-hype-ui-clipper-nonfinite-input` (207 artifact hashes rechecked); raw clipper SHA256 `c0ecfa49e04bc0a296f5f7d68696aa4d21665802e9788f66cf276e9ad87a45ee`. Session74195 exited0, browser/server closed10:33:12.696Z. `after-trace.png` shows the knight/street world, but this intermittent scene is not stable gameplay or input qualification. No FPS or normal-timing claim under trace.

### UI polygon before X clipping (attempt7)

The first authenticated UI polygon is already `(0,0),(+Infinity,0),(+Infinity,+Infinity),(0,+Infinity)` at483670. Its raw caller return4870c9 identifies the quad path486d20. Two X entry/post pairs are captured, with no observer errors; the next swap matches the expected UI caller and ends the phase. NaN X/Y interpolation results follow the already-infinite input rather than establishing an emulator clipping defect.

Source486d51..486d71 copies XY from four16-byte input records to four60-byte staging vertices at835ae0. The input pointer is original ESP+0xc; context is original ESP+0x1c. The next minimal capture is function entry486d20 (actual caller/input64bytes) and post-copy486d73 (same pointer/staging240bytes), followed by the polygon entry to detect any intervening change. Do not assume the original source coordinates are infinite without this observation.

Immutable evidence: `scratch/runs/20261005-hype-original-ui-quad-infinite`,207 artifact hashes verified; rawSHA256 `fa676bf6bc64403017f60ac961765e984dccee3c14f76e1bb3e8b80b59cb4ac7`. Session35108 exited0, browser/server closed10:42:22.298Z. The image remains menu-only; gameplay and FPS remain unqualified.

### Incoming rectangle confirmed infinite (attempt8)

The ordinary UI-phase probe captures the complete486d20 entry →486d73 copy →483670 polygon chain with zero observer errors. Actual caller469a5b authenticates the rectangle constructor469710. Incoming quad0420f988 already has `(0,0),(+Infinity,0),(+Infinity,+Infinity),(0,+Infinity)`; all XY bits match both copied staging and later polygon. Neither copying nor clipping introduces the first infinity in this capture.

Immutable run `scratch/runs/20261005-hype-incoming-quad-infinite` has207 rechecked artifact hashes; rawSHA256 `da1af7a6181198834030fa7630b500c529e1adeb330a555c5d2d4cbd545fbe2c`. Browser7356 exited0, closed11:11:54.802Z. Menu-only image; no gameplay/FPS qualification. Next inspect actual469710 incoming rectangle, descriptor dimensions, live reciprocal table entries, and post-scaling arguments before its quad construction. Do not assume which size/angle branch executes.

### Actual rectangle caller and smallest missing divisor evidence (attempt9)

Observed caller is41f17c, correcting the earlier static candidate41f352. The original rectangle arguments already contain `(0,+Infinity,0,+Infinity)`. Live descriptor dimensions are636x476, reciprocal table words are004ccccd/00088889, and the post-scale width factor is finite0.9937500357627869. Therefore469710 size scaling is not the first infinity producer in this capture.

Original caller41f0e4 divides1 by71cdd0 (descriptor71cd74+5c), and41f125 divides1 by71cdd4 (+60), then multiplies actual dimensions and submits at41f177. Initializer4678ed/4678fa stores width/640 and height/480 in these fields after466cc0. Later466cc0 updates dimensions but does not write+5c/+60. This identifies a precise dependency, not proof that initialization was skipped or the fields are zero. Previous84-byte descriptor capture ended before them; the next approved extension reads exactly these8raw bytes at the same authenticated rectangle entry. Zero/denormal inputs can produce nonfinite results under correct arithmetic; finite-normal inputs still require exact x87 operands/precision proof before blaming CPU execution. No guest-state repair or clipping patch is justified yet.

Immutable evidence `scratch/runs/20261005-hype-rectangle-caller-divisors` has207 verified artifact hashes; rawSHA256 `406e004704de98fa44f56bfb424cf0905944ddd4d557bf46927345754fc30624`. Browser78398 exited0, closed11:24:11.451Z. Intermittent world image is not stable gameplay qualification; no FPS claim.

### Zero descriptor scales observed (attempt10)

The exact eight bytes at71cdd0/71cdd4 are `0000000000000000`: both descriptor scale divisors are positive zero at authenticated rectangle entry from41f17c. This directly explains the positive infinities through the original1/+0 arithmetic, without establishing a CPU division bug. The observation does not yet explain why initialization or later lifetime handling left those fields zero. Do not replace guest values or suppress swaps.

Immutable `scratch/runs/20261005-hype-zero-descriptor-scales` has207 verified artifact hashes; rawSHA256 `471da24aff6154699b09aafcc796cf6330fb68fc482d3f3bdb9e901b312020a0`. Session27505 exited0; browser/server closed11:33:01.065Z. One complete rectangle/quad chain, zero observer errors, exact trace disabled. Image remains menu; no gameplay/FPS claim.

Static lifetime distinction:404c80 registers the UI descriptor71cd74 via466de0, which allocates a separate104-byte heap surface record, copies100bytes into it, updates dimensions with466cc0, copies100bytes back and stores the heap pointer in the device surface table.467730 later initializes+5c/+60 on the **heap surface**, not necessarily the static UI descriptor;467010 copies100bytes from heap to caller. Thus static-versus-heap identity must be checked before calling this skipped initialization. A bounded read of the live UI surface ID71cd70 and its device/surface-table pointer at use can distinguish a stale static descriptor from zero scales in both records. No broad renderer trace is needed.

### Refined next observation: authenticated acquisition copy, no pointer walk

The proposed ID/device-table lookup is superseded by the exact live copy path:4222b3 calls467070, which resolves the actual heap surface and copies100bytes to static71cd74 at4670ce on every UI acquisition. Read actual EAX source and EBX destination at4670c3, verify caller4222b8 at original stack+24, then record both100-byte records after the copy. Use known branch-entry checkpoints4670e1/467105, not an assumed post-REP block at4670d0; require same TID, ESP+8, ESI=source+100, EDI=0, ECX=0 and retained EDX/EBX identity. Compare dimensions and scales with the later authenticated rectangle-use snapshot. One acquisition/rectangle chain, three seconds or next swap, no guest mutation.29 focused tests pass.

Source ordering within467730 is dimensions-update466cc0 before scale stores4678ed/4678fa for each heap surface. Surface creation itself466de0 updates dimensions and copies descriptor fields but does not compute scales. Actual ordering between initial creation, mode changes, scale initialization and later copying is not yet observed. A zero heap source would shift diagnosis to that lifecycle; different source/postcopy/use values require their own provenance before any repair.

### Heap source is already zero; descriptor copy is faithful (attempt11)

Authenticated acquisition resolves heap surface042fef50 and static UI descriptor71cd74. Before copy, heap+5c/+60 are zero; static destination is the expectedcccccccc prefill. After the100-byte copy, destination matches source exactly, including zero scales, and the rectangle-use snapshot retains those zeros. No copy defect or intervening scale overwrite is shown. One complete identity-checked chain, zero observer errors, owned trace disabled.

Immutable run `scratch/runs/20261005-hype-heap-zero-scale-copy`,207 artifact hashes verified, rawSHA256 `92009c5b634ab403eb58e9e4dc64a46edde0c5b8e599bbe03a3bbbb3cf09ade6`. Session2554 exited0 and closed11:49:16.362Z. Menu screenshot only; no gameplay/FPS qualification. Evidence files were hardlinked after closure to avoid redundant disk use; contents and paths are preserved.

Next examine creation/mode lifecycle, not rendering: source466f60/466c77/4674a5/4678c3 calls dimensions-only466cc0; only the467730 mode/reset loop then stores scale fields at4678ed/4678fa. UI surface creation466de0 can therefore leave scales copied from zero static storage until such a loop includes the new heap. Caller49977e invokes467730 conditionally when frame+54 is zero;499921 invokes it after466460. Their actual order relative to UI surface creation remains unobserved. Do not infer skipped initialization from use-time zeros alone.

### 2026-10-05: bounded startup census ties zero scales to creation and resize

Attempt12 (`scratch/hype-route-prep-20261005/attempt12/analysis.json`) captured actual Worker startup, before any Enter or Space input. Slot1/TID2 created static UI descriptor71cd74 into heap042fef50: both scale fields+5c/+60 were zero in the incoming descriptor and remained zero after dimensions helper466cc0 produced388x268. Slot0/TID1 subsequently updated the **same heap** to636x476 through caller466c77/return466c7c; scales remained zero. This narrows the observed lifetime without asserting that initialization never occurred outside the captured intervals.

All three origins emitted coverage start/end and disabled their owned trace. Slot1 rejected an unexpected UI-acquisition caller after about5.6seconds; the old helper unfortunately rejected before emitting its stack, so the actual caller is unknown (expected4222b8). Slots0/2 reached their30-second deadlines. No mode467730 or scale-store completion was observed in those bounded windows. The new source-only observer records the exact32-byte stack, expected/actual caller and heap before retaining the same failclosed rejection;16 pure-JS tests pass, including both real Worker run callsites. No repeat or game patch follows from the missing field alone.

Static event distinction: the original MFC message-map entry for message5 points to499250 (record at file offset18fda0; handler pointer18fdb4). That WM_SIZE path calls466c20 at499281 when frame+54 is zero, subject to477a70 and frame+58 gates.466c20 obtains GetClientRect through IAT5906a4, updates device dimensions, and invokes dimensions-only466cc0 for existing surfaces; it does **not** call the scale initializer467730. Thus the observed resize path is not itself evidence of a lost scale-initialization call.

Both467730 callsites49977e and499921 belong to499710, a mode/window-state toggle routine: on one branch it calls467730 only when frame+54 is zero and then sets that flag; the other branch reconfigures via466460 and calls467730 before toggling the flag. Its callers include the WM_SYSCOMMAND handler499e20 (message112 in map at file offset1900c0) and WM_ACTIVATEAPP handler49a160 (message1c in map at190090), plus a CallNextHookEx-based hook497fb0 that recognizes a structure's message400/wParam69. These paths are distinct from ordinary WM_SIZE. Their exact runtime conditions/order relative to UI creation remain unobserved; do not invent a required display-change notification or force one. Next useful evidence is the actual mode/frame state and dispatch cause around creation, not another renderer/clipping trace.

### 2026-10-05: original build selector narrows activation path

Further source correction: original477a70 is33c0c3 (`xor eax,eax; ret`), so unmodified499710 takes49988b and initializer499921, not the conditional49977e branch discussed above. WM_ACTIVATEAPP handler49a160 likewise selects49a37a. Activation TRUE reaches the mode toggle only with app+e0 nonzero and frame+54 zero, protected by recursion guard6ac514; initial activation need not initialize scales. The emulator source has both explicit first-ShowWindow and implicit-WS_VISIBLE activation chains (09a5-handlers-window.wat and09b-dispatch.wat), but execution on Hype's historical f40 module is not thereby proven. No missing-message claim or patch is justified.

A separate source-only transition observer now authenticates original selector bytes and captures named activation/frame/device/heap provenance, armed once before normal Enter/Space rather than rearming startup evidence. Bounds remain32records/30seconds per origin; unknown callers and late code/owner mismatch stop capture with cleanup. Ten pure-JS tests cover app lookup, frame/device/heap pairing, original forwarding, foreign instrumentation and late failures. Browser integration remains pending; no new runtime or timing claim. Source details: scratch/hype-route-prep-20261005/activation-source-analysis.md and transition-observer.js.

### 2026-10-05: ordinary control check still alternates menu and world

Immutable `scratch/runs/20261005-hype-ordinary-control-interleaving` uses202 pinned canonical app/source identities, actual f40 module, no private Worker or trace. After ordinary Enter/Space, a personally reviewed world gate shows knight/street. The finite Up600ms/Down600ms batch captured menu already at its before image, world after Up, then menu after Down and after2seconds settlement. Root independently reviewed after-Up and settled images. Stable player-controlled gameplay remains unqualified; the gate did not remain valid through the batch. No FPS, reversal, sound-quality or level-completion claim. Browser/server closed12:28:23.927Z, exit0/errorsnone.

Historical upstream front/back evidence locates world/menu alternation in the same GPU presentation chain, before page composition, with distinct world/UI guest presenter callers. That does not prove simulation state toggles. Invalid UI geometry leaving an old menu color buffer is a hypothesis only; do not suppress swaps.

Static dispatch resolution now identifies46ef70:46ed90 returns table7c4360; initializer482960 writes offset10c at482c0e to4823e0, hence7c446c→4823e0 for that table setup.4823e0 increments render counters, calls4825a0, drains queued geometry and grGet-based completion checks. It is not justified to call this pointer merely a context/window activation. Both presenter paths subsequently reach common467180→grBufferSwap4f1644 when77728c is zero. Actual table contents/flags at the problematic call still require existing captured evidence or bounded passive authentication; no engine fix follows yet. Next source focus is queued UI geometry/clear and buffer selection, not another wide instruction trace.


### 2026-10-05: bounded attachment comparison supports stale menu color

Immutable `scratch/runs/20261005-hype-attachment-stale-menu` preserves64 hashed artifacts and raw receipt SHA25620a734491ba801f880dfd0927907a8d52ce05f6ddb719eca6778dc179a0cc2c4. The observer now wraps actual Device.execute recursion: the earlier Device.submit wrapper missed commands inside opcode0 batches. An actual-source regression reproduces that failure and verifies the corrected boundary. Attempts15/16 remain unqualified; no missing-receipt inference is carried forward.

Attempt17 captured four swaps/eight readbacks, with owned hooks restored and no observer errors. In pairs1/3, the same attachment retains identical coherent menu pixels before its clear and after three executed draw commands. The clear's original mask includes COLOR_BUFFER_BIT and DEPTH_BUFFER_BIT, but all color-write channels are disabled and depth writes enabled. World pairs2/4 use the other attachment, execute403/405 draw commands, and change pixels. Readbacks changed their initial sentinel, framebuffer status was complete, and context-loss checks were false. GL error state was deliberately not consumed, so equality remains conditional evidence supporting stale menu color exposure, not an unconditional readback proof or a demonstrated new menu repaint. Counts describe executed commands; batch merging can combine primitives. No stable gameplay, physical FPS, sound or performance claim follows.

The automatic route completed in48.122seconds and cleanup at13:10:44.368Z closed browser/server without errors. Its post-Space limit was30 screenshot iterations, not30 elapsed seconds; screenshot overhead could exceed that inner limit. The source helper is now corrected to an elapsed deadline, rejecting late screenshots, with a timing-overhead regression. The historical record is unchanged. The90second route and180second session limits were retained in the actual run.

Next causal target remains scale initialization of the same UI heap. Original467730 can fail after467600 or466810 before any scale stores, and only iterates sixteen restored surface pointers after both succeed. Its original constants are1/640 and1/480, producing nonzero scales for636x476 dimensions if that exact heap reaches the stores. Initializer entry alone, or a call before UIheap creation, does not establish initialization. A cold mode-entry/return and membership proposal distinguishes these cases without another wide render trace or a swap workaround.


### 2026-10-05: cold mode probe found no post-title invocation

Immutable `scratch/runs/20261005-hype-cold-post-title-nonobservation` preserves attempt18. Raw cold receipt SHA256ce8319e69bcff70e18007d370dcb94ed1930fa6568518efb8bbaf081fcb7b141 records actual owning slots0/1/2 (TIDs1/2/3) starting before the ordinary Enter/Space input. Each observed zero callbacks in the cold499710–499a85 range during this declared post-title interval. Consequently no initializer return or same-heap scale result was captured. This does not establish absent startup initialization or a missing activation message.

The automatic route completed in20.057seconds with two world-template matches; its last image shows the knight/street. There were no movement inputs and no stable gameplay qualification. Explicit host diagnostic close produced all three owning trace-disabled end receipts; browser/server closed13:34:43.641Z, exit0, no cleanup errors. Next bounded observation belongs before title, after mapped-code authentication and immediately before the first actual guest run, not another repetition of this post-title interval. Historical startup receipts place surface creation about1.1–1.3seconds after the first observed guest run; whether the relevant initializer runs in that window remains unobserved.


### 2026-10-05: bounded startup mode non-observation and actual UI constructor

Immutable `scratch/runs/20261005-hype-cold-startup-nonobservation` preserves42 hashed artifacts from attempt19 (raw SHA2565a2c721d5700461c76160c9e031e4c17c24937e7f0ca19638b67290f3e2c9bf2). All three actual-first-run origins authenticated mapped code and enabled the cold outer-mode range; each recorded zero callbacks over22.145–23.479seconds through title and ordinary Enter/Space/world images. Route completion closed the interval before its30second maximum. All three trace-disabled end receipts and browser/server cleanup were retained; exit0,13:44:58.268Z, errorsnone. This captures no initializer or same-heap outcome and does not establish that mode467730 must execute. No stable gameplay or FPS claim.

The earlier attempt12 evidence identifies the actual UI constructor more directly: slot1/TID2 enters466de0 with return404cb8, deviceID0, descriptor71cd74 and outputID71cd70. Descriptor scale fields+5c/+60 are already positive-zero bytes before allocation/copy; the paired heap042fef50 retains them after466f65 calculates388x268 dimensions. Original404c80 initializes only percentage rectangle fields0/100/0/100, and complete dimension helper466cc0–466da4 does not write the scales. Later registration functions49c910/589620 only store descriptor pointers. These observations support initially missing scale values, not a demonstrated later overwrite.

Alternate bulk descriptor updater467450 clears/copies104/100bytes and recalculates dimensions; UI wrapper404e8f changes percentage fields but supplies the existing descriptor scale bytes. That can propagate zero values without proving where nonzero values were expected to originate. Source investigation now concerns the normal constructor/backend view contract and alternate writers, not repeated mode probes or forced scale/swap workarounds.


### 2026-10-05: normal scale initialization requires an unsupported message hook

Source analysis of the exact Hype EXE (SHA256 `635f394121e50001227b97741dbf304f0a88f819c6f2ba2378cf61d9fa2a6344`) found a concrete initialization path, replacing the earlier speculation about activation or arbitrary mode changes. Startup `498058` calls `SetWindowsHookExA(WH_GETMESSAGE=3, 497fb0, hModule, currentTID)`. The original PE import table confirms the hook API and `GetCurrentThreadId` identities.

Immediately after UI construction `401f9c→404c50`, startup unconditionally calls `401fa1→401400`. That helper posts thread message `0x400`, wParam `0x69`, lParam zero to the application thread stored at app+30, using the verified `PostThreadMessageA` import at `5906b4`. Hook `497fb0` recognizes PM_REMOVE and those exact MSG fields, then calls `499710` at `497fe7`. The constant-zero selector follows `499921→467730`; after successful device release/recreation, the existing 16 surface slots are restored and `4678ed/4678fa` write width/640 and height/480 into descriptor +5c/+60. Thus the normal request occurs after the zero-valued UI descriptor has been created.

The current USER hook implementation explicitly accepts classes 2 and 5 only; `install_supported_hook` rejects class 3. Get/PeekMessage have keyboard-hook delivery but no WH_GETMESSAGE delivery. The same hook fragment is byte-identical in the immutable Moorhuhn2 source bundle bound to historical module `f40d4ca3…`, used by these Hype diagnostics. This is a concrete missing API contract, not proof that a captured Hype post succeeded or a hook-install return was dynamically observed. No gameplay fix is claimed.

The source writer audit also covered descriptor aliases: allocation and descriptor replacement copy all 100 bytes, getters/acquisition copy heap→caller, and destruction poisons 104 bytes before freeing. Initial WM_CREATE path `499450→49950d→466810` selects flag-zero device creation and does not initialize surface scales; `467990` only registers associated pointer +50. Explicit offset-store scans are not a proof excluding arbitrary computed-pointer writers.

Next work is generic owning-thread WH_GETMESSAGE support with real guest-call before/after regression: preserve the original MSG pointer and edits, PM_REMOVE versus PM_NOREMOVE, ignored hook return, CallNext/unhook/lifetime semantics, and existing keyboard/CBT behavior. No forced game notification, scale assignment, or swap suppression is justified. Source receipts and reproducible inventory are retained under `scratch/hype-route-prep-20261005/`; no runtime was used for this finding.


## 2026-10-05 — WH_GETMESSAGE candidate reaches ordinary controlled gameplay

The isolated generic hook repair (implementation commit 6604fb90, main base 5d7b94b7) passed the full build gates, including allocation/shake checks, all 16 real-WASM hook regression groups, and existing keyboard/CBT tests. Its private module SHA256 is 2638e876e6002d0e34cf7acba3d85ddbabb02069f559695f28fe6bad4620eb95. The generated region mirror belongs to this module; the historical f40 traces remain unchanged.

Ordinary attempt21 selected New Game with Enter, displayed the actual loading and control-instructions screens, then continued with the requested Space key. In the resulting nighttime street, 600ms Up moved the knight toward the barrels and 600ms Down reversed that movement. Root personally reviewed world-before.png, after-up.png, after-down.png and settled.png: the final scene retained the world without the earlier stale menu. This is narrow player-controlled gameplay acceptance, not level completion, audio quality, FPS or release readiness. No trace, forced hook call, scale write or other guest-state bypass was used.

Immutable evidence: scratch/runs/20261005-hype-wh-getmessage-gameplay/result.json; 273 hash-listed artifacts include input timestamps, four gameplay screenshots, root review, 229 served-resource receipts, exact source closure and private module. Browser/server closed normally at 2026-10-05T14:57:24.418Z, session84058 exit0 and no cleanup errors. Attempt20 is separately preserved: it stopped before input because its old exact-image reference rejected the now-rendered menu; this was a harness gate mismatch, not a guest failure.

The source-derived PostThreadMessage→WH_GETMESSAGE→mode initializer path now has a successful ordinary-route outcome with the generic contract implemented. The run did not separately instrument every initializer instruction, so the precise internal scale-write sequence remains source attribution rather than a new dynamic trace. Global injected hooks and suspended-before-init remote registration are outside this implementation's supported scope.

## 2026-10-10: CLI gameplay and a qualified frame counter

The plain CLI now reaches gameplay under the software Glide backend (no
WebGL headless): a frozen `--control` session at the default 1,000-block
batches has the title menu by batch 2000; Enter starts a new game, the loading
screen ends on the instructions page (~6000), Space enters the 3D alley, and
holding Up walks the knight forward between the barrels, with no stale menu
layer. Evidence: `scratch/runs/20261010T0620Z-hype-glide-cli-frames`.

**Two swaps per game frame, measured.** Native hit counters over batches
6921-7421: frame-finish callback `0x43f610` 99, nested UI pass `0x422260` 98,
swap wrapper `0x467180` 196 — exactly the world + empty-UI pair the static
analysis above describes. Count frames at `0x43f610`; any `grBufferSwap` rate
(including the browser's Glide present rate) is twice the game's frame rate in
gameplay. Title and loading screens swap without the callback (605 swaps vs
2 x 279 frames over the whole run). `--present-distinct` sees nothing on this
path: the CLI software Glide backend does not reach the present hook.
