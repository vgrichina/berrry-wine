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
The receipt is generated with actual `VirtualFS._resolvePath`,
`getCurrentDirectory` and `saveVfsToHost` output, including assertions that
Windows separators are single characters. Both stages validate the expected
relative child path before reading its bytes. Capture rejects symlinks and
retains malformed receipt details in `capture-failure.json`; the original
`capture/launch.json` remains available even for JSON parse failures.
These are controller unit tests, not execution of original game bytes.

## Capture execution, 2026-10-15 13:41 UTC

The separately authorized **capture only** ran as Boat process `132450`,
`2026-10-15T13:41:51.643Z`–`13:41:52.708Z`, terminal exit 0. Its guest terminal
was recorded at `13:41:52.621Z`. No inputs were sent and no child replay ran.
This follows the prior Kkr owner's explicit release and independent checks of
its nonrunning/lost handle `118738` (null exit code, not a claimed exit 0),
completed postflight and fresh process inventory. The capture's own full
postflight at `13:44:21.736Z` found no guest/browser/build survivors and verified
all 6,527 source hashes, 39 original file hashes and module unchanged. Runtime
was released to the coordinator then; evidence recovery alone continued.

Tested source is the **historical** `cca0eb4067b454576a6282677cabd4db8b169610`
tree `42c76ec08136d55337151f7c8156a18fb3f6a618` at
`/home/user/jedi-knight-checkout`. This is not a current-main equivalence claim.
Physical module SHA-256 remains
`937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
External controller is task commit `373fe321d723e08da32f95d7c061d795f2b3fcb9`,
SHA-256 `12849a8acae8fd47eabaa606f14d2069530ac112a9782be086553d1623d5fcf9`.
Node v24.18.1, Linux x64; real PNG decode/renderer preflight passed. The remote
had 43.6 GB free and TTL through 14:21:55 UTC. No build was performed.

The generated child is now byte-proved:

* Guest path `c:\windows\temp\_ins0432._mp`; capture-relative path
  `windows/temp/_ins0432._mp`.
* PE32, i386, not a DLL; 674,816 bytes; SHA-256
  `12a2929a615924e212490f4ef3a1cbb36ecebddafea0f358991a0fc57b7cab84`.
* Actual WinExec/capture arguments are the **empty string**, cwd `C:\`.
* Original command options are in the generated `_ins0432.ini` instead:
  `CmdLine=  -fC:\SETUP.INS  -z1 -cx -xC:\WINDOWS\TEMP\`.
  Preserve that file and the real exported INI store. Do not move its contents
  into `--args` or invent installer options.

The 96-file launch snapshot contains the original package, runtime system files
and generated `_INS0432._MP`, `_INZ0432._MP`, `_WUTL95.DLL`, `_INS0432.INI`,
zero-length `_INS0566._MP`, plus `_DELIS43.INI`, `_ISERR31.INI` and
`_ISENV31.INI`. Hash comparison against the end-of-run `--save-vfs` export
found only `app.exe` absent, as expected from that flag's exclusion. Other
captured file bytes matched at end of run. This does not retroactively make
the shallow snapshot immutable at launch.

The registry/INI receipt contains 72 entries, including three installer INI
entries (`_delis43.ini`, `_ins0432.ini`, `_iserr31.ini`). Export occurs after
parent exit. Quiet logging did not capture every registry write, and there is
no launch-time registry snapshot; do not assert that this receipt was frozen
at the exact WinExec boundary. No registry was fabricated or edited.

Log: B0071612, successful 96-file capture hook, caught thread-window cleanup
`unreachable`, parent Exit(0), 602 batches / 0.421 seconds. Reviewed final
640×480 PNG is plain teal. No licence screen, installation or gameplay was
observed. The original generated PE now explains why the NE-only staging path
does not start it; the CLI shell fallback logs/captures but does not execute
that child. **The next untested boundary is the real captured PE installer's
startup.** The replay plan validates the seal, but replay remains unexecuted
and requires a new exclusive runtime grant and coordinator review.

### Evidence and recovery

Full remote tree on `bx_9ef2wdsw`:
`/home/user/jedi-installer-capture-20261015/`, including complete
`run/capture/` and `run/bootstrap/vfs/`. Original 39 files remain at the
fixture path above. The unchanged full source checkout retains runtime system
assets. Preserve these remote trees for exact replay.

Small evidence archive:
`/home/user/jedi-installer-capture-20261015-evidence.tgz`, 644,121 bytes,
SHA-256 `df8a7ff64f8961da38afb8f95165bc1e73ba274aa725c5d208831e8502a0411c`.
Recovered and hash-verified locally at
`scratch/runs/20261015-jedi-installer-capture/evidence.tgz`; expanded evidence
is in the sibling `evidence/` directory. It contains the generated child and
all generated supporting files, launch receipt, full capture hash manifest,
registry/INI store, log, PNGs, controller/config, source hash manifest and
pre/postflight. API receipts and archive identity are siblings. It omits the
duplicated original media/system assets and end-of-run VFS tree to preserve
the local 2 GiB free-space floor. It is evidence, not a complete replay mount.

For recovery, prefer the intact remote capture. If it is lost, restore the
original package using the hash-pinned recipe in `jedi-knight-demo.md`, restore
system assets from the exact tested source, overlay the retained generated
files, and validate **every** path/hash against `captured-child.json` before
using the reconstructed tree. Missing assets must fail recovery, not be
silently omitted. No dashboard result is attached because this candidate has
not been registered; this remains installer investigation evidence.

## Original child startup preparation, 2026-10-15

Fresh worker `/root/jedi_original_child_startup` prepared from main checkpoint
`73fc6ee8f` (tree `9b424dc8415593bf27ef43aa6cf566abab78f6c4`). No remote
command, guest, build or browser ran during this preparation. IW native
validation owns the sole runtime until the coordinator explicitly reassigns it.

The retained controller is byte-identical to the tested external capture
controller (`12849a8acae8fd47eabaa606f14d2069530ac112a9782be086553d1623d5fcf9`).
Both focused controller tests pass, including tamper and failure controls.
Independent local hashing matches all nine retained capture entries against
the 97-entry seal (96 files plus launch receipt), as well as registry SHA-256
`be14b34b94e82b0391aab0ef2bae87188c0b1b108abfc36992f125a6474b4a11`.
The partial local evidence is insufficient to call `plan(..., 'replay')`:
that deliberately requires every sealed file. The historical remote postflight
retains the successfully validated exact replay argv; it is not a fresh check.

The proposed runtime remains `/home/user/jedi-knight-checkout`, source tree
`42c76ec08136d55337151f7c8156a18fb3f6a618`, physical module `937466db…49eb`.
A Git comparison of `src/`, `lib/`, `test/run.js`, `tools/build.sh` and
`tools/build-compile-wat.js` between historical `cca0eb406` and the preparation
checkpoint `73fc6ee8f` reports no differences. This bounded source comparison
does not prove all build-input or current-main equivalence; the actual runtime
result must still identify the historical source and physical module.

After IW release and explicit coordinator grant, first independently verify
its terminal/postflight and a fresh process inventory, disk and remaining TTL.
Rehash the remote controller/config, complete source manifest, all 39 original
fixtures, module, complete capture tree and exported registry. Require that
`run/child` does not exist. The first source-ready remote command is:

```sh
node /home/user/jedi-installer-capture-20261015/controller.js replay /home/user/jedi-installer-capture-20261015/config.json
```

Only after that plan and identity review, the granted execution command is:

```sh
node /home/user/jedi-installer-capture-20261015/controller.js replay /home/user/jedi-installer-capture-20261015/config.json --execute
```

The existing controller exclusively creates `run/child`, uses guest 120-second
and outer 150-second bounds, no inputs, and no build. Preserve the original
empty argv, C-root cwd, guest executable path, full capture mount and registry
import exactly. Do not translate `_ins0432.ini` into command arguments. Observe
the first screen through the existing control endpoint if needed; never answer
a licence prompt. The final PNG/log will establish the next real startup
boundary, not installation or gameplay success by itself.

After termination, retain process/terminal receipts and independently repeat
source/module/fixture/capture/registry hashes with a fresh survivor inventory.
Recover child launch, identities, controller, stdout, screenshot, terminal,
postflight and any meaningful changed VFS/registry files into a new local run
folder; hash the archive and every recovered artifact before review. Preserve
the remote full capture and resulting child VFS for recovery. Keep local free
space above 2 GiB; the preparation worktree was reduced to a narrow sparse
checkout and free space returned to about 2.3 GiB. No runtime result is claimed
by this source-ready checkpoint.

## Child replay result: licence decision required

After IW release, coordinator granted the sole bounded replay on `bx_9ef2wdsw`.
Fresh preflight `2026-10-15T13:54:28Z` verified all 6,527 source files, 39
original fixtures, historical module `937466db…49eb`, complete 97-entry capture
seal and registry, with no competing runtime. The unchanged controller ran as
Boat process **141587**, `13:54:36.787Z`–`13:55:10.534Z`, exit 0. Guest terminal
is `13:55:10.489Z`, exit 0. No build or synthetic guest input occurred.

The original captured PE loaded at entry `0x00487ed0`, imported all 72 registry
entries and consumed its genuine setup data. It created Setup and displayed
**Software License Agreement** for Jedi Knight Demo. Reviewed 640×480 evidence
shows the licence text, disabled Back button and active Yes/No buttons. The
prompt says installation requires acceptance. We captured the screen through
the host control endpoint and sent host `quit`; this stops the harness without
clicking either answer or sending guest input. The 33.372-second run is an
installer-startup result, not installed-game or gameplay qualification.

**Blocked on the user's licence choice.** No acceptance is inferred and no
further runtime is queued in this lane. The coordinator owns presenting the
concrete screenshot and licence to the user. Do not bypass this prompt or
substitute a manually constructed installation.

Independent postflight at `13:55:49.897Z` verifies the complete source,
fixtures, module, capture and bootstrap registry remain unchanged, with
`active: []`. Runtime was explicitly released to the coordinator and the next
Outlaws acquisition owner. New generated temporary support files and child
registry/VFS remain available on the remote; no installed-game layout is claimed.

Evidence root: `/home/user/jedi-child-startup-20261015/`, with pre/postflight,
source hashes, config, `license.png`, complete `child/` output and artifact
manifest. The original controller also retains
`/home/user/jedi-installer-capture-20261015/run/child/`. Small archive
`/home/user/jedi-child-startup-20261015-evidence.tgz` is 408,629 bytes, SHA-256
`0ddc2aff15294f899c845c0820a010938e9a3b183cffc01c5f5e9850e8bb1c90`.
It omits the duplicated child VFS but retains its complete hash manifest.
Local archive and 14 recovered artifacts verified against their hashes under
`scratch/runs/20261015-jedi-original-child-startup/`. SCP was unavailable for
this API key; recovery used a bounded Boat exec base64 read, with untruncated
receipt and independent archive SHA verification. No access policy was changed.

The reviewed screenshot SHA-256 is
`02597b3dfc79311e2c42f7307ee3f0cf56ddce78fe1811d3c997b4a1296a0a68`.
Local `evidence/demo-license.txt` is the original demo licence matching the
displayed opening text and sealed `child/vfs/license.txt`, SHA-256
`d3dca646e4f290644c7c46ed09126157d9c9cee662d3ed713a15c45cf78dfd29`.
Separately recovered `evidence/setup-library-license.txt` (5,533 bytes,
SHA-256 `a76331b0511b4d8af64391231e626e7a96da4b99723cd5f57503be652c86a12f`)
comes from `_istmp0.dir/license.txt`; it is a different generic bundled licence
and must not be represented as the text shown on screen. Both are preserved
for review; neither was accepted.

Recovery uses the intact full remote capture with its existing seals. A later
authorized continuation needs a fresh evidence directory and the same ordinary
installer route; do not rerun into the existing exclusive `run/child` output or
delete it. Retain this result and actual user decision with any later run.
