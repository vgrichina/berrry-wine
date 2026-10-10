# Carmageddon TDR2000 Alpha Test Demo

## Source preparation, 2026-10-07

New-game lane `NEW-GAME-TDR2000-DEMO-20261007`. This is a different title from
qualified Carmageddon2. No TDR2000 gameplay/run evidence was found in the retained
exact-title run/docs/task searches. The video-support design names its AVIFile
imports; that is not a gameplay result. Current main19b1a10c has no registration.
Public apps.js fetched2026-10-07T12:07:15Z, SHA256
`c8cb758ab7e73b9270f626becbdb57c54919f753e3aa3b24c0dad73f86fcd8d0`, also has
no TDR2000 entry. No deployment or gameplay qualification is implied.

Original media lives in `test/binaries/win98-games-a-d/Carmageddon TDR2000 demo-D3D`.
The publisher readme calls it an **Alpha Test Demo**, not the later retail game:
a four-minute drive in the Eagle. The additional `README FIRST!!!!.txt` identifies
this as the first alpha demo redistributed by Carmageddon City/Toxic Ragers.

The loose directory is not a complete installed tree. Its original InstallShield
cabinet lists2,961 members totaling203,099,877 decoded bytes, all under
`Program Executable Files`. The runtime subset excluding seven DirectX installer
prerequisites is2,954 members/195,070,449bytes. It includes the36,864-byte
`TDRLauncher.exe`,352,256-byte`Mss32.dll`, gameEXE and complete nested Assets tree.
7z cannot list this InstallShield format. Retained unshield1.4.2 lists it without
extraction; no payload was extracted in this preparation.

Loose `Tdr2000Demo.exe` SHA256
`8b15bee96560f31d447757067c7eaca90163a57c61b9436a6fd564453189ded4`, imagebase400000.
Imports DDRAW,DSOUND,DINPUT,Mss32,AVIFIL32,WINMM and ordinary Windows libraries.
The cabinet supplies twelve Miles `.m3d` providers under Assets/Sound/Miles.

## Original installer overlays matter

`setup.ins` has explicit string pairs for copying loose files after cabinet data:

- offset1217/122f: DemoSplashScreens.txt → assets/DemoSplashScreens.txt.
- offset12b7: `*.tga` → empty relative destination (root); preserve the literal
  script evidence rather than invent a directory.
- offset135b/136d: Tdr2000Demo.exe → Tdr2000Demo.exe.
- offset1440/145c and subsequent pairs: the four loose tow_meister Descriptor,
  Null.h,Null.pak,Null.dir files → Assets/Cars/tow_meister/ matching basenames.
- readme.txt is copied to root. Later script references the cabinet Null_1
  triplet; its operation is not yet fully decoded and must not be described as
  authenticated deletion/renaming. Preserve those originals pending resolution.

The loose descriptor names Null.hie and Null.h. An extraction-only registration
would miss these explicit overlays, the splash script and nine TGA screens.
No overlay bytes should be synthesized. Future materialization may hardlink
original loose files after retaining cabinet hash/size and mapping receipts.

## Faithful ordinary route

Read the actual extracted launcher first to determine direct game entry versus
original launcher settings; do not force guessed registry/config values. The
readme says launcher defaults to **Direct3D** and explicitly says not to switch
this demo to software rendering. Start with detected defaults (640x48016-bit is
the documented supported minimum); inspect actual dialogs before clicking.
The splash script defines five intro screens, six seconds each, and four outro
screens. Do not count splash or launcher output as gameplay.

Once the actual world/car/HUD appears, capture before/after normal Up acceleration,
Left/Right steering and Down brake/reverse; hold/release keys with timestamps and
finally-release cleanup. Return/Insert recovers the car; Space is handbrake.
Those controls are documented, not yet exercised. Use scene gates; no guest
setters, skipped callbacks, injected save state or menu-only qualification.

## Next serialized resource request

