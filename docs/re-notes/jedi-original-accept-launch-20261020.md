# Jedi Knight original demo: accepted licence, blocked in setup

On 2026-10-20, the original installer displayed its demo licence and an ordinary
mouse click on **Yes** advanced to Welcome. Setup then reached **Select
Components**, where an ordinary click on the visible Next button was delivered
to the underlying progress dialog instead. Installation did not finish. The
original game was **not launched**: its advertised installed executable was
absent. No playable, browser, audio or rendering qualification is claimed.

## Identity and complete fresh closure

Runtime: `bx_6czhvg6m`, Linux x64, Node v24.18.1. Source checkout:
`/home/user/midi-remote-only-qualified-20261020-1447/source`, HEAD
`6b96535d00442d4581b65d54e04abc31ae65febe`. All 6,915 candidate tracked blobs
match production candidate `14792a36a6cf1aa21f17f64615d5932d07e8d94f`;
the qualification-only `tools/qualify-midi-native.js` is absent from that
candidate tree and is not part of this runtime route. The preserved pre/post
scripts check every candidate blob but report `rows.length - 1`, incorrectly
subtracting an exception that is absent; their 6,914 summary is off by one.
Canonical module SHA-256:
`11aee57cb158ffd734534b97aef9c36e3152aec660c8371d609a771e4eee9a5f`.
No build, production fix, new stub or source modification was made.

