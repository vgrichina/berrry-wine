# Jedi Knight original demo — exact main runtime, 2026-10-21

Ordinary input now advances **Select Components → Select Program Folder →
Setup Complete**, closing the previously observed input boundary. The first
reproducible blocker is missing installed payload: both completed installations
leave only three metadata/shortcut files in the destination. Neither `Jedi.exe`
nor `JkDemo.exe` exists there. No installed game launch or player-input capture
was possible. The extracted originals at C:\ are not an installed layout and
were not used to bypass installation. No source repair or main integration occurred.

Task: `NEW-GAME-JEDI-KNIGHT-DEMO-20261015`.
Run: `scratch/runs/20261021-jedi-current-main-install-runtime`.
Tracked companion directory: [evidence and recovery](jedi-current-main-install-runtime-20261021/).

## Exact build and media

Remote source `/home/user/jedi-current-main` was freshly cloned from origin,
HEAD `fe49a84e745015ecdbe752e028235924ef4324dc`. All **7,403 tracked blobs**
were checked before bootstrap and after both installations; status is clean.
The recovered SHA-256 manifest was independently checked against all 7,403
Git blobs locally. Full checkout, build and original payload stayed remote.

`bash tools/build.sh` ran normally on the assigned box, including every cheap
canonical gate, and exited **0** at 12:54:29 UTC (API `cmd_lljttvauty1g`).
No gate bypass, source edit, census refresh or reused module was used.
`build/wine-assembly.wasm`: **1,878,508 bytes**, SHA-256
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
The full canonical log, command receipt and exit file are preserved. Production
bytes match the prior Hype module, but this run compiled them afresh.
`PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=optional` exited 0; Node v24.18.1,
Linux x64, four vCPUs. CLI raster renderer, cooperative guest threads, 640×480.

