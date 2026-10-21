# Hock registered runtime: blocked at bounded CLI timeout

Exact integrated main `d4ba733fb0d1c9e6d67ff0db715a5c0535307e6f` passes a
fresh canonical build with all normal gates. The actual registered consumer
fails its bounded smoke: **0 ready, 1 blocked, 0 skipped, 0 harness failures**,
exit **1**, reason **timeout**. Registration/package acceptance remains valid;
registered runtime acceptance is not established. No production source, main,
public deployment, app selector, guest bytes or guest state was changed.

## Exact build and original staging

Assigned box `bx_egnm3u4y`, Node `v24.18.1`, remote checkout
`/home/user/hock-registered-runtime/repo`. HTTPS clone and detached checkout of
the exact commit, then `npm ci`. All 7,253 tracked files match Git blobs and
their before/after SHA256 seals; tracked status remains clean. No inherited
module was used. Producer-changing integration was frozen by the coordinator.

`bash tools/build.sh` ran 08:46:09–08:46:32 UTC, Boat
`cmd_sayybfjrmzcw`, exit 0. `remote-evidence/build.log` contains every normal
gate and compilation output; no gate was skipped or weakened.

| Module | Bytes | SHA256 |
| --- | ---: | --- |
| Fresh canonical | 1,878,508 | `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c` |
| Fresh compat | 1,881,081 | `25519647def1c2a25f505a81743d21dec55472ede8780f809edf09b6bb231018` |
| Actual corpus temporary module | 1,878,471 | `a5972cbaf915aa1d155b301da5fae1c80298b2be381034945c7e58cc81e02f72` |

The corpus uses its existing `compileSrcWasm()` and creates its own temporary
module. Its bytes equal the canonical file's exact prefix; only the canonical
file's final 37-byte `wine-region-layout` custom section is absent. Every other
section is byte-identical. This was verified against the actual temporary file
before its cleanup, without replacing it or changing the route. Full section
hashes are in `identity-after.json`. Compat was built, not guest-tested.

Reused the accepted `recover-original.py` directly on the assigned box. Original
`beavislg.zip` is 1,256,578 bytes, SHA256
`e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b`, from
`https://archive.org/download/Hock-A-Loogie-1995/beavislg.zip`.
Original `BBLOOGIE.EXE` is 223,744 bytes, SHA256
`974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.
All 44 accepted intake seals, including all 39 game files, match before/after.
The outer extraction was staged as the registered `distribution/` directory;
the real fetcher command was:

```sh
node tools/fetch-candidate-corpus.js --id=hock-a-loogie-1995 --prepare
```

Initial preparation reported missing `7z`/`unar`. Installing normal dependency
`p7zip-full` resolved that staging error; preparation then exited 0 and performed
the registered nested extraction. All 39 resulting original files and all 38
generated browser companion names, sizes, VFS paths and hashes were verified
against the accepted intake. No DLL substitution or registry preseed was added.

## Actual registered execution and first blocker

From the exact checkout:

```sh
NODE_OPTIONS=--require=/home/user/hock-registered-runtime/evidence/observe.cjs \
  node test/test-cli-candidate-corpus.js --id=hock-a-loogie-1995 --strict
```

The external observer preserves the unchanged `spawnSync` arguments/options,
return values and original VFS resolver results. It writes child output that
the consumer ordinarily discards. It does not change source, compilation,
timeouts, inputs or guest state. The actual consumer-generated child argv is
in `actual-child-command.json`; its explicit EXE argument is the registered
planner's output, not a replacement top-level explicit-EXE acceptance test.
The actual child resolver mounted all 39 original files from `game/` with
`--vfs-include=**/*`; `actual-vfs-resolution.json` records every resolved file
and hash. Existing CLI rooting maps these relative names under `C:\`.

Boat `cmd_canhjwny1qym`, 08:48:03.747–08:50:58.225 UTC, returned exit 1:

```text
BLOCKED hock-a-loogie-1995: timeout
candidate CLI corpus: 0 ready/local, 1 blocked, 0 skipped, 0 harness failures
```

The registered defaults request 3,000 batches of 100,000 blocks, `--no-close`,
`--stuck-after=50`, and a 120,000 ms `spawnSync` timeout. At 08:50:46 the child
was still at 100% CPU after approximately 159 seconds; the timeout had not
returned control. At 08:50:58 only verified owned child PID 21279 was externally
sent SIGKILL. The parent then returned its existing `ETIMEDOUT` error, child
status null and signal SIGKILL. Both the overdue process snapshot and termination
receipt are preserved. This is **not** a natural child exit or a successful
bounded run; no retry or source repair was made. The precise observed blocker
is registered smoke timeout plus failure of its default termination to finish;
the guest's underlying stalled/long-running instruction path is not diagnosed.

`guest.stdout.log` proves actual execution: PE entry `0x0041366f`, main window
"Beavis & Butthead Loogie Game", successful DLL initialization, a worker
thread, and waveOut open at 22,050 Hz / mono / 8-bit. The final observed event
is `ShowWindow` command 8. No normal batch-limit completion was emitted.
`guest.stderr.log` warns that ignored `comctl32.dll` is absent; the previously
accepted scoring log has the same warning. This does not establish that DLL
absence caused this timeout. WaveOut initialization does not prove audible or
correct sound. No screenshot was obtained.

## Existing browser route and remaining gaps

The real `ops/emulator-server` catalog and `launchFor()` return no Hock route:
the candidate has no `appIds`, there is no Hock/Loogie app in the catalog, and
none of its fixture files is in the browser handler allowlist. The generated
38-companion inventory exists but does not create a browser launch association.
`browser-route.json` records this precise browser-extension blocker. No synthetic
route, selector entry or server deployment was created, and no browser guest
was executed.

The CLI smoke is not gameplay acceptance. Prior accepted explicit-EXE scoring
0/20→5/20 is separate and was not replayed or repackaged. Registered screenshot,
startup/input/gameplay acceptance, completion, persistence, sound quality, FPS,
exact struck target and Windows parity remain unqualified.

## Evidence and handoff

The adjacent `hock-registered-runtime-20261021-evidence.tgz` contains sealed
remote logs, all source/package/module identities, observation/verification
scripts, original recovery recipe, and command receipts. Extract into an empty
directory and check `SHA256SUMS.json`, then
`remote-evidence/SHA256SUMS.json`. It contains no game binaries or credentials.
Local run: `scratch/runs/20261021-hock-registered-runtime/`, including
`RECOVERY.md`, final `result.json` and `publication.json`.

Same box `bx_egnm3u4y` is left RUNNING (API state `idle`, health `ok`), expiry
`2026-10-21T10:44:02.530Z`; coordinator owns shutdown and the next assignment.
Remote root retains exact repo, canonical/compat/observed consumer modules,
intake and raw evidence. Only the overdue owned test process was terminated;
no box was created, resumed, stopped or deleted by this worker. No other box
was accessed, no workers launched. Root WIP and laptop HeroesII/WarcraftIII are
untouched. Sparse local checkout and compact evidence remain under 64 MiB and
above the 2,285,895,680-byte free floor plus 600 MB reserve. Bounded task stops
at this blocker; further runtime diagnosis or browser registration is a new
coordinator assignment.
