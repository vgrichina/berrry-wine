# Shadow Man: WinExec does not reach the retained CLI child transport

**Precise transport blocker; no child installer screen.** One original-parent real-time attempt ran from 2026-10-22T16:59:30.317375Z to 17:00:25.693911Z, **55.376535 seconds total**, with zero child processes and zero retries. The unchanged runner ended at its supported 55-second wall guard, parent exit code 0. That exit is a harness timeout completion, not installer success.

The actual [runtime log](raw/output.log) records:

```text
[ShellExecute] hwnd=0x0 op="WinExec" file="C:\WINDOWS\TEMP\_ISTMP1.DIR\_INS5576._MP" params=""
[ShellExecute] hwnd=0x0 op="WinExec" file="C:\_ISDEL.EXE" params=""
```

The existing CLI has two separate launch paths. Its `h.shell_execute` wrapper at [retained run.js](raw/source-test_run.js), lines3980–4022, calls `baseShellExecute` and returns its result when `--capture-launch` is absent. It never calls `spawnVfsChild` or reads `SPAWN_PROCESSES_FLAG`. The actual base callback in [retained host-imports.js](raw/source-lib_host-imports.js), lines2239–2250, logs the request and returns33. The normal fork/VFS transport at runner4077–4161 is reached through `h.process_spawn` at4164, not through this shell wrapper. Thus increasing the authorized snapshot budget does not connect this original WinExec request to the existing spawn transport. No source repair or substitute launch was performed.

[The exact callback offline check](raw/transport-blocker-check.json) executes the retained shell callback in isolation and demonstrates return33 without a spawn. This is **source-derived/offline return evidence**. Actual guest WinExec EAX was not measured. Runtime command text is authentic; child payload lookup, child support resolution, child module load, child exit and child screen were never reached and remain unknown. No VFS child snapshot was created. The fork observer was active independently of API logging and recorded no fork; no spawned-child preload record exists.

## Limits and offline-gate correction

The preflight validated the actual existing spawn/export implementation, exact supported `--spawn-processes`, space-split `--pipe-child-args=--real-ticks`, per-process `--max-seconds`, module import, previous passing transport fixture, required host closure, preserved bytes and available allocation. Its new observer fixture proved the original `process_spawn` callback and normal return remain intact, and parent WinExec logging does not force-stop. It **missed the prerequisite that this original WinExec calls the separate shell boundary**. The claim that this was a sufficient handoff gate was incorrect.

The attempt also used `--quiet-api` without a trace consumer. The retained runner explicitly disables WASM per-API entry/return callbacks for that configuration (run.js3293–3307). Consequently the observer's API-based first-screen boundary, guest return and per-call payload hashing did not run. Independent shell logging still shows the real WinExec requests, and module/preload/fork observation remained active. This is a capture limitation, not evidence of a guest trap or missing installer binary. No retry was made. The post-attempt offline callback test required one correction: WAT sources are absent from the retained runtime; that unverified source check was removed. A helper argument error and a post-attempt script-upload guard rejection were also corrected without any additional guest execution.

## Captures and identity

The inspected [parent screenshot](raw/parent-79123.png) shows the Shadow Man splash and Setup's “preparing the InstallShield Wizard” progress dialog. It is **the original parent**, not a child installer screen. [parent-final.png](raw/parent-final.png) is the runner's matching final image, SHA256 `b3f7ae3820a38557232ae412b0ed80cc2ff002fb0af9a5cd12ea9796b9390e9d`. No licence/Accept/input/gameplay action was sent.

Accepted historical source identity: `c26252c4a95babe583ade1d1c6e2da0c050be45c`. Tested module: `/home/user/shadow-man-original-oct22/runtime/build/wine-assembly.wasm`, **1,878,971B**, SHA256 `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`. Retained runner SHA256 `1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799`. Original Setup **73,728B**, SHA256 `5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52`; exact loaded parent identity is recorded in [parent preload evidence](raw/parent-79123.jsonl). [command.json](raw/command.json) is the exact attempted command. No module/source rebuild or original-byte edits.

The prior authentic child remains outside Git on bx_2rhkq9ny at `/home/user/shadow-man-real-clock-extraction-oct22/output-0.bin`: **557,056B**, SHA256 `a8657371f03e2e66db951c3dcd3aeb42c576894908ca2eb1b3806aa0404cb083`. Recovery: read that existing file and verify size/SHA against the accepted outputs manifest in the same directory; its saved DLL/INI siblings remain there. This task copied no child binary or media locally. Its hash is prior accepted payload evidence, not a claim about a newly loaded child.

## Preservation, allocation and handback

[Preflight](raw/preflight.json), [exit receipt](raw/exit.json) and [analysis](raw/analysis.json) verify **390 original seals plus120 prior-capture files unchanged**. Remote task directory only `/home/user/shadow-man-child-transport-sized-oct22`; `TMPDIR` placed potential normal transport snapshots beneath its `tmp/` directory. None was created. Observed attempt allocation655,677B; audit/source evidence approximately1.55MB, below256MiB plus16MiB reserve; remote free44.22GB exceeds4GiB. Raw evidence is below8MiB. Whole local focused Git/checkouts/evidence plus launcher and8MiB reserve stays below64MiB, host free above2,982,150,144B. Final measurements are retained separately.

`verify.py` checks recovered manifest hashes, actual sealed runner/host/module identity, one-attempt/no-child findings and cleanup; two rejecting controls refuse corrupted evidence and a false child-success count. No full media, new acquisition, repack, archive extraction, packages, build, clock/timeout/quit patch, forced success, replacement task, worker/subworker or production repair. No main merge or shared Git configuration/alternates/root HEAD/index/TODOS/STATUS edits. `GIT_NO_LAZY_FETCH=1`; publication uses `write-tree --missing-ok` and `commit-tree` without bulk fetch.

**Stopping condition reached:** authentic original WinExec is observable, but the retained CLI shell boundary does not dispatch it to the supported child-process transport. No repair is authorized in this task; coordinator owns any next assignment. All owned guest processes are gone and ports8123/8124 closed. Box **bx_2rhkq9ny remains RUNNING**, API state idle/health ok/stop null, expiry **2026-10-22T17:20:46.919Z**. Coordinator retains shutdown at17:15UTC and snapshot/lifecycle ownership. No lifecycle mutation was made. Commit, push and actual remote-SHA receipts follow in publication evidence and the append-only board.
