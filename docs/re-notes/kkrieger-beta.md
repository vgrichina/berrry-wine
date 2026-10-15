# .kkrieger Chapter I beta

Latest source-only input investigation: [bounded accepted-input/update probe](../kkrieger-input-progress-20261015.md).
The identified W route is queued window messages into the original movement
field; original update-counter observations are separate from Present events.
Prepared opt-in controller remains unexecuted; no emulator input fix or new
playability claim. Canonical delivery and the absolute 900-second bound remain.

Original .theprodukkt Windows game, Breakpoint 2004. User TG73/74 identified the title.

## Recoverable package

Source: https://files.scene.org/view/parties/2004/breakpoint04/96kgame/kkrieger-beta.zip

Download: https://files.scene.org/get:fi-https/parties/2004/breakpoint04/96kgame/kkrieger-beta.zip

Archive: 102042 bytes; SHA-1 f46b0fd0e777c33c79e16cb5453db8b0b4bfb91b; SHA-256 0de0b9abafd78cf7f57fb264c7136ace52b2653f5c675574d0f10eda0a654c9f.

Recover with `node tools/fetch-candidate-corpus.js --id=kkrieger-beta`. Extraction preserves all three archive members under game/. Preserve the original archive separately for redistribution; Git does not retain ignored binaries.

| Member | Bytes | SHA-256 |
|---|---:|---|
| pno0001.exe | 97280 | ac2192b740c57125067a29d2e0ea6d95b222543398188c5f67bbf01157622685 |
| readme.txt | 5504 | c3779b09917a72664c89c7805c45f4cf45ee89a881649a44acb3581bc8f0f269 |
| scene.org.txt | 2714 | 0fd9764f56d835e0f3dd6209737bce241881902e6aa3ead91f2d02ad9d34b1c0 |

The archive readme permits spreading the original unmodified archive without charging for the game and requires credit to .theprodukkt for public presentation/publication. This record is not permission to repackage stripped files. The scene.org archive includes its archive notice; it is preserved unchanged.

## Compatibility scope and evidence

2026-10-14: fresh pinned download and extraction succeeded on baseline 38ed9da0b plus recovery fix14cc377a7; generated browser companion manifest and executable presence verified. No guest execution or gameplay acceptance yet; no desktop promotion or deployment.

Readme requirements: DirectX9.0b, pixel shaders1.3,512MB RAM. Packed procedural-generation startup may be substantial; no timing measured. Controls: WASD movement,Space jump,left mouse fire,1–5 weapons.

Corpus CLI dry-run currently fails before selection on an unrelated existing Baldur's Gate interactive-demo source assertion (test expects bg-demo/BG Demo.iso, manifest uses Silver Edition ZIP). Neither entry changed here. Resolve separately before using that broad harness.

## Separate-box startup check (2026-10-14)

Clean main `9ab60e86c2108a841b437e3aa3bd1b2b4ae031d3` built successfully on temporary Boat `bx_tgbme2h7` through the documented exec API. Module SHA256: `e6ac188dd8c7b16d04eaa4b74446ab2c4ab211422738709e33cffda5db444e7e`. Fresh original package acquisition passed. SSH was not used.

The direct CLI smoke lacked a GPU window and repeatedly reported `D3D9 requires a GPU window`; it was stopped rather than treated as a game failure. A separate headless Chrome run used the normal browser backend and a temporary in-page app entry pointing at the original executable and its companion files. No guest patch or capability override was applied. The page reported non-isolated threading; SwiftShader was allowed by Chrome's launch flags.

The browser created the `kk` window, then the guest exited before a visible menu. At the 30-second capture the desktop was blank and the runtime log showed a guest exit at `0x00801924`, preceded by `0x0080191f`. Exit reason remains undiagnosed; a zero harness exit is not game success. No player input, gameplay, audio or FPS acceptance.

Evidence: `scratch/runs/20261014-kkrieger-browser/` contains the probe, build/browser logs, three screenshots, state captures and dashboard result. Existing corpus browser/CLI configuration already supplies a launch route; no duplicate registry entry or desktop promotion was added. Next: a bounded original-browser startup run with named Direct3D9/API failure tracing to identify the early-exit condition.

The subsequent named-API run (`scratch/runs/20261014-kkrieger-browser-api/`, 21:27 UTC) reached Direct3DCreate9, GetDeviceCaps, CreateDevice, and repeated vertex/pixel shader creation before the same exit. These are call-entry traces, not returned HRESULTs; they do not establish shader support or the exit cause. The first trace attempt used an empty Set with an overridden `has`, which the host's `size` guard correctly disabled; the recorded follow-up uses a nonempty Set. Next capture API return/failure results using supported tracing before proposing an emulator change.

