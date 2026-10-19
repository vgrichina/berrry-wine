# GetFullPathName directory separator compatibility

Source candidate base: main `cdc48b24d16fffd53a1ff8972b206d08212ce9d3`,
which follows60f403b4e with a TODO-only update. Isolated branch
`task/army-fullpath-separator-oct19`; no unmerged LockFile source included.
Ownership is restricted to VirtualFS.getFullPathName and its host import.

The original Army directory-validation-v2 observation is sealed separately
in `scratch/runs/20261019-army-men-directory-validation-v2`, manifest
`e9dfb850f15bf3dfbeb28832022216587756ac48c6952c7800acb486c0f66a76`.
It captures a GetFullPathNameA input ending Campaigns/, followed by the game's
FindFirstFileA pattern campaigns*.* without a separator, failed enumeration,
then a leading-NUL cached directory passed to native _chdir. The original
SetAt instruction trace had zero hits; exact dynamic store attribution remains
unavailable. No claim that the earlier AVI transition proves this campaign path.

## Contract and scope

[Microsoft GetFullPathNameA documentation](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfullpathnamea)
specifies successful length excluding NUL, required capacity including NUL,
and a zero file-part pointer for a directory result. It does not require the
path to exist. The shared host import serves A and W in TCHAR units.

[Wine's Windows path conformance tests](https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/tests/path.c),
`test_ValidPathA` lines129–137, explicitly compare a trailing-backslash input's
full result including that separator and require NULL filePart. This supplies
the trailing-separator evidence not explicit in Microsoft's prose. No original
application binary or alternative assets are used in the new tests.

The fix changes API display semantics only: normalize slash spelling before
resolving an API path, preserve an explicit final separator, and represent a
drive root with its backslash. Canonical VFS lookup still uses the unchanged
_resolvePath/_normPath functions; existing case-folding policy is retained.
On short buffers, return required TCHAR capacity before writing output or
filePart. On successful directory-form output, set filePart to zero; for a file
result retain the pointer into the output, scaled for ANSI/UTF-16. Empty inputs
retain their existing failure behavior. This is not a complete Windows path
normalization overhaul (case retention, device namespace and per-drive CWD
limitations remain outside the scoped change).

## Validation and pending runtime

`node test/test-full-path-name.js` passes pure-JavaScript production host imports
using16KiB ArrayBuffer memory, no WebAssembly instance: A/W explicit separators,
mixed separators, roots, parent traversal, relative/nonexistent paths, sufficient
and exact-short/zero capacity, output sentinels, optional and directory/file
file-part pointers, and composing Campaigns/ with *.* for enumeration.
`node test/test-vfs.js`:46 passed,0 failed. Syntax check passes.
The sealed old v4 VirtualFS negative control returns C:\work\campaigns without
its slash, demonstrating the regression that the new test detects.
The first test draft compared a Uint8Array to Buffer with strict equality;
that test-only representation mismatch was corrected before all checks passed.

No build, native guest, browser or original Army retry has run on this candidate.
Root must review/integrate the disjoint filesystem hunks and qualify an immutable
consumer before any claim that this fixes BootCamp gameplay. Original files and
historical bundles remain untouched.

## Paired original consumer ready (not run)

Immutable `/home/user/army-men-local-stage-v7-20261019` uses historical7c943
source/runner903d and module7fd, plus this scoped filesystem JS candidate
`afeabfd0e06f70b03ab1c8627abacaf76cb1dd66`. Maincdc48 filesystem base and v6
filesystem were byte-identical SHAca27bf7e, so the candidate is exactly these
reviewed hunks on the prior consumer. No src/ABI or WASM change is required;
this is explicitly a paired historical baseline, not currentmain's module.
The candidate filesystem SHA is
`04f5fd5fa989f416826eb19fe38227bf26a9433d11c921f11bc5f95496dc5fbf`.

All1,600 staged entries rehashed,1,597 unchanged hardlinks. Added allocated
file bytes434,176 including manifest, excluding directory metadata. Priorv6
also rehashed unchanged. Manifest:
`b22f8986ce3428e776b34736cb4fe217b373f15511385e090986fc09c6b447a8`.
Controller:
`e43ad070c53ac17dd9ca0ca9dc0d76890e03b42847d5ad5b8a5328408be170d1`.
Unchanged trace plan:
`84bb379481ed5ebc5721dd83245ccbfc34e885a9bf6ba911a8eb985e73b4f2ed`.

Source95modules/39statics and native5DLL preflights pass. A/W regression tests
also pass directly against the staged runtime; actual trace expression,
API-memory and host-return wrapper tests pass. No native execution occurred.
The unchanged trace plan captures the selected API/host returns and eight
possible43c754 boundaries; no debugger breakpoint/watch is used. Same limits:
60s guest/75s soft/90s hard,4MiB raw log,28MiB output,512MiB transient reserve,
fresh admission2,847,932,416 bytes and250ms hardfloor2,214,592,512 bytes.
Readiness is `scratch/runs/20261019-army-men-fullpath-consumer-preflight/ready.json`.
Pending explicit root grant:

```sh
node /home/user/army-men-local-stage-v7-20261019/controller.js /home/user/army-men-local-stage-v7-20261019 /home/user/wine-assembly/scratch/runs/20261019-army-men-fullpath-observe-v1 --root-runtime-granted
```

### First v7 allocation: admission refused, no guest

The granted fullpath-observe-v1 attempt exited1 at controller line28's initial
fresh disk admission assertion before output creation, source preflight or
spawn. No child/session or game compatibility result exists. The assertion
has no exact failed-sample value; separate follow-up statfs at02:15:14 UTC
reported2,995,687,424 bytes for allthreepaths, and df2,995,683,328. Those later
readings exceed admission2,847,932,416 but do not explain the earlier refusal.
Failure receipt: `scratch/runs/20261019-army-men-fullpath-observe-v1/admission-failure.json`.
No automatic retry, threshold change, or original/source alteration. Root was
notified of release; another allocation needs a unique directory and fresh check.

### Paired v7v2 result: separator fix validated, game still blocked

Root launched unique fullpath-observe-v2/session98620 with the unchanged
reviewed controller. Guest2897500/controller2896813. Menu first.png was
visually reviewed before ordinary BootCamp click176,180 at batch499.
Actual searches now contain campaigns\*.* and maps\*.*; FindFirst returns
6a000008/6a000009 and each subsequent FindNext returns1. The Campaigns
SetCurrentDirectoryA buffer114a950 starts43 (`C`) and contains the full path.
This validates the separator/directory-validation behavior against the original
program. No SetAt trace hit was observed.

Nevertheless snapshot202350 reports the game's Error dialog and the raw log
still says `ERROR: .AMM does not exist`. The framebuffer PNG remains the menu;
no gameplay is shown. This trace does not include campaign fopen or chdir
return, so successful campaign opening is not proven. Normal HTTP quit exited0
with no guard reason, minfree2,989,023,232, all1,600pins unchanged and freshly
absent groups. Prior licence acceptance remains true; Finish unobserved.
Evidence16artifacts447,430bytes, manifest
`ad4488adcf92a901d5eca7b3aa0719d77b21a27a6d2a5f69ef4db99622d2a732`
in `scratch/runs/20261019-army-men-fullpath-observe-v2`. No retry.

Separate source-only reproduction points to a second defect: with cwdc:\work\
and an existing c:\work\campaigns directory, `_resolvePath('C:/work/campaigns/')`
returns c:\work\work\campaigns and directory lookup fails, whereas the equivalent
backslash absolute path resolves correctly. Drive-relative detection currently
runs before slash normalization. This does not retrospectively prove the
untraced chdir return; it supplies a generic canonical-resolution regression
for a separate source fix and subsequent observation.

### Separate canonical slash-classification fix (source only)

Root authorized `_resolvePath` ownership after the paired separator result.
Normalize slash spelling before the existing drive-relative/root/UNC decision,
not after it in _normPath. This one-line behavior change keeps C:/dir absolute
and /dir rooted, while C:dir remains drive-relative. The new regression first
failed on the unmodified function with c:\work\work\campaigns, then passes
against the fix. It verifies generic mixed slashes, same/different drive-relative
paths, roots, UNC spelling equivalence, chdir to a real mounted directory,
relative file opening there, and failure for genuinely missing directories/files.
The existing canonical UNC representation is retained, not claimed fully corrected.

Validation: new slash test PASS; A/W API tests PASS; existing VFS46/0 and adopt
PASS. Requested lazy suite:49PASS/2FAIL identically on candidate and pre-change
HEAD. Both failures construct a ThreadManager prototype without its threads
map, then hit `threads.values`; they are unrelated to path resolution. Baseline
was loaded from git HEAD into a test-only Node module cache without modifying
production files. Raw baseline/candidate logs are retained at
`scratch/runs/20261019-army-men-slash-source-tests`. An initial third lazy failure
was sparse checkout missing host.js; adding exact host.js and test/run.js removed
that environmental failure. No scheduler fixture was silently patched. This
existing suite includes its real Worker/compiled-adapter check, which passed;
no original game or normal build was executed. New test's missing-file assertion
uses VirtualFS's internal zero failure (not Win32's external INVALID_HANDLE_VALUE).

The first GetFullPathName fix remains a separate coherent commit; this second
fix has no consumer runtime qualification yet and must not be labeled a BootCamp
success. Root integration/review controls further runtime allocation.
