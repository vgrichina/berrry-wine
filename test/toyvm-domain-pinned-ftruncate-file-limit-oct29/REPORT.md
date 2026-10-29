# Absolute-domain ftruncate per-file enforcement

PASS: one unmodified production CLI/FUSE invocation at candidate `5a88ca099b962e946160afd2d4d71a950bf46db3` rejected `os.ftruncate(fd, 16385)` with `filesystem per-file limit` and CLI exit 1. The fixture creates `/tmp/tvft2/w/domain/A`, flushes the attempted-size marker once, truncates once, then closes. It performs no write and no retry.

Limits: live 32768, write 65536, file 16384, RSS 134217728, CPU 2 seconds, wall 5 seconds, output 4096 bytes. The 24-byte status socket matches the dispatch. Filesystem live/peak 8192, written 0, handles 0, inodes 2. Cleanup completed, all externally observed PID/start identities disappeared, production-owned identities matched, and FUSE disconnected. No external emergency cleanup occurred.

The pinned observer and source copies were verified at the execution location, alongside executable identities. Boat bx_76gy8xxq was recovered, snapshot-stopped and independently observed stopped with completed verified snapshot. Its original expiry was 2026-10-29T05:14:53.237Z.

The previous relative-A EACCES failure remains unchanged and is not a production defect. This result qualifies only the stated ftruncate boundary. It makes no gameplay, browser, broader syscall or general resource qualification claim. Browser allowance remains CPU 35.353183 seconds, wall 101.495550694 seconds, captures 1. Historical startup/post-WAL accounting limitations remain; the local baseline is pre-operation only.

Run `python3 -B test/toyvm-domain-pinned-ftruncate-file-limit-oct29/assert_evidence.py` to independently check retained evidence without another runtime invocation. Canonical evidence is `evidence/canonical-receipt.json`; raw CLI output, observer result, prelaunch pins and stopped-state receipt are adjacent. Private launch/API/admission evidence and publication receipt remain in the task-owned directory.
