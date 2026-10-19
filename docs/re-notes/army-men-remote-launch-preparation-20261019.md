# Army Men installed-game remote preparation

No remote transfer or game run occurred. Root reported Boat push rejected
403 `api_key_action_forbidden` because the key cannot perform SSH. Army did
not attempt push/scp/SSH or encode original binaries through another route.
All433 installed-state VFS files and the original exported registry remain
missing from the intended remote Army directory. Source/control scripts can
use normal Git, but this does not transport ignored originals. An authorized
ordinary file route and a fresh root runtime grant are still prerequisites.

The proposed sandbox is `bx_z8xgsuxz`, scheduled expiry00:57UTC. Dungeon Siege
owns its sole runtime until release. Its `/home/user/wa-toolhelp-validation`
and `/home/user/toolhelp-input` are separate; Army's proposed destination is
`/home/user/army-men-installed-20261019`. Nothing in those remote locations
was overwritten, and no remote build/browser/public hosting was attempted.

## Exact local bundle

Plain staging directory `/home/user/army-men-remote-stage-20261019` contains
1588 sealed files totaling138,321,151 bytes, plus transfer-manifest.json.
Manifest SHA-256:
`30292d621253080a88c97b047f97483cc3cbcdd2ffed2827e8d891f3fc11edac`.
This is a **prospective transfer identity**, not a successful transfer receipt.

The bundle includes1121 physical runtime source/font/tool files from root
`3c791a0231267d4bd5a2db3160ad830c40a869da`, canonical wasm
`93818216116a49fbc2b52074a80254d5f8aebdef753b7f22b34d90be84c323c6`,
pngjs dependency, all433 exported VFS files, exported registry, actual parsed
shortcut/installation/root-review receipts, source identity and new controller.
Every VFS path was independently rehashed against the installed-run artifact
seal before preparation. Originals are hardlinked into the staging directory;
cross-filesystem runtime sources/module cost about47.4MB of additional local
storage, plus small dependency/metadata overhead. No fixture bytes changed.
Remote prospective file cost is138.4MB plus filesystem overhead,256MiB output
budget and512MiB admission buffer. Exact remote headroom must be refreshed.

Evidence: `scratch/runs/20261019-army-men-remote-preparation/` contains
preparation.json and the complete transfer-manifest.json. The installed state
remains independently recoverable in the prior installed-run final-vfs and
registry; Git contains recipes/control source, not these ignored binaries.

## Ready command, conditional on authorized transfer and root grant

```
node /home/user/army-men-installed-20261019/controller.js \
  /home/user/army-men-installed-20261019 \
  /home/user/army-men-gameplay-run-20261019 --root-runtime-granted
```

Controller source: `tools/army-men-installed-remote-run.js`. It verifies the
whole bundle and installed EXE before launch, parses the actual installed
shortcut using production parser, then uses its original target, cwd and empty
arguments. Guest target is
`C:\Program Files\The 3DO Company\Army Men Demo\ArmyMenDemo.exe`.
The complete actual exported VFS/registry accompanies it. No guessed registry,
raw-source direct-launch shortcut, binary patch or installer bypass is used.

Finish was not clicked in the successful installer run. Installed files,
shortcut and App Paths agree; absence of observed Finish is not itself a
reason to replay the installer. Keep post-Finish cleanup unproved and only
revisit setup if an actual missing-state failure demonstrates a need.

The controller uses explicit canonical wasm, no build, cooperative CLI,
60s guest/75s soft/90s hard group deadline,4MiB log,256MiB output limit,
512MiB admission buffer, admission free minus768MiB above2,281,701,376 and
original hard stop2,214,592,512. HTTP controls are private port8143. Capture
before/after input with ordinary ctl click/key commands; no automatic menu
coordinates. Stop first failure. If menu appears, inspect it and select
normal Boot Camp as the original readme recommends. Re-observe its briefing
and any subsequent controls before proceeding. If playable, record a baseline,
hold/release Numpad8 movement, then a distinct Space/left-mouse aim/fire action
as documented, with delivered-input receipts and reviewed gameplay frames.
No menu, cinematic, static scene or time-based animation alone proves control.
Stay within the single allocation; a missing menu or deadline is not a retry
authorization. Save actual module/source/fixture pins and process-group absence.

