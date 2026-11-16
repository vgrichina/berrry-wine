# VB5 CCE original media, 2026-11-16

The current original run is blocked **before the first input**. The original
installer visibly asked whether to install VB 5.0 Control Creation Edition.
After personal review of the complete 640×480 frame, the first `guarded-bind`
returned `reviewed native scene changed before binding`. That refusal latched
permanent UNKNOWN. Four endpoint requests were made (snapshot, PNG, snapshot,
bind); none followed the refusal. A subsequent local intent command refused
before networking. No second pipeline, recapture, rebind or input retry occurred.
The precise changing scene field is unknown: the refusal did not return a
field-level comparison, and the closed endpoint was not queried again.

Installation completion, IDE startup, AXListPicker execution/interaction and
ordinary guest Quit are all **unproved**. Native host cleanup returned exit 0
after SIGTERM; this is not guest Quit. The September 22 result in
`visual-basic-5-cce.md` remains historical, not current qualification. CCE runs
projects inside its IDE; no standalone EXE compiler capability is claimed.

## Media and recovery

Downloaded the original from
`https://archive.org/download/vb5ccein/vb5ccein.exe` into the ignored directory
`test/binaries/candidates/vb5cce-original/`:

| File | Bytes | Digest |
| --- | ---: | --- |
| vb5ccein.exe | 7479944 | SHA-1 `afaf3e9a0234f08e51fd234e10037c62c6b80f34` |
| vb5ccein.exe | 7479944 | MD5 `a674f274ddc88698328177551e196ac4` |
| vb5ccein.exe | 7479944 | SHA-256 `022af94b651cd9d31e0676a6819dd5085940893f1ecc4abaa85b48c30de6f318` |
| setupapi.dll | 341264 | SHA-256 `51f2682279e28386aa9c0eb8ba4f8ac3000c9ff75cf7e2456e8cdd9f0c544159` |
| dx7aeng.exe | 6340040 | SHA-256 `564de93dcc50691480332e2ccb5565908760b295faa70f8c68854f69dad87189` |

The historical Deus Ex SetupAPI path is absent. Recovered Microsoft's genuine
Windows NT Setup API **4.0.1381.5** from the existing local DirectX 7a
redistributable at
`test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted/dx7aeng.exe`:

```sh
7z e -y -otest/binaries/candidates/vb5cce-original \
  'test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted/dx7aeng.exe' setupapi.dll
```

PE/version inspection identifies Microsoft Corporation, original filename
SETUPAPI.DLL, NT subsystem 4.0. Export inspection verifies A/W forms of
SetupOpenInfFile, SetupInstallFromInfSection, SetupFindFirstLine and
SetupGetLineText. The retained media manifest pins both the local redistribution
and extracted DLL; its earlier download origin was not independently recovered.
No replacement DLL, installer-state fabrication, date/license patch or key was
used. The actual guest platform was explicitly `--winver=nt4`, including child
arguments.

## Controller and execution evidence

Run: `scratch/runs/20261116-vb5cce-original-install-ide-sample/`.

Runtime source was sealed from Git
`ed707e861e99c93c1ec6d36358f2a01956932561`, plus the two new owned helper files.
The module SHA-256 was
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`
(2279037 bytes). It was compiled into a private memfd and sealed; shared build
outputs and other workers' source changes were not adopted for the runtime.
Git, binary patches, source hash inventories and the tested module support
recovery without a source-tree archive or media bundle.

`tools/vb5cce-original-runtime.py` reuses the published Delphi native controller
and sealed-source loader read-only. `test/test-vb5cce-original-current.cjs`
selects the published generated native fixture, not original media. Fresh
same-module qualification passed two distinct rendered USER modals, their
ordinary transition/ExitProcess, independent physical release, focus/owner and
three paint faults, and permanent UNKNOWN with zero subsequent requests.
Both complete positive fixture frames were personally viewed. Native
qualification used the fixture's default Windows 98 identity; the original
used the explicitly declared NT4 identity. This is not an NT4 fixture claim.
Confirmation
times were 113/113 ms, independent UP acknowledgements 222/219 ms, and durable
aggregate completions 238/261 ms, under unchanged 500/1750/3000 ms limits.
Freshness unit checks passed game 5 s/menu 30 s boundaries. Desktop transport
before/after regression and native context checks passed as expected.

Preparation 1 exposed an omitted Python helper hash in the new source inventory;
it failed locally before original launch and is retained. Preparation 2 passed
qualification and was stopped at its unopened original gate to add explicit
child control-port/NT4 propagation. Its actual outer wait was 130. Final
qualification and original used the final unchanged helper bytes. None of
these preparation runs launched original media.

The only original pipeline prearmed a fixed 1800 s native deadline, 1820 s
independent watchdog and 180 s Quit reserve before stage zero. Its extractor
was launched directly from the verified original, with native-generated C:\
overlay and registry export enabled. The first bind failed roughly 17 s after
pipeline admission. No setup or IDE stage was launched. Intended subsequent
IDE launch uses the installed shipped project argument
`"c:\program files\vb5cce\samples\axlstpik\testgrp.vbg"`; the unsupported plain
New Project hook and historical batch/dlg-cmd automation were not used.

Original and supervisor actual waits were 0; the watchdog actual wait was 0
with both pipe EOFs. Original logs were regular files closed after wait, so no
pipe EOF is claimed for them. Recorded runtime PIDs were absent and assigned
ports closed at audit. No boxes were created: ID/expiry null, state
NOT_CREATED, stop receipt N/A. A native-state manifest records only files
actually generated; there is no claimed installed image.

The required `flock /tmp/wine-build.lock bash tools/build.sh` passed on the
shared checkout, followed by explicit output release. That build is separate
from the immutable qualified runtime above.

Next work is a separately assigned investigation of native scene stability at
the initial bind using generated fixtures/public native metadata, preserving
all limits. The original endpoint remains permanently closed; this result
does not authorize another original pipeline.
