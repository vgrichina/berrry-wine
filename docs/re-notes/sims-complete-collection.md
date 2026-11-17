# The Sims Complete Collection, USA four-disc original

Owner priority: Telegram 192. Exact source:
https://archive.org/details/Nova_SimsCompleteCollectionUSA .
This task uses the original release without executable patches or replacement
releases. An installer or title is not evidence of household gameplay.

The initial tree inspection found no Sims registration in `lib/apps.js` and
no local Sims media beyond the coordinator's metadata and incomplete Disc 1
download. SimGolf's `Themes/The_Sims` character files are unrelated game media.
The coordinator owns Disc 1 and metadata until checksum verification/release;
this worker acquires Discs 2–4 sequentially without reading incomplete archives.

Archive paths are outside the evidence directory:
`test/binaries/sims-complete-collection/archives/DiscN.7z`.
Archive metadata supplies these compressed identities:

| Disc | Bytes | SHA-1 |
| --- | ---: | --- |
| 1 | 664917452 | 61cf61a35956e4eb8ba28c439e24760ceb6ffcbb |
| 2 | 798220930 | 0f9465d6a82a8f053d274b2d26be42f634bf3e34 |
| 3 | 797906181 | 4ec719cd059a6db5d6e43c79c0c91df4f7e6ff1a |
| 4 | 318652966 | 0fb540412f0109a8d1e3d635fb7139f7dd36661e |

Recovery uses the item download endpoint followed by the URL-encoded name
`Sims, The - Complete Collection (USA) (Disc N).7z`, checks the size/SHA-1
above, and records a local SHA-256. Download to a unique `.part`, then rename
only after verification. Extract one verified archive at a time with `7z x`
into `test/binaries/sims-complete-collection/discs/DiscN/`; preserve original
archives and enforce the 1.5 GB `/home` free-space floor. Do not download
artwork, reviews, or other compilations. Exact local identities and actual
commands belong in `scratch/runs/20261115-sims-complete-original/`.

Existing ordinary launch support includes `lib/media-cli.js` CUE/BIN media
analysis, `test/run.js --media-mount` mounting, `--overlay-dir` persistent
writes, and `--spawn-processes` real installer children. No registration or
engine change is justified before observing the original installer.

The finite controller derives the released TriPeaks transport with a separate
Sims policy. One personally reviewed complete bootstrap binds one permanent
native consumer identity. Menus expire after 30 seconds and gameplay after
five. Every 80–1500 ms gesture prearms independent UP at 1750 ms. No captures
occur before release and completion; UNKNOWN is permanent with no replay or
rebind. A serial prompt is an explicit boundary, never a guessed key or bypass.
Loading, live household, Sim selection, and action result need separate later
personal full-scene reviews. An ACK cannot establish any of them. The final
180 seconds are irreversibly reserved for native Quit.

Disc 1 was released by the coordinator after a successful download wait and
Archive SHA-1 match. Local SHA-256 is
`809f411e41bdb76fba0b03570d9bbb960b116a85a30c68d1e8f4c8157f9d4a49`.
The 788886672-byte raw BIN has SHA-1
`ee06e665e002a64dc73d9ba2550537c64c3ef613` (the item's uncompressed image
identity), SHA-256
`298dedb913aa31d71d38adc984892f07908910ed0f7ca4a30498725dc49b041a`.
Its CUE describes one MODE1/2352 data track with no audio tracks. The ordinary
parser sees volume `THESIMS_COMPLETE`, 308 files, and autorun `D:\Start.exe`.

The actual installer is `D:\Setup\Setup.exe`, 168448 bytes, SHA-256
`fe95a9fc8b2cdb5add76fbd326b1a11801eaa43c7d908f20cbdf413fd4d8dfde`.
`setup.ini` identifies “The Sims Complete”, product GUID
`F2527115-B8BF-4FDB-B5DA-5AADFB7C13E1`, default language 0009, and choices
0009/000A. The cabinet header lists InstallShield 6 and 5336 nonempty file
descriptors totaling 3165766129 expanded bytes; this is a static catalog,
not proof of an installed tree. No cabinet installation/extraction substitute
has been used. The real bootstrap imports VERSION, KERNEL32, USER32, GDI32,
ADVAPI32, OLE32, OLEAUT32 and COMCTL32 ordinal 17. `iKernel.ex_` is MsLZ;
static decompression yields the original 614532-byte `iKernel.exe` for import
inspection only. Its bytes have not been launched independently.

Static bounded range inspection of cabinet descriptor 915 read only the
3613163 compressed bytes for `Sims.exe` from Disc 1's `data2.cab`, at offset
134916167. The resulting 4422663-byte original matches the descriptor MD5
`27eb5b741b5643470cb256b3cfbb3ac4`, SHA-256
`32341a3496b105bccc7641b7842f80e9a93ec002c88895d7a0ed6c87d4bdfeee`.
It is retained under `static/Disc1/Sims.exe` for identity/import inspection;
it is neither installed nor authorized as a substitute launch tree. Its
small import table names KERNEL32, ADVAPI32, GDI32, USER32, VERSION, SHELL32,
OLE32, WINMM and IMM32, primarily bootstrap entry points. The complete live
game API profile is unknown until ordinary startup actually reaches it.

Earlier `anachronox-demo.md` and `tools/is-cab.js` describe unsupported IS6
out-of-process COM activation. That is a hypothesis for this release until
its ordinary original run demonstrates the first failure. Do not bypass it
by unpacking the game and fabricating registry state.

