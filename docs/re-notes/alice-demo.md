# American McGee's Alice demo


## CLI cooperative loader deadlock repaired (2026-11-03)

Run `scratch/runs/20261103-alice-gate-scheduling-repair/` repairs the measured
main-await/cooperative-owner cycle below. A contended CLI loader admission now
lets the existing cooperative DLL attach owner advance through the actual
ThreadManager scheduler. Main remains parked until ordinary atomic gate
admission succeeds. Gate release, real module references, generation pins,
attach/detach serialization and callback errors retain their existing owners.
No callback is skipped and no guest clock or frozen credit is manufactured.

The production CLI regression was measured **before** the repair. A real PE
EXE loads a real DLL and creates a cooperative thread; its THREAD_ATTACH
callback holds owner 2 across multiple quanta while main calls FreeLibrary.
The old CLI cannot finish the step and is killed by the 20-second failure
guard. Byte-identical EXE/DLL fixtures complete in 0.204 seconds after repair;
the guard never releases a gate. Real callback thread ID 2, same-owner nested
LoadLibrary/FreeLibrary, completed attach before detach, and thread ExitThread
77 are asserted. Separate ordinary scheduling and faulted-owner controls pass;
the latter retains the unfinished image's real quarantine pin. Rejection,
retired requester, uncontended and recursive admission controls also pass.

Validation passed on the worker's finite-TTL boat:

- `test/test-cli-cooperative-dll-gate.js`, default, `--ordinary`, `--fault-owner`;
- `test/test-cooperative-dll-owner.js` and `test/test-dll-callback-serialization.js`;
- `test/test-dll-lifecycle-races.js` and `test/test-dll-terminal-lifecycle.js`;
- `flock /tmp/wine-build.lock bash tools/build.sh`.

The three changed ownership-census producer hashes were resealed after an
explicit lifetime review; broader invocation ownership remains pending. The
full build generated the canonical 2,079,536-byte module, SHA256
`24880b0ebdf170b2443d977074bc80f12b3959647dee69114cb09965a70c4741`,
byte-identical to the ordered GL/Shadow/Jedi predecessor module. The actual
original run's compile and instantiate observations match those bytes.
`final-source-inputs.json.gz` records 4,167 source/test/support identities;
local and remote hashes match before and after runtime. All 15 pinned Alice
originals also match before and after use.

ONE original execution passed batch 1091, completed the attach continuation,
and reached the fully painted 640×480 main menu, reviewed at batch 1486.
All 22 observed loader promises resolved; later observations retain a free
gate and no attach continuation. Ordinary click at batch 1589 and Enter
character (`keypress:13`, WM_CHAR) at batch 1693 were queued after visual
review. Reviewed subsequent frames still show the main menu. A direct HTTP
`action:click` was rejected without injection before the supported `cmd`
form was used. No New Game transition or gameplay is established. The same
run ended at its supervisor bound, 1,734 batches / 130.437 seconds, with clean
exit 0; there was no second original launch or unchanged retry.

The remaining bounded action is to verify ordinary keydown/keyup menu
activation and capture the first resulting New Game state. The present
WM_CHAR/click observations do not establish a new engine fault. Independent
HTTP snapshots remained responsive; a long step request's HTTP client timeout
was not a loader deadlock. The reviewed menu and post-input PNGs, complete
logs, old/new fixtures, canonical module, build output, source seals and
independently verified 97-member retrieval are under the run's `retrieved/`.
Runtime helpers and port 8123 were absent before the explicitly delegated
shutdown of `bx_fq4urv68` (original expiry 04:05:21.682Z).

## Current-main unfinished-step diagnosis (2026-11-03)

Run `scratch/runs/20261103-alice-unfinished-step-diagnosis/` identifies the
first initialization blocker: **the CLI awaits a loader gate held by a
cooperative thread that this same await prevents it from scheduling**.
This is a measured host scheduling cycle; no engine repair was applied.
Historical movement and the November 1 observations below remain separate.

The sole guest execution used main `8020361e3b2c784f325f8e9bc456e401f7ac456e`
source, after the DeviceIoControl recovery's actual terminal and exact release.
The locked full build passed; the actual module is 2,077,794 bytes, SHA256
`2514961a7051ba000c6bd107447480ca38443046ed4d0c0bf9644345cccc4d15`.
All 15 retained originals match the recovery manifest before and after use.
The requested November 1 `RECOVERY.md` is absent at
`scratch/runs/20261101-alice-original-native-gameplay/RECOVERY.md`; its retained
final/log/verification evidence and the recovery manifest were available.

Static tracing found that stdin commands are serialized behind a pending step,
but independent requests to the existing HTTP control server remain usable.
A task-scoped preload observes exported loader promises, atomic gate words and
cooperative scheduling without guest execution, clock calls or gate writes.
Its control holds the real production gate: a pending step and serialized ping
remain blocked while independent HTTP snapshot/ping succeed, with whole-memory
SHA unchanged. Releasing the fixture's gate completes both queued operations.
Promise identity, rejection propagation and bounded recent-history controls
pass, as do `test-cooperative-dll-owner.js`,
`test-dll-callback-serialization.js` and
`flock /tmp/wine-build.lock bash tools/build.sh`. Diagnostic code and evidence
remain in the ignored run directory; production behavior is unchanged.

The first 600 neutral steps completed with a reviewed gray 640×480 image.
The next 600-step request stops at **batch 1091**, with 109 credits remaining.
Independent HTTP observations 73.858 seconds apart show the same two pending
awaits, gate owner/depth and four cooperative slices:

- Main owner 1 is at `test/run.js:10980` →
  `handleLoadLibraryYield` → `lib/process-boot.js:924` →
  `acquireDllCallbackGate`, waiting for gate owner 2, depth 1.
- Cooperative T1, handle `0xe1001`, has an unfinished DLL attach continuation
  holding owner 2. Its next `runSlice` lies after the main await in the CLI loop.
- Main return EIP is `0x0264aced`. Parsing the unchanged original `mss32.dll`
  import table and disassembly maps this to preferred address `0x21111ced`,
  immediately after `call *0x2113e08c` at `0x21111ce7`, the imported
  `KERNEL32!FreeLibrary`. This is an unload gate wait, not a guessed audio fault.

The unfinished-step PNG is also gray. No menu or gameplay was reachable, so
no ordinary guest input was sent. HTTP quit and SIGTERM cannot complete the
pending host await; bounded cleanup killed the owned process group (exit -9).
All runtime helpers are absent. Retrieved evidence was independently hashed;
4,290 transferred runtime source/test identities and the module still match.

One earlier CLI bootstrap failed before any Wasm compilation because the
transfer omitted the common `stdole2.tlb` asset. Its separate bootstrap records
are retained. The required 27 unchanged repository assets were then streamed,
SHA verified, and a synthetic CLI preflight passed before the sole original
guest execution. No game/config changes, unchanged guest retry or integrated
loader lifetime fixes were used. Local free space exceeded 2 GB before heavy
work; a later dip was recorded and subsequent work only retrieved evidence.

