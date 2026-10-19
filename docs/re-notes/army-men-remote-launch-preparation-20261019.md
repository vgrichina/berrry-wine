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
