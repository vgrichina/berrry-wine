# Aranna: bounded transport repair and selected-map failure

The one authorized original advanced through Main Menu → Single Player → Start
New Game → Choose Hero/name **Aranna** → Difficulty → **Normal**. After Normal,
the game displayed **“The selected map could not be loaded.”** over Choose Hero.
I personally reviewed that dialog and stopped without dismissing it or retrying.
World movement was not reached. No emulator defect or production fix is established.

Evidence: `scratch/runs/20261107-aranna-transport-window/`. This continues
[the hover-journal investigation](aranna-hover-journal-20261107.md), whose previous
original stopped because unrelated detail exhausted the global 8192-record
transport. The present original passed that point with complete coverage.

## Observation change

The run-local `observer-transform.cjs` wraps the retained observer. Before serial
allocation, it bounds unrelated scalar detail: event 2 at 64 records, event 36
at 16, and each event 60–79 and 87–91 at 16. It does not filter transaction
begin/end 110/111, native semantic events 80–86, native hover 96, native stores
92–94, or arm marker 95. Suppression is counted separately; diagnostic field
125[1] carries that count, while 125[0] retains draw pressure.

The global quota remains 8192, manager quota 16, draw/input quotas 8, and hover
admission quota 32. Saturation still refuses certification. Monotonic serial
checks supplement the retained packet/proof reviewers. Owner, module, scene,
receiver, target, return PC/SP, current point, movement/mode freshness and
complete transaction requirements remain. The observer executes every original
guest instruction/store exactly once and does not inject guest state.

No production files changed. The tested source pin is
`ffce252bf52b70092425a3b4dd3a3adc6781c63b`, with relevant dirty hunks and owned
new helper patches in `source-v8.binarydiff` and `source-v8-new-file-*.patch`.
`source-identity.json` pins source, media references, helpers and modules;
`source-post-original.json` records a successful post-original check. Git plus
these patches is the source archive; no tree/media archive was made.

Observer module SHA-256:

| Module | SHA-256 |
| --- | --- |
| standard | `3fee95a1a5d22b5224558c9474d92b7333626d88020c5bf021bb0feae1db9e6f` |
| compat | `3b7efecbd3d0ab3ec87b445c3f15ab0c83c59b92dd8061eac8a7d6957aee9f1d` |

## Qualification

- `controls/qualification.json`: baseline/disabled/armed comparisons in both
  modules on ordinary API and actual owning-worker routes. CPU, registers,
  lazy flags, live FPU/environment/payload, guest memory, normal results, COM,
  input, DLL and reserve/SEH behavior matched. The changed observer ran armed;
  disabled execution produced no armed native store/hover records.
- `route-qualification.json`: both modules exercised actual natural expiry,
  stale-action refusal before input, trusted acquisition, measured retarget,
  fresh native hover and balanced target activation. Each ended at generated
  TARGET A activated, DOWN=UP=3. Each had 966 retained pre-arm records and 5068
  suppressed unrelated details, so the fresh proof followed over 6000 attempted
  prior observations. Standard also refused an off-target point before input,
  then accepted a separately reviewed corrective movement.
- `window-controls.json`: 17 complete/incomplete-window, stale, owner/module,
  receiver/target, ordering, missing-field/return, gap and saturation controls
  passed against actual changed-route data. Route qualification adds 11
  mutated-ticket/live negatives per module, including intervening movement,
  changed mode/protocol and exhausted manager/global coverage.
- Reused unchanged passing controls: 12 retained native-proof negatives
  (including refusal of the old exhausted journal), 32 route-contract checks,
  five adapter receipt controls, pointer restoration/reload and terminal
  unknown/partial outcome handling. Retained draw/manager ordering controls
  were reused unchanged. No uncertain input was replayed.

Qualification limits are explicit. An initial generated stress fixture reached
heavy churn but produced black captures and was stopped unqualified
(`control-target-standard2`). The revised fixture stresses its native UI wrapper
before normal listener execution. Some intermediate GDI captures remained black;
reviews describe the actual images. Two premature generated-control review
labels were corrected with original labels preserved in correction records.
The final standard target capture visibly shows ACTIVATED TARGET A; compat's
final capture visibly shows that text on an intermediate black GDI frame.

The compat control supervisor and driver received SIGTERM (143) after all input
through command 8 had known completed outcomes; queued quit 9 was unconsumed.
The cause is unknown. Ordinary CDP browser close then acknowledged, and exact
processes, ports and profile were cleaned and verified. Its terminal code is
143 and Chrome exit code is unavailable, explicitly recorded rather than
reported as normal exit. Standard controls exited normally. The original below
was separately bounded and exited normally.

## One original and remaining blocker

The original ran from **2026-11-07 01:05:11Z to 01:18:02Z**, inside the authorized
40 minutes including review and cleanup. It used the registered media/manifest
through a local standard observer route. Every menu input followed personal
capture review; inputs were ordinary balanced browser actions. There were no
boxes, forced locks, guest state injection, media/config edits, nested workers
or second original.

| Checkpoint | Evidence |
| --- | --- |
| Main Menu | `original/response-05.png` |
| Fresh native Single Player hover at (398,155) | `original/response-09.png`, certified action 10 |
| Single Player | `original/response-11.png` |
| Choose Hero with Aranna name rendered | `original/response-20.png` |
| Difficulty | `original/response-24.png` |
| Measured Normal hover at (400,295), manager stores 14/16 | `original/response-26.png` |
| Balanced Normal activation | `original/action-27.json`, live global serial 2157 |
| Loading | `original/response-28.png` |
| Selected-map failure, personally reviewed | `original/response-29.png`, `.review.json`, `.state.json` |

The blocker capture was taken at **01:17:44.521Z** by a read-only observation
after Normal. `original-blocker.json` records the exact operation and stop.
The app was still running, with no trap reported; this establishes its visible
map-load failure, not its cause. No world or movement claim follows from it.
The next useful work is to investigate this selected-map load failure against
the retained registered manifest/media references and logs. Another original
requires fresh authorization.

## Cleanup and recovery

Lords2 explicitly released runtime ownership before acquisition; its processes,
ports and locks were independently checked. After the original, driver and
Chrome exited 0. `runtime-cleanup.json` verifies all owned control/original
processes and descendants absent, ports refused and profiles absent.
`runtime-release.json` verifies the holder/watcher absent and all four local
runtime/browser/heavy/build locks acquired then released. Runtime/source/build
ownership was explicitly handed back on the messageboard at 01:18:35Z. No box
was allocated, so box state/expiry is not applicable.

The completed large passivity log is losslessly compressed as
`controls/results.json.gz`; `compression-passivity.json` records original and
compressed recovery hashes. Restore with `gzip -dk controls/results.json.gz`.
Free space stayed above 2 GB. Findings are published as documentation only;
no production build/fix claim is made. Artifacts precede `result.json`, written
last as the terminal record.