The next repair should let the CLI schedule the existing cooperative attach
continuation while the main loader request is gated, with a real held-gate
old-fail/new-pass control before another original attempt. The current result
establishes the first blocker, not current gameplay or an implemented repair.
The finite-TTL box `bx_4rk22xvp` is handed back running, helpers absent, with
original expiry `2026-11-03T02:23:19.621Z`; the coordinator owns shutdown.

## Current-main native attempt: startup stalls before menu (2026-11-01)

Run `scratch/runs/20261101-alice-original-native-gameplay/` stops at the first
bounded runtime blocker: **initialization stalls before New Game**. The sole
original launch used actual main `76c40478e9b9aed501aaeda34e20e7366d124aaf`,
after GL worker `01a19621-4660-7042-a3b4-a3aa542f7c6a` published fresh final
artifacts and explicitly released runtime/source/build at 08:09:50 UTC.
Historical movement below remains separate evidence.

The accepted locked build from `d86935e8274cd5d70a53bcc50c5d8bf5632d95c3`
was reused after all 4,392 pinned inputs and 141 prior actual reads matched.
The actual compiled module is 2,026,995 bytes, SHA256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`;
the region mirror also matches. All 4,444 current source/support pins and all
15 original files remain unchanged. The recovery's complete manifest still
hashes to `68668d496dbabdb3b3803b8de12dda356796ba0ce26051ffb0a03df3a2022509`.
The process-local entry uses `launch-plan.json` and existing local-manifest
helpers, preserving all 14 companion paths, including `demo/` and
`snddrivers/`. No shared registration, source, config or backend implementation
was changed. The CLI uses the established `--gl-renderer=software` provider,
cooperative threads, frozen control and 100,000-block batches.

The first neutral 600-step request completed. Its reviewed 640×480 PNG is
uniform gray: neither intro, menu nor gameplay. The frozen input snapshot at
600 reports zero scheduled/enqueued/dequeued/routed/dispatched events. The
next ordinary neutral 600-step request, sent at 08:10:37.802 UTC, never
acknowledged completion during **192.85 seconds**. Later stdin ping remained
queued behind that step, so a later capture/state was unavailable. Actual
final batch and guest EIP are unknown; do not call this a batch-1200 capture.

The retained log shows Miles DLL initialization and creation of cooperative
thread `0xe1001`, entry `0x0203a520`. During its following DLL notifications,
the last lines are `Calling DllMain at 0x20d1078` and successful EAX=1 return.
Two OS observations show the Node main thread waiting in `ep_poll`, with about
four seconds total CPU and no further guest output. These observations locate
the stall window; they do **not** establish the underlying loader, callback,
audio or scheduler defect. No integrated lifetime repair was repeated.

SIGTERM at 08:13:50.622 UTC was acknowledged as an orderly-shutdown request,
but initialization did not return. Bounded cleanup then killed the owned
process group; guest exit is **-9**, elapsed 218.82 seconds, rather than a
successful or guest-requested exit. The observer saved the actual module and
117 compilation-time read identities, all still matching. **Later runtime
reads were not flushed because SIGKILL cannot run its exit hook**; that is an
explicit evidence gap. Its separate real sync/async execution, whole-512 MB
read-only memory, clock-identity and emitted late-10,001 retention checks pass.

No Enter or W input was issued because the menu/gameplay prerequisite was
never visible. New Game → Easy, W consumption, held/released views and player
control remain unverified on this build. There was no second original launch.
The run retains command/control records, reviewed capture, identities,
stall observations, signals/exits and cleanup. Free disk started at
2,381,504,512 bytes and stayed above 2 GB. Own runtime/driver/control processes,
groups and watcher were removed; no temporary runtime or box was acquired
(box ID/state/expiry N/A). No browser, GPU, audio, FPS or full27 claim follows.

Next prerequisite is a separately scoped diagnosis of this native startup
stall with controls capable of observing an unfinished step. This task ends
at that blocker without another original run or loader/lifetime changes.

## Fresh browser attempt: assigned-host access failed (2026-10-31)

Run `scratch/runs/20261031T2245Z-alice-original-browser/` began on main
`3a3e28d622d397513699be75f9eeaf05a29fed6a`, a descendant of the recovered-media
commit `d41903f45db7f4cb31da9df910019fe30dd8f84a`. The sole assigned browser
host was `bx_knya4u7y`. **The first failure was host access, before transfer or
guest execution; this run establishes no Alice runtime defect or gameplay.**

`boat ssh bx_knya4u7y` returned exit 1, HTTP 403,
`api_key_action_forbidden`: `This API key cannot perform ssh.` Direct SSH to
the assigned private SSH endpoint using the installed `ascii_box_ed25519` key
and account `user` returned exit 255, `Permission denied (publickey)`.
`access-failures.json` retains both exact errors. No remote command executed;
no runtime bundle, originals or archive were transferred. No browser, guest,
input, runtime port or profile was created. Existing browser geometry, native-input,
static-server and HTTP/module guard harnesses were read, but never run on the
host. No coordinator browser/heavy game test was run.

The local 15 originals and 14-companion manifest were checked against the
recovery pins before and after closeout. Local source/support and compiler/tool
manifests were also hashed before and after: 529 source/support and 867
compiler/tool paths from the preceding Crimsonland manifest scope, all
unchanged. Existing local Wasm was
2,023,821 bytes, SHA256
`ed3f924ab4c2d8805d862ccb4ca0747f37632bfa1bf2bc4b21bececa820ec622`.
This assignment performed **no engine edit or build**. That local artifact's
identity does not prove it was built from current source. Served module,
served source/compiler and browser-loaded module identities are all **null**:
there was no runtime HTTP server or browser. There are no fresh screenshots, New Game,
Easy, W-held/released or changed-view observations.

All available access logs and the pre-stop runtime receipt were saved locally
before the explicitly delegated shutdown. Nothing existed remotely to retrieve.
Stop `stop_650bee9b3a37a520` completed without force; the box stopped at
**2026-10-31T22:45:19.061Z**, verified by `boat --json info bx_knya4u7y`.
The verified state is **`stopped`**, with no SSH endpoint or URL. Its original
expiry was `2026-10-31T23:13:53.166Z`; `archiveAfter` is null after stopping.
Shutdown preceded the 23:03 guest cutoff, 23:06 handback and 23:08 shutdown
deadline. No successor, resume, public hosting or deployment was attempted.

**Next prerequisite:** restore authorized SSH access for a separately assigned
browser host before another bounded ordinary New Game → Easy → native W
attempt. The recovered media remain ready; historical screenshots and already
integrated loader fixes are not prerequisites. This assignment ends at the
concrete access failure and returns the stopped box to the coordinator.

Cheap copied HTTP-guard checks passed all 14 cases and five ephemeral local
server cases, without a browser or guest. Doc diff checking and before/after
identity checks passed; free local disk remained above 2 GiB. The global run
evidence checker returned 1 for historical entries, with no mention of this
run. Alice has no candidate-manifest entry, so this evidence stays in these
notes rather than attaching a `result.json` to an unrelated candidate.

## Original media recovered; browser task ready (2026-10-31)

Media/preflight only, starting from main
`2a64e65cc17c137d2d816d33dd0a132d6d9ff2fa`; registry inspection also covers its
descendant `c24d17db6629c06d36dd1fd6dfbc6b92c869e6dd`. No browser, game,
build, remote box, installer execution, guest patch or configuration write was
performed. The loader/serialization/lifetime fixes are already integrated:
the [October 18 reconciliation](alice-return-fire-reconciliation-20261018.md)
supersedes the old implementation-status statements below.

Initial local `/home/user` filename inventory found no Alice package or
extracted media. The old preflight/candidate paths were absent. Before recovery,
the local registry had 46 `DESKTOP_APPS` and the actual public
[`lib/apps.js`](https://wine-assembly.berrry.app/lib/apps.js) response had 44;
neither `DESKTOP_APPS` nor `APPS` contained Alice/McGee. The public response,
headers and both inventories are retained in
`scratch/runs/20261031T2239Z-alice-original-recovery/`. No registration or
public deployment was added.

Recovered the direct Windows demo package from
[Internet Archive's Alice demo item](https://archive.org/details/AmericanMcgeesAliceDemo),
using its [direct storage URL](https://ia800804.us.archive.org/32/items/AmericanMcgeesAliceDemo/alice_demo.exe).
The ordinary `/download/` route returned HTTP 500; the direct storage request
returned HTTP 200 and all 82,499,584 bytes. The package exactly matches the
historical SHA256
`ce873bf2525041a624c1a5a27b513f135b51ffdbeae9f68a6ede3edd8c7078e6`.

**Actual file hashes define this target build.** Independently retrieved
[upstream item metadata](https://archive.org/metadata/AmericanMcgeesAliceDemo)
lists that filename/size, MD5 `29a995e2b543972a571e93eb88827e5b` and SHA1
`45c6e346a86f468db9f67d36aaa29e96e4b0d074`; both digests were independently
recomputed and match. This establishes the archived upstream object's identity,
not a publisher signature or an inferred executable version. Its original
readme identifies the November 27, 2000 demo. PE header metadata is retained
separately in the payload inventory; no version was invented from a timestamp.

All **15 original files, 85,622,092 bytes**, are now extracted unchanged under
`test/binaries/candidates/alice-demo/`. All outer ZIP CRCs pass, and every
extracted file equals its archived member byte for byte. Key target identities:

| Original file | Bytes | SHA256 |
|---|---:|---|
| `alice.exe` | 1,454,142 | `61857b521eb7260c28b3ae6960fa8ee18d4d3679b6190f5221131e382e0f3a72` |
| `demo/cgamex86.dll` | 409,665 | `2fc6c957d8f554ff296271c9c50ec6aa3b5f72531061bf8a23af8d219e6d8c24` |
| `demo/fgamex86.dll` | 1,970,241 | `42838c2a96520c4b8b42e710d7d5bcf3a7a7f2a71b141a9f75bff01ee28f3d4c` |
| `demo/pak0.pk3` | 80,849,066 | `14ce74568458078f51f5b4f42a65c5a5888c01c487bbf8c064f541039a306556` |

The complete 15-file size/SHA256/CRC32 inventory is the run's
`payload-manifest.json`, SHA256
`68668d496dbabdb3b3803b8de12dda356796ba0ce26051ffb0a03df3a2022509`.
The PK3's 2,459 files also pass every CRC, including six original BSP maps
(`d_intro`, `d_gvillage`, `d_garden`, `d_chess`, `d_fortress1`, `d_fortress2`).
Its original embedded configs remain inside the unmodified PK3; none was
fabricated, extracted as an override, or edited.

Host manifest `test/binaries/candidates/alice-demo/.wine-assembly-browser.json`
maps all **14 companions**, preserving `demo/` and `snddrivers/` under `c:\`.
It is host metadata, separate from the 15 original payload files. An exact copy
is the run's `browser-manifest.json`, SHA256
`f723279905dc6649a17933c7907eacbaf5f33eb3bff7e9f2ac4cb80a07878d0a`.
`launch-plan.json` supplies `alice.exe`, the manifest path, empty inline files
and `requiredFiles: true` for the later browser task. Static resolution through
the current shared manifest helpers passes: all 14 URLs exist with exact sizes,
all guest paths are unique, and no sizes are unknown. Default file policy yields
12 eager companions and two streamed data files; this is a static policy check,
not HTTP delivery or runtime qualification.

Recovery recipe: download the direct package above, verify its exact size and
SHA256 before extraction, then use Python `zipfile.ZipFile` to test CRCs and
extract all members into an empty candidate directory. No installer is needed.
Recreate the host manifest by mapping every original member except `alice.exe`
to `{url: memberName, vfsPath: 'c:\\' + memberName.replace('/', '\\'), size: bytes}`
under `{schemaVersion: 1, files: [...]}`. Keep its relative URLs beside the
extracted tree. The retained run contains the package, upstream metadata,
original readme, exact manifests, source/probe failures and `RECOVERY.txt`.
Run from the checkout root:

```sh
python3 scratch/runs/20261031T2239Z-alice-original-recovery/verify-media.py
```

This checks both upstream digests, historical SHA256, complete original closure,
byte equality, manifest mappings, every PK3 CRC and free disk above 2 GiB.
No known original media path is missing. Generated Wasm, host font/system
support and actual HTTP/module identities must be pinned by the fresh runtime
task; this preflight does not claim to qualify those dependencies.

**Next:** use this exact media in a fresh ordinary current-main browser task,
prepare its local app entry from `launch-plan.json`, select New Game → Easy,
hold and release W, and inspect the resulting movement captures. The readme
documents those menu choices and W as Move Forward. No saved config, console
command, synthetic guest file, memory patch or licence workaround is required
by this media preparation. Record actual served module/source/input identities
when that task runs.

Historical `20261009T2151Z-alice-lifetime-gameplay/{finding.json,candidate.patch,
step-6.png,step-8.png}` remain unavailable in the bounded local inventory;
old boat paths are unverified recovery leads. The native movement reported
below belongs to `a2dae641…` on `23614c85e` plus its candidate patch, not later
held builds or current main. Those capture gaps remain explicit and are **not
a prerequisite for collecting fresh browser evidence**. Browser gameplay,
audio, FPS and sustained play remain unverified. Boat ID/state/expiry: N/A;
no runtime was allocated or box lifecycle changed.

## Original-media preflight (2026-10-09)

Original: `test/binaries/win98-games-a-d/american McGees-alice_demo-OpenGL.exe`,
82,499,584 bytes, SHA256
`ce873bf2525041a624c1a5a27b513f135b51ffdbeae9f68a6ede3edd8c7078e6`.
7-Zip recognizes its WinZip self-extractor: 15 files, two directories,
85,622,092 uncompressed bytes. It contains `alice.exe`, `demo/cgamex86.dll`,
`demo/fgamex86.dll`, `demo/pak0.pk3`, and Miles sound drivers. The included
readme identifies the November 27, 2000 demo. No installer execution is needed
to obtain these original files.

No Alice/McGee registration, task, or gameplay run directory was found in the
current registry, TODOS, board, and retained run-name search. This is a queued
new-game candidate; no launch or gameplay is claimed. BW2 remains compatibility
coverage rather than being counted as another previously unqualified title.

Static import audit reports 212 imports in `alice.exe`, including five missing
API-table rows: `midiInStart`, `midiInOpen`, `midiInGetDevCapsA`,
`midiInGetNumDevs`, and `midiInClose`. Each gameplay DLL has 77 imports and no
missing/explicit fail-fast handler reported. Static imports do not establish
that these functions execute; do not add silent stubs based on this scan.
Dynamic OpenGL/Miles lookup and actual runtime behavior remain untested.

Preflight hashes, small extracted executables/readme, and import report:
`scratch/alice-preflight-20261009/`. Original archive transfer to temporary
`bx_75agndxm:/tmp/alice-original.exe` completed at 04:27:39Z with matching SHA256;
`transfer.json` is the completion receipt. The first extraction attempt could
not start because this no-env box has no `7z`; its failure log is preserved.
Using installed `unzip`, all 15 files were extracted to
`/home/user/alice-original-v2-20261009`, with exact expected total size and
successful archive CRC test. Preparation PID251100 finished at 04:28:27Z.
All 13 PE modules were audited; only the five MIDI imports above were reported.
Exact file hashes, CRC output and full audit are the local `remote-v2-*` receipts.

Original code registers `in_midi` with default string `0` at `0046acf0`.
Initialization at `0046b460` reads it, compares with zero, and returns via
`0046b51d` before `midiInGetNumDevs` when zero. This supports optional MIDI
startup as a static inference; no handler or config was changed, and runtime
reachability is still unverified. See `midi-static-route.json`.

Prepared `/tmp/alice-probe-launch.js` refuses to run while BW2 browser189048
or Disciples handoff controller234050 is alive. It has a 180-second outer guard,
mounts original `demo/**/*`, `snddrivers/**/*`, and `readme.txt`, and captures
the first visible window without inputs. It is uploaded and syntax checked,
not executed. No missing archive paths are known. Next: ordinary launch after
the serialized current work, then New Game/skill selection and W/S movement
as described by the original readme. Do not start a parallel guest or browser.

## 2026-10-09 original initialization: texture border API

Initial-console probe ended normally. Continuing original initialization (same bb9d6e96 module, cooperative CLI, all14 support mounts) creates American McGee's Alice window, then fails at batch123 in glTexParameterfv. Arguments are target0xDE1, pname0x1004 (texture border color), pointer074ff41c to four float1 values; return00484cf3. Source api_table row4442 still maps gl_unimplemented. This is the next concrete runtime blocker, not the five statically missing MIDI-input imports. Do not replace it with a success stub: support actual texture state and sampling/queries across the relevant backends, with a control-failing regression and original launch validation.

Self-contained control: scratch/runs/20261009T0509Z-alice-gl-texparameter-crash (7artifacts; last image precedes the crash). Probe270020 and guest270030 exited1 at05:09:03.423Z. The preceding API transport409 was a transient boat update; original run started only after authoritative boat state recovered.

## Border-sampling control (2026-10-09 07:35Z)

Synthetic regression on unchanged main runtime f1fb7fbe157c1ed6a85b926a31678fb7e0b11299fdfa9c363c2ce41a35a6b418:
run20261009T0735Z-alice-border-control. Remote controller62994 terminal1 at
07:35:15.041Z. Existing software-raster harness draws a two-texel RGB blue/yellow
image with constant coordinates to eliminate LOD/interpolation ambiguity.
CLAMP_TO_EDGE at s0/t0.5 and GL_CLAMP at interior s0.25/t0.5 both pass full-blue
controls. GL_CLAMP at s0/t0.5 fails: RGB0000ff instead of half-blue00007f/000080.
The following quarter-blue corner assertion is retained but was not reached.
This proves an actual sampling gap independently of the missing vector API.

Specification reference: [OpenGL 2.1 texture sampling](https://registry.khronos.org/OpenGL/specs/gl/glspec21.pdf).
GL_CLAMP clamps coordinates before filtering; it does not replace outside
filter taps with edge texels. Border values supply those taps. Thus a bilinear
sample on one edge includes half border; a corner includes three border taps.

Concrete source boundaries:
- lib/gl-compat.js texParameter maps CLAMP to CLAMP_TO_EDGE; fragment shader
  uses hardware texture2D for both units. Proper border behavior needs filter/LOD
  handling, not only a saved color or a uniform mixed at arbitrary distance.
- src/09a8g-gl-raster.wat has8-byte slots (surface/flags),4096 names; flags collapse
  CLAMP and CLAMP_TO_EDGE. gl_sw_r_address emits D3D address1/3 only.
- src/09ab-handlers-d3dim-core.wat d3dim_texture_sample_prepared supports
  wrap/mirror/clamp; its signature has no border color. Do not read outside the
  texture backing when adding missing filter taps, or use unsnapshotted shared state.
- GL Worker snapshots currently have resolved texture flags at1024/1028 and
  fixed1032-byte state /1040-byte descriptor. Any added border state must be
  preserved for queued draws and both texture units; metadata offsets are an ABI.
- GL CALL_INDEX and command ARG_WORDS additions must append; vector pointer
  payload must be copied at submission. API row4442 already exists, so replace
  its handler only when real behavior exists; do not renumber API IDs.

Next implementation: per-texture clamped RGBA state and real filter-tap border
handling, query/setter validation, immutable queued-state coverage, native/WebGL
pixel tests, then unmodified original Alice startup. Existing scratch control.js
is a full retained runnable regression; copy into remote test/ alongside render-helper.
Fresh worker spawn still fails thread limit; root direct, one runtime budget.

## Software sampler foundation (2026-10-09 07:41Z)

Added gl_sw_border_tap/gl_sw_border_sample with explicit immutable color and
independent GL wrap enums. Missing taps return the supplied color before any
backing read. GL_CLAMP clamps coordinates before filtering; CLAMP_TO_BORDER
permits all-border footprints; EDGE/REPEAT retain distinct behavior. No mutable
sampler globals or modifications to the existing D3D hot sampler.
Existing test-gl-software-raster exports this helper only through extraWat and
checks actual Wasm pixels, including an invalid backing pointer for an outside
nearest tap. Canonical build and gl-software-raster, d3dim-texture-wrap,
opengl-fixed-function suites pass on temporary box; controller65306 terminal0
at07:41:31.123Z. Module b2552fac1043910e48cd00a672581dd9235792ba199d7f7943a7f14ba587637d.
Evidence run20261009T0741Z-alice-border-sampler retains source/test/scripts/logs.
This is infrastructure only: production GL draw calls still use the old sampler,
so the earlier end-to-end CLAMP regression and Alice vector API remain unresolved.
Next wire per-texture RGBA/wrap state through resolved draw/Worker snapshots,
route both GL texture units through the helper, then complete WebGL and API replay.

## Production default-border routing (2026-10-09 07:55Z)

Both software texture units now retain GL_CLAMP separately from CLAMP_TO_EDGE
in texture flags (bits128/256), including existing immutable Worker snapshots.
The shared raster interface carries GL_CLAMP as an explicit tag; D3D address
modes retain the original sampler. The 16-bit wrap fast path excludes this tag.
Default border alpha is opaque for RGB internal formats and zero for RGBA.
Real draw tests pass half-border edge/quarter-border corner pixels; unit1 also
checks RGBA alpha and clearing border mode when switching to CLAMP_TO_EDGE.

Canonical build and GL software, D3DIM wrap, GL fixed-function, multitexture,
and GL Worker transport suites passed; controller69442 terminal0 at07:49:46Z.
Additional unit1 regression passed07:55:13Z. Run
`20261009T0749Z-alice-border-routing` retains logs/source/tests with hashes.
Module5b2cfa1d20224e856ecc28f1de76767ccfcaa1740f6d49e254dcf3d7e296349e.
Connection502 observation failures did not mean test failure or require a rerun.

Still incomplete: programmable per-texture border RGBA and queries/validation,
vector API payload/replay, WebGL sampling, and queued-border pixel isolation.
The existing Worker transport test is not a queued-border pixel test. Original
Alice still hits its unimplemented vector setter; no new game screenshot claimed.

## Per-texture color and queued replay (2026-10-09 08:00Z)

Internal software state now keeps clamped float RGBA per texture in a lazily
allocated 65536-byte table; deletion clears the color. Sampling quantizes only
when resolving the draw and applies RGB's opaque alpha. Both units capture
their packed colors at snapshot offsets1032/1036; snapshot length is now1040,
with the existing descriptor still at1040 within the1056-byte allocation.
This preserves floating-point values for future queries and avoids shared
mutable color reads during queued rendering. Allocation failure returns failure
to the caller; the future guest setter must turn that into GL_OUT_OF_MEMORY.

Canonical build/five suites pass, controller74266 terminal0 at08:00:02Z.
Extended multitexture regression passes08:00:34Z: float clamping, independent
objects, green border pixels, delete reset, and two queued quads retaining red
and blue borders after a later green setter. It copies real submitted records
then replays through gl_sw_worker_draw deliberately later, in one instance;
this proves snapshot isolation, not concurrent scheduling. Run
`20261009T0800Z-alice-border-state` contains tests/sources/logs and hashes.
Module47ab13a8479754405556464cd97d606e17a08b57f25b1b5d8ecb89415a3ba095.

Guest glTexParameterfv is still fail-fast. Next connect validated pointer-copy
submission, matching JS state/query handling and correct WebGL filtering, then
enable the API and rerun original Alice. Do not treat the helper as API support.

## Frontend state and validation (2026-10-09 08:08Z)

JS keeps per-object border floats and original wrap enums separately from the
hardware CLAMP_TO_EDGE alias. Internal query helpers return detached values;
delete/reuse resets state, units retain independent objects, and pending draws
flush before changes. Scalar setters reject invalid target/filter/wrap values;
the WAT mirror likewise preserves old sampling flags for invalid enum values.
Tests cover unchanged pixels after invalid MAG/MIN/wrap, object isolation,
clamping, detached queries and pending-draw ordering. Canonical build/five suites
pass, controller77481 terminal0 at08:07:44Z, run
`20261009T0808Z-alice-border-frontend`, module
970c8abc76a0c66167152f9ec432417d9f643208cc2f77c960852c00274aab04.

WebGL shader work remains. Backend defaults to WebGL1; do not silently implement
only WebGL2. Existing D3D9 mip-atlas lowering supports explicit border taps but
is not directly reusable without atlas uploads and GL-specific clamp semantics.
Another candidate is explicit-LOD center-tap sampling with EXT_shader_texture_lod
and derivatives (core equivalents in WebGL2), manually combining missing taps.
Check extension availability and real pixel behavior before selecting that route.
Do not approximate border weights using only base-level dimensions under mipmaps.

[OpenGL2.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec21.pdf),
sections3.8.8-3.8.10, defines per-level filtering and the min/mag switch: threshold
0.5 for LINEAR magnification with either NEAREST_MIPMAP filter, otherwise0.
Incomplete mipmapped textures disable texture application for the unit. Native
software mip policy is currently approximate; do not claim complete GL conformance.
Guest vector dispatch, pointer replay and real shader support are still pending.

## WebGL border pixels (2026-10-09 08:14Z)

The frontend now selects a border shader for GL_CLAMP draws. Explicit-LOD
texel-center taps reconstruct nearest/linear filtering at each selected mip,
returning the object's border for missing taps, then combine levels for trilinear
filtering. Both units carry independent size/filter/wrap/color uniforms. Ordinary
draws keep the original shader; returning to it replays its uniforms. The WAT
software frontend bypasses GPU shader selection entirely.

WebGL1 requires OES_standard_derivatives and EXT_shader_texture_lod; WebGL2 uses
their core equivalents through the existing shader conversion. Missing extensions
fail explicitly; headless desktop-GL extension compatibility is not verified.
Image metadata tracks mip completeness; incomplete mipmapped textures disable the
unit in the border path, and generated mip chains populate the same metadata.

`test/test-gl-border-web.js` passed16 real Chrome/SwiftShader pixel assertions,
eight each for WebGL1/2: edge, corner, nearest, switching to normal shader,
incomplete mip chain, mip1, trilinear and independent unit1 green border.
Controller81241 terminal0 at08:13:59Z. Final run
`20261009T0813Z-alice-webgl-border` retains source/test/identity/readPixels results;
gl-compat SHA a450290cf8b7eb85a01396948c279c239d3e16df17d2607600b812736efef9bf.
Its pixels.png is blank after backend destruction and is not visual evidence;
the assertions read actual GL pixels before teardown. No game screenshot claimed.
Prior14-case run0811 retained but its intermediate JS source was not retained.
Fixed-function JS regression, test-tier and browser cache checks also pass.

Still required: guest vector API/query dispatch, command payload copying and
original Alice validation. No performance qualification or universal GL format
conformance claim. Temporary runtime moved to bx_bufemdmn (expires09:14:52Z);
old bx_kbtxb6tb stopped after all browser/native probes were terminal.

Final tracked browser test reran on bx_bufemdmn after restoring npm dependencies
(fork omitted node_modules). Run `20261009T0818Z-alice-webgl-border` records
controller20725/Chrome20740 terminal0 at08:17:21Z and all16 cases passing with
the same verified gl-compat SHA. Copying the context canvas still produced a
blank screenshot: the backend renders to an offscreen framebuffer. Pixel checks
read that bound framebuffer correctly. The capture now reads the full framebuffer
before teardown instead of the default canvas; final capture verification follows.
Earlier new-box attempt failed before launch because Puppeteer was absent.

Final framebuffer-capture run `20261009T0819Z-alice-webgl-border` also passes16
cases with the identical renderer SHA. Controller21418/Chrome21433 terminal0
at08:18:28Z. Reviewed pixels.png now shows the two green-tinted synthetic test
canvases; no game screenshot/playability credit. The test is in the e2e tier.

## Vector API and copied replay (2026-10-09 08:27Z)

Appended GL command112 glTexParameterfv and113 glGetTexParameterfv; existing
API table IDs4442/4299 stay in place. Vector arguments are copied at submission
(16 bytes for border,4 for scalar properties), after target/pname validation.
The software observer gathers sparse guest pages separately and stores the color;
allocation failure is carried in the record as GL_OUT_OF_MEMORY so host state
does not falsely update. Float queries are barriers and do not write on invalid
enums. glGetError now consumes frontend errors before querying the backend.
Priority remains a per-object float residency hint; objects remain backed for
their lifetime. Integer-vector setter/query aliases remain fail-fast.

Build/seven suites passed, controller25378 terminal0 at08:26:46Z. Extra sparse
regression passed08:27:23Z: a16-byte vector straddles nonadjacent backing pages,
native state sees all four values, and replay retains them after guest mutation.
Run `20261009T0827Z-alice-border-api` retains source/generated files/test logs;
module b9c7ab4b7c5acfd2cb72f7ec953889fc32cf162aa02e3f5ca1545e515e2a16d9.

Original Alice rerun27159/27166 stopped before guest execution because the new
fork omitted `/home/user/bw2-normal-route-20261009/test/binaries/tlbs/stdole2.tlb`.
Restored the15088-byte support file, SHA
db456130e4b131aff27a6a3179464a28c9452f06eb6f2081d2aea38128d31895.
Fresh original-media run27878 is underway with300s guard and no input; do not
interpret the missing-file attempt as a guest regression or gameplay evidence.

## Next original-demo failure (2026-10-09 08:30Z)

Original Alice now passes glTexParameterfv (trace return00484cf3), creates its
640x480 game window, and reaches batch1094 before failing at
wglSwapIntervalEXT(0), return00487191. Run
`20261009T0830Z-alice-swap-interval-crash` retains17 artifacts with hashes;
27878/27885 terminal1 at08:30:28Z. Checkpoint9 is gray, not a menu or gameplay.
Missing-typelib attempt is retained separately in0828 run. No input was issued.

The WGL resolver currently looks up any api_table entry, including aliases to
gl_unimplemented, and advertises a thunk for wglSwapIntervalEXT despite having
no implementation. Its comment claims it exposes only implemented APIs, which
the code does not enforce. Next investigate correct generic procedure availability
(supported extensions must remain resolvable, unsupported/non-GL names must not
be advertised), or implement actual swap pacing. Do not add a successful no-op
setter or change guest configuration. Direct unsupported API calls must remain
fail-fast. Texture implementation3270207c7 is already pushed to main.

## WGL availability and next frame-end failure (2026-10-09 08:40Z)

The global API table contains unsupported aliases and unrelated Win32 names.
wglGetProcAddress previously returned thunks for all of them. The generated
availability predicate now derives from the actual GL/WGL dispatcher map,
excluding GLU. Unsupported direct calls still fail fast. Current-context
lifecycle behavior is unchanged by this scoped correction.

Unchanged native control returns118489088 for wglSwapIntervalEXT; candidate
returnsNULL, rejects non-GL/GLU/unknown/case-mismatched names, and preserves
correct thunk identities for ARB_multitexture and vector texture APIs. Canonical
build plus resolver, multitexture and generic encoder suites pass.
Run20261009T0839Z-alice-wgl-availability retains sources/logs; module
6f11700188244b00d25595743c7ceeaffcabe98769e166d3cd34eb3214c55246.

Original unchanged demo no longer traps at swap-control lookup. It reaches
frame end, then shuts down GL and displays GLimp_EndFrame() - SwapBuffers()
failed! in its console. Reviewed checkpoint19, run
20261009T0840Z-alice-swapbuffers-error;32814/32821 terminal08:39:46Z.
Next trace the real SwapBuffers/presentation return and context ownership.
No menu/gameplay/FPS/audio claim or guest configuration change.

Final predicate also preserves three native handlers outside the GPU opcode map:
wglGetCurrentContext, wglGetCurrentDC and wglSwapLayerBuffers. Extended native
tests and canonical build pass, run20261009T0842Z-alice-wgl-final,34093 terminal
08:41:52Z; final module65f1f98d4b3545f5141b0be2816e1c9353729dbfa477013fc4baafa3b95ae1a4.
Original final-module replay confirms same SwapBuffers error: actually the
wglSwapBuffers spelling, HDC00310011, return004871c1, API621598.
Run20261009T0842Z-alice-swapbuffers-final reviewed;34958/34965 terminal08:42:06Z.

## Correction: CLI graphics provider, not SwapBuffers defect (08:48Z)

The previous original-game controllers omitted both a headless WebGL provider
and --gl-renderer=software. They attempted wglCreateContext but never made a
context current. Existing --trace-gl plus --trace-host proves gpuPresent is
received without a context; the later host return1 is wglMakeCurrent(NULL,NULL)
cleanup, not successful presentation. Runs0844/0845/0846 retain diagnostic logs.
The --trace-at return breakpoint emitted no register evidence in stepped mode.
A direct native-handler control with host success returns1 correctly.

Correcting the test host to --gl-renderer=software, with the same original
media and module65f1f98d, makes a real current context and renders the animated
EA intro. Run20261009T0847Z-alice-software-startup checkpoint11 reviewed;
37914/37921 terminal08:47:43Z. The guest swap-control availability fix remains
real; the subsequent SwapBuffers failure must not be tracked as an emulator
defect. Menu/player-controlled gameplay is the next validation, not a stub.

Menu run20261009T0853Z-alice-menu completed normally at08:53:14Z,
38759/38777 terminal0. Forty-four original artifacts plus controller and hashes
retained; checkpoint14 reviewed/photo969. Ordinary-input follow-up uses a
bounded600s controller with recorded request/response files, same module/media
and software backend. No guest configuration or memory changes.

## New Game loading: allocation tail guard (08:58Z)

Ordinary Enter at the reviewed New Game menu opens difficulty. Enter selects
Easy; loading then returns to the console with Z_Free: memory block wrote past
end. Run20261009T0856Z-alice-new-game-heap-error retains22 original artifacts
plus controller/hashes; screenshots ready,step2,step5 reviewed. Controller
41655/41662 terminal08:56:37Z. No gameplay claim.

Original Z_Free is00444eb0. User pointer becomes ESI-16; header+12 and tail
[header+size-4] must equal000facc2. Failure message at00513314, tail compare
00444ee6, error push00444ef0, Com_Error call00444ef7. Header guard passes;
tail guard fails. This identifies the check, not the overwriter. No evidence
yet linking the separately known VirtualFree decommit bug. Native disassembly
retained with the diagnostic work. Next built-in --trace-at=00444ef0 with
--trace-at-mem=esi:64,esp:64 on a plain CLI run, repeating the ordinary inputs.

## Heap writer captured (09:04Z)

Plain CLI replay with ordinary inputs reproduces the guard at batch3079,
00444ef0. ESI(header)=084909e0, EAX(size)=00f3f2b8. Header dwords are
00f3f2b8,00f3f2b8,084909e0,000facc2; computed tail is zero.
Run20261009T0900Z-alice-heap-guard-trace,44769 terminal09:00:47Z.

Watch replay arms header084909e0 at batch1650. At1672 it becomes00000030.
At3022 CRT free-list insertion004ed3d6 writes00f3f2b8 via [EDX+4],
EDX=084909dc; predecessor004ed3cd, observed next EIP004ed3f3.
EBP074fc888, ESP074fc868; frame-pointer caller004e8359. More free-list
changes follow during cleanup. Original Z_Free guard message is reproduced
in this same watch run, although combined trace-at does not emit its register
dump. Run20261009T0904Z-alice-heap-header-watch retains log/disassembly;46707
terminal0 at09:04:42Z. This is CRT freeing/coalescing behavior, not a proven
VirtualFree decommit overwrite. Next recover the free argument/caller and
allocation lifetime to distinguish premature free from an overlapping block.

Original fgamex86.dll preferred10000000, loaded02940000; cgamex86.dll
preferred30000000, loaded03077000. The original files are in demo/ beside
pak0.pk3 in the retained installed tree on the temporary boat.

## Free-origin probe fidelity (21:02Z)

A replay with instruction-interior trace004ed3d6 reproduces the guard but emits no trace (run20261009T2055Z-alice-free-origin-no-hit). Known block start004ed3cd emits records, but that replay stops during a different startup route before its batch cap, with no target pointer (run20261009T2056Z-alice-free-origin-head). No config files were found in the original installed tree; do not infer a saved-setting cause.

Added optional --watch-stack to the primary watchpoint report. Syntax check and original run20261009T2101Z-alice-watch-stack verify32 stack dwords print. This filtered watch without the original trace breakpoint samples PC0044be18 after the target value changes, not the earlier CRT writer; that stack cannot prove the free caller. Next restore the exact original watch+trace flags with only --watch-stack added. PID40779 is bounded240s on bx_5jcbe4c6. No guest fix or gameplay claim.

## Actual free caller recovered (21:04Z)

Run20261009T2104Z-alice-free-caller restores original watch+trace flags, adding only stack output. It reproduces precise writer004ed3cd/004ed3f3, EDX084909dc, batch3022. Stack074fc89c=00444f1d and074fc8a0=084909e0 proves Z_Free called CRT free on that header. Next return00444f56 belongs to tag-list cleanup00444f30; caller00454464 supplies tag4. This is an intentional original-game free, not evidence that CRT corrupted a live block spontaneously. Controller40779 terminal0 at21:04:42Z.

Prior guard run0900 already supplies later return029b706b and argument084909f0. With fgame load02940000/preferred10000000, this is original1007706b: wrapper10077040 subtracts4 from its own pointer, updates allocation counters, then calls imported function101cd280. It reaches Z_Free on the already-freed user pointer. Static tag cleanup walks next pointers and removes nodes; investigate stale lifetime or an earlier initialization error that initiates cleanup before diagnosing allocator corruption.

Next probe captures Com_Error438ad0 entry and stack, to recover the first error rather than only the final guard message.20640 active on bx_42ztf6q5,240s bounded. Old boat stopped after terminal runtime; replacement fork omitted build outputs. Canonical rebuild19873 terminal0 at21:08:23Z reproduces exact527004d9 hash, run20261009T2108Z-alice-fork-build. No new gameplay claim.

## Central error trace: no earlier error observed

Fork preparation failures are separate harness evidence: run20261009T2109Z-alice-first-error-harness lacked test/binaries/tlbs/stdole2.tlb; run20261009T2110Z-alice-first-error-renderer-missing lacked pngjs and consequently GDI canvas/SwapBuffers. Both returned exit0 despite errors and are not passes. Restored exact15088-byte stdole2.tlb SHA256db456130e4b131aff27a6a3179464a28c9452f06eb6f2081d2aea38128d31895; npm ci --ignore-scripts --omit=optional restored pngjs/wabt/puppeteer (21737 terminal0 at21:10:51Z).

Corrected run20261009T2113Z-alice-first-error traces438ad0 from startup: one observed call, batch3079, return00444efc, code0, message00513314 (Z_Free tail guard). No preceding central error was captured.22153 terminal0 at21:13:09Z. Earlier-load-error explanation is unsupported by this trace; next identify normal function containing00454464 and why fgame retains a tag4 allocation after its cleanup. Do not skip the guard or alter guest configuration.

## Confirmed missing DLL unload/reload lifecycle

Run20261009T2117Z-alice-module-lifetime records FreeLibrary(cgame03077000) at0046bfe0, FreeLibrary(fgame02940000) at0046be10, then LoadLibraryA("demo/fgamex86.dll") at0046bf27 before the stale free. The second load has no new mapping or DllMain initialization.37356 terminal0 at21:17:41Z. Original00454410 calls game shutdown,0046be00 unloads, then00454464 clears tag4; DLL allocation wrapper10077000 delegates to the engine and its corresponding free wrapper is10077040.

Current FreeLibrary only remembers the last handle and returns success. find_loaded_dll still returns that PE; LoadLibraryA fast path returns its old mapped state. Windows instead decrements module references and detaches/unloads at zero: [Microsoft FreeLibrary contract](https://github.com/MicrosoftDocs/sdk-api/blob/docs/sdk-api-src/content/libloaderapi/nf-libloaderapi-freelibrary.md), [DllMain reasons](https://learn.microsoft.com/en-us/windows/win32/Dlls/dllmain).

Control regression in held test/test-freelibrary-reload.js maps an actual resource-only PE. Existing static-module assertions and pre-unload discovery pass; after successful FreeLibrary, GetModuleHandleA incorrectly returns65085440 rather than0. Run20261009T2119Z-dll-unload-control retains exact test patch and failure. Initial duplicate test helper export was a harness error, fixed for the actual control.

Next implement real PE reference counts, detach at the final release, inactive handle/name/export lookup, and fresh initialization on reload. Preserve shared module state across threads, dependency ordering, row reuse/capacity and decode invalidation. Extend tests for multiple references and entry-point/data lifetime; then revalidate ordinary Alice New Game/Easy. Do not clear game pointers, bypass the guard or merely change FreeLibrary return values. Test remains WIP outside main until the implementation passes.

## Candidate lifetime regression and build constraint (21:39Z)

Held candidate passes reference retention, final DllMain detach, ordinary LoadLibrary reload with fresh data/attach, and table-slot reuse: run20261009T2132Z-dll-lifetime-candidate/expanded.json. Full build101220 stopped21:33:28Z at the layout shake gate, before compiler/gameplay validation. Control without the new lifetime region passes all five layouts; candidate fails gap/pad. Evidence run20261009T2136Z-dll-layout-control includes control, failed build, combined-allocation attempt and held patch. Combining lifetime metadata with DLL flags still fails gap/pad. Next reduce redundant lifetime storage by retaining retired-image data in inactive DLL rows and storing references alongside existing flags, or otherwise reclaim justified space; do not bypass the gate or shrink unrelated capacities blindly. Dependency counts, module pinning and detach failure handling still require review. No Alice gameplay claim; candidate remains outside main.

## Native gameplay reached with held lifecycle candidate

Run20261009T2151Z-alice-lifetime-gameplay/finding.json records the original demo on candidate wasm a2dae641d95a288c70eee7e61d08f560f5da5b3de62a2b1fcd75e51fc5fb9303, main23614c85e plus retained candidate.patch. Ordinary keydown/keyup Enter selects New Game and Easy; keypress alone had no effect. Atbatch5260 the level and HUD are visible; W held120 batches then released20 moves Alice from the cave/mushrooms into trees. step-6.png andstep-8.png independently reviewed; Telegram photo977 sent.125103/125110 exited cleanly21:50:54Z. API log shows cgame/fgame detach and both DLLs freshly mapped/initialized on reload, instead of the previous stale free. No game-memory/configuration edits. Frozen native software renderer only: browser, audio and logical FPS are unverified.

Build124133 completed21:43:26Z: canonical build plus thread-disable, DllMain, init-order, large staging/capacity, system-path, nested load and expanded lifetime suites all pass (run20261009T2144Z-dll-lifetime-compact). The compact design uses bits3..31 of the shared flags word for references and unused retired-row fields for image reservation metadata, adding no memory region. Detach traps propagate rather than retire an incompletely cleaned module. An additional adjustment keeps export RVA zero in retired rows; its later build is separate from the original-game evidence. Dependency release accounting and concurrent-loader behavior still require review before main integration.

Alice is not yet registered in the candidate manifest and test/binaries/candidates/alice-demo is absent. Full original extracted media currently exists on the temporary boat only; local archive remains test/binaries/win98-games-a-d/american McGees-alice_demo-OpenGL.exe. Evidence is kept with notes until registration, rather than attaching it to another dashboard candidate.

Final metadata layout build132174 and all seven loader suites completed successfully21:58:19Z, wasm21cac395a40c05597bc9cd6977b9bd74b4a55c0adf1d96e79afb2e503a662d08. Evidence run20261009T2200Z-dll-lifetime-final-build. This is later than the a2dae641 original-game run; gameplay has not been rerun on this final internal-layout adjustment. Complete candidate is pushed as47fd3ba3d438300933abd07d93a2d1e8696de17c on codex/alice-dll-lifetime-20261009, held outside main for dependency/concurrent-loader review.

## Dependency lifetime review fails (2026-10-09T22:33Z)

Native Alice movement remains proven on held runtime47fd3ba3, not main. New real-PE import regression run20261009T2233Z-dll-dependency-control FAILS: FreeLibrary removes dep.dll while parent.dll still imports its function (expected66142208, actual0). Implement dependency retain/release and review concurrent loader lifetime before integration; do not bypass failing test. Existing seven suites pass the narrower earlier tests. Original installed Alice media still only on temporary boat; local test/binaries/candidates/alice-demo missing.

The new test maps dep.dll exporting answer and parent.dll importing it, confirms the IAT points to the dependency function, then releases the explicit dependency handle. Mapping incorrectly disappears. Test source and terminal tool receipt retained under scratch/runs/20261009T2233Z-dll-dependency-control. This proves the current candidate is incomplete even though Alice itself reaches gameplay; dependency release and cycles require review beyond simple retain counts.

## Dependency review: shared imports fixed, cycles still fail

Held runtime checkpoint069023baa pushed codex/alice-dll-lifetime-20261009, NOT main. Corrected real-PE test proves old47fd3ba3 unmaps a dependency under live importers; candidate now passes shared dependencies, repeated IAT patching and ordinal export bounds, then FAILS cyclic-import retirement. Evidence run20261009T2257Z-dll-dependency-review and2255-cycle-control. Next release unreferenced import cycles, complete concurrent loader review, rerun final Alice/browser; native movement proof2151 used earlier candidate. Local test/binaries/candidates/alice-demo still missing; originals on temporary boat.

The initial2233 regression used a flat guest-to-WASM formula for its query string, which became invalid once guest_alloc used sparse memory. That original assertion alone was insufficient evidence. The helper now uses lib/mem-utils.guestToWasm and asserts lookup BEFORE releasing the explicit reference. A separate corrected control restores47fd3ba3 loader sources, runs the valid helper, and still fails after release; the candidate sources are restored in finally (receipt retained). This revalidates the actual lifetime defect independently of the earlier test mistake. The yielded parent FreeLibrary result is now checked only after loader service completion, not before EAX is set.

Candidate graph records actual resolved imports, deduplicates repeated patch_caller_iat calls, retains each dependency through importer DllMain detach, then releases the graph edges and cascades final detaches. Two shared importers retain a dependency until both retire. No new allocated region: DLL_TABLE+12/+16 now hold two dependency bitsets; redundant NumberOfFunctions/OrdinalBase are read from the original mapped PE export directory. Real ordinal1 and out-of-bounds0/2 are checked. The separate512-byte-region attempt failed gap/pad placement and was removed; build gates remain intact. v6/v7/v8 failures retained; v9 canonical build and six supporting loader suites pass, while its lifetime assertion used the now-corrected helper. The final corrected regression passes preceding shared/import/ordinal checks, then fails explicitly at unreferenced import cycle retires A. No all-tests-pass claim.

Next: distinguish explicit roots from incoming import references and retire an unreachable mutually importing group without invalidating a still-rooted importer. Serialize lifecycle mutations and callbacks correctly across cooperative/nested and actual Worker loading; graph atomics alone do not prove that. Do not merge069023baa until these cases and final gameplay validation pass.

## Cycles and actual Worker lifecycle now pass; concurrent mapping remains

Held runtime d5a47f240 pushed codex/alice-dll-lifetime-20261009, NOT main. Full build and seven loader suites pass, including unrooted cycles, cross-cycle detach callbacks, actual Worker unload, and automatic dependency references in native/Worker routes; module862681ea, run20261009T2330Z-dll-cycle-worker-review. Concurrent two-Worker control still fails: shared PE_STAGING content and DLL table slot are overwritten; serialize staging/publication and graph mutation before integration. Then rerun original Alice and browser. Earlier native movement2151 remains separate build evidence; local candidate media missing.

The group collector subtracts incoming import edges from total references to identify explicit roots, computes reachability, and reserves the unreachable group for detach. All group images remain mapped while every DllMain detach runs; only then are edges and mappings retired. The real-PE regression has each DLL in a two-member cycle call the other DLLs answer export during detach, checking both returned7. Keeping either explicit reference preserves the whole cycle.

The browser/Node guest-worker LoadLibrary message handler previously treated a FreeLibrary yield with no bytes as a failed load. Detach handling now lives in shared lib/dll-loader.js and is used by process-boot and the actual guest-worker route before that missing-bytes branch. A real Node GuestThreadHost test observes successful detach and shared row removal.

A dynamic dependency had an extra temporary mapping reference: corrected control run20261009T2329Z-dll-autodependency-control fails after the parent unloads. Both native and Worker loaders now re-patch the full mapped graph (including back-edges) and drop temporary dependency roots after initializers. The actual Worker test also loads parent+dependency then frees both. v11 controller49086 completed23:24:15Z: canonical build plus seven suites pass; WASM862681ea9aed45ea9a06193c97c4bb041ff27b00f1279113b06733b50069ef73. This proves tested sequential/cooperative/Worker service paths, not concurrent mutation safety.

Concurrent control uses two real Node workers with shared memory and a barrier exactly after the JS staging copy and before WAT consumes it. v1 had default load address0 and is retained as limited harness evidence. v2 supplies distinct valid low destination addresses to isolate staging from initial address selection; worker A expected286335522 but reads worker B858997828, and both report published base4194304. Both controls/controller sources retained in run2330-review. No guest-game changes or performance inference; this is a deterministic legal preemption test. Original-main baseline attribution still pending. All test workers terminate. Runtime d5a47f240 remains held; next shared loader serialization must avoid spinlock/host-import deadlock and protect reference-graph snapshots.

Original-main attribution completed23:31:57Z: identical deterministic two-Worker control against main280d28eb1/module527004d9 also fails, with worker B expected858997828 but receiving worker A286335522. Evidence/controller in run2330-review/original-main-control. Thus shared staging corruption predates this candidate; candidate reachability/refcount concurrency remains an additional review obligation, and no fix is merged.
