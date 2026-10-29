# Independent retained same-path directory rename acceptance

PASS for production candidate `5a88ca099b962e946160afd2d4d71a950bf46db3`, predecessor `6cf18d270c053bf65af79dd5b02aeafd1891b163`. `canonical.json` records all five exact source pins, immutable input anchors, results and limitations. This task ran no production invocation and performed no runtime replay, Boat operation, production repair, main merge or public deployment.

The unchanged fixture creates D and D/E, records both inode identities, calls `os.rename(E,E)`, then checks that both remain directories with the original identities. The retained actual CLI exited 0 with accepted/accountingAccepted/childSucceeded true, no stop reason or filesystem failure, and the exact `rename-samepath-preserved` marker with nodesPreserved=true and D=2, E=3. Its measured post-reap counters are live=peak=12288, written=0, inodes=3, openHandles=0. Both cleanup flags are true; the sampled PID/start identities were reaped, the production-owned identity matched samples, FUSE disconnected, and no external safety cleanup ran.

Independent checks start at the retained production CLI boundary: exact argv and fixture, source before/after pins and executable pins, raw guest result and CLI stdout/stderr, and the successful nontruncated Boat API execution envelope. Both original manifests and every listed raw file were verified and retained. The predecessor's gatePASS boolean is not used as the acceptance oracle. Source files are parsed, never imported or executed. The unchanged launch receipt has empty guest mount argv and enumerates ten separate filename=value Boat file arguments; source entries match all five pins. No checkout or new mount operation occurred, and no Node executable was used.

Thirteen adversarial controls reject stale and changed-start identities, missing marker, wrong counter, changed argv, source-before and source-after changes, changed executable identity, incomplete cleanup, remaining mount, external safety cleanup, and missing or late source guard. Counter/cleanup mutations keep the redundant CLI report consistent to test the actual semantic checks. The inherited helper controls already reject omitted/root/donor cwd before spawn and confirm the Python child DATA limit.

AST review places the same-directory/same-name empty return before destination replacement, link decrement, collection and source removal. Source arithmetic infers root+D+E = 3*4096 = 12288; the retained post-reap counters are measurements. **Backend callback execution remains UNPROVEN: the kernel may short-circuit a same-path rename.** No direct callback coverage, browser, gameplay or general resource acceptance is claimed.

Run the offline acceptance from the assigned owned tree using its original-hard-limit supervisor:

```
python3 /tmp/toyvm-rename-samepath-runtime-independent-accept-oct29/ops.py acceptance python3 -B /tmp/toyvm-rename-samepath-runtime-independent-accept-oct29/repo/test/toyvm-rename-samepath-runtime-independent-accept-oct29/accept.py
```

Actual supervisor receipts are retained in `operations/`: original DATA hard infinity, parent soft128 MiB with unchanged hard, Python128 MiB/Git-only256 MiB children; physical parent128/group512 MiB, CPU90 seconds, wall120 seconds, file12 MiB, capture2 MiB, evidence1 MiB. Each operation admits against unchanged host floors and the transferred aggregate allocation; the task owns 24 MiB (source/Git3, evidence1, WAL8, publication3, uncertainty9), positive WAL counted once. Git commands use the exact owned top-level and gitdir and supplied trusted SSH configuration. No root/donor writes, clone, fetch, sparse expansion or alternate-store repair occurred.

Preserved warning: predecessor Git reported ignored deeply nested alternate stores, while review, commit, push and exact remote verification exited 0. This acceptance retains the warning and makes no object-store repair claim.

Boat `bx_h4faubeu` was already snapshot-stopped at `2026-10-29T05:34:09.218Z`; original expiry `2026-10-29T06:03:31.190Z`. Coordinator retains lifecycle ownership; this worker performed no lifecycle operation. Coordinator review/integration and any direct backend callback coverage remain separate gates. The bounded coordinator note supplies the new verified commit/ref for append-only messageboard publication.