Validation so far is source syntax, diff checks, all433 state hashes and
bundle identity. The remote controller has not run, dependencies are not
runtime-qualified on that host, and no gameplay/frame-rate/audio claim follows.

## Independently authorized public-source alternative

Root explicitly permits fresh acquisition from the same public HTTPS archive
using the retained original recovery hashes. This does not retry SSH transfer
or transmit local ignored files. The tracked
`docs/re-notes/army-men-original-payload-hashes.json` contains only the187
original file identities. `tools/recover-army-men-authorized.js` now accepts
that manifest as an optional fourth CLI argument. After a separate root
acquisition/runtime grant, an ordinary Git checkout of this source recipe can
run, on the remote host:

```
node tools/recover-army-men-authorized.js /home/user \
  /home/user/army-men-fresh-public-original-20261019 \
  /home/user/ARMY_RECIPE_CHECKOUT/docs/re-notes/army-men-original-payload-hashes.json
```

Replace the recipe checkout path with its actual ordinary Git clone location.
The recovery takes exactly the18,373,265-byte pinned public ZIP, retains its
18,418,688-byte wrapper, extracts43,721,065 payload bytes and checks all187
hashes. No installer runs in acquisition. Approximate original retention cost
is81MB plus filesystem overhead. A fresh30s bootstrap and90s ordinary
installer stage would then produce the authentic installed state remotely,
about250MB cumulative state before optional redundant captures, under the
same disk/output guards. Their current local controllers require porting and
review before remote use; this is a plan, not an executable remote install
claim. Never substitute source-directory game launch for normal setup.

The emulator source must be an independent exact3c791a023 checkout, not the
Dungeon Siege candidate branch. Build only after a fresh root grant, using
normal vendored build; require the resulting canonical SHA93818216 as pinned
above before game execution. No ignored wasm bytes are encoded or transferred.
DS owns runtime until release. Then freshly generated installation/shortcut
identities replace the local transfer-manifest in a reviewed game controller.

Preferred fast route remains the already verified local installed state if
disk headroom recovers: fresh source-time free3,020,328,960 was66,678,784 below
the3,087,007,744 admission including256MiB output and512MiB transient buffer.
No floor or output reserve was reduced to force admission. Otherwise the
public-source remote route is reproducible with extra acquisition/bootstrap/
installation work. Neither route has started a game or new installer run.

## Source identity correction before first game launch

Local CLI preflight stopped before creating its output directory or spawning
a guest: the bundle's authentically captured rootHead is
`bfb1be4a9dd79bd095e0479abae8d3ec6f5ec83a`, while the proposed controller
asserted3c791a023. The staging script captured current HEAD dynamically at
00:29:48; the later preparation.json and notes incorrectly hardcoded the
requested3c identity. Bundle identity and manifest were not modified: original
manifestSHA30292d62 remains exact and all pinned bytes pass verification.
Git comparison shows bfb1 differs3c only in TODOS.md and ops/STATUS.md.
Independent byte comparison of all1121 bundled runtime files against3c Git
blobs found zero differences. Module93818216 and433 original state files
remain exact. Thus source bytes match the intended3c runtime, while the
actual captured metadata commit is bfb1. Preserve both distinctions.

The no-spawn failure and correction are recorded separately in
`scratch/runs/20261019-army-men-local-preflight-identity/review.json`.
Do not rewrite the sealed bundle or historical receipt to hide this failure.

## Preguest missing helper and repaired immutable v2 bundle

After root reviewed the identity comparison, one local CLI allocation passed
fresh admission and spawned PID2759317 at00:34:03. It exited1 before loading
the guest: `Cannot find module './runner-experiment-report'`, required by
runner-experiments.js. No original game code or input ran, so this is a bundle
closure defect, not a game compatibility failure. Minfree3,018,174,464,
no guard, all old bundle pins unchanged, process group absent. Evidence
`scratch/runs/20261019-army-men-installed-local-observe/` retains exact
controller, pre/postflight, full failure log and review/artifact seal.