After personally verifying actual Q3 latency and Klotski process waits,
both EOF, absent PIDs and source/runtime releases, validation passes 24 policy,
eleven real HTTP fault and thirteen actual CLI controls. Actual Notepad EDIT
fixtures demonstrate pointer dispatch to the native child, unchanged hover
caret, visible selection movement, native menu opening, identity-loss closure,
late ACK, missing ACK/UNKNOWN, parent death and independent UP. These fixtures
are not original Sims execution or gameplay evidence.

The first CLI qualification failed five positive post-action capture checks:
the new pending-gesture guard misclassified `last-intent.json`, a bookkeeping
summary, as an unresolved physical intent. The guard now excludes that summary
and the binding intent; a focused regression verifies capture after completed
UP while another verifies refusal during an unresolved physical gesture. All
thirteen actual CLI controls pass on retest. Failed logs are retained. No
original was used to discover or retry this controller defect.

The full locked build passes. Controller publication on main was
`b2be3338631c40fb68bdb1bc4515b1d4de440fa0`, with strict pull/push both 0,
before the single original attempt. All four compressed archives and four
raw BINs have now been verified. The remaining archive SHA-256 values are:

| Disc | Archive SHA-256 | Raw BIN SHA-256 |
| --- | --- | --- |
| 2 | 8383c8eab1bf19a3415a383ac7d1594d573835c5d8ee1fc6c6c877136fd025e9 | c5f8c47cc608f2ef01fe086615080033f2989bee07fc62751d5e27f74c461ec4 |
| 3 | 6f75eeb48156c63b5430534ebae47aee48e7d4cd50bfcd1e02ec1db0c47e03ca | f6c6e3e97d55658e618e875420d12fb9c6369ec6d7b6487c83ce09e64680b597 |
| 4 | bdfa703a34cf6d60cf1495a400b548c88182cf63d7d0b9dea6d9f497b8f035a0 | e8c24e5bb4658b5344cbfb8540afd625208327216e681cd312e597526e1b9479 |

Disc 2/3 raw images are each 800112768 bytes; Disc 4 is 323703408 bytes.
All raw SHA-1s match the item description. CUE sizes, hashes, exact absolute
paths and download URLs are recorded in `acquisition.json`. Acquisition used
no artwork or other compilation. Archives and extracted originals remain
outside the run. Final `/home` free space exceeded 6 GB.

One supervised original attempt targeted `D:\Setup\Setup.exe`, using the
existing CUE/BIN media mount, real installer child-process support, an empty
ordinary writable overlay, real ticks, default batch size, 900-second native
bound, independent prearmed 920-second watchdog, and final 180-second native
Quit reserve. No installation files or registry values were fabricated.

The first demonstrated failure occurs **before installer entry/UI**, while
initializing the automatically loaded local Win98 `COMCTL32.dll`:

```text
DLL: comctl32.dll at 0x52c000, DllMain=0x5461cd
DllMain trapped: Missing NE image COMMCTRL
crash EIP=0x5585d2 ESP=0x74fffcc EAX=0x0
yield=18 halt=3
Error: DLL initializer did not return: module=0x52c000
```

The exact request is `ThunkConnect32`, LS01/LB01, checksum 7834, data export
`Cctl1632_ThunkData16`, companion `commctrl.dll`, source `comctl32.dll`,
reason 1, QT offset 36, FT offset 68. The loader's normal NE source resolver
cannot find the original companion. A full existing local binary-tree search
found no `COMMCTRL.DLL`. The real 577808-byte COMCTL32 has SHA-256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`.
The other loaded PE was 598288-byte OLEAUT32, SHA-256
`baeb2f7c1b8be56738d34e1d1ddf8e0eebd3a633215dc1575e14656be38b939d`.

`lib/ne-guest-bridge.js` additionally has an explicit closed prerequisite
after companion inspection: native connection lifetime and FT prolog are
required before LS relay publication. That later guard was **not executed**
in this run. Supplying a random alternate COMCTL32, forcing DllMain success,
or skipping the native initializer would not establish real thunk behavior.
No emulator repair, source adoption, native DLL substitution, original retry,
or bypass was made. The foreign NE/thunk WIP remains unchanged. The earlier
InstallShield local-COM hypothesis was not reached or demonstrated.

The preflight records 3135 file pins, exact resolved PATH Node/Python, ldd and
prelaunch native mappings, media/installer/game identities, source SHA above,
and a 442951-byte Git binary patch for relevant WIP. The explicitly selected
2202536-byte canonical module has SHA-256
`f866c8a9247f51fabd296b012d5b963c51afb97fc29f786b22798c39d4e2cff0`.
Postflight before source release found zero drift. No source tree, media or
WASM copy was placed in the run.

Native PID 161451 / start token 275768454 exited **1** after 0.346 seconds.
Watchdog 161450, supervisor 161376 and outer 161375 each actually waited 0
with both EOF. Launcher 161374 and all recorded runtime PIDs are absent;
`heavyReleased` is true. This is a host startup failure, not native Quit or
an installer result. No binding, input gesture, installer UI, serial prompt,
media check, household, Sim selection or action occurred. Serial and media
requirements therefore remain unknown. The overlay is empty.

The process exited before live host mapping inspection; that check captured
zero rows and establishes no actual mapping coverage. The prelaunch map pins
do not fill this gap. `--png` was not reached, so there are zero screenshots
and no visual review claim. These missing proofs are explicit in the run
result. No box was created: ID/expiry/stop receipt are null, state NOT_CREATED.
Source/runtime/build were released to the next assigned worker after actual
waits and zero-drift verification. This single task stops after publication.
