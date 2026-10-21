# Jedi DirectX predicate: original-byte recovery blocked

This bounded task stops at **original-byte acquisition**, before static launcher
analysis or any guest launch. The failing DirectX predicate remains unknown.
No localized emulator/host defect is proven and no production source was changed.
The accepted predecessor's ordinary Play transition still ends at the original
DirectX 5.0 requirement dialog. It was **not retested** on the new box.

## Verified staging

Only assigned running box `bx_wbedea9e` was used, through Boat API exec. Exact
source `fe49a84e745015ecdbe752e028235924ef4324dc` was cloned remotely; all **7403
tracked blobs** were checked against Git blob identities both before and after
work, with clean checkout status. Dependencies were installed with `npm ci`.
Canonical build gates passed and the module matches
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c` (1,878,508 bytes).

**Workflow deviation:** the first module search used `rg --files`, which omitted
ignored artifacts, followed by a shallow directory search. A broader `find`
subsequently located the accepted module at
`/home/user/wine-assembly/scratch/runs/20261021-army-integrated-gameplay-scroll/provenance/wine-assembly.wasm`.
The remote build had already completed. It was redundant, contrary to the
requested recover-before-build constraint. Its exact identity is verified; no
replacement module or source behavior was introduced. Future recovery should
include ignored evidence paths before starting a build.

Predecessor remote commit `4f0844c013c46afd446428578d75f5ec8afca515` and its
accepted original-layout/installation proof were reused. Its 1,925,047-byte
archive transferred to the new box with SHA-256
`fea97ead7fe1b0f4f9bba0264d8073e5956857150dba2d97a2b1a4a62190f9cb`.
All **87 seals** verified. Of the **361** observed-tree mappings, **187** resolve
to available exact-source or included payload bytes. The other **174** reference
original package files and cannot be restored without those originals. The
observed registry exports and restore recipes are present. No partial installed
tree was presented as an installation and no installer was rerun.

## Concrete blocker

The package required by `recover-layout.py` is `jedidemo.exe`, 21,195,858 bytes,
SHA-256 `8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.
A filesystem search under local `/home/user` and `/tmp` found neither that
package nor `Jedi.exe`. Old-box paths are recipes, not files on the new box.
The old stopped box was not accessed or resumed.

Remote acquisition results on 2026-10-21, around 16:06–16:09 UTC:

| Preserved URL | Actual result |
| --- | --- |
| `https://archive.org/download/jedi-knight/jedidemo.exe` | Connection timeout after 120 seconds; zero bytes, no output package |
| `https://dn721808.ca.archive.org/0/items/jedi-knight/jedidemo.exe` | HTTP 500, curl exit 22; no output package |
| `https://ia801506.us.archive.org/0/items/jedi-knight/jedidemo.exe` | Connection timeout after 15 seconds, curl exit 28; no output package |

A local HEAD check and remote archive HTTP/metadata connectivity checks also
timed out. The initial long Boat exec returned no JSON to the client; its
remote curl log independently records the completed timeout. The alternate
[3dfxzone download listing](https://www.3dfxzone.it/dir/3dfx/utilities/?objid=1111)
returned only a JavaScript verification/redirect page, including after its
provided redirect, not original bytes. The [Frag-Net listing](https://frag-net.com/game_jk.html)
links back to Archive.org. No download completed and no unverified substitute
was run. This is an acquisition blocker, not evidence of a runtime/API failure.

The retained predecessor launch trace was inspected: `FindFirst` finds
`C:\WINDOWS\SYSTEM\DDRAW.DLL` and `DSOUND.DLL`, each 1024 bytes, followed by
the requirement dialog. That trace does not establish the failing API, branch,
or expected-versus-actual value. Source inspection found the existing static-DX
version-resource path, but without original code or a targeted trace it does
not justify attributing the dialog to it. No version/registry fabrication,
launcher bypass, original patch, or direct-engine launch occurred.

**Probes used: 0 of 2.** Regression and installed-launch retest were not run:
there is no proven correction and the original installed launcher is absent.
Gameplay, engine handoff, input/audio and FPS remain unqualified.

## Evidence and recoverable handoff

Local run: `scratch/runs/20261021-jedi-directx-predicate`.
Tracked evidence: `docs/reviews/jedi-directx-predicate-20261021/`.
The new `evidence.tgz` is 299,823 bytes, SHA-256
`994e37183e275bb7222546a9f3d2af3a962f55f814be98db50fe4fb5c5bb4bf2`.
It contains the source inventory, build/install/download logs, recovery recipes,
missing-mapping census, original inventory, and retained launch trace.
`python3 verify.py` beside it checks its sealed contents without a runtime.

Remote source/dependencies/module: `/home/user/jedi-source`.
Remote task staging: `/home/user/jedi-predicate`, including `predecessor.tgz`,
fully extracted predecessor evidence, `recover-layout.py`, `restore.py`,
`original-inventory.json`, and this task's sealed `evidence.tgz`.
To unblock this same diagnosis, recover the exact pinned original package onto
the assigned authorized runtime; use the predecessor's hash-verifying source
recovery and observed-tree restore recipes, then inspect original static code
before spending a launch probe. `restore.py` expects original basenames with
their inventory spelling; the faithful-layout output alone has lowercase nested
paths and is not directly its ORIGINAL_FILES argument.

Box `bx_wbedea9e` is left **RUNNING**, expiry
`2026-10-21T18:01:57.547Z`; coordinator owns shutdown and receives ownership back.
No workers, replacement tasks, SSH, new/resumed boxes, main merge, public deploy,
or unrelated worktree edits. Local work stays below the 64 MiB cap, with
prewrite checks against 2,915,041,280 bytes of free-space reserve.