First selective extraction/authentication into one private installed tree, with
original CAB source hash before/after, bounded decoded sizes and every output
path/hash. Exclude DirectX installer support from runtime mounts, preserve asset
subdirectories/case and original loose overlays. Inspect launcher imports/config
and Assets/options.txt before final registry/helper pins. No engine/build/browser
has run. A later browser lease needs exact source/module equivalence, full
registered allowlist and ordinary startup/control evidence; budget and disk
headroom must include approximately203MB decoded original data.

Private listing, installer offset strings, public receipt and small source pins:
`scratch/wt-tdr2000-demo-20261007/scratch/tdr2000-preparation/`.

## Original extraction and launcher proof

Granted extraction completed2026-10-07T12:16:50.450Z in1.821seconds: all2,961
exact members/203,099,877bytes and each output SHA verified. CAB SHA before/after
`7e6c0693f395fb9343390c9043dcc55d2a6bd66c4f3c185ea517849ccdbb5415`; source
inode/size/mtime unchanged. Child2638611/group absent, no signals/errors or guest.
Receipt: private preparation/extraction-attempt1/receipt.json and outputs.json.

Important: CAB Tdr2000Demo.exe SHA`7958398fcec85d18b030d34c8c05e11fb6c3b4ce5f0039ad276249be78f9b149`
differs from the same-sized loose installer overlay EXE. The explicit original
setup.ins copy means the loose8b15bee9 executable is the installed final version.
Do not silently launch the cabinet binary instead.

Launcher SHA`c2e742b0be5cd8b418549f01a5d277ee5f8ce2baf4fd9874403a0e023789694b`.
Its4014b3–4014db sequence calls GetStartupInfoA then CreateProcessA with
application4051c4=`Tdr2000Demo.exe`, null commandline/security/environment/current
directory, inheritfalse and flags0. Its other path checks DirectX and offers
installation through DSETUP ordinal5. Direct game entry with no args therefore
matches the successful launch branch; do not register the DirectX installer as
though it were the game's graphics-options window. This is static launch
contract proof, not observed successful execution.

Original Assets/options.txt SHA`2671f20f6a0e09a02ba8797c5e18a858697c4f3dc8f857d513732825452270b6`
selects Eagle4, Hollowood_Race1,6CPU cars, default difficulty1 and enabled sound.
Preserve it unchanged. Network-related127.0.0.1 defaults are original options,
not an instruction to start multiplayer. Only ordinary single-player gameplay
is planned. No guessed graphics/registry override is needed for initial census.

Extractor physical directory conversion is recorded separately from original
VFS spelling: unshield changes directory spaces/<>[] to underscores even with-R.
A future installed manifest must retain original guest paths, either through
explicit physical/VFS mapping or hardlinks at original paths. Raw extraction and
DirectX prerequisite files remain preserved. No overlay/materialization has run.

The previously undecoded `_Null_1` operations are DeleteFile instructions at
setup.ins offsets0x18d0/0x197f/0x1a2e, independently matched to isDcc's opcode
0x001d. They remove the old .dir/.h/.pak from the installed view; raw cabinet
extraction remains preserved. The hardlink-only plan has2965 files/205665919
logical bytes after16 authentic loose overlays and exactly2 replacements.
`MATERIALIZATION-PLAN.md` and `.json` in the preparation directory contain
exact paths, hashes, collision rules and pending command. No materialization
or runtime has occurred as part of this source preparation.


## 2026-10-07 installed closure and current-main build

Hardlink materialization completed12:33:41.809Z:2965files,205665919logical
bytes, zero copies/errors. Each original and installed inode/device/content hash
was checked, and original cabinet/setup remained unchanged. Receipt SHA
`e006f47859a990052d1d98cfe53871bf950cc88ef295a41cb3241cbd94e8f843`.

Current-main f1de974251d36717675e976d5b7e4c368b29f91b private full build passed
all mandatory gates/compile in19.637sec on12:51:58.763Z. Production WASM
`992a8b021897e52d2ec1b5f3604f5f89098f02ee2e4748e5340ff4d960f5e880`
(1719337B), canonical layout0a82c5ae0e89dba1. Build process group and supervisor
closed; no old engine fallback. Private registration overlay only adds the
local candidate; original apps.js and public desktop membership remain intact.

