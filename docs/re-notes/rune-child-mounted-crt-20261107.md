# Rune mounted child CRT repair — 2026-11-07

**Published loader repair `0d776160179f43f4effb2aa2f10bae5b49e00624`
removes the demonstrated child CRT mismatch. The unchanged original browser
demo now completes its first-run wizard and reaches the cave.** Personally
reviewed captures show ordinary mouse turning, forward movement, and a visible
jump response followed by a return to standing height. A short Fire pulse while
unarmed has no distinct visible attack consequence; hits, damage and enemy
combat remain unqualified. Evidence:
`scratch/runs/20261107-rune-child-mounted-crt/`.

## Repair and failing control

The automatic child inherits `C:\System\MSVCRT.dll`, but the browser resolver
previously selected `DLL_PATHS['msvcrt.dll']` first. Since it attempted mounted
siblings only when no URL existed, the missing global URL prevented the
installed original CRT from loading. This caused the predecessor's global
HTTP404 and `_vsnwprintf` trap during Engine initialization.

`test/test-browser-mounted-dll.js` uses the real shell's `launchVfsExe`, child
entry/snapshot/mount, real `VirtualFS`, the verbatim current production browser
resolver block, and shared `resolveDllGraph`. Its synthetic lazy CRT remains
unread until loading. On the previous production source it requests the global
CRT and fails `automatic child must retain original CRT instead of global 404`
with graph length **0**, rather than **1**. No resolver implementation is copied
into the test. This is an in-process production-code regression; the subsequent
original browser run supplies real-media acceptance.

The repair checks a bare import's mounted executable-directory sibling before
the global registry. Lazy materialization and its actual module path are
preserved. Explicit URLs bypass sibling lookup; explicit absolute guest paths
select their specified mounted file, with no sibling substitution when absent.
Tests cover original sibling bytes, module path, lazy reads, absent-sibling
global fallback, explicit URL/guest paths and unrelated parent URL launches.
Existing parent seed module identity remains intact. No formatting stub,
guest/handler change, injected focus, configuration rewrite or clock override
was added. The mandatory whole-file callback census seal records the reviewed
lookup-only delta; callback/initializer ownership machinery is unchanged.

The focused regression, existing shell launch suite, Unreal renderer companion
mount suite and real-PE DLL import graph lifecycle suite pass. The locked full
build passes. Code was committed with explicit owned paths and immediately
pulled/pushed on `main`. Git SHA plus relevant tracked/untracked binary patches
and owned helper patches retain source recovery; no source/media archives were
created.

## Fresh original browser evidence

The complete registry EXE/DLL/manifest closure was reused and reverified: **143
paths**, including the original **142 installed files** and all **six shipped
INIs**. Local actual HTTP bodies match every size/SHA before allocation. The
registered EXE remains **233,472 bytes**, SHA-256
`dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add`.
All **607 staged pins** are independently hashed remotely before Chrome, then
all **143 required HTTP bodies** are fetched/hashed from the actual served root.
The final audit matches **539 successful served bodies**. There is **no request
for the global `binaries/dlls/msvcrt.dll`**. Original source/media pins remain
unchanged after execution.

The ordinary wizard automatically launches the unchanged renderer probe:

```text
C:\System\Rune.exe testrendev=D3DDrv.D3DRenderDevice log=Detected.log
```

The console now maps original child **msvcrt.dll at 0x1136c000**, DllMain
**0x1136d000**, and binds the EXE and Window/Core/Engine CRT imports to DLL #3.
All four child initializers return **EAX=1**. The previous `_vsnwprintf` fatal
dialog is absent. `review/startup.png` shows the original Software Rendering
wizard with no fatal overlay; `loader-startup-proof.json` retains the initializer
and import-binding evidence.

Reviewed ordinary actions, each followed by its own capture:

* Software Rendering → Next → Next → Run completes the original wizard with
  empty parent arguments, `C:\System`, shipped INIs and relative mouse intact.
  Passive loading reaches the animated original title arena; Escape opens the
  main menu.
