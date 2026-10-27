# Airstrike controller independent acceptance — 2026-10-27

PASS for offline controller acceptance of exact candidate
`565ceadbe8e63c88754bda4590df156cbba6bf85`. This report-only branch does
not change controller/game code or qualify actual gameplay or current main.

The actual unchanged `tools/airstrike-menu-controller.py` executable was invoked
through its NDJSON stdin/stdout entry point. Source SHA256 is
`e96344c2a89dba87c28eba0aba9cd3ea5b400cc0245734b2bbc9248e110e7ebb`;
the unchanged original test SHA256 is
`0dbcef01a53836b7acd2127d93087ae154225b519d16fe4cca1172b964f8bfb6`.
Git blob identities and exact candidate are in source-pins.json.

## Production contract and source

Before behavioral checks, independently read and pinned the candidate production
`test/run.js`, `lib/renderer-input.js`, and `lib/host-window.js`, including the
actual --control-stdin queue, live input settlement, command dispatch and host
exit logging. production-contract.json binds hashes and exact excerpt recipe.
Commands `{id,cmd:"keydown:VK"}` and keyup match the runner; ACKs must identify
that command and carry executed-input logs. Frozen queued ACKs do not suffice.
ACKs do not prove focus, SDL consumption or selected menu row.

Independently hashed the original source archive and only its airstrike.c member,
without full extraction. All 309 retained numbered excerpt lines match after
the published trailing-whitespace normalization. source-contract.json records
the exact normalization and original byte-preserving excerpt recipe/hash.
Escape toggles pause; SDL keydown controls the menu; all seven labels and starred
row are source-backed; Down advances and row6 selects exit(EXIT_SUCCESS).
Renderer interception remains possible and must be excluded by real observations.

## Independent acceptance

First actual-CLI check: a terminal receipt before any observed Quit activation
refuses without dispatch. Fourteen independent cases passed, with exact request,
stdout, stderr, return code and expected commands in boundary-transcripts.json:
terminal before observation; valid terminal immediately after Enter dispatch;
terminal after keyup ACK; stale initial observation; uncertain key release;
boolean row; wrong ACK identity; queued ACK even with a matching input log;
wrong-key log; terminal during navigation; wrong keyup ACK; stale post-release
observation; fresh observed final row then normal terminal; fault refusal.
The trusted-parent fixture is factual input, not OCR or a hostile-caller test.

All 16 published candidate manifest payloads were independently rehashed against
the exact commit and donor files. The original five actual-CLI fake-transport
groups remain unchanged and PASS; reused-groups.json retains their receipt.
They were not rerun. Twelve new cases were reused unchanged after the one
affected fixture expectation correction; only the remaining cases were executed.

First-failure evidence is preserved. One independent expected transcript omitted
keyup after an acknowledged Enter keydown. Source correctly sends it before
reading terminal; the expected command list was corrected. The excerpt verifier
also initially assumed preserved trailing spaces and colon-space on empty lines;
both formatting assumptions were corrected with exact old scripts/logs retained.
These were verifier errors, not candidate behavior rejections. No oracle about
focus, normal exit, ACK identity or dispatch was weakened.

## Resources, scope and remaining gates

Python tests used the one-slot light pool and pinned supervisor
`9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`,
physical128MiB, CPU90s, wall120s, file24MiB, output2MiB; excerpts8192 and total
retained text well below1MiB. Every test receipt reports complete owned cleanup.
Git uses pool2 plus production flock, physical256MiB and DATA512MiB only in the
Git subprocess, with the dedicated strict SSH identity/known-hosts configuration.
Fresh gates retain disk floor2982150144 and physical floor2281701376, three
320MiB client reserves, 128MiB light pool and 805306368-byte headroom.
Old terminal-task prospective reservations were released; their used bytes remain
in measured free space. Airstrike32MiB, Penguin32MiB and Enigma48MiB outstanding
futures are counted once conservatively. This task retains four8MiB categories.
Admission/accounting separates borrowed standing inputs, own source/Git, launcher
events/session and positive WAL growth, evidence/publication and reserve.

Fresh original-game unobscured focus/menu observations, ordinary Quit and complete
normal terminal proof remain required. The controller trusts the parent to supply
same-session factual receipts and retain correlated evidence; it cannot verify
image contents, acquire focus, or prove no external close from a log alone.
Current-main qualification remains separate. Historical115s sustained play was
not replayed and its timeout remains insufficient evidence of normal Quit.

No main integration, Node, guest, browser, build, Boat, SSH runtime or public
deployment ran. No boxes are assigned; old Airstrike/Penguin/MadBomber STOPPED
states are coordinator-supplied, unmodified and not re-queried. Lifecycle remains
coordinator-owned. Root checkout/index/refs and all donors remained read-only;
only the required append-only messageboard was changed outside this task.
