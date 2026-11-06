# KKnD Windows Xtreme demo registration and first blocker, 2026-11-06

The complete original Windows Xtreme demo is registered and published on main
in **`234e8fae38e5614439f2c8d54fd9b19ad133deaa`**. Its single original session
stopped before the menu with **“KKND Xtreme needs DirectX 5 or greater”**.
The first error was preserved and personally inspected. No mission, selection,
movement, audio or playability is claimed, and no startup was repeated.

Evidence: `scratch/runs/20261106-kknd-registered-gameplay/`. The original tree
remains at `scratch/game-media/kknd-demo-20261106/installed/`. All 16 sizes and
SHA-256 values matched the released recovery manifest before and after runtime:
15,653,500 bytes, including executable SHA-256
`b2e1a476bfe766edf802c9fa4d0fed2ed841a8d1b50e1a8ee27ceae33afe5d8a`.
No media was extracted, downloaded, copied or modified. See
[payload recovery](kknd-payload-recovery-20261106.md) and
[corpus intake](kknd-corpus-intake-20261106.md).

## Registration and checks

`lib/apps.js` now has an ordinary local category entry and `APPS.kknd_xtreme_demo`:
original executable, required local manifest, concurrency 10 and ordinary
mouse-strategy controls. Memory, threads, errors, arguments and resolution use
defaults. The local `.wine-assembly-browser.json` is byte-identical to the
released proposal: all 15 companions retain their directories below `C:\`.
The exact HKLM key
`SOFTWARE\Melbourne House\Krush, Kill 'n' Destroy Xtreme Demo\1.00.000`
contains `GamePath` as REG_SZ `.`. The live VFS/localStorage snapshot confirms
CWD `C:\`, all companions and that registry value.

The run-owned checker exercised the actual CLI manifest resolver, browser URLs,
VFS paths, all payload hashes and default eager policy. Existing
`test-app-files-policy`, `test-app-file-sizes` and
`test-local-proprietary-demo-dropdown` passed. The broader `test-debug-game-apps`
fails its unrelated `halflife_uplink` local-category assertion with both this
registration and unchanged HEAD's `lib/apps.js`; the baseline was evaluated in
memory without another checkout or source edits. This is recorded as a failure.

The mandatory `flock /tmp/wine-build.lock bash tools/build.sh` passed after the
declarative app-file change received its narrow reviewed SHA/reason update in
`tools/callback-ownership-census.json`. The initial seal rejection is retained
in `build-first.log`; broader callback ownership remains pending.

The browser actually loaded standard WASM SHA-256
`3bc4e29b86d3a085bf14de1a242f87f22321d513f26cb2259f22804d0c32dc7e`,
2,176,554 bytes, matching the rebuilt module. Exact served bytes are retained as
`served-wine-assembly.wasm`. All 308 recorded source/module hashes remained
unchanged throughout runtime. Registration publication pulled no incoming
changes. Environment: Chrome 151.0.7922.108, isolated localhost, default guest
Worker, 1100×850 viewport, ordinary direct app launch. No boxes or subworkers.

## First blocker

The one original started at 03:45:50 UTC. The error appeared immediately before
any input or menu. `startup-01.png`, `startup-01.json`,
`first-failure-registers.json`, `first-failure-vfs.json` and `console.jsonl`
preserve the first boundary. No CPU trap occurred: execution was parked in the
ordinary message box. The captured guest stack return is `0x44bf82`, EDI zero.

Original disassembly at `0x44bee0` queries `GetVersionExA`, then
`GetFileVersionInfoSizeA("ddraw.dll")`, allocates the returned size, calls
`GetFileVersionInfoA` and queries the version root. It loads
VS_FIXEDFILEINFO.dwFileVersionMS at offset 8 into EDI. For Win9x,
`0x44bf66` compares EDI with **`0x00040005`** (file version major/minor 4.5);
`0x44bf6c` jumps to success only if at least that value. Failure calls
MessageBoxA at `0x44bf7c` and returns zero.

The live VFS contains `C:\WINDOWS\SYSTEM\ddraw.dll`; it is not a missing
game companion. `lib/process-boot.js` deliberately seeds a static-module file
placeholder **without RT_VERSION**. Interface emulation does not establish an
installed Microsoft runtime's file version. The WAT named-file version parser
in `src/09a1-comctl-handlers.wat` reads actual resources and returns zero when
unavailable. There is no justified CPU repair or reason to fabricate a DirectX
version to suppress this error.

Both exact rebuilt modules passed existing `test-static-dx-version.js`
(12 checks each), including absent/static versus installed file-backed version
behavior. Existing `test-directx-system-files.js` also passed against both exact
modules via an in-memory prebuilt-module adapter: placeholders supply no invented
version, installed files are preserved, and placeholders are excluded from native
DLL mapping. These are generated API tests, not another original session.

Microsoft documents that
[GetFileVersionInfoSizeA](https://learn.microsoft.com/en-us/windows/win32/api/winver/nf-winver-getfileversioninfosizea)
retrieves a named file's version size and returns zero on failure;
[GetFileVersionInfoA](https://learn.microsoft.com/en-us/windows/win32/api/winver/nf-winver-getfileversioninfoa)
retrieves that file's version information. Bare names use DLL search rules.
A separate source-visible gap is that our VERSION helper opens the literal name
relative to CWD. Fixing that search alone cannot satisfy this run: the system
placeholder has no version resource at either path. Arbitrary DirectX API
coverage is not established by this prerequisite probe.

After preserving the blocker, one trusted Enter keydown/keyup dismissed the
dialog. The original exited with code 0; `after-error-dismissal.png` was personally
reviewed. The browser closed at 03:48:05 UTC. No game inputs or second startup
followed, and no diagnostic writes to guest memory or registers were made.

## Recovery and next ordinary route

Restore the registration from the recorded main commit and retained payload.
If only the ignored host manifest is absent, run from the checkout root:

```sh
git apply scratch/runs/20261106-kknd-registered-gameplay/local-manifest.new-file.patch
```

Apply only when that file is absent. Alternatively, write the released recovery
proposal to the media-root manifest path. This is host metadata; do not repeat
extraction or copy media. Exact Git SHA, relevant binary diffs and owned new-file
patches are retained. No source archive was made.

The next prerequisite is a provenance-pinned, unmodified installed DirectX
5-or-later runtime file with an authentic DDRAW version resource, separate from
the complete demo payload. Verify its actual version; do not rename a setup DLL
to DDRAW or synthesize a resource. Resolve documented bare-name VERSION search
with a focused regression, or mount an authentic file at the exact requested
ordinary root path. Preserve builtin execution policy: file metadata is not
proof that mapping native DirectX code is supported. No such intake or repair
was performed in this task.

After that prerequisite, a newly authorized ordinary session should attempt main
menu → **Evolved → Walkover**, the README's recommended first mission. Left click
a unit, then traversable ground, releasing each button. Retain before, selected,
commanded and displaced captures with a stable camera. Right click deselects;
Enter/Space activate menu choices and Tab/arrows navigate. A menu/screenshot
alone does not demonstrate gameplay.

## Scheduling and cleanup

Caps0135 → Aranna0205 → Conan0240 final releases were observed in order.
Independent cleanup verified 205 absent PIDs, 20 refused ports, nine absent
profiles and four free locks before shared work. The immutable window was
03:43:40.706467–04:28:40.706467 UTC; the original and all checks finished inside
it. Owned runtime processes, ports, profile and board watcher are cleaned before
final evidence publication. Box ID/state/expiry: N/A, none assigned or used.
No public deployment, held-task retry, Heroes II, source archive or media copy.
