# Jedi Knight original installer child: source-ready checkpoint

This is preparation, not a runtime result or gameplay qualification. Historical
evidence and original source recovery are in `jedi-knight-demo.md` and its
39-file inventory. No guest, browser, build or remote command ran in this task.

## Why the existing capture hook applies

`src/09e-win16-api.wat` `$win16_winexec_task` logs B0071612 when
`host_win16_stage_module` returns <= 0, releases the dynamic module and returns
0. `$win16_WinExec` then calls `host_shell_execute` with the original command
pointer, operation `WinExec`, no separate arguments and no directory override.
It does not exit before that fallback. `test/run.js` wraps this import and
uses `parseShellLaunchCommand` / `resolveShellLaunchPath`, retaining parsed
arguments and the actual VFS cwd in `capture/launch.json`. The observed
ShellExecute line therefore reaches the hook once `--capture-launch` is enabled.

The CLI `win16StageModule` searches host candidates then `residentWin16Module`.
`lib/vfs-seed.js` accepts resident NE or the special W32INST PE helper, not an
arbitrary PE. Thus an ordinary PE child can produce B0071612 by design. The
marker alone does not distinguish missing bytes, unsupported format or staging
capacity. We have not recovered this generated child's bytes yet. Its filename
is not executable-format evidence. The CLI base `shell_execute` merely logs
and returns 33; no child executes through that base implementation. Capturing
then explicitly replaying the actual child is necessary here.

`--capture-launch` snapshots the VFS map at launch and exports after termination;
it is a shallow map snapshot, not an immutable point-in-time byte/registry image.
`--save-vfs` exports end-of-run state and excludes `c:\app.exe` by default;
cleanup may already have removed the child. It must not replace the launch
snapshot. `--reg-export` also exports end-of-run registry/INI state, not the
launch-time registry. Review the log for changes after handoff before replay.

## Controller and next runtime requirements

`tools/jedi-knight-installer-handoff.js` plans without execution by default.
Supply a JSON config containing absolute `root`, `fixture`, `wasm`, `output`
paths, plus approved `sourceTree` and `moduleSha256`. The historical paths are:

```json
{
  "root": "/home/user/jedi-knight-checkout",
  "fixture": "/home/user/jedi-knight-demo-preflight-20261015/original",
  "wasm": "/home/user/jedi-knight-checkout/build/wine-assembly.wasm",
  "output": "/home/user/jedi-knight-installer-handoff-FRESH-ID",
  "sourceTree": "42c76ec08136d55337151f7c8156a18fb3f6a618",
  "moduleSha256": "937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb"
}
```

These historical pins are not permission to run and must match the approved
checkout at execution. The controller may live outside that pinned checkout;
it invokes that checkout's `test/run.js`. It verifies its source tree, clean
tracked files, canonical module and all original fixture hashes before/after.

After a fresh exclusive runtime grant, verified prior-owner retirement and
adequate disk space on the remote host, inspect the plan and execute capture:

```
node tools/jedi-knight-installer-handoff.js capture CONFIG.json
node tools/jedi-knight-installer-handoff.js capture CONFIG.json --execute
```

Both stages have 120-second guest and 150-second outer limits, no synthetic
inputs and control port 8129 for observation/stopping. Never answer a licence
screen. Each creates a new evidence directory exclusively. Capture saves
launch snapshot, final VFS/registry, final PNG, logs, terminal, identities and
a hash seal of the complete captured tree/receipt/registry. It inspects the
actual child MZ/PE/i386/PE32 header and rejects DLLs. A missing capture or wrong
format is a failed checkpoint, not permission to substitute a file.

Review the capture's actual command, image, logs and registry timing before a
separately authorized replay. Replay validates the seal, successful terminal
and postflight, exact expected original child path, and uses the receipt's
`--exe-guest-path`, `--cwd` and `--args` as individual argv elements. Quotes and
internal argument whitespace survive; the existing capture parser trims outer
whitespace. No shell interpolation or guessed registry is involved.

```
node tools/jedi-knight-installer-handoff.js replay CONFIG.json
node tools/jedi-knight-installer-handoff.js replay CONFIG.json --execute
```

Replay mounts the complete captured tree at C:\, imports the real exported
registry/INI state, and saves its own final state. There is no automatic replay
or game launch. A controller zero exit only means its bounded stage completed
and verification passed. Guest Exit(0) does not prove installation or gameplay;
inspect screens and API/blocker evidence. Nonzero guest exits, signals, failed
postflight and missing/invalid child capture make the controller fail while
retaining its terminal receipt. Existing historical runs remain untouched.

Source validation: `node --test test/jedi-knight-installer-handoff.test.js`
checks bounds, real argv quoting/cwd preservation, receipt/path/byte tampering,
registry changes, failed prior exit and non-PE refusal using synthetic files.
These are controller unit tests, not execution of original game bytes.
