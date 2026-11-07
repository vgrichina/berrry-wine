# Rune complete launch staging — 2026-11-07

**The missing launch EXE staging error is corrected and verified. The fresh
original browser reaches the first-run wizard, then its automatic renderer-test
child fails during DLL startup.** The first fatal API is `_vsnwprintf`, after
the child fails to resolve the original CRT and requests a missing global
`binaries/dlls/msvcrt.dll`. No cave, turning, attack/jump consequence or enemy
encounter was reached. No production code or original media/configuration
changed. Evidence: `scratch/runs/20261107-rune-complete-launch-manifest/`.

The personally reviewed `review/startup.png` shows the original Software
Rendering wizard behind the fatal-error dialog. The Nov 1 cave/W route in
[rune-demo.md](rune-demo.md) remains historical evidence. This invocation sent
**zero original native input events**. It did not select a renderer or bypass
the wizard. Empty parent arguments, original shipped INIs, relative mouse and
`C:\System` are preserved.

## Complete registered staging

The preparer reads the actual `APPS.rune_demo` registry and unions its EXE,
all four declared DLL paths, manifest path and every manifest-listed URL.
The predecessor's manifest-only pins are a failing control: they omit the
registry EXE. The corrected closure has **143 unique paths**, including all
**six shipped INIs**. Local reads and actual local HTTP response bodies all
match their SHA-256 and size. The local launch URL
`/test/binaries/candidates/rune-demo/game/System/Rune.exe` returns the original
**233,472-byte** body, SHA-256
`dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add`.
This matches the accepted Nov 1 identity. The predecessor's original manifest
and installed-file pins also match unchanged.

Before Chrome launch on the new box, the driver independently hashes all
**607 staged pins**, then fetches and hashes all **143 required HTTP bodies**
from the actual served root. The final audit verifies **432 successful served
bodies** against those pins, including the original launch EXE. This corrects
[the predecessor's HTTP404 staging failure](rune-browser-combat-20261107.md).
The later child CRT fallback 404 is a different URL, not an absent registry
EXE or absent installed CRT.

## Exact new blocker

The retained console records the parent loading original **MSVCRT.dll,
Core.dll, Engine.dll and Window.dll**, with all four initializers returning
**EAX=1**. The original first-run wizard then naturally invokes:

```text
C:\System\Rune.exe testrendev=D3DDrv.D3DRenderDevice log=Detected.log
```

This is the original wizard's automatic renderer probe, not an injected
command or a second driver launch. The child mounts the caller filesystem
(**214 entries**) but resolves only **three DLLs**. It requests the global
`binaries/dlls/msvcrt.dll`, receives **404**, and falls back to built-in CRT
imports. It traps at **`_vsnwprintf`**, EIP **0x10ce6940**, during
**Engine.dll** initialization (module **0x10f7b000**, DllMain
**0x110b3f91**). Rollback through **Window.dll** (module **0x10b61000**,
reason **0**) also traps. The reviewed error dialog reports both failures.
`first-blocker.json` and the recovered console retain these exact boundaries.

The installed original CRT exists and was served/hash-matched. In the current
browser loader, a global registry DLL URL is selected before the mounted-file
branch, which runs only when no URL is selected. This is a concrete lead for a
child DLL-resolution regression; the complete root cause is not qualified by
this run. Implementing a formatting stub would not establish that the child
loads the original CRT. No speculative repair, second original invocation,
re-pinning, guest-memory write, handler injection, forced focus/configuration/
clock, held-lane retry or UNKNOWN replay followed.

## Qualification and actual backend

The stable production closure includes Outlaws' released **c254a3e3e**
Worker/NE changes. The source pin is main commit
**c978288ef85a8d3092946c3eeed1d90e9f836abc**. Git SHA, relevant tracked and
untracked patches, owned helper patches, original hashes and the staged-file
manifest are retained; no source/media archives were made.

Hash-identical native input/release, transport, observer and qualification
helpers were reused. Fresh deferred observer missing-file rejection and actual
evaluation pass. Fresh local Chromium attaches the actual production guest
and render Workers. Exact owner/module/freshness negative controls and all
**14 mouse/key release cases** pass, including delayed, pending and rejected
ACK controls isolated to the generated fixture. A separate trusted ArrowUp
pulse receives exact command ACK, with release armed before down and
independently attempted after **60 ms**. Exact quit ACK and local process,
port, profile and writer cleanup pass. The real driver accepts 25 minutes and
rejects 35 minutes, expired and NaN deadlines before Chrome execution.

The generated qualification fixture has a **legacy WebGL** render endpoint.
It is not Rune coverage. The original page has **CanvasRenderingContext2D**
for the wizard and **no game render endpoint or GL contexts**. The wizard's
D3D probe request does not establish active D3D rendering. The original parent
and child live modules match SHA-256
**e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467**,
**2,182,493 bytes**; the unique module is recovered. No game backend, FPS,
audio or general parity is claimed. Historical software gameplay remains
software evidence only.

## Custody and next step

One UUID-idempotent 40-minute box, **bx_atphjxn5**, was created at
**12:54:47 UTC**, original expiry **13:34:46.890 UTC**, immutable driver
stop **13:19:46.710 UTC**. The only original driver launch exited normally
after exact quit ACK; Chrome exited **0**. The first immediate custody check
caught the remaining process-drain interval; its known failed read-only
assertion is retained. A subsequent inspection and full custody check prove
both own runtime PIDs absent, both ports closed, no profile/writer/held input,
and all remote pins unchanged. No command with unknown outcome was replayed.

All **32 unique artifacts / 2,580,891 bytes**, including the reviewed PNG,
console, HTTP-body proofs and live module, were recovered and SHA-verified
**before** the explicitly delegated normal nonforced stop. Final API state:
**archived**, stop **completed**, **forced=false**, expiry **null**, stopped
**12:57:34.714 UTC**. Local watcher/runtime cleanup and free disk above **2 GB**
are verified. No production edit was made, so no code build was required;
validation covers the staging closure and actual driver/observer/native-input
controls. Rune has no candidate-corpus entry; this stays investigation evidence
and is not attached to an unrelated candidate.

Next: reproduce the original wizard child CRT-resolution failure in a focused
regression, retain the original mounted sibling DLL through normal child
launch, then requalify a separately assigned fresh original gameplay attempt.