## Returned texture failure (2026-10-14, 21:50 UTC)

On source `43f04c7c4ac8914c385c37a7be96c7e1b9f61623` with the same canonical
module hash above, the supported EIP-return hook records `S_OK` from caps,
device creation, and the sampled first twelve vertex/pixel shader creations.
This narrows the failure; it does not qualify all shader execution.

The last-API ring then records three `CreateTexture` calls for 512×512,
Levels=0, Usage=0, Format=63, Pool=1, output `0x7ed20460`. A separate 90-second
return trace confirms `EAX=0x8876086c` (`D3DERR_INVALIDCALL`) at all three
return sites `0x80454d`, `0x804573`, and `0x804595`, before the same stop at
`0x801924`. Earlier calls at these sites returned zero; the failure is not
universal texture creation. The original 30-second trace ended during asset
generation, before the failing calls, and is retained as a timeout rather
than success. No guest memory or capability override was used.

The resource gate in `src/09ae-d3d9-resources.wat` rejects format63. The host
snapshot gate, GPU upload paths, and software snapshot gate likewise lack it.
Next implement the actual format storage and sampling contract, with creation,
lock/pitch, signed-channel, GPU and software conformance tests, then repeat the
original-game run. Simply admitting the enum would expose unsupported sampling.
The return trace establishes a concrete API failure before the stop; it does
not yet prove that fixing it alone reaches gameplay or why the runtime labels
the later stop as a normal exit.

Evidence folders under `scratch/runs/`: `20261014-kkrieger-browser-returns`,
`20261014-kkrieger-browser-exit`, `20261014-kkrieger-browser-texture-returns`,
and `20261014-kkrieger-browser-texture-returns-long`. The last includes the
reviewed blank end screenshot, complete log, probe and exact process receipt.

## Signed texture implementation and original-browser retest (2026-10-14)

