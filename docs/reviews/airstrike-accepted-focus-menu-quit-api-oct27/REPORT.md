# Airstrike focus/menu/Quit recovery — failed runtime acceptance

One original-game run launched on `bx_yqcwfqqf` at 2026-10-27T03:34:37Z. The inspected captures and correlated snapshots establish Airstrike input focus and an unobscured seven-row Airstrike menu, selected row 0. **Ordinary Quit and normal termination remain unproven.** The bridge’s eight-second menu-observation deadline expired before the inspected observation returned. Failure cleanup sent SIGTERM. The accepted controller correctly refused the terminal: `terminal before observed Quit activation`, exit 2.

The run was not repeated. No production/controller/emulator changes, build, source repair, forced game state, synthetic gameplay, main integration or public deployment occurred. This is historical-runtime qualification, not a current-main claim or a new gameplay-duration claim.

## Identity and reused receipts

- Accepted candidate `565ceadbe8e63c88754bda4590df156cbba6bf85`; independent acceptance `2a4b5de2e135c567d1f0f854ad4ff2982982bcf4`.
- Controller SHA256 `e96344c2a89dba87c28eba0aba9cd3ea5b400cc0245734b2bbc9248e110e7ebb`; test SHA256 `0dbcef01a53836b7acd2127d93087ae154225b519d16fe4cca1172b964f8bfb6`.
- Pinned production runner SHA256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`; historical source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`; module SHA256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`.
- Reused predecessor’s 261-file/17,345,286-byte full remote hash receipt in `/tmp/airstrike-accepted-focus-menu-quit-api-oct27/ops/remote-all-hashes.json`. No closure retransfer, rebuild or offline suite replay. Reused 14 actual CLI cases, five unchanged groups and historical sustained 37ACK play evidence.
- Retained root `/home/user/airstrike-menu-quit-oct27` was verified through bounded read-only API execution before launch. No prior guest/state/terminal files or owned processes existed.
- `evidence/reused-node-startup.json` retains exact Node v24.22.1 executable, heap flags, explicit environment hash, inherited limits, successful startup and canonical actual mount enumeration: 89 files, eight provider DLLs, no comma-bearing filenames present. Configuration unchanged.

## Launch and observations

The old E2BIG incident and subsequent incompatible `--detach --timeout` CLI rejection remain truthful in `evidence/prior-blocked-result.json` and predecessor ops. Neither launched a guest. The recovery launched the retained bridge by short path using:

```
/home/user/.ascii/boat exec --json --detach bx_yqcwfqqf python3 -B /home/user/airstrike-menu-quit-oct27/evidence/bridge.py run
```

API process 30654, command `cmd_4hmrwzt9wgri`; actual guest process and exact argv are in `evidence/guest-process.json`. The helper-only correction separates runner stdout (`output.log`) and stderr (`runner.stderr`, empty) from creation. The bridge is pinned by `bridge-correction.stdout`; no accepted production code changed.

The guest used the retained original 800×600, alpha2/sound1/one-human configuration, CWD `C:\`, canonical tree mount, exact eight DLLs, `--control-stdin`, `--no-close`, `--no-build`, 512MiB guest memory and 120-second guest ceiling. The exact full Node argv/environment are in `guest-admission.json` and `planned-argv.json`. Node old-space 512MiB is not a process RSS cap. The supervisor enforces process-group RSS ≤2GiB, CPU140s, wall150s and per-file4MiB; inherited DATA and AS are unlimited. Local API clients use physical128MiB, CPU90s, wall120s and output2MiB. Git alone uses physical256MiB/DATA512MiB under the serialized lock and two-permit pool.

`frame-0.png` shows Airstrike in front of the console; its snapshot identifies focused main HWND `0x10001`. Explicit startup key release and the fresh capture support the initial observation (`after:null`). The controller dispatched exactly `airstrike-1/keydown:27` and `airstrike-2/keyup:27`, each with its actual correlated nonqueued ACK. The resulting `frame-1.png` shows all seven menu labels and the asterisk beside Resume game (selected0), with the main HWND still focused. Both images were inspected with view_image. Capture SHA256 and sizes are in `evidence/result.json`.

The late menu observation is retained as `frame-1.png.observation.json`; it was not consumed by the bridge/controller before failure. No Down or controller Enter command was dispatched. No automatic OCR/state inference substituted for inspection.

## Terminal, admission and handback

The run elapsed 22.055s, peak guest-group RSS 280,862,720 bytes. `terminal.json` and complete `output.log` show failure reason `factual observation absent`, SIGTERM cleanup, runner exit0, no guest normal-exit proof, no `[Exit] code=0`, no max-seconds/fault/WM_CLOSE/control-quit path, and no remaining guest processes. API bridge exit0 describes successful reporting of failure; it is not acceptance. Controller exit2 and absence of owned controller processes are recorded separately.

Prior disk denial projected2,982,092,800 below floor2,982,150,144 is preserved. Cleanup recovered43,581,440 allocated bytes; the fresh override replaced stale reservations with this56MiB and Penguin48MiB only. Fresh gates count materialized bytes once, positive WAL growth once, actual old/new session/events, source/Git, captures and future reserve. The initial recovery gate passed at projected3,022,422,016 bytes and MemAvailable3,839,873,024. Remote preflight free49,015,267,328 and MemAvailable7,428,390,912 passed the prescribed remote floor/headroom. Periodic remote resources are retained. No local Node executed.

Readback after completion found no owned remote process. Box `bx_yqcwfqqf` remained RUNNING; expiry `2026-10-27T04:16:03.293Z`. Coordinator retains guest cutoff03:50, handback03:55 and independent snapshot-stop04:00. No stop/resume/create action occurred. Notify the coordinator promptly; useful execution ended03:34:59, so the idle15min limit is03:49:59.

Remaining gate: fit factual inspection and transport inside the unchanged controller10s response budget before a separately authorized future run. Then prove source-backed ordinary menu Quit and complete same-run normal terminal evidence. This task authorizes no second run. Evidence publication is report-only and does not publish acceptance or main.