Root authorized source-only repair. The old immutable bundle remains exact.
New `/home/user/army-men-local-stage-v2-20261019` contains1593 files,
138,372,795 bytes plus transfer manifest, SHA-256
`4dbe716634a95041a7f0e6039bb599fcd32f337dd44cad73460fd0767d82e72d`.
All433 original state files/registry/shortcut remain unchanged. Shared files
are hardlinks; added source/metadata is small. Runtime source files now1124:
the original1121 plus exact bfb1 tracked runner-experiment-report.js,
runner-win-census.js and compile-src.js. Static boot seed
`test/binaries/tlbs/stdole2.tlb` was also missing; it is now linked from the
same verified `state/vfs/windows/system/stdole2.tlb`, without changing bytes.
Identity remains authentic bfb1, wasm93818216.

`tools/check-army-men-runtime-bundle.js` performs source-only module-resolution
and syntax checks without requiring run.js or compiling/running a guest.
The recursive literal-require closure has95 files; all resolve and parse.
Known dynamic/static checks cover39 paths: win16 ordinal JSON, API signatures,
wasm, system typelib, bitmap fonts and scalable font substitutions. Dynamic
media modules are already in lib; WINE_REGION_MAP override is cleared by the
controller. Optional headlessGL GLFW/WebGL packages and skia-canvas remain
absent: only explicitly requested GPU or app decodeImage paths use them;
this ordinary software CLI/EXE route requests neither. No GPU qualification.
Negative preflight on the old bundle correctly reports the three missing
runner helpers and typelib. Positive v2 has zero required failures.

The new `tools/army-men-installed-local-observe.js` requires that preflight
again before spawning. Per root's observation grant, output reserve is64MiB,
plus512MiB admission buffer, original hardstop2,214,592,512 and60/75/90s,
4MiB log. It omits finalVFS/captured-handoff exports because all433 original
input files are already retained; PNGs/input/log/registry suffice for first
observation. No output-budget reduction changes the original disk floor.
New ready command, **not run; a new root grant is required**:

```
node /home/user/army-men-local-stage-v2-20261019/controller.js \
  /home/user/army-men-local-stage-v2-20261019 \
  /home/user/wine-assembly/scratch/runs/20261019-army-men-installed-local-v2 \
  --root-runtime-granted
```

Source preflight results, exact v2 manifest and provenance correction are in
`scratch/runs/20261019-army-men-local-preflight-identity/`. Original failed
bundle/runtime evidence is preserved. No retry or game result is claimed.

## v2 first original game startup: native fixture missing

Root granted one v2 allocation after seal/conflict/admission checks. Original
PE entry0046fee0 loaded, original smackw32 DLL initialized, real installed
cwd/registry mounted, then batch0 trapped on **MFC42.DLL ordinal1168**:
IAT0066d8c0, EIP0046fa54, return004703be. Exit1, no guard, minimum free
3,014,184,960, all1593 bundle pins unchanged, owned group absent. No screenshot,
menu or input occurred. Log also identified native comctl32/ole32/msvcrt absent.
This is native-fixture provisioning, not a reason to stub the MFC ordinal.

Production test/run.js searches EXE/dlls, EXE directory, sibling Shared_DLLs,
then runtime/test/binaries/dlls when building the initial native PE graph.
It does **not** search mounted `C:\Windows\System` at that stage. The original
Army package already includes the matching MFC42/CRT pair, and setup copied
them into the433-file exported state; their presence in guest VFS alone did
not satisfy this physical-host discovery. Do not replace them with a newer
VC6 MFC/CRT pair from shared fixtures.

Root authorized immutable source/fixture preparation only. New local stage
`/home/user/army-men-local-stage-v3-20261019` has1599 sealed files,
140,978,265 bytes plus manifest, SHA-256
`8bba6c008ed0234c80dda912d6e5d4cadbe18b0ddba3ace98d347a3f27087bbc`.
All old bundles and433 original state files remain unchanged. Four hardlinked
physical native fixtures (2,600,752 bytes) now occupy the existing loader's
runtime/test/binaries/dlls discovery location; no guest state or source fix.