Exactly one `curl --fail --location --retry 0 --max-time 180` download fetched
`https://archive.org/download/jedi-knight/jedidemo.exe`. It was HTTP 200,
21,195,858 bytes, SHA-256
`8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.
The supplied recovery extractor validated all **39 members / 40,812,035 bytes**,
with unchanged hashes checked again after execution. No alternate package or
original-byte edits. The supplied extractor and original authorization record
are copied into the companion evidence directory; shared source files are untouched.

## Fresh bootstrap and ordinary acceptance

Bootstrap used `test/run.js --exe=/home/user/jedi-original/original/setup.exe`,
the qualified module, `--vfs-tree`, `--capture-launch`, `--save-vfs`,
`--reg-export`, `--quiet-api --quiet-blocks --no-close --no-threads`,
`--batch-size=200000 --max-batches=10000000 --max-seconds=120`.
All 34 disk-backed host support inputs were checked first. It exited 0 after
602 batches / 0.478s and produced 96 VFS files plus `launch.json`. The log retains
a caught thread-window-cleanup `unreachable` warning; the generated capture is
complete and both following children run to their own normal exit.

Actual generated launch: `c:\windows\temp\_ins0432._mp`, empty args, cwd `C:\`;
674,816-byte child SHA-256
`12a2929a615924e212490f4ef3a1cbb36ecebddafea0f358991a0fc57b7cab84`.
Both runs used the exact receipt fields, entire fresh capture, genuine INI and
end-of-bootstrap registry export. That registry is not a launch-time snapshot.
All 97 capture entries remained unchanged. The historical partial capture was
not used. Launch argv/cwd, raw logs, screenshots and terminal receipts are retained.

Ordinary acceptance is authorized separately by the 2026-10-18 user record;
that record's `acceptedInGuest=false` was not changed. This run independently
observed the licence, clicked **Yes (415,395)**, and captured **Welcome**.
Thus fresh `acceptedInGuest=true` is supported by actual input and images.
Attempt 1's acceptance is at batch 1,040,098; attempt 2 independently repeats it.

Observed route: licence Yes → Welcome Next → Install Jedi Knight Demo Next →
default 320×200 Next → default destination Next → Start Copying Files Next →
Select Components Next → default program folder Next → README No (354,277) →
Setup Complete Finish (415,395). All inputs were ordinary renderer clicks.
No forced command messages, registry fabrication, guest memory edits or held
diagnostic replay. Attempt 1 was driven after inspecting each page. Attempt 2
used the same observed clicks with expected-title checks and pre-click captures.
The relevant licence, Components, program-folder and completion images were
inspected for both runs.

Attempt 1 exited 0 at **12:57:32.053Z**, 3,519,090 batches / 96.191s; its wall
guard was 600 seconds to allow human-style image inspection. Attempt 2 exited
0 at **12:58:18.937Z**, 118,750 batches / 4.023s, guard 120 seconds. Both finish
through the actual Finish button, not controller quit or timeout. These are the
two permitted installer attempts; no third attempt is authorized by this report.
An early observation request preceded control-server startup and got
ECONNREFUSED; its receipt is preserved. It sent no guest input.

## Concrete blocker and recovery

Both saved target directories `program files/lucasarts/jedi knight demo/`
contain identical bytes for exactly these three files:

| File | Bytes |
| --- | ---: |
| `deisl1.isu` | 3,659 |
| `jedi knight demo readme.lnk` | 241 |
| `uninstall jedi knight demo.lnk` | 205 |

Neither `jedi.exe`, `jkdemo.exe`, `SysCheck.exe` nor any GOB payload was installed.
The registry nevertheless names the installed `JkDemo.exe`, `Jedi.EXE`,
`SysCheck.exe` and `Resource\Res1low.gob` paths. The installer also displayed
“0 MB” at its installation choice. The cause of omitted copies is not diagnosed.
UI completion and exit 0 do not establish a usable installation. No game startup,
player input, gameplay screenshot, browser/audio/FPS or release qualification.

`evidence.tgz`: **1,743,223 bytes**, SHA-256
`1ce029535cf7c7f6344a862c4bb71b74ba6d4c4addf18d6c0b2186ed7b376e2e`.
Recovered through API exec at 12:59:06 UTC. It contains 98 sealed evidence files
plus the seal, including both registry exports, all logs/screenshots, original
and source manifests, and 27 unique recovery payload blobs. Large duplicate
originals and complete VFS trees are intentionally omitted from this compact
archive, with every file mapped in `recovery-trees.json`.

Extract the archive to `recovered/`. Run `python3 verify.py` inside the companion
directory from a repository containing the exact commit: 98 seals, 7,403 Git
blobs, **401 recovery mappings** (97 capture, 96 bootstrap, 104 per installation),
two exit-0 receipts and identical target-file sets must pass. Restore exact
observed trees on an authorized runtime with:

```text
python3 restore.py recovered EXACT_SOURCE ORIGINAL_39_FILES NEW_DESTINATION
```

Use the supplied pinned extractor to recover the original 39 files, and checkout
the exact source commit for mapped fonts/system bytes. The restoration script
checks every size and SHA-256. This reconstructs the observed failed install;
it does not invent missing game files. Registry exports remain in the evidence
stage directories and must be retained unchanged. No registered corpus candidate
matches Jedi, so no unrelated dashboard `result.json` was fabricated.
The repository-wide evidence check exits 1 for the existing Zuma artifact outside
its run directory; it also lists historical missing/invalid records. Its complete
output is retained. No new Jedi containment error is reported.

Postflight verified no owned guest/controller processes, unchanged source,
module, originals and bootstrap capture. Box **bx_723bg5h6 remains RUNNING**;
API reports `state=idle`, `health=ok`, expiry **2026-10-21T14:51:37.859Z**.
Coordinator owns shutdown. Remote `/home/user/jedi-current-main`,
`/home/user/jedi-original`, `/home/user/jedi-evidence` and archive remain intact.
Recovery completed before the 14:30 handoff deadline. No stop/delete/resume,
SSH, new box, public deployment, laptop/fleet action or worker delegation.
Local aggregate remains below 64 MiB and the floor plus 600 MiB reserve.
Shared WIP, index and Git config were preserved. Task branch only; no main merge.
