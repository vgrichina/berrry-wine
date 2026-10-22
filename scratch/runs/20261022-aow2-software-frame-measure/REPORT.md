# AoW2 software-frame qualification: offline source gate blocked

Assignment `AOW2-RENDERING-COVERAGE-20261009`, 2026-10-22. No browser/game
run, metric, scene screenshot, engine change, build, download or archive restore.
Army movement and the viewport fix remain accepted historical results; this
assignment neither repeats nor disputes them.

The mandatory **complete startup import-support gate fails** for the preserved
historical source/module. Both registered `vcl50.bpl` and `Ml42ND50.bpl` import
`kernel32.dll!GetOverlappedResult` and `user32.dll!ActivateKeyboardLayout`.
The exact source's `src/api_table.json` has neither name; a search of its entire
`src`, `lib`, and `host.js` finds neither name. `lib/dll-registry.js` registers
neither system DLL for native loading, and neither native payload exists in the
standard local DLL directory or original game directory. Thus these four import
edges have no established handler/native implementation in this closure.

This is an offline acceptance blocker, **not a reproduced gameplay crash**.
Those imported functions may be unused on the ordinary Scenario → Single →
Start route. Prior gameplay evidence does not establish complete import support.
No inference is made that filling these imports is necessary for that scene.
The coordinator must decide how to reconcile the strict complete-import gate
with unused imports before another assignment; this worker adds no handlers,
native replacements, import exceptions, or guest patches.

Passed before the stop:

- Canonical archive SHA-256
  `3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`;
  shipping module `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`
  (1,878,971 bytes), read in place without rebuilding or extraction to disk.
- All 5,625 canonical recorded source/supplement blobs verified by size/SHA-256.
  Canonical `ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c` and accepted historical
  `c26252c4a95babe583ade1d1c6e2da0c050be45c` have identical src/lib/tools,
  host.js/index.html/package-lock.json objects. All 154 preserved browser
  runtime/module pins match; tracked source bytes match the historical revision.
  This is explicitly **not current-main qualification**.
- All 29 font pins match, including five stock FONs, scalable and UI fonts.
- Original AoW2.exe is 5,748,736 bytes, SHA-256
  `a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`.
  Manifest exactly covers 1,059 companions plus EXE/three registered BPLs;
  1,064 files including manifest are hashed. File sizes, guest paths, lazy flags
  and canonical generator `--check` pass. Original extraction remains in place.
- Native exports/imports are inventoried using original PE `objdump -p` output.
  Startup closure is EXE + VCL50 + VCLX50 + Ml42ND50 (3,145 named import edges).
  Original dynamic and unused designer/database packages are inventoried too.
  Their unresolved dependencies are **not asserted to be startup blockers**.
  Other absent API-table names may be supplied by registered native system DLLs;
  this report does not label all absent names as missing implementations.

`offline.log` preserves the initial overbroad inventory assertion (all package
imports, including unused designer packages). The corrected `offline.py`
classifies startup reachability and tests the two concrete system APIs against
the native registry and payload inventory. `source-gate.log` is its authoritative
expected exit-2 result; `source-gate.json` states the bounded finding. No runtime
attempt or staging retest was consumed. Remaining runner/remote source checks,
owner/canvas/layer/sink attribution, positive sample gate, full interval and
negative sample controls were not reached. No Arcanum metric transfers to AoW2.

Evidence branch: `task/aow2-software-frame-measure-oct22`, based on main
`efa26a12b0f1284b8558189d14c0e9c2213d5e11`. Only this run directory is changed.
The existing observer and validator were read but not modified or executed for
AoW2. No claim of logical game frames, display refresh, audio, Windows,
full-game compatibility, or current-main behavior.

Box `bx_y5a3vk8g` remains **running**, Boat API state `idle`, health `ok`, expiry
2026-10-22T05:33:29.742Z. Coordinator retains shutdown ownership/checkpoint
05:23 UTC. Fresh admission and final Boat exec succeeded, free disk >49 GB.
No worker browser/server was started, so no task process or remote task path is
retained. Only read-only admission/health commands ran. Handback is before 05:13.

Recovery: verify `seals.json` with `verify.py`; rerun `offline.py` against the
recorded local donor paths for expected exit 2. Canonical archive/source recipes
remain at the mm-timer-qualified-integrate-oct22 checkout; the accepted browser
runtime and font manifest remain at arcanum-software-frame-measure-oct22.
The original fixture stays under the shared test/binaries path. Nothing needs
downloading, cold restoring, rebuilding, or copying to demonstrate this blocker.

Raw objdump files retain their original trailing blank lines; the staged
whitespace check reports those ten raw-output exceptions. Authored files pass
the staged whitespace check with only `imports/` excluded. The initial commit
attempt lacked a checkout author identity; publication uses the same Codex
identity as the preceding accepted report through per-command options.