* Individually reviewed relative mouse moves position the original menu cursor.
  New Game and Easy visibly highlight red before selection. Initial known
  pointer misses are retained, not counted as successful menu selections.
* `review/cave-load-wait.png` shows the blue cavern, standing player and health
  HUD. Leftward ordinary mouse motion shifts cavern landmarks right in
  `cave-turned-left.png`, establishing a turning response.
* A **600 ms W** pulse moves the player toward the altar; `cave-forward.png`
  shows closer skull/axe landmarks and a walking pose.
* The shipped `Enter=Fire` **120 ms** pulse has no distinct visible attack or
  damage consequence while the avatar is unarmed. A **120 ms Space** sample
  also does not establish a jump pose. These negative observations are retained.
* A subsequent ordinary **500 ms Space** pulse produces a transient raised
  view/changed player pose in `cave-jump-long.png`; a passive **1,200 ms** capture
  `cave-after-jump.png` returns to ground/standing height. This qualifies a
  visible jump response, not combat or physics parity.

All **22 commands** have exact ACKs, including quit. The **37 native events**
are trusted, with **12 independently armed DOWN/UP releases** and no held input
at exit. No command with unknown outcome was replayed. One local retrieval
attempt read the previous capture before the Run command finished and refused
an existing local output file; the recorded exact Run ACK was then inspected
and the new capture retrieved. This caused no extra input or launch.

## Actual backend and custody

The original game uses **software rendering / CanvasRenderingContext2D**, with
**no game render endpoint and no GL contexts** throughout the reviewed captures.
The host's WebGL dropdown and automatic D3D probe do not establish GL/D3D game
coverage. Audio, FPS, enemy combat and general rendering parity are unqualified.
Chrome is **151.0.7922.108**, V8 **15.1.206.16**; the native viewport is
**1024×712**, with a **640×480** game canvas. All captured live modules match
SHA-256 **e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467**,
**2,182,493 bytes**. The unique live module is recovered.

Hash-identical predecessor input/release, transport, observer and qualification
fixtures were reused. Fresh actual production guest/render Worker attachment,
identity/module/freshness negatives, all **14 native release control cases**,
trusted ArrowUp/exact quit ACK, deferred missing-observer rejection/positive
evaluation, and the real driver's **25-minute acceptance / 35-minute, expired
and NaN rejection** all pass before allocation. Fixture WebGL is fixture-only
coverage. Its process-drain interval was observed and absence rechecked before
allocation.

One UUID-idempotent **40-minute** box, **bx_zrvtcse6**, was created at
**13:05:32 UTC**, expiry **13:45:32.299 UTC**, immutable driver deadline
**13:30:32.122 UTC**. There was one original browser invocation. Exact quit ACK
and Chrome exit **0** preceded verified absence of both own runtime PIDs, closed
ports, removed profile/writer and balanced input. All remote pins remain intact.
All **248 unique artifacts / 10,313,943 bytes**, including personally reviewed
captures, console, served-body proofs and the live module, were recovered and
SHA-verified **before** the task's explicitly delegated normal stop. Final API
state is **archived**, expiry **null**, stop **completed**, **forced=false**,
stopped at **13:15:38.027 UTC**. No box ownership remains outstanding.

The final local disk-floor check encountered an unrelated shared-volume drop
from approximately 2.89 GB to below 2 GB after recovery. The worker flagged it
on the coordination board and retained all evidence. `terminal-audit.json`
records passing code/runtime custody checks separately from this **failed local
disk-floor check**; no overall terminal-audit pass is claimed. The worker owns
only about 15 MB of this run and did not remove other agents' files or app/session
history. Coordinator cleanup above the floor is the remaining resource blocker.
Rune is absent from the candidate-corpus
manifest, so this remains investigation evidence and is not attached to another
candidate. Next gameplay work is ordinary weapon pickup and visible attack/hit
consequence; it does not require another CRT repair.
