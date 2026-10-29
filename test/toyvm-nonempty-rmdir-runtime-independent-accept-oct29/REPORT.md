# Independent nonempty RMDIR acceptance

Accepted the scoped retained actual production CLI/FUSE run for candidate `5a88ca099b962e946160afd2d4d71a950bf46db3`. No runtime was launched or replayed by this review. Five production files match dispatch SHA-256/byte pins and Git blob identities from the exact candidate tree. The API stdout embeds the same runtime result and CLI stdout as the retained evidence.

The production `Backend.handle` op 11 branch tests the child names and raises `ENOTEMPTY` before parent name deletion, link decrement and collection. The unchanged fixture creates D and D/E, captures both inode identities, calls `os.rmdir(D)`, requires errno 39, and directly checks both paths remain directories with the same inode identities. Its actual marker is `nonempty-rmdir-preserved`, errno 39, childPreserved true, directory inodes 2 and 3.

The source charges 4,096 bytes per inode: root+D+E implies 12,288 bytes. Independently, the actual CLI's post-reap counters report live/peak 12,288, written 0, inodes 3, handles 0. These are post-reap observations, not instantaneous counters during the failed operation. No backend callback was directly executed or observed by this review. CLI exit is 0, accepted true, stopReason and filesystem failure null. Sampled PID/start identities are absent or reused afterward; the production-owned identity is among them. FUSE unmount exited 0, the server exited -15, no mount remains, and no external safety cleanup intervened.

`accept.py` tests the retained API/production CLI boundary before source logic controls. Twelve independent adversarial controls reject wrong errno, missing marker, stale identity, wrong start identity, wrong counter, wrong source pin, altered CLI argv, external cleanup, remaining FUSE mount, missing/reordered nonempty guard and wrong source errno. Controls alter offline review inputs/source syntax; they do not replay runtime or substitute a callback for the production CLI.

Run with the original inherited DATA hard limit through the supplied task-owned supervisor:

```sh
python3 -B /tmp/toyvm-nonempty-rmdir-runtime-independent-accept-oct29/ops.py acceptance-final python3 -B /tmp/toyvm-nonempty-rmdir-runtime-independent-accept-oct29/repo/test/toyvm-nonempty-rmdir-runtime-independent-accept-oct29/accept.py
```

Unchanged prelaunch controls are reused. The supervisor keeps parent DATA soft128 MiB/original hard, Python child DATA128, Git child DATA256 only, CPU90, wall120, file12 MiB, capture2 MiB, evidence1 MiB and monitored physical parentRSS128/groupRSS512. All subprocesses use keyword cwd within the owned root. No Node runs, checkout, fetch, expansion, root or donor mutation occurred. The 24 MiB allocation and unchanged operation admission floors remain; positive WAL growth is counted once. Retained mount contract has empty filename-bearing mount argv and explicitly enumerates the nine --file staged inputs, including all production pins. No new mount configuration was used. Trusted Git SSH configuration is supplied by ops.py unchanged.

The original successful allocation returned JSONL and the whole-document parser failed; the original response and failed parser stderr remain under retained/test/evidence. Recovery used that original response, without allocation retry. Git alternate nesting warnings remain verbatim, including this review's source-tree stderr. The authoritative API info says bx_27q3w7ee snapshot verified at 05:31:34.510Z and actually stopped at 05:31:34.547Z; original expiry 06:00:38.936Z. No lifecycle operation is needed or performed.

The predecessor's final RAM closeout admission failed before child creation. Exact failure-time RAM/timestamp/device/f_bavail/block size were not emitted; no fresh sample replaces them. Its external publication-receipt.json was never created. The predecessor canonical's prospective publication wording is qualified by retained/coordinator-note.json and completion-receipt.json: coordinator-verified commit `0d21814df575b5b7f2c299e5e27f012c044adbe6`, remote `refs/heads/task/toyvm-nonempty-rmdir-runtime-oct29`, plus durable completion receipt supplement the missing worker closeout only.

Remaining gates: coordinator appends this task's exact commit/ref/canonical pointer to the oversized messageboard and retains allocation through delivery; review before integration. No main merge, public deployment, broad resource, browser or gameplay acceptance is authorized or claimed.
