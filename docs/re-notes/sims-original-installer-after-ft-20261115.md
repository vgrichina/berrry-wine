# Original Sims installer after native FT — 2026-11-15

The authorized target remains the owner's ordinary four-disc Nova release,
`D:\Setup\Setup.exe`, 168448 bytes, SHA-256
`fe95a9fc8b2cdb5add76fbd326b1a11801eaa43c7d908f20cbdf413fd4d8dfde`.
Media identities and recovery remain in [the original report](sims-complete-collection.md).
No directly unpacked game executable is an installation substitute.

The [published native FT result](sims-native-ft-relay-20261115.md), feature
`fc63bbcbac4d835258b56b1642cfc52f13c98460`, proves synthetic original x86 FT
execution in local, cooperative and Worker owners. Its one untouched genuine
COMCTL32/COMMCTRL ordinary attach returned TRUE and published a native LIVE
DLL. That genuine attach made **zero FT calls**. It established neither
installer execution nor UI nor genuine FT invocation.

## Static startup and necessary bootstrap route

Setup and the statically inspected original iKernel both import COMCTL32
ordinal 17 only. The selected DLL exports `InitCommonControls` there at
original VA `0xbfc077e9`; its actual instruction is `C3` (RET).
There is no static evidence that this startup import needs QT or another
unsupported thunk direction. DllMain at original VA `0xbfc1a1cd` calls its
ordinary six-argument ThunkConnect32 wrapper at `0xbfc2c5d2`.

The generated FT bodies also exist: the indirect relay pointer is at
`0xbfc3503a`, FT_Exit24/20 at `0xbfc3511b`/`0xbfc351a8`, and the FT_Thunk
import wrapper at `0xbfc64b42`. They reference the separate SMapLS/SUnMapLS
helpers. Their presence does not establish execution during original startup;
the previously successful genuine attach executed none of these FT bodies.
Unsupported helpers and directions must retain their guards until a concrete
ordinary call demonstrates a prerequisite.

The former CLI's explicit `--vfs-mount` pass ran after PE DLL initialization.
Consequently that option could not supply a system companion requested by
COMCTL32 DllMain. The change makes those explicit inputs
available before ordinary initialization, while retaining the final override
pass for app manifests. The normal VFS DLL resolver then sees the unchanged
original companion under its documented installed name:

```text
--vfs-mount=test/binaries/sims-native-common-controls/kommctrl.dll=C:\Windows\System\COMMCTRL.DLL
```

This is the original SUBASE.INF `commctrl.dll, kommctrl.dll, kommctrl.dll`
installed-name mapping, documented in [the common-controls source note](sims-native-common-controls-thunk-20261115.md).
The selected COMCTL32 stays version 5.80.2614.3600/SHA `28a41e6a...`;
the companion stays version 4.10.0.1998/SHA `39bbfafa...`. No header, version,
export or executable bytes are changed, and no installation registry is fabricated.

## Qualification and original-attempt status

Evidence is in `scratch/runs/20261115-sims-original-installer-after-ft/`.
The prepared controller caps holds at 1400 ms, retains independent UP at
1750 ms, and treats ordinary installer cancellation as a final native choice
without requesting an automatic post-choice capture. Actual exit still needs
the matching native wait; an input ACK never proves native Quit.

Fresh qualification passed 24 policy, 12 HTTP transport, 13 actual CLI UI-control
and three ordinary native bootstrap controls. The bootstrap positive performs
an actual DllMain file read; absent and wrong bytes keep initialization failed.
The UI controls cover native pointer/menu delivery, timely independent release,
late/lost ACK, identity change, cancellation, parent/child death and no capture
while held. They execute public fixtures, not the original installer.

All 20 fresh FT/LS32/NE/lifecycle/GDI/native-Quit regression suites passed.
Both the unmodified shared-tree full locked build and the complete committed
HEAD plus whole owned feature full locked build passed. Qualification uses the
latter module/source view; it reads unrelated tracked code and metadata from Git
without editing or adopting the released operation-5/data-span/census WIP.
The qualification closure names 180 actual waits with both EOF and verifies
188 PIDs/groups absent. One deliberately orphaned release wait and historical
outer/ancillary EOF remain UNKNOWN. An initial UI qualification invocation used
a relative evidence path that broke Node preload resolution; it was stopped,
and the corrected absolute-path invocation passed all 13 controls.

The one authorized original attempt remains unused before publication and
fresh launch pins. It will use real ticks, default registered scheduling,
900 native seconds, an independent 920-second watchdog and the final 180-second
Quit reserve. Current complete scenes require personal review before finite
ordinary controls. Any UNKNOWN closes further observation/input permanently;
only independent host teardown remains allowed. No installer UI, installation,
original FT call or household gameplay is claimed by these qualifications.