| DLL | Bytes | SHA-256 and provenance |
| --- | ---: | --- |
| mfc42.dll | 954640 | `73b4b8b26b9632d67fd0d5f631326cfe54fb0d00959423eb616adfb8001b0717`; original Army `DLLs/MFC42.DLL`, exact installed system copy |
| msvcrt.dll | 277776 | `befb0220cffdb1a440ab6b7b94638ea659a5e44cba615186eb8464dec1675e5e`; original Army `DLLs/MSVCRT.DLL`, exact installed system copy |
| comctl32.dll | 577808 | `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`; existing VC6 redistributable fixture documented in test/binaries/dlls/SOURCES.md |
| ole32.dll | 790528 | `bb487eb6c5ade54d5ae0352f75cec84b4f1cbbb8d9fca5b3718d813b4a0c938d`; existing local Explorer98 fixture4.71.2900 referenced in black-white-2 re-notes; exact archive extraction not independently reconstructed, local use only |

New source-only `check-army-men-native-fixtures.js` uses the production graph
resolver/import detector and same physical search order. It finds exactly
five real DLLs: these four and original installed smackw32, with **zero missing
native transitive dependencies**. Remaining imports are registry-designated
WAT system modules. oleaut32 was audited but is not in this graph and was not
added. MFC ordinal1168 has a real nonzero export RVA4227 (base1/count6466).
Both MFC and CRT selected bytes are checked against exact original system
copies. The local controller now requires source and native preflight before
spawning. Source95-module/39-static checks still pass. These checks execute
no guest and make no native-DllMain or gameplay claim.

Evidence `scratch/runs/20261019-army-men-installed-local-v2/` retains full
batch0 failure, physical pin/guard/cleanup receipts, native audit, v3 graph
and source preflight, v3 manifest/ready receipt, review and artifact seal.
Proposed ready command uses v3/controller.js with v3 bundle and a new
`scratch/runs/20261019-army-men-installed-local-v3` output directory; same
60/75/90s,64MiB outputs,512MiB admission buffer and original hard floor.
**No retry has run; fresh root grant/admission are required.** Finish remains
unobserved and original setup/game qualification distinctions remain intact.

## v3 bounded original startup: CPUINF32 clock-port polling

Root subsequently granted one v3 run, retained as
`scratch/runs/20261019-army-men-installed-local-v3`. All five native DLLs
initialized successfully. ArmyMen created a 640x480 window, but first/later/final
images are identical uniformly white (SHA-256
`05ccd0e84bdfb1fcee0ea5f6ad413c5a808e6847e3c46982457ec09f6ff9b680`).
No menu appeared and no game input was sent. Normal 60-second bound stopped at
5598 batches, exit0, no guard, minimum free2,946,252,800; all1599 pins unchanged
and owned process group absent. This is startup-blocked, not gameplay success.
Finish remains unobserved. Original accepted licence remains independently true.

Both snapshots and final log sample EIP`0x0111cda1`, EAX`0xff`. This maps to
original `CPUINF32.dll` (19968 bytes, SHA-256
`5e7f97ecbb834822a9913124f181c1e82ffbda6a7c13f2deb1f963c09383f31e`),
whose only staged duplicates are original armymen/dlls and installed system
copies. Its PE entry RVA2150 plus logged dynamic DllMain111d150 gives loaded
base111b000, also logged EBX; preferred base10000000 maps the sampled instruction
to original VA10001da1. This is triangulated identity, not an explicitly named
dynamic-load log entry.

Saved disassembly shows helper10001ccc writes zero to port70 then reads port71.
Calibration10001d33 saves that value, polls until it changes, then samples RDTSC.
Sample10001da1 compares the polled value with the baseline. Pinned
`src/06b-core-handlers.wat` `$th_port_io` ignores OUT70 and returns floating-high
FF for IN71: only PIT/speaker/VGA/PCI ports are implemented. Thus this loop has
no advancing clock value. The logged FF supports the source explanation; no
direct stack-memory capture was taken. Worker T1 was waiting on handle2, but
the main thread's sampled hot loop identifies an independent concrete blocker.

Evidence includes disassembly, pinned port handler, snapshots, log, all images,
review and artifact seal. Next source work is real CMOS index/data RTC behavior
using the existing emulated calendar/timezone policy, with focused fixtures and
RDTSC calibration-unit review. No game patch, skipped calibration, random input,
longer identical run, or automatic retry is justified.
