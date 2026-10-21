# Independent final ShowWindow/placement review — reject integration

Candidate `dd6c585bba95422da631fb59a24245f6566135c8`, evidence
`04d3f577b8e954a190f6b67ff7d4fa109a2d4651`. Main remains
`1d8dbd7a44656178d01869f28869be624a59fa39`. This report starts from main;
it does not integrate the candidate, its evidence, or unrelated documentation.

## Blocking correctness defect

The final startup WM_SIZE callback outlives the newly owned destruction-result
frame. In `src/09b-dispatch.wat`, CACA0031 releases the target and destruction
result cells **before** sending WM_SIZE, and uses CACA0001 as its return thunk.
CACA0001 then returns the saved normal result without checking target liveness.
Consequently a hidden window destroyed by this final callback makes
SetWindowPlacement return **1 instead of the required destruction failure 0**.
The correction covers destruction after ACTIVATEAPP/ACTIVATE/SETFOCUS/MOVE,
but not after SIZE. The updated census explanation overstates that coverage.

Actual guest x86 CALL/RET repro, receipt **cmd_d3smdp8m4csk**, assertion exit 1:

1. Create a hidden ordinary top-level fixture and select it as unactivated main.
2. Its wndproc consumes WM_WINDOWPOSCHANGED, preventing DefWindowProc from
   deriving an earlier MOVE/SIZE during the positioning phase. This is a valid
   application callback behavior, already covered by the maintained test.
3. Call SetWindowPlacement with SW_SHOWNORMAL and normal rectangle
   (31,47)-(331,267).
4. In the startup WM_SIZE callback call DestroyWindow on the receiving HWND.
5. The target is removed (`pn_live == -1`), yet placement returns 1.

The observed messages are CHANGING, CHANGED, ACTIVATEAPP, ACTIVATE, SETFOCUS,
MOVE, SIZE, DESTROY, NCDESTROY. Four matching controls destroy at ACTIVATEAPP,
ACTIVATE, SETFOCUS, or MOVE and return 0. All five cases restore caller ESP,
EBX/ESI/EDI and release WINDOWPOS depth. Thus this is a result/lifetime defect,
not a stack-cleanup failure, timeout, compilation failure or blocked runtime.
The independent fixture extends the candidate harness; production source is
unmodified. Its source and exact replay command are in the sibling evidence
directory. The full source patch, including placement snapshots, show-core
extraction, current-client delivery, host synchronization and continuation
changes, was read; this concrete defect prevents acceptance.

## Corrected behavior independently verified

Receipt **cmd_kd2kxfleftfp**, exit 0, replays the prior review's three natural
two-call cases: SW_SHOWNOACTIVATE makes the hidden target visible, followed by
SW_SHOWNORMAL; destruction at ACTIVATEAPP/ACTIVATE/SETFOCUS now returns prior
visibility 1. Four hidden/visible × activation-pending/complete controls return
0/1 correctly. Caller stack, nonvolatile registers and transaction depth pass.
This accepts that narrow correction, not the complete transaction.

## Provenance and preservation

All 7,134 source/test manifest entries independently match the exact candidate
Git blobs and assigned runtime files. Local and runtime manifest bytes match.
All 44 intake entries (39 game files plus provenance) and both runtime module
seals verify. Canonical module SHA256:
`f9bd92c5774f3bc332889f8765e75e4f85bef81692314c19186aff1c0dfe1271`.
Compat SHA256:
`eef7dc134267cb24314e4259c61430566d7d2f05664e8abeb441646dc7a51e05`.
The independent harness compiles candidate source with test-only exports;
it is not claimed to execute those uninstrumented canonical module bytes.

The corrected historical archive matches its committed Git blob and verifies
all 56 entries (SHA256
`a9a493af033ed4a14ab228e619f0bcb6a87e01b6355c37940ad251732ea79427`).
The repair archive likewise matches Git and verifies all 91 entries (SHA256
`6eb2053ddcd7e09e63405bc98c0c22aebade4e25d156cbb9d520160b9ca218b2`).
The repair report explicitly supersedes the old blanket archive acceptance,
retains the old archive, and separately records the two displaced receipts.
This packaging correction does not accept either production candidate.

## Stop boundary and handoff

Per the defect stop rule, no broad repair or further acceptance suite was run.
Target replacement, implicit creation/dialog paths, remaining nested/startup
variants, and fresh mutation controls remain independently unaccepted. Existing
implementer results are not promoted to independent passes. The canonical build
`cmd_zqjl8rpyz1fq` and 45.2245-second route `cmd_56klxvoae0jd` were not repeated;
this rejected review makes no new visual/gameplay acceptance claim. Scoring,
completion, audio quality/sync, FPS and Windows parity remain unqualified.

Owned run: `scratch/runs/20261021-hock-return-independent-final`.
Remote fixtures: `/home/user/hock-return-independent-final` on **bx_3f3x23m3**.
Exact source: `/home/user/hock-show-return-repair/repo`. Receipts and fixtures
were preserved locally before 05:50 UTC. RECOVERY.md records replay/recovery.
The box is left running (API idle, health ok), expiry **05:56:19.894Z**;
coordinator retains shutdown ownership. No lifecycle, worker, full build,
shared configuration, unrelated WIP, deployment or main mutation was performed.
Publication records the pushed report commit and independently verified refs.
