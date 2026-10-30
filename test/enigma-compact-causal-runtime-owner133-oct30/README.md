# Original Enigma Start Game causal experiment, 2026-10-30

One original guest invocation completed in 45.249 seconds. Explicit API tracing
was disabled at frozen batch 0 before unfreeze. At 30 seconds the real snapshot
reported `Enigma - Main Menu`; the new PNG visibly contains its Start Game button.
The ordinary canvas move at (343,213) was dequeued at batch 88909 as WM_MOUSEMOVE,
client lParam 0x00aa0140, hwnd/focus 0x10001. Down at batch 89146 and up at 89238
were routed by the production renderer to its native-child path. Neither button
has a host-dequeue record in the collected trace. The guest continued to batch
91095. Before, after-mouse and final PNGs have identical SHA256; the inspected
after-mouse.png remains the Main Menu. Gameplay is not accepted.

This isolates an observable routing boundary for coordinator review. It does
not prove an emulator defect, a returned guest MSG, DispatchMessage completion,
or SDL consumption. The short armed window contains `post-handler-unqualified`
records with null MSG/successfulReturn; its advertised completion capability is
not a successful guest-consumption observation. No guest memory was modified.
No repair, second run, current-main test, build or deployment was performed.

The historical module is from 425755ee5ee9be0734c7aca187521100f5487674,
paired with accepted host facebcb2e6d04b84e80211a7814654e528566b0f.
The exact argv, module/media pins, streaming check of all 2663 archive members,
mount count and canonical parser receipts are in preflight.json. There are
2460 actual VFS filenames and zero comma-bearing filenames. A small fixture
through the archived canonical tree consumer proved comma preservation;
the actual production argv mounts the unchanged complete tree.

Accounting now separates compact `e/` from selected `images/` and launcher
events/output. All remain physically charged, including old task artifacts.
The fixture physically charged a 2 MiB raw placeholder outside compact E and
proved E overflow rejects; both disposable placeholders were removed. Limits
remain compact 1 MiB, selected PNG 8 MiB, all local files 64 MiB with 8 MiB
reserve, disk free after remaining local growth 3 GiB, local memory floor 2 GiB.
The policy's retained initialEnvelope field is historical metadata; admission
uses the 64 MiB local allocation, with the remote 256 MiB budget separately
enforced. No stale aggregate forecast authorizes this task.

Recovery requires a new coordinator assignment. Reuse the archive parts at
`/tmp/enigma-original-menu-render-runtime-oct30/archive.json` in place. Stream
SHA256 43dcac837bfe6b2eaa1c3aa4c2a3a63ea42ffeed54f1128ef192c2cbd5e757c3,
then transfer through supported API chunks <=49152 bytes and extract beneath
`/home/user/enigma-original`. causal-runtime.py and causal-guest.py preserve the
exact recipe, corrected trace control and 30/32/33.2/33.8-second schedule.
They enforce remote Node startup, CPU150/155, guest wall115, memory floor2.5GiB,
arena/Node heap512MiB, groupRSS2GiB, logs2MiB/files4MiB and allocation256MiB
including8MiB reserve. Local Python soft DATA128MiB preserves inherited hard;
Git DATA256 applies only to Git children, Node retains original DATA/AS.

Boat bx_uzcekkxr was snapshot-verified at 06:17:59.774Z and stopped at
06:17:59.813Z after collection. The sealed stdout/stderr remain in its snapshot
under `/home/user/enigma-original/capture`; capture-manifest.json gives hashes.
Never resume it as part of this completed task. New PNG and runtime JSON are
also retained in the task artifact directory named in summary.json.

Run `python3 verify-evidence.py` here to validate these actual collected results.
Source dumps and the predecessor recovery patch are referenced by path/hash,
not duplicated or staged. The branch was born at evidence HEAD aa2b1ba260b62375ddddb5f7d8e0058bb9372325.
