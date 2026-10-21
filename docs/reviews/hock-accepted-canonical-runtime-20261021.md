# Exact reviewed Hock canonical build and original startup — 2026-10-21

Canonical `bash tools/build.sh` PASSED on exact reviewed main
`7e5cf3535946e0a7bf42179b728a8471dc9f6b67` (Boat cmd_4cppep49fgrz, exit 0).
No source delta or registration patch was applied. Source tree is
`934a1ecde8ab26582e5dfc0b911f2ea2dc96adae`; all 7,132 tracked blobs were
independently verified against Git. Preliminary manifest/fragments, 401 unchanged
callback boundaries, 267 owners, and A/W census passed; every canonical build gate
then passed. No census refresh or bypass.

Canonical module SHA256: `7ebd28d0ee057c6aec01be9775b456726113083f2e76a4dd9767bb93e2a0b2bd`
(1,878,073 bytes). Compat module SHA256:
`1e5bd9c2b8dab82394cbacd77140ae236bbd22c40716b3ac19bf164bc9cba891`.
Node v24.18.1, headless JS raster canvas, default 4 CPU / 8 GB Boat.

The original BBLOOGIE.EXE executed, created the titled game window and called
ShowWindow. The first 200-batch capture and a second 30-second / 138,161-batch
capture are both solid teal, 640×480. Both were visually inspected. The longer
run made 86,305,741 API calls and stopped at EIP 0x00406856. Harness exit 0 does
not establish successful startup. No usable menu, ordinary input, gameplay or
audio acceptance; no input was injected because startup never reached controls.

A bounded 250-batch diagnostic with trace only at batches 73–74 identifies the
first observable blocker: repeated GetWindowPlacement → GetWindowRect →
GetClientRect → SetWindowPlacement → GetClientRect. GetWindowRect returns
{l=358,t=0,r=358,b=480} (zero width), while GetClientRect returns
{l=0,t=0,r=632,b=434}. Return PCs include 0x0040682e, 0x0040683a,
0x00406856, 0x0040690d, 0x00406919. This identifies a placement/convergence
failure requiring coordinator-assigned investigation; it does not prove a
specific source-level cause. No source repair was attempted.

The harness also warns comctl32.dll is absent from gitignored test/binaries/dlls;
no missing-ordinal trap occurred in these runs. It is not established as the cause
of this placement loop. Original support assets are all present and verified:
39 files / 2,224,918 bytes, including SOS9502.DLL, BBLOOGIE.000 and 36 AIF files.
Archive SHA256 e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b;
EXE SHA256 974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4.

## Recovery and handoff

SAME box `bx_3f3x23m3` remains running (API state idle, health ok), TTL
2026-10-21T05:56:19.894Z. Remote root:
`/home/user/hock-accepted-canonical-runtime` contains repo, build outputs,
node_modules, original intake and all logs/screenshots. No lifecycle action was
issued. Coordinator exclusively owns lifecycle and any repair/retest assignment.

Rebuild: `cd /home/user/hock-accepted-canonical-runtime/repo && bash tools/build.sh`.
Recover original bytes with retained `remote-evidence/intake/recover.py` in a fresh
remote intake directory. Compare every hash with package-seals.json. Exact source
is recoverable from main revision above; install its lockfile with `npm ci`.
No SSH credentials or secrets were copied; runtime used Boat exec API only.

Reproduce startup from remote repo:

```sh
timeout 45s node test/run.js --no-build --exe=../intake/game/BBLOOGIE.EXE --exe-guest-path='C:\BBLOOGIE.EXE' --cwd='C:\' --vfs-include='**/*' --quiet-api --max-seconds=30 --max-batches=1000000 --png=../startup-bounded.png
```

The evidence archive contains full source/package seals, empty tested.patch,
build/dependency/run/diagnostic logs, three actual captures, module hashes and
recovery/sealing scripts. Local command receipts and exact command text are in
the run folder. No original binaries, dependencies or compiled modules are copied
locally or committed. Screenshot evidence proves the startup blocker only.