Original `jedidemo.exe` SHA-256:
`8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.
All 39 extracted files were rehashed before execution and after retirement.
The recovery recipe and inventory are in commit
`57db4c964fb82552b7c014a1ffcc58e1bf7815b9`,
[jedi-original-recovery-20261020.md](https://github.com/vgrichina/wine-assembly/blob/57db4c964fb82552b7c014a1ffcc58e1bf7815b9/docs/re-notes/jedi-original-recovery-20261020.md).

Fresh ordinary `setup.exe` bootstrap used the original directory as `--vfs-tree`
and the existing `--capture-launch`, `--save-vfs` and `--reg-export` mechanisms.
The host's 34 disk-backed system/font inputs were checked before execution;
its existing generated system identities were left unchanged. Bootstrap exited
0 after 602 batches, with the known B0071612 child handoff and caught thread
cleanup warning. Its new capture contains **96 files plus launch.json**, with
all original aliases and all 48 host support paths materialized. It is not the
historical nine-file partial capture. The complete capture was sealed before
child execution and checked unchanged afterward.

The actual receipt names `c:\windows\temp\_ins0432._mp`, empty arguments and
`C:\` cwd. Child SHA-256:
`12a2929a615924e212490f4ef3a1cbb36ecebddafea0f358991a0fc57b7cab84`.
Replay used this receipt, the complete fresh capture and genuine bootstrap
registry/INI export. That export is end-of-bootstrap state, not a launch-time
registry snapshot. No registry edits or guessed command-line options occurred.

## Observed ordinary route and blocker

Authorization is the separate user record
`scratch/license-acceptance-authorization-20261018.json`. That record's
`acceptedInGuest=false` was not edited. This run independently establishes
`acceptedInGuest=true`: reviewed `license.png`, the successful `click:415:395`
receipt, and `after-accept-corrected.png` showing Welcome.

The observed sequence was licence Yes → Welcome Next → Install Jedi Knight
Demo Next → default 320×200 Next → default destination Next → Start Copying
Files Next → Select Components. All inputs used the renderer's ordinary mouse
down/up path. The first child run reached the copy confirmation, then its
120-second guard ended it normally. One fresh bounded continuation replayed
these observed choices with screenshots before every click; it reached Select
Components after briefly showing “Copying files...”.

At Select Components the visible Next button is around (415,395), in top-level
window `0x1006b` at (80,59), 480×362. The ordinary click was logged at batch
1126100, but mouse hit-test/down/up messages explicitly targeted **0x1000f**,
the still-visible underlying child progress dialog at (155,304), 323×139.
The Select Components page remained visible and lost its active caption.
One ordinary `keypress:13` produced WM_CHAR 13 targeting focus `0x10001` and
also did not advance it. This was a character-input attempt, not a full
keydown/keyup Enter sequence. Snapshot and before/after images corroborate the
stalled page. No forced WM_COMMAND, guest memory changes or alternate launch
route was used. The exact deeper cause of hit testing/focus is not diagnosed.

The normal installer wrote registry entries for
`C:\Program Files\LucasArts\Jedi Knight Demo\JkDemo.exe`, `Jedi.EXE`,
`SysCheck.exe` and `Resource\Res1low.gob`, but the final VFS contains only
`deisl1.isu` (2,940 bytes) beneath that target directory. No installed executable
or game assets exist there. The UI had also advertised “0 MB” before copying;
why no payload was copied remains unqualified. Registry values alone do not
establish a successful installation. This concrete setup/input and missing
payload boundary prevents an original installed-game launch within this task.

The continuation was stopped through the existing control `quit` operation;
terminal exit 0 is a controller stop, not installer completion. All guest
processes were absent at postflight. Runtime was released at 15:35:37 UTC,
before the 15:47 cutoff; the sandbox was neither stopped nor extended.

## Preserved evidence and checks

Local run: `scratch/runs/20261020-jedi-original-accept-launch/`.
`evidence.tgz` is 1,439,552 bytes, SHA-256
`1620acbcca8938ed0a83898d1199cc65f974025bd1ed10367719d58a057a1deb`,
recovered and verified at 15:35 UTC. It contains launch argv, logs, terminal
receipts, per-stage VFS seals, registry exports, ordinary input receipts,
screenshots, postflight, and the fresh capture's generated/support bytes.
Large original payloads and duplicate VFS trees are omitted; restore originals
with the pinned recovery recipe and validate against `capture-seal.json`.
Do not mistake this evidence archive for an immediately mountable full tree.
Remote evidence was `/home/user/jedi-original-accept-launch-oct20`; TTL was
15:53:12 UTC, so local archive plus Git recipes are the durable recovery lane.

Some input receipt filenames for the continuation were written under `child/`
by the external observation script, although timestamps, current port, log and
screenshots identify the active `install/` process. Both are retained. Early
harness mistakes (a mistyped expected module hash, a nonexistent inventory
filename, an invalid async wrapper/control URL and rejected click-object form)
were corrected before their dependent action; receipts remain preserved. The
rejected click did not constitute acceptance.

Validation checks: original/source/module identity before and after; 97-entry
fresh capture seal; 39 capture-original aliases; three exit-0 terminal receipts;
actual acceptance-to-Welcome evidence; observed input routing; final target
payload absence; archive SHA-256; exact report-only Git scope and diff check.
No native suite or browser run was repeated. Candidate is unregistered, so
this is investigation evidence rather than an unrelated dashboard attachment.

Shared HEAD/index/config, unrelated WIP, laptop ownership and automated-review
holds were preserved. The report uses an exact sparse task worktree after a
projected checkout admission; no main merge. Local cap is 4 MiB, with the
2,210,398,208-byte floor plus 32 MiB reserve and current concurrent reservations.
The next task must be assigned by the coordinator; this worker stops here.

## Independent report integration review

Reviewed candidate `c0de2a2040954dc1ff58668f19e7b619fe442855` against fresh
`origin/main` at `71a60db4004e5df74cfa232f7a59edc109ffc660`. Independent
checks and receipt are in
`scratch/runs/20261020-jedi-acceptance-evidence-integrate/`.
All recorded evidence hashes were rechecked, including the archive; 57 retained
capture members were hashed from the archive, and 39 original aliases matched
the recovery inventory. Local Git objects confirm all 6,915 candidate blob
identities in the recorded checkout. Remote source/module identity rests on
the preserved successful pre/post commands and their inspected verifier code;
this review did not re-read the remote filesystem or execute the module.

Five screenshots were independently inspected alongside the acceptance,
mouse-routing, keyboard-focus and final VFS records. Yes acceptance and the
stalled Select Components page are supported. Routing causality remains under
separate source investigation; neither a source fix nor a causal explanation
for the missing payload is established here. The final target contains only
the uninstall log: no installed-game or playable claim is justified.
The source count and recovery link were corrected; original evidence was
left intact. No runtime, browser, build or download was performed.