Implementation `c79b943bbd8e02e5ee62c9bf00f48bb8c5897952`, based on main
`c851fff9c16096e6be6f480ebd40d8eb168c2e64`, supports format63 in texture
creation/capability checks, four-byte storage and mip locks, raw surface copies,
host snapshots, float GPU uploads (plain and mip atlas), and scalar/SIMD software
sampling. Little-endian U,V,W,Q map to RGBA with `max(signedByte/127,-1)` before
filtering. GPU cache identities distinguish format62 and63. WebGL1 synthetic
mip tails also decode signed bytes before averaging. This follows the signed
layout in [Microsoft's D3DFORMAT documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dformat);
exact legacy-driver conversion rounding remains a native-reference gate.

Full build and conformance passed on isolated Boat `bx_tgbme2h7`: texture
creation/512-square ten-level locks, surface/cube updates, 331-case shader VM,
software backend and keyed residency, WebGL1/2 uploads and cache identity,
signed mip filtering, and the complete WAT→host→GPU pipeline. After reconciling
current main, the full build, WebGL versions test (including partial signed
mip tails), and complete pipeline passed again. Final tested module SHA256:
`2158338e146bb30e5f3fc628b64462935cfdc066ee149dfba7fce29bfefbe29f`.

The same original-executable 90-second browser probe now records twelve
`S_OK` returns each at `0x80454d` and `0x804595`; the error retry site
`0x804573` is not visited. The former early exit at `0x801924` is absent.
At 90 seconds the guest is still running procedural generation, displaying
a black loading screen with a partially filled progress bar. No menu, player
input, audio or gameplay acceptance. The next investigation is a longer
bounded startup capture, with loading progress and any subsequent failure
recorded explicitly.

Evidence: `scratch/runs/20261014-kkrieger-q8w8v8u8/` contains reviewed captures,
logs, the probe, full source patch against the remote checkout's base
`43f04c7c4ac8914c385c37a7be96c7e1b9f61623`, implementation patch and process
receipt. Chrome151.0.7922.108, Node24.18.1, WebGL with SwiftShader permitted,
cooperative/non-isolated browser route, original EXE hash unchanged. A first
fixture-only attempt hit the static server's external-symlink HTTP403 rule;
copying the three original fixture files into the isolated checkout resolved
that harness setup failure before the recorded runtime retest.

### Three-minute untraced follow-up

The same tested module and source were run for180 seconds without API/EIP
return tracing, retaining ordinary runtime diagnostics. The bar progresses
from a small filled section at60 seconds to visually full at180 seconds.
The process remains running without the former early exit, but there is still
no menu or gameplay. Final seven sampled lines repeat EIP `0x0081053e`,
ECX `0x6d84fb2c`, ESI `0x1b05`, yield0. This is an investigation lead, not
proof of a permanent hang or its cause. Next inspect that loop and its
termination condition before extending the same run again. No input was sent.

Root-reviewed evidence: `scratch/runs/20261014-kkrieger-q8-long/`, with three
screenshots, state samples, log, probe, source patch and process receipt
(2026-10-14T22:06:42.445Z–22:09:44.501Z). Harness exit0 only confirms orderly
capture shutdown; the startup route remains unqualified.

### Loading loop: non-closing mesh edge cycle (2026-10-14)

Read-only live memory inspection of the same original browser/module establishes
the immediate nontermination condition. Unpacked runtime code at `0x81050f`
iterates selected faces, starting with the edge index at face-record offset8.
Its inner loop at `0x810538–0x81054c` marks a vertex through helper `0x80e966`,
then calls `0x80e9c3` for the next edge, and repeats until ESI equals EDI (the
starting edge). The helper reads:

```
edgeBase = u32(mesh + 0x1c)
next(e) = u32(edgeBase + (e >> 1) * 48 + (e & 1) * 4 + 4)
```

Captured mesh ECX=`0x6d84fb2c` has4052 edge records at `0x6a3c3154` and2026
face records at `0x6a3b735c`. Face1722 (EBX=`0xa170`, 24-byte records) starts
at edge6904 (`0x1af8`). Its actual stored chain is:

```
6904 -> 8068 -> 6888 -> 6917 -> 6921 -> 6912 -> 6888 -> ...
```

The four-edge cycle excludes6904, so this traversal cannot terminate with the
captured topology. All those indices are in the allocated edge range. A bounded
30-hit supported EIP trace at the loop's call/return blocks confirms the live
interpreter returns precisely these next indices and repeats the cycle. The
prior repeated ESI=`0x1b05` is one of its members (6917), rather than a timer
or progress counter. Caller return address is `0x81077d`, immediately after
`0x810778: call 0x81050f` in the function starting `0x810764`.

This establishes malformed/non-closing topology at consumption, **not the
upstream cause**: no faulty emulator opcode, API, float calculation or original
game algorithm has yet been identified. No guest writes, forced loop exits,
capability overrides, runtime fixes or performance changes were made.

Next actionable test: trace mesh construction/mutation before entry to
`0x810764` and locate the first write that makes a selected face's edge chain
non-closing. Resolve the mesh/edge allocation dynamically in each run; the
addresses above are observations, not stable addresses to hardcode. In this
capture the suspect chain fields are preserved in `chain-analysis.json`.
Use the existing EIP hook and size-aware `set_watchpoint` diagnostics for a
bounded writer capture, then test the implicated instruction/API against its
real contract. Extending the startup timeout alone cannot repair this cycle.

Evidence: `scratch/runs/20261014-kkrieger-loop-condition/` contains the unpacked
128KB runtime image at guest `0x800000`, loop/helper disassembly, complete edge
and face arrays, registers/stack, chain analysis, 30-hit execution trace,
loading screenshot, browser logs and all capture scripts. The capture controller
was host-paused from22:15:30 to22:17:26 while Chrome/guest execution continued,
allowing a second read-only CDP client to capture the loop as reached; guest
execution was not paused or changed. The initial controller attempt was stopped
before its first sample to correct an export name in the capture script.
The successful original run ran22:14:05–22:18:26 UTC; first loop snapshot22:17:02.
The reviewed screenshot shows a loading bar filled approximately halfway;
no menu/gameplay/input/audio acceptance. The earlier description of a visually
full bar should not be used as a measure of completed procedural generation.

### First invalid mesh-operation boundary (2026-10-14)

A fresh bounded trace checks live selected-face topology before the
copy-on-write helper `0x81108f` and after its enclosing operator returns.
The selection predicate is face-record offset4 != 0, matching the consumer's
selection setup. Across982 observed operator pairs, the first981 pairs close;
pair982 receives a valid608-edge/304-face mesh and returns a malformed mesh.
The operator starts at `0x812f29`, calls the helper at `0x812f39`, then queues
a vertex transform through `0x81192e`. Its enclosing return is `0x8178f3`.

In that capture, input mesh `0x71e3dd34` has its edge array at `0x6a15b4a4`;
the output mesh and edge allocation differ (the exact decimal observations
are retained in `boundary-analysis.json`). Output face0 starts at16 and walks
`16 -> 1180 -> 0 -> 29 -> 33 -> 24 -> 0`. Adding the later merge's6888-edge
index offset reproduces the previous failing chain exactly:
`6904 -> 8068 -> 6888 -> 6917 -> 6921 -> 6912 -> 6888`.
The failure therefore precedes the final merge and selected-face traversal.

Evidence is in `scratch/runs/20261014-kkrieger-mesh-writer/`.
`analyze-boundary.py` reconstructs the complete1964-row history from overlapping
bounded captures and checks this correspondence. The initial180-second
consumer-entry probe saw108 closing meshes before its bound. The operator
probe found the invalid result within270 seconds; instrumentation changes
runtime, so those durations are not startup performance measurements.
The screenshot still shows a roughly half-filled loading bar, with no menu
or gameplay acceptance. No guest data, loop exits, or runtime behavior were
patched.

The narrower clone capture proves that `0x806b2d` through the edge-array
copy return `0x81159b` copies all7296 words correctly; the source is unchanged.
Destination pages are not contiguous in WASM, but the copy handles that.
A bounded subsequent block trace watches edge590.next. It first changes
1182→0 across `0x80100e`→`0x801015`, the allocation wrapper's second indirect
call, while `0x80fe61` requests81920 bytes for vertex storage. At helper return
`0x812f3e`, the first differing topology word is2029 (edge169.next). This
excludes the edge copy as the immediate writer and narrows the contract to
the subsequent heap allocation. The precise allocator path remains under
test at this stage; the follow-up below supplies the regression and fix.

The first copy probe incorrectly expected a block boundary inside the copy
function; its `copy-incomplete/` captures are retained as failed instrumentation,
not evidence of a faulty copy. The corrected `copy/` capture uses the actual
caller return. Capture scripts, guest word arrays, page translations and the
24-block writer context are retained alongside the boundary analysis.

### Recycled sparse heap clear: causal fix (2026-10-14)

The final named-API capture confirms
`HeapAlloc(0x00beef00, 1, 81920)` at return `0x801015`. Across that call the
mesh header and every captured edge-page translation remain unchanged, but
edge590.next changes1182→0. The edge copy still compares byte-for-byte equal
before this call. This is an overwrite, not a changed guest mapping.

`heap_alloc` cleared recycled blocks with
`zero_memory(g2w(block)+4, need-4)`. A sparse heap block can have non-adjacent
WASM backing; clearing a linear physical span then reaches another live
allocation. The fix uses `guest_memset(block+4, 0, need-4)`, which follows the
guest mappings. It retains the existing recycled-block clearing policy.

The regression added to `test-heap-free-block-validation.js` interleaves an
unrelated guard page between the physical pages of a valid free block, then
recycles81920 bytes through the real allocator. Before the fix, the guard's
`0x11223344` becomes zero. After the fix, the complete payload is zeroed,
the header and guard remain intact, and the allocation is reused. The full
build, existing header-validation cases, 20000-operation heap-bin stress,
11 arena-tail cases, and large-block reuse tests pass. Tested fixed module:
`d823bf96e9ad51b0ef029fdaf12596350d040889cb187e85d8cf607d8eb74279`.
Original-demo untraced browser acceptance is recorded separately below.

The original EXE's180-second untraced retest on this module ran
22:57:32.744–23:00:34.033 UTC. It does not remain in the former mesh loop;
the log instead reports refused sparse commits of2162688/1441792 bytes and
failed heap requests of2097160/1398488 bytes, then exits at `0x801924`, with
caller `0x8045a5`. The60/120-second samples show loading; the180-second
screenshot shows the desktop after guest exit. This fixes the demonstrated
cross-allocation overwrite but does **not** qualify startup, menu or gameplay.

Reviewed after-evidence: `scratch/runs/20261014-kkrieger-heap-fix/`, including
the original untraced probe, screenshots, state/logs, exact module hash and
source patch. Next capture live heap-arena/backing occupancy, released arenas
and available extents around the refused commits. These messages alone do
not distinguish actual capacity exhaustion from fragmentation or retained
allocations; neither a larger budget nor a forced successful allocation is
established as a remedy.

### Memory census preparation (2026-10-14; no new guest run)

Source and log review corrects the queued handoff's reason numbers: the
2097160/1398488-byte payload failures in `20261014-kkrieger-heap-fix/browser.log`
are **reason 1**, "bump arena full, low reserve and sparse arena both refused".
They are not reason 4, which specifically denotes the separate 1024-slot
`HEAP_ARENAS` table. The preceding reason 3 follows a successful reservation,
failed sparse commit, and attempted free-arena reclamation; it is printed
after releasing the unsuccessful reservation. No backing measurements have
yet been made at this boundary.

`tools/page-probes/arm-backing-census.js` prepares that measurement without
changing allocator state. Use its source as `profile-web-frames.js --before-load`
and relay `backing-census`; retrieve `JSON.stringify(window.__backingCensus)`
with `--report-eval`. It can be concatenated with the existing
`arm-memory-series.js` source before launch (both console wrappers chain).
The bounds are eight 20-second periodic snapshots and the first four OOM
messages. Preserve console output even if the guest exits before report-eval.
Confirm the expected app is the first/only running app before using its data.

The probe reads the loaded page's `RegionMap` and reports its layout hash;
record the actually loaded WASM hash and retain its generated region mirror
alongside the capture. It copies map state, map records, reservations, released
hole metadata and heap-arena headers, including allocated end and charged live
bytes. It derives physical free extents from the union of live map backings,
rather than adding advertised holes to wilderness (which could double-count).
Map count is bounded by its region capacity, as are all other copied tables.
Synthetic checks cover known gaps, an extension window, overlapping backings,
corrupt counts and unchanged source bytes. Evidence and the standalone check
are in `scratch/runs/20261014-kkrieger-memory-census-preparation/`.

Interpretation constraints for the runtime owner:

- Neither `heap_free_census` nor `get_free_list` is observational: both flush
  instance bins. This probe calls neither, and makes no allocator/lock calls.
- `virtual_backing_available` reports cursor tails, excluding released holes;
  a low value alone does not establish capacity exhaustion.
- Commits already recursively split down to 64KB. A largest gap smaller than
  the request does not establish failure; total free space, gap distribution
  and remaining map slots matter together. The reported 64KB granule count
  is only an upper bound, not a simulation of recursive placement.
- Double-copy equality detects some concurrent changes but is not an atomic
  snapshot. Worker activity and asynchronous console forwarding must be
  recorded. The OOM snapshot is after failed split rollback, so low final map
  occupancy alone cannot exclude transient slot exhaustion during a split.
- Arena charged bytes include allocation headers and are not guest payload
  size. An arena with zero charged bytes is not automatically reclaimable:
  reclamation also requires a retired sparse arena, excluding the caller's
  current sparse arena. Preserve raw rows for that distinction.

Sam profiling owns the sole testbox during this preparation. No build,
browser run, increased memory budget, or gameplay acceptance is claimed.

### First-failure backing census (2026-10-14)

The original demo was subsequently run on the same fixed module
`d823bf96e9ad51b0ef029fdaf12596350d040889cb187e85d8cf607d8eb74279`,
with the read-only backing probe and memory series. Chrome151.0.7922.108,
cooperative route, 512MiB WASM, loaded layout hash `185e9318241d3aef`.
Run:23:39:43.557–23:42:59.730 UTC on `bx_tgbme2h7`. No new build or allocator
change. The first reason3 failure is at181474.9ms after page start:

| Measurement at first failure | Bytes/count |
| --- | ---: |
| Refused sparse commit | 2,162,688 |
| Primary backing capacity; no extension | 301,989,888 |
| Live mapped backing | 301,551,616 |
| Total free backing | 438,272 |
| Largest of14 free gaps | 61,440 |
| Live maps / map capacity | 207 / 8192 |
| Reservations / capacity | 188 / 8192 |
| Arena high-water slots / capacity | 241 / 1024 |

There are no overlapping backing records, no invalid metadata rows, and all
12 snapshot pairs compare equal. All14 gaps are smaller than64KB, but even
perfect compaction could not provide the refused request: total free backing
is already smaller. This establishes actual backing-capacity shortage at this
boundary, rather than merely a largest-gap or table-capacity failure. The
reservation had succeeded before the failed commit; the shared reserve cursor
was1760886784. The snapshot follows rollback of unsuccessful split commits.

This is **not** evidence that every mapped byte is live payload, or that there
is no leak. Of236 active arena records (five slots recycled),187 sparse arenas
account for all301551616 mapped bytes. They report236509192 charged live bytes,
301338672 allocated bytes, and212944 bytes of unallocated current-arena tail.
Thus65042424 reserved bytes are not charged live, including64829480 bytes inside
allocated extents. No sparse arena has zero charged live bytes, so none is
wholly free for normal arena reclamation. The probe deliberately did not flush
or inspect free lists/bins; it does not determine reusable block distribution
or allocation lifetimes. Charged bytes also include allocation headers.

The run logs12 OOM messages and exits at `0x801924`. Reviewed120-second image
shows a partial loading bar; the final image is the desktop after guest exit.
No menu, gameplay, input or audio qualification. The initial180-second capture
bound was extended by pausing only its Node controller23:42:43–23:42:59 while
Chrome continued; a second read-only CDP collector observed the failure and
resumed it. Both controllers exited0 and the browser closed. These times are
instrumented evidence, not a startup performance benchmark.

Self-contained reviewed evidence: `scratch/runs/20261014-kkrieger-memory-census/`,
with raw snapshots/log, exact loaded region mirror, source patch, screenshots,
controller/probe sources and reproducible `node analyze.js` assertions.
The next candidate can test the existing measured-memory `bigMemory` opt-in
and extension backing against original startup, while retaining the live-charge
versus retained-space question. Do not weaken allocation checks or claim the
larger budget fixes gameplay before that acceptance run. Runtime was released
to the user-priority Pirates validation lane; no memory opt-in is changed here.

## Signed vertex support passes; null audio interface lead (2026-10-15)

See `docs/kkrieger-launch-candidate-20261014.txt` for the memory increase,
exact rejected SHORT4 declaration, CPU expansion correction and passing
WebGL1/2 signed-short pixel controls. Source498aead6 with canonical70c6d329
reaches the end of loading on the original registered route, then stops near
310seconds with no declaration errors and no OOM. Evidence:
`scratch/runs/20261015-kkrieger-short-original/`. No gameplay is qualified.

The host's "Program exited" line at host.js6745 means EIP0/yield0. It does
not mean ExitProcess ran. Prior original unpacked image at0x800000 gives:

- 0x801c31 loads EAX from0x83f890, ECX from[EAX], then calls[ECX+0x10]
  at0x801c41. EAX/ECX0 in the exit record are consistent with a null sound
  buffer/vtable. Caller0x8053fb invokes this helper, returning to0x805400.
- Audio initializer0x804821 creates a primary buffer, sets stereo44.1kHz
  PCM16, then creates a0x80000-byte secondary buffer at0x80490a, flags0x18000.
- 0x804925 calls the secondary buffer's QueryInterface with IID bytes at
  0x81f0dc =6825a449-7524-4d82-920f-50e36ab3ab1e, writing to0x83f890.
  This is IDirectSoundBuffer8. It releases the original interface, tests
  HRESULT at0x804932/0x804934 and returns false on failure.
- The initializer's caller0x805370 ignores that return and enters the main
  loop, where0x801c31 uses the buffer without a null check.
- Tested dsbuf_iid_kind_wa does not recognize IDirectSoundBuffer8;
  IDirectSoundBuffer_QueryInterface zeros the output and returns
  E_NOINTERFACE for unknown IIDs. This establishes a source-level mismatch,
  not an observed HRESULT from the fresh game run. Earlier initialization
  failure could also leave the same pointer null.

Microsoft documents obtaining Buffer8 by QI on a secondary buffer, and that
primary buffers must retain the earlier interface:
https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418055(v=vs.85)
The inherited GetCurrentPosition slot is0x10. Buffer8 adds methods beyond
the existing buffer vtable: merely accepting its IID without providing the
full interface would be incorrect. Next capture the actual QI result at
0x804927 and the pointer at0x83f890, with earlier CreateSoundBuffer results,
then validate genuine interface behavior. No guest patch or forced success.

### Buffer8 validation and menu boundary (2026-10-15)

Candidate42b0be0454393da9f75821e44c916b45d68f0414 passes canonical build and
six audio suites. Original registered600s run46631 on bx_erf37bxf ran
09:51:52–10:01:53UTC with fixed2GiB/OOM0 and reached the animated3D main menu.
Read-only EIP return captures prove secondary CreateSoundBuffer(0x80490d) and
Buffer8 QueryInterface(0x804927) both EAX0, with output0x83f890=0x086f2000 and
the distinct24-slot inherited vtable. Prior primary creation/format also
succeeded; baseRelease returned refcount1. This does not measure the prior
failed run's HRESULT, and audible output remains unverified.

Menu persists after ordinary click, W/A/Space and Enter followed by W/A.
Idle captures also move the background camera: no player-control/gameplay
qualification. Keyboard messages log hwnd0; mouse messages hwnd0x10001, a
lead only. Do not infer an input root cause without following delivery/state.
Both observers closed before the unchanged600s bound and runtime postflight
found no survivors. No patches to guest state or forced success.

Evidence `scratch/runs/20261015-kkrieger-buffer8-original` has81 original
artifacts/13,367,696bytes size+SHA verified, exact module/source/fixture pins,
40states, audio return records, idle/input captures and all process receipts.
`node analyze.js` reproduces structural assertions. Full chronology, initial
gate failures and recipes are in `docs/kkrieger-buffer8-candidate-20261015.md`.
Next lane investigates menu activation and actual level control; no new run
was started after releasing the runtime to CMR3 recovery.

## Menu input source review (2026-10-15; no new runtime)

The original Buffer8 run `20261015-kkrieger-buffer8-original` reaches an
animated menu, but its `final.png` still shows start new game / credits / exit.
`start-events.json` records Enter at10:01:30 and only about22 seconds remain
before the600-second controller stops. No routed MSG, wndproc arguments,
internal key queue, or menu-state snapshot was collected. Consequently there
is no demonstrated input failure cause yet; background movement alone does
not demonstrate player movement.

The `[input] hwnd=0x0` keyboard lines do **not** establish null-window delivery.
`host.js` logs the raw dequeued event before `check_input_hwnd` calls
`lib/host-window.js:inputEventHwnd`. That function routes an unstamped keyboard
event to guest focus; a zero result is resolved to `main_hwnd` by PeekMessage
in `src/09a5-handlers-window.wat`. Mouse events have explicit hwnd stamps.
The logs establish that browser events reached host dequeue, not that the
guest handled them. Likewise, the recorded click at(390,470) is below the
start text centered near(390,390) in the reviewed final1100x800 image; it is
not evidence of clicking the start item. Re-measure against the live image.

Retained unpacked disassembly provides useful observational boundaries:

- `0x8052ad` registers wndproc `0x803af6`. It handles WM_KEYDOWN at
  `0x803bba`, WM_KEYUP at `0x803b87`, and left-button down/up at
  `0x803b63` / `0x803b3f`. WM_CHAR takes the default path.
- Key translation reads `u32(0x821138 + VK*4)`; value1 selects raw VK.
  Keyup ORs0x80000000. The object pointer comes from `u32(0x83f868)`;
  queue count is object+0x238 and entries begin at object+0x23c.
  Left-button down queues0x10028; up queues0x80010028.
- The main loop removes messages at `0x80539b`, translates at `0x8053ae`,
  and dispatches at `0x8053b8` (IAT addresses0x81f0a8/88/8c). Its return
  at `0x8053a1` is a useful place to read the six MSG dwords at EBP-0x20.
  At `0x8053d1` it consumes its internal input queue, passing each entry in
  EDX and event-kind3 in ECX to `0x81e8cb` at `0x8053d6`.
- In that retained code, event-kind3 reaches `0x81eafa`, then handler
  `0x81daae` through the object at `u32(0x14a0998)`. This is a trace lead,
  not proof that the fresh menu uses identical generated/runtime state.

Source evidence is
`20261014-kkrieger-mesh-writer/unpacked-disassembly.txt` (SHA256
`8b0026617d971d6c82606d4824cc512346515b84861f775f3b238829563dd0b6`)
and `20261014-kkrieger-loop-condition/unpacked-800000.bin` (SHA256
`42b8f545db0fce60f8f1b22035386c2a6b87653741bbb5ae4a9d24c2b6df76aa`).
Verify those instruction bytes in the next original run before relying on
the addresses. Resolve object pointers live and bounds-check all reads.

Next bounded ordinary-input experiment: retain the original600-second guard,
detect and capture the menu by about460 seconds, then send ArrowDown and
ArrowUp separately with screenshots and a short held Enter (e.g.250ms).
If no transition, one click at the live start-label center followed by a
bounded wait is sufficient; do not spend the remaining interval on movement
keys before a transition is visible. Record viewport, target rectangle,
DOM activeElement, guest focus/main HWND, and input timestamps. A bounded
read-only EIP probe should capture actual MSG after PeekMessage, wndproc
arguments at0x803af6, translated queue values, and callback entry0x81e8cb
only for ECX3. Cap samples (e.g.64) and enable tracing only around input,
not during procedural generation. Preserve raw bytes and screenshot deltas.
This distinguishes host routing, guest translation, and downstream menu
handling without changing guest state, forcing focus, or synthesizing a
successful start. No emulator input change is justified by the current evidence.

Prepared observer: `tools/kkrieger-menu-input-observer.js` attaches to the
existing registered controller endpoint, preserves its viewport, captures a
three-second independent idle control, and caps read-only trace records at64.
Its45-second watchdog never extends or pauses the owner. Set `WA_MENU_RUN`
to the existing run, `WA_MENU_OUT` to a fresh directory, `WA_MENU_CONFIRMED=1`
only after viewing its live menu, and `WA_MENU_OWNER_DEADLINE` to the owner's
actual ISO cutoff (at least60seconds away). Default `WA_MENU_ACTION=keys`
sends ArrowDown/ArrowUp/250ms Enter. Inspect `after-keys.png` before separately
invoking `WA_MENU_ACTION=click`, with fresh output directory and verified
page-pixel `WA_MENU_START_X/Y`. Click mode sends only one250ms left click.
It preserves code bytes for review, checks entry prefixes, and records actual
MSG, wndproc arguments, key translation, queue and callback registers. Entry
prefixes alone are not a complete code-identity proof; review captured bytes.
Syntax and whitespace checks pass; observer runtime remains unexecuted.

### Original input diagnosis and first-person level (2026-10-15)

One original600-second run, controller60373, used the unchanged previously
tested `42b0be0454393da9f75821e44c916b45d68f0414` source, not current main.
All960 source hashes, tracked build dependencies, module SHA256
`2dc9775e260c872d098a7b9db43ba0d9797977d6c43f552ddcc0ec235f47ec87`,
and the three original fixture hashes matched before execution. Observer
`a0a7165ae4adbdee656a41946d6b845bb250548d` was staged separately; no guest
bytes/registers or emulator input behavior changed. Evidence is
`scratch/runs/20261015-kkrieger-menu-input/` (92 transferred artifacts,
15714270 bytes, every length/SHA verified, plus local recipes and receipts).

The title sequence is visible at315seconds and Start menu by375seconds.
Observers64255 and64460 each exit0. The250ms ArrowDown/ArrowUp/Enter sequence
does not leave the menu. Crucially, actual PeekMessage MSG and wndproc args
both contain HWND0x10001, matching focus/main HWND. The guest maps those
keys to0x10001/0x10000/0x0a and delivers down/up to callback0x81e8cb. Enter
down and up are consumed together from queue `[0x0a,0x8000000a]`. Six32-byte
code snapshots match the prior unpacked image exactly. This rules out the
suspected null-HWND routing explanation for these observed key events.

The guest callback at0x81daae stores each masked event at its object's
offset0x1553c, including the high-bit keyup. The later menu consumer at
0x81937b compares that single value against arrows, Space, and0x0a, then
conditionally writes a menu state byte and clears the value. Thus a short
down/up pair dispatched before the next menu evaluation can overwrite the
press. The broad diagnostic range may itself slow consumption; these are
instrumented observations, not baseline engine timing measurements. The
accurate page-pixel click(390,390) also leaves the menu; its button events
appear in the host log after the click observer's snapshot interval. This
does not establish that this menu supports mouse activation.

Within the same600-second run, observer65318 holds Enter from
10:22:40.524Z to10:22:45.636Z (about5.1seconds). Previous broad tracing is
off; a narrow read-only consumer trace covers0x81937b..0x819456. At page
performance525510.3ms it captures last-value0x0a at0x8193ec, takes0x819411,
and reaches0x81944a with the value cleared to0. After keyup it is0x8000000a.
The immediate screenshot still shows the menu, but the555-second frame and
final600-second frame show the first-person level with weapon, life100 and
ammo100. This establishes ordinary-input game start and level rendering.
It does **not** qualify movement, combat, audible sound or FPS.

The owner ends normally10:23:58.784Z. A late movement observer65955 starts
10:24:00 and fails attachment with ECONNREFUSED before sending input; that
failure is retained. No timeout extension or second run occurred. All three
input observers exit0; postflight10:24:45.998Z finds no runtime survivors,
unchanged960 source hashes, and matching module/fixture pins. Slot released.

Next bounded run can start its menu observation earlier (around375seconds),
use a five-second Enter hold, and allow the subsequent scene transition
before matched idle/movement captures. The reusable observer now accepts
`WA_MENU_ACTION=enter WA_MENU_HOLD_MS=5000` (250..5000 allowed); this small
configuration change has syntax/whitespace checks only, and was not rerun.
The successful held-input recipe is retained as `held-observer.js` in the
evidence folder. No emulator input fix is justified by these findings.

### Current-main attempt interrupted on user pause (2026-10-15)

One run on main7aa74110e source was stopped on the user's wrap-up/pause request
at10:47:47.205Z, before any menu/level confirmation or input. The final saved
scene at~396s shows3D/title intro, not first-person gameplay. This attempt does
not qualify the pinned canonical module: the isolated checkout's build symlink
was rejected by the static server (HTTP403), and browser.log records fallback
compilation of WAT sources. Actual loaded-module hash is unavailable. All6490
source hashes match the pinned commit and remain unchanged; module-file/three
fixture pins match, and postflight finds no survivors. No retry or input followed.
Full partial evidence and limitations are in
`docs/kkrieger-gameplay-capture-20261015.md` and
`scratch/runs/20261015-kkrieger-gameplay-paused/`. The earlier42b0be ordinary
held-Enter first-person evidence remains distinct; new movement, combat, audible
audio and logicalFPS qualification remains outstanding. Work is paused.
