# ScreenSaver full-module qualification: canonical build blocked

2026-10-20. Bounded worker stopped at the first concrete failure. **Not accepted for full-VM/browser lifecycle.** No main merge, production repair, stub, gate bypass or alternate build was attempted.

Reviewed input candidate `95d2f43d868d60d84d945b20f393863176622d64` was reconciled with freshly fetched main `aaf8599291b278b5cf1b9e53c654b5bb8cd5dfe6`. Source review `dc1e89f9e90d7098c9c58ada23ab3573976dc02a` was read as focused-closure evidence only; it was not repeated or promoted into full-module acceptance.

The conflict-free merge is commit `f37815f415d5056aee5a6468b625e7d7e51d4d6f`, tree `a32fb954704a9e98478beef1e4d842eb6113b7f3`, on `task/screensaver-fullvm-lifecycle-oct20`. The newer MIDI changes in host.js remain present. `git diff --check` passed. This commit was pushed and its exact remote ref verified before runtime work.

## Actual execution and failure

Jedi explicitly RELEASED bx_6czhvg6m at 15:35:37 UTC. Authorized `boat exec` process inspection `cmd_cvbardpjw5fl` at 15:36:37 verified no remaining guest/browser/build process. Only then was the lease claimed. The existing remote Git object store was reused through a separate shared clone, without changing its source or dependencies. A distinct source/output directory was created at `/home/user/screensaver-fullvm-lifecycle-oct20`.

The saved binary Git patch from `14792a36a6cf1aa21f17f64615d5932d07e8d94f` reconstructs the exact merged tree. All **6,927** materialized tracked files matched their Git blob IDs both before and after the attempt. No previous compiled module was copied or substituted. Node was v24.18.1; remote available space was 46,625,107,968 bytes.

The actual command was `bash tools/build.sh` in that exact remote source tree. It exited 1:

```
CLAUDE.md size: 22221/32768 bytes
WAT manifest OK: src/main.watx includes all 128 src/*.wat in sorted order
check-wat-fragments: 128 fragments OK
Error: WATX location encoding supports at most 128 source files
(adding 'src/main.watx' would be number 129)
```

Failure stack: `watxFileId` (`compiler-parser.js:202`), `parseSource`, `scanWat` (`tools/callback-ownership-census.js:25`), `scanSources`, census main. Thus the canonical census gate fails before compilation. This is a source-file capacity boundary, not a browser input result. The subsequent build gates were not run. There is **no full module and no module hash** for this combined source; postflight confirms `build/wine-assembly.wasm` absent.

## Exact qualification boundary

- PASS: source reconciliation, whitespace check, canonical manifest and fragment balance, remote source identity before/after, evidence recovery, and candidate remote backup.
- FAIL: canonical build at callback ownership census / WATX source-location file capacity.
- NOT RUN: cold no-PE startup; actual DOM/renderer selection, Preview and Close; asynchronous startup cancellation; native recursive teardown; shell launch and separate saver survival after applet Close.
- Desktop mode: **not run**. Single-app mode: **not run**. No browser was launched; no screenshots exist. The 23 KB reviewed closure remains supporting evidence only.

No attempt was made to bypass the census or use a focused fixture in place of the requested full module. The runtime was explicitly released at 15:37:38 after postflight and local recovery, well before test/recovery deadlines. The box was neither extended nor stopped. No other worker, game, shared source, dependency tree, or held diagnostic was touched.

## Recovery and preservation

Coordinator evidence directory: `scratch/runs/20261020-screensaver-fullvm-lifecycle/`. Durable copies accompany this note in `screensaver-fullvm-lifecycle-20261020-evidence/`.

Key files: `build.log`, `prepare-build-command.json`, `postflight.json`, `recovery-command.json`, `process-check.json`, `reconciliation.json`, `reconciliation.patch`, `source-map.txt`, and JavaScript execution/recovery recipes. `source-map.txt` maps every tracked path to exact Git blob ID/size. Build log SHA-256: `29ac5ccb20de00e1ffe95e660ffa53632ff050386bff86de79047d228b68f22d`.

Reproduce only under a new authorized runtime lease: materialize merge commit f37815f4 (or apply the preserved patch to exact base14792a36 with `git apply --index`), verify tree a32fb954 and the source map, then run `bash tools/build.sh`. No heavy local build is required. The remote shared clone is ephemeral and relies on its original object store; pushed Git history and local patch/source map are the recovery source.

No local worktree was materialized. Merge-tree/commit-tree and a private temporary index preserved shared HEAD/index/config. Admission was 3,000,860,672 available bytes against floor2,210,398,208 +32MiB reserve +20MiB concurrent caps. Initial evidence was under1MiB; conservative evidence, private index and Git-object allowance remained below the8MiB task cap. No dashboard result was attached to an unrelated corpus candidate.