Prepared browser source tests5/5 passed, covering actual registry/manifest paths,
control error precedence, pending browser acquisition cleanup, and real asset
handler HEAD/range/allowlist contracts using synthetic streams, without a server
or browser. Final served allowlist3342paths includes2990fixture records;
2963game companion entries use148required config/text files and2815known-size
lazy data files, plus explicit original EXE/Mss32. Runtime remains unexecuted
until a separate serialized browser grant; no gameplay qualification yet.


## 2026-10-07 first actual ordinary launch: IntegrityCheck failure

Private attempt1 was a harness failure: adding an app registry entry did not add
the debug dropdown option, so page.select returned empty and Notepad launched.
Its evidence is retained and says nothing about TDR compatibility. The corrected
private index adds one real option, and the driver checks both page.select's
return and actual select value before Launch;6source tests pass.

Attempt2 (driver2690350/Chrome2690380) ran13:03:55.093–13:07:44.569Z,
sourcef1de9742/module992a8b02. Original hardware test Yes displayed
`TRenderDevice_D3D::EnumCreateDevice: FAILED: IntegrityCheck`. Ordinary OK
continued to sound-settings acknowledgment and the real AlphaDemo launcher.
Ordinary Start repeated the same error; acknowledging it ended the guest. Six
reviewed screenshots include hardware-test, sound-settings (launcher),
start-result and post-start-error. No race, player control, FPS or audio
qualification. Browser/server closed, Chromeexit0, streamspending0; PIDs absent.
Request errors remain recorded (including aborted/optional ole32/auth requests);
they have not been established as causal.

Source localization on authentic loose EXE8b15bee9: literal568e70 has one raw
absolute reference at4e5b7e. Caller4e5b69 calls4e5e80, then4e5b70 accepts
nonnegativeEAX; negative chooses this exact failure. Function4e5e80 rejects
[object+840]<1, allzero820/824/828, zero count from virtual+48, or no bit0-set
entry among virtual+4c(index) results. These are four distinct possible checks;
no runtime object fields were sampled, so which failed is unknown. It is not
proof of file checksum failure, missing assets or physical GPU incapability.
Next bounded owner observation should capture this call's ECX/object fields and
actual virtual targets/results before failure, preserving original execution.
See preparation/integrity-literal-xrefs.json, integrity-caller.txt and
integrity-check.txt. No CPU/renderer fix or repeat launch authorized from this
static evidence alone.

Static refinement: producer4e5f00 populates820/824/828 from the per-stage filter
bit groups in field964; current D3D7 caps reuse fill_primcaps with filter0xFF,
which lacks every tested stage bit. This is an actionable advertisement-gap
candidate pending exact live GetCaps destination and backend filter-contract
confirmation. See ops/handoffs/tdr2000-first-launch-20261007 for bounded original
disassembly and unmodified runtime receipts. No renderer fix is yet applied.

## 2026-10-07 ordinary repaired race

Ordinary attempt3 passed hardware IntegrityCheck, then Sound Settings OK, launcher Start, intro and natural lazy loading, reaching an actual race. Root and worker reviewed loading-settled.png and forward.png: HUD0/N became15/gear1 after ArrowUp1000ms with road advancement. ArrowRight1000ms was sent but its stopped endpoint does not independently prove steering. ArrowDown1000ms produced19/R and changed car/world orientation; Space1000ms produced0/R. Forward/reverse and brake response are supported; completed race, FPS and audio quality are not qualified.

Source efb1dba0/tree de4e9522 (same as coordinator62ab2a22), full-gated module d4256f3cd6b085a4acbd8192df7e9d0de8625beb82d10060ac2f27a51d8add74. Private original registration/index overlays only, no diagnostic callbacks or forced guest state. Immutable run: scratch/wt-tdr2000-demo-20261007/scratch/tdr2000-preparation/browser/attempt3. Start13:58:21.615Z, ordinary close14:04:28.221Z; browser/server closed, Chromeexit0, streams0, driver2754631/Chrome2754670 absent. Eleven screenshots3785609B. Request errors remain (aborts/optional lookups); do not call cleanup.errors empty.

All312 complete200 responses match pinned source/original hashes;1204 partial206 and5 recorded404 retained.31 raw artifacts hashed in accompanying handoff. Server-read hashes do not establish client consumption. Earlier preflight-only failure at1.93GB created no browser/output; regrant followed disk recovery without lowering thresholds. Durable local registration/manifest is next; no public deployment.

## 2026-10-07 durable local corpus registration

The registry now points to the stable original installed tree under
`test/binaries/win98-games-a-d/Carmageddon TDR2000 demo-D3D-installed`, with
Tdr2000Demo.exe and Mss32.dll explicit. The local candidate list and selector
option expose the route locally; public DESKTOP_APPS membership is absent.
The generator excludes those explicit mounts and emits 2,963 companions:
148 TXT/INI/CFG files required, 2,815 known-size data files lazy. No original
settings or payload bytes were changed. Gameplay evidence remains commit
`2e834347` and browser/attempt3 above; this registration adds no gameplay claim.

The earlier 19:26 metadata operation matched the tested rows, but its disk
preflight failed below 2GiB and the shell continued into the metadata write.
That was a guard failure, not a successful capacity check; the earlier receipt
must not be interpreted as proving the disk floor passed. The generator now
checks available capacity immediately before each metadata write and throws
on capacity below 2GiB or an unreadable capacity probe. Regression tests mock
both failures and verify the existing manifest bytes remain unchanged.

Fresh sequential JavaScript orchestration throws on every failed disk check or
child test before any subsequent step or success receipt. Focused registration,
app-file policy, and all 11 lazy-loading checks passed; the installed generator
`--only=carmageddon_tdr2000_demo --check` passed. Exact row comparison against
the gameplay-tested preparation/browser-manifest.json passed after normalizing
only URL `./` prefixes and drive-letter case; paths, sizes and modes agree.
Available capacity was 3,399,299,072 bytes before and after the batch. Receipt:
preparation/registration-validation-fail-closed.json. The broader selector
suite fails on 20 unrelated missing local options, reproduced on unchanged HEAD;
TDR's option is asserted in the focused test. No build or browser ran.

Root must review/integrate this scoped commit into main. Any public release
still needs explicit distribution/deployment authorization and release asset
review. FPS, audio quality, independent steering proof and a completed race
remain unqualified. Future browser validation must use a separate temporary
box under the current user policy.

## 2026-10-10 CLI: the "loader stall" is the batch budget (TDR2000-LOADER-STALL)

w4's software-arm CLI run (`runs/20261010T1930Z-tdr2000-software-w4`) sat on
"TDR 2000 Alpha Test Demo is loading. Please wait..." for 3000 batches. It is
not a hang: the loader parses every car/track `.txt`/`.dir` with CRT heap work
between reads (the Enter/LeaveCriticalSection run in the API log is that
locking), and at the default `--batch-size` it was still reading
`assets\races.txt` at batch 13771. With `--batch-size=500000` it finishes by
batch ~42. No emulator change was needed.

Headless route that reaches a race on the software D3D arm (main 8918a13de):

```
node test/run.js --app=carmageddon_tdr2000_demo --batch-size=500000 \
  --max-batches=3000 --max-seconds=400 --stuck-after=1000000 --no-close \
  --quiet-api --input=60:keydown:13,62:keyup:13,100:keydown:13,102:keyup:13,\
200:mousedown:338:48,203:mouseup:338:48,800:png:race.png
```

Enter at 60 answers "Determine Hardware Capabilities" Yes (the profiling
window follows), Enter at 100 dismisses "Please verify your sound settings",
and the click is the AlphaDemo launcher's Start (dialog control 1000 at
288,13 96x26). By batch 800 the race is on: HUD, 3:45 countdown, "Starting
race: Health 100%"; by ~1450 batches (the 400 s wall cap; ~10M API calls)
it reads 2:35 with the opponents racing. `--stuck-after` must be raised or
the idle dialogs end the run and drop the later input. Evidence:
`scratch/runs/20261010T2035Z-tdr2000-loader-stall-w6`. Steering/brake
response and FPS are still not qualified.
